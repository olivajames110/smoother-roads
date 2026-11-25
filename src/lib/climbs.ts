import { sb } from "./supabase";

// Hill Climb leaderboards (028_climb_times.sql, 029_climb_levels.sql). Street GPS times a run up a hill climb and
// submits it; the site only reads the boards (and lets the admin remove an entry).

// Race levels: where a timed run starts. Each has its own board. The index is the database's "stage".
export const LEVELS = ["Full climb", "From 1/4", "From 1/2", "From 3/4"] as const;

export interface ClimbTime {
  pos: number;
  id: string;
  name: string; // the driver name typed in Street GPS
  ms: number;
  splits: number[]; // at the quarter marks after the start: 3 for the full climb, none from 3/4
  vehicle: string;
  date: number;
}

export interface ClimbBoard {
  ready: boolean; // false until the database has the leaderboard: the page says so
  times: ClimbTime[];
}

interface Row {
  pos: number;
  id: string;
  name: string;
  ms: number;
  splits: number[] | null;
  vehicle: string | null;
  at: string;
}

export async function fetchClimbBoard(climbId: string, stage: number): Promise<ClimbBoard> {
  const { data, error } = await sb.rpc("climb_board", { p_climb: climbId, p_stage: stage, p_limit: 200 });
  if (error) return { ready: false, times: [] };
  return {
    ready: true,
    times: ((data ?? []) as Row[]).map((r) => ({
      pos: Number(r.pos),
      id: r.id,
      name: r.name,
      ms: Number(r.ms),
      splits: (r.splits ?? []).map(Number),
      vehicle: r.vehicle ?? "",
      date: new Date(r.at).getTime(),
    })),
  };
}

// Admin only (the database refuses anyone else)
export async function removeClimbTime(id: string) {
  const { error, count } = await sb.from("climb_times").delete({ count: "exact" }).eq("id", id);
  if (error) throw error;
  if (!count) throw new Error("Not removed: sign in as the dev first");
}

// 754321 ms -> "12:34.3"; an hour or more -> "1:02:34.3" (the same text Street GPS shows)
export function fmtRun(ms: number) {
  const t = Math.max(0, Math.round(ms / 100));
  const tenths = t % 10;
  const s = Math.floor(t / 10) % 60;
  const m = Math.floor(t / 600) % 60;
  const h = Math.floor(t / 36000);
  return (h ? h + ":" + (m < 10 ? "0" : "") : "") + m + ":" + (s < 10 ? "0" : "") + s + "." + tenths;
}
