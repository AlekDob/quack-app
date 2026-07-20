import { describe, expect, it } from "vitest";
import {
  cleanStaleToolMessages,
  sanitizeUserMessageContent,
  stripCliFlattenScaffold,
  stripEditorContextPrefix,
} from "./chatTextUtils";

describe("stripEditorContextPrefix", () => {
  it("strips Quack CC wire prefix and keeps the bare user text", () => {
    const raw = [
      "[Editor context]",
      "QUACK EDITOR (Claude Code — this chat / orchestrator)",
      "",
      "[Agent identity]",
      "You are Jack, Project Manager · Planner.",
      "[/Agent identity]",
      "[/Editor context]",
      "",
      "guarda l'immagine",
    ].join("\n");
    expect(stripEditorContextPrefix(raw)).toBe("guarda l'immagine");
  });

  it("leaves plain user text alone", () => {
    expect(stripEditorContextPrefix("hello")).toBe("hello");
  });

  it("leaves incomplete prefixes alone", () => {
    const raw = "[Editor context]\nno closing tag\nhello";
    expect(stripEditorContextPrefix(raw)).toBe(raw);
  });
});

describe("stripCliFlattenScaffold", () => {
  it("keeps only the [User] section from a flattened first turn", () => {
    const raw = [
      "[System]",
      "You are helpful.",
      "",
      "[User]",
      "real prompt",
      "",
      "[Assistant]",
      "should cut",
    ].join("\n");
    expect(stripCliFlattenScaffold(raw)).toBe("real prompt");
  });
});

describe("sanitizeUserMessageContent", () => {
  it("strips flatten then Editor context when nested", () => {
    const raw = [
      "[System]",
      "sys",
      "",
      "[User]",
      "[Editor context]",
      "QUACK EDITOR",
      "[/Editor context]",
      "",
      "nested prompt",
    ].join("\n");
    expect(sanitizeUserMessageContent(raw)).toBe("nested prompt");
  });
});

describe("cleanStaleToolMessages", () => {
  it("sanitizes user bubbles that carry Editor context", () => {
    const out = cleanStaleToolMessages([
      {
        role: "user",
        content:
          "[Editor context]\nQUACK EDITOR\n[/Editor context]\n\nciao",
      },
      { role: "assistant", content: "ok" },
    ]);
    expect(out[0]?.content).toBe("ciao");
    expect(out).toHaveLength(2);
  });
});
