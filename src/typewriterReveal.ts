/** Steady char reveal — never dump multi-word chunks (feels like blocks). */
export const BASE_CHARS_PER_SEC = 54;
export const MAX_CHARS_PER_FRAME = 2;

export function charsToReveal(lag: number, elapsedMs: number): number {
  if (lag <= 0) return 0;
  const boost = 1 + Math.min(3, lag / 140);
  const rate = BASE_CHARS_PER_SEC * boost;
  const budget = Math.floor((elapsedMs / 1000) * rate);
  return Math.min(lag, Math.max(1, Math.min(budget, MAX_CHARS_PER_FRAME)));
}
