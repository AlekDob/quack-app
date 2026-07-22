/** Detect Claude org/API spend-limit copy so the transcript can render a card. */

const LIMIT_HINT =
  /you've hit .+?(?:spend|usage)\s+limit|monthly spend limit|\/usage-credits|org(?:'s|ization)?\s+monthly/i;

export function isSpendLimitText(text: string): boolean {
  return LIMIT_HINT.test(text.trim());
}

export interface SpendLimitSplit {
  /** Prose before/around the limit (may be empty). */
  remainder: string;
  /** Matched limit copy for the card / clipboard. */
  limit: string;
}

/** Split assistant text into normal prose + spend-limit lines. */
export function splitSpendLimitText(text: string): SpendLimitSplit | null {
  if (!isSpendLimitText(text)) return null;
  const lines = text.split("\n");
  const limitLines: string[] = [];
  const rest: string[] = [];
  for (const line of lines) {
    if (isSpendLimitText(line)) limitLines.push(line.trimEnd());
    else rest.push(line);
  }
  if (limitLines.length === 0) {
    return { remainder: "", limit: text.trim() };
  }
  return {
    remainder: rest.join("\n").trim(),
    limit: limitLines.join("\n").trim(),
  };
}
