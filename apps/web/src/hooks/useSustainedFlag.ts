// FILE: useSustainedFlag.ts
// Purpose: report whether a condition has stayed true without interruption for
// a given time. Used for "this state is fine for a moment, but if it lasts we
// are stuck" checks, where reacting to the first frame would be wrong.
import { useEffect, useState } from "react";

export function useSustainedFlag(active: boolean, delayMs: number): boolean {
  const [sustained, setSustained] = useState(false);

  useEffect(() => {
    if (!active) {
      setSustained(false);
      return;
    }
    const timer = window.setTimeout(() => setSustained(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [active, delayMs]);

  return sustained;
}
