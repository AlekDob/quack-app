import { useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  getActivityBarView,
  type ActivityBarIconId,
} from "../activityBarViews";
import {
  moveActivityBarItem,
  useActivityBarPrefs,
} from "../activityBarPrefs";
import { usePointerListReorder } from "../usePointerListReorder";
import { useActivityBarPopoverPosition } from "../useActivityBarPopoverPosition";
import { Icon } from "./Icon";

interface Props {
  anchor: DOMRect;
  open: boolean;
  maxFit: number;
  onClose: () => void;
}

function RowIcon({ id }: { id: ActivityBarIconId }) {
  const def = getActivityBarView(id);
  return <Icon name={def.icon} size={16} />;
}

function CustomizeRow({
  id,
  index,
  zone,
  dragging,
  dragOver,
  onPointerDown,
}: {
  id: ActivityBarIconId;
  index: number;
  zone: "visible" | "more";
  dragging: boolean;
  dragOver: boolean;
  onPointerDown: (e: React.PointerEvent, index: number) => void;
}) {
  const def = getActivityBarView(id);
  return (
    <div
      data-ab-index={index}
      className={`ab-customize-row ${dragging ? "dragging" : ""} ${
        dragOver ? "drag-over" : ""
      }`}
      data-zone={zone}
    >
      <button
        type="button"
        className="ab-customize-grip"
        aria-label={`Drag ${def.label}`}
        onPointerDown={(e) => onPointerDown(e, index)}
      >
        <Icon name="grip-vertical" size={14} />
      </button>
      <span className="ab-customize-row-icon" aria-hidden="true">
        <RowIcon id={id} />
      </span>
      <span className="ab-customize-row-label">{def.label}</span>
    </div>
  );
}

export function ActivityBarCustomizePopover({
  anchor,
  open,
  maxFit,
  onClose,
}: Props) {
  const { order, visibleCount } = useActivityBarPrefs();
  const { ref, style } = useActivityBarPopoverPosition(
    anchor,
    open,
    260,
    order.length,
  );

  const onReorder = useCallback((from: number, to: number) => {
    moveActivityBarItem(from, to);
  }, []);

  const { drag, onPointerDown } = usePointerListReorder({
    dataAttr: "data-ab-index",
    bodyClass: "ab-dragging",
    onReorder,
  });

  const visibleIds = useMemo(
    () => order.slice(0, visibleCount),
    [order, visibleCount],
  );
  const moreIds = useMemo(
    () => order.slice(visibleCount),
    [order, visibleCount],
  );

  const renderRow = (id: ActivityBarIconId, index: number, zone: "visible" | "more") => (
    <CustomizeRow
      key={id}
      id={id}
      index={index}
      zone={zone}
      dragging={drag?.from === index}
      dragOver={!!drag && drag.over === index && drag.from !== index}
      onPointerDown={onPointerDown}
    />
  );

  return createPortal(
    <>
      <div className="menu-overlay" onClick={onClose} />
      <div
        ref={ref}
        className="ab-customize-popover liquid-glass"
        style={style}
        role="dialog"
        aria-label="Customize activity bar"
      >
        <div className="ab-customize-head">
          <div className="ab-customize-title">Customize activity bar</div>
          <button
            type="button"
            className="ab-customize-done"
            onClick={onClose}
          >
            Done
          </button>
        </div>
        {maxFit < order.length && (
          <p className="ab-customize-hint">
            {maxFit} icon{maxFit === 1 ? "" : "s"} fit on the bar at the
            current window height. Reorder to choose which show first.
          </p>
        )}
        <div className="ab-customize-zone ab-customize-zone--visible">
          <div className="ab-customize-zone-label">
            On activity bar ({visibleIds.length})
          </div>
          <div className="ab-customize-zone-list">
            {visibleIds.map((id, i) => renderRow(id, i, "visible"))}
          </div>
        </div>
        <div className="ab-customize-zone ab-customize-zone--more">
          <div className="ab-customize-zone-label">
            More menu ({moreIds.length})
          </div>
          <div className="ab-customize-zone-list">
            {moreIds.map((id, i) =>
              renderRow(id, visibleCount + i, "more"),
            )}
          </div>
        </div>
        <p className="ab-customize-foot">
          Drag to reorder priority. Move across zones to group favorites on
          the bar when space allows.
        </p>
      </div>
    </>,
    document.body,
  );
}
