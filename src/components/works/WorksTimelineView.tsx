import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { buildWorksListGroups } from "../../worksListGroups";
import type { WorkItem, WorkModule, WorkStory } from "../../works";
import { storyLabel } from "../../works";
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
import { worksStoryAccentStyle } from "./worksStoryRowStyle";

type Props = {
  items: WorkItem[];
  stories: WorkStory[];
  modules: WorkModule[];
  selectedId: string | null;
  selectedStoryId: string | null;
  storyAccent?: string | null;
  onOpen: (id: string) => void;
  onOpenStory: (id: string) => void;
  onItemContextMenu: (id: string, e: React.MouseEvent) => void;
  onStoryContextMenu: (id: string, e: React.MouseEvent) => void;
  onDatesChange: (id: string, startDate: string, targetDate: string) => void;
};

type TimelineRow =
  | { kind: "story"; story: WorkStory }
  | {
      kind: "work";
      item: WorkItem;
      start: number;
      end: number;
      nested: boolean;
    };

const LIST_W = 300;
const ROW_H = 40;

function buildTimelineRows(
  groups: ReturnType<typeof buildWorksListGroups>,
  dated: Map<string, { start: number; end: number }>,
): TimelineRow[] {
  const rows: TimelineRow[] = [];
  for (const g of groups) {
    if (g.kind === "story") {
      rows.push({ kind: "story", story: g.story });
      const kids = [...g.children].sort(
        (a, b) =>
          (dated.get(a.id)?.start ?? a.createdAt) -
          (dated.get(b.id)?.start ?? b.createdAt),
      );
      for (const w of kids) {
        const range = dated.get(w.id) ?? itemRange(w);
        rows.push({ kind: "work", item: w, ...range, nested: true });
      }
      continue;
    }
    const range = dated.get(g.item.id) ?? itemRange(g.item);
    rows.push({ kind: "work", item: g.item, ...range, nested: false });
  }
  return rows;
}

export function WorksTimelineView({
  items,
  stories,
  modules,
  selectedId,
  selectedStoryId,
  storyAccent,
  onOpen,
  onOpenStory,
  onItemContextMenu,
  onStoryContextMenu,
  onDatesChange,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const listBodyRef = useRef<HTMLDivElement>(null);
  const chartBodyRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [chartW, setChartW] = useState(600);
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(Date.now()));

  const dated = useMemo(() => {
    const map = new Map<string, { start: number; end: number }>();
    for (const w of items) map.set(w.id, itemRange(w));
    return map;
  }, [items]);

  const rows = useMemo(() => {
    const groups = buildWorksListGroups(stories, items, modules, "");
    return buildTimelineRows(groups, dated);
  }, [stories, items, modules, dated]);

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

  if (rows.length === 0) {
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
  const accentStyle = worksStoryAccentStyle(storyAccent);

  return (
    <div
      className="works-timeline-plane"
      style={{ "--works-timeline-list-w": `${LIST_W}px` } as CSSProperties}
    >
      <div className="works-timeline-list-corner" aria-hidden />

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

      <div className="works-timeline-list-head works-table-head">
        <span>Stories & work</span>
        <span>Duration</span>
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

      <div className="works-timeline-list">
        <div
          ref={listBodyRef}
          className="works-timeline-list-body"
          onScroll={(e) => syncScroll("list", e.currentTarget.scrollTop)}
        >
          {rows.map((row) =>
            row.kind === "story" ? (
              <button
                key={`story-${row.story.id}`}
                type="button"
                className={`works-timeline-list-row works-timeline-list-row--story${
                  selectedStoryId === row.story.id ? " active" : ""
                }`}
                style={{ height: ROW_H, ...accentStyle }}
                onClick={() => onOpenStory(row.story.id)}
                onContextMenu={(e) => onStoryContextMenu(row.story.id, e)}
              >
                <span className="works-timeline-item-title">
                  <span
                    className="brain-hit-icon works-story-hit-icon"
                    aria-hidden
                  >
                    <Icon name="users" size={13} />
                  </span>
                  <span className="works-list-id">{row.story.shortId}</span>
                  <span className="works-list-title">{row.story.title}</span>
                </span>
                <span
                  className={`works-story-pill works-story-pill--${row.story.status}`}
                >
                  {storyLabel(row.story.status)}
                </span>
              </button>
            ) : (
              <button
                key={row.item.id}
                type="button"
                className={`works-timeline-list-row${
                  row.nested ? " works-timeline-list-row--nested" : ""
                }${selectedId === row.item.id ? " active" : ""}`}
                style={{ height: ROW_H }}
                onClick={() => onOpen(row.item.id)}
                onContextMenu={(e) => onItemContextMenu(row.item.id, e)}
              >
                <span className="works-timeline-item-title">
                  <span className="works-list-id">{row.item.shortId}</span>
                  <span className="works-list-title">{row.item.title}</span>
                </span>
                <span className="works-timeline-duration">
                  {durationLabel(row.start, row.end)}
                </span>
              </button>
            ),
          )}
        </div>
      </div>

      <div ref={chartRef} className="works-timeline-chart-area">
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
          {rows.map((row) =>
            row.kind === "story" ? (
              <div
                key={`chart-story-${row.story.id}`}
                className="works-timeline-chart-row works-timeline-chart-row--story"
                style={{ height: ROW_H }}
                aria-hidden
              />
            ) : (
              <TimelineBar
                key={row.item.id}
                item={row.item}
                start={row.start}
                end={row.end}
                weekStart={weekAnchor}
                dayW={dayW}
                rowH={ROW_H}
                active={selectedId === row.item.id}
                onOpen={() => onOpen(row.item.id)}
                onContextMenu={(e) => onItemContextMenu(row.item.id, e)}
                onDatesChange={(s, t) => onDatesChange(row.item.id, s, t)}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}
