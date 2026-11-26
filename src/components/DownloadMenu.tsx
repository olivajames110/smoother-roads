import { useEffect, useRef, useState } from "react";
import { CONFIG } from "../lib/config";
import { HoverTip } from "./HoverTip";
import { Icon } from "./Icon";

const DOWN = '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>';
const ROAD = '<path d="M4 21 9 3M20 21 15 3M12 5v2.5M12 10.5V13M12 16v3"/>';
const NAV = '<path d="M3 11 21 3l-8 18-2-8z"/>';
const OUT = '<path d="M14 5h5v5M19 5l-8 8M11 6H6a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-5"/>';

// The download button beside Help: a small menu with the two mods' pages on flightsim.to
export function DownloadMenu() {
  const [at, setAt] = useState<{ top: number; left: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const open = !!at;

  // fixed to the screen, so the sidebar (even collapsed) never clips it
  const toggle = () => {
    if (open) return setAt(null);
    const r = btn.current!.getBoundingClientRect();
    const width = 290;
    setAt({ top: r.bottom + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
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

  const mods = [
    { url: CONFIG.downloadUrl, name: "Smoother Roads", sub: "Level roads for ground vehicles", icon: ROAD },
    { url: CONFIG.gpsUrl, name: "Street GPS", sub: "Turn-by-turn satnav in the sim", icon: NAV },
  ].filter((m) => m.url);
  if (!mods.length) return null;

  return (
    <>
      <HoverTip className="ibtn-tip" tip="Download" place="below">
        <button
          ref={btn}
          className={"ibtn" + (open ? " active" : "")}
          aria-label="Download the mods"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
        >
          <Icon d={DOWN} size={18} />
        </button>
      </HoverTip>
      {at && (
        <div ref={pop} className="pop help-pop dl-pop" role="menu" style={{ top: at.top, left: at.left }}>
          <div className="pop-label">Download on flightsim.to</div>
          {mods.map((m) => (
            <a key={m.name} role="menuitem" className="pop-item" href={m.url} target="_blank" rel="noopener" onClick={() => setAt(null)}>
              <span className="help-ico dl">
                <Icon d={m.icon} size={14} weight={2.2} />
              </span>
              <span className="help-t">
                <b>{m.name}</b>
                <span>{m.sub}</span>
              </span>
              <Icon d={OUT} size={14} />
            </a>
          ))}
        </div>
      )}
    </>
  );
}
