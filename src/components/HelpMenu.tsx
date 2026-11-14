import { useEffect, useRef, useState } from "react";
import { CONFIG } from "../lib/config";
import { useStore } from "../lib/store";
import { HoverTip } from "./HoverTip";
import { Icon } from "./Icon";

const HELP = '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.2a2.6 2.6 0 0 1 5 .9c0 1.7-2.5 2.3-2.5 3.9"/><path d="M12 17.2h.01"/>';
const SPARK = '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>';
const AREA = '<circle cx="12" cy="12" r="8" stroke-dasharray="3 2.5"/><path d="M12 9v6M9 12h6"/>';
const DOWN = '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>';
const NAV = '<path d="M3 11 21 3l-8 18-2-8z"/>';
const MAIL = '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>';

// The ? next to Collapse: reopens the site's notes (what's new, before you request) and links
export function HelpMenu() {
  const patch = useStore((s) => s.patch);
  const tipsHidden = useStore((s) => s.tipsHidden);
  const showTips = useStore((s) => s.showTips);
  useStore((s) => s.poiTipOff); // re-render when a tip is hidden or shown
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const open = !!at;

  // fixed to the screen, so the sidebar (even collapsed) never clips it
  const toggle = () => {
    if (open) return setAt(null);
    const r = btn.current!.getBoundingClientRect();
    const width = 320;
    setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8)) });
  };

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!pop.current?.contains(t) && !btn.current?.contains(t)) setAt(null);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAt(null);
    const shut = () => setAt(null);
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", esc);
    window.addEventListener("resize", shut);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", esc);
      window.removeEventListener("resize", shut);
    };
  }, [open]);

  const run = (job: () => void) => {
    setAt(null);
    job();
  };

  return (
    <>
      <HoverTip className="ibtn-tip" tip="Help" place="below">
        <button
          ref={btn}
          className={"ibtn" + (open ? " active" : "")}
          aria-label="Help"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
        >
          <Icon d={HELP} size={18} />
        </button>
      </HoverTip>
      {at && (
        <div ref={pop} className="pop help-pop" role="menu" style={{ top: at.top, left: at.left }}>
          <div className="pop-label">Help</div>
          <button role="menuitem" className="pop-item" onClick={() => run(() => patch({ newsOpen: true }))}>
            <span className="help-ico new">
              <Icon d={SPARK} size={14} weight={2.2} />
            </span>
            <span className="help-t">
              <b>Introducing Places and Routes</b>
              <span>What's new</span>
            </span>
          </button>
          <button role="menuitem" className="pop-item" onClick={() => run(() => patch({ requestIntro: () => {} }))}>
            <span className="help-ico req">
              <Icon d={AREA} size={14} weight={2.2} />
            </span>
            <span className="help-t">
              <b>Before you request an area</b>
              <span>Area size and how long it takes</span>
            </span>
          </button>
          {tipsHidden() && (
            <button role="menuitem" className="pop-item" onClick={() => run(showTips)}>
              <span className="help-ico tips">
                <Icon d='<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/>' size={14} weight={2.2} />
              </span>
              <span className="help-t">
                <b>Show hidden tips</b>
                <span>Bring back the tips you dismissed</span>
              </span>
            </button>
          )}
          <div className="pop-sep" />
          {CONFIG.downloadUrl && (
            <a role="menuitem" className="pop-item" href={CONFIG.downloadUrl} target="_blank" rel="noopener" onClick={() => setAt(null)}>
              <Icon d={DOWN} size={15} />
              Get Smoother Roads
            </a>
          )}
          {CONFIG.gpsUrl && (
            <a role="menuitem" className="pop-item" href={CONFIG.gpsUrl} target="_blank" rel="noopener" onClick={() => setAt(null)}>
              <Icon d={NAV} size={15} />
              Get Street GPS
            </a>
          )}
          <a role="menuitem" className="pop-item" href={"mailto:" + CONFIG.contactEmail} onClick={() => setAt(null)}>
            <Icon d={MAIL} size={15} />
            Contact
          </a>
        </div>
      )}
    </>
  );
}
