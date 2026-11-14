import { create } from "zustand";
import { CONFIG } from "./config";
import { addComment, amAdmin, editReview, fetchMyReviews } from "./comments";
import { loadAreas, saveLocal, sendRequest, sendSpot } from "./data";
import { fetchLineIndex, fetchLines } from "./lines";
import { reorderPhotos, uploadPhoto } from "./photos";
import { addRequest } from "./requests";
import { setVote } from "./votes";
import { countryOf, norm } from "./format";
import { boundsOf, centerOf, contains, issueCount, shapeFromDraft } from "./geo";
import { reversePlace, searchPlace } from "./geocode";
import type { FilterKey } from "./icons";
import { addPoi, MAX_POINTS, updatePoi, type PoiDraft } from "./pois";
import type {
  Area,
  AreaComment,
  CommentDraft,
  Draft,
  FlyRequest,
  GroupBy,
  LatLng,
  SortBy,
  SubmitForm,
} from "./types";

export type View = "map" | "list";
export type PanelMode = "detail" | "submit" | null;

export const INTRO_KEY = "sr-request-intro-off";
// Tips a visitor can dismiss ("x" or "Don't show again"); Help > Show hidden tips brings them back
export const POI_TIP_KEY = "sr-poi-tip-off";
const LINES_KEY = "sr-show-lines";
const TIP_KEYS = [POI_TIP_KEY, INTRO_KEY];
const isOff = (key: string) => {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
};
// The list's filters and view, remembered in this browser
const HIDDEN_KEY = "sr-hidden-statuses";
const GROUP_KEY = "sr-group";
function readJson<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}
function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private window */
  }
}
// Saved chips from before "Unable" was split by reason: "unable" stands for all three
function readHidden() {
  const saved = readJson<string[]>(HIDDEN_KEY, []);
  const keys = saved.flatMap((k) =>
    k === "unable" ? ["unable:no-photogrammetry", "unable:alternative", "unable:tried"] : [k],
  );
  return new Set(keys as FilterKey[]);
}
// Which list sections are collapsed, remembered in this browser
const COLLAPSED_KEY = "sr-collapsed";
function saveCollapsed(c: Set<string>) {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...c]));
  } catch {
    /* private window */
  }
}
const newDraft = (): Draft => ({ type: "radius", center: null, radius: 3000, points: [], closed: false });
const newForm = (): SubmitForm => ({ name: "", region: "", icao: "", notes: "", cat: "city" });
const newComment = (): CommentDraft => ({ type: "feedback", text: "", image: null, pin: null, replyTo: null, rating: 0 });

let demoMode = false;
let flyNonce = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const voting = new Set<string>();
const linesInFlight = new Set<string>(); // smoothed-roads files being fetched

const NAME_KEY = "smoother-roads:name";
function savedName() {
  try {
    return localStorage.getItem(NAME_KEY) ?? "";
  } catch {
    return "";
  }
}

const persist = (areas: Area[]) => {
  if (!demoMode) saveLocal(areas);
};

interface Store {
  areas: Area[];
  loaded: boolean;
  admin: boolean;
  view: View;
  hidden: Set<FilterKey>; // Status chips switched off
  group: GroupBy;
  collapsed: Set<string>;
  query: string;
  sort: SortBy;
  selectedId: string | null;
  hoveredId: string | null;
  panel: PanelMode;
  draft: Draft;
  form: SubmitForm;
  placeQuery: string;
  placeNote: string;
  pinMode: boolean;
  comment: CommentDraft;
  myReviews: Set<string>; // ids of this browser's own reviews (it can change them)
  commenter: string;
  posting: boolean;
  spot: LatLng | null;
  spotNote: string;
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  lightbox: string | null;
  gallery: { areaId: string; index: number; pending: boolean } | null; // The full-screen photo viewer
  uploading: { done: number; total: number } | null;
  toast: string | null;
  toastFailed: boolean;
  fly: FlyRequest | null;
  requestIntro: (() => void) | null; // The "before you request" note is open; runs this on Proceed
  newsOpen: boolean; // The "what's new" note is open
  poiTipOff: boolean; // The Street GPS tip above places and routes was dismissed
  lineIndex: Record<string, number>; // Released areas with a smoothed-roads file: id -> road km
  showLines: boolean; // Draw smoothed roads: every released area in view, and the open one (remembered in this browser)
  roadLines: Record<string, LatLng[][]>; // Loaded smoothed roads, by area
  linesLoading: string | null; // The area whose roads are loading
  composeNonce: number; // Bumped to open the comment box (Report an issue)
  poiFocus: string | null; // The place or route picked in the panel (highlighted on the map)
  poiDraft: PoiDraft | null; // A place or route being suggested
  poiPick: boolean; // Map clicks add points to the suggestion (a place: its one point; a route: the next stop)

