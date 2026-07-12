import { useLayoutEffect, useRef, useState, type CSSProperties } from "react";

const GAP = 6;
const PAD = 8;

/** Clamp a right-of-anchor popover inside the viewport (flip up near bottom). */
export function useActivityBarPopoverPosition(
  anchor: DOMRect | undefined,
  open: boolean,
  width: number,
  /** Re-measure when popover content changes height. */
  contentKey = 0,
): { ref: React.RefObject<HTMLDivElement | null>; style: CSSProperties } {
  const ref = useRef<HTMLDivElement | null>(null);
  const [style, setStyle] = useState<CSSProperties>({
    position: "fixed",
    left: -9999,
    top: 0,
    visibility: "hidden",
  });

  useLayoutEffect(() => {
    if (!open || !anchor || !ref.current) return;
    const h = ref.current.offsetHeight;
    const left = anchor.right + GAP;
    let top = anchor.top;
    if (top + h + PAD > window.innerHeight) {
      top = anchor.bottom - h;
    }
    top = Math.max(PAD, Math.min(top, window.innerHeight - h - PAD));
    setStyle({
      position: "fixed",
      left,
      top,
      width,
      minWidth: width,
      maxHeight: window.innerHeight - top - PAD,
      overflow: "auto",
      visibility: "visible",
    });
  }, [anchor, open, width, contentKey]);

  return { ref, style };
}
