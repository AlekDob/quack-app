/**
 * Cron Utilities
 *
 * Parsing cron expressions, calculating next fire time,
 * and generating human-readable descriptions.
 * Uses local timezone (system clock) for all calculations.
 *
 * @module cronUtils
 */

// ─── Cron Presets ───────────────────────────────────────────────────

export interface CronPreset {
  label: string;
  description: string;
  expression: string;
}

export const CRON_PRESETS: CronPreset[] = [
  { label: 'Every day', description: 'At 09:00', expression: '0 9 * * *' },
  { label: 'Mon-Fri', description: 'At 09:00', expression: '0 9 * * 1-5' },
  { label: 'Weekly', description: 'Monday at 09:00', expression: '0 9 * * 1' },
  { label: 'Monthly', description: '1st at 09:00', expression: '0 9 1 * *' },
  { label: 'Every 6 hours', description: '00:00, 06:00, 12:00, 18:00', expression: '0 */6 * * *' },
];

// ─── Parsing ────────────────────────────────────────────────────────

interface CronParts {
  minute: string;
  hour: string;
  dayOfMonth: string;
  month: string;
  dayOfWeek: string;
}

function parseCron(expression: string): CronParts | null {
  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  return {
    minute: parts[0],
    hour: parts[1],
    dayOfMonth: parts[2],
    month: parts[3],
    dayOfWeek: parts[4],
  };
}

// ─── Validation ─────────────────────────────────────────────────────

export function isValidCron(expression: string): boolean {
  const parts = parseCron(expression);
  if (!parts) return false;

  const ranges: Record<keyof CronParts, [number, number]> = {
    minute: [0, 59],
    hour: [0, 23],
    dayOfMonth: [1, 31],
    month: [1, 12],
    dayOfWeek: [0, 7],
  };

  for (const [key, [min, max]] of Object.entries(ranges)) {
    if (!isValidField(parts[key as keyof CronParts], min, max)) return false;
  }
  return true;
}

function isValidField(field: string, min: number, max: number): boolean {
  if (field === '*') return true;
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return !isNaN(step) && step >= 1 && step <= max;
  }
  if (field.includes('-')) {
    const [lo, hi] = field.split('-').map(Number);
    return !isNaN(lo) && !isNaN(hi) && lo >= min && hi <= max && lo <= hi;
  }
  if (field.includes(',')) {
    return field.split(',').every(v => {
      const n = parseInt(v, 10);
      return !isNaN(n) && n >= min && n <= max;
    });
  }
  const n = parseInt(field, 10);
  return !isNaN(n) && n >= min && n <= max;
}

// ─── Next Fire Calculation ──────────────────────────────────────────

function fieldMatches(field: string, value: number): boolean {
  if (field === '*') return true;
  if (field.startsWith('*/')) {
    const step = parseInt(field.slice(2), 10);
    return value % step === 0;
  }
  if (field.includes('-')) {
    const [lo, hi] = field.split('-').map(Number);
    return value >= lo && value <= hi;
  }
  if (field.includes(',')) {
    return field.split(',').some(v => parseInt(v, 10) === value);
  }
  return parseInt(field, 10) === value;
}

/**
 * Calculate next fire time from a cron expression.
 * Uses LOCAL timezone (new Date() uses system clock).
 * Scans minute-by-minute up to 366 days ahead.
 *
 * @param inclusive - If true, includes the current minute in the search.
 *   Use `true` when creating a new job (so it can fire this minute).
 *   Use `false` (default) after firing, to advance to the NEXT occurrence.
 */
export function getNextFireTime(expression: string, fromDate?: Date, inclusive = false): number | null {
  const parts = parseCron(expression);
  if (!parts) return null;

  const start = fromDate ? new Date(fromDate) : new Date();
  start.setSeconds(0, 0);
  if (!inclusive) {
    start.setMinutes(start.getMinutes() + 1);
  }

  const maxIterations = 366 * 24 * 60;
  const candidate = new Date(start);

  for (let i = 0; i < maxIterations; i++) {
    const minute = candidate.getMinutes();
    const hour = candidate.getHours();
    const dom = candidate.getDate();
    const month = candidate.getMonth() + 1;
    const dow = candidate.getDay();

    if (
      fieldMatches(parts.minute, minute) &&
      fieldMatches(parts.hour, hour) &&
      fieldMatches(parts.dayOfMonth, dom) &&
      fieldMatches(parts.month, month) &&
      fieldMatches(parts.dayOfWeek, dow)
    ) {
      return candidate.getTime();
    }
    candidate.setMinutes(candidate.getMinutes() + 1);
  }
  return null;
}

// ─── Human-Readable Description ─────────────────────────────────────

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function cronToHumanReadable(expression: string): string {
  const parts = parseCron(expression);
  if (!parts) return expression;

  const time = formatTime(parts.hour, parts.minute);

  if (parts.hour.startsWith('*/') && parts.minute === '0') {
    const step = parts.hour.slice(2);
    return `Every ${step} hours`;
  }

  if (parts.dayOfMonth === '*' && parts.month === '*' && parts.dayOfWeek === '*') {
    return `Every day at ${time}`;
  }

  if (parts.dayOfWeek === '1-5' && parts.dayOfMonth === '*' && parts.month === '*') {
    return `Mon-Fri at ${time}`;
  }

  if (parts.dayOfWeek !== '*' && parts.dayOfMonth === '*') {
    const dayNum = parseInt(parts.dayOfWeek, 10);
    if (!isNaN(dayNum) && dayNum >= 0 && dayNum <= 6) {
      return `Every ${DAY_NAMES[dayNum]} at ${time}`;
    }
  }

  if (parts.dayOfMonth !== '*' && parts.month === '*' && parts.dayOfWeek === '*') {
    return `Monthly on the ${parts.dayOfMonth}th at ${time}`;
  }

  return expression;
}

function formatTime(hourField: string, minuteField: string): string {
  const h = hourField === '*' ? '**' : hourField.padStart(2, '0');
  const m = minuteField === '*' ? '**' : minuteField.padStart(2, '0');
  return `${h}:${m}`;
}

// ─── ID Generation ──────────────────────────────────────────────────

export function generateAutomationId(): string {
  return `auto-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

export function generateRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
