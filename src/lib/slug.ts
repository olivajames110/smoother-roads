import type { Area } from "./types";

// Each area has a short URL: /smoother-roads/courchevel opens Courchevel, France.
// The slug is the name before the first comma ("Farmingdale/Massapequa, NY" -> farmingdale-massapequa).
// When two areas would share one, both use their id instead. The full id also works in the URL.

const BASE = import.meta.env.BASE_URL; // "/smoother-roads/" in the build, "/" in local dev

const clean = (s: string) =>
  s
    .split(",")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

let cache: { areas: Area[]; byId: Map<string, string> } | null = null;

function slugs(areas: Area[]) {
  if (cache?.areas === areas) return cache.byId;
  const count = new Map<string, number>();
  for (const a of areas) {
    const s = clean(a.name);
    count.set(s, (count.get(s) ?? 0) + 1);
  }
  const byId = new Map<string, string>();
  for (const a of areas) {
    const s = clean(a.name);
    byId.set(a.id, s && count.get(s) === 1 ? s : a.id);
  }
  cache = { areas, byId };
  return byId;
}

export const areaSlug = (a: Area, areas: Area[]) => slugs(areas).get(a.id) ?? a.id;

// The area named by the current URL's path (slug or id), if any
export function areaFromPath(areas: Area[]): Area | undefined {
  const path = location.pathname.startsWith(BASE) ? location.pathname.slice(BASE.length) : "";
  const key = decodeURIComponent(path.replace(/\/+$/, "")).toLowerCase();
  if (!key) return undefined;
  const byId = slugs(areas);
  return (
    areas.find((a) => a.id.toLowerCase() === key || byId.get(a.id) === key) ??
    areas.find((a) => clean(a.name) === key) // a shared name: the first area with it
  );
}

// Point the address bar at the open area (or the home page), keeping the query (?demo, ?area)
export function syncPath(area: Area | undefined, areas: Area[], push: boolean) {
  const path = BASE + (area ? areaSlug(area, areas) : "");
  const params = new URLSearchParams(location.search);
  params.delete("area");
  const q = params.toString();
  const url = path + (q ? "?" + q : "") + location.hash;
  if (url === location.pathname + location.search + location.hash) return;
  if (push) history.pushState(null, "", url);
  else history.replaceState(null, "", url);
}
