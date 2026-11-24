import { ensureVisitor, sb } from "./supabase";

// Votes on the Vote page ("work on this next"), separate from an area's upvotes (027_work_votes.sql)
export interface WorkVotes {
  ready: boolean; // false until the table exists: the page says voting isn't open yet
  counts: Map<string, number>;
  mine: Set<string>;
}

export async function fetchWorkVotes(): Promise<WorkVotes> {
  const out: WorkVotes = { ready: false, counts: new Map(), mine: new Set() };
  const { data, error } = await sb.rpc("work_vote_counts");
  if (error) return out;
  out.ready = true;
  for (const row of (data ?? []) as { area_id: string; votes: number }[]) out.counts.set(row.area_id, Number(row.votes));
  const { data: session } = await sb.auth.getSession();
  if (session.session) {
    const { data: own } = await sb.from("work_votes").select("area_id");
    for (const row of own ?? []) out.mine.add(row.area_id);
  }
  return out;
}

export async function setWorkVote(areaId: string, on: boolean) {
  await ensureVisitor();
  if (on) {
    const { error } = await sb.from("work_votes").insert({ area_id: areaId });
    if (error && error.code !== "23505") throw error; // already voted, e.g. in another tab
  } else {
    const { error } = await sb.from("work_votes").delete().eq("area_id", areaId);
    if (error) throw error;
  }
}
