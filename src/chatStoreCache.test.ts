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

  it("accepts equal or longer", () => {
    expect(preferRicherSession(row("a", 2), row("a", 2)).messages).toHaveLength(
      2,
    );
    expect(preferRicherSession(row("a", 2), row("a", 5)).messages).toHaveLength(
      5,
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
