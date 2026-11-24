import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ratingOf } from "../lib/comments";
import { CONFIG } from "../lib/config";
import { fmtDate, fmtN, norm } from "../lib/format";
import { coverageMi2, coverageShort } from "../lib/geo";
import { CATS, STATUS, statusLabel, statusNote } from "../lib/icons";
import { useStore } from "../lib/store";
import type { Area, Status } from "../lib/types";
import { DAILY_VOTES, fetchWorkVotes, setWorkVote, type WorkVotes } from "../lib/workVotes";
import { Icon } from "./Icon";
import { formatNotes } from "./LinkedText";

interface Votes {
  of: (id: string) => number;
  mine: (id: string) => boolean; // voted for today
  toggle: (id: string) => void;
  open: boolean; // voting is open (the database table exists)
  left: number; // votes left today
  show: (id: string) => void; // open the location's card
}

// When voting ends (CONFIG.voteEnds): the text shown on the page, and whether that day has passed
function voteEnd() {
  if (!CONFIG.voteEnds) return { day: "To be announced", full: "No end date has been set yet", over: false, set: false };
  const last = new Date(CONFIG.voteEnds + "T23:59:59Z");
  const fmt = (o: Intl.DateTimeFormatOptions) => last.toLocaleDateString(undefined, { ...o, timeZone: "UTC" });
  const over = Date.now() > last.getTime();
  return {
    day: fmt({ month: "short", day: "numeric" }),
    full: (over ? "Voting ended " : "Voting ends ") + fmt({ month: "long", day: "numeric", year: "numeric" }) + " (UTC)",
    over,
    set: true,
  };
}

// The three columns: what a vote there means
const COLUMNS: { status: Status; title: string }[] = [
  { status: "requested", title: "Add this location" },
  { status: "progress", title: "Keep working on it" },
  { status: "released", title: "Improve this location" },
];

// The vote button: the location's votes; pressed when this browser voted for it today
function VoteButton({ area: a, votes, wide }: { area: Area; votes: Votes; wide?: boolean }) {
  const voted = votes.mine(a.id);
  const blocked = !votes.open || (!voted && votes.left === 0);
  return (
    <button
      className={"vp-vote" + (voted ? " on" : "") + (wide ? " wide" : "")}
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
      {wide && <span>{voted ? "Voted today" : votes.of(a.id) === 1 ? "vote" : "votes"}</span>}
    </button>
  );
}

// A location's card, over the Vote page: what it is, its numbers, the vote button, and a way to the map
function AreaModal({ area: a, votes, close }: { area: Area; votes: Votes; close: () => void }) {
  const openDetail = useStore((s) => s.openDetail);
  const packKm = useStore((s) => s.lineIndex?.[a.id]);
  // Esc closes this card only (not the Vote page under it)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopImmediatePropagation();
      close();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [close]);

  const status = STATUS[a.status];
  const photo = (a.photos ?? []).find((p) => p.approved);
  const roadKm = a.roadKm ?? packKm ?? null;
  const pois = (a.pois ?? []).filter((p) => p.approved);
  const places = pois.filter((p) => p.kind === "place").length;
  const routes = pois.filter((p) => p.kind === "route").length;
  const rating = ratingOf(a.comments);
  const stats: [string, string, string][] = [["Area", coverageMi2(a.shape), coverageShort(a.shape)]];
  if (roadKm != null)
    stats.push(["Roads", `${Math.round(roadKm * 0.621371).toLocaleString()} mi`, `${Math.round(roadKm).toLocaleString()} km`]);
  if (a.status === "released") {
    stats.push(["Places", String(places), `${routes} route${routes === 1 ? "" : "s"}`]);
    stats.push([
      "Rating",
      rating.count ? rating.avg.toFixed(1) : "None",
      rating.count ? `${rating.count} review${rating.count === 1 ? "" : "s"}` : "No reviews yet",
    ]);
  } else {
    stats.push(["Upvotes", fmtN(a.votes), "on the map"]);
  }

  // on the page itself (not inside the Vote page), so the dimming covers the sidebar too
  return createPortal(
    <div className="modal-back" onClick={close}>
      <div className="modal vp-modal" role="dialog" aria-modal="true" aria-labelledby="vp-modal-t" onClick={(e) => e.stopPropagation()}>
        <button className="ibtn modal-x" title="Close" onClick={close}>
          <Icon name="x" size={17} />
        </button>
        {photo && <img className="vp-modal-img" src={photo.url} alt={`Photo by ${photo.author}`} />}
        <div className="eyebrow">
          <span className="badge" style={{ background: status.tint, color: status.ink }}>
            {statusLabel(a)}
          </span>
          <span className="badge cat-b">{CATS[a.cat].label}</span>
        </div>
        <h2 id="vp-modal-t">{a.name}</h2>
        <p className="vp-modal-sub">
          {[a.region, (a.status === "released" ? "Added " : "Requested ") + fmtDate(a.date)].filter(Boolean).join(" · ")}
        </p>
        <div className="vp-modal-stats">
          {stats.map(([k, v, v2]) => (
            <div key={k} className="stat">
              <div className="k">{k}</div>
              <div className="v">{v}</div>
              <span className="v2">{v2}</span>
            </div>
          ))}
        </div>
        {statusNote(a) && <div className="vp-modal-note">{statusNote(a)}</div>}
        {a.notes && <div className="notes vp-modal-notes">{a.notesAdmin ? formatNotes(a.notes) : a.notes}</div>}
        {a.requestNotes && !a.notes && <div className="notes vp-modal-notes">{a.requestNotes}</div>}
        <div className="modal-foot">
          <button className="btn sm" onClick={() => openDetail(a.id)}>
            <Icon name="pin" size={14} />
            Open on the map
          </button>
          <VoteButton area={a} votes={votes} wide />
        </div>
      </div>
    </div>,
    document.body,
  );
}

// One area in a column: rank, name (click opens it on the map), place, and the vote button
function Row({ area: a, rank, votes }: { area: Area; rank: number; votes: Votes }) {
  return (
    <div className={"vp-row" + (votes.mine(a.id) ? " on" : "")}>
      <span className="vp-rank">{rank}</span>
      <button className="vp-main" title="About this location" onClick={() => votes.show(a.id)}>
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
      <VoteButton area={a} votes={votes} />
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
  const [shownId, setShownId] = useState<string | null>(null);
  const shown = areas.find((a) => a.id === shownId);
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
  const end = voteEnd();
  const votes: Votes = {
    open: !!data?.ready && !end.over,
    left,
    show: setShownId,
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
            {/* when voting ends: its own card beside the counters */}
            <div className={"vp-mine vp-ends" + (end.over ? " over" : end.set ? "" : " tba")} title={end.full}>
              <b>
                <Icon d='<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>' size={15} weight={2.2} />
                {end.day}
              </b>
              <span>{end.over ? "voting ended" : "voting ends"}</span>
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

        {shown && <AreaModal area={shown} votes={votes} close={() => setShownId(null)} />}

        <div className="vp-cols">
          {COLUMNS.map((c, i) => (
            <Column key={c.status} status={c.status} title={c.title} areas={lists[i]} votes={votes} />
          ))}
        </div>
      </div>
    </div>
  );
}
