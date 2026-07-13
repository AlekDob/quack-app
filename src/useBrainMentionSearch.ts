// Debounced Pinky search for `#` brain mention popover.

import { useEffect, useState } from "react";
import { pinky, type PinkySearchHit } from "./pinky";

export function useBrainMentionSearch(
  root: string,
  query: string,
  recentHits: PinkySearchHit[],
  enabled: boolean,
): { matches: PinkySearchHit[]; searching: boolean } {
  const [hits, setHits] = useState<PinkySearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const trimmed = query.trim();

  useEffect(() => {
    if (!enabled) {
      setHits([]);
      setSearching(false);
      return;
    }
    if (!trimmed) {
      setHits([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = window.setTimeout(() => {
      void pinky
        .search(root, trimmed, 8)
        .then((res) => setHits(res.results))
        .catch(() => setHits([]))
        .finally(() => setSearching(false));
    }, 200);
    return () => window.clearTimeout(t);
  }, [root, trimmed, enabled]);

  return {
    matches: trimmed ? hits : recentHits,
    searching: searching && trimmed.length > 0,
  };
}
