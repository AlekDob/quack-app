import { useEffect, useRef } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";

interface Props {
  open: boolean;
  anchor: HTMLElement | null;
  onClose: () => void;
  onAddTerminal: () => void;
}

/** Cursor-style “+” menu to add Agent Mode context views. */
export function AgentAddViewMenu({
  open,
  anchor,
  onClose,
  onAddTerminal,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !anchor) return null;

  const rect = anchor.getBoundingClientRect();
  const style: CSSProperties = {
    position: "fixed",
    left: Math.min(rect.left, window.innerWidth - 220),
    top: rect.bottom + 4,
    minWidth: 200,
  };

  return createPortal(
    <>
      <div className="menu-overlay" onClick={onClose} />
      <div
        ref={menuRef}
        className="menu-dropdown liquid-glass agent-add-view-menu"
        style={style}
        role="menu"
        aria-label="Add view"
      >
        <button
          type="button"
          className="menu-item"
          role="menuitem"
          onClick={() => {
            onClose();
            onAddTerminal();
          }}
        >
          <Icon name="terminal" size={14} />
          <span className="menu-item-label">Terminal</span>
        </button>
        <button
          type="button"
          className="menu-item"
          role="menuitem"
          disabled
          title="Coming soon"
        >
          <Icon name="globe" size={14} />
          <span className="menu-item-label">Browser</span>
          <span className="menu-item-accel">Soon</span>
        </button>
      </div>
    </>,
    document.body,
  );
}
