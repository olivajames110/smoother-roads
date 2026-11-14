import { useEffect, useMemo, useState } from "react";
import { amAdmin } from "../lib/comments";
import { loadAreas } from "../lib/data";
import { fmtDate } from "../lib/format";
import { CATS } from "../lib/icons";
import { castVote, DAILY_VOTES, endRound, fetchBoard, msToReset, takeBack, type VoteBoard } from "../lib/nextVotes";
import type { Area } from "../lib/types";
import { Icon } from "./Icon";

const HOME = import.meta.env.BASE_URL;

function resetText() {
  const m = Math.ceil(msToReset() / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

// The "vote for the next area" page (?vote): every requested area, votes in rounds, 3 a day
export function NextVote() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [board, setBoard] = useState<VoteBoard | null>(null);
  const [admin, setAdmin] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [note, setNote] = useState<{ text: string; bad?: boolean } | null>(null);
  const [, tick] = useState(0);

  const refresh = async () => setBoard(await fetchBoard());

  useEffect(() => {
    document.title = "Vote for the next area · Smoother Roads";
    loadAreas(false).then(setAreas);
    refresh();
    amAdmin().then(setAdmin);
    const t = setInterval(() => tick((n) => n + 1), 30000); // the reset countdown
    return () => clearInterval(t);
  }, []);

  const byId = useMemo(() => new Map(areas.map((a) => [a.id, a])), [areas]);
  const candidates = useMemo(() => {
    const list = areas.filter((a) => a.status === "requested" && !a.hidden);
    const votes = (a: Area) => board?.counts.get(a.id)?.votes ?? 0;
    return list.sort((x, y) => votes(y) - votes(x) || x.name.localeCompare(y.name));
  }, [areas, board]);

  const mine = board?.mineToday ?? new Set<string>();
  const left = Math.max(0, DAILY_VOTES - mine.size);
  const top = candidates.length ? board?.counts.get(candidates[0].id)?.votes ?? 0 : 0;
  const total = [...(board?.counts.values() ?? [])].reduce((n, c) => n + c.votes, 0);
  const needle = q.trim().toLowerCase();
  const shown = candidates.filter((a) => !needle || `${a.name} ${a.region}`.toLowerCase().includes(needle));
  // rank by votes in the round (ties share a rank)
  const rankOf = (a: Area) => {
    const v = board?.counts.get(a.id)?.votes ?? 0;
    return 1 + candidates.filter((c) => (board?.counts.get(c.id)?.votes ?? 0) > v).length;
  };

  const toggle = async (a: Area) => {
    if (busy) return;
    const voted = mine.has(a.id);
    if (!voted && left === 0) {
      setNote({ text: `You've used today's ${DAILY_VOTES} votes. More in ${resetText()}.`, bad: true });
      return;
    }
    setBusy(a.id);
    setNote(null);
    try {
      if (voted) await takeBack(a.id);
      else await castVote(a.id);
      await refresh();
      if (!voted) setNote({ text: `Voted for ${a.name}.` });
    } catch (e) {
      const m = String((e as Error).message);
      setNote({
        text: m.includes("daily_limit")
          ? `You've used today's ${DAILY_VOTES} votes. More in ${resetText()}.`
          : m.includes("duplicate") || m.includes("23505")
            ? `You've already voted for ${a.name} today.`
            : m.includes("no_open_round")
              ? "Voting is closed right now. Check back soon."
              : "Couldn't save your vote. Please try again.",
        bad: true,
      });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const finish = async () => {
    const win = candidates[0];
    if (!win || !board?.round) return;
    if (!window.confirm(`End this round with ${win.name} as the winner and start a new round at zero?`)) return;
    try {
      await endRound(win.id);
      await refresh();
      setNote({ text: `Round ended. ${win.name} is next. A new round has started.` });
    } catch {
      setNote({ text: "Couldn't end the round.", bad: true });
    }
  };

  const ready = board !== null && areas.length > 0;
  const open = !!board?.round;

  return (
    <div className="nv">
      <header className="nv-top">
        <a className="nv-back" href={HOME}>
          <Icon d='<path d="m15 18-6-6 6-6"/>' size={16} weight={2.2} />
          Coverage map
        </a>
        <span className="nv-brand">Smoother Roads</span>
      </header>

      <main className="nv-main">
        <section className="nv-hero">
          <h1>Vote for the next area</h1>
          <p>
            Pick the requested areas you most want smoothed next. You get {DAILY_VOTES} votes every day, one per area.
            When a round ends, the area with the most votes is the next one I work on.
          </p>
          {open && (
            <div className="nv-stats">
              <div className="nv-left">
                <span className="nv-dots">
                  {Array.from({ length: DAILY_VOTES }, (_, i) => (
                    <i key={i} className={i < left ? "on" : ""} />
                  ))}
                </span>
                <b>{left}</b> of {DAILY_VOTES} votes left today
              </div>
              <span className="nv-sep">·</span>
              <span>New votes in {resetText()}</span>
              <span className="nv-sep">·</span>
              <span>
                Round started {fmtDate(Date.parse(board!.round!.startedAt))} · {total} vote{total === 1 ? "" : "s"}
              </span>
            </div>
          )}
          {note && <div className={"nv-note" + (note.bad ? " bad" : "")}>{note.text}</div>}
        </section>

        {!ready ? (
          <div className="nv-empty">Loading…</div>
        ) : !open ? (
          <div className="nv-empty">Voting isn't open yet. Check back soon.</div>
        ) : (
          <>
            <div className="nv-tools">
              <div className="search">
                <Icon name="search" size={15} />
                <input className="input" placeholder="Search areas" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              {admin && (
                <button className="btn sm" disabled={!top} onClick={finish} title="Close this round with the leader as the winner">
                  End round
                </button>
              )}
            </div>

            <ol className="nv-list">
              {shown.map((a) => {
                const c = board!.counts.get(a.id);
                const votes = c?.votes ?? 0;
                const voted = mine.has(a.id);
                const rank = votes ? rankOf(a) : null;
                return (
                  <li key={a.id} className={"nv-row" + (voted ? " voted" : "") + (rank === 1 ? " lead" : "")}>
                    <span className={"nv-rank" + (rank && rank <= 3 ? ` r${rank}` : "")}>{rank ?? "–"}</span>
                    <span className="nv-ico">
                      <Icon d={CATS[a.cat].icon} size={17} weight={2.2} />
                    </span>
                    <div className="nv-text">
                      <a className="nv-name" href={`${HOME}?area=${encodeURIComponent(a.id)}`} title="See it on the map">
                        {a.name}
                      </a>
                      <span className="nv-region">{a.region}</span>
                      <span className="nv-bar">
                        <span style={{ width: top ? `${(votes / top) * 100}%` : "0%" }} />
                      </span>
                    </div>
                    <div className="nv-count">
                      <b>{votes}</b>
                      <span>{c?.today ? `+${c.today} today` : votes === 1 ? "vote" : "votes"}</span>
                    </div>
                    <button
                      className={"nv-vote" + (voted ? " on" : "")}
                      disabled={busy === a.id || (!voted && left === 0)}
                      onClick={() => toggle(a)}
                      title={voted ? "Voted today. Click to take it back." : left ? "Vote for this area" : "No votes left today"}
                    >
                      {voted ? (
                        <>
                          <Icon name="check" size={15} weight={2.6} />
                          Voted
                        </>
                      ) : (
                        <>
                          <Icon d='<path d="M12 19V5M5 12l7-7 7 7"/>' size={15} weight={2.4} />
                          Vote
                        </>
                      )}
                    </button>
                  </li>
                );
              })}
              {shown.length === 0 && <li className="nv-empty">No requested areas match.</li>}
            </ol>
          </>
        )}

        {ready && board!.past.some((r) => r.winner) && (
          <section className="nv-past">
            <h2>Past winners</h2>
            {board!.past
              .filter((r) => r.winner)
              .map((r) => {
                const a = byId.get(r.winner!);
                return (
                  <a key={r.id} className="nv-win" href={`${HOME}?area=${encodeURIComponent(r.winner!)}`}>
                    <Icon d='<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/>' size={15} />
                    <span className="nv-win-name">{a?.name ?? r.winner}</span>
                    <span className="nv-win-date">{fmtDate(Date.parse(r.endedAt!))}</span>
                  </a>
                );
              })}
          </section>
        )}

        <p className="nv-foot">
          Don't see your area? <a href={HOME}>Request it on the map</a>, and it joins the vote.
        </p>
      </main>
    </div>
  );
}
