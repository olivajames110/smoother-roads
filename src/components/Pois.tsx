import { CONFIG } from "../lib/config";
import { useEffect, useRef, useState } from "react";
import { approvePoi, deletePoi, MAX_POINTS, pointLabel, routePoints, TIMES, timeLabel } from "../lib/pois";
import { POI_TIP_KEY, useStore } from "../lib/store";
import type { Area, AreaPoi, LatLng } from "../lib/types";
import { Icon } from "./Icon";

export const STAR = '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>';
export const ROUTE = '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>';

const ll = (p: LatLng) => `${p[0].toFixed(5)}, ${p[1].toFixed(5)}`;

function km(a: LatLng, b: LatLng) {
  const kx = 111.32 * Math.cos((a[0] * Math.PI) / 180);
  return Math.hypot((a[1] - b[1]) * kx, (a[0] - b[0]) * 111.32);
}

// Straight lines from point to point, in miles (the drive itself is longer)
const miles = (pts: LatLng[]) => pts.slice(1).reduce((t, p, i) => t + km(pts[i], p), 0) * 0.621371;

// Each kind of place: its colour and icon (anything else: grey star)
const PATHS = {
  stadium: '<ellipse cx="12" cy="9" rx="8" ry="3.5"/><path d="M4 9v6c0 1.9 3.6 3.5 8 3.5s8-1.6 8-3.5V9"/>',
  zoo: '<circle cx="7" cy="9" r="1.8"/><circle cx="17" cy="9" r="1.8"/><circle cx="10" cy="5.5" r="1.8"/><circle cx="14" cy="5.5" r="1.8"/><path d="M12 12c-3 0-5 3.5-5 5.5S9 20 12 20s5-.5 5-2.5S15 12 12 12z"/>',
  beach: '<path d="M3 18c2 0 2-1.5 4.5-1.5S9.5 18 12 18s2.5-1.5 4.5-1.5S19 18 21 18"/><path d="M12 15V4M5 8a7 7 0 0 1 14 0z"/>',
  museum: '<path d="M3 9h18L12 4zM5 9v8M9.5 9v8M14.5 9v8M19 9v8M3 20h18"/>',
  park: '<path d="M12 21v-5M12 3l6 9H6z"/><path d="M8 12l-3 4h14l-3-4"/>',
  plane: '<path d="M10.5 3.5v6L3 14v2l7.5-2.5V18L8 20v1.5l4-1 4 1V20l-2.5-2v-4.5L21 16v-2l-7.5-4.5v-6a1.5 1.5 0 0 0-3 0z"/>',
  light: '<path d="M9 21l1-12h4l1 12zM10 9V6h4v3M12 3v1M7 6H5M19 6h-2M8 21h8"/>',
  castle: '<path d="M4 21V8h3v2h3V8h4v2h3V8h3v13zM10 21v-5h4v5"/>',
  bridge: '<path d="M2 16h20M4 16V9M20 16V9M4 9c4 5 12 5 16 0M8 12v4M12 13v3M16 12v4"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  bag: '<path d="M5 8h14l-1 13H6zM9 8V6a3 3 0 0 1 6 0v2"/>',
  star: STAR,
};
const STYLES: Record<string, [string, keyof typeof PATHS]> = {
  stadium: ["#2563eb", "stadium"],
  attraction: ["#7c3aed", "star"],
  "theme park": ["#7c3aed", "star"],
  zoo: ["#ea580c", "zoo"],
  aquarium: ["#0891b2", "zoo"],
  beach: ["#0d9488", "beach"],
  museum: ["#b45309", "museum"],
  gallery: ["#b45309", "museum"],
  park: ["#16a34a", "park"],
  airport: ["#0284c7", "plane"],
  lighthouse: ["#dc2626", "light"],
  castle: ["#9333ea", "castle"],
  fort: ["#9333ea", "castle"],
  monument: ["#64748b", "castle"],
  memorial: ["#64748b", "castle"],
  bridge: ["#0f766e", "bridge"],
  viewpoint: ["#0d9488", "eye"],
  shopping: ["#c026d3", "bag"],
};
// a route's group is its best time
const TIME_COLORS: Record<string, string> = {
  Sunrise: "#f59e0b",
  Noon: "#eab308",
  "Golden hour": "#d97706",
  Sunset: "#ea580c",
  Night: "#4f46e5",
  "Any time": "#64748b",
};
const groupOf = (p: AreaPoi) => (p.kind === "route" ? timeLabel(p.time) || "Any time" : p.category || "Place");
const colorOf = (p: AreaPoi) =>
  p.kind === "route" ? TIME_COLORS[groupOf(p)] ?? "#7c3aed" : STYLES[groupOf(p).toLowerCase()]?.[0] ?? "#64748b";
