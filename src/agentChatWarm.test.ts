import { describe, expect, it, beforeEach } from "vitest";
import {
  touchAgentChatWarm,
  isAgentChatWarm,
  agentChatWarmIds,
  clearAgentChatWarm,
} from "./agentChatWarm";

describe("agentChatWarm", () => {
  beforeEach(() => clearAgentChatWarm());

  it("keeps MRU order and caps at 5", () => {
    for (const id of ["a", "b", "c", "d", "e", "f"]) touchAgentChatWarm(id);
    expect(agentChatWarmIds()).toEqual(["f", "e", "d", "c", "b"]);
    expect(isAgentChatWarm("a")).toBe(false);
    expect(isAgentChatWarm("f")).toBe(true);
  });

  it("re-touch moves to front without growing", () => {
    touchAgentChatWarm("a");
    touchAgentChatWarm("b");
    touchAgentChatWarm("a");
    expect(agentChatWarmIds()).toEqual(["a", "b"]);
  });
});
