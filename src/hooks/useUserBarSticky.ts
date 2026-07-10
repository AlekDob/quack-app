import { useEffect, useRef, useState } from "react";

/** Natural height above which we collapse while the bar is stuck. */
const TALL_THRESHOLD_PX = 100;

export function useUserBarSticky(content: string) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);
  const [isTall, setIsTall] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const root = sentinel.closest(".ai-messages");
    if (!(root instanceof HTMLElement)) return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsStuck(!entry.isIntersecting),
      { root, threshold: 0 },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    const measure = () => setIsTall(main.scrollHeight > TALL_THRESHOLD_PX);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(main);
    return () => ro.disconnect();
  }, [content]);

  useEffect(() => {
    if (!isStuck) setExpanded(false);
  }, [isStuck]);

  const isCompact = isStuck && isTall && !expanded;
  const canToggle = isStuck && isTall;

  return {
    sentinelRef,
    mainRef,
    isCompact,
    canToggle,
    expanded,
    toggleExpanded: () => setExpanded((v) => !v),
  };
}
