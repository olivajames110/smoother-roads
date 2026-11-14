import { useEffect, useState } from "react";
import { INTRO_KEY, useStore } from "../lib/store";
import { Icon } from "./Icon";

// Area size -> how long it's likely to take: the circle grows, the wait grows
const SIZES = [
  { r: 5, name: "Neighbourhood", size: "Under 1 mi (1.5 km) radius", wait: "Quickest", tone: "fast" },
  { r: 9, name: "Town", size: "Up to 3 mi (5 km) radius", wait: "Recommended", tone: "best" },
  { r: 13, name: "Larger drawn area", size: "Anything bigger", wait: "Longest wait", tone: "slow" },
];

// "Before you request": shown before every new request until "Don't show again"
export function RequestIntro() {
  const go = useStore((s) => s.requestIntro);
  const patch = useStore((s) => s.patch);
  const hideTip = useStore((s) => s.hideTip);
  const [never, setNever] = useState(false);
  const open = !!go;

  const close = () => patch({ requestIntro: null });
  const proceed = () => {
    if (never) hideTip(INTRO_KEY);
    close();
    go?.();
  };

  useEffect(() => {
    if (!open) return;
    setNever(false);
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
  return (
    <div className="modal-back" onClick={close}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ri-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button className="ibtn modal-x" aria-label="Close" onClick={close}>
          <Icon name="x" size={18} />
        </button>

        <p className="modal-kicker">Before you request</p>
        <h2 id="ri-title">Smaller areas get done sooner</h2>
        <p className="modal-text">
          Every area is built and test-driven in the sim, and some are far more complex than others. The
          bigger the area, the longer it's likely to wait.
        </p>

        <ul className="size-scale">
          {SIZES.map((s) => (
            <li key={s.name} className={"size-row " + s.tone}>
              <svg className="size-dot" viewBox="0 0 30 30" aria-hidden="true">
                <circle cx="15" cy="15" r={s.r} />
              </svg>
              <div className="size-txt">
                <b>{s.name}</b>
                <span>{s.size}</span>
              </div>
              <span className="size-wait">{s.wait}</span>
            </li>
          ))}
        </ul>

        <div className="modal-foot">
          <label className="modal-check">
            <input type="checkbox" checked={never} onChange={(e) => setNever(e.target.checked)} />
            Don't show again
          </label>
          <button className="btn fun" autoFocus onClick={proceed}>
            Got it, continue
          </button>
        </div>
      </div>
    </div>
  );
}