const iconOf = (p: AreaPoi) => (p.kind === "route" ? ROUTE : PATHS[STYLES[groupOf(p).toLowerCase()]?.[1] ?? "star"]);
const plural = (w: string) =>
  w === "Any time" || w === "Golden hour" || w === "Noon" || w === "Night" || w.endsWith("s")
    ? w
    : /(ch|sh|x)$/.test(w)
      ? w + "es"
      : /[^aeiou]y$/.test(w)
        ? w.slice(0, -1) + "ies"
        : w + "s";


export function Row({ poi: p }: { poi: AreaPoi }) {
  const focus = useStore((s) => s.poiFocus);
  const admin = useStore((s) => s.admin);
  const patch = useStore((s) => s.patch);
  const adminAction = useStore((s) => s.adminAction);
  const flyToPoint = useStore((s) => s.flyToPoint);
  const flyToBounds = useStore((s) => s.flyToBounds);
  const showToast = useStore((s) => s.showToast);
  const route = p.kind === "route" && p.end;

  const show = () => {
    patch({ poiFocus: p.id });
    if (route) flyToBounds(routePoints(p));
    else flyToPoint(p.start, 17);
  };
  const stop = (e: React.MouseEvent) => e.stopPropagation();
  const copy = (e: React.MouseEvent) => {
    stop(e);
    navigator.clipboard.writeText(ll(p.start)).then(
      () => showToast(route ? "Start copied" : "Coordinates copied"),
      () => showToast("Couldn't copy", true),
    );
  };
  // picked: the facts on one line and the whole description under them; otherwise one short line
  const open = focus === p.id && !!p.note;
  const meta = (route
    ? [
        `${miles(routePoints(p)).toFixed(1)} mi`,
        p.via.length ? `${p.via.length} stop${p.via.length === 1 ? "" : "s"}` : "",
        p.time ? `Best at ${timeLabel(p.time).toLowerCase()}` : "",
        open ? "" : p.note,
      ]
    : [p.category, open ? "" : p.note]
  )
    .filter(Boolean)
    .join(" · ");
  // the row's buttons show on hover (and on the one picked), so the list reads cleanly

  return (
    <div
      role="button"
      tabIndex={0}
      className={"poi" + (focus === p.id ? " on" : "") + (p.approved ? "" : " waiting")}
      onClick={show}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), show())}
      title={focus === p.id ? "Show on the map" : p.note ? "Show on the map and read the description" : "Show on the map"}
    >
      <span className="poi-ico" style={{ color: colorOf(p), background: colorOf(p) + "1a" }}>
        <Icon d={iconOf(p)} size={15} weight={2} />
      </span>
      <span className="poi-text">
        <span className="poi-name">
          {p.name}
          {!p.approved && <span className="tag t-waiting">Waiting</span>}
        </span>
        <span className="poi-meta">{meta || (p.approved ? "" : `Suggested by ${p.author}`)}</span>
        {open && <span className="poi-note">{p.note}</span>}
      </span>
      {admin && !p.approved && (
        <button
          className="ibtn poi-ok"
          title="Approve: show it to everyone"
          onClick={(e) => (stop(e), adminAction(() => approvePoi(p.id), "Approved"))}
        >
          <Icon name="check" size={15} weight={2.6} />
        </button>
      )}
      {admin && (
        <button
          className="ibtn poi-edit"
          title="Edit"
          onClick={(e) => {
            stop(e);
            patch({
              poiFocus: p.id,
              poiPick: false,
              pinMode: false,
              poiDraft: { id: p.id, kind: p.kind, name: p.name, note: p.note, points: routePoints(p), time: p.time },
            });
            if (route) flyToBounds(routePoints(p));
            else flyToPoint(p.start, 17);
          }}
        >
          <Icon d='<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>' size={14} />
        </button>
      )}
      {admin && (
        <button
          className="ibtn poi-del"
          title="Delete"
          onClick={(e) => {
            stop(e);
            if (window.confirm(`Delete "${p.name}"?`)) adminAction(() => deletePoi(p.id), "Deleted");
          }}
        >
          <Icon name="trash" size={14} />
        </button>
      )}
      <button className="ibtn poi-copy" title={route ? "Copy the start as lat, lon" : "Copy as lat, lon"} onClick={copy}>
        <Icon name="copy" size={14} />
      </button>
    </div>
  );
}

