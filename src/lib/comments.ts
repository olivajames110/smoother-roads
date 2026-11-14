import { captchaToken, ensureVisitor, sb } from "./supabase";
import type { AreaComment, CommentType, LatLng, Reason, Status } from "./types";

const BASE = "id, area_id, author, dev, type, body, pin_lat, pin_lon, hidden, created_at, reply_to";
const COLUMNS = BASE + ", rating"; // rating: 021_area_reviews.sql

interface Row {
  id: string;
  area_id: string;
  author: string;
  dev: boolean;
  type: CommentType;
  body: string;
  pin_lat: number | null;
  pin_lon: number | null;
  hidden: boolean;
  created_at: string;
  reply_to: string | null;
  rating?: number | null;
}

const toComment = (r: Row): AreaComment => ({
  id: r.id,
  author: r.author,
  dev: r.dev,
  type: r.type,
  text: r.body,
  pin: r.pin_lat === null || r.pin_lon === null ? undefined : [r.pin_lat, r.pin_lon],
  date: Date.parse(r.created_at),
  hidden: r.hidden,
  replyTo: r.reply_to ?? undefined,
  rating: r.rating ?? undefined,
});

export async function fetchComments() {
  const get = (cols: string) => sb.from("area_comments").select(cols).order("created_at").limit(5000);
  let { data, error } = await get(COLUMNS);
  // before 021_area_reviews.sql has run there's no rating column
  if (error) ({ data, error } = await get(BASE));
  if (error) throw error;
  const byArea = new Map<string, AreaComment[]>();
  for (const row of (data ?? []) as unknown as Row[]) {
    byArea.set(row.area_id, [...(byArea.get(row.area_id) ?? []), toComment(row)]);
  }
  return byArea;
}

export interface AreaOverride {
  status: Status | null;
  reason: Reason | null;
  hidden: boolean;
  noPhotogrammetry: boolean | null; // null keeps the value from areas.json
  notes: string | null; // null keeps the area's own notes
}

export async function fetchStatuses() {
  // Columns added by later migrations go first; drop them one at a time until a select works,
  // so statuses and hiding keep working before 008 / 011 have been run
  const tries = [
    "area_id, status, hidden, no_photogrammetry, notes, reason",
    "area_id, status, hidden, no_photogrammetry, notes",
    "area_id, status, hidden, no_photogrammetry",
    "area_id, status, hidden",
  ];
  let data: Record<string, unknown>[] | null = null;
  let error: unknown = null;
  for (const cols of tries) {
    ({ data, error } = await sb.from("area_status").select(cols));
    if (!error) break;
  }
  if (error) throw error;
  return new Map<string, AreaOverride>(
    (data ?? []).map((r) => [
      r.area_id as string,
      {
        // The old "alternative" status is now Unable + "Alternative available"
        status: (r.status === "alternative" ? "unable" : r.status) as Status | null,
        reason: (r.status === "alternative" ? "alternative" : r.reason ?? null) as Reason | null,
        hidden: r.hidden as boolean,
        noPhotogrammetry: (r.no_photogrammetry ?? null) as boolean | null,
        notes: (r.notes ?? null) as string | null,
      },
    ]),
  );
}

export async function setNotes(areaId: string, notes: string) {
  const { error } = await sb.from("area_status").upsert({ area_id: areaId, notes, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function addComment(
  areaId: string,
  author: string,
  type: CommentType,
  text: string,
  pin: LatLng | null,
  replyTo?: string,
  rating?: number,
) {
  await ensureVisitor();
  const row: Record<string, unknown> = {
    area_id: areaId,
    author,
    type,
    body: text,
    pin_lat: pin?.[0] ?? null,
    pin_lon: pin?.[1] ?? null,
    reply_to: replyTo ?? null,
  };
  if (type === "review") row.rating = rating;
  const { data, error } = await sb
    .from("area_comments")
    .insert(row)
    .select(type === "review" ? COLUMNS : BASE)
    .single();
  if (error) throw error;
  return toComment(data as unknown as Row);
}

// The ids of this browser's own reviews (none before it has signed in, or before 021 has run)
export async function fetchMyReviews() {
  const { data: session } = await sb.auth.getSession();
  if (!session.session) return new Set<string>();
  const { data } = await sb.rpc("my_reviews");
  return new Set(((data ?? []) as { id: string }[]).map((r) => r.id));
}

export async function editReview(id: string, rating: number, text: string, author: string) {
  const { error } = await sb.rpc("edit_review", { review_id: id, stars: rating, review: text, name: author });
  if (error) throw error;
}

// Average stars and how many reviews (visible ones only)
export function ratingOf(comments: AreaComment[]) {
  const r = comments.filter((c) => c.type === "review" && c.rating && !c.hidden);
  return { avg: r.length ? r.reduce((n, c) => n + c.rating!, 0) / r.length : 0, count: r.length };
}

export async function setHidden(id: string, hidden: boolean) {
  const { error } = await sb.from("area_comments").update({ hidden }).eq("id", id);
  if (error) throw error;
}

// The reason only goes with "unable" (other statuses ignore it, so it isn't sent and they work
// even before 012_unable_reasons.sql has run)
export async function setStatus(areaId: string, status: Status, reason?: Reason) {
  const row: Record<string, unknown> = { area_id: areaId, status, updated_at: new Date().toISOString() };
  if (status === "unable") row.reason = reason ?? "tried";
  // Unable because of no photogrammetry also marks it "Not a photogrammetry zone"
  if (status === "unable" && reason === "no-photogrammetry") row.no_photogrammetry = true;
  const { error } = await sb.from("area_status").upsert(row);
  if (error) {
    if (/reason/.test(error.message)) throw new Error("Run supabase/012_unable_reasons.sql in Supabase first");
    throw error;
  }
}

export async function setRegionHidden(areaId: string, hidden: boolean) {
  const { error } = await sb.from("area_status").upsert({ area_id: areaId, hidden, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function setNoPhotogrammetry(areaId: string, value: boolean) {
  const { error } = await sb
    .from("area_status")
    .upsert({ area_id: areaId, no_photogrammetry: value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function signIn(email: string, password: string) {
  const { error } = await sb.auth.signInWithPassword({ email, password, options: { captchaToken: await captchaToken() } });
  if (error) throw error;
}

export const signOut = () => sb.auth.signOut();

export async function amAdmin() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return false;
  const { data: ok } = await sb.rpc("is_admin");
  return ok === true;
}
