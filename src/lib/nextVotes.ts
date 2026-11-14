import { ensureVisitor, sb } from "./supabase";

export const DAILY_VOTES = 3;

export interface Round {
  id: number;
  startedAt: string;
  endedAt: string | null;
  winner: string | null;
}

export interface VoteBoard {
  round: Round | null; // the open round (null before 020_next_area_votes.sql has run)
  past: Round[]; // ended rounds, newest first
  counts: Map<string, { votes: number; today: number }>;
  mineToday: Set<string>; // areas this browser voted for today
}

// Today as the server counts it (UTC), e.g. "2026-11-13"
export const utcDay = () => new Date().toISOString().slice(0, 10);

// Milliseconds until the votes reset (midnight UTC)
export function msToReset() {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1) - now.getTime();
}

export async function fetchBoard(): Promise<VoteBoard> {
  const board: VoteBoard = { round: null, past: [], counts: new Map(), mineToday: new Set() };
  const { data: rounds, error } = await sb
    .from("vote_rounds")
    .select("id, started_at, ended_at, winner")
    .order("started_at", { ascending: false })
    .limit(50);
  if (error) return board; // table missing: the page says the vote isn't open yet
  for (const r of rounds ?? []) {
    const round = { id: r.id, startedAt: r.started_at, endedAt: r.ended_at, winner: r.winner };
    if (!r.ended_at) board.round = round;
    else board.past.push(round);
  }
  const { data: counts } = await sb.rpc("next_vote_counts");
  for (const c of (counts ?? []) as { area_id: string; votes: number; today: number }[]) {
    board.counts.set(c.area_id, { votes: Number(c.votes), today: Number(c.today) });
  }
  const { data: session } = await sb.auth.getSession();
  if (session.session && board.round) {
    const { data: own } = await sb
      .from("next_votes")
      .select("area_id")
      .eq("round_id", board.round.id)
      .eq("day", utcDay());
    for (const v of own ?? []) board.mineToday.add(v.area_id);
  }
  return board;
}

export async function castVote(areaId: string) {
  await ensureVisitor();
  const { error } = await sb.from("next_votes").insert({ area_id: areaId });
  if (error) throw error;
}

export async function takeBack(areaId: string) {
  const { error } = await sb.from("next_votes").delete().eq("area_id", areaId).eq("day", utcDay());
  if (error) throw error;
}

export async function endRound(winner: string) {
  const { error } = await sb.rpc("end_vote_round", { winner_id: winner });
  if (error) throw error;
}
