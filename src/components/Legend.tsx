import { useMemo } from "react";
import { REASONS, STATUS, filterKey, type FilterKey } from "../lib/icons";
import { matches, useStore } from "../lib/store";

// The chips above the list: click one to show or hide those areas (list and map).
// "Unable" is split by reason; "Unable – Tried" only shows when an area has it.
const CHIPS: { key: FilterKey; label: string; color: string; color2?: string; always?: boolean }[] = [
  { key: "requested", label: STATUS.requested.label, color: STATUS.requested.color, always: true },
  { key: "progress", label: STATUS.progress.label, color: STATUS.progress.color, always: true },
  { key: "released", label: STATUS.released.label, color: STATUS.released.color, always: true },
  { key: "unable:no-photogrammetry", label: "Unable – Photogramm.", color: STATUS.unable.color,
    color2: REASONS["no-photogrammetry"].color, always: true },
  { key: "unable:alternative", label: "Alternative", color: STATUS.unable.color,
    color2: REASONS.alternative.color, always: true },
  { key: "unable:tried", label: "Unable – Tried", color: STATUS.unable.color },
];

export function StatusFilter() {
  const areas = useStore((s) => s.areas);
  const query = useStore((s) => s.query);
  const hidden = useStore((s) => s.hidden);
  const toggleStatus = useStore((s) => s.toggleStatus);

  const counts = useMemo(() => {
    const c: Partial<Record<FilterKey, number>> = {};
    for (const a of areas) if (matches(a, query)) c[filterKey(a)] = (c[filterKey(a)] ?? 0) + 1;
    return c;
  }, [areas, query]);

  return (
    <div className="status-filter" role="group" aria-label="Show statuses">
      {CHIPS.filter((c) => c.always || counts[c.key]).map((c) => (
        <button
          key={c.key}
          className={"lg-btn" + (hidden.has(c.key) ? " off" : "")}
          aria-pressed={!hidden.has(c.key)}
          title={`Show or hide ${c.label.toLowerCase()} areas`}
          onClick={() => toggleStatus(c.key)}
        >
          <i
            className="ring"
            style={{ background: `linear-gradient(90deg, ${c.color} 50%, ${c.color2 ?? c.color} 50%)` }}
          />
          {c.label}
          <span className="c">{counts[c.key] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}

// Map key: what the cluster colours mean
export function Legend() {
  return (
    <div className="legend">
      <div className="grp sizes">
        <span><i style={{ background: "var(--c-sm)" }} />1–4</span>
        <span><i style={{ background: "var(--c-md)" }} />5–14</span>
        <span><i style={{ background: "var(--c-lg)" }} />15+</span>
      </div>
    </div>
  );
}
