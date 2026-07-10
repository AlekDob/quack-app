import { useEffect, useState } from "react";

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3;
}

/** Animate a number from 0 → target on mount / target change. */
export function useCountUp(
  target: number,
  durationMs = 900,
  enabled = true,
): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    if (target === 0) {
      setValue(0);
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setValue(target);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / durationMs);
      setValue(Math.round(easeOutCubic(p) * target));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs, enabled]);

  return value;
}