  init: (demo?: Area[]) => Promise<void>;
  adminAction: (job: () => Promise<unknown>, done: string) => Promise<void>;
  patch: (patch: Partial<Store>) => void;
  setForm: (patch: Partial<SubmitForm>) => void;
  setComment: (patch: Partial<CommentDraft>) => void;
  showToast: (message: string, failed?: boolean) => void;
  hideTip: (key: string) => void;
  setShowLines: (on: boolean) => void;
  loadLines: (id: string) => Promise<void>;
  tipsHidden: () => boolean;
  showTips: () => void;
  toggleStatus: (k: FilterKey) => void;
  setGroup: (g: GroupBy) => void;
  toggleGroup: (key: string) => void;
  setGroups: (keys: string[], shut: boolean) => void;
  setView: (v: View) => void;
  openDetail: (id: string) => void;
  closePanel: () => void;
  zoomTo: (a: Area) => void;
  flyToPoint: (p: LatLng, zoom?: number) => void;
  flyToBounds: (pts: LatLng[]) => void;
  toggleVote: (id: string) => void;
  postComment: () => Promise<void>;
  uploadPhotos: (files: File[]) => Promise<void>;
  movePhoto: (areaId: string, from: number, to: number) => Promise<void>;
  openSubmit: () => void;
  submitPoi: () => Promise<void>;
  beginRequest: (go: () => void) => void;
  requestAt: (p: LatLng, zoom: number) => void;
  setDrawType: (t: Draft["type"]) => void;
  setRadius: (metres: number) => void;
  onMapPoint: (p: LatLng) => void;
  undoPoint: () => void;
  clearDraft: () => void;
  finishPolygon: () => void;
  findPlace: () => Promise<void>;
  locate: () => void;
  submitArea: () => Promise<void>;
  submitSpot: () => Promise<void>;
}

