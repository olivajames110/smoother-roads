import { useMemo } from "react";
import { matches, useStore } from "./store";

// The status chips and the photogrammetry switch apply to the map and sidebar; the leaderboard
// always shows every area
export function useVisible(useLegend: boolean) {
  const areas = useStore((s) => s.areas);
  const hidden = useStore((s) => s.hidden);
  const photoOnly = useStore((s) => s.photoOnly);
  const query = useStore((s) => s.query);
  return useMemo(
    () =>
      areas.filter(
        (a) =>
          (!useLegend || (!hidden.has(a.status) && (!photoOnly || !a.noPhotogrammetry))) && matches(a, query),
      ),
    [areas, hidden, photoOnly, query, useLegend],
  );
}
