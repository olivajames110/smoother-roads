import L from "leaflet";
import { useEffect, useRef } from "react";
import { boundsOf } from "../lib/geo";
import { STATUS, sideColor } from "../lib/icons";
import { fetchLines } from "../lib/lines";
import { useStore } from "../lib/store";
import type { Area } from "../lib/types";

// A small map of one area: its outline, and for a released area every smoothed street (green).
// Its own Leaflet map (the big one is covered while this shows); drag and zoom work.
export function MiniMap({ area: a }: { area: Area }) {
  const el = useRef<HTMLDivElement>(null);
  const hasLines = useStore((s) => a.id in (s.lineIndex ?? {}));

  useEffect(() => {
    const map = L.map(el.current!, { zoomControl: false, attributionControl: false, worldCopyJump: true, minZoom: 2 });
    L.control.zoom({ position: "topright" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);
    const style: L.PathOptions = {
      color: STATUS[a.status].color,
      weight: 2,
      fillColor: sideColor(a),
      fillOpacity: 0.1,
      interactive: false,
    };
    (a.shape.type === "circle" ? L.circle(a.shape.center, { radius: a.shape.radius, ...style }) : L.polygon(a.shape.points, style)).addTo(map);
    map.fitBounds(L.latLngBounds(boundsOf(a.shape)), { padding: [18, 18], maxZoom: 14 });

    let live = true;
    if (hasLines) {
      fetchLines(a.id).then(
        (lines) => {
          if (!live || !lines.length) return;
          L.polyline(lines, { renderer: L.canvas({ padding: 0.3 }), color: "#188038", weight: 2, opacity: 0.9, interactive: false }).addTo(map);
        },
        () => {},
      );
    }
    // the modal fades in: measure again once it has its size
    const t = setTimeout(() => live && map.invalidateSize(), 200);
    return () => {
      live = false;
      clearTimeout(t);
      map.remove();
    };
  }, [a.id, hasLines]);

  return <div ref={el} className="mini-map" aria-label={`Map of ${a.name}`} />;
}
