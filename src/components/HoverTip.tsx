import { useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface HoverTipProps {
  className: string;
  tip: ReactNode;
  place: "right" | "above" | "below" | "below-end"; // below-end: opens to the left (for the right edge)
  label?: string;
  style?: CSSProperties;
  children?: ReactNode;
}

// Keeps the tooltip's arrow centred on its target
const ARROW_OFFSET = 13.5;

function position(r: DOMRect, place: HoverTipProps["place"]) {
  if (place === "right") return { left: r.right + 10, top: r.top + r.height / 2 };
  if (place === "below-end") return { left: r.left + r.width / 2 + ARROW_OFFSET, top: r.bottom + 10 };
  const left = r.left + r.width / 2 - ARROW_OFFSET;
  return { left, top: place === "above" ? r.top - 10 : r.bottom + 10 };
}

// The sidebar clips its contents, so the tooltip renders on the page body
export function HoverTip({ className, tip, place, label, style, children }: HoverTipProps) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);

  return (
    <span
      className={className}
      style={style}
      aria-label={label}
      onMouseEnter={(e) => setAt(position(e.currentTarget.getBoundingClientRect(), place))}
      onMouseLeave={() => setAt(null)}
      onClick={() => setAt(null)}
    >
      {children}
      {at &&
        createPortal(
          <div className={"area-tip " + place} role="tooltip" style={at}>
            {tip}
          </div>,
          document.body,
        )}
    </span>
  );
}
