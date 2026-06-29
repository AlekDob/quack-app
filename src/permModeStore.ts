// Bridge between the per-chat Claude Code permission mode (chosen in the
// composer via the mode menu / `/mode`) and ClaudePermissionOverlay, which
// is the SINGLE frontend authority that decides allow / deny / show-card.
//
// Why a module-level store and not a prop?
//   The overlay registers its `claude:permission-request` listener once and
//   lives for the whole app — it can't read a panel's React state without
//   closure-staleness. The hook ALWAYS fires (bypass aside), so the CLI's
//   own `--permission-mode acceptEdits` is inert: the overlay must enforce
//   the mode itself. It looks the mode up here, keyed by the request's
//   Claude Code session id (preferred) or its cwd (fallback — used on a
//   brand-new chat before the session id has streamed back).
//
// Pattern cloned from `aiTaskStore.ts` (module-level state keyed per chat).

/** Last mode written per Claude Code session id. */
const bySession = new Map<string, string>();
/** Fallback keyed by workspace cwd, for requests whose session id we
 *  haven't recorded yet (first tool call of a fresh chat). */
const byCwd = new Map<string, string>();

/** Strip trailing slashes so a panel's `root` and the hook's `cwd` compare
 *  equal regardless of how each got normalized. */
function normCwd(p: string | null | undefined): string | null {
  return p ? p.replace(/[\\/]+$/, "") : null;
}

/** Record the active mode for a chat. Called by AIChatPanel whenever its
 *  mode (or its captured session id) changes. `null` mode = Ask (default). */
export function setPermMode(
  opts: { sessionId?: string | null; cwd?: string | null },
  mode: string | null,
): void {
  const m = mode ?? "default";
  if (opts.sessionId) bySession.set(opts.sessionId, m);
  const c = normCwd(opts.cwd);
  if (c) byCwd.set(c, m);
}

/** Resolve the mode for an incoming permission request. Falls back to
 *  "default" (Ask — show the card) when nothing was recorded. */
export function getPermModeFor(req: {
  session_id?: string | null;
  cwd?: string | null;
}): string {
  if (req.session_id) {
    const m = bySession.get(req.session_id);
    if (m) return m;
  }
  const c = normCwd(req.cwd);
  if (c) {
    const m = byCwd.get(c);
    if (m) return m;
  }
  return "default";
}
