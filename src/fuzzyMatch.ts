/** Subsequence fuzzy match — shared by command palette and file-tree filter. */
export function fuzzyMatch(query: string, text: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  let i = 0;
  for (const ch of q) {
    const idx = t.indexOf(ch, i);
    if (idx === -1) return false;
    i = idx + 1;
  }
  return true;
}

/** Strip optional wrapping quotes pasted from other tools. */
export function normalizeFilterQuery(query: string): string {
  let q = query.trim();
  if (
    q.length >= 2 &&
    ((q.startsWith('"') && q.endsWith('"')) ||
      (q.startsWith("'") && q.endsWith("'")))
  ) {
    q = q.slice(1, -1).trim();
  }
  return q;
}
