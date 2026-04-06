/**
 * KeyboardShortcutTooltip
 *
 * A visually appealing tooltip component for displaying keyboard shortcuts.
 * Shows instantly on hover with a modern dark glassmorphism style.
 * Uses portal rendering and fixed positioning to always stay on top.
 */

import { useState, useRef, useCallback, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import "./KeyboardShortcutTooltip.css";

interface KeyboardShortcutTooltipProps {
  children: ReactNode;
  label: string;
  shortcut?: string; // e.g., "⌘K" or "⌘T" — omit to show label-only tooltip
  position?: "top" | "bottom" | "left" | "right";
  delay?: number; // Delay before showing (default: 0 for instant)
}

interface TooltipPosition {
  top: number;
  left: number;
}

export default function KeyboardShortcutTooltip({
  children,
  label,
  shortcut,
  position = "bottom",
  delay = 0,
}: KeyboardShortcutTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPos, setTooltipPos] = useState<TooltipPosition>({ top: 0, left: 0 });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Calculate tooltip position based on wrapper element
  const updatePosition = useCallback(() => {
    if (!wrapperRef.current) return;

    const rect = wrapperRef.current.getBoundingClientRect();
    const tooltipWidth = tooltipRef.current?.offsetWidth || 120;
    const tooltipHeight = tooltipRef.current?.offsetHeight || 36;
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case "bottom":
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "top":
        top = rect.top - tooltipHeight - gap;
        left = rect.left + rect.width / 2 - tooltipWidth / 2;
        break;
      case "left":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.left - tooltipWidth - gap;
        break;
      case "right":
        top = rect.top + rect.height / 2 - tooltipHeight / 2;
        left = rect.right + gap;
        break;
    }

    // Keep tooltip within viewport
    const padding = 8;
    left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

    setTooltipPos({ top, left });
  }, [position]);

  const showTooltip = useCallback(() => {
    updatePosition();
    if (delay > 0) {
      timeoutRef.current = setTimeout(() => {
        setIsVisible(true);
      }, delay);
    } else {
      setIsVisible(true);
    }
  }, [delay, updatePosition]);

  const hideTooltip = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsVisible(false);
  }, []);

  // Update position on scroll/resize when visible
  useEffect(() => {
    if (!isVisible) return;

    const handleUpdate = () => updatePosition();
    window.addEventListener("scroll", handleUpdate, true);
    window.addEventListener("resize", handleUpdate);

    return () => {
      window.removeEventListener("scroll", handleUpdate, true);
      window.removeEventListener("resize", handleUpdate);
    };
  }, [isVisible, updatePosition]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const tooltipElement = (
    <div
      ref={tooltipRef}
      className={`kbd-tooltip ${isVisible ? "visible" : ""}`}
      role="tooltip"
      style={{
        top: tooltipPos.top,
        left: tooltipPos.left,
      }}
    >
      <span className="kbd-tooltip-label">{label}</span>
      {shortcut && <kbd className="kbd-tooltip-key">{shortcut}</kbd>}
    </div>
  );

  return (
    <div
      ref={wrapperRef}
      className="kbd-tooltip-wrapper"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {createPortal(tooltipElement, document.body)}
    </div>
  );
}
