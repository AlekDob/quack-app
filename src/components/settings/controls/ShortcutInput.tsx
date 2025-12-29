/**
 * ShortcutInput - Key recording input component
 *
 * Click to enter recording mode, then press a key combination.
 * Features visual glow effect during recording and conflict detection.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { RotateCcw } from "lucide-react";
import "./ShortcutInput.css";

interface ShortcutInputProps {
  value: string;
  defaultValue: string;
  onChange: (keys: string) => void;
  onReset: () => void;
  conflict?: string; // Name of conflicting shortcut if any
  disabled?: boolean;
}

/**
 * Format raw keys to display format (Meta+K -> ⌘K)
 */
const formatKeys = (keys: string): string => {
  if (!keys) return "";
  return keys
    .replace(/Meta\+/gi, "⌘")
    .replace(/Ctrl\+/gi, "⌃")
    .replace(/Alt\+/gi, "⌥")
    .replace(/Shift\+/gi, "⇧")
    .replace(/\+/g, "");
};

/**
 * Parse keydown event into key string
 */
const parseKeyEvent = (e: KeyboardEvent): string | null => {
  const parts: string[] = [];

  // Add modifiers
  if (e.metaKey) parts.push("Meta");
  if (e.ctrlKey) parts.push("Ctrl");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");

  // Get the actual key (not modifier)
  const key = e.key;
  if (
    key !== "Meta" &&
    key !== "Control" &&
    key !== "Alt" &&
    key !== "Shift" &&
    key !== "Dead"
  ) {
    // Normalize key name
    const normalizedKey = key.length === 1 ? key.toUpperCase() : key;
    parts.push(normalizedKey);
  }

  // Must have at least one modifier and one key
  if (parts.length < 2) return null;
  if (parts.every((p) => ["Meta", "Ctrl", "Alt", "Shift"].includes(p))) return null;

  return parts.join("+");
};

export default function ShortcutInput({
  value,
  defaultValue,
  onChange,
  onReset,
  conflict,
  disabled = false,
}: ShortcutInputProps) {
  const [isRecording, setIsRecording] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);
  const isModified = value !== defaultValue;

  // Handle clicking to start recording
  const handleClick = useCallback(() => {
    if (disabled) return;
    setIsRecording(true);
  }, [disabled]);

  // Handle key down during recording
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isRecording) return;

      e.preventDefault();
      e.stopPropagation();

      // Escape to cancel
      if (e.key === "Escape") {
        setIsRecording(false);
        return;
      }

      const keys = parseKeyEvent(e);
      if (keys) {
        onChange(keys);
        setIsRecording(false);
      }
    },
    [isRecording, onChange]
  );

  // Handle clicking outside to cancel recording
  const handleClickOutside = useCallback(
    (e: MouseEvent) => {
      if (isRecording && inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setIsRecording(false);
      }
    },
    [isRecording]
  );

  // Set up event listeners
  useEffect(() => {
    if (isRecording) {
      window.addEventListener("keydown", handleKeyDown, true);
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isRecording, handleKeyDown, handleClickOutside]);

  return (
    <div className="shortcut-input-container">
      <div
        ref={inputRef}
        className={`shortcut-input ${isRecording ? "recording" : ""} ${conflict ? "conflict" : ""} ${disabled ? "disabled" : ""}`}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            handleClick();
          }
        }}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label={isRecording ? "Press a key combination" : `Current shortcut: ${formatKeys(value)}`}
      >
        {isRecording ? (
          <span className="shortcut-recording-text">Press shortcut...</span>
        ) : (
          <span className="shortcut-keys">{formatKeys(value)}</span>
        )}
      </div>

      {/* Reset button - only show if modified */}
      {isModified && !disabled && (
        <button
          type="button"
          className="shortcut-reset-btn"
          onClick={(e) => {
            e.stopPropagation();
            onReset();
          }}
          aria-label="Reset to default"
          title={`Reset to ${formatKeys(defaultValue)}`}
        >
          <RotateCcw size={14} />
        </button>
      )}

      {/* Conflict warning */}
      {conflict && (
        <div className="shortcut-conflict-warning">
          Already used by: {conflict}
        </div>
      )}
    </div>
  );
}
