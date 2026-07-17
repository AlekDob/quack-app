// Features Gantt — one bar per feature using startDate/endDate (or created).

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { FeatureEntry } from "../../featureCatalog";
import { setFeatureFrontmatterField, writeFeatureMd } from "../../featureCatalog";
import { fs } from "../../ipc";
import { joinPath } from "../../pathUtils";
import {
  DAY_MS,
  durationLabel,
  featureRange,
  fmtDay,
  startOfWeek,
  tsToIsoDate,
  weekLabel,
} from "../../worksTimelineDates";
import { Icon } from "../Icon";
import { errMsg, error as toastError } from "../../notify";

type Props = {
  root: string;
  features: FeatureEntry[];
  selectedPath: string | null;
  onOpen: (f: FeatureEntry) => void;
  onDatesSaved: () => void;
};

const LIST_W = 280;
const ROW_H = 40;

type DragMode = "move" | "resize-start" | "resize-end";

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
    return {
      start: Math.min(origStart + deltaDays * DAY_MS, origEnd),
      end: origEnd,
    };
  }
  return {
    start: origStart,
    end: Math.max(origEnd + deltaDays * DAY_MS, origStart),
  };
}

function FeatureBar({
  feat,
  start,
  end,
  weekStart,
  dayW,
  active,
  onOpen,
  onDatesChange,
}: {
  feat: FeatureEntry;
  start: number;
  end: number;
  weekStart: number;
  dayW: number;
  active: boolean;
  onOpen: () => void;
  onDatesChange: (startDate: string, endDate: string) => void;
}) {
  const movedRef = useRef(false);
  const left = ((start - weekStart) / DAY_MS) * dayW;
  const width = Math.max(dayW * 0.45, ((end - start) / DAY_MS + 1) * dayW);
  const done = feat.status === "done" || feat.status === "archived";

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
      bar.classList.add("dragging");
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      bar.classList.remove("dragging");
      if (!movedRef.current) {
        onOpen();
        return;
      }
      onDatesChange(tsToIsoDate(last.start), tsToIsoDate(last.end));
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      className={`works-timeline-chart-row${active ? " active" : ""}`}
      style={{ height: ROW_H }}
    >
      <div
        className={`works-timeline-bar${done ? " is-done" : ""}`}
        style={{ left, width }}
        onPointerDown={(e) => beginDrag(e, "move")}
        title={`${feat.title} · ${durationLabel(start, end)}`}
      >
        <span
          className="works-timeline-bar-handle start"
          onPointerDown={(e) => beginDrag(e, "resize-start")}
        />
        <span className="works-timeline-bar-label">
          {feat.featureNum != null
            ? String(feat.featureNum).padStart(3, "0")
            : feat.slug.slice(0, 8)}
        </span>
        <span
          className="works-timeline-bar-handle end"
          onPointerDown={(e) => beginDrag(e, "resize-end")}
        />
      </div>
    </div>
  );
}

export function FeaturesTimelineView({
  root,
  features,
  selectedPath,
  onOpen,
  onDatesSaved,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const listBodyRef = useRef<HTMLDivElement>(null);
  const chartBodyRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);
  const [chartW, setChartW] = useState(600);
  const [weekAnchor, setWeekAnchor] = useState(() => startOfWeek(Date.now()));

  const rows = useMemo(() => {
    return [...features]
      .map((f) => ({ feat: f, ...featureRange(f) }))
      .sort((a, b) => a.start - b.start || (a.feat.featureNum ?? 0) - (b.feat.featureNum ?? 0));
  }, [features]);

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
    const peer = from === "list" ? chartBodyRef.current : listBodyRef.current;
    if (peer) peer.scrollTop = top;
    requestAnimationFrame(() => {
      syncing.current = false;
    });
  };

  const saveDates = async (f: FeatureEntry, startDate: string, endDate: string) => {
    try {
      const abs = joinPath(root, f.path);
      let md = await fs.readFile(abs);
      md = setFeatureFrontmatterField(md, "startDate", startDate);
      md = setFeatureFrontmatterField(md, "endDate", endDate);
      await writeFeatureMd(root, f.path, md);
      onDatesSaved();
    } catch (e) {
      toastError(`Couldn't save dates: ${errMsg(e)}`);
    }
  };

  if (rows.length === 0) {
    return (
      <div className="works-empty works-empty--center">
        <div className="works-empty-title">No features yet</div>
        <div className="works-empty-hint">
          Add a feature to see it on the timeline. Bars use startDate / endDate.
        </div>
      </div>
    );
  }

  const weekDays = Array.from({ length: 7 }, (_, i) => weekAnchor + i * DAY_MS);
  const isCurrentWeek = weekAnchor === weekOfToday;

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
        <span>Feature</span>
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
          {rows.map(({ feat, start, end }) => (
            <button
              key={feat.slug}
              type="button"
              className={`works-timeline-list-row${
                selectedPath === feat.path ? " active" : ""
              }`}
              style={{ height: ROW_H }}
              onClick={() => onOpen(feat)}
            >
              <span className="works-timeline-item-title">
                {feat.featureNum != null && (
                  <span className="works-list-id">
                    {String(feat.featureNum).padStart(3, "0")}
                  </span>
                )}
                <span className="works-list-title">{feat.title}</span>
              </span>
              <span className="works-timeline-duration">
                {durationLabel(start, end)}
              </span>
            </button>
          ))}
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
          {rows.map(({ feat, start, end }) => (
            <FeatureBar
              key={feat.slug}
              feat={feat}
              start={start}
              end={end}
              weekStart={weekAnchor}
              dayW={dayW}
              active={selectedPath === feat.path}
              onOpen={() => onOpen(feat)}
              onDatesChange={(s, t) => void saveDates(feat, s, t)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
