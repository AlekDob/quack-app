// chatDocsStore imports chatToolRender (React tree) → needs navigator; stub
// before the dynamic import instead of pulling in a jsdom dependency.
import { beforeAll, describe, expect, it } from "vitest";
import type { ChatMessage } from "./ai";

type Store = typeof import("./chatDocsStore");
let store: Store;

beforeAll(async () => {
  const g = globalThis as Record<string, unknown>;
  g.navigator ??= { platform: "MacIntel" };
  g.localStorage ??= {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  store = await import("./chatDocsStore");
});

function assistant(
  calls: { name: string; file_path: string }[],
): ChatMessage {
  return {
    role: "assistant",
    content: "",
    tool_calls: calls.map((c, i) => ({
      id: `t${i}`,
      type: "function",
      function: { name: c.name, arguments: { file_path: c.file_path } },
    })),
  } as ChatMessage;
}

describe("collectChatDocs", () => {
  it("keeps only .md and .mmd paths", () => {
    const docs = store.collectChatDocs([
      assistant([
        { name: "Read", file_path: "/w/src/store.ts" },
        { name: "Read", file_path: "/w/documentation/features/084.md" },
        { name: "Write", file_path: "/w/documentation/flow.mmd" },
      ]),
    ]);
    expect(docs.map((d) => d.path)).toEqual([
      "/w/documentation/features/084.md",
      "/w/documentation/flow.mmd",
    ]);
  });

  it("dedupes a path and lets a later write win over a read", () => {
    const docs = store.collectChatDocs([
      assistant([{ name: "Read", file_path: "/w/doc.md" }]),
      assistant([{ name: "Edit", file_path: "/w/doc.md" }]),
    ]);
    expect(docs).toEqual([{ path: "/w/doc.md", edited: true }]);
  });

  it("marks read-only docs as not edited", () => {
    const docs = store.collectChatDocs([
      assistant([{ name: "Read", file_path: "/w/doc.md" }]),
    ]);
    expect(docs).toEqual([{ path: "/w/doc.md", edited: false }]);
  });

  it("ignores user messages and tool-less turns", () => {
    const docs = store.collectChatDocs([
      { role: "user", content: "see /w/doc.md" } as ChatMessage,
      { role: "assistant", content: "ok" } as ChatMessage,
    ]);
    expect(docs).toEqual([]);
  });
});

describe("publishChatDocs", () => {
  it("notifies only when the doc list actually changes", () => {
    let hits = 0;
    const off = store.subscribeChatDocs(() => hits++);
    const docs = [{ path: "/w/a.md", edited: false }];
    store.publishChatDocs("c1", docs);
    store.publishChatDocs("c1", [{ path: "/w/a.md", edited: false }]);
    expect(hits).toBe(1);
    store.publishChatDocs("c1", [{ path: "/w/a.md", edited: true }]);
    expect(hits).toBe(2);
    expect(store.getChatDocs("c1")).toHaveLength(1);
    off();
  });
});
