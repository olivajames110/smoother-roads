import { circleKm2, polygonKm2, centerOf, shapeFromDraft } from "../lib/geo";
import { CATS } from "../lib/icons";
import { coveredBy, useStore } from "../lib/store";
import type { Cat } from "../lib/types";
import { Icon } from "./Icon";

const RADIUS_MIN = 500;
const RADIUS_MAX = 15000;

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <div className={"step" + (done ? " done" : "")}>
      <span className="num">{done ? <Icon name="check" size={12} weight={3} /> : 1}</span>
      {children}
    </div>
  );
}

function CoverageBox() {
  const draft = useStore((s) => s.draft);
  const setRadius = useStore((s) => s.setRadius);
  const undoPoint = useStore((s) => s.undoPoint);
  const clearDraft = useStore((s) => s.clearDraft);
  const finishPolygon = useStore((s) => s.finishPolygon);
  const admin = useStore((s) => s.admin);
  const showToast = useStore((s) => s.showToast);
  const n = draft.points.length;

  // Admin: the outline as [[lat, lon], ...], ready to paste into a build
  const copyPoints = () =>
    navigator.clipboard
      .writeText(JSON.stringify(draft.points.map(([la, lo]) => [+la.toFixed(6), +lo.toFixed(6)])))
      .then(
        () => showToast(`${n} points copied`),
        () => showToast("Couldn't copy the points", true),
      );

  if (draft.type === "radius") {
    return (
      <div className="draw-box">
        <Step done={!!draft.center}>
          {draft.center ? "Center placed. Click the map to move it." : "Click the map to place the center"}
        </Step>
        <div className="range-row">
          <input
            type="range"
            min={RADIUS_MIN}
            max={RADIUS_MAX}
            step={100}
            value={draft.radius}
            aria-label="Radius"
            onChange={(e) => setRadius(Number(e.target.value))}
          />
          <span className="range-val">{(draft.radius / 1000).toFixed(1)} km</span>
        </div>
        <div className="draw-meta">About {circleKm2(draft.radius).toFixed(1)} km²</div>
      </div>
    );
  }

  return (
    <div className="draw-box">
      <Step done={draft.closed}>
        {draft.closed ? "Perimeter closed" : "Click the map to add at least 3 points"}
      </Step>
      <div className="draw-tools">
        <button className="btn sm" disabled={!n} onClick={undoPoint}>
          <Icon name="undo" size={14} />
          Undo
        </button>
        <button className="btn sm" disabled={!n} onClick={clearDraft}>
          <Icon name="trash" size={14} />
          Clear
        </button>
        <button className="btn sm" disabled={n < 3 || draft.closed} onClick={finishPolygon}>
          <Icon name="check" size={14} />
          Finish
        </button>
      </div>
      <div className="draw-meta">
        {n} {n === 1 ? "point" : "points"}
        {n >= 3 && ` · ${polygonKm2(draft.points).toFixed(1)} km²`}
      </div>
      {admin && n >= 3 && (
        <button className="btn sm copy-pts" onClick={copyPoints}>
          <Icon name="copy" size={14} />
          Copy points
        </button>
      )}
    </div>
  );
}

export function SubmitPanel() {
  const areas = useStore((s) => s.areas);
  const draft = useStore((s) => s.draft);
  const form = useStore((s) => s.form);
  const placeQuery = useStore((s) => s.placeQuery);
  const placeNote = useStore((s) => s.placeNote);
  const patch = useStore((s) => s.patch);
  const setForm = useStore((s) => s.setForm);
  const setDrawType = useStore((s) => s.setDrawType);
  const findPlace = useStore((s) => s.findPlace);
  const locate = useStore((s) => s.locate);
  const closePanel = useStore((s) => s.closePanel);
  const submitArea = useStore((s) => s.submitArea);
  const posting = useStore((s) => s.posting);

  const shape = shapeFromDraft(draft);
  const covered = shape && coveredBy(areas, centerOf(shape));

  return (
    <>
      <div className="panel-head">
        <div className="tile tile-accent">
          <Icon name="pin" size={22} />
        </div>
        <div className="grow">
          <h2>Request an area</h2>
          <div className="sub">Mark the roads you want smoothed next.</div>
        </div>
        <button className="ibtn" title="Close" onClick={closePanel}>
          <Icon name="x" size={18} />
        </button>
      </div>

      <div className="panel-body">
        <div className="field">
          <label className="lbl" htmlFor="place">Find a place</label>
          <form
            className="search-row"
            onSubmit={(e) => {
              e.preventDefault();
              findPlace();
            }}
          >
            <input
              id="place"
              className="input"
              placeholder="City, address or airport"
              autoComplete="off"
              value={placeQuery}
              onChange={(e) => patch({ placeQuery: e.target.value })}
            />
            <button className="btn" type="submit">Find</button>
            <button className="btn" type="button" title="Use my location" aria-label="Use my location" onClick={locate}>
              <Icon name="target" size={16} />
            </button>
          </form>
          {placeNote && <div className="draw-meta">{placeNote}</div>}
        </div>

        <div className="field">
          <label className="lbl">Coverage</label>
          <div className="seg full">
            <button className={draft.type === "radius" ? "on" : ""} onClick={() => setDrawType("radius")}>
              Radius
            </button>
            <button className={draft.type === "polygon" ? "on" : ""} onClick={() => setDrawType("polygon")}>
              Draw perimeter
            </button>
          </div>
          <CoverageBox />
          {covered && <div className="draw-meta">Already covered by {covered.name}.</div>}
        </div>

        <div className="field">
          <label className="lbl">Category</label>
          <div className="cat-grid">
            {(Object.keys(CATS) as Cat[]).map((c) => (
              <button key={c} className={"cat-opt" + (form.cat === c ? " on" : "")} onClick={() => setForm({ cat: c })}>
                <Icon d={CATS[c].icon} size={18} />
                {CATS[c].label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label className="lbl" htmlFor="area-name">Area name</label>
          <input
            id="area-name"
            className="input"
            placeholder="e.g. Downtown Seattle"
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
          />
        </div>

        <div className="field row2">
          <div>
            <label className="lbl" htmlFor="area-region">Region / country</label>
            <input
              id="area-region"
              className="input"
              placeholder="Washington, United States"
              value={form.region}
              onChange={(e) => setForm({ region: e.target.value })}
            />
          </div>
          <div>
            <label className="lbl" htmlFor="area-icao">Airport</label>
            <input
              id="area-icao"
              className="input"
              placeholder="Optional"
              maxLength={4}
              value={form.icao}
              onChange={(e) => setForm({ icao: e.target.value.toUpperCase() })}
            />
          </div>
        </div>

        <div className="field">
          <label className="lbl" htmlFor="area-notes">Notes <span className="opt">(optional)</span></label>
          <textarea
            id="area-notes"
            placeholder="Which roads matter most?"
            value={form.notes}
            onChange={(e) => setForm({ notes: e.target.value })}
          />
        </div>
      </div>

      <div className="panel-foot">
        <button className="btn ghost" onClick={closePanel}>Cancel</button>
        <button className="btn cyan" disabled={!shape || !form.name.trim() || posting} onClick={submitArea}>
          {posting ? "Sending…" : "Request Area"}
        </button>
      </div>
    </>
  );
}
