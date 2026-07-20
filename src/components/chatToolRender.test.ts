import { describe, expect, it } from "vitest";
import { isSubagentDispatch } from "./chatToolRender";

describe("isSubagentDispatch", () => {
  it("matches Claude Code Agent and legacy Task", () => {
    expect(isSubagentDispatch("Agent")).toBe(true);
    expect(isSubagentDispatch("Task")).toBe(true);
  });

  it("rejects checklist tools and explore tools", () => {
    expect(isSubagentDispatch("TaskCreate")).toBe(false);
    expect(isSubagentDispatch("TodoWrite")).toBe(false);
    expect(isSubagentDispatch("AskUserQuestion")).toBe(false);
    expect(isSubagentDispatch("Read")).toBe(false);
    expect(isSubagentDispatch("Bash")).toBe(false);
  });
});
