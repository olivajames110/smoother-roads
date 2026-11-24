import { useEffect, useMemo, useRef, useState } from "react";
import { fmtN, norm } from "../lib/format";
import { CATS, STATUS } from "../lib/icons";
import { useStore } from "../lib/store";
import type { Area, Status } from "../lib/types";
import { fetchWorkVotes, setWorkVote, type WorkVotes } from "../lib/workVotes";
import { Icon } from "./Icon";

interface Votes {
  of: (id: string) => number;
  mine: (id: string) => boolean;
  toggle: (id: string) => void;
  open: boolean; // voting is open (the database table exists)
}

// One area in a column: rank, name (click opens it on the map), place, and the vote button
function Row({ area: a, rank, votes }: { area: Area; rank: number; votes: Votes }) {
  const openDetail = useStore((s) => s.openDetail);
  const voted = votes.mine(a.id);
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
        <span className="vp-sub">{[a.region, CATS[a.cat].label].filter(Boolean).join(" · ")}</span>
      </button>
      <button
        className={"vp-vote" + (voted ? " on" : "")}
        aria-pressed={voted}
        disabled={!votes.open}
        title={!votes.open ? "Voting isn't open yet" : voted ? "Take your vote back" : "Vote for this area"}
        onClick={() => votes.toggle(a.id)}
      >
        <Icon name="up" size={14} weight={2.2} />
        {fmtN(votes.of(a.id))}
      </button>
    </div>
  );
}

function Column({ status, areas, hint, votes }: { status: Status; areas: Area[]; hint: string; votes: Votes }) {
  const s = STATUS[status];
  // ties share a rank
  const rank = (a: Area) => 1 + areas.filter((b) => votes.of(b.id) > votes.of(a.id)).length;
  return (
    <section className="vp-col">
      <header className="vp-col-h">
        <span className="sdot" style={{ background: s.color }} />
        <h2>{s.label}</h2>
        <span className="vp-n">{areas.length}</span>
      </header>
      <p className="vp-hint">{hint}</p>
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

// The Vote page (covers the map area; /smoother-roads/vote): what should be worked on next.
// Left: every requested area by votes. Right: the ones in progress, also by votes, still votable.
// These votes are their own count ("work on this next", 027_work_votes.sql), apart from an area's upvotes:
// one per area, click again to take it back.
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
      () => live && setData({ ready: false, counts: new Map(), mine: new Set() }),
    );
    return () => {
      live = false;
    };
  }, []);

  const votes: Votes = {
    open: !!data?.ready,
    of: (id) => data?.counts.get(id) ?? 0,
    mine: (id) => !!data?.mine.has(id),
    toggle(id) {
      if (!data?.ready || busy.current.has(id)) return;
      const on = !data.mine.has(id);
      // shown right away, undone if the database refuses it
      const flip = (d: WorkVotes, to: boolean): WorkVotes => {
        const counts = new Map(d.counts);
        const mine = new Set(d.mine);
        counts.set(id, Math.max(0, (counts.get(id) ?? 0) + (to ? 1 : -1)));
        if (to) mine.add(id);
        else mine.delete(id);
        return { ...d, counts, mine };
      };
      setData((d) => (d ? flip(d, on) : d));
      busy.current.add(id);
      setWorkVote(id, on)
        .catch(() => {
          setData((d) => (d ? flip(d, !on) : d));
          showToast("Couldn't save your vote. Please try again.", true);
        })
        .finally(() => busy.current.delete(id));
    },
  };

  const { requested, progress, mine } = useMemo(() => {
    const n = norm(q.trim());
    const of = (id: string) => data?.counts.get(id) ?? 0;
    const listed = (status: Status) => areas.filter((a) => a.status === status && !a.hidden);
    const pick = (status: Status) =>
      listed(status)
        .filter((a) => !n || [a.name, a.region, a.country].some((s) => norm(s).includes(n)))
        .sort((x, y) => of(y.id) - of(x.id) || x.name.localeCompare(y.name));
    const ids = new Set([...listed("requested"), ...listed("progress")].map((a) => a.id));
    return {
      requested: pick("requested"),
      progress: pick("progress"),
      mine: [...(data?.mine ?? [])].filter((id) => ids.has(id)).length,
    };
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
            <p>
              Vote for the areas you want worked on next. One vote per area, as many areas as you like; click again to
              take a vote back. These votes are counted on their own, apart from an area's upvotes.
            </p>
          </div>
          <div className="vp-mine">
            <b>{mine}</b>
            <span>your vote{mine === 1 ? "" : "s"}</span>
          </div>
        </header>

        {data && !data.ready && <div className="vp-closed">Voting isn't open yet. Check back soon.</div>}

        <div className="search vp-search">
          <Icon name="search" size={15} />
          <input
            className="input"
            placeholder="Search city, region or country"
            aria-label="Search the areas"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>

        <div className="vp-cols">
          <Column status="requested" areas={requested} votes={votes} hint="Not started yet. The most wanted ones get picked first." />
          <Column
            status="progress"
            areas={progress}
            votes={votes}
            hint="Being worked on now. Votes decide which one gets finished first."
          />
        </div>
      </div>
    </div>
  );
}
