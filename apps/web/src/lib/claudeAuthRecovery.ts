// FILE: claudeAuthRecovery.ts
// Purpose: Centralizes the Claude authentication recovery contract used by chat.

import type { ProviderKind } from "@synara/contracts";

export const CLAUDE_AUTH_LOGIN_COMMAND = "claude auth login --claudeai";
export const CLAUDE_AUTHENTICATION_FAILED_MESSAGE =
  "Claude is not authenticated. Run `claude auth login --claudeai`, then retry.";
export const CLAUDE_AUTH_RECOVERY_KEY = "claude-auth-recovery";

export function isClaudeAuthenticationFailedError(
  provider: ProviderKind | null | undefined,
  error: string | null | undefined,
): boolean {
  return provider === "claudeAgent" && error === CLAUDE_AUTHENTICATION_FAILED_MESSAGE;
}
