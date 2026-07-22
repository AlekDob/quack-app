import { describe, expect, it, beforeEach } from "vitest";
import {
  dropAllCachedBodies,
  getCachedSession,
  preferRicherSession,
  putCachedSession,
} from "./chatStoreCache";
import type { ChatSession } from "./chatHistory";

function row(
  id: string,
  n: number,
  extra: Partial<ChatSession> = {},
): ChatSession {
  return {
    id,
    title: "t",
    messages: Array.from({ length: n }, (_, i) => ({
      role: i % 2 === 0 ? "user" : "assistant",
      content: `m${i}`,
    })),
    updatedAt: 1,
    ...extra,
  };
}

describe("preferRicherSession", () => {
  it("keeps longer message list", () => {
    const prev = row("a", 10);
    const next = row("a", 3, { title: "new", composer: { input: "x" } });
    const out = preferRicherSession(prev, next);
    expect(out.messages).toHaveLength(10);
    expect(out.title).toBe("new");
    expect(out.composer?.input).toBe("x");
  });

  it("keeps a real title when next is Untitled", () => {
    const prev = row("a", 10, { title: "Storico conversazioni" });
    const next = row("a", 10, { title: "Untitled" });
    expect(preferRicherSession(prev, next).title).toBe("Storico conversazioni");
  });

  it("keeps prev title when refusing a shrink to Untitled", () => {
    const prev = row("a", 10, { title: "Good name" });
    const next = row("a", 2, { title: "Untitled" });
    const out = preferRicherSession(prev, next);
    expect(out.messages).toHaveLength(10);
    expect(out.title).toBe("Good name");
  });

  it("keeps CLI session ids when a thin row omits them", () => {
    const prev = row("a", 10, {
      providerSessionIds: { "claude-code": "cc-old" },
      claudeSessionId: "cc-old",
    });
    const next = row("a", 2, { providerSessionIds: {} });
    const out = preferRicherSession(prev, next);
    expect(out.providerSessionIds?.["claude-code"]).toBe("cc-old");
    expect(out.claudeSessionId).toBe("cc-old");
  });

  it("lets next overwrite a provider id when set", () => {
    const prev = row("a", 5, {
      providerSessionIds: { "claude-code": "cc-old" },
    });
    const next = row("a", 5, {
      providerSessionIds: { "claude-code": "cc-new" },
    });
    expect(preferRicherSession(prev, next).providerSessionIds?.["claude-code"]).toBe(
      "cc-new",
    );
  });

  it("at equal count keeps the longer last-assistant content", () => {
    const prev: ChatSession = {
      id: "a",
      title: "t",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "long answer from flush" },
      ],
      updatedAt: 1,
    };
    const next: ChatSession = {
      id: "a",
      title: "t",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "thin" },
      ],
      updatedAt: 2,
      composer: { input: "draft" },
    };
    const out = preferRicherSession(prev, next);
    expect(out.messages[1].content).toBe("long answer from flush");
    expect(out.composer?.input).toBe("draft");
  });

  it("at equal count accepts a richer next assistant", () => {
    const prev: ChatSession = {
      id: "a",
      title: "t",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "short" },
      ],
      updatedAt: 1,
    };
    const next: ChatSession = {
      id: "a",
      title: "t",
      messages: [
        { role: "user", content: "q" },
        { role: "assistant", content: "much longer completed answer" },
      ],
      updatedAt: 2,
    };
    expect(preferRicherSession(prev, next).messages[1].content).toBe(
      "much longer completed answer",
    );
  });
});

describe("putCachedSession shrink guard", () => {
  const ws = "ws_test_shrink";

  beforeEach(() => {
    dropAllCachedBodies(ws);
  });

  it("does not replace a rich row with a thin one", () => {
    putCachedSession(ws, row("s1", 20));
    putCachedSession(ws, row("s1", 2, { title: "thin" }));
    const got = getCachedSession(ws, "s1");
    expect(got?.messages).toHaveLength(20);
    expect(got?.title).toBe("thin");
  });
});
