import { useEffect, useRef } from "react";
import { ratingOf, setRegionHidden } from "../lib/comments";
import { CONFIG } from "../lib/config";
import { fmtDate, fmtN } from "../lib/format";
import { coverageMi2, coverageShort } from "../lib/geo";
import { CATS, REASONS, STATUS, statusNote } from "../lib/icons";
import { useStore } from "../lib/store";
import type { Area, CommentType } from "../lib/types";
import { AdminMenu } from "./AdminMenu";
import { Comment, Compose, Coords, LinesToggle, NotesEditor, RequestNote, STAR } from "./DetailPanel";
import { Icon } from "./Icon";
import { formatNotes } from "./LinkedText";
import { Photos } from "./Photos";
import { PoiList } from "./Pois";

// "More info": the open area as a full page over the map area. The map itself stays (as a large
// pane beside the page), so everything that uses it still works: show a place, pick a spot, draw a route.
export function AreaPage() {
  const a = useStore((s) => s.areas.find((x) => x.id === s.selectedId));
  if (!a) return null;
  return <Page key={a.id} area={a} />;
}

// The hero: the cover and the next two photos; any of them opens the full-screen viewer
function Hero({ area: a }: { area: Area }) {
  const patch = useStore((s) => s.patch);
  const photos = (a.photos ?? []).filter((p) => p.approved);
  if (!photos.length) return null;
  const open = (index: number) => patch({ gallery: { areaId: a.id, index, pending: false } });
  const shown = photos.slice(0, 3);
  return (
    <div className={"ap-hero n" + shown.length}>
      {shown.map((p, i) => (
        <button key={p.id} className="ap-shot" title={`Photo by ${p.author}`} onClick={() => open(i)}>
          <img src={p.url} alt={`Photo by ${p.author}`} loading={i ? "lazy" : undefined} />
        </button>
      ))}
      {photos.length > 1 && (
        <button className="ap-all" onClick={() => open(0)}>
          <Icon name="img" size={13} weight={2.2} />
          All {photos.length} photos
        </button>
      )}
    </div>
  );
}

