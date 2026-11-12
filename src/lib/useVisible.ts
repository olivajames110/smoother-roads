import { useMemo } from "react";
import { filterKey } from "./icons";
import { matches, useStore } from "./store";

// The status chips apply to the map and sidebar; the leaderboard always shows every area
export function useVisible(useLegend: boolean) {
  const areas = useStore((s) => s.areas);
  const hidden = useStore((s) => s.hidden);
  const query = useStore((s) => s.query);
  return useMemo(
    () => areas.filter((a) => (!useLegend || !hidden.has(filterKey(a))) && matches(a, query)),
    [areas, hidden, query, useLegend],
  );
}
