import { useRef } from "react";
import { useStore, type PanelMode } from "../lib/store";
import type { Area } from "../lib/types";
import { DetailPanel } from "./DetailPanel";
import { SubmitPanel } from "./SubmitPanel";

export function Panel() {
  const full = useStore((s) => s.full);
  const panel = useStore((s) => (s.full && s.panel === "detail" ? null : s.panel)); // the full page replaces the detail panel
  const area = useStore((s) => s.areas.find((a) => a.id === s.selectedId));

  // Keep the last content on screen while the panel slides away
  const mode = useRef<PanelMode>(null);
  const lastArea = useRef<Area | undefined>(undefined);
  if (panel) mode.current = panel;
  if (area) lastArea.current = area;

  return (
    <aside className={"panel" + (panel ? " open" : "")} inert={!panel}>
      {mode.current === "submit" && <SubmitPanel />}
      {mode.current === "detail" && !full && lastArea.current && <DetailPanel area={lastArea.current} />}
    </aside>
  );
}
