import type { LatLng } from "./types";

// Every street a released area smooths, one file per area in public/lines/ (written by
// SmootherRoads/v2/site_lines.py): {"km", "lines": [[lat0, lon0, dlat, dlon, ...], ...]} in 1e-5 degrees,
// each point after the first a delta from the one before

const BASE = import.meta.env.BASE_URL + "lines/";

// area id -> road km, for the areas that have a lines file
export async function fetchLineIndex(): Promise<Record<string, number>> {
  try {
    const r = await fetch(BASE + "index.json", { cache: "no-cache" });
    return r.ok ? await r.json() : {};
  } catch {
    return {};
  }
}

export async function fetchLines(id: string): Promise<LatLng[][]> {
  const r = await fetch(BASE + encodeURIComponent(id) + ".json");
  if (!r.ok) throw new Error("No lines for " + id);
  const { lines } = (await r.json()) as { lines: number[][] };
  return lines.map((l) => {
    const out: LatLng[] = [];
    let lat = 0;
    let lon = 0;
    for (let i = 0; i < l.length; i += 2) {
      lat += l[i];
      lon += l[i + 1];
      out.push([lat / 1e5, lon / 1e5]);
    }
    return out;
  });
}
