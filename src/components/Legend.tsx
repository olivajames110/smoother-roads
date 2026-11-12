import { useMemo } from "react";
import { STATUS } from "../lib/icons";
import { matches, useStore } from "../lib/store";
import type { Status } from "../lib/types";
import { Icon } from "./Icon";

const ORDER: Status[] = ["requested", "progress", "released", "unable"];

// Status filter above the list: click a status to show or hide those areas (list and map)
export function StatusFilter() {
  const areas = useStore((s) => s.areas);
  const query = useStore((s) => s.query);
  const hidden = useStore((s) => s.hidden);
  const toggleStatus = useStore((s) => s.toggleStatus);
  const photoOnly = useStore((s) => s.photoOnly);
  const setPhotoOnly = useStore((s) => s.setPhotoOnly);

  const counts = useMemo(() => {
    const shown = areas.filter((a) => matches(a, query) && (!photoOnly || !a.noPhotogrammetry));
    return Object.fromEntries(ORDER.map((s) => [s, shown.filter((a) => a.status === s).length]));
  }, [areas, query, photoOnly]);

  return (
    <div className="status-filter" role="group" aria-label="Show statuses">
      {ORDER.map((s) => (
        <button
          key={s}
          className={"lg-btn" + (hidden.has(s) ? " off" : "")}
          aria-pressed={!hidden.has(s)}
          title={`Show or hide ${STATUS[s].label.toLowerCase()} areas`}
          onClick={() => toggleStatus(s)}
        >
          <i className="ring" style={{ "--sc": STATUS[s].color } as React.CSSProperties} />
          {STATUS[s].label}
          <span className="c">{counts[s]}</span>
        </button>
      ))}
      <button
        className={"lg-btn ph-chip" + (photoOnly ? " on" : "")}
        aria-pressed={photoOnly}
        title="Only show areas with photogrammetry scenery"
        onClick={() => setPhotoOnly(!photoOnly)}
      >
        <Icon name={photoOnly ? "check" : "layers"} size={13} weight={2.4} />
        Photogrammetry only
      </button>
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
