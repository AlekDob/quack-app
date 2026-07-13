import {
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";

const POP_GAP = 4;
const POP_MARGIN = 8;

export function clampComposerCtxPos(
  btn: DOMRect,
  popW: number,
  popH: number,
): { left: number; top: number } {
  let left = btn.left;
  left = Math.max(
    POP_MARGIN,
    Math.min(left, window.innerWidth - popW - POP_MARGIN),
  );
  // Context bar sits at the top of the pill — prefer opening downward.
  let top = btn.bottom + POP_GAP;
  if (top + popH + POP_MARGIN > window.innerHeight) {
    top = btn.top - popH - POP_GAP;
  }
  return { left, top: Math.max(POP_MARGIN, top) };
}

interface ComposerCtxMenuProps {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  children: ReactNode;
  estimateHeight?: number;
  className?: string;
}

/** Portaled menu for composer context segments (escapes .ai-panel overflow). */
export function ComposerCtxMenu({
  open,
  onClose,
  anchorRef,
  children,
  estimateHeight = 220,
  className,
}: ComposerCtxMenuProps) {
  const popRef = useRef<HTMLDivElement>(null);
  const [popPos, setPopPos] = useState({ left: 0, top: 0 });

  useLayoutEffect(() => {
    if (!open || !anchorRef.current) return;
    const btn = anchorRef.current.getBoundingClientRect();
    const place = () => {
      const pop = popRef.current?.getBoundingClientRect();
      setPopPos(
        clampComposerCtxPos(
          btn,
          pop?.width ?? 260,
          pop?.height ?? estimateHeight,
        ),
      );
    };
    place();
    const id = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(id);
  }, [open, anchorRef, estimateHeight]);

  if (!open) return null;

  return createPortal(
    <>
      <div className="ai-flag-menu-overlay" onMouseDown={onClose} />
      <div
        ref={popRef}
        className={`ai-composer-ctx-menu ai-composer-ctx-menu--portaled${
          className ? ` ${className}` : ""
        }`}
        role="menu"
        style={{ left: popPos.left, top: popPos.top }}
      >
        {children}
      </div>
    </>,
    document.body,
  );
}