// The form for suggesting a place (one point) or a route (start, any number of stops, finish),
// all picked on the map
function Suggest({ kind }: { kind: "place" | "route" }) {
  const d = useStore((s) => s.poiDraft);
  const pick = useStore((s) => s.poiPick);
  const posting = useStore((s) => s.posting);
  const commenter = useStore((s) => s.commenter);
  const admin = useStore((s) => s.admin);
  const patch = useStore((s) => s.patch);
  const submitPoi = useStore((s) => s.submitPoi);
  const word = kind === "place" ? "place" : "route";

  if (!d || d.kind !== kind) return null;

  const set = (p: Partial<typeof d>) => patch({ poiDraft: { ...d, ...p } });
  const n = d.points.length;
  const ready = d.name.trim() && n >= (kind === "route" ? 2 : 1);
  const title = d.id ? `Edit ${word}` : admin ? `Add a ${word}` : `Suggest a ${word}`;
  const remove = (i: number) => set({ points: d.points.filter((_, j) => j !== i) });

  return (
    <div className="poi-form">
      <div className="poi-form-t">{title}</div>
      <input
        className="input"
        placeholder={kind === "place" ? "Name, e.g. Sunset Cliffs lookout" : "Name, e.g. Coronado beach loop"}
        maxLength={80}
        value={d.name}
        autoFocus
        onChange={(e) => set({ name: e.target.value })}
      />

      {kind === "place" ? (
        <div className="poi-points">
          <button className={"loc-btn" + (pick ? " picking" : n ? " set" : "")} onClick={() => patch({ poiPick: !pick })}>
            {pick ? <span className="loc-dot" /> : <Icon name="pin" size={15} />}
            {pick ? "Click the map…" : n ? `Location: ${ll(d.points[0])}` : "Set the location on the map"}
          </button>
        </div>
      ) : (
        <div className="stops">
          {d.points.map((p, i) => (
            <div key={i} className="stop">
              <span className="stop-pin">{pointLabel(i, n)}</span>
              <span className="stop-t">
                {i === 0 ? "Start" : i === n - 1 && n > 1 ? "Finish" : `Stop ${i}`}
                <span>{ll(p)}</span>
              </span>
              <button className="ibtn stop-x" title="Remove this point" onClick={() => remove(i)}>
                <Icon d='<path d="M18 6 6 18M6 6l12 12"/>' size={13} weight={2.4} />
              </button>
            </div>
          ))}
          <div className="stops-btns">
            <button
              className={"loc-btn" + (pick ? " picking" : "")}
              disabled={!pick && n >= MAX_POINTS}
              onClick={() => patch({ poiPick: !pick })}
            >
              {pick ? <span className="loc-dot" /> : <Icon name="pin" size={15} />}
              {pick
                ? n === 0
                  ? "Click the map to set the start…"
                  : "Adding points… click to stop"
                : n === 0
                  ? "Set the start on the map"
                  : "Add more points"}
            </button>
          </div>
          <p className="stops-hint">
            Click along the drive in order; the last point is the finish. Drag a pin on the map to move it.
          </p>
          <div className="time-pick">
            <span className="time-pick-t">Best time</span>
            <div className="chips">
              {([[null, "Any"], ...TIMES] as const).map(([k, label]) => (
                <button
                  key={label}
                  type="button"
                  className={"chip" + ((d.time ?? null) === k ? " on" : "")}
                  onClick={() => set({ time: k })}
                >
                  {label}
                </button>
              ))}
            </div>
            <span className="stops-hint">Street GPS sets the sim's clock to it when you start the route.</span>
          </div>
        </div>
      )}

      <textarea
        placeholder={kind === "place" ? "Why go there? (optional)" : "What's the drive like? (optional)"}
        maxLength={500}
        value={d.note}
        onChange={(e) => set({ note: e.target.value })}
      />
      {!admin && !d.id && (
        <input
          className="input"
          placeholder="Your name (optional)"
          maxLength={40}
          value={commenter}
          onChange={(e) => patch({ commenter: e.target.value })}
        />
      )}
      <div className="poi-form-btns">
        {!admin && <span className="hint">It shows once it's approved.</span>}
        <button className="btn sm" disabled={posting} onClick={() => patch({ poiDraft: null, poiPick: false })}>
          Cancel
        </button>
        <button className="btn sm fun" disabled={!ready || posting} onClick={submitPoi}>
          {posting ? (d.id ? "Saving…" : "Sending…") : d.id ? "Save" : admin ? "Add" : "Send"}
        </button>
      </div>
    </div>
  );
}


// Places or routes in an area: search, filter by kind (or a route's best time), click one to see it
// on the map; anyone can suggest more (the admin adds and edits)
export function PoiList({ area: a, kind, preview }: { area: Area; kind: "place" | "route"; preview?: boolean }) {
  const admin = useStore((s) => s.admin) && !preview;
  const draft = useStore((s) => s.poiDraft);
  const patch = useStore((s) => s.patch);
  const [all, setAll] = useState(false);
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const tipOff = useStore((s) => s.poiTipOff);
  const hideTipKey = useStore((s) => s.hideTip);
  // the chip row scrolls sideways: faded edges where more chips are hidden
  const chips = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ l: false, r: false });
  const measure = () => {
    const el = chips.current;
    if (!el) return;
    const l = el.scrollLeft > 2;
    const r = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    setEdges((e) => (e.l === l && e.r === r ? e : { l, r }));
  };
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });
  // click, hold and drag the row sideways; a drag isn't a click on the chip under the mouse
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);
  const dragStart = (e: React.MouseEvent) => {
    if (e.button !== 0 || !chips.current) return;
    drag.current = { x: e.clientX, left: chips.current.scrollLeft, moved: false };
    const move = (ev: MouseEvent) => {
      const d = drag.current;
      if (!d || !chips.current) return;
      if (Math.abs(ev.clientX - d.x) > 4) d.moved = true;
      if (d.moved) chips.current.scrollLeft = d.left - (ev.clientX - d.x);
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
      setTimeout(() => (drag.current = null), 0);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };
  const swallowDragClick = (e: React.MouseEvent) => {
    if (drag.current?.moved) {
      e.stopPropagation();
      e.preventDefault();
    }
  };
  const nudge = (dir: number) =>
    chips.current?.scrollBy({ left: dir * chips.current.clientWidth * 0.7, behavior: "smooth" });
  // a picked chip slides to the middle, so the ones beyond it show
  const pickGroup = (g: string | null, el: HTMLElement) => {
    setGroup(g);
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  };
  const word = kind === "place" ? "places" : "routes";

  const items = (a.pois ?? []).filter((p) => p.kind === kind);
  const shown = items.filter((p) => p.approved);
  const waiting = admin ? items.filter((p) => !p.approved) : [];
  // groups, biggest first, for the filter chips
  const counts = new Map<string, number>();
  for (const p of shown) counts.set(groupOf(p), (counts.get(groupOf(p)) ?? 0) + 1);
  const groups = [...counts].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  const needle = q.trim().toLowerCase();
  const matches = shown.filter(
    (p) =>
      (!group || groupOf(p) === group) &&
      (!needle || p.name.toLowerCase().includes(needle) || groupOf(p).toLowerCase().includes(needle)),
  );
  const SHORT = 5; // the rest behind "Show more", so the panel stays short
  const list = all || needle ? matches : matches.slice(0, SHORT);
  const more = matches.length - list.length;
  const adding = !!draft && draft.kind === kind;

  const add = () =>
    patch({ poiDraft: { kind, name: "", note: "", points: [] }, poiPick: true, pinMode: false, poiFocus: null });
  const hideTip = () => hideTipKey(POI_TIP_KEY);

  return (
    <>
      {(!tipOff || preview) && (
        <div className="poi-tip">
          <Icon name="alert" size={14} />
          <span>
            The {word} below are available in{" "}
            {CONFIG.gpsUrl ? (
              <a href={CONFIG.gpsUrl} target="_blank" rel="noopener">
                Street GPS
              </a>
            ) : (
              "Street GPS"
            )}
            {kind === "place" ? ": drive or teleport to any of them." : ": press Start to drive one."}
          </span>
          <button className="poi-tip-x" title="Hide" onClick={hideTip}>
            <Icon d='<path d="M18 6 6 18M6 6l12 12"/>' size={13} weight={2.4} />
          </button>
        </div>
      )}

      <div className="poi-bar">
        <div className="search poi-search">
          <Icon name="search" size={15} />
          <input
            className="input"
            placeholder={`Search ${word}`}
            aria-label={`Search ${word}`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button className="poi-add" disabled={adding} onClick={add} title={admin ? `Add a ${kind}` : `Suggest a ${kind}`}>
          <Icon d='<path d="M12 5v14M5 12h14"/>' size={14} weight={2.6} />
          {admin ? "Add" : "Suggest"}
        </button>
      </div>

      {groups.length > 1 && (
        <div className="poi-chips-wrap">
        <div
          ref={chips}
          className={"poi-chips" + (edges.l ? " fade-l" : "") + (edges.r ? " fade-r" : "")}
          onScroll={measure}
          onMouseDown={dragStart}
          onClickCapture={swallowDragClick}
        >
          <button className={"poi-chip" + (group ? "" : " on")} onClick={(e) => pickGroup(null, e.currentTarget)}>
            All <span>{shown.length}</span>
          </button>
          {groups.map(([g, n]) => (
            <button key={g} className={"poi-chip" + (group === g ? " on" : "")} onClick={(e) => pickGroup(group === g ? null : g, e.currentTarget)}>
              <i style={{ background: kind === "route" ? TIME_COLORS[g] ?? "#7c3aed" : STYLES[g.toLowerCase()]?.[0] ?? "#64748b" }} />
              {n > 1 ? plural(g) : g} <span>{n}</span>
            </button>
          ))}
        </div>
          {edges.l && (
            <div className="poi-chips-edge l">
              <button className="poi-chips-arrow" aria-label="Scroll left" onClick={() => nudge(-1)}>
                <Icon d='<path d="m15 6-6 6 6 6"/>' size={14} weight={2.4} />
              </button>
            </div>
          )}
          {edges.r && (
            <div className="poi-chips-edge r">
              <button className="poi-chips-arrow" aria-label="Scroll right" onClick={() => nudge(1)}>
                <Icon d='<path d="m9 6 6 6-6 6"/>' size={14} weight={2.4} />
              </button>
            </div>
          )}
        </div>
      )}

      <Suggest kind={kind} />

      {shown.length === 0 ? (
        !adding && (
          <div className="empty empty-box">
            {kind === "place" ? "No places here yet. Know a good spot? Suggest it." : "No routes here yet. Know a good drive? Suggest it."}
          </div>
        )
      ) : matches.length === 0 ? (
        <div className="empty empty-box">No {word} match.</div>
      ) : (
        <div className="pois">
          {list.map((p) => (
            <Row key={p.id} poi={p} />
          ))}
          {(more > 0 || (all && matches.length > SHORT && !needle)) && (
            <button className="poi-more" onClick={() => setAll(!all)}>
              {all ? "Show fewer" : `Show ${more} more`}
              <Icon d={all ? '<path d="m6 15 6-6 6 6"/>' : '<path d="m6 9 6 6 6-6"/>'} size={14} weight={2.2} />
            </button>
          )}
        </div>
      )}

      {waiting.length > 0 && (
        <>
          <div className="photos-wait">
            <Icon name="alert" size={14} weight={2.2} />
            Waiting for approval <span>{waiting.length}</span>
          </div>
          <div className="pois">
            {waiting.map((p) => (
              <Row key={p.id} poi={p} />
            ))}
          </div>
        </>
      )}

    </>
  );
}
