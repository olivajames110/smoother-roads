import { ensureVisitor, sb } from "./supabase";

// Votes on the Vote page ("work on this next"), separate from an area's upvotes (027_work_votes.sql):
// 3 a day per visitor, spent on any locations, more than one on the same location allowed
// (030_work_votes_multiple.sql); today's can be taken back, one at a time
export const DAILY_VOTES = 3;

export interface WorkVotes {
  ready: boolean; // false until the table exists: the page says voting isn't open yet
  counts: Map<string, number>; // all votes ever, per area
  today: Map<string, number>; // this browser's votes today, per area
}

// Sent on window (detail = votes left today) whenever the Vote page's count changes: the sidebar's Vote tab shows it
export const VOTES_LEFT_EVENT = "sr-votes-left";

// Today as the database counts it (UTC), e.g. "2026-11-23"
const utcDay = () => new Date().toISOString().slice(0, 10);

// The rows behind this browser's votes today, per area, so one vote can be taken back.
// undefined = the row's id isn't known (030_work_votes_multiple.sql hasn't been run: one row per area then)
const rows = new Map<string, (number | undefined)[]>();

export async function fetchWorkVotes(): Promise<WorkVotes> {
  const out: WorkVotes = { ready: false, counts: new Map(), today: new Map() };
  const { data, error } = await sb.rpc("work_vote_counts");
  if (error) return out;
  out.ready = true;
  for (const row of (data ?? []) as { area_id: string; votes: number }[]) out.counts.set(row.area_id, Number(row.votes));
  rows.clear();
  const { data: session } = await sb.auth.getSession();
  if (session.session) {
    const { data: own } = await sb.from("work_votes").select("*").eq("day", utcDay());
    for (const row of (own ?? []) as { area_id: string; id?: number }[]) {
      rows.set(row.area_id, [...(rows.get(row.area_id) ?? []), row.id]);
      out.today.set(row.area_id, (out.today.get(row.area_id) ?? 0) + 1);
    }
  }
  return out;
}

// How many of today's votes this browser still has (all of them for a new visitor; 0 while voting isn't open)
export async function votesLeftToday(): Promise<number> {
  const { data: session } = await sb.auth.getSession();
  if (!session.session) return DAILY_VOTES;
  const { count, error } = await sb.from("work_votes").select("area_id", { count: "exact", head: true }).eq("day", utcDay());
  if (error) return 0;
  return Math.max(0, DAILY_VOTES - (count ?? 0));
}

// One more vote for the area. Throws with code "23505" when the database still allows one per area a day.
export async function addWorkVote(areaId: string) {
  await ensureVisitor();
  const { data, error } = await sb.from("work_votes").insert({ area_id: areaId }).select("*").single();
  if (error) throw error;
  rows.set(areaId, [...(rows.get(areaId) ?? []), (data as { id?: number } | null)?.id]);
}

// Takes back one of today's votes for the area
export async function takeBackWorkVote(areaId: string) {
  const list = [...(rows.get(areaId) ?? [])];
  const id = list.pop();
  const del = sb.from("work_votes").delete();
  const { error } = await (id != null ? del.eq("id", id) : del.eq("area_id", areaId).eq("day", utcDay()));
  if (error) throw error;
  rows.set(areaId, list);
}
