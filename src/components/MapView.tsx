import L from "leaflet";
import "leaflet.markercluster";
import { useEffect, useRef } from "react";
import { CONFIG } from "../lib/config";
import { esc, fmtN } from "../lib/format";
import { centerOf, wrapLon } from "../lib/geo";
import { CATS, STATUS } from "../lib/icons";
import { useStore } from "../lib/store";
import type { Area } from "../lib/types";
import { useVisible } from "../lib/useVisible";
import { svgHtml } from "./Icon";

const ACCENT = "#2563eb";
const ISSUE = "#dc2626";
const SHAPES_MIN_ZOOM = 7;

interface Layers {
  map: L.Map;
  cluster: L.MarkerClusterGroup;
  shapes: L.FeatureGroup;
  draft: L.LayerGroup;
  pins: L.LayerGroup;
  markers: Map<string, { area: Area; marker: L.Marker; shape: L.Path; state: string }>;
}

function clusterIcon(c: L.MarkerCluster) {
  const n = c.getChildCount();
  const [cls, size] = n >= 15 ? ["lg", 56] : n >= 5 ? ["md", 46] : ["sm", 38];
  return L.divIcon({
    html: `<div class="cl ${cls}">${n}</div>`,
    className: "cl-wrap",
    iconSize: [size, size],
  });
}

function pinIcon(a: Area, state: string) {
  return L.divIcon({
    html: `<div class="pin ${state}" style="--sc:${STATUS[a.status].color}">${svgHtml(CATS[a.cat].icon, 16, 2.2)}</div>`,
    className: "pin-wrap",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });
}

const shapeStyle = (a: Area, on: boolean): L.PathOptions => ({
  color: STATUS[a.status].color,
  weight: on ? 3 : 2,
  fillColor: STATUS[a.status].color,
  fillOpacity: on ? 0.22 : 0.1,
  bubblingMouseEvents: false,
});

function tooltip(a: Area) {
  const votes = CONFIG.votes ? ` · ${fmtN(a.votes)} votes` : "";
  return `${esc(a.name)}<span class="tt-sub">${STATUS[a.status].label}${votes}</span>`;
}

function requestMenu(map: L.Map, e: L.LeafletMouseEvent) {
  const { panel, pinMode } = useStore.getState();
  if (pinMode || panel === "submit") return;
  const button = L.DomUtil.create("button", "btn cyan sm");
  button.innerHTML = svgHtml('<path d="M12 5v14M5 12h14"/>', 14, 2.6) + "Request Area";
  button.onclick = () => {
    map.closePopup();
    useStore.getState().requestAt([e.latlng.lat, wrapLon(e.latlng.lng)], map.getZoom());
  };
  L.popup({ closeButton: false, className: "request-menu" }).setLatLng(e.latlng).setContent(button).openOn(map);
}

// While drawing or placing a pin, clicks on existing areas count as map clicks
function pick(a: Area, e: L.LeafletMouseEvent) {
  const s = useStore.getState();
  if (s.pinMode || s.panel === "submit") s.onMapPoint([e.latlng.lat, wrapLon(e.latlng.lng)]);
  else s.openDetail(a.id);
}

