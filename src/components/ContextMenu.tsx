import { useEffect, useRef } from "react";
import type { TerminalInfo } from "../types";

interface ContextMenuProps {
  position: { x: number; y: number };
  terminal: TerminalInfo;
  onEdit: () => void;
  onClose: () => void;
  onCopyPath?: () => void;
  onCloseTerminal?: () => void;
  onDuplicate?: () => void;
  onReset?: () => void;
  onCreateTask?: () => void;
}

export default function ContextMenu({
  position,
  terminal,
  onEdit,
  onClose,
  onCopyPath,
  onCloseTerminal,
  onDuplicate,
  onReset,
  onCreateTask,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      try {
        // Defensive checks to prevent NotFoundError
        if (!menuRef.current) {
          return;
        }

        // Check if menu is still in DOM
        if (!document.body.contains(menuRef.current)) {
          return;
        }

        // Check if event target is valid
        if (!event.target || !(event.target instanceof Node)) {
          return;
        }

        if (!menuRef.current.contains(event.target)) {
          onClose();
        }
      } catch (error) {
        console.warn("Error handling click outside:", error);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      try {
        if (event.key === "Escape") {
          onClose();
        }
      } catch (error) {
        console.warn("Error handling escape:", error);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(terminal.cwd);
      onClose();
    } catch (error) {
      console.error("Failed to copy path:", error);
    }
  };

  const handleCloseTerminal = () => {
    onCloseTerminal?.();
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      {onCreateTask && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => {
            onCreateTask();
            onClose();
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ marginRight: "-4px", opacity: 0.7 }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="12" y1="8" x2="12" y2="16" />
            <line x1="8" y1="12" x2="16" y2="12" />
          </svg>
          <span>Create Task</span>
        </button>
      )}

      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          onEdit();
          onClose();
        }}
      >
        <span>Edit Agent</span>
      </button>

      {onCopyPath && (
        <button
          type="button"
          className="context-menu-item"
          onClick={handleCopyPath}
        >
          <span>Copy Path</span>
        </button>
      )}

      {onDuplicate && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => {
            onDuplicate();
            onClose();
          }}
        >
          <span>Duplicate Agent</span>
        </button>
      )}

      {onReset && (
        <button
          type="button"
          className="context-menu-item"
          onClick={() => {
            onReset();
            onClose();
          }}
        >
          <span>Reset Agent</span>
        </button>
      )}

      <div className="context-menu-separator" />

      {onCloseTerminal && (
        <button
          type="button"
          className="context-menu-item context-menu-item-danger"
          onClick={handleCloseTerminal}
        >
          <span>Close Agent</span>
        </button>
      )}
    </div>
  );
}
