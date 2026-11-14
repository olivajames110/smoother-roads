import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { fetchVisitStats, type VisitDay, type VisitStats } from "../lib/visits";
import { Icon } from "./Icon";

const DAYS = 30;

function dayLabel(day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }) {
  return new Date(day + "T12:00:00").toLocaleDateString(undefined, opts);
}

// Visitors per day for the last 30 days, one bar a day, hover for the numbers
function DayChart({ days }: { days: VisitDay[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...days.map((d) => d.visitors));
  const W = 400;
  const H = 120;
  const step = W / days.length;
  const bar = Math.max(2, step - 2); // 2px gap between bars
  const h = hover != null ? days[hover] : null;
  return (
    <div className="vs-chart">
      <div className="vs-chart-head">
        <span>Visitors per day</span>
        <span className="vs-peak">Peak {max.toLocaleString()}</span>
      </div>
      <div className="vs-plot" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Visitors per day, last 30 days">
          <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} className="vs-base" />
          {days.map((d, i) => {
            const bh = d.visitors ? Math.max(3, (d.visitors / max) * (H - 6)) : 0;
            return (
              <g key={d.day} onMouseEnter={() => setHover(i)}>
                <rect x={i * step} y="0" width={step} height={H} fill="transparent" />
                {bh > 0 && (
                  <path
                    className={"vs-bar" + (hover === i ? " on" : "")}
                    d={`M${i * step + 1},${H} v${-(bh - 2)} q0,-2 2,-2 h${bar - 4} q2,0 2,2 v${bh - 2} z`}
                  />
                )}
              </g>
            );
          })}
        </svg>
        {h && (
          <div className="vs-tip" style={{ left: `${((hover! + 0.5) / days.length) * 100}%` }}>
            <b>{dayLabel(h.day, { weekday: "short", month: "short", day: "numeric" })}</b>
            <span>
              {h.visitors.toLocaleString()} visitor{h.visitors === 1 ? "" : "s"} · {h.visits.toLocaleString()} visit
              {h.visits === 1 ? "" : "s"}
            </span>
          </div>
        )}
      </div>
      <div className="vs-axis">
        <span>{dayLabel(days[0].day)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

// Admin only: who's been visiting (the admin's own visits are never counted)
export function Visitors() {
  const open = useStore((s) => s.visitsOpen);
  const patch = useStore((s) => s.patch);
  const [stats, setStats] = useState<VisitStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const close = () => patch({ visitsOpen: false });

  useEffect(() => {
    if (!open) return;
    setError(null);
    fetchVisitStats(DAYS).then(setStats, (e: Error) => setError(e.message || "Couldn't load the visitors"));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!open) return null;
  const today = stats?.days[stats.days.length - 1];
  const tiles = stats && [
    { label: "Today", value: today?.visitors ?? 0 },
    { label: "Last 7 days", value: stats.week_visitors },
    { label: "Last 30 days", value: stats.period_visitors },
    { label: "All time", value: stats.total_visitors },
  ];

  return (
    <div className="modal-back" onClick={close}>
      <div className="modal vs" role="dialog" aria-modal="true" aria-labelledby="vs-title" onClick={(e) => e.stopPropagation()}>
        <button className="ibtn modal-x" aria-label="Close" onClick={close}>
          <Icon name="x" size={18} />
        </button>
        <p className="modal-kicker">Admin</p>
        <h2 id="vs-title">Visitors</h2>
        <p className="modal-text">Unique browsers on the site. Your own visits, and any from your IP, aren't counted.</p>

        {error ? (
          <p className="vs-msg vs-err">{error}</p>
        ) : !stats ? (
          <p className="vs-msg">Loading…</p>
        ) : (
          <>
            <div className="vs-tiles">
              {tiles!.map((t) => (
                <div key={t.label} className="vs-tile">
                  <b>{t.value.toLocaleString()}</b>
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
            <DayChart days={stats.days} />
            <div className="vs-refs">
              <div className="vs-refs-head">
                <span>Came from (30 days)</span>
                <span>{stats.total_visits.toLocaleString()} visits all time</span>
              </div>
              {stats.referrers.length ? (
                stats.referrers.map((r) => (
                  <div key={r.host} className="vs-ref">
                    <span>{r.host}</span>
                    <b>{r.visits.toLocaleString()}</b>
                  </div>
                ))
              ) : (
                <p className="vs-msg">No other sites yet. Visits so far came from links typed in or bookmarks.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
