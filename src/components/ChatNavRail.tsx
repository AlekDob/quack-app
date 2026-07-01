import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";

// Navigation rail (minimap) for long chat threads. One tick per USER turn,
// positioned proportionally to its place in the whole thread (offsetTop /
// scrollHeight) so the bar stays a COMPACT overview of the conversation —
// hover a tick to preview, click to jump. The active tick tracks the turn in
// view. Reads anchors from the DOM (data-anchor-*) to stay decoupled from the
// render. offsetTop is honest because .ai-messages is position:relative.

interface Anchor {
  idx: number;
  frac: number; // 0..1 position within the scroll content
  preview: string;
}

interface ChatNavRailProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  /** Bump to force a rescan (e.g. message count changed). */
  version: number;
}

export function ChatNavRail({ scrollRef, version }: ChatNavRailProps) {
  const [anchors, setAnchors] = useState<Anchor[]>([]);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const rescan = useCallback(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const els = Array.from(
      sc.querySelectorAll<HTMLElement>('[data-anchor-role="user"]'),
    );
    const h = sc.scrollHeight || 1;
    setAnchors(
      els.map((el) => ({
        idx: Number(el.dataset.anchorIdx),
        frac: Math.min(1, el.offsetTop / h),
        preview: el.dataset.anchorPreview ?? "",
      })),
    );
  }, [scrollRef]);

  // Rescan on turn-count change + on content growth/reflow (streaming).
  useEffect(() => {
    rescan();
    const sc = scrollRef.current;
    if (!sc) return;
    let raf = 0;
    const obs = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(rescan);
    });
    obs.observe(sc, { childList: true, subtree: true, characterData: true });
    return () => {
      obs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [rescan, version, scrollRef]);

  // Active turn = last user anchor above the viewport's upper third.
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return;
    const onScroll = () => {
      const els = sc.querySelectorAll<HTMLElement>('[data-anchor-role="user"]');
      const mark = sc.scrollTop + sc.clientHeight * 0.35;
      let cur: number | null = null;
      els.forEach((el) => {
        if (el.offsetTop <= mark) cur = Number(el.dataset.anchorIdx);
      });
      setActiveIdx(cur);
    };
    onScroll();
    sc.addEventListener("scroll", onScroll, { passive: true });
    return () => sc.removeEventListener("scroll", onScroll);
  }, [scrollRef, version]);

  const jump = (idx: number) => {
    const sc = scrollRef.current;
    if (!sc) return;
    sc
      .querySelector<HTMLElement>(`[data-anchor-idx="${idx}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (anchors.length < 3) return null;
  const hover = anchors.find((a) => a.idx === hoverIdx) ?? null;

  return (
    <div className="ai-nav-rail" aria-hidden="true">
      {anchors.map((a) => (
        <button
          key={a.idx}
          type="button"
          className={`ai-nav-tick ${activeIdx === a.idx ? "active" : ""}`}
          style={{ top: `${a.frac * 100}%` }}
          onMouseEnter={() => setHoverIdx(a.idx)}
          onMouseLeave={() => setHoverIdx((h) => (h === a.idx ? null : h))}
          onClick={() => jump(a.idx)}
          title={a.preview}
        />
      ))}
      {hover && (
        <div className="ai-nav-preview" style={{ top: `${hover.frac * 100}%` }}>
          {hover.preview}
        </div>
      )}
    </div>
  );
}
