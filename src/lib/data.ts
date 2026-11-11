import { CONFIG } from "./config";
import { centerOf, enclosingRadiusKm } from "./geo";
import { CATS } from "./icons";
import type { Area, AreaComment, AreaPhoto, Cat, LatLng, Status } from "./types";
import { fetchComments, fetchStatuses, type AreaOverride } from "./comments";
import { fetchPhotos } from "./photos";
import { fetchRequests } from "./requests";
import { fetchVotes } from "./votes";

const STORAGE_KEY = "smoother-roads:v2";

interface Saved {
  voted: string[];
  submitted: Area[];
  comments: Record<string, AreaComment[]>;
}

interface PublishedArea {
  id: string;
  name: string;
  region: string;
  country: string;
  icao?: string;
  cat: Cat;
  noPhotogrammetry?: boolean;
  status?: Status; // Released unless set
  votes?: number;
  by?: string;
  package?: string;
  lat: number;
  lon: number;
  radiusKm: number;
  roadKm?: number; // Length of road in the pack
  perimeter?: LatLng[]; // Replaces the circle when a pack isn't round
  added: string;
  version?: string;
  spots?: { lat: number; lon: number; note: string; added: string }[];
}

function readSaved(): Saved {
  try {
    return { voted: [], submitted: [], comments: {}, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") };
  } catch {
    return { voted: [], submitted: [], comments: {} };
  }
}

// Votes, requests and comments stay in this browser until the database replaces this
export function saveLocal(areas: Area[]) {
  const saved: Saved = {
    voted: areas.filter((a) => a.voted).map((a) => a.id),
    submitted: areas.filter((a) => a.local).map((a) => ({ ...a, votes: 0, voted: false, comments: [] })),
    comments: {},
  };
  for (const a of areas) {
    const mine = a.comments.filter((c) => c.local);
    if (mine.length) saved.comments[a.id] = mine;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
  } catch {
    // Blocked storage or a full quota: the change still holds for this visit
  }
}

const dateOf = (added: string) => new Date(added + "T00:00:00").getTime();

function toArea(a: PublishedArea): Area {
  return {
    id: a.id,
    name: a.name,
    region: a.region,
    country: a.country,
    icao: a.icao ?? "",
    cat: a.cat,
    noPhotogrammetry: a.noPhotogrammetry,
    status: a.status ?? "released",
    votes: a.votes ?? 0,
    voted: false,
    by: a.by ?? "Smoother Roads",
    date: dateOf(a.added),
    notes: "",
    shape: a.perimeter
      ? { type: "polygon", points: a.perimeter }
      : { type: "circle", center: [a.lat, a.lon], radius: a.radiusKm * 1000 },
    comments: [],
    spots: a.spots?.map((s) => ({ pin: [s.lat, s.lon], note: s.note, date: dateOf(s.added) })),
    packageName: a.package,
    version: a.version,
    roadKm: a.roadKm,
  };
}

export async function loadAreas(withHidden = false): Promise<Area[]> {
  let published: Area[] = [];
  try {
    const res = await fetch(import.meta.env.BASE_URL + "areas.json", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    const data: { areas?: PublishedArea[] } = await res.json();
    published = (data.areas ?? []).filter((a) => isFinite(a.lat) && isFinite(a.lon) && a.radiusKm > 0).map(toArea);
  } catch {
    // Still show anything saved in this browser
  }

  if (CONFIG.database) {
    // Requests sent through the site; ones copied into areas.json by hand stay there too
    published = [...published, ...(await fetchRequests().catch(() => []))];
  }

  const saved = readSaved();
  if (CONFIG.votes) {
    // Shared totals replace the counts in areas.json; if they can't load, show none
    const { counts, mine } = await fetchVotes().catch(() => ({
      counts: new Map<string, number>(),
      mine: new Set<string>(),
    }));
    published = published.map((a) => ({ ...a, votes: counts.get(a.id) ?? 0, voted: mine.has(a.id) }));
  }
  if (CONFIG.database) {
    const [comments, statuses, photos] = await Promise.all([
      fetchComments().catch(() => new Map<string, AreaComment[]>()),
      fetchStatuses().catch(() => new Map<string, AreaOverride>()),
      CONFIG.photos ? fetchPhotos().catch(() => new Map<string, AreaPhoto[]>()) : new Map<string, AreaPhoto[]>(),
    ]);
    published = published
      .map((a) => ({
        ...a,
        status: statuses.get(a.id)?.status ?? a.status,
        hidden: statuses.get(a.id)?.hidden,
        noPhotogrammetry: statuses.get(a.id)?.noPhotogrammetry ?? a.noPhotogrammetry,
        comments: (comments.get(a.id) ?? []).filter((c) => withHidden || !c.hidden),
        photos: photos.get(a.id) ?? [],
      }))
      .filter((a) => withHidden || !a.hidden);
    saved.comments = {}; // Comments from before the database stayed in one browser
  }
  return [...published, ...saved.submitted].map((a) => {
    const voted = a.voted || saved.voted.includes(a.id);
    if (CONFIG.votes && !a.local) return { ...a, comments: [...a.comments, ...(saved.comments[a.id] ?? [])] };
    return {
      ...a,
      voted,
      votes: a.votes + (voted ? 1 : 0),
      comments: [...a.comments, ...(saved.comments[a.id] ?? [])],
    };
  });
}

function formParams(a: Area) {
  const f = CONFIG.formFields;
  const [lat, lon] = centerOf(a.shape);
  const notes = [`Category: ${CATS[a.cat].label}`];
  if (a.icao) notes.push(`Airport: ${a.icao}`);
  if (a.notes) notes.push(a.notes);
  if (a.shape.type === "polygon") notes.push(`Perimeter (lat,lon): ${JSON.stringify(a.shape.points)}`);

  const params = new URLSearchParams();
  params.set(f.place, [a.name, a.region].filter(Boolean).join(", "));
  params.set(f.lat, lat.toFixed(5));
  params.set(f.lon, lon.toFixed(5));
  params.set(f.radius, enclosingRadiusKm(a.shape).toFixed(1));
  params.set(f.notes, notes.join("\n"));
  return params;
}

// One spreadsheet row (tab-separated, quoted like Excel and Sheets copy it), with everything
// needed to build or update a pack: place, centre, radius, then the details in the last cell
export function areaRow(a: Area): string {
  const [lat, lon] = centerOf(a.shape);
  const place = [a.name, a.region, a.country].filter((v, i, all) => v && all.indexOf(v) === i).join(", ");
  const notes = [`Category: ${CATS[a.cat].label}`, `Status: ${a.status}`, `Votes: ${a.votes}`];
  if (a.icao) notes.push(`Airport: ${a.icao}`);
  if (a.packageName) notes.push(`Package: ${a.packageName}${a.version ? ` (${a.version})` : ""}`);
  if (a.noPhotogrammetry) notes.push("No photogrammetry");
  if (a.notes) notes.push(`Notes: ${a.notes}`);
  for (const s of a.spots ?? []) notes.push(`Problem spot ${s.pin[0].toFixed(5)}, ${s.pin[1].toFixed(5)}: ${s.note}`);
  if (a.shape.type === "polygon") notes.push(`Perimeter (lat,lon): ${JSON.stringify(a.shape.points)}`);
  const cell = (v: string) => (/[\t\n"]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [place, lat.toFixed(5), lon.toFixed(5), enclosingRadiusKm(a.shape).toFixed(1), notes.join("\n")]
    .map(cell)
    .join("\t");
}

function spotParams(a: Area, p: LatLng, note: string) {
  const f = CONFIG.formFields;
  const params = new URLSearchParams();
  params.set(f.place, "Problem spot: " + a.name);
  params.set(f.lat, p[0].toFixed(5));
  params.set(f.lon, p[1].toFixed(5));
  params.set(f.radius, "0");
  params.set(f.notes, note);
  return params;
}

export type SendResult = "sent" | "form-opened";

async function send(params: URLSearchParams): Promise<SendResult> {
  try {
    // Google Forms doesn't allow reading the response cross-origin, so a completed request counts as sent
    await fetch(CONFIG.formUrl.replace(/\/viewform.*$/, "/formResponse"), {
      method: "POST",
      mode: "no-cors",
      body: params,
    });
    return "sent";
  } catch {
    // Fall back to the pre-filled form so the request isn't lost
    params.set("usp", "pp_url");
    window.open(CONFIG.formUrl + "?" + params.toString(), "_blank", "noopener");
    return "form-opened";
  }
}

export const sendRequest = (a: Area) => send(formParams(a));
export const sendSpot = (a: Area, p: LatLng, note: string) => send(spotParams(a, p, note));
