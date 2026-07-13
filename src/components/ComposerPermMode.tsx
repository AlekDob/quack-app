import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import {
  PERM_MODE_OPTIONS,
  permModeOption,
  type PermModeTone,
} from "../presets/permModes";

type Props = {
  value: string | null;
  onChange: (next: string | null) => void;
};

const POP_GAP = 6;
const POP_MARGIN = 8;

function toneClass(tone: PermModeTone): string {
  return `ai-mode-tone--${tone}`;
}

function clampMenuPos(
  btn: DOMRect,
  popW: number,
  popH: number,
): { left: number; top: number } {
  let left = btn.right - popW;
  left = Math.max(
    POP_MARGIN,
    Math.min(left, window.innerWidth - popW - POP_MARGIN),
  );
  let top = btn.top - popH - POP_GAP;
  if (top < POP_MARGIN) top = btn.bottom + POP_GAP;
  return { left, top };
}

export function ComposerPermMode({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [popPos, setPopPos] = useState({ left: 0, top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const active = permModeOption(value);

  const pick = (next: string | null) => {
    onChange(next);
    setOpen(false);
  };

  const toggleOpen = () => {
    if (!open && btnRef.current) {
      const btn = btnRef.current.getBoundingClientRect();
      setPopPos(clampMenuPos(btn, 248, 220));
    }
    setOpen((v) => !v);
  };

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const place = () => {
      const pop = popRef.current?.getBoundingClientRect();
      setPopPos(clampMenuPos(btn, pop?.width ?? 248, pop?.height ?? 220));
    };
    place();
    const id = window.requestAnimationFrame(place);
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const menu =
    open && btnRef.current ? (
      <>
        <div
          className="ai-flag-menu-overlay"
          onClick={() => setOpen(false)}
        />
        <div
          ref={popRef}
          className="ai-mode-menu ai-mode-menu--portaled"
          role="menu"
          style={{ left: popPos.left, top: popPos.top }}
        >
          {PERM_MODE_OPTIONS.map((o) => (
            <button
              key={o.label}
              type="button"
              role="menuitem"
              className={`ai-mode-item ${value === o.v ? "active" : ""}`}
              onClick={() => pick(o.v)}
            >
              <span
                className={`ai-mode-item-icon ${toneClass(o.tone)}`}
                aria-hidden
              >
                <Icon name={o.icon} size={12} />
              </span>
              <span className="ai-mode-item-copy">
                <span className="ai-mode-item-label">{o.label}</span>
                <span className="ai-mode-item-desc">{o.desc}</span>
              </span>
            </button>
          ))}
        </div>
      </>
    ) : null;

  return (
    <div className="ai-mode-wrap">
      {menu ? createPortal(menu, document.body) : null}
      <button
        ref={btnRef}
        type="button"
        className={`ai-mode-btn ${toneClass(active.tone)}`}
        onClick={toggleOpen}
        title="Claude Code permission mode (also /mode, Shift+Tab to cycle)"
        aria-expanded={open}
      >
        <span className={`ai-mode-btn-icon ${toneClass(active.tone)}`} aria-hidden>
          <Icon name={active.icon} size={12} />
        </span>
        <span className="ai-mode-btn-label">{active.label}</span>
        <Icon name="chevron-down" size={12} className="ai-mode-btn-chevron" />
      </button>
    </div>
  );
}
