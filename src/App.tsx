import { useEffect } from "react";
import { signOut } from "./lib/comments";
import { CONFIG } from "./lib/config";
import { AreaPage } from "./components/AreaPage";
import { Icon } from "./components/Icon";
import { Leaderboard } from "./components/Leaderboard";
import { Legend } from "./components/Legend";
import { MapHint } from "./components/MapHint";
import { MapView } from "./components/MapView";
import { Gallery, Lightbox, Toast } from "./components/Overlays";
import { Panel } from "./components/Panel";
import { RequestIntro } from "./components/RequestIntro";
import { WhatsNew } from "./components/WhatsNew";
import { Visitors } from "./components/Visitors";
import { VotePage } from "./components/VotePage";
import { Sidebar, VoteLink } from "./components/Sidebar";
import { areaFromPath, isVotePath, syncPath, syncVote } from "./lib/slug";
import { useStore } from "./lib/store";

export function App() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const patch = useStore((s) => s.patch);
  const openSubmit = useStore((s) => s.openSubmit);
  const beginRequest = useStore((s) => s.beginRequest);
  const admin = useStore((s) => s.admin);
  const adminAction = useStore((s) => s.adminAction);
  // "More info": the open area as a full page over the map area
  const full = useStore((s) => s.full && s.panel === "detail" && !!s.selectedId);
  const votePage = useStore((s) => s.votePage);

  useEffect(() => {
    const { init } = useStore.getState();
    // Add ?demo to the local dev URL for sample data. It never ships in the production build.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo")) {
      import("./lib/demo").then((m) => init(m.demoAreas()));
    } else {
      // /smoother-roads/<slug or id>, or ?area=<id> (older links): open that area once the areas are in
      const id = new URLSearchParams(location.search).get("area");
      init().then(() => {
        const { areas, openDetail } = useStore.getState();
        const area = areaFromPath(areas) ?? areas.find((a) => a.id === id);
        if (isVotePath()) useStore.getState().patch({ votePage: true }); // /smoother-roads/vote
        else if (area) openDetail(area.id);
        else syncPath(undefined, areas, false);
      });
    }
  }, []);

  // The address bar follows the open area; Back / Forward open or close areas
  useEffect(() => {
    const unsub = useStore.subscribe((s, prev) => {
      if (!s.areas.length) return;
      // the Vote page has its own address; leaving it for an area goes to that area's address
      if (s.votePage !== prev.votePage && (s.votePage || !s.selectedId)) syncVote(s.votePage, true);
      if (s.votePage || (s.selectedId === prev.selectedId && s.votePage === prev.votePage)) return;
      if (s.votePage !== prev.votePage && !s.selectedId) return;
      syncPath(s.areas.find((a) => a.id === s.selectedId), s.areas, true);
    });
    const onPop = () => {
      const s = useStore.getState();
      const area = areaFromPath(s.areas);
      if (isVotePath() !== s.votePage) s.patch({ votePage: isVotePath() });
      if (isVotePath()) return;
      if (area && area.id !== s.selectedId) s.openDetail(area.id);
      else if (!area && s.selectedId) s.closePanel();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      unsub();
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = useStore.getState();
      if (s.lightbox) s.patch({ lightbox: null });
      else if (s.pinMode) s.patch({ pinMode: false });
      else if (s.routeMode) s.patch({ routeMode: false });
      else if (s.poiPick) s.patch({ poiPick: false });
      else if (s.votePage) s.patch({ votePage: false });
      else if (s.full && s.panel === "detail") s.patch({ full: false });
      else if (s.panel) s.closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="device">
      <div className="app-shell">
        <main className="main">
          <section className={"view map-view" + (sidebarOpen ? " sb-toggled" : "") + (sidebarCollapsed ? " sb-collapsed" : "")}>
            <Sidebar />
            <div className="scrim" onClick={() => patch({ sidebarOpen: false })} />
            <div className={"map-wrap" + (full ? " full" : "")}>
              <MapView />
              {full && <AreaPage />}
              {votePage && <VotePage />}
              <Legend />
              {CONFIG.votes && <VoteLink float />}
              <Panel />
              <MapHint />
              <button className="fab fab-menu" title="Open list" onClick={() => patch({ sidebarOpen: true })}>
                <Icon d='<path d="M4 6h16M4 12h16M4 18h16"/>' size={18} weight={2.2} />
              </button>
              <button className="fab fab-submit" title="Request Area" onClick={() => beginRequest(openSubmit)}>
                <Icon d='<path d="M12 5v14M5 12h14"/>' size={16} weight={2.6} />
              </button>
              {admin && (
                <div className="dev-bar dev-float">
                  <span className="dev">DEV</span>
                  <span className="grow">Signed in as the dev</span>
                  <button onClick={() => patch({ visitsOpen: true })}>Visitors</button>
                  <a href={import.meta.env.BASE_URL + "?admin"}>Admin page</a>
                  <button onClick={() => adminAction(signOut, "Signed out")}>Sign out</button>
                </div>
              )}
              {CONFIG.leaderboard && <Leaderboard />}
            </div>
          </section>
        </main>
      </div>
      <Lightbox />
      <Gallery />
      <Toast />
      <RequestIntro />
      <WhatsNew />
      <Visitors />
    </div>
  );
}
