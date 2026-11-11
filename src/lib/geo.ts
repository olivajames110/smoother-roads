import type { Area, Draft, LatLng, Shape } from "./types";

const R_KM = 6371;
const RAD = Math.PI / 180;

export function distanceKm(a: LatLng, b: LatLng) {
  const dLat = (b[0] - a[0]) * RAD;
  const dLon = (b[1] - a[1]) * RAD;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * RAD) * Math.cos(b[0] * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(s));
}

export function polygonKm2(pts: LatLng[]) {
  const lat0 = (pts.reduce((s, p) => s + p[0], 0) / pts.length) * RAD;
  const xy = pts.map((p) => [p[1] * RAD * R_KM * Math.cos(lat0), p[0] * RAD * R_KM]);
  let a = 0;
  for (let i = 0; i < xy.length; i++) {
    const [x1, y1] = xy[i];
    const [x2, y2] = xy[(i + 1) % xy.length];
    a += x1 * y2 - x2 * y1;
  }
  return Math.abs(a / 2);
}

export const circleKm2 = (radiusM: number) => Math.PI * (radiusM / 1000) ** 2;


export const areaKm2 = (s: Shape) => (s.type === "circle" ? circleKm2(s.radius) : polygonKm2(s.points));

const sq = (n: number) => (n >= 100 ? Math.round(n).toLocaleString() : n.toFixed(1));

// Size of the covered area, always as an area (never a radius)
export const coverageShort = (s: Shape) => `${sq(areaKm2(s))} sq km`;
export const coverageMi2 = (s: Shape) => `${sq(areaKm2(s) * 0.386102)} sq mi`;
export const coverage = (s: Shape) => `${coverageMi2(s)} (${coverageShort(s)})`;

export function centerOf(s: Shape): LatLng {
  if (s.type === "circle") return s.center;
  const n = s.points.length;
  return [s.points.reduce((a, p) => a + p[0], 0) / n, s.points.reduce((a, p) => a + p[1], 0) / n];
}

export function boundsOf(s: Shape): [LatLng, LatLng] {
  if (s.type === "circle") {
    const dLat = s.radius / 1000 / (R_KM * RAD);
    const dLon = dLat / Math.max(Math.cos(s.center[0] * RAD), 0.01);
    return [
      [s.center[0] - dLat, s.center[1] - dLon],
      [s.center[0] + dLat, s.center[1] + dLon],
    ];
  }
  const lats = s.points.map((p) => p[0]);
  const lons = s.points.map((p) => p[1]);
  return [
    [Math.min(...lats), Math.min(...lons)],
    [Math.max(...lats), Math.max(...lons)],
  ];
}

// Radius in km of a circle around the shape's center that holds the whole shape
export function enclosingRadiusKm(s: Shape) {
  if (s.type === "circle") return s.radius / 1000;
  const c = centerOf(s);
  return Math.max(...s.points.map((p) => distanceKm(c, p)));
}

export function contains(s: Shape, p: LatLng) {
  if (s.type === "circle") return distanceKm(s.center, p) <= s.radius / 1000;
  let inside = false;
  for (let i = 0, j = s.points.length - 1; i < s.points.length; j = i++) {
    const [yi, xi] = s.points[i];
    const [yj, xj] = s.points[j];
    if (yi > p[0] !== yj > p[0] && p[1] < ((xj - xi) * (p[0] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export function shapeFromDraft(d: Draft): Shape | null {
  if (d.type === "radius") return d.center ? { type: "circle", center: d.center, radius: d.radius } : null;
  return d.closed && d.points.length >= 3 ? { type: "polygon", points: d.points } : null;
}

export const issueCount = (a: Area) => a.comments.filter((c) => c.type === "issue").length;

export const wrapLon = (lon: number) => (((lon + 180) % 360) + 360) % 360 - 180;
