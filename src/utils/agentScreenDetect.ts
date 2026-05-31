/**
 * agentScreenDetect — derive Claude Code's activity state from the rendered
 * terminal screen (xterm buffer tail). This is the GROUND TRUTH that corrects
 * lossy/out-of-order hooks: a visible plan/permission prompt is "blocked"
 * even when no Notification hook fired; a visible idle prompt box is "done"
 * even when a Stop hook was lost.
 *
 * Faithful TypeScript port of herdr's `src/detect/agents/claude_code.rs`
 * (github.com/ogulcancelik/herdr) + the generic prompt helpers in its
 * `detect/mod.rs`. Pattern-only, no state — the caller debounces idle.
 *
 * Brain: 069-embedded-cli-hooks-pivot
 */

export type ScreenState = 'blocked' | 'working' | 'idle' | 'unknown';

// Claude Code spinner glyphs (the verb after them changes constantly:
// "Processing…", "Pouncing…", …) — match glyph + trailing ellipsis instead.
const SPINNER_CHARS = '·✱✲✳✴✵✶✷✸✹✺✻✼✽✾✿❀❁❂❃❇❈❉❊❋✢✣✤✥✦✧✨⊛⊕⊙◉◎◍⁂⁕※⍟☼★☆';

const isHorizontalRule = (line: string): boolean => {
  const t = line.trim();
  return t.length > 0 && [...t].every((c) => c === '─');
};

/** Index of the prompt box TOP border = the 2nd ─── line scanning from bottom. */
function promptBoxTopBorderIndex(lines: string[]): number | null {
  let count = 0;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (isHorizontalRule(lines[i])) {
      count += 1;
      if (count === 2) return i;
    }
  }
  return null;
}

/** Everything above Claude's prompt box (where working chrome appears). */
function contentAbovePromptBox(content: string): string {
  const lines = content.split('\n');
  const i = promptBoxTopBorderIndex(lines);
  return i === null ? content : lines.slice(0, i).join('\n');
}

/** True when Claude's input box (top border → `❯` line → bottom border) is on
 *  screen. Used to confirm idle is a *Claude* idle, not a foreign program — so
 *  we never mislabel a Codex/other-agent or plain shell screen as "done". */
function hasClaudePromptBox(content: string): boolean {
  const lines = content.split('\n');
  const top = promptBoxTopBorderIndex(lines);
  if (top === null) return false;
  for (let i = top + 1; i < lines.length; i++) {
    if (isHorizontalRule(lines[i])) break;
    if (lines[i].trimStart().startsWith('❯')) return true;
  }
  return false;
}

function hasSpinnerActivity(content: string): boolean {
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    const first = trimmed[0];
    if (first && SPINNER_CHARS.includes(first)) {
      const rest = trimmed.slice(1);
      if (rest.startsWith(' ') && rest.includes('…') && /[a-z0-9]/i.test(rest)) {
        return true;
      }
    }
  }
  return false;
}

// --- Generic prompt helpers (herdr detect/mod.rs) ---------------------------

function hasConfirmationPrompt(lower: string): boolean {
  const pos = (() => {
    const a = lower.indexOf('do you want');
    if (a !== -1) return a;
    return lower.indexOf('would you like');
  })();
  if (pos === -1) return false;
  const after = lower.slice(pos);
  return after.includes('yes') || after.includes('❯');
}

/** ❯ line with a "N." numbered option = an active selection menu. */
function hasSelectionPrompt(content: string): boolean {
  return content.split('\n').some((line) => {
    const t = line.trim();
    return t.startsWith('❯') && /\d/.test(t) && t.includes('.');
  });
}

function hasYesNoChoice(content: string): boolean {
  return content.split('\n').some((line) => {
    const t = line.trim().replace(/^❯/, '').trimStart().toLowerCase();
    return (
      t === 'yes' ||
      t === 'no' ||
      t.startsWith('1. yes') ||
      t.startsWith('2. no') ||
      t.startsWith('yes, and ') ||
      t.startsWith('no, and tell claude')
    );
  });
}

// --- Claude-specific composites (herdr claude_code.rs) ----------------------

function hasBlockedPrompt(content: string, lower: string): boolean {
  return (
    hasConfirmationPrompt(lower) ||
    lower.includes('do you want to proceed?') ||
    lower.includes('would you like to proceed?') ||
    lower.includes('waiting for permission') ||
    lower.includes('do you want to allow this connection?') ||
    lower.includes('tab to amend') ||
    lower.includes('ctrl+e to explain') ||
    lower.includes('chat about this') ||
    lower.includes('review your answers') ||
    lower.includes('skip interview and plan immediately') ||
    (hasSelectionPrompt(content) && hasYesNoChoice(content))
  );
}

function hasWorkingChrome(content: string): boolean {
  const above = contentAbovePromptBox(content).toLowerCase();
  return (
    above.includes('esc to interrupt') ||
    above.includes('ctrl+c to interrupt') ||
    hasSpinnerActivity(contentAbovePromptBox(content))
  );
}

/**
 * Classify the agent state from the terminal screen tail.
 * Priority: blocked > working > idle. Returns 'unknown' when the screen is not
 * recognizably Claude (empty, foreign agent, plain shell) so the caller defers
 * to hooks and never mislabels another program as done/working.
 */
export function detectClaudeScreenState(content: string): ScreenState {
  if (!content.trim()) return 'unknown';
  const lower = content.toLowerCase();

  // Search/menu overlays are idle, never working.
  if (content.includes('⌕ Search…') || lower.includes('ctrl+r to toggle')) return 'idle';

  if (hasBlockedPrompt(content, lower)) return 'blocked';
  if (hasWorkingChrome(content)) return 'working';
  // A numbered selection menu (❯ 1. … 2. …) that is NOT a yes/no permission is
  // ambiguous on screen: it could be a blocking AskUserQuestion OR a harmless
  // slash/settings menu — Claude renders both with the same widget. Defer to
  // the hooks (PreToolUse(AskUserQuestion)→blocked fires only for the real one)
  // instead of guessing idle, so we never force "done" over an open question.
  if (hasSelectionPrompt(content)) return 'unknown';
  // Only call it idle when Claude's own input box is visible — otherwise we
  // can't tell (foreign agent / shell) and must not force "done".
  if (hasClaudePromptBox(content)) return 'idle';
  return 'unknown';
}
