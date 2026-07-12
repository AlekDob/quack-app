import { createPortal } from "react-dom";
import {
  barIconSegments,
  getActivityBarView,
  type ActivityBarIconId,
} from "../activityBarViews";
import { useActivityBarPopoverPosition } from "../useActivityBarPopoverPosition";
import { Icon } from "./Icon";

interface Props {
  anchor: DOMRect;
  open: boolean;
  ids: ActivityBarIconId[];
  gitChangeCount: number;
  isActive: (id: ActivityBarIconId) => boolean;
  onPick: (id: ActivityBarIconId) => void;
  onCustomize: () => void;
  onClose: () => void;
}

function RowIcon({ id }: { id: ActivityBarIconId }) {
  const def = getActivityBarView(id);
  return <Icon name={def.icon} size={18} />;
}

export function ActivityBarMorePopover({
  anchor,
  open,
  ids,
  gitChangeCount,
  isActive,
  onPick,
  onCustomize,
  onClose,
}: Props) {
  const { ref, style } = useActivityBarPopoverPosition(anchor, open, 220, ids.length);
  const segments = barIconSegments(ids);

  return createPortal(
    <>
      <div className="menu-overlay" onClick={onClose} />
      <div
        ref={ref}
        className="menu-dropdown ab-more-popover liquid-glass"
        style={style}
        role="menu"
        aria-label="More activity bar items"
      >
        <div className="ab-more-popover-title">More</div>
        {segments.map((seg, i) => {
          if (seg.kind === "sep") {
            return <div key={`sep-${i}`} className="menu-separator" role="separator" />;
          }
          const id = seg.id;
          const def = getActivityBarView(id);
          const gitBadge = def.showGitBadge && gitChangeCount > 0;
          return (
            <button
              key={id}
              type="button"
              className={`menu-item ab-more-popover-row ab-more-popover-row--${def.kind}${
                isActive(id) ? " active" : ""
              }`}
              role="menuitem"
              onClick={() => {
                onPick(id);
                onClose();
              }}
            >
              <span className="ab-more-popover-icon" aria-hidden="true">
                <RowIcon id={id} />
                {gitBadge && (
                  <span className="activity-badge">
                    {gitChangeCount > 99 ? "99+" : gitChangeCount}
                  </span>
                )}
              </span>
              <span className="menu-item-label">{def.label}</span>
              <span className="ab-more-popover-kind">
                {def.kind === "sidebar" ? "Sidebar" : "Tab"}
              </span>
            </button>
          );
        })}
        <div className="menu-separator" />
        <button
          type="button"
          className="menu-item ab-more-popover-customize"
          role="menuitem"
          onClick={() => {
            onCustomize();
            onClose();
          }}
        >
          <Icon name="grip-vertical" size={16} />
          <span className="menu-item-label">Customize activity bar…</span>
        </button>
      </div>
    </>,
    document.body,
  );
}
