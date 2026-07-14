import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  WORKSPACE_COLORS,
  getWorkspaceColor,
  setWorkspaceColor,
} from "../workspaceColors";
import { AIIcon } from "./AIIcon";

interface Props {
  wsId: string;
  /** Screen coords to anchor the popover near (usually the icon's edge). */
  x: number;
  y: number;
  /** Where to anchor the session-name prompt (the project icon). */
  nameAnchor: { x: number; y: number };
  onClose: () => void;
  onNewChat: (wsId: string, anchor: { x: number; y: number }) => void;
}

// Right-click popover on a project icon — new chat + color picker.
export function WorkspaceColorPopover({
  wsId,
  x,
  y,
  nameAnchor,
  onClose,
  onNewChat,
}: Props) {
  const [currentId, setCurrentId] = useState(
    () => getWorkspaceColor(wsId)?.id ?? null,
  );

  useEffect(() => {
    setCurrentId(getWorkspaceColor(wsId)?.id ?? null);
  }, [wsId]);

  const pick = (colorId: string | null) => {
    setWorkspaceColor(wsId, colorId);
    setCurrentId(colorId);
    requestAnimationFrame(onClose);
  };

  const startChat = () => {
    onNewChat(wsId, nameAnchor);
    onClose();
  };

  const stopBubble = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return createPortal(
    <>
      <div className="ws-color-overlay" onClick={onClose} />
      <div
        className="ws-color-popover liquid-glass"
        style={{ left: x, top: y }}
        role="menu"
        aria-label="Workspace actions"
        onPointerDown={stopBubble}
      >
        <button
          type="button"
          className="ws-color-new-chat"
          onClick={startChat}
        >
          <AIIcon size={14} />
          <span>New chat here</span>
        </button>
        <div className="ws-color-divider" role="separator" />
        <div className="ws-color-grid">
          {WORKSPACE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`ws-color-swatch ${currentId === c.id ? "active" : ""}`}
              style={{ background: c.hex }}
              title={c.label}
              aria-label={c.label}
              onPointerDown={stopBubble}
              onClick={() => pick(c.id)}
            />
          ))}
        </div>
        <button
          type="button"
          className="ws-color-clear"
          onClick={() => pick(null)}
        >
          No color
        </button>
      </div>
    </>,
    document.body,
  );
}
