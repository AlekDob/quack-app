import { createPortal } from "react-dom";
import {
  WORKSPACE_COLORS,
  getWorkspaceColor,
  setWorkspaceColor,
} from "../workspaceColors";

interface Props {
  wsId: string;
  /** Screen coords to anchor the popover near (usually the icon's edge). */
  x: number;
  y: number;
  onClose: () => void;
}

// Right-click popover to pick / clear a project's color. Color is the one
// chromatic touch in an otherwise neutral chrome (see workspaceColors.ts).
export function WorkspaceColorPopover({ wsId, x, y, onClose }: Props) {
  const current = getWorkspaceColor(wsId);

  const pick = (colorId: string | null) => {
    setWorkspaceColor(wsId, colorId);
    onClose();
  };

  return createPortal(
    <>
      <div className="ws-color-overlay" onClick={onClose} />
      <div
        className="ws-color-popover liquid-glass"
        style={{ left: x, top: y }}
        role="menu"
        aria-label="Workspace color"
      >
        <div className="ws-color-grid">
          {WORKSPACE_COLORS.map((c) => (
            <button
              key={c.id}
              className={`ws-color-swatch ${current?.id === c.id ? "active" : ""}`}
              style={{ background: c.hex }}
              title={c.label}
              aria-label={c.label}
              onClick={() => pick(c.id)}
            />
          ))}
        </div>
        <button className="ws-color-clear" onClick={() => pick(null)}>
          No color
        </button>
      </div>
    </>,
    document.body,
  );
}
