import { describe, expect, it } from "vitest";
import {
  ccSlashName,
  isClaudeCodeBareSlash,
  planCcWireRefresh,
} from "./ccWirePrompt";

describe("isClaudeCodeBareSlash", () => {
  it("treats any CC slash as bare (meta + agentic + custom)", () => {
    expect(isClaudeCodeBareSlash("/compact")).toBe(true);
    expect(isClaudeCodeBareSlash("  /compact  ")).toBe(true);
    expect(isClaudeCodeBareSlash("/compact please")).toBe(true);
    expect(isClaudeCodeBareSlash("/init")).toBe(true);
    expect(isClaudeCodeBareSlash("/review")).toBe(true);
    expect(isClaudeCodeBareSlash("/security-review")).toBe(true);
    expect(isClaudeCodeBareSlash("/my-custom-cmd")).toBe(true);
  });

  it("does not treat prose or absolute paths as slash cmds", () => {
    expect(isClaudeCodeBareSlash("compact without slash")).toBe(false);
    expect(isClaudeCodeBareSlash("hello")).toBe(false);
    expect(isClaudeCodeBareSlash("/Users/alek/file.ts")).toBe(false);
    expect(isClaudeCodeBareSlash("/")).toBe(false);
  });

  it("parses the slash name", () => {
    expect(ccSlashName("/compact")).toBe("compact");
    expect(ccSlashName("/Review foo")).toBe("review");
    expect(ccSlashName("/Users/x")).toBe(null);
  });
});

describe("planCcWireRefresh", () => {
  const base = {
    bareSlash: false,
    isFirstCcWire: false,
    agentId: "builder" as string | null,
    planMode: false,
    lastAgentId: "builder" as string | null | undefined,
    lastPlanMode: false as boolean | undefined,
    forceRefresh: false,
  };

  it("skips prefix on slash and forces refresh next turn", () => {
    const r = planCcWireRefresh({ ...base, bareSlash: true });
    expect(r.skipPrefix).toBe(true);
    expect(r.injectStatic).toBe(false);
    expect(r.nextForceRefresh).toBe(true);
  });

  it("injects on first CC wire turn", () => {
    const r = planCcWireRefresh({
      ...base,
      isFirstCcWire: true,
      lastAgentId: undefined,
      lastPlanMode: undefined,
    });
    expect(r.injectStatic).toBe(true);
    expect(r.nextLastAgentId).toBe("builder");
  });

  it("skips static inject when agent and plan unchanged", () => {
    const r = planCcWireRefresh(base);
    expect(r.skipPrefix).toBe(false);
    expect(r.injectStatic).toBe(false);
  });

  it("reinjects when agent switches Jack → Milo", () => {
    const r = planCcWireRefresh({
      ...base,
      agentId: "builder",
      lastAgentId: null,
    });
    expect(r.injectStatic).toBe(true);
  });

  it("reinjects after a prior bare slash (forceRefresh)", () => {
    const r = planCcWireRefresh({ ...base, forceRefresh: true });
    expect(r.injectStatic).toBe(true);
    expect(r.nextForceRefresh).toBe(false);
  });

  it("reinjects when Plan mode flips", () => {
    const r = planCcWireRefresh({ ...base, planMode: true, lastPlanMode: false });
    expect(r.injectStatic).toBe(true);
  });
});
