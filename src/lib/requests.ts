import { centerOf } from "./geo";
import { ensureVisitor, sb } from "./supabase";
import type { Area, Cat, LatLng } from "./types";

const COLUMNS = "id, name, region, country, icao, cat, notes, lat, lon, radius_m, points, created_at";

interface Row {
  id: string;
  name: string;
  region: string;
  country: string;
  icao: string;
  cat: Cat;
  notes: string;
  lat: number;
  lon: number;
  radius_m: number | null;
  points: LatLng[] | null;
  created_at: string;
}

const toArea = (r: Row): Area => ({
  id: r.id,
  name: r.name,
  region: r.region,
  country: r.country,
  icao: r.icao,
  cat: r.cat,
  status: "requested",
  votes: 0,
  voted: false,
  by: "Community",
  date: Date.parse(r.created_at),
  notes: r.notes,
  shape: r.points ? { type: "polygon", points: r.points } : { type: "circle", center: [r.lat, r.lon], radius: r.radius_m ?? 0 },
  comments: [],
});

export async function fetchRequests() {
  const { data, error } = await sb.from("area_requests").select(COLUMNS).order("created_at").limit(5000);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toArea);
}

export async function addRequest(a: Area) {
  await ensureVisitor();
  const [lat, lon] = centerOf(a.shape);
  const { data, error } = await sb
    .from("area_requests")
    .insert({
      name: a.name,
      region: a.region,
      country: a.country,
      icao: a.icao,
      cat: a.cat,
      notes: a.notes,
      lat,
      lon,
      radius_m: a.shape.type === "circle" ? a.shape.radius : null,
      points: a.shape.type === "polygon" ? a.shape.points : null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toArea(data as Row);
}
