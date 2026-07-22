import { describe, expect, it } from "vitest";
import type { ChatMessage } from "./ai";
import {
  buildTitlePrompt,
  sanitizeTitle,
  shouldAutoTitle,
  titleModelFor,
} from "./chatAutoTitle";
import { preferredTitle } from "./chatHistory";

const msg = (role: ChatMessage["role"], content: string): ChatMessage => ({
  role,
  content,
});

describe("sanitizeTitle", () => {
  it("strips wrapping quotes and trailing punctuation", () => {
    expect(sanitizeTitle('"Fix login bug."')).toBe("Fix login bug");
    expect(sanitizeTitle("**Refactor store**")).toBe("Refactor store");
  });

  it("takes the first non-empty line", () => {
    expect(sanitizeTitle("\n\nAdd dark mode\nextra chatter")).toBe("Add dark mode");
  });

  it("truncates overly long titles with an ellipsis", () => {
    const long = "a".repeat(80);
    const out = sanitizeTitle(long);
    expect(out).not.toBeNull();
    expect(out!.length).toBeLessThanOrEqual(48);
    expect(out!.endsWith("…")).toBe(true);
  });

  it("rejects empty or single-char junk", () => {
    expect(sanitizeTitle("")).toBeNull();
    expect(sanitizeTitle('"."')).toBeNull();
  });
});

describe("shouldAutoTitle", () => {
  const started = [msg("user", "hi"), msg("assistant", "hello there")];

  it("fires only after a user + assistant exchange", () => {
    expect(shouldAutoTitle({ messages: started })).toBe(true);
    expect(shouldAutoTitle({ messages: [msg("user", "hi")] })).toBe(false);
    expect(
      shouldAutoTitle({ messages: [msg("user", "hi"), msg("assistant", "  ")] }),
    ).toBe(false);
  });

  it("respects locked / already-auto titles and the disable flag", () => {
    expect(shouldAutoTitle({ messages: started, titleLocked: true })).toBe(false);
    expect(shouldAutoTitle({ messages: started, autoTitled: true })).toBe(false);
    expect(shouldAutoTitle({ messages: started, enabled: false })).toBe(false);
  });
});

describe("titleModelFor", () => {
  it("maps each provider to a cheap model", () => {
    expect(titleModelFor("claude-code")).toBe("haiku");
    expect(titleModelFor("anthropic")).toBe("claude-haiku-4-5-20251001");
    expect(titleModelFor("openai")).toBe("gpt-4o-mini");
    // No cheap-tier mapping for Cursor — CLI default (empty) unless pinned.
    expect(titleModelFor("cursor-cli")).toBe("");
    // Ollama reuses the chat's own local model.
    expect(titleModelFor("ollama", "llama3.1")).toBe("llama3.1");
  });
});

describe("buildTitlePrompt", () => {
  it("includes the first user and assistant turn", () => {
    const p = buildTitlePrompt([
      msg("user", "How do I add a theme toggle?"),
      msg("assistant", "Add a data-theme attribute and CSS vars."),
    ]);
    expect(p).toContain("User: How do I add a theme toggle?");
    expect(p).toContain("Assistant: Add a data-theme attribute");
    expect(p.toLowerCase()).toContain("title");
  });
});

describe("preferredTitle", () => {
  const messages = [msg("user", "Fix the flaky test in CI")];

  it("keeps a locked or auto title, ignoring the heuristic", () => {
    expect(
      preferredTitle({ title: "My name", titleLocked: true }, messages),
    ).toBe("My name");
    expect(
      preferredTitle({ title: "LLM name", autoTitled: true }, messages),
    ).toBe("LLM name");
  });

  it("derives from messages when neither flag is set", () => {
    expect(preferredTitle({ title: "AI Chat" }, messages)).toBe(
      "Fix the flaky test in CI",
    );
    expect(preferredTitle(undefined, messages)).toBe("Fix the flaky test in CI");
  });
});
