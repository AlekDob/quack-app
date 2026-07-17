import { useLayoutEffect, useRef, useState } from "react";

/** Cursor-style: clamp tall user prompts to this many lines when collapsed. */
export const USER_BAR_COMPACT_LINES = 3;

/** Seed overflow before layout — long paste / multi-line prompts. */
export function estimateUserBarOverflow(content: string): boolean {
  if (content.length > 180) return true;
  return (content.match(/\n/g)?.length ?? 0) >= USER_BAR_COMPACT_LINES;
}

/**
 * Cursor-style user-bar collapse: clamp to ~3 lines by default, click to
 * expand. Decoupled from sticky scroll (pin stays CSS-only on `.ai-msg-user`)
 * so height changes never fight IntersectionObserver — that was the flicker.
 */
export function useUserBarSticky(content: string) {
  const mainRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(() =>
    estimateUserBarOverflow(content),
  );

  useLayoutEffect(() => {
    setExpanded(false);
    setCanExpand(estimateUserBarOverflow(content));
  }, [content]);

  useLayoutEffect(() => {
    const main = mainRef.current;
    if (!main || expanded) return;

    const check = () => {
      const styles = getComputedStyle(main);
      const fontSize = parseFloat(styles.fontSize) || 13.5;
      const lhParsed = parseFloat(styles.lineHeight);
      const lineHeight = Number.isFinite(lhParsed) ? lhParsed : fontSize * 1.55;
      const limit = lineHeight * USER_BAR_COMPACT_LINES;
      // scrollHeight is full content even under overflow:hidden.
      const overflows = main.scrollHeight > limit + 1;
      setCanExpand((prev) => {
        if (overflows) return true;
        if (main.scrollHeight <= limit) return false;
        return prev;
      });
    };

    check();
    const ro = new ResizeObserver(check);
    ro.observe(main);
    return () => ro.disconnect();
  }, [content, expanded]);

  return {
    mainRef,
    /** Clamp only when the prompt overflows — short cards keep natural layout. */
    isCompact: !expanded && canExpand,
    canToggle: canExpand,
    expanded,
    toggleExpanded: () => setExpanded((v) => !v),
  };
}
