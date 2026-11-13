import { useStore } from "../lib/store";
import { Icon } from "./Icon";

export function MapHint() {
  const panel = useStore((s) => s.panel);
  const pinMode = useStore((s) => s.pinMode);
  const draft = useStore((s) => s.draft);
  const poiPick = useStore((s) => s.poiPick);
  const poiKind = useStore((s) => s.poiDraft?.kind);
  const poiCount = useStore((s) => s.poiDraft?.points.length ?? 0);

  let text = "";
  if (pinMode) text = "Click the map to mark the spot";
  else if (poiPick)
    text =
      poiKind !== "route"
        ? "Click the map to place it"
        : poiCount === 0
          ? "Click the map to set the route's start"
          : "Click the next point along the route. The last one is the finish";
  else if (panel === "submit") {
    if (draft.type === "radius") text = draft.center ? "" : "Click the map to place the center";
    else if (!draft.closed) {
      text = draft.points.length < 3 ? "Click the map to add points" : "Click the first point or press Finish to close";
    }
  }

  return (
    <div className={"map-hint" + (text ? " show" : "")}>
      <Icon name="target" size={15} />
      {text}
      {(pinMode || poiPick) && <kbd>Esc</kbd>}
    </div>
  );
}
