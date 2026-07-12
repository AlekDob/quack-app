import { useRef } from "react";
import type { WorkItem } from "../../works";
import { statusLabel } from "../../works";
import { DAY_MS, tsToIsoDate } from "../../worksTimelineDates";

type DragMode = "move" | "resize-start" | "resize-end";

type Props = {
  item: WorkItem;
  start: number;
  end: number;
  weekStart: number;
  dayW: number;
  rowH: number;
  active: boolean;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDatesChange: (startDate: string, targetDate: string) => void;
};

function applyDrag(
  mode: DragMode,
  deltaDays: number,
  origStart: number,
  origEnd: number,
): { start: number; end: number } {
  if (mode === "move") {
    return {
      start: origStart + deltaDays * DAY_MS,
      end: origEnd + deltaDays * DAY_MS,
    };
  }
  if (mode === "resize-start") {
    const start = Math.min(origStart + deltaDays * DAY_MS, origEnd);
    return { start, end: origEnd };
  }
  const end = Math.max(origEnd + deltaDays * DAY_MS, origStart);
  return { start: origStart, end };
}

export function TimelineBar({
  item,
  start,
  end,
  weekStart,
  dayW,
  rowH,
  active,
  onOpen,
  onContextMenu,
  onDatesChange,
}: Props) {
  const movedRef = useRef(false);

  const left = ((start - weekStart) / DAY_MS) * dayW;
  const width = Math.max(dayW * 0.45, ((end - start) / DAY_MS + 1) * dayW);

  const beginDrag = (e: React.PointerEvent, mode: DragMode) => {
    e.preventDefault();
    e.stopPropagation();
    movedRef.current = false;
    const bar = (e.target as HTMLElement).closest(
      ".works-timeline-bar",
    ) as HTMLElement | null;
    if (!bar) return;
    const startX = e.clientX;
    const origStart = start;
    const origEnd = end;
    let last = { start: origStart, end: origEnd };

    const onMove = (ev: PointerEvent) => {
      if (Math.abs(ev.clientX - startX) > 3) movedRef.current = true;
      const deltaDays = Math.round((ev.clientX - startX) / dayW);
      last = applyDrag(mode, deltaDays, origStart, origEnd);
      const l = ((last.start - weekStart) / DAY_MS) * dayW;
      const w = Math.max(
        dayW * 0.45,
        ((last.end - last.start) / DAY_MS + 1) * dayW,
      );
      bar.style.left = `${l}px`;
      bar.style.width = `${w}px`;
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      bar.classList.remove("dragging");
      if (!movedRef.current) return;
      onDatesChange(tsToIsoDate(last.start), tsToIsoDate(last.end));
      window.setTimeout(() => {
        movedRef.current = false;
      }, 80);
    };

    bar.classList.add("dragging");
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const onRowClick = () => {
    if (movedRef.current) return;
    onOpen();
  };

  return (
    <div
      className={`works-timeline-chart-row${active ? " active" : ""}`}
      style={{ height: rowH }}
      onClick={onRowClick}
      onContextMenu={onContextMenu}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <div
        className={`works-timeline-bar works-timeline-bar--${item.status}`}
        style={{ left, width }}
        title={`${item.shortId} · ${statusLabel(item.status)}`}
        onPointerDown={(e) => beginDrag(e, "move")}
      >
        <span
          className="works-timeline-bar-handle works-timeline-bar-handle--start"
          onPointerDown={(e) => beginDrag(e, "resize-start")}
        />
        <span className="works-timeline-bar-label">{item.shortId}</span>
        <span
          className="works-timeline-bar-handle works-timeline-bar-handle--end"
          onPointerDown={(e) => beginDrag(e, "resize-end")}
        />
      </div>
    </div>
  );
}
