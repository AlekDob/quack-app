/**
 * SDK streaming kill-switch (feature 069, Fase 9 — embedded-CLI pivot).
 * ------------------------------------------------------------------
 * The embedded-CLI pivot moved the MAIN session to an interactive Claude Code
 * terminal (subscription pool). A few SECONDARY features still drive agents
 * programmatically via the Agent SDK (`send_message_via_sdk_streaming`):
 * Jack supervisor, BTW, and the Kanban inline chat.
 *
 * From 2026-06-15 Anthropic bills programmatic Agent SDK usage from a separate
 * paid pool. This opt-OUT switch lets the user disable those SDK-backed sends
 * so they don't silently consume the paid pool. Default = ENABLED (nothing
 * changes); set localStorage `quack:disableSdkStream` = '1' to turn them off.
 *
 * When disabled, callers must degrade gracefully (show SDK_DISABLED_MESSAGE),
 * never throw.
 */
const DISABLE_KEY = 'quack:disableSdkStream';

export const SDK_DISABLED_MESSAGE =
  'Funzione non disponibile: lo streaming SDK è disattivato (modalità embedded). ' +
  'Riattivalo rimuovendo "quack:disableSdkStream" dal localStorage.';

/** True when programmatic SDK sends are allowed (default). */
export function isSdkStreamEnabled(): boolean {
  if (typeof localStorage === 'undefined') return true;
  return localStorage.getItem(DISABLE_KEY) !== '1';
}