export const useStore = create<Store>((set, get) => {
  // Fills in the name and region from the map, leaving anything already typed alone
  async function fillFromPoint(p: LatLng) {
    const { form } = get();
    if (form.name && form.region) return;
    try {
      const place = await reversePlace(p);
      if (!place || get().panel !== "submit") return;
      const now = get().form;
      set({ form: { ...now, name: now.name || place.name, region: now.region || place.region } });
    } catch {
      // The fields stay editable by hand
    }
  }

  const fly = (bounds: [LatLng, LatLng], maxZoom: number) => set({ fly: { bounds, maxZoom, nonce: ++flyNonce } });

  function placeCenter(p: LatLng) {
    set({ draft: { ...get().draft, center: p } });
    fillFromPoint(p);
  }

  return {
    areas: [],
    loaded: false,
    admin: false,
    view: "map",
    hidden: readHidden(),
    requestIntro: null,
    composeNonce: 0,
    newsOpen: false,
    poiTipOff: isOff(POI_TIP_KEY),
    lineIndex: {},
    showLines: readJson<boolean>(LINES_KEY, false),
    roadLines: {},
    linesLoading: null,
    poiFocus: null,
    poiDraft: null,
    poiPick: false,
    group: readJson<GroupBy>(GROUP_KEY, "country"),
    collapsed: (() => {
      try {
        return new Set<string>(JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]"));
      } catch {
        return new Set<string>();
      }
    })(),
    query: "",
    sort: "votes",
    selectedId: null,
    hoveredId: null,
    panel: null,
    draft: newDraft(),
    form: newForm(),
    placeQuery: "",
    placeNote: "",
    pinMode: false,
    comment: newComment(),
    myReviews: new Set(),
    commenter: savedName(),
    posting: false,
    spot: null,
    spotNote: "",
    sidebarOpen: false,
    sidebarCollapsed: false,
    lightbox: null,
    gallery: null,
    uploading: null,
    toast: null,
    toastFailed: false,
    fly: null,

    async init(demo) {
      demoMode = !!demo;
      // Signed in on ?admin: admin options show in the panel, and hidden items stay listed
      const admin = !demo && CONFIG.database && (await amAdmin().catch(() => false));
      set({ admin, areas: demo ?? (await loadAreas(admin)), loaded: true });
      if (!demo && CONFIG.database) fetchMyReviews().then((myReviews) => set({ myReviews }), () => {});
      fetchLineIndex().then((lineIndex) => {
        set({ lineIndex });
        const id = get().selectedId;
        if (get().showLines && id) get().loadLines(id);
      });
    },

    async adminAction(job, done) {
      try {
        await job();
        const admin = await amAdmin().catch(() => false);
        set({ admin, areas: await loadAreas(admin) });
        get().showToast(done);
      } catch (e) {
        get().showToast((e as Error).message || "That didn't work", true);
      }
    },

    patch: (patch) => set(patch),
    setForm: (patch) => set({ form: { ...get().form, ...patch } }),
    setComment: (patch) => set({ comment: { ...get().comment, ...patch } }),

    setShowLines(on) {
      writeJson(LINES_KEY, on);
      set({ showLines: on });
      const id = get().selectedId;
      if (on && id) get().loadLines(id);
    },

    async loadLines(id) {
      const { roadLines, lineIndex } = get();
      if (roadLines[id] || !(id in lineIndex) || linesInFlight.has(id)) return;
      linesInFlight.add(id);
      set({ linesLoading: id });
      try {
        const lines = await fetchLines(id);
        set({ roadLines: { ...get().roadLines, [id]: lines } });
      } catch {
        get().showToast("Couldn't load the smoothed roads", true);
      } finally {
        linesInFlight.delete(id);
        if (get().linesLoading === id) set({ linesLoading: null });
      }
    },

    hideTip(key) {
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* private window: hidden for now */
      }
      if (key === POI_TIP_KEY) set({ poiTipOff: true });
    },

    tipsHidden: () => get().poiTipOff || TIP_KEYS.some(isOff),

    showTips() {
      for (const k of TIP_KEYS) {
        try {
          localStorage.removeItem(k);
        } catch {
          /* private window */
        }
      }
      set({ poiTipOff: false });
      get().showToast("Hidden tips are back on");
    },

    showToast(message, failed = false) {
      clearTimeout(toastTimer);
      set({ toast: message, toastFailed: failed });
      toastTimer = setTimeout(() => set({ toast: null }), 3200);
    },

    toggleStatus(s) {
      const hidden = new Set(get().hidden);
      if (!hidden.delete(s)) hidden.add(s);
      writeJson(HIDDEN_KEY, [...hidden]);
      set({ hidden });
    },

    setGroup(group) {
      writeJson(GROUP_KEY, group);
      set({ group });
    },

    toggleGroup(key) {
      const collapsed = new Set(get().collapsed);
      if (!collapsed.delete(key)) collapsed.add(key);
      saveCollapsed(collapsed);
      set({ collapsed });
    },

    setGroups(keys, shut) {
      const collapsed = new Set(get().collapsed);
      for (const k of keys) {
        if (shut) collapsed.add(k);
        else collapsed.delete(k);
      }
      saveCollapsed(collapsed);
      set({ collapsed });
    },

    setView: (view) => set({ view, sidebarOpen: false }),

    openDetail(id) {
      const area = get().areas.find((a) => a.id === id);
      if (!area) return;
      set({
        view: "map",
        panel: "detail",
        selectedId: id,
        pinMode: false,
        comment: newComment(),
        spot: null,
        spotNote: "",
        sidebarOpen: false,
        poiFocus: null,
        poiDraft: null,
        poiPick: false,
      });
      get().zoomTo(area);
      if (get().showLines) get().loadLines(id);
    },

    closePanel: () =>
      set({ panel: null, selectedId: null, pinMode: false, spot: null, spotNote: "", poiDraft: null, poiPick: false }),

    zoomTo: (a) => fly(boundsOf(a.shape), 13),
    flyToPoint: (p, zoom = 16) => fly([p, p], zoom),
    flyToBounds: (pts) => {
      if (!pts.length) return;
      const la = pts.map((p) => p[0]);
      const lo = pts.map((p) => p[1]);
      fly([[Math.min(...la), Math.min(...lo)], [Math.max(...la), Math.max(...lo)]], 16);
    },

    toggleVote(id) {
      const area = get().areas.find((a) => a.id === id);
      if (!area || voting.has(id)) return;
      const flip = (a: Area): Area =>
        a.id === id ? { ...a, voted: !a.voted, votes: a.votes + (a.voted ? -1 : 1) } : a;
      const areas = get().areas.map(flip);
      set({ areas });
      if (demoMode || area.local || !CONFIG.votes) {
        persist(areas);
        return;
      }
      // Shown right away, undone if the database refuses it
      voting.add(id);
      setVote(id, !area.voted)
        .catch(() => {
          set({ areas: get().areas.map(flip) });
          get().showToast("Couldn't save your vote. Please try again.", true);
        })
        .finally(() => voting.delete(id));
    },

    async postComment() {
      const { comment, selectedId, areas, commenter, posting } = get();
      const text = comment.text.trim();
      const review = comment.type === "review";
      if ((review ? !comment.rating : !text) || !selectedId || posting) return;
      if (CONFIG.database && !demoMode) {
        const author = commenter.trim().slice(0, 40) || (get().admin ? "Jim" : "Anonymous");
        // A visitor has one review per area: posting again changes it
        const mine = review
          ? areas.find((a) => a.id === selectedId)?.comments.find((c) => c.type === "review" && get().myReviews.has(c.id))
          : undefined;
        set({ posting: true });
        try {
          if (mine) {
            await editReview(mine.id, comment.rating, text, author);
            const changed = { ...mine, rating: comment.rating, text, author, date: Date.now() };
            set({
              areas: get().areas.map((a) =>
                a.id === selectedId ? { ...a, comments: a.comments.map((c) => (c.id === mine.id ? changed : c)) } : a,
              ),
              comment: newComment(),
              pinMode: false,
            });
          } else {
            const saved = await addComment(
              selectedId,
              author,
              comment.type,
              text,
              comment.pin,
              comment.replyTo ?? undefined,
              review ? comment.rating : undefined,
            );
            set({
              areas: get().areas.map((a) => (a.id === selectedId ? { ...a, comments: [...a.comments, saved] } : a)),
              comment: newComment(),
              pinMode: false,
              myReviews: review ? new Set([...get().myReviews, saved.id]) : get().myReviews,
            });
          }
          try {
            localStorage.setItem(NAME_KEY, commenter.trim());
          } catch {
            // Only means the name isn't remembered
          }
          get().showToast(mine ? "Review updated" : review ? "Thanks for your review" : "Comment posted");
        } catch (e) {
          const m = String((e as Error).message);
          get().showToast(
            m.includes("rate_limited")
              ? "You're posting quite fast. Please try again later."
              : m.includes("one_review") || m.includes("duplicate")
                ? "You've already reviewed this area."
                : m.includes("not_released")
                  ? "Only released areas can be reviewed."
                  : get().admin && review && (m.includes("type_check") || m.includes("rating"))
                    ? "Run supabase/021_area_reviews.sql in Supabase first"
                    : get().admin && m.includes("type_check")
                      ? "Run supabase/013_improve_comments.sql in Supabase first"
                      : "Couldn't post your comment. Please try again.",
            true,
          );
        } finally {
          set({ posting: false });
        }
        return;
      }
      const posted: AreaComment = {
        id: crypto.randomUUID(),
        author: "You",
        type: comment.type,
        text,
        rating: review ? comment.rating : undefined,
        image: comment.image ?? undefined,
        pin: comment.pin ?? undefined,
        date: Date.now(),
        local: true,
      };
      const next = areas.map((a) => (a.id === selectedId ? { ...a, comments: [...a.comments, posted] } : a));
      set({ areas: next, comment: newComment(), pinMode: false });
      persist(next);
      get().showToast("Comment posted");
    },

    async uploadPhotos(files) {
      const { selectedId, uploading, commenter, admin } = get();
      if (!selectedId || uploading || !files.length) return;
      if (demoMode || !CONFIG.database) {
        get().showToast("Photo uploads aren't available here.", true);
        return;
      }
      const author = commenter.trim().slice(0, 40) || (admin ? "Jim" : "Anonymous");
      let sent = 0;
      let failure = "";
      set({ uploading: { done: 0, total: files.length } });
      for (const file of files) {
        try {
          await uploadPhoto(selectedId, file, author);
          sent++;
        } catch (e) {
          const msg = String((e as Error).message);
          failure = msg.includes("not_image")
            ? "That file isn't an image the browser can read."
            : msg.includes("rate_limited") || msg.toLowerCase().includes("row-level security")
              ? "You've uploaded a lot of photos. Please try again later."
              : "Couldn't upload your photo. Please try again.";
          if (!msg.includes("not_image")) break; // Limits and outages fail the rest too
        }
        set({ uploading: { done: sent, total: files.length } });
      }
      set({ uploading: null });
      if (sent && admin) set({ areas: await loadAreas(true) });
      if (failure) get().showToast(failure, true);
      else if (admin) get().showToast(sent === 1 ? "Photo added" : `${sent} photos added`);
      else get().showToast(sent === 1 ? "Thanks! Your photo will show once it's approved." : "Thanks! Your photos will show once they're approved.");
    },

    // The admin's drag and drop: shown right away, put back if the database refuses it
    async movePhoto(areaId, from, to) {
      const area = get().areas.find((a) => a.id === areaId);
      if (!area?.photos || from === to) return;
      const shown = area.photos.filter((p) => p.approved);
      const waiting = area.photos.filter((p) => !p.approved);
      const [moved] = shown.splice(from, 1);
      if (!moved) return;
      shown.splice(to, 0, moved);
      const photos = [...shown, ...waiting];
      set({ areas: get().areas.map((a) => (a.id === areaId ? { ...a, photos } : a)) });
      try {
        await reorderPhotos(areaId, photos.map((p) => p.id));
      } catch {
        get().showToast("Couldn't save the new order", true);
        set({ areas: await loadAreas(get().admin) });
      }
    },

    openSubmit: () =>
      set({
        view: "map",
        panel: "submit",
        selectedId: null,
        pinMode: false,
        spot: null,
        spotNote: "",
        draft: newDraft(),
        form: newForm(),
        placeQuery: "",
        placeNote: "",
        sidebarOpen: false,
      }),

    // Every new request first shows the "before you request" note, unless it was dismissed for good
    beginRequest(go) {
      let skip = false;
      try {
        skip = localStorage.getItem(INTRO_KEY) === "1";
      } catch {
        /* private window: show it */
      }
      if (skip) go();
      else set({ requestIntro: go });
    },

    // Same result as opening the form and clicking the map, kept in view beside the panel
    requestAt(p, zoom) {
      get().beginRequest(() => {
        get().openSubmit();
        get().onMapPoint(p);
        get().flyToPoint(p, zoom);
      });
    },

    async submitPoi() {
      const { poiDraft: d, selectedId, commenter, admin } = get();
      if (!d || !selectedId || !d.name.trim() || d.points.length < (d.kind === "route" ? 2 : 1)) return;
      set({ posting: true });
      try {
        if (d.id) await updatePoi(d);
        else await addPoi(selectedId, d, admin ? commenter || "Smoother Roads" : commenter);
        set({ poiDraft: null, poiPick: false, areas: await loadAreas(admin) });
        get().showToast(d.id ? "Saved" : admin ? "Added" : "Thanks! It'll show once it's approved.");
      } catch (e) {
        const m = String((e as Error).message);
        get().showToast(
          m.includes("rate_limited")
            ? "You've suggested a lot already. Please try again later."
            : admin && m.includes("time_of_day")
              ? "Run supabase/018_route_time.sql in Supabase first"
              : admin && m.includes("via")
              ? "Run supabase/017_route_stops.sql in Supabase first"
              : admin && m.includes("area_pois")
                ? "Run supabase/016_suggest_pois.sql in Supabase first"
              : "Couldn't send it. Please try again.",
          true,
        );
      } finally {
        set({ posting: false });
      }
    },

    setDrawType: (type) => set({ draft: { ...get().draft, type } }),
    setRadius: (radius) => set({ draft: { ...get().draft, radius } }),

    onMapPoint(p) {
      const { pinMode, panel, draft, poiPick, poiDraft } = get();
      if (poiPick && poiDraft) {
        // every point inside the area's coverage: the GPS only sends people onto smoothed roads
        const area = get().areas.find((a) => a.id === get().selectedId);
        if (area && !contains(area.shape, p)) {
          get().showToast("That's outside this area's coverage. Pick a spot inside the outline.", true);
          return;
        }
        // a place has one point (picking ends); a route keeps adding stops until Done
        if (poiDraft.kind === "place") set({ poiDraft: { ...poiDraft, points: [p] }, poiPick: false });
        else {
          const points = [...poiDraft.points, p].slice(0, MAX_POINTS);
          set({ poiDraft: { ...poiDraft, points }, poiPick: points.length < MAX_POINTS });
        }
        return;
      }
      if (pinMode) {
        set(CONFIG.database ? { pinMode: false, comment: { ...get().comment, pin: p } } : { pinMode: false, spot: p });
        return;
      }
      if (panel !== "submit") return;
      if (draft.type === "radius") placeCenter(p);
      else if (!draft.closed) set({ draft: { ...draft, points: [...draft.points, p] } });
    },

    undoPoint() {
      const { draft } = get();
      set({ draft: { ...draft, points: draft.points.slice(0, -1), closed: false } });
    },

    clearDraft() {
      const { draft } = get();
      set({ draft: { ...draft, points: [], closed: false } });
    },

    finishPolygon() {
      const { draft } = get();
      if (draft.points.length < 3) return;
      set({ draft: { ...draft, closed: true } });
      fillFromPoint(centerOf({ type: "polygon", points: draft.points }));
    },

    async findPlace() {
      const q = get().placeQuery.trim();
      if (!q) return;
      set({ placeNote: "Searching…" });
      try {
        const place = await searchPlace(q);
        if (!place) {
          set({ placeNote: `No place found for "${q}". Try a nearby city.` });
          return;
        }
        const { form, draft } = get();
        set({
          placeNote: "",
          form: { ...form, name: place.name, region: place.region },
          draft: draft.type === "radius" ? { ...draft, center: place.point } : draft,
        });
        fly([place.point, place.point], 12);
      } catch {
        set({ placeNote: "Search isn't available right now. Click the map instead." });
      }
    },

    locate() {
      if (!navigator.geolocation) {
        set({ placeNote: "Your browser can't share its location." });
        return;
      }
      set({ placeNote: "Finding your location…" });
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p: LatLng = [pos.coords.latitude, pos.coords.longitude];
          set({ placeNote: "" });
          if (get().draft.type === "radius") placeCenter(p);
          fly([p, p], 12);
        },
        () => set({ placeNote: "Couldn't get your location. Search or click the map instead." }),
        { enableHighAccuracy: false, timeout: 10000 },
      );
    },

    async submitArea() {
      const { draft, form, areas, posting } = get();
      const shape = shapeFromDraft(draft);
      const name = form.name.trim();
      if (!shape || !name || posting) return;
      const region = form.region.trim();
      const area: Area = {
        id: crypto.randomUUID(),
        name,
        region,
        country: countryOf(region),
        icao: form.icao,
        cat: form.cat,
        status: "requested",
        votes: 0,
        voted: false,
        by: "You",
        date: Date.now(),
        notes: form.notes.trim(),
        shape,
        comments: [],
        local: true,
      };
      if (CONFIG.database && !demoMode) {
        set({ posting: true });
        try {
          const saved = await addRequest(area);
          set({ areas: [saved, ...get().areas], draft: newDraft(), form: newForm() });
          get().openDetail(saved.id);
          get().showToast("Area requested. Thanks!");
          sendRequest(saved); // A copy for the Google Form's spreadsheet
        } catch (e) {
          get().showToast(
            String((e as Error).message).includes("rate_limited")
              ? "You've sent a lot of requests. Please try again later."
              : "Couldn't send your request. Please try again.",
            true,
          );
        } finally {
          set({ posting: false });
        }
        return;
      }
      const next = [area, ...areas];
      set({ areas: next, draft: newDraft(), form: newForm() });
      persist(next);
      get().openDetail(area.id);
      const sent = demoMode ? "sent" : await sendRequest(area);
      get().showToast(
        sent === "sent" ? "Area requested. Thanks!" : "Couldn't send directly, so the form opened. Press Submit there.",
        sent !== "sent",
      );
    },

    async submitSpot() {
      const { spot, spotNote, selectedId, areas } = get();
      const area = areas.find((a) => a.id === selectedId);
      if (!spot || !area) return;
      set({ spot: null, spotNote: "" });
      const sent = demoMode ? "sent" : await sendSpot(area, spot, spotNote.trim());
      get().showToast(
        sent === "sent" ? "Problem spot sent. Thanks!" : "Couldn't send directly, so the form opened. Press Submit there.",
        sent !== "sent",
      );
    },
  };
});

export const coveredBy = (areas: Area[], p: LatLng) =>
  areas.find((a) => a.status === "released" && contains(a.shape, p));

export function matches(a: Area, q: string) {
  const n = norm(q.trim());
  return !n || [a.name, a.region, a.icao, a.country].some((s) => norm(s).includes(n));
}

export const SORTS: Record<SortBy, (a: Area, b: Area) => number> = {
  votes: (a, b) => b.votes - a.votes,
  new: (a, b) => b.date - a.date,
  old: (a, b) => a.date - b.date,
  issues: (a, b) => issueCount(b) - issueCount(a) || b.votes - a.votes,
};
