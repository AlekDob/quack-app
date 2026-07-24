import { describe, expect, it } from "vitest";
import {
  AGENT_CONTEXT_DEFAULT_W,
  AGENT_CONTEXT_MAX_W,
  AGENT_CONTEXT_MIN_W,
  clampAgentContextWidth,
} from "./agentContextWidth";

describe("clampAgentContextWidth", () => {
  it("keeps values inside the allowed range", () => {
    expect(clampAgentContextWidth(480)).toBe(480);
    expect(clampAgentContextWidth(AGENT_CONTEXT_DEFAULT_W)).toBe(
      AGENT_CONTEXT_DEFAULT_W,
    );
  });

  it("clamps below min and above max", () => {
    expect(clampAgentContextWidth(100)).toBe(AGENT_CONTEXT_MIN_W);
    expect(clampAgentContextWidth(2000)).toBe(AGENT_CONTEXT_MAX_W);
  });

  it("rounds to nearest pixel", () => {
    expect(clampAgentContextWidth(481.6)).toBe(482);
  });
});
