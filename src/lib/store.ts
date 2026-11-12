import { create } from "zustand";
import { CONFIG } from "./config";
import { addComment, amAdmin } from "./comments";
import { loadAreas, saveLocal, sendRequest, sendSpot } from "./data";
import { reorderPhotos, uploadPhoto } from "./photos";
import { addRequest } from "./requests";
import { setVote } from "./votes";
import { countryOf, norm } from "./format";
import { boundsOf, centerOf, contains, issueCount, shapeFromDraft } from "./geo";
import { reversePlace, searchPlace } from "./geocode";
import type {
  Area,
  AreaComment,
  CommentDraft,
  Draft,
  FlyRequest,
  GroupBy,
  LatLng,
  SortBy,
  Status,
  SubmitForm,
} from "./types";

export type View = "map" | "list";
export type PanelMode = "detail" | "submit" | null;

export const INTRO_KEY = "sr-request-intro-off";
const PHOTO_KEY = "sr-photo-only";
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
const newComment = (): CommentDraft => ({ type: "feedback", text: "", image: null, pin: null, replyTo: null });

let demoMode = false;
let flyNonce = 0;
let toastTimer: ReturnType<typeof setTimeout> | undefined;
const voting = new Set<string>();

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
  hidden: Set<Status>;
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
  photoOnly: boolean; // Only photogrammetry areas on the map and in the list
  composeNonce: number; // Bumped to open the comment box (Report an issue)

  init: (demo?: Area[]) => Promise<void>;
  adminAction: (job: () => Promise<unknown>, done: string) => Promise<void>;
  patch: (patch: Partial<Store>) => void;
  setForm: (patch: Partial<SubmitForm>) => void;
  setComment: (patch: Partial<CommentDraft>) => void;
  showToast: (message: string, failed?: boolean) => void;
  toggleStatus: (s: Status) => void;
  setPhotoOnly: (on: boolean) => void;
  toggleGroup: (key: string) => void;
  setGroups: (keys: string[], shut: boolean) => void;
  setView: (v: View) => void;
  openDetail: (id: string) => void;
  closePanel: () => void;
  zoomTo: (a: Area) => void;
  flyToPoint: (p: LatLng, zoom?: number) => void;
  toggleVote: (id: string) => void;
  postComment: () => Promise<void>;
  uploadPhotos: (files: File[]) => Promise<void>;
  movePhoto: (areaId: string, from: number, to: number) => Promise<void>;
  openSubmit: () => void;
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
    hidden: new Set(),
    requestIntro: null,
    composeNonce: 0,
    photoOnly: (() => {
      try {
        return localStorage.getItem(PHOTO_KEY) === "1";
      } catch {
        return false;
      }
    })(),
    group: "country",
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

    showToast(message, failed = false) {
      clearTimeout(toastTimer);
      set({ toast: message, toastFailed: failed });
      toastTimer = setTimeout(() => set({ toast: null }), 3200);
    },

    setPhotoOnly(on) {
      set({ photoOnly: on });
      try {
        localStorage.setItem(PHOTO_KEY, on ? "1" : "0");
      } catch {
        /* private window */
      }
    },

    toggleStatus(s) {
      const hidden = new Set(get().hidden);
      if (!hidden.delete(s)) hidden.add(s);
      set({ hidden });
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
      });
      get().zoomTo(area);
    },

    closePanel: () => set({ panel: null, selectedId: null, pinMode: false, spot: null, spotNote: "" }),

    zoomTo: (a) => fly(boundsOf(a.shape), 13),
    flyToPoint: (p, zoom = 16) => fly([p, p], zoom),

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
      if (!text || !selectedId || posting) return;
      if (CONFIG.database && !demoMode) {
        const author = commenter.trim().slice(0, 40) || (get().admin ? "Jim" : "Anonymous");
        set({ posting: true });
        try {
          const saved = await addComment(selectedId, author, comment.type, text, comment.pin, comment.replyTo ?? undefined);
          set({
            areas: get().areas.map((a) => (a.id === selectedId ? { ...a, comments: [...a.comments, saved] } : a)),
            comment: newComment(),
            pinMode: false,
          });
          try {
            localStorage.setItem(NAME_KEY, commenter.trim());
          } catch {
            // Only means the name isn't remembered
          }
          get().showToast("Comment posted");
        } catch (e) {
          get().showToast(
            String((e as Error).message).includes("rate_limited")
              ? "You're posting quite fast. Please try again later."
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

    setDrawType: (type) => set({ draft: { ...get().draft, type } }),
    setRadius: (radius) => set({ draft: { ...get().draft, radius } }),

    onMapPoint(p) {
      const { pinMode, panel, draft } = get();
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
