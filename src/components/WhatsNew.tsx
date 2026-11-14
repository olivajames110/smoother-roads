import { useEffect, useState } from "react";
import { CONFIG } from "../lib/config";
import { CATS } from "../lib/icons";
import { useStore } from "../lib/store";
import { Icon } from "./Icon";
import { Media } from "./Media";

// Bump the key for the next announcement: everyone sees the new one once
const SEEN_KEY = "sr-news-places-routes";
// The area shown as the example on the second page
const EXAMPLE = "las-vegas-nv";

const FEATURES = [
  {
    tone: "place",
    icon: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    title: "Places",
    text: "Landmarks and spots worth driving to in every Smoother Roads area.",
  },
  {
    tone: "route",
    icon: '<circle cx="6" cy="19" r="2.5"/><circle cx="18" cy="5" r="2.5"/><path d="M8.5 19H16a3.5 3.5 0 0 0 0-7H8a3.5 3.5 0 0 1 0-7h7.5"/>',
    title: "Routes",
    text: "Hand-picked drives through several stops, each with the best time of day to go.",
  },
  {
    tone: "gps",
    icon: '<path d="M3 11 21 3l-8 18-2-8z"/>',
    title: "In Street GPS",
    text: "Pick a place or press Start on a route, and the GPS takes you there, sunset included.",
  },
];

function seen() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

// The example area's Places / Routes section, exactly as its panel shows it (tabs switch; nothing
// else is clickable)
function Preview() {
  const area = useStore((s) => s.areas.find((a) => a.id === EXAMPLE));
  if (!area) return <div className="wn-preview wn-loading">Loading the example…</div>;
  return (
    <div className="wn-preview">
      <div className="wn-pv-head">
        <span className="wn-pv-tile">
          <Icon d={CATS[area.cat].icon} size={16} weight={2.2} />
        </span>
        <div className="wn-pv-name">
          <b>{area.name}</b>
          <span>{area.region}</span>
        </div>
      </div>
      <div className="wn-pv-body">
        <Media area={area} preview start="route" />
      </div>
    </div>
  );
}

// A one-time "what's new" note on the map page; closing it in any way means it won't show again
export function WhatsNew() {
  const openDetail = useStore((s) => s.openDetail);
  const open = useStore((s) => s.newsOpen);
  const patch = useStore((s) => s.patch);
  const setOpen = (newsOpen: boolean) => patch({ newsOpen });
  const [page, setPage] = useState(0);

  // shows by itself once; Help reopens it
  useEffect(() => {
    if (seen()) return;
    const t = setTimeout(() => setOpen(true), 700); // after the map has loaded
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open) setPage(0);
  }, [open]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* private window: it shows again next time */
    }
  };

  const explore = () => {
    close();
    openDetail(EXAMPLE);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open]);

  if (!open) return null;
  const dots = (
    <span className="wn-dots" aria-label={`Page ${page + 1} of 2`}>
      <i className={page === 0 ? "on" : ""} />
      <i className={page === 1 ? "on" : ""} />
    </span>
  );

  return (
    <div className="modal-back" onClick={close}>
      <div className="modal wn" role="dialog" aria-modal="true" aria-labelledby="wn-title" onClick={(e) => e.stopPropagation()}>
        <button className="ibtn modal-x" aria-label="Close" onClick={close}>
          <Icon name="x" size={18} />
        </button>

        {page === 0 ? (
          <>
            <p className="modal-kicker">New</p>
            <h2 id="wn-title">Introducing Places and Routes</h2>
            <p className="modal-text">Not sure where to drive? Open any area and look under the Places and Routes tabs.</p>

            <ul className="wn-list">
              {FEATURES.map((f) => (
                <li key={f.title} className="wn-row">
                  <span className={"wn-ico " + f.tone}>
                    <Icon d={f.icon} size={17} weight={2.2} />
                  </span>
                  <div className="wn-txt">
                    <b>{f.title}</b>
                    <span>{f.text}</span>
                  </div>
                </li>
              ))}
            </ul>

            <p className="wn-note">
              Know a great drive? Suggest your own place or route from any area.
              {CONFIG.gpsUrl && (
                <>
                  {" "}
                  <a className="link" href={CONFIG.gpsUrl} target="_blank" rel="noopener">
                    Get Street GPS
                  </a>
                </>
              )}
            </p>

            <div className="modal-foot">
              {dots}
              <button className="btn fun" autoFocus onClick={() => setPage(1)}>
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modal-kicker">Example</p>
            <h2 id="wn-title">A night on the Strip</h2>
            <p className="modal-text">Here's Las Vegas. Switch between Places and Routes, then open it to try them on the map.</p>

            <Preview />

            <div className="modal-foot">
              {dots}
              <div className="wn-btns">
                <button className="btn" onClick={() => setPage(0)}>
                  Back
                </button>
                <button className="btn fun" autoFocus onClick={explore}>
                  Open Las Vegas
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
