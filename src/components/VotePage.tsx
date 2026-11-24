import { useMemo, useState } from "react";
import { fmtN, norm } from "../lib/format";
import { CATS, STATUS } from "../lib/icons";
import { useStore } from "../lib/store";
import type { Area, Status } from "../lib/types";
import { Icon } from "./Icon";

// One area in a column: rank, name (click opens it on the map), place, and the upvote button
function Row({ area: a, rank }: { area: Area; rank: number }) {
  const toggleVote = useStore((s) => s.toggleVote);
  const openDetail = useStore((s) => s.openDetail);
  return (
    <div className={"vp-row" + (a.voted ? " on" : "")}>
      <span className="vp-rank">{rank}</span>
      <button className="vp-main" title="Open this area on the map" onClick={() => openDetail(a.id)}>
        <span className="vp-name">
          {a.name}
          {a.cat === "hill" && (
            <span className="hill-tag" title="Hill climb">
              <Icon d={CATS.hill.icon} size={13} weight={2.2} />
            </span>
          )}
        </span>
        <span className="vp-sub">{[a.region, CATS[a.cat].label].filter(Boolean).join(" · ")}</span>
      </button>
      <button
        className={"vp-vote" + (a.voted ? " on" : "")}
        aria-pressed={a.voted}
        title={a.voted ? "Remove your upvote" : "Upvote this area"}
        onClick={() => toggleVote(a.id)}
      >
        <Icon name="up" size={14} weight={2.2} />
        {fmtN(a.votes)}
      </button>
    </div>
  );
}

function Column({ status, areas, hint }: { status: Status; areas: Area[]; hint: string }) {
  const s = STATUS[status];
  // ties share a rank
  const rank = (a: Area) => 1 + areas.filter((b) => b.votes > a.votes).length;
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
            <Row key={a.id} area={a} rank={rank(a)} />
          ))}
        </div>
      )}
    </section>
  );
}

// The Vote page (covers the map area; /smoother-roads/vote): what should be worked on next.
// Left: every requested area by votes. Right: the ones in progress, also by votes, still votable.
// Votes are the same upvotes as everywhere else on the site (one per area, click again to take it back).
export function VotePage() {
  const areas = useStore((s) => s.areas);
  const patch = useStore((s) => s.patch);
  const beginRequest = useStore((s) => s.beginRequest);
  const openSubmit = useStore((s) => s.openSubmit);
  const [q, setQ] = useState("");

  const { requested, progress, mine } = useMemo(() => {
    const n = norm(q.trim());
    const pick = (status: Status) =>
      areas
        .filter((a) => a.status === status && !a.hidden)
        .filter((a) => !n || [a.name, a.region, a.country].some((s) => norm(s).includes(n)))
        .sort((x, y) => y.votes - x.votes || x.name.localeCompare(y.name));
    return {
      requested: pick("requested"),
      progress: pick("progress"),
      mine: areas.filter((a) => a.voted && (a.status === "requested" || a.status === "progress")).length,
    };
  }, [areas, q]);

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
              Upvote the areas you want smoothed next. One vote per area, as many areas as you like; click again to take
              a vote back.
            </p>
          </div>
          <div className="vp-mine">
            <b>{mine}</b>
            <span>your vote{mine === 1 ? "" : "s"}</span>
          </div>
        </header>

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
          <Column status="requested" areas={requested} hint="Not started yet. The most wanted ones get picked first." />
          <Column status="progress" areas={progress} hint="Being worked on now. Votes decide which one gets finished first." />
        </div>
      </div>
    </div>
  );
}
