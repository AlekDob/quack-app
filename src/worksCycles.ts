// Weekly cycles (Plane-style) — auto ISO weeks + custom cycles.

import {
  DAY_MS,
  parseDay,
  startOfWeek,
  tsToIsoDate,
  weekLabel,
} from "./worksTimelineDates";
import {
  newId,
  type CycleStatus,
  type WorkCycle,
  type WorkItem,
  type WorksSnapshot,
} from "./works";

export interface CycleProgress {
  completed: number;
  started: number;
  unstarted: number;
  cancelled: number;
  total: number;
}

export interface BurndownPoint {
  date: string;
  remaining: number;
  ideal: number;
}

function isoWeekNum(weekStart: number): number {
  const d = new Date(weekStart);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
}

function cycleName(weekStart: number): string {
  return `Week ${isoWeekNum(weekStart)} — ${weekLabel(weekStart)}`;
}

function statusForWeek(weekStart: number, now: number): CycleStatus {
  const current = startOfWeek(now);
  if (weekStart < current) return "completed";
  if (weekStart > current) return "upcoming";
  return "active";
}

function normalizeCycle(c: WorkCycle, now: number): WorkCycle {
  const start = parseDay(c.startDate) ?? Date.now();
  const status = c.auto ? statusForWeek(startOfWeek(start), now) : c.status;
  return { ...c, status, auto: c.auto ?? false };
}

export function itemsInCycle(snap: WorksSnapshot, cycleId: string): WorkItem[] {
  return snap.items.filter((w) => w.cycleId === cycleId);
}

export function cycleProgress(
  snap: WorksSnapshot,
  cycleId: string,
): CycleProgress {
  const items = itemsInCycle(snap, cycleId);
  let completed = 0;
  let started = 0;
  let unstarted = 0;
  let cancelled = 0;
  for (const w of items) {
    if (w.status === "done") completed++;
    else if (w.status === "cancelled") cancelled++;
    else if (w.status === "in_progress" || w.status === "todo") started++;
    else unstarted++;
  }
  return { completed, started, unstarted, cancelled, total: items.length };
}

export function cycleBurndown(
  snap: WorksSnapshot,
  cycle: WorkCycle,
): BurndownPoint[] {
  const start = parseDay(cycle.startDate);
  const end = parseDay(cycle.endDate);
  if (start == null || end == null) return [];
  const items = itemsInCycle(snap, cycle.id).filter(
    (w) => w.status !== "cancelled",
  );
  const total = items.length;
  const days = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  const points: BurndownPoint[] = [];
  for (let i = 0; i < days; i++) {
    const dayTs = start + i * DAY_MS;
    const date = tsToIsoDate(dayTs);
    const done = items.filter((w) => w.status === "done").length;
    const remaining = total - done;
    const ideal = Math.max(0, total - (total * i) / Math.max(days - 1, 1));
    points.push({ date, remaining, ideal: Math.round(ideal * 10) / 10 });
  }
  return points;
}

export function ensureWeeklyCycles(
  snap: WorksSnapshot,
  now = Date.now(),
): { snap: WorksSnapshot; changed: boolean } {
  const current = startOfWeek(now);
  const offsets = [-1, 0, 1];
  let changed = false;
  const cycles = snap.cycles.map((c) => normalizeCycle(c, now));

  for (const offset of offsets) {
    const weekStart = current + offset * 7 * DAY_MS;
    const startDate = tsToIsoDate(weekStart);
    const endDate = tsToIsoDate(weekStart + 6 * DAY_MS);
    const hit = cycles.find((c) => c.auto && c.startDate === startDate);
    const status = statusForWeek(weekStart, now);
    const name = cycleName(weekStart);
    if (hit) {
      if (hit.name !== name || hit.endDate !== endDate || hit.status !== status) {
        const idx = cycles.indexOf(hit);
        cycles[idx] = { ...hit, name, endDate, status };
        changed = true;
      }
    } else {
      cycles.push({ id: newId(), name, startDate, endDate, status, auto: true });
      changed = true;
    }
  }

  const normalized = cycles.map((c) => {
    const next = normalizeCycle(c, now);
    if (next.status !== c.status) changed = true;
    return next;
  });

  if (!changed && snap.cycles.length === normalized.length) {
    return { snap, changed: false };
  }
  return { snap: { ...snap, cycles: normalized }, changed: true };
}

export function activeCycle(snap: WorksSnapshot): WorkCycle | undefined {
  return snap.cycles.find((c) => c.status === "active");
}

export function cyclesByStatus(snap: WorksSnapshot): {
  active: WorkCycle[];
  upcoming: WorkCycle[];
  completed: WorkCycle[];
} {
  const active: WorkCycle[] = [];
  const upcoming: WorkCycle[] = [];
  const completed: WorkCycle[] = [];
  for (const c of snap.cycles) {
    if (c.status === "active") active.push(c);
    else if (c.status === "upcoming") upcoming.push(c);
    else completed.push(c);
  }
  const byStart = (a: WorkCycle, b: WorkCycle) =>
    (parseDay(a.startDate) ?? 0) - (parseDay(b.startDate) ?? 0);
  active.sort(byStart);
  upcoming.sort(byStart);
  completed.sort((a, b) => (parseDay(b.startDate) ?? 0) - (parseDay(a.startDate) ?? 0));
  return { active, upcoming, completed };
}
