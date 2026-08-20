import { describe, expect, it } from "vitest";

import { mergeAcpMcpServers, mergeNamedMcpServers } from "./mcpMerge.ts";

describe("mergeNamedMcpServers", () => {
  it("lets synara win only on the synara key", () => {
    expect(
      mergeNamedMcpServers(
        {
          linear: { url: "https://mcp.linear.app/mcp" },
          synara: { url: "http://stale" },
        },
        { url: "http://quack/mcp" },
      ),
    ).toEqual({
      linear: { url: "https://mcp.linear.app/mcp" },
      synara: { url: "http://quack/mcp" },
    });
  });

  it("keeps user linear-* servers when there is no user map", () => {
    expect(mergeNamedMcpServers(undefined, { url: "http://quack/mcp" })).toEqual({
      synara: { url: "http://quack/mcp" },
    });
  });
});

describe("mergeAcpMcpServers", () => {
  it("appends synara and leaves linear untouched", () => {
    expect(
      mergeAcpMcpServers(
        [
          { name: "linear", command: "npx" },
          { name: "linear-esopo", command: "npx" },
          { name: "synara", command: "stale" },
        ],
        [{ name: "synara", command: "quack" }],
      ),
    ).toEqual([
      { name: "linear", command: "npx" },
      { name: "linear-esopo", command: "npx" },
      { name: "synara", command: "quack" },
    ]);
  });
});
