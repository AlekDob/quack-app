/**
 * Claude Code wire prompt policy — what rides in `[Editor context]` on
 * each user turn. CC resume only sends the latest user message, so Quack
 * used to prepend the full orchestrator + agent block every turn. That
 * broke slash commands (`/compact` became "...[/Editor context]\n/compact")
 * and burned IN tokens for mostly-static text already in the CLI history.
 *
 * Any CC slash (`/compact`, `/init`, `/review`, custom `.claude/commands`)
 * goes bare; static QUACK EDITOR + identity reinject on the next real turn.
 */

/** Command name after `/`: single segment, no path slashes (not `/Users/…`). */
const CC_SLASH_NAME_RE = /^[a-z][\w-]*$/i;

/** First path segment after `/` (lowercase), or null if not a slash cmd. */
export function ccSlashName(text: string): string | null {
  const t = text.trim();
  if (!t.startsWith("/")) return null;
  const name = t.slice(1).split(/\s+/)[0] ?? "";
  if (!name || !CC_SLASH_NAME_RE.test(name)) return null;
  return name.toLowerCase();
}

/** True for any CC slash (`/compact`, `/init`, custom…) — no `[Editor context]`. */
export function isClaudeCodeBareSlash(text: string): boolean {
  return ccSlashName(text) !== null;
}

export type CcWireRefreshInput = {
  /** Slash this turn — skip prefix entirely; next turn must refresh. */
  bareSlash: boolean;
  /** No CC session id yet (first wire turn / new spawn). */
  isFirstCcWire: boolean;
  /** Active preset id (`null` = Jack). */
  agentId: string | null;
  /** Composer Plan mode. */
  planMode: boolean;
  /** Last agent id we put on the wire (undefined = never). */
  lastAgentId: string | null | undefined;
  /** Last planMode we put on the wire. */
  lastPlanMode: boolean | undefined;
  /** Set after a bare slash until the next full inject. */
  forceRefresh: boolean;
};

export type CcWireRefreshResult = {
  /** Skip all `[Editor context]` this turn. */
  skipPrefix: boolean;
  /** Inject QUACK EDITOR + [Agent identity] (+ plan block). */
  injectStatic: boolean;
  /** Persist after a successful static inject. */
  nextLastAgentId: string | null | undefined;
  nextLastPlanMode: boolean | undefined;
  nextForceRefresh: boolean;
};

/**
 * Decide whether this CC turn needs the heavy static wire block.
 * Ephemeral bits (attachments, brain, feature inject) are caller-side.
 */
export function planCcWireRefresh(input: CcWireRefreshInput): CcWireRefreshResult {
  if (input.bareSlash) {
    return {
      skipPrefix: true,
      injectStatic: false,
      nextLastAgentId: input.lastAgentId,
      nextLastPlanMode: input.lastPlanMode,
      nextForceRefresh: true,
    };
  }
  const agentChanged =
    input.lastAgentId === undefined || input.lastAgentId !== input.agentId;
  const planChanged =
    input.lastPlanMode === undefined || input.lastPlanMode !== input.planMode;
  const injectStatic =
    input.forceRefresh ||
    input.isFirstCcWire ||
    agentChanged ||
    planChanged;
  return {
    skipPrefix: false,
    injectStatic,
    nextLastAgentId: injectStatic ? input.agentId : input.lastAgentId,
    nextLastPlanMode: injectStatic ? input.planMode : input.lastPlanMode,
    nextForceRefresh: false,
  };
}
