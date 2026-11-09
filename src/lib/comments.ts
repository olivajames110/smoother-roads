import { captchaToken, ensureVisitor, sb } from "./supabase";
import type { AreaComment, CommentType, LatLng, Status } from "./types";

const COLUMNS = "id, area_id, author, dev, type, body, pin_lat, pin_lon, hidden, created_at, reply_to";

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
});

export async function fetchComments() {
  const { data, error } = await sb.from("area_comments").select(COLUMNS).order("created_at").limit(5000);
  if (error) throw error;
  const byArea = new Map<string, AreaComment[]>();
  for (const row of (data ?? []) as Row[]) {
    byArea.set(row.area_id, [...(byArea.get(row.area_id) ?? []), toComment(row)]);
  }
  return byArea;
}

export interface AreaOverride {
  status: Status | null;
  hidden: boolean;
  noPhotogrammetry: boolean | null; // null keeps the value from areas.json
}

export async function fetchStatuses() {
  let { data, error } = await sb.from("area_status").select("area_id, status, hidden, no_photogrammetry");
  // Before 008_photogrammetry_toggle.sql runs the column is missing; keep statuses and hiding working
  if (error) ({ data, error } = await sb.from("area_status").select("area_id, status, hidden"));
  if (error) throw error;
  return new Map<string, AreaOverride>(
    (data ?? []).map((r) => [
      r.area_id as string,
      { status: r.status as Status | null, hidden: r.hidden as boolean, noPhotogrammetry: (r.no_photogrammetry ?? null) as boolean | null },
    ]),
  );
}

export async function addComment(
  areaId: string,
  author: string,
  type: CommentType,
  text: string,
  pin: LatLng | null,
  replyTo?: string,
) {
  await ensureVisitor();
  const { data, error } = await sb
    .from("area_comments")
    .insert({
      area_id: areaId,
      author,
      type,
      body: text,
      pin_lat: pin?.[0] ?? null,
      pin_lon: pin?.[1] ?? null,
      reply_to: replyTo ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return toComment(data as Row);
}

export async function setHidden(id: string, hidden: boolean) {
  const { error } = await sb.from("area_comments").update({ hidden }).eq("id", id);
  if (error) throw error;
}

export async function setStatus(areaId: string, status: Status) {
  const { error } = await sb.from("area_status").upsert({ area_id: areaId, status, updated_at: new Date().toISOString() });
  if (error) throw error;
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
