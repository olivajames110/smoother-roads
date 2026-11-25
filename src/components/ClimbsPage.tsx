import { useEffect, useMemo, useState } from "react";
import { fetchClimbBoard, fmtRun, LEVELS, removeClimbTime, type ClimbBoard } from "../lib/climbs";
import { CONFIG } from "../lib/config";
import { fmtDate } from "../lib/format";
import { useStore } from "../lib/store";
import { Icon } from "./Icon";

const ALL = "All vehicles";
const HILL = '<path d="M1.5 20.5 9 6l4.2 7.4L15.8 9l6.7 11.5z" fill="currentColor" stroke-linejoin="round"/>';

// The Leaderboards page (covers the map area; /smoother-roads/leaderboards): the best timed runs on each released
// hill climb, as Street GPS submits them (028_climb_times.sql). One climb and one race level (where the run starts)
// at a time.
export function ClimbsPage() {
  const areas = useStore((s) => s.areas);
  const loaded = useStore((s) => s.loaded);
  const admin = useStore((s) => s.admin);
  const patch = useStore((s) => s.patch);
  const openDetail = useStore((s) => s.openDetail);
  const adminAction = useStore((s) => s.adminAction);
  const climbs = useMemo(
    () => areas.filter((a) => a.cat === "hill" && a.status === "released" && !a.hidden).sort((x, y) => x.name.localeCompare(y.name)),
    [areas],
  );
  const [pick, setPick] = useState<string | null>(null);
  const climb = climbs.find((c) => c.id === pick) ?? climbs[0];
  const [board, setBoard] = useState<ClimbBoard | null>(null);
  const [stage, setStage] = useState(0); // the race level: 0 full climb, 1-3 from 1/4, 1/2, 3/4
  const [vehicle, setVehicle] = useState(ALL);
  const [tick, setTick] = useState(0); // reloads the board (after the admin removes an entry)

  useEffect(() => {
    if (!climb) return;
    let live = true;
    setBoard(null);
    fetchClimbBoard(climb.id, stage).then(
      (b) => live && setBoard(b),
      () => live && setBoard({ ready: false, times: [] }),
    );
    return () => {
      live = false;
    };
  }, [climb?.id, stage, tick]);

  useEffect(() => setVehicle(ALL), [climb?.id, stage]);

  const vehicles = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of board?.times ?? []) if (t.vehicle && !seen.has(t.vehicle.toLowerCase())) seen.set(t.vehicle.toLowerCase(), t.vehicle);
    return [...seen.values()].sort((x, y) => x.localeCompare(y));
  }, [board]);

  const rows = useMemo(() => {
    const all = board?.times ?? [];
    const list = vehicle === ALL ? all : all.filter((t) => t.vehicle.toLowerCase() === vehicle.toLowerCase());
    return list.map((t, i) => ({ ...t, pos: i + 1 }));
  }, [board, vehicle]);

  const best = rows[0]?.ms;

  return (
    <div className="vote-page climbs-page">
      <div className="ap-bar">
        <button className="btn sm ap-back" onClick={() => patch({ boardsPage: false })}>
          <Icon d='<path d="m15 6-6 6 6 6"/>' size={14} weight={2.4} />
          Back to map
        </button>
        <span className="grow" />
        <a className="btn sm" href={CONFIG.gpsUrl} target="_blank" rel="noreferrer">
          Get Street GPS
        </a>
      </div>

      <div className="vp-content cb-content">
        <header className="vp-head">
          <div className="grow">
            <h1>Hill Climb leaderboards</h1>
            <p>
              The fastest timed runs to the top, from the base or from 1/4, 1/2 or 3/4 of the way up. To set a time: open
              Street GPS in the sim, go to Climbs, start a timed run, drive to the top, then press Submit time.
            </p>
          </div>
        </header>

        {!loaded && (
          <div className="vp-loading">
            <span className="vp-spin" />
            Loading…
          </div>
        )}
        {loaded && !climb && <div className="vp-closed">No hill climbs are released yet.</div>}

        {climb && (
          <>
            <div className="cb-tabs" role="tablist" aria-label="Hill climbs">
              {climbs.map((c) => (
                <button
                  key={c.id}
                  role="tab"
                  aria-selected={c.id === climb.id}
                  className={"cb-tab" + (c.id === climb.id ? " on" : "")}
                  onClick={() => setPick(c.id)}
                >
                  <Icon d={HILL} size={14} />
                  {c.name}
                </button>
              ))}
            </div>

            <section className="cb-card">
              <div className="cb-card-h">
                <div className="grow">
                  <h2>{climb.name}</h2>
                  <span>
                    {climb.region}
                    {climb.roadKm ? " · " + ((climb.roadKm * (4 - stage)) / 4).toFixed(1) + " km" : ""}
                    {board?.ready ? " · " + board.times.length + (board.times.length === 1 ? " time" : " times") : ""}
                  </span>
                </div>
                {vehicles.length > 1 && (
                  <select className="input cb-vehicle" aria-label="Vehicle" value={vehicle} onChange={(e) => setVehicle(e.target.value)}>
                    <option>{ALL}</option>
                    {vehicles.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                )}
                <button className="btn sm" onClick={() => openDetail(climb.id)}>
                  View on the map
                </button>
              </div>

              <div className="cb-levels" role="tablist" aria-label="Race level">
                {LEVELS.map((name, i) => (
                  <button key={name} role="tab" aria-selected={i === stage} className={"cb-level" + (i === stage ? " on" : "")} onClick={() => setStage(i)}>
                    {name}
                  </button>
                ))}
              </div>

              {!board && (
                <div className="vp-loading">
                  <span className="vp-spin" />
                  Loading times…
                </div>
              )}
              {board && !board.ready && <div className="cb-empty">The leaderboards aren't open yet. Check back soon.</div>}
              {board?.ready && rows.length === 0 && (
                <div className="cb-empty">
                  <b>No times yet at this level.</b> Be the first: drive it with Street GPS and press Submit time.
                </div>
              )}
              {board?.ready && rows.length > 0 && (
                <div className="cb-table" role="table">
                  <div className="cb-row cb-head" role="row">
                    <span className="cb-pos">#</span>
                    <span className="cb-name">Driver</span>
                    <span className="cb-time">Time</span>
                    <span className="cb-gap">Gap</span>
                    <span className="cb-split">1/4</span>
                    <span className="cb-split">1/2</span>
                    <span className="cb-split">3/4</span>
                    <span className="cb-veh">Vehicle</span>
                    <span className="cb-date">Date</span>
                    {admin && <span className="cb-adm" />}
                  </div>
                  {rows.map((t) => (
                    <div key={t.id} className={"cb-row" + (t.pos <= 3 ? " top p" + t.pos : "")} role="row">
                      <span className="cb-pos">{t.pos}</span>
                      <span className="cb-name">{t.name}</span>
                      <span className="cb-time">{fmtRun(t.ms)}</span>
                      <span className="cb-gap">{t.pos === 1 || best == null ? "" : "+" + fmtRun(t.ms - best)}</span>
                      {[0, 1, 2].map((k) => (
                        <span key={k} className="cb-split">
                          {/* a run from 1/2 has only the 3/4 split: it sits in the last column */}
                          {k >= stage && t.splits[k - stage] != null ? fmtRun(t.splits[k - stage]) : ""}
                        </span>
                      ))}
                      <span className="cb-veh">{t.vehicle}</span>
                      <span className="cb-date">{fmtDate(t.date)}</span>
                      {admin && (
                        <span className="cb-adm">
                          <button
                            className="link-btn"
                            title="Remove this time (admin)"
                            onClick={() => {
                              if (!confirm("Remove " + t.name + "'s time of " + fmtRun(t.ms) + "?")) return;
                              adminAction(() => removeClimbTime(t.id), "Time removed").then(() => setTick((n) => n + 1));
                            }}
                          >
                            Remove
                          </button>
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <p className="cb-note">
              A run counts when the whole road is driven from its start point: slew mode, teleporting, a changed simulation rate or a
              skipped part of the road void it. One best time is kept per driver, vehicle and level. Times are for fun and are not verified.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
