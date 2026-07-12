import { useMemo } from "react";
import {
  cycleBurndown,
  cycleProgress,
  cyclesByStatus,
  itemsInCycle,
} from "../../worksCycles";
import { cycleStatusLabel, type WorkCycle, type WorksSnapshot } from "../../works";
import {
  WorksCycleBurndown,
  WorksCyclePriorityList,
  WorksCycleProgress,
} from "./WorksCycleCharts";

type Props = {
  snap: WorksSnapshot;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onOpenWork: (id: string) => void;
};

function CycleRow({
  cycle,
  active,
  itemCount,
  onSelect,
}: {
  cycle: WorkCycle;
  active: boolean;
  itemCount: number;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`works-cycle-row${active ? " active" : ""}`}
      onClick={onSelect}
    >
      <span className="works-cycle-row-name">{cycle.name}</span>
      <span className="works-cycle-row-meta">
        {cycleStatusLabel(cycle.status)} · {itemCount} items
      </span>
    </button>
  );
}

export function WorksCyclesPanel({
  snap,
  selectedId,
  onSelect,
  onOpenWork,
}: Props) {
  const groups = useMemo(() => cyclesByStatus(snap), [snap]);
  const selected =
    snap.cycles.find((c) => c.id === selectedId) ??
    groups.active[0] ??
    groups.upcoming[0] ??
    groups.completed[0];

  if (!selected) {
    return (
      <div className="works-empty works-empty--center">
        <div className="works-empty-title">No cycles yet</div>
        <div className="works-empty-hint">
          Weekly cycles are created automatically when you open Works.
        </div>
      </div>
    );
  }

  const progress = cycleProgress(snap, selected.id);
  const burndown = cycleBurndown(snap, selected);
  const items = itemsInCycle(snap, selected.id)
    .filter((w) => w.status !== "cancelled")
    .sort((a, b) => {
      const rank = { urgent: 0, high: 1, medium: 2, low: 3 };
      return rank[a.priority] - rank[b.priority];
    })
    .slice(0, 12);

  const closedLabel = `${progress.completed}/${progress.total} work items closed`;

  return (
    <div className="works-cycles-layout">
      <aside className="works-cycles-list" aria-label="Cycles">
        {groups.active.length > 0 && (
          <section>
            <h4 className="works-cycles-group-title">Active cycle</h4>
            {groups.active.map((c) => (
              <CycleRow
                key={c.id}
                cycle={c}
                active={c.id === selected.id}
                itemCount={itemsInCycle(snap, c.id).length}
                onSelect={() => onSelect(c.id)}
              />
            ))}
          </section>
        )}
        {groups.upcoming.length > 0 && (
          <section>
            <h4 className="works-cycles-group-title">
              Upcoming cycle ({groups.upcoming.length})
            </h4>
            {groups.upcoming.map((c) => (
              <CycleRow
                key={c.id}
                cycle={c}
                active={c.id === selected.id}
                itemCount={itemsInCycle(snap, c.id).length}
                onSelect={() => onSelect(c.id)}
              />
            ))}
          </section>
        )}
        {groups.completed.length > 0 && (
          <section>
            <h4 className="works-cycles-group-title">
              Completed cycle ({groups.completed.length})
            </h4>
            {groups.completed.map((c) => (
              <CycleRow
                key={c.id}
                cycle={c}
                active={c.id === selected.id}
                itemCount={itemsInCycle(snap, c.id).length}
                onSelect={() => onSelect(c.id)}
              />
            ))}
          </section>
        )}
      </aside>
      <div className="works-cycle-detail">
        <header className="works-cycle-detail-head">
          <h2 className="works-cycle-detail-title">{selected.name}</h2>
          <span className="works-cycle-detail-dates">
            {selected.startDate} — {selected.endDate}
          </span>
        </header>
        <div className="works-cycle-dashboard">
          <WorksCycleProgress progress={progress} closedLabel={closedLabel} />
          <WorksCycleBurndown
            points={burndown}
            pending={progress.total - progress.completed}
          />
          <WorksCyclePriorityList
            items={items.map((w) => ({
              id: w.id,
              shortId: w.shortId,
              title: w.title,
              status: w.status,
              priority: w.priority,
            }))}
            onOpen={onOpenWork}
          />
        </div>
      </div>
    </div>
  );
}
