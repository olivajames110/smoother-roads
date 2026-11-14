import { useEffect } from "react";
import { signOut } from "./lib/comments";
import { CONFIG } from "./lib/config";
import { Icon } from "./components/Icon";
import { Leaderboard } from "./components/Leaderboard";
import { Legend } from "./components/Legend";
import { MapHint } from "./components/MapHint";
import { MapView } from "./components/MapView";
import { Gallery, Lightbox, Toast } from "./components/Overlays";
import { Panel } from "./components/Panel";
import { RequestIntro } from "./components/RequestIntro";
import { WhatsNew } from "./components/WhatsNew";
import { Sidebar } from "./components/Sidebar";
import { useStore } from "./lib/store";

export function App() {
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const sidebarCollapsed = useStore((s) => s.sidebarCollapsed);
  const patch = useStore((s) => s.patch);
  const openSubmit = useStore((s) => s.openSubmit);
  const beginRequest = useStore((s) => s.beginRequest);
  const admin = useStore((s) => s.admin);
  const adminAction = useStore((s) => s.adminAction);

  useEffect(() => {
    const { init } = useStore.getState();
    // Add ?demo to the local dev URL for sample data. It never ships in the production build.
    if (import.meta.env.DEV && new URLSearchParams(location.search).has("demo")) {
      import("./lib/demo").then((m) => init(m.demoAreas()));
    } else {
      // ?area=<id> (links from the vote page): open that area once the areas are in
      const id = new URLSearchParams(location.search).get("area");
      init().then(() => {
        if (id && useStore.getState().areas.some((a) => a.id === id)) useStore.getState().openDetail(id);
      });
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const s = useStore.getState();
      if (s.lightbox) s.patch({ lightbox: null });
      else if (s.pinMode) s.patch({ pinMode: false });
      else if (s.poiPick) s.patch({ poiPick: false });
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
            <div className="map-wrap">
              <MapView />
              <Legend />
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
    </div>
  );
}
