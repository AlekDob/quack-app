// Measures vertical space left for view-icons inside the activity bar.
import { useEffect, useState, type RefObject } from "react";

function measureViewIconsHeight(
  bar: HTMLElement,
  wsList: HTMLElement | null,
  sep: HTMLElement | null,
): number {
  const style = getComputedStyle(bar);
  const pad =
    parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
  const gap = parseFloat(style.gap) || 6;
  const wsH = wsList?.offsetHeight ?? 0;
  const sepH = sep?.offsetHeight ?? 0;
  return Math.max(0, bar.clientHeight - wsH - sepH - pad - gap * 2);
}

export function useActivityBarViewHeight(
  barRef: RefObject<HTMLElement | null>,
  wsListRef: RefObject<HTMLElement | null>,
  sepRef: RefObject<HTMLElement | null>,
  /** Re-measure when the workspace list grows or shrinks. */
  wsCount: number,
): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const bar = barRef.current;
    if (!bar) return;

    const update = () => {
      setHeight(
        measureViewIconsHeight(
          bar,
          wsListRef.current,
          sepRef.current,
        ),
      );
    };

    const ro = new ResizeObserver(update);
    ro.observe(bar);
    const ws = wsListRef.current;
    const sep = sepRef.current;
    if (ws) ro.observe(ws);
    if (sep) ro.observe(sep);
    update();

    return () => ro.disconnect();
  }, [barRef, wsListRef, sepRef, wsCount]);

  return height;
}
