import { ensureVisitor, sb } from "./supabase";

// Votes on the Vote page ("work on this next"), separate from an area's upvotes (027_work_votes.sql):
// 3 a day per visitor, at most one per area per day; today's can be taken back
export const DAILY_VOTES = 3;

export interface WorkVotes {
  ready: boolean; // false until the table exists: the page says voting isn't open yet
  counts: Map<string, number>; // all votes ever, per area
  today: Set<string>; // the areas this browser voted for today
}

// Today as the database counts it (UTC), e.g. "2026-11-23"
const utcDay = () => new Date().toISOString().slice(0, 10);

export async function fetchWorkVotes(): Promise<WorkVotes> {
  const out: WorkVotes = { ready: false, counts: new Map(), today: new Set() };
  const { data, error } = await sb.rpc("work_vote_counts");
  if (error) return out;
  out.ready = true;
  for (const row of (data ?? []) as { area_id: string; votes: number }[]) out.counts.set(row.area_id, Number(row.votes));
  const { data: session } = await sb.auth.getSession();
  if (session.session) {
    const { data: own } = await sb.from("work_votes").select("area_id").eq("day", utcDay());
    for (const row of own ?? []) out.today.add(row.area_id);
  }
  return out;
}

export async function setWorkVote(areaId: string, on: boolean) {
  await ensureVisitor();
  if (on) {
    const { error } = await sb.from("work_votes").insert({ area_id: areaId });
    if (error && error.code !== "23505") throw error; // already voted today, e.g. in another tab
  } else {
    const { error } = await sb.from("work_votes").delete().eq("area_id", areaId).eq("day", utcDay());
    if (error) throw error;
  }
}
