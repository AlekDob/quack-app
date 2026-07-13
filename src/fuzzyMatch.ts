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
