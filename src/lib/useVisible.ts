import { useMemo } from "react";
import { filterKey } from "./icons";
import { matches, useStore } from "./store";

// The status chips apply to the map and sidebar; the leaderboard always shows every area.
// Areas hidden from visitors (only the admin receives them) stay out unless "Show hidden areas" is on,
// except the one that's open
export function useVisible(useLegend: boolean) {
  const areas = useStore((s) => s.areas);
  const hidden = useStore((s) => s.hidden);
  const query = useStore((s) => s.query);
  const showHidden = useStore((s) => s.showHidden);
  const selectedId = useStore((s) => s.selectedId);
  return useMemo(
    () =>
      areas.filter(
        (a) =>
          (!a.hidden || showHidden || a.id === selectedId) &&
          (!useLegend || !hidden.has(filterKey(a))) &&
          matches(a, query),
      ),
    [areas, hidden, query, useLegend, showHidden, selectedId],
  );
}
