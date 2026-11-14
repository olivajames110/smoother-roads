import { sb } from "./supabase";

const VISITOR_KEY = "sr-visitor"; // a random id for this browser (localStorage)
const LOGGED_KEY = "sr-visit-logged"; // set once per tab session (sessionStorage)

export type VisitDay = { day: string; visitors: number; visits: number };
export type VisitStats = {
  days: VisitDay[];
  period_visitors: number;
  week_visitors: number;
  total_visitors: number;
  total_visits: number;
  referrers: { host: string; visits: number }[];
};

function visitorId() {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID(); // private window: counted, just not recognised next time
  }
}

// The referring site's host, when the visitor came from another site
function referrerHost() {
  try {
    const host = document.referrer ? new URL(document.referrer).hostname : "";
    return host && host !== location.hostname ? host.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
}

// One visit per tab session. The database skips the admin and the admin's IPs (022_site_visits.sql).
export async function logVisit() {
  if (import.meta.env.DEV || /^(localhost|127\.)/.test(location.hostname)) return;
  try {
    if (sessionStorage.getItem(LOGGED_KEY)) return;
    sessionStorage.setItem(LOGGED_KEY, "1");
  } catch {
    /* no session storage: log it anyway */
  }
  await sb.rpc("log_visit", { visitor: visitorId(), ref: referrerHost() });
}

export async function fetchVisitStats(days = 30): Promise<VisitStats> {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const { data, error } = await sb.rpc("visit_stats", { tz, days });
  if (error) {
    if (/visit_stats|function/i.test(error.message)) throw new Error("Run 022_site_visits.sql in Supabase first");
    throw error;
  }
  return data as VisitStats;
}
