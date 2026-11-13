import { ensureVisitor, sb } from "./supabase";
import type { AreaPoi, LatLng, TimeOfDay } from "./types";

const BASE = "id, area_id, kind, name, category, note, lat, lon, end_lat, end_lon, author, approved, position";
export const MAX_POINTS = 50;
export const TIMES: [TimeOfDay, string][] = [
  ["sunrise", "Sunrise"],
  ["noon", "Noon"],
  ["golden", "Golden hour"],
  ["sunset", "Sunset"],
  ["night", "Night"],
];
export const timeLabel = (t: TimeOfDay | null) => TIMES.find(([k]) => k === t)?.[1] ?? ""; // start + 48 stops + finish: what the GPS's route service accepts

interface Row {
  id: string;
  area_id: string;
  kind: "place" | "route";
  name: string;
  category: string | null;
  note: string | null;
  lat: number;
  lon: number;
  end_lat: number | null;
  end_lon: number | null;
  via?: LatLng[] | null;
  time_of_day?: TimeOfDay | null;
  author: string;
  approved: boolean;
  position: number;
}

const toPoi = (r: Row): AreaPoi => ({
  id: r.id,
  kind: r.kind,
  name: r.name,
  category: r.category ?? "",
  note: r.note ?? "",
  start: [r.lat, r.lon],
  end: r.end_lat != null && r.end_lon != null ? [r.end_lat, r.end_lon] : undefined,
  via: Array.isArray(r.via) ? r.via.filter((p) => Array.isArray(p) && p.length === 2) : [],
  time: r.time_of_day ?? null,
  author: r.author,
  approved: r.approved,
});

// Every point of a route in driving order (a place is its one point)
export const routePoints = (p: AreaPoi): LatLng[] => (p.end ? [p.start, ...p.via, p.end] : [p.start]);

// A route's pin labels: A for the start, B for the finish, numbers for the stops between
export const pointLabel = (i: number, n: number) => (i === 0 ? "A" : i === n - 1 && n > 1 ? "B" : String(i));

// Places and routes per area, in their set order. Visitors receive approved ones; the admin all.
// Before 015_area_pois.sql has run the table is missing: no places, everything else works.
// Before 017_route_stops.sql the via column is missing: routes are start to finish only.
// Before 018_route_time.sql time_of_day is missing: routes have no best time.
export async function fetchPois() {
  const byArea = new Map<string, AreaPoi[]>();
  const query = (cols: string) =>
    sb.from("area_pois").select(cols).order("position").order("created_at").limit(5000);
  let { data, error } = await query(BASE + ", via, time_of_day");
  if (error) ({ data, error } = await query(BASE + ", via"));
  if (error) ({ data, error } = await query(BASE));
  if (error) return byArea;
  for (const row of (data ?? []) as unknown as Row[]) {
    byArea.set(row.area_id, [...(byArea.get(row.area_id) ?? []), toPoi(row)]);
  }
  return byArea;
}

export interface PoiDraft {
  kind: "place" | "route";
  name: string;
  note: string;
  points: LatLng[]; // a place: one; a route: start, stops, finish in order
  time?: TimeOfDay | null; // a route: the best time to drive it
  id?: string; // editing a saved one (the admin)
}

// Where a draft's points go in the table: lat/lon the start (or the place), end the finish, via between
function pointColumns(d: PoiDraft) {
  const pts = d.points.map(round);
  const route = d.kind === "route";
  const last = pts[pts.length - 1];
  return {
    lat: pts[0][0],
    lon: pts[0][1],
    end_lat: route ? last[0] : null,
    end_lon: route ? last[1] : null,
    via: route ? pts.slice(1, -1) : [],
  };
}

function round(p: LatLng): LatLng {
  return [+p[0].toFixed(6), +p[1].toFixed(6)];
}

// A visitor's suggestion (waits for approval) or the admin's own (shows at once; the database decides)
export async function addPoi(areaId: string, d: PoiDraft, author: string) {
  await ensureVisitor();
  const { error } = await sb.from("area_pois").insert({
    area_id: areaId,
    kind: d.kind,
    name: d.name.trim().slice(0, 80),
    note: d.note.trim().slice(0, 500) || null,
    ...pointColumns(d),
    author: author.trim().slice(0, 40) || "Anonymous",
    ...(d.kind === "route" && d.time ? { time_of_day: d.time } : {}),
  });
  if (error) throw error;
}

// The admin changes a saved place or route: name, note, points, best time
export async function updatePoi(d: PoiDraft) {
  const { error } = await sb
    .from("area_pois")
    .update({
      name: d.name.trim().slice(0, 80),
      note: d.note.trim().slice(0, 500) || null,
      ...pointColumns(d),
      ...(d.kind === "route" ? { time_of_day: d.time ?? null } : {}),
    })
    .eq("id", d.id!);
  if (error) throw error;
}

export async function approvePoi(id: string) {
  const { error } = await sb.from("area_pois").update({ approved: true }).eq("id", id);
  if (error) throw error;
}

export async function deletePoi(id: string) {
  const { error } = await sb.from("area_pois").delete().eq("id", id);
  if (error) throw error;
}
