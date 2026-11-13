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
  // what the requester wrote shows as the first item in Feedback; Notes is the admin's
  notes: "",
  requestNotes: r.notes || undefined,
  shape: r.points ? { type: "polygon", points: r.points } : { type: "circle", center: [r.lat, r.lon], radius: r.radius_m ?? 0 },
  comments: [],
  request: true,
});

export async function fetchRequests() {
  const { data, error } = await sb.from("area_requests").select(COLUMNS).order("created_at").limit(5000);
  if (error) throw error;
  return ((data ?? []) as Row[]).map(toArea);
}

export async function deleteRequest(id: string) {
  const { error } = await sb.from("area_requests").delete().eq("id", id);
  if (error) throw error;
}

// Admin: delete a request and everything attached to it: comments, photos (and their files),
// its status / notes row and its votes. The request itself goes last, so if anything fails it
// stays listed and the delete can simply be run again.
export async function deleteRequestFully(a: Area) {
  const check = (r: { error: unknown }) => {
    if (r.error) throw r.error;
  };
  check(await sb.from("area_comments").delete().eq("area_id", a.id));
  const photos = await sb.from("area_photos").select("id, path").eq("area_id", a.id);
  check(photos);
  if (photos.data?.length) {
    check(await sb.from("area_photos").delete().eq("area_id", a.id));
    await sb.storage
      .from("area-photos")
      .remove(photos.data.map((p) => p.path as string))
      .catch(() => undefined);
  }
  check(await sb.from("area_status").delete().eq("area_id", a.id));
  // votes need 014_admin_delete_votes.sql; without it they're left behind, unseen
  await sb.from("area_votes").delete().eq("area_id", a.id);
  check(await sb.from("area_requests").delete().eq("id", a.id));
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