export function MapView() {
  const el = useRef<HTMLDivElement>(null);
  const layers = useRef<Layers | null>(null);

  const visible = useVisible(true);
  const selectedId = useStore((s) => s.selectedId);
  const hoveredId = useStore((s) => s.hoveredId);
  const draft = useStore((s) => s.draft);
  const panel = useStore((s) => s.panel);
  const pinMode = useStore((s) => s.pinMode);
  const commentPin = useStore((s) => s.comment.pin);
  const spot = useStore((s) => s.spot);
  const selected = useStore((s) => s.areas.find((a) => a.id === s.selectedId));
  const fly = useStore((s) => s.fly);

  useEffect(() => {
    const map = L.map(el.current!, {
      zoomControl: false,
      attributionControl: false,
      worldCopyJump: true,
      minZoom: 2,
    }).setView([35, -30], 3);

    L.control.zoom({ position: "bottomleft" }).addTo(map);
    L.control.attribution({ position: "bottomleft", prefix: false }).addTo(map);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const cluster = L.markerClusterGroup({
      disableClusteringAtZoom: 9,
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      iconCreateFunction: clusterIcon,
    }).addTo(map);
    const shapes = L.featureGroup();
    const syncShapes = () => {
      if (map.getZoom() >= SHAPES_MIN_ZOOM) map.addLayer(shapes);
      else map.removeLayer(shapes);
    };
    map.on("zoomend", syncShapes);
    syncShapes();

    const draftLayer = L.layerGroup().addTo(map);
    const pins = L.layerGroup().addTo(map);
    map.on("click", (e: L.LeafletMouseEvent) => {
      useStore.getState().onMapPoint([e.latlng.lat, wrapLon(e.latlng.lng)]);
    });

    map.on("contextmenu", (e: L.LeafletMouseEvent) => requestMenu(map, e));

    const resize = new ResizeObserver(() => map.invalidateSize());
    resize.observe(el.current!);

    layers.current = { map, cluster, shapes, draft: draftLayer, pins, markers: new Map() };
    return () => {
      resize.disconnect();
      map.remove();
      layers.current = null;
    };
  }, []);

  // Area pins and coverage shapes
  useEffect(() => {
    const l = layers.current!;
    l.cluster.clearLayers();
    l.shapes.clearLayers();
    l.markers.clear();

    const hover = (id: string | null) => () => useStore.getState().patch({ hoveredId: id });
    const added: L.Marker[] = [];
    for (const a of visible) {
      const marker = L.marker(centerOf(a.shape), { icon: pinIcon(a, ""), title: a.name })
        .bindTooltip(tooltip(a), { direction: "top", offset: [0, -16] })
        .on("click", (e) => pick(a, e))
        .on("mouseover", hover(a.id))
        .on("mouseout", hover(null));
      const shape = (
        a.shape.type === "circle"
          ? L.circle(a.shape.center, { radius: a.shape.radius, ...shapeStyle(a, false) })
          : L.polygon(a.shape.points, shapeStyle(a, false))
      )
        .on("click", (e) => pick(a, e))
        .on("mouseover", hover(a.id))
        .on("mouseout", hover(null));
      shape.addTo(l.shapes);
      added.push(marker);
      l.markers.set(a.id, { area: a, marker, shape, state: "" });
    }
    l.cluster.addLayers(added);
  }, [visible]);

  // Selected and hovered highlights. setIcon keeps them when a pin leaves and rejoins a cluster.
  useEffect(() => {
    for (const [id, m] of layers.current!.markers) {
      const state = id === selectedId ? "sel" : id === hoveredId ? "hl" : "";
      if (state === m.state) continue;
      m.state = state;
      m.marker.setIcon(pinIcon(m.area, state));
      m.shape.setStyle(shapeStyle(m.area, !!state));
    }
  }, [visible, selectedId, hoveredId]);

  // The shape being drawn
  useEffect(() => {
    const l = layers.current!;
    l.draft.clearLayers();
    if (panel !== "submit") return;

    if (draft.type === "radius") {
      if (!draft.center) return;
      L.circle(draft.center, {
        radius: draft.radius,
        color: ACCENT,
        weight: 2,
        dashArray: "6 6",
        fillColor: ACCENT,
        fillOpacity: 0.08,
        interactive: false,
      }).addTo(l.draft);
      L.circleMarker(draft.center, {
        radius: 7,
        color: "#fff",
        weight: 3,
        fillColor: ACCENT,
        fillOpacity: 1,
        interactive: false,
      }).addTo(l.draft);
      return;
    }

    const line = { color: ACCENT, weight: 2, interactive: false };
    if (draft.closed) {
      L.polygon(draft.points, { ...line, fillColor: ACCENT, fillOpacity: 0.08 }).addTo(l.draft);
    } else if (draft.points.length > 1) {
      L.polyline(draft.points, { ...line, dashArray: "6 6" }).addTo(l.draft);
    }
    draft.points.forEach((p, i) => {
      const closes = i === 0 && !draft.closed && draft.points.length >= 3;
      const dot = L.circleMarker(p, {
        radius: closes ? 8 : 5,
        color: closes ? ACCENT : "#fff",
        weight: 2,
        fillColor: closes ? "#fff" : ACCENT,
        fillOpacity: 1,
        interactive: closes,
        bubblingMouseEvents: false,
      }).addTo(l.draft);
      if (closes) dot.on("click", () => useStore.getState().finishPolygon());
    });
  }, [draft, panel]);

  // Pins on the selected area's comments, plus the one being placed
  useEffect(() => {
    const l = layers.current!;
    l.pins.clearLayers();
    const dot = (p: L.LatLngExpression, color: string) =>
      L.circleMarker(p, { radius: 7, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 }).addTo(l.pins);
    for (const s of selected?.spots ?? []) {
      dot(s.pin, ISSUE).bindTooltip(esc(s.note || "Problem spot"), { direction: "top" });
    }
    if (spot) dot(spot, ISSUE);
    if (!CONFIG.database) return;
    for (const c of selected?.comments ?? []) {
      if (c.pin) dot(c.pin, c.type === "issue" ? ISSUE : ACCENT).bindTooltip(esc(c.author), { direction: "top" });
    }
    if (commentPin) dot(commentPin, ACCENT);
  }, [selected, commentPin, spot]);

  useEffect(() => {
    const l = layers.current;
    if (!l || !fly) return;
    const narrow = (el.current!.closest(".device")?.clientWidth ?? 1000) <= 860;
    const panelOpen = useStore.getState().panel !== null;
    const sheet = el.current!.clientHeight * 0.66;
    const pad: L.PointTuple = !panelOpen ? [40, 40] : narrow ? [20, sheet + 20] : [464, 40];
    l.map.flyToBounds(L.latLngBounds(fly.bounds), {
      paddingTopLeft: [40, 60],
      paddingBottomRight: pad,
      maxZoom: fly.maxZoom,
      duration: 0.8,
    });
  }, [fly]);

  // Toggled directly because a React className would wipe the classes Leaflet puts on this element
  useEffect(() => {
    el.current!.classList.toggle("drawing", pinMode || panel === "submit");
    el.current!.classList.toggle("submitting", panel === "submit");
  }, [pinMode, panel]);

  return <div id="map" ref={el} aria-label="Coverage map" />;
}
