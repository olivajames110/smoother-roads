import { useEffect, useState } from "react";
import logoFull from "../assets/logo-full.png";
import logo from "../assets/logo.jpg";
import { CONFIG } from "../lib/config";
import { useStore } from "../lib/store";
import { VOTES_LEFT_EVENT, votesLeftToday } from "../lib/workVotes";
import { AreaList } from "./AreaList";
import { DownloadMenu } from "./DownloadMenu";
import { HelpMenu } from "./HelpMenu";
import { HoverTip } from "./HoverTip";
import { Icon } from "./Icon";
import { SearchInput } from "./SearchInput";

// Opens the Vote page. Floats on the map under the road coverage card while the sidebar is collapsed (wide
// screens); otherwise the sidebar's Map / Vote / Leaderboards switch does this
export function VoteLink({ float }: { float?: boolean }) {
  const votePage = useStore((s) => s.votePage);
  const patch = useStore((s) => s.patch);
  return (
    <button
      className={"vote-link" + (float ? " vote-float" : "") + (votePage ? " on" : "")}
      onClick={() => patch({ votePage: !votePage, boardsPage: false, sidebarOpen: false })}
    >
      <span className="gl-ico">
        <Icon name="up" size={15} weight={2.2} />
      </span>
      <span className="vl-text">
        <b>Vote for what's next</b>
        <span>Cast 3 votes each day for what you want worked on.</span>
      </span>
      <Icon d='<path d="m9 6 6 6-6 6"/>' size={15} weight={2.4} />
    </button>
  );
}

// Opens the Leaderboards page (hill climb times). Sits under the floating Vote button.
export function BoardsLink({ float }: { float?: boolean }) {
  const boardsPage = useStore((s) => s.boardsPage);
  const patch = useStore((s) => s.patch);
  return (
    <button
      className={"vote-link boards-link" + (float ? " vote-float" : "") + (boardsPage ? " on" : "")}
      onClick={() => patch({ boardsPage: !boardsPage, votePage: false, sidebarOpen: false })}
    >
      <span className="gl-ico">
        <Icon d='<path d="M1.5 20.5 9 6l4.2 7.4L15.8 9l6.7 11.5z" fill="currentColor" stroke-linejoin="round"/>' size={15} />
      </span>
      <span className="vl-text">
        <b>Hill Climb leaderboards</b>
        <span>The fastest timed runs to the top.</span>
      </span>
      <Icon d='<path d="m9 6 6 6-6 6"/>' size={15} weight={2.4} />
    </button>
  );
}

export function Sidebar() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);
  const openSubmit = useStore((s) => s.openSubmit);
  const beginRequest = useStore((s) => s.beginRequest);
  const collapsed = useStore((s) => s.sidebarCollapsed);
  const patch = useStore((s) => s.patch);
  const votePage = useStore((s) => s.votePage);
  const boardsPage = useStore((s) => s.boardsPage);
  // votes left today, on the Vote tab: asked once, then kept current by the Vote page as votes are cast
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!CONFIG.votes) return;
    let live = true;
    votesLeftToday().then((n) => live && setLeft(n));
    const on = (e: Event) => setLeft((e as CustomEvent<number>).detail);
    window.addEventListener(VOTES_LEFT_EVENT, on);
    return () => {
      live = false;
      window.removeEventListener(VOTES_LEFT_EVENT, on);
    };
  }, []);

  return (
    <aside className="sidebar">
      <div className="sb-scroll">
        <div className="sb-sec sb-top">
          <div className="brand">
            <button className="sign" aria-label="View the logo" onClick={() => patch({ lightbox: logoFull })}>
              <div className="sign-in">
                <img src={logo} alt="" />
              </div>
            </button>
            <div className="wordmark">
              <span className="wm-1">Smoother</span>
              <span className="wm-2">Roads</span>
            </div>
            <div className="sb-actions">
              <DownloadMenu />
              <HelpMenu />
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
          {/* Map / Vote / Leaderboards: the two pages open over the map area */}
          {(CONFIG.votes || CONFIG.climbBoards) && (
            <nav className="seg full page-seg" aria-label="Pages">
              <button
                className={!votePage && !boardsPage ? "on" : ""}
                onClick={() => patch({ votePage: false, boardsPage: false, sidebarOpen: false })}
              >
                <Icon d='<path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5z"/><path d="M9 4v13.5M15 6.5V20"/>' size={15} />
                Map
              </button>
              {CONFIG.votes && (
                <button
                  className={votePage ? "on" : ""}
                  title={left ? `Vote for what's next: ${left} vote${left === 1 ? "" : "s"} left today` : "Vote for what's next"}
                  onClick={() => patch({ votePage: true, boardsPage: false, sidebarOpen: false })}
                >
                  <Icon name="up" size={15} weight={2.2} />
                  Vote
                  {left > 0 && <span className="seg-n">{left}</span>}
                </button>
              )}
              {CONFIG.climbBoards && (
                <button
                  className={boardsPage ? "on" : ""}
                  title="Hill Climb leaderboards"
                  onClick={() => patch({ boardsPage: true, votePage: false, sidebarOpen: false })}
                >
                  <Icon d='<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 6h3v2a3 3 0 0 1-3 3M7 6H4v2a3 3 0 0 0 3 3"/>' size={15} />
                  Leaderboards
                </button>
              )}
            </nav>
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
