import { describe, expect, it } from "vitest";
import {
  flattenMessages,
  lastUserMessage,
  wireUserContent,
} from "./cliPrompt";
import type { ChatMessage } from "../ai";

const img = {
  path: "/tmp/quack-attachments/a.jpg",
  name: "a.jpg",
  thumb: "data:...",
};

describe("wireUserContent", () => {
  it("appends Read-tool hint from images metadata", () => {
    const m: ChatMessage = {
      role: "user",
      content: "look at this",
      images: [img],
    };
    expect(wireUserContent(m)).toContain("/tmp/quack-attachments/a.jpg");
    expect(wireUserContent(m)).toContain("Read tool");
  });

  it("does not double-inject when path already in content", () => {
    const m: ChatMessage = {
      role: "user",
      content: `see ${img.path}`,
      images: [img],
    };
    expect(wireUserContent(m)).toBe(`see ${img.path}`);
  });
});

describe("flattenMessages", () => {
  it("reinjects historical image paths on first-turn flatten", () => {
    const out = flattenMessages([
      { role: "system", content: "You are Nora." },
      {
        role: "user",
        content: "raycast bug",
        images: [img],
      },
      { role: "assistant", content: "Looking." },
      { role: "user", content: "allora?" },
    ]);
    expect(out).toContain("raycast bug");
    expect(out).toContain(img.path);
    expect(out).toContain("allora?");
  });
});

describe("lastUserMessage", () => {
  it("includes image hint on the latest user turn", () => {
    const text = lastUserMessage([
      { role: "user", content: "hi", images: [img] },
    ]);
    expect(text).toContain(img.path);
  });
});
