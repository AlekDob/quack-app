/**
 * Regression tests for injectAgentPersonality helper.
 *
 * These tests lock-in the contract used by THREE callsites in App.tsx:
 *   1. handleAutomationFireJob (manual fire)
 *   2. automation scheduler tick (background fire)
 *   3. remote-execute listener (@team delegation) — the fix site
 *
 * Regressions this guards against:
 *   - Calling invoke when no personality is present (would wipe CLAUDE.md)
 *   - Crashing the caller when the invoke rejects (injection is best-effort)
 *   - Using agent.cwd when an explicit projectPath is provided
 *     (delegation often targets a sibling project's cwd, not the lead's)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const invokeMock = vi.fn();
vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invokeMock(...args),
}));

// Import AFTER mock is registered
import { injectAgentPersonality } from "./agentPersonality";
import type { TerminalInfo } from "../types";

const makeAgent = (overrides: Partial<TerminalInfo> = {}): TerminalInfo => ({
  id: "agent-leo",
  label: "Leo",
  color: "#FF6B35",
  cwd: "/Users/alek/Desktop/Dev/spaceship",
  alive: true,
  personality: {
    id: "agent-leo",
    name: "Agent Leo",
    role: "Quack Developer",
    communicationStyle: "sarcastic",
  },
  ...overrides,
});

describe("injectAgentPersonality", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue("/path/to/CLAUDE.md");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("invokes Tauri command with projectPath override (delegation case)", async () => {
    const agent = makeAgent();
    await injectAgentPersonality(agent, "/Users/alek/Desktop/Dev/other-project");

    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock).toHaveBeenCalledWith("inject_personality_to_claude_md", {
      projectPath: "/Users/alek/Desktop/Dev/other-project",
      personality: agent.personality,
    });
  });

  it("falls back to agent.cwd when projectPath is omitted", async () => {
    const agent = makeAgent();
    await injectAgentPersonality(agent);

    expect(invokeMock).toHaveBeenCalledWith("inject_personality_to_claude_md", {
      projectPath: agent.cwd,
      personality: agent.personality,
    });
  });

  it("is a no-op when agent is undefined", async () => {
    await injectAgentPersonality(undefined, "/some/path");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("is a no-op when personality is missing", async () => {
    await injectAgentPersonality(makeAgent({ personality: undefined }), "/some/path");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("is a no-op when both projectPath and agent.cwd are empty", async () => {
    await injectAgentPersonality(makeAgent({ cwd: "" }), "");
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("swallows Tauri invoke errors (best-effort, does not abort caller)", async () => {
    invokeMock.mockRejectedValueOnce(new Error("CLAUDE.md write failed"));
    const agent = makeAgent();

    await expect(injectAgentPersonality(agent, "/target")).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      "[injectAgentPersonality] Failed to inject personality:",
      expect.any(Error),
    );
  });

  it("passes an empty-object personality through (caller's problem, not ours)", async () => {
    // Guards against adding overly-defensive filters: if caller says
    // "this is the personality", we trust and forward it verbatim.
    const agent = makeAgent({ personality: {} });
    await injectAgentPersonality(agent, "/target");
    expect(invokeMock).toHaveBeenCalledTimes(1);
  });
});
