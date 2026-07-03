// Per-user Jack preferences — free-form instructions appended to the
// assistant system prompt on every AI turn. Stored in localStorage
// (user-scoped, not workspace-scoped) so each Quack install can tune
// how Jack behaves without touching code.

import { getString, setString } from "./localStore";

export const JACK_CUSTOM_INSTRUCTIONS_KEY = "lcp.jack.customInstructions";

/** Soft cap — keeps first-turn Claude Code flattening reasonable. */
export const JACK_CUSTOM_INSTRUCTIONS_MAX = 4000;

type Listener = (instructions: string) => void;
const listeners = new Set<Listener>();

function clamp(text: string): string {
  return text.slice(0, JACK_CUSTOM_INSTRUCTIONS_MAX);
}

export function getJackCustomInstructions(): string {
  const raw = getString(JACK_CUSTOM_INSTRUCTIONS_KEY);
  if (!raw) return "";
  return clamp(raw);
}

export function saveJackCustomInstructions(text: string): void {
  const next = clamp(text);
  setString(JACK_CUSTOM_INSTRUCTIONS_KEY, next);
  for (const l of listeners) l(next);
}

export function subscribeJackCustomInstructions(cb: Listener): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Append the user's Jack preferences block when non-empty. */
export function appendJackUserPreferences(sysParts: string[]): void {
  const custom = getJackCustomInstructions().trim();
  if (!custom) return;
  sysParts.push(
    [
      "USER PREFERENCES (set by this user in Quack Settings — follow these alongside the rules above)",
      custom,
    ].join("\n"),
  );
}
