import { useEffect, useRef, useState } from "react";

/** Natural height above which we collapse while the bar is stuck. */
const TALL_THRESHOLD_PX = 100;
/** Pixels sentinel must clear the scroll top before we unstick (anti-flicker). */
const UNSTICK_GAP_PX = 10;

function estimateTall(content: string, imageCount: number): boolean {
  if (imageCount > 0) return true;
  if (content.length > 320) return true;
  return (content.match(/\n/g)?.length ?? 0) >= 5;
}

export function useUserBarSticky(content: string, imageCount = 0) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const tallCacheRef = useRef(estimateTall(content, imageCount));
  const [isStuck, setIsStuck] = useState(false);
  const [isTall, setIsTall] = useState(() => estimateTall(content, imageCount));
  const [expanded, setExpanded] = useState(false);

  const isCompact = isStuck && isTall && !expanded;
  const canToggle = isStuck && isTall;

  const measureNatural = (main: HTMLElement): boolean => {
    const tall =
      main.scrollHeight > TALL_THRESHOLD_PX || estimateTall(content, imageCount);
    tallCacheRef.current = tall;
    return tall;
  };

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const root = sentinel.closest(".ai-messages");
    if (!(root instanceof HTMLElement)) return;

    const syncStuck = () => {
      const rootTop = root.getBoundingClientRect().top;
      const sentBottom = sentinel.getBoundingClientRect().bottom;
      setIsStuck((prev) => {
        if (sentBottom <= rootTop + 2) return true;
        if (sentBottom > rootTop + UNSTICK_GAP_PX) return false;
        return prev;
      });
    };

    syncStuck();
    const obs = new IntersectionObserver(syncStuck, { root, threshold: 0 });
    obs.observe(sentinel);
    root.addEventListener("scroll", syncStuck, { passive: true });
    return () => {
      obs.disconnect();
      root.removeEventListener("scroll", syncStuck);
    };
  }, []);

  useEffect(() => {
    tallCacheRef.current = estimateTall(content, imageCount);
    const main = mainRef.current;
    if (!main) {
      setIsTall(tallCacheRef.current);
      return;
    }

    const applyMeasure = () => {
      if (main.closest(".ai-user-bar.is-compact")) {
        setIsTall(tallCacheRef.current);
        return;
      }
      setIsTall(measureNatural(main));
    };

    applyMeasure();
    const ro = new ResizeObserver(applyMeasure);
    ro.observe(main);
    return () => ro.disconnect();
  }, [content, imageCount]);

  useEffect(() => {
    if (!isStuck) setExpanded(false);
  }, [isStuck]);

  return {
    sentinelRef,
    mainRef,
    isCompact,
    canToggle,
    expanded,
    toggleExpanded: () => setExpanded((v) => !v),
  };
}
