import { describe, expect, it } from "vitest";

import {
  CLAUDE_AUTHENTICATION_FAILED_MESSAGE,
  isClaudeAuthenticationFailedError,
} from "./claudeAuthRecovery";

describe("isClaudeAuthenticationFailedError", () => {
  it("recognizes only the canonical Claude authentication error", () => {
    expect(
      isClaudeAuthenticationFailedError("claudeAgent", CLAUDE_AUTHENTICATION_FAILED_MESSAGE),
    ).toBe(true);
    expect(isClaudeAuthenticationFailedError("codex", CLAUDE_AUTHENTICATION_FAILED_MESSAGE)).toBe(
      false,
    );
    expect(isClaudeAuthenticationFailedError("claudeAgent", "Claude rate limit reached.")).toBe(
      false,
    );
  });
});