function Page({ area: a }: { area: Area }) {
  const admin = useStore((s) => s.admin);
  const patch = useStore((s) => s.patch);
  const setComment = useStore((s) => s.setComment);
  const toggleVote = useStore((s) => s.toggleVote);
  const adminAction = useStore((s) => s.adminAction);
  const packKm = useStore((s) => s.lineIndex?.[a.id]);
  const scroller = useRef<HTMLDivElement>(null);

  // The map pane is a different size from the full map: frame the area in it once it has resized,
  // and again in the full map on the way back
  useEffect(() => {
    const frame = () => {
      const s = useStore.getState();
      const area = s.areas.find((x) => x.id === a.id);
      if (area && s.selectedId === a.id) s.zoomTo(area);
    };
    const t = setTimeout(frame, 80);
    return () => {
      clearTimeout(t);
      setTimeout(frame, 80);
    };
  }, [a.id]);

  const status = STATUS[a.status];
  const reason = REASONS[a.reason ?? "tried"];
  const released = a.status === "released" && CONFIG.database;
  const voted = CONFIG.votes && a.voted;
  const rating = ratingOf(a.comments);
  const roadKm = a.roadKm ?? packKm ?? null;
  const pois = (a.pois ?? []).filter((p) => p.approved);
  const places = pois.filter((p) => p.kind === "place");
  const routes = pois.filter((p) => p.kind === "route");
  const cats = new Set(places.map((p) => p.category || "Place")).size;
  const photos = (a.photos ?? []).filter((p) => p.approved).length;
  // Places and routes go public when the area is released; until then only the admin sees them
  const showPois = a.status === "released" || admin;
  const feedbackN = a.comments.length + (a.requestNotes ? 1 : 0);

  const go = (id: string) => scroller.current?.querySelector("#" + id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const top = () => scroller.current?.scrollTo({ top: 0, behavior: "smooth" });
  // Opens the comment box set to a type, and brings it into view
  const openAs = (type: CommentType) => {
    const { myReviews, comment, composeNonce } = useStore.getState();
    const mine = a.comments.find((c) => c.type === "review" && myReviews.has(c.id));
    if (type === "review" && mine && comment.type !== "review") setComment({ type, rating: mine.rating ?? 0, text: mine.text, replyTo: null });
    else setComment(type === "review" ? { type, replyTo: null } : { type });
    patch({ composeNonce: composeNonce + 1 });
  };

  const nav: [string, string, number | null, boolean][] = [
    ["ap-places", "Places", places.length, showPois],
    ["ap-routes", "Routes", routes.length, showPois],
    ["ap-photos", "Photos", photos, CONFIG.photos && (photos > 0 || admin)],
    ["ap-feedback", "Feedback", feedbackN, !!CONFIG.database],
  ];

  return (
    <>
      <div className="area-page" ref={scroller}>
        <div className="ap-bar">
          <button className="btn sm ap-back" onClick={() => patch({ full: false })}>
            <Icon d='<path d="m15 6-6 6 6 6"/>' size={14} weight={2.4} />
            Back to map
          </button>
          <nav className="ap-nav" aria-label="Sections">
            <button onClick={top}>Overview</button>
            {nav
              .filter((n) => n[3])
              .map(([id, label, n]) => (
                <button key={id} onClick={() => go(id)}>
                  {label} <span>{n}</span>
                </button>
              ))}
          </nav>
          {admin && <AdminMenu area={a} />}
        </div>

        <div className="ap-content">
          {admin && a.hidden && (
            <div className="hid-banner">
              <Icon name="eyeOff" size={18} weight={2.2} />
              <div className="grow">
                <b>Hidden from visitors</b>
                <span>Only you can see this area while you're signed in.</span>
              </div>
              <button className="btn sm" onClick={() => adminAction(() => setRegionHidden(a.id, false), "Shown on the site")}>
                <Icon name="eye" size={14} />
                Show on site
              </button>
            </div>
          )}

          <div id="ap-photos">{CONFIG.photos && <Hero area={a} />}</div>

          <header className="ap-head">
            <div className="grow">
              <div className="eyebrow">
                <span className={"badge s-" + a.status}>{status.label}</span>
                {a.status === "unable" && (
                  <span className="badge" style={{ background: reason.tint, color: reason.ink }}>
                    {reason.label}
                  </span>
                )}
                <span className="badge cat-b">{CATS[a.cat].label}</span>
                {a.hidden && <span className="badge cat-b">Hidden</span>}
              </div>
              <h1>{a.name}</h1>
              <div className="sub">
                {[a.region, a.icao, (a.status === "released" ? "Added " : `Requested by ${a.by} · `) + fmtDate(a.date)]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            {CONFIG.database && (
              <div className="ap-actions">
                {CONFIG.votes && !released && (
                  <button
                    className={"btn sm" + (voted ? " voted" : "")}
                    aria-pressed={!!voted}
                    title={voted ? "Remove your upvote" : "Upvote this area"}
                    onClick={() => toggleVote(a.id)}
                  >
                    <Icon name="up" size={14} weight={2.2} />
                    {fmtN(a.votes)}
                  </button>
                )}
                <button className="btn sm report-btn" onClick={() => openAs("issue")}>
                  <Icon name="alert" size={14} />
                  Report issue
                </button>
                <button className="btn sm improve-btn" onClick={() => openAs("improve")}>
                  <Icon d='<path d="M4 21 9 3M20 21 15 3M12 5v2.5M12 10.5V13M12 16v3"/>' size={14} weight={2.2} />
                  Request improvement
                </button>
              </div>
            )}
          </header>

          <div className="ap-stats">
            {roadKm != null && (
              <div className="stat">
                <div className="k">Roads smoothed</div>
                <div className="v">{Math.round(roadKm * 0.621371).toLocaleString()} mi</div>
                <span className="v2">{Math.round(roadKm).toLocaleString()} km</span>
              </div>
            )}
            <div className="stat">
              <div className="k">Outline area</div>
              <div className="v">{coverageMi2(a.shape)}</div>
              <span className="v2">{coverageShort(a.shape)}</span>
            </div>
            {showPois && (
              <button className="stat ap-stat-btn" onClick={() => go("ap-places")}>
                <div className="k">Places</div>
                <div className="v">{places.length}</div>
                <span className="v2">
                  {places.length ? `Across ${cats} categor${cats === 1 ? "y" : "ies"}` : "None yet"}
                </span>
              </button>
            )}
            {released ? (
              <button className="stat rate-stat" title="Rate this area" onClick={() => openAs("review")}>
                <div className="k">Rating</div>
                <div className="v">
                  {rating.count ? (
                    <>
                      <Icon d={STAR} size={16} weight={2} />
                      {rating.avg.toFixed(1)}
                    </>
                  ) : (
                    <span className="rate-none">No ratings</span>
                  )}
                </div>
                <span className="v2">{rating.count ? `${rating.count} review${rating.count === 1 ? "" : "s"}` : "Be the first"}</span>
              </button>
            ) : (
              CONFIG.votes && (
                <button
                  className={"stat vote-stat" + (voted ? " on" : "")}
                  aria-pressed={!!voted}
                  title={voted ? "Remove your upvote" : "Upvote this area"}
                  onClick={() => toggleVote(a.id)}
                >
                  <div className="k">Votes</div>
                  <div className="v">
                    <Icon name="up" size={16} weight={2.2} />
                    {fmtN(a.votes)}
                  </div>
                  <span className="v2">{voted ? "Upvoted" : "Click to upvote"}</span>
                </button>
              )
            )}
          </div>

          {statusNote(a) && (
            <div
              className="status-note"
              style={{
                background: "noteTint" in reason ? reason.noteTint : reason.tint,
                color: "noteInk" in reason ? reason.noteInk : reason.ink,
              }}
            >
              {statusNote(a)}
            </div>
          )}

          {/* Narrow screens: the switch sits here, under the map strip */}
          <div className="ap-lines-inline">
            <LinesToggle area={a} />
          </div>

          {admin ? (
            <section className="ap-card">
              <NotesEditor area={a} />
            </section>
          ) : (
            a.notes && (
              <section className="ap-card">
                <h2 className="ap-t">Notes</h2>
                <div className="notes">{a.notesAdmin ? formatNotes(a.notes) : a.notes}</div>
              </section>
            )
          )}

          {showPois && CONFIG.database && (
            <section className="ap-card" id="ap-places">
              <h2 className="ap-t">
                Places <span>{places.length}</span>
              </h2>
              <PoiList area={a} kind="place" wide />
            </section>
          )}
          {showPois && CONFIG.database && (
            <section className="ap-card" id="ap-routes">
              <h2 className="ap-t">
                Routes <span>{routes.length}</span>
              </h2>
              <PoiList area={a} kind="route" wide />
            </section>
          )}

          {/* The admin's photo tools: reorder, approve, add */}
          {admin && CONFIG.photos && (
            <section className="ap-card">
              <h2 className="ap-t">
                Manage photos <span>{photos}</span>
              </h2>
              <Photos area={a} bare />
            </section>
          )}

          {a.status !== "released" && (
            <section className="ap-card">
              <h2 className="ap-t">Coordinates</h2>
              <Coords area={a} />
            </section>
          )}

          {CONFIG.database && (
            <section className="ap-card ap-feedback" id="ap-feedback">
              <h2 className="ap-t">
                Feedback <span>{feedbackN}</span>
              </h2>
              {feedbackN === 0 ? (
                <div className="empty empty-box">No feedback yet. Be the first.</div>
              ) : (
                <div className="cmts">
                  {a.requestNotes && <RequestNote area={a} />}
                  {a.comments.map((c) => (
                    <Comment key={c.id} comment={c} parent={a.comments.find((p) => p.id === c.replyTo)} />
                  ))}
                </div>
              )}
              <Compose />
            </section>
          )}
        </div>
      </div>

      {/* Wide screens: the switch under the map pane */}
      <div className="ap-map-foot">
        <LinesToggle area={a} />
      </div>
    </>
  );
}
