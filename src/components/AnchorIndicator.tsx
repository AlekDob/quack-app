/**
 * AnchorIndicator
 *
 * Floating anchor icon aligned with the scrollbar rail of a chat container.
 *
 * - When NOT anchored: icon follows the scroll thumb position. Click → set anchor
 *   at the message currently centered in the viewport.
 * - When anchored: icon is pinned at the vertical position of the anchored
 *   message. Click → scroll to that message. Hover → reveal "X" → click X →
 *   remove anchor.
 *
 * Rendered as a sibling of `.message-list` inside `.message-list-wrapper`
 * (`position: relative`). Uses `position: absolute` so it stays within the
 * container without scrolling with the content.
 *
 * Brain: pattern-session-scroll-memory
 */
import { useEffect, useState, useCallback, useRef } from 'react';
import './AnchorIndicator.css';

interface AnchorIndicatorProps {
  scrollRef: React.RefObject<HTMLElement | null>;
  sessionId: string | undefined;
  anchoredMessageId: string | null;
  onAnchor: (messageId: string) => void;
  onRemove: () => void;
  onJumpToAnchor: () => void;
}

export default function AnchorIndicator({
  scrollRef,
  sessionId,
  anchoredMessageId,
  onAnchor,
  onRemove,
  onJumpToAnchor,
}: AnchorIndicatorProps) {
  const [thumbPercent, setThumbPercent] = useState(0);
  const [anchorPercent, setAnchorPercent] = useState<number | null>(null);
  const [hovered, setHovered] = useState(false);
  const rafRef = useRef<number | null>(null);

  const updateThumbPercent = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) {
      setThumbPercent(0);
      return;
    }
    setThumbPercent(Math.max(0, Math.min(1, el.scrollTop / max)));
  }, [scrollRef]);

  const updateAnchorPercent = useCallback(() => {
    if (!anchoredMessageId) {
      setAnchorPercent(null);
      return;
    }
    const el = scrollRef.current;
    if (!el) return;
    const target = el.querySelector<HTMLElement>(
      `[data-message-id="${CSS.escape(anchoredMessageId)}"]`,
    );
    if (!target) {
      setAnchorPercent(null);
      return;
    }
    const max = el.scrollHeight - el.clientHeight;
    if (max <= 0) {
      setAnchorPercent(0);
      return;
    }
    const anchorTop = target.offsetTop - el.offsetTop;
    setAnchorPercent(Math.max(0, Math.min(1, anchorTop / max)));
  }, [scrollRef, anchoredMessageId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const tick = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        updateThumbPercent();
        updateAnchorPercent();
      });
    };

    updateThumbPercent();
    updateAnchorPercent();

    el.addEventListener('scroll', tick, { passive: true });
    const observer = new ResizeObserver(tick);
    observer.observe(el);

    return () => {
      el.removeEventListener('scroll', tick);
      observer.disconnect();
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [scrollRef, updateThumbPercent, updateAnchorPercent]);

  useEffect(() => {
    updateAnchorPercent();
  }, [anchoredMessageId, updateAnchorPercent]);

  const findCenteredMessageId = useCallback((): string | null => {
    const el = scrollRef.current;
    if (!el) return null;
    const containerRect = el.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    const items = el.querySelectorAll<HTMLElement>('[data-message-id]');
    let best: { id: string; dist: number } | null = null;
    items.forEach((item) => {
      const rect = item.getBoundingClientRect();
      const itemCenter = rect.top + rect.height / 2;
      const dist = Math.abs(itemCenter - centerY);
      if (!best || dist < best.dist) {
        best = { id: item.dataset.messageId || '', dist };
      }
    });
    const result = best as { id: string; dist: number } | null;
    return result && result.id ? result.id : null;
  }, [scrollRef]);

  const handleClick = useCallback(() => {
    if (!sessionId) return;
    if (anchoredMessageId) {
      onJumpToAnchor();
    } else {
      const id = findCenteredMessageId();
      if (id) onAnchor(id);
    }
  }, [sessionId, anchoredMessageId, findCenteredMessageId, onAnchor, onJumpToAnchor]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onRemove();
  }, [onRemove]);

  const isAnchored = anchoredMessageId !== null && anchorPercent !== null;
  const topPercent = isAnchored ? anchorPercent! : thumbPercent;

  return (
    <div
      className={`anchor-indicator ${isAnchored ? 'anchored' : 'following'}`}
      style={{ top: `calc(${topPercent * 100}% - 12px)` }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleClick}
      role="button"
      aria-label={isAnchored ? 'Jump to anchored message' : 'Anchor this position'}
      title={isAnchored ? 'Jump to anchored message' : 'Click to anchor current position'}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="5" r="3" />
        <line x1="12" y1="22" x2="12" y2="8" />
        <path d="M5 12H2a10 10 0 0 0 20 0h-3" />
      </svg>
      {isAnchored && hovered && (
        <button
          className="anchor-indicator-remove"
          onClick={handleRemove}
          aria-label="Remove anchor"
          title="Remove anchor"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
