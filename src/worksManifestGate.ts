// Send the FULL Works manifest to Claude Code only when it first appears for a
// chat (or its content changed); a compact pointer on every later turn.
//
// Why: the manifest rides ccTurnContext, which is re-sent on every CC --resume
// turn. Re-sending the whole block each turn is pure waste — the model already
// has it from the earlier turn. The pointer keeps the scope pin alive at ~1
// line. Keyed by chatId; the map resets on reload, so a resumed session re-sends
// the full block once (cheap, and safe if the transcript was trimmed).
// See decisions/004 (per-turn injection is the token-burn lever).

const lastSent = new Map<string, string>();

/** Full block on first-seen/changed manifest, else the compact pointer. */
export function manifestForTurn(
  chatId: string,
  fullBlock: string,
  pointer: string,
): string {
  if (lastSent.get(chatId) === fullBlock) return pointer;
  lastSent.set(chatId, fullBlock);
  return fullBlock;
}

/** Drop a chat's memory (e.g. on archive/close) so the next turn re-sends full. */
export function resetManifestGate(chatId: string): void {
  lastSent.delete(chatId);
}
