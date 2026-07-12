import { useEffect, useMemo, useRef, useState } from "react";
import type { WorkItem } from "../../works";
import {
  DAY_MS,
  durationLabel,
  fmtDay,
  itemRange,
  startOfWeek,
  weekLabel,
} from "../../worksTimelineDates";
import { Icon } from "../Icon";
import { TimelineBar } from "./TimelineBar";

type Props = {
  items: WorkItem[];
  selectedId: string | null;
  onOpen: (id: string) => void;
  onItemContextMenu: (id: string, e: React.MouseEvent) => void;
  onDatesChange: (id: string, startDate: string, targetDate: string) => void;
};

const LIST_W = 300;
const ROW_H = 40;

export function WorksTimelineView({
  items,
  selectedId,
  onOpen,
  onItemContextMenu,
  onDatesChange,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const listBodyRef = useRef<HTMLDivElement>(null);
  const chartBodyRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [chartW, setChartW] = useState(600);
  const [weekAnchor, setWeekAnchor] = useState(() =>
    startOfWeek(Date.now()),
  );

  const dated = useMemo(
    () =>
      items
        .map((w) => {
          const { start, end } = itemRange(w);
          return { w, start, end };
        })
        .sort((a, b) => a.start - b.start),
    [items],
  );

  const weekOfToday = startOfWeek(Date.now());
  const todayDay = (() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  })();
  const dayW = chartW / 7;
  const todayLeft =
    weekAnchor <= todayDay && todayDay < weekAnchor + 7 * DAY_MS
      ? ((todayDay - weekAnchor) / DAY_MS) * dayW + dayW / 2
      : null;

  useEffect(() => {
    const el = chartRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setChartW(el.clientWidth));
    ro.observe(el);
    setChartW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const syncScroll = (from: "list" | "chart", top: number) => {
    if (syncing.current) return;
    syncing.current = true;
    const peer =
      from === "list" ? chartBodyRef.current : listBodyRef.current;
    if (peer) peer.scrollTop = top;
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  if (dated.length === 0) {
    return (
      <div className="works-empty works-empty--center">
        <div className="works-empty-title">No timeline data</div>
        <div className="works-empty-hint">
          Set start and target dates on work items to see the Gantt view.
        </div>
      </div>
    );
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => weekAnchor + i * DAY_MS);
  const isCurrentWeek = weekAnchor === weekOfToday;

  return (
    <div className="works-timeline-plane">
      <div className="works-timeline-list" style={{ width: LIST_W }}>
        <div className="works-table-head">
          <span>Work items</span>
          <span>Duration</span>
        </div>
        <div
          ref={listBodyRef}
          className="works-timeline-list-body"
          onScroll={(e) => syncScroll("list", e.currentTarget.scrollTop)}
        >
          {dated.map(({ w, start, end }) => (
            <button
              key={w.id}
              type="button"
              className={`works-timeline-list-row${
                selectedId === w.id ? " active" : ""
              }`}
              style={{ height: ROW_H }}
              onClick={() => onOpen(w.id)}
              onContextMenu={(e) => onItemContextMenu(w.id, e)}
            >
              <span className="works-timeline-item-title">
                <span className="works-list-id">{w.shortId}</span>
                <span className="works-list-title">{w.title}</span>
              </span>
              <span className="works-timeline-duration">
                {durationLabel(start, end)}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div ref={chartRef} className="works-timeline-chart works-timeline-chart--week">
        <div className="works-timeline-week-nav">
          <button
            type="button"
            className="works-timeline-nav-btn"
            aria-label="Previous week"
            onClick={() => setWeekAnchor((w) => w - 7 * DAY_MS)}
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <span className="works-timeline-week-nav-label">
            {weekLabel(weekAnchor)}
          </span>
          <button
            type="button"
            className="works-timeline-nav-btn"
            aria-label="Next week"
            onClick={() => setWeekAnchor((w) => w + 7 * DAY_MS)}
          >
            <Icon name="chevron-right" size={14} />
          </button>
          {!isCurrentWeek && (
            <button
              type="button"
              className="works-timeline-nav-today"
              onClick={() => setWeekAnchor(weekOfToday)}
            >
              Today
            </button>
          )}
        </div>

        <div className="works-timeline-week-head">
          {weekDays.map((d) => (
            <span
              key={d}
              className={`works-timeline-day${d === todayDay ? " today" : ""}`}
              style={{ width: `${100 / 7}%` }}
            >
              {fmtDay(d)}
            </span>
          ))}
        </div>

        <div
          ref={chartBodyRef}
          className="works-timeline-chart-body"
          onScroll={(e) => syncScroll("chart", e.currentTarget.scrollTop)}
        >
          {todayLeft != null && (
            <span
              className="works-timeline-today-line"
              style={{ left: todayLeft }}
              aria-hidden
            />
          )}
          {dated.map(({ w, start, end }) => (
            <TimelineBar
              key={w.id}
              item={w}
              start={start}
              end={end}
              weekStart={weekAnchor}
              dayW={dayW}
              rowH={ROW_H}
              active={selectedId === w.id}
              onOpen={() => onOpen(w.id)}
              onContextMenu={(e) => onItemContextMenu(w.id, e)}
              onDatesChange={(s, t) => onDatesChange(w.id, s, t)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
