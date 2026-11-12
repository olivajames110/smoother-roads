import logo from "../assets/logo.jpg";
import { CONFIG } from "../lib/config";
import { useStore } from "../lib/store";
import { AreaList } from "./AreaList";
import { HoverTip } from "./HoverTip";
import { Icon } from "./Icon";
import { SearchInput } from "./SearchInput";

export function Sidebar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const openSubmit = useStore((s) => s.openSubmit);
  const beginRequest = useStore((s) => s.beginRequest);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const patch = useStore((s) => s.patch);

  return (
    <aside className="sidebar">
      <div className="sb-scroll">
        <div className="sb-sec sb-top">
          <div className="brand">
            <div className="sign" aria-hidden="true">
              <div className="sign-in">
                <img src={logo} alt="" />
              </div>
            </div>
            <div className="wordmark">
              <span className="wm-1">Smoother</span>
              <span className="wm-2">Roads</span>
            </div>
            <div className="sb-actions">
              <HoverTip
                className="ibtn-tip sb-toggle"
                tip={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                place="below"
              >
                <button
                  className="ibtn"
                  aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                  aria-expanded={!collapsed}
                  onClick={() => patch({ sidebarCollapsed: !collapsed })}
                >
                  <Icon d='<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>' size={18} />
                </button>
              </HoverTip>
            </div>
          </div>
          {(CONFIG.downloadUrl || CONFIG.gpsUrl) && (
            <div className="get-links">
              <div className="get-row">
                {CONFIG.downloadUrl && (
                  <a className="get-link" href={CONFIG.downloadUrl} target="_blank" rel="noopener"
                     title="Smoother Roads on flightsim.to">
                    <span className="gl-ico">
                      <Icon d='<path d="M4 21 9 3M20 21 15 3M12 5v2.5M12 10.5V13M12 16v3"/>' size={15} weight={2.2} />
                    </span>
                    <span className="gl-name">Smoother Roads</span>
                    <span className="gl-dl">
                      <Icon d='<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>' size={14} weight={2.2} />
                    </span>
                  </a>
                )}
                {CONFIG.gpsUrl && (
                  <a className="get-link" href={CONFIG.gpsUrl} target="_blank" rel="noopener"
                     title="Street GPS on flightsim.to">
                    <span className="gl-ico">
                      <Icon d='<path d="M3 11 21 3l-8 18-2-8z"/>' size={15} weight={2.2} />
                    </span>
                    <span className="gl-name">Street GPS</span>
                    <span className="gl-dl">
                      <Icon d='<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>' size={14} weight={2.2} />
                    </span>
                  </a>
                )}
              </div>
            </div>
          )}
          <div className="search-add">
            <SearchInput placeholder="Search city, region or country" />
            <HoverTip className="ibtn-tip" tip="Request an area (or right-click the map)" place="below">
              <button className="add-btn" aria-label="Request an area" onClick={() => beginRequest(openSubmit)}>
                <Icon d='<path d="M12 5v14M5 12h14"/>' size={18} weight={2.6} />
              </button>
            </HoverTip>
          </div>
          {CONFIG.leaderboard && (
            <nav className="seg full">
              <button className={view === "map" ? "on" : ""} onClick={() => setView("map")}>
                <Icon d='<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>' size={15} />
                Map
              </button>
              <button className={view === "list" ? "on" : ""} onClick={() => setView("list")}>
                <Icon d='<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3"/>' size={15} />
                Leaderboard
              </button>
            </nav>
          )}
        </div>
        <div className="sb-sec">
          <AreaList />
        </div>
      </div>
    </aside>
  );
}
