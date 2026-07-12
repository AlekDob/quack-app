export const DAY_MS = 86_400_000;

export function parseDay(s?: string): number | null {
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isNaN(t) ? null : t;
}

export function dayStart(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function startOfWeek(ts: number): number {
  const dow = new Date(ts).getDay();
  return dayStart(ts - ((dow + 6) % 7) * DAY_MS);
}

export function tsToIsoDate(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function durationLabel(start: number, end: number): string {
  const days = Math.max(1, Math.round((end - start) / DAY_MS) + 1);
  return days === 1 ? "1 day" : `${days} days`;
}

export function fmtDay(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
  });
}

export function weekLabel(weekStart: number): string {
  const end = weekStart + 6 * DAY_MS;
  const a = new Date(weekStart);
  const b = new Date(end);
  const left = a.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  const right =
    a.getMonth() === b.getMonth()
      ? String(b.getDate())
      : b.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return `${left} – ${right}`;
}

export function itemRange(w: {
  startDate?: string;
  targetDate?: string;
  createdAt: number;
  updatedAt: number;
}): { start: number; end: number } {
  const start = dayStart(parseDay(w.startDate) ?? w.createdAt);
  const end = dayStart(parseDay(w.targetDate) ?? w.updatedAt);
  return { start, end: Math.max(end, start) };
}
