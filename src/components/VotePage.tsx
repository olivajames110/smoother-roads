import { useEffect, useMemo, useRef, useState } from "react";
import { fmtN, norm } from "../lib/format";
import { CATS, STATUS } from "../lib/icons";
import { useStore } from "../lib/store";
import type { Area, Status } from "../lib/types";
import { DAILY_VOTES, fetchWorkVotes, setWorkVote, type WorkVotes } from "../lib/workVotes";
import { Icon } from "./Icon";

interface Votes {
  of: (id: string) => number;
  mine: (id: string) => boolean; // voted for today
  toggle: (id: string) => void;
  open: boolean; // voting is open (the database table exists)
  left: number; // votes left today
}

// The three columns: what a vote there means
const COLUMNS: { status: Status; title: string }[] = [
  { status: "requested", title: "Add this location" },
  { status: "progress", title: "Keep working on it" },
  { status: "released", title: "Improve this location" },
];

// One area in a column: rank, name (click opens it on the map), place, and the vote button
function Row({ area: a, rank, votes }: { area: Area; rank: number; votes: Votes }) {
  const openDetail = useStore((s) => s.openDetail);
  const voted = votes.mine(a.id);
  const blocked = !votes.open || (!voted && votes.left === 0);
  return (
    <div className={"vp-row" + (voted ? " on" : "")}>
      <span className="vp-rank">{rank}</span>
      <button className="vp-main" title="Open this area on the map" onClick={() => openDetail(a.id)}>
        <span className="vp-name">
          {a.name}
          {a.cat === "hill" && (
            <span className="hill-tag" title="Hill climb">
              <Icon d={CATS.hill.icon} size={15} weight={2.2} />
            </span>
          )}
        </span>
        <span className="vp-sub">{a.region}</span>
      </button>
      <button
        className={"vp-vote" + (voted ? " on" : "")}
        aria-pressed={voted}
        disabled={blocked}
        title={
          !votes.open
            ? "Voting isn't open yet"
            : voted
              ? "Take today's vote back"
              : votes.left === 0
                ? "No votes left today"
                : "Vote for this location"
        }
        onClick={() => votes.toggle(a.id)}
      >
        <Icon name="up" size={14} weight={2.2} />
        {fmtN(votes.of(a.id))}
      </button>
    </div>
  );
}

function Column({ status, title, areas, votes }: { status: Status; title: string; areas: Area[]; votes: Votes }) {
  // ties share a rank
  const rank = (a: Area) => 1 + areas.filter((b) => votes.of(b.id) > votes.of(a.id)).length;
  return (
    <section className="vp-col">
      <header className="vp-col-h">
        <span className="sdot" style={{ background: STATUS[status].color }} />
        <h2>{title}</h2>
        <span className="vp-n">{areas.length}</span>
      </header>
      <div className="vp-status">{STATUS[status].label}</div>
      {areas.length === 0 ? (
        <div className="empty empty-box">Nothing here matches.</div>
      ) : (
        <div className="vp-list">
          {areas.map((a) => (
            <Row key={a.id} area={a} rank={rank(a)} votes={votes} />
          ))}
        </div>
      )}
    </section>
  );
}

// The Vote page (covers the map area; /smoother-roads/vote). Three columns, each by votes: requested areas (add it),
// areas in progress (keep working on it), released areas (improve it). These votes are their own count
// (027_work_votes.sql), apart from an area's upvotes: 3 a day, one per area per day, today's can be taken back.
export function VotePage() {
  const areas = useStore((s) => s.areas);
  const patch = useStore((s) => s.patch);
  const showToast = useStore((s) => s.showToast);
  const beginRequest = useStore((s) => s.beginRequest);
  const openSubmit = useStore((s) => s.openSubmit);
  const [q, setQ] = useState("");
  const [data, setData] = useState<WorkVotes | null>(null);
  const busy = useRef(new Set<string>());

  useEffect(() => {
    let live = true;
    fetchWorkVotes().then(
      (d) => live && setData(d),
      () => live && setData({ ready: false, counts: new Map(), today: new Set() }),
    );
    return () => {
      live = false;
    };
  }, []);

  const left = Math.max(0, DAILY_VOTES - (data?.today.size ?? 0));
  const votes: Votes = {
    open: !!data?.ready,
    left,
    of: (id) => data?.counts.get(id) ?? 0,
    mine: (id) => !!data?.today.has(id),
    toggle(id) {
      if (!data?.ready || busy.current.has(id)) return;
      const on = !data.today.has(id);
      if (on && left === 0) return;
      // shown right away, undone if the database refuses it
      const flip = (d: WorkVotes, to: boolean): WorkVotes => {
        const counts = new Map(d.counts);
        const today = new Set(d.today);
        counts.set(id, Math.max(0, (counts.get(id) ?? 0) + (to ? 1 : -1)));
        if (to) today.add(id);
        else today.delete(id);
        return { ...d, counts, today };
      };
      setData((d) => (d ? flip(d, on) : d));
      busy.current.add(id);
      setWorkVote(id, on)
        .catch((e: { message?: string }) => {
          setData((d) => (d ? flip(d, !on) : d));
          showToast(
            /daily vote limit/i.test(e?.message ?? "")
              ? "You've used today's 3 votes. More tomorrow."
              : "Couldn't save your vote. Please try again.",
            true,
          );
        })
        .finally(() => busy.current.delete(id));
    },
  };

  const lists = useMemo(() => {
    const n = norm(q.trim());
    const of = (id: string) => data?.counts.get(id) ?? 0;
    return COLUMNS.map((c) =>
      areas
        .filter((a) => a.status === c.status && !a.hidden)
        .filter((a) => !n || [a.name, a.region, a.country].some((s) => norm(s).includes(n)))
        .sort((x, y) => of(y.id) - of(x.id) || x.name.localeCompare(y.name)),
    );
  }, [areas, q, data]);

  return (
    <div className="vote-page">
      <div className="ap-bar">
        <button className="btn sm ap-back" onClick={() => patch({ votePage: false })}>
          <Icon d='<path d="m15 6-6 6 6 6"/>' size={14} weight={2.4} />
          Back to map
        </button>
        <span className="grow" />
        <button className="btn sm" onClick={() => beginRequest(openSubmit)}>
          <Icon d='<path d="M12 5v14M5 12h14"/>' size={14} weight={2.4} />
          Request an area
        </button>
      </div>

      <div className="vp-content">
        <header className="vp-head">
          <div className="grow">
            <h1>Vote for what's next</h1>
            <p>Cast up to 3 votes a day for a location you want added or improved.</p>
          </div>
          <div className="vp-tally" title="Votes reset at midnight UTC">
            <div className="vp-mine">
              <b>{DAILY_VOTES - left}</b>
              <span>your votes today</span>
            </div>
            <div className={"vp-mine" + (left === 0 ? " none" : "")}>
              <b>
                {left} <i>of {DAILY_VOTES}</i>
              </b>
              <span>votes left today</span>
            </div>
          </div>
        </header>

        {data && !data.ready && <div className="vp-closed">Voting isn't open yet. Check back soon.</div>}

        <div className="search vp-search">
          <Icon name="search" size={15} />
          <input
            className="input"
            placeholder="Search city, region or country"
            aria-label="Search the locations"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="vp-cols">
          {COLUMNS.map((c, i) => (
            <Column key={c.status} status={c.status} title={c.title} areas={lists[i]} votes={votes} />
          ))}
        </div>
      </div>
    </div>
  );
}
