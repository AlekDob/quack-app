import { describe, expect, it } from "vitest";

import { parseMcpJsonServers } from "./userMcpConfig.ts";

describe("parseMcpJsonServers", () => {
  it("maps stdio and http Linear entries and skips disabled servers", () => {
    expect(
      parseMcpJsonServers({
        mcpServers: {
          linear: {
            command: "npx",
            args: ["-y", "mcp-remote", "https://mcp.linear.app/sse"],
            env: { LINEAR_API_KEY: "lin_api_x" },
          },
          "linear-esopo": {
            url: "https://mcp.linear.app/mcp",
            headers: { Authorization: "Bearer tok" },
          },
          stale: { command: "echo", disabled: true },
        },
      }),
    ).toEqual([
      {
        name: "linear",
        command: "npx",
        args: ["-y", "mcp-remote", "https://mcp.linear.app/sse"],
        env: [{ name: "LINEAR_API_KEY", value: "lin_api_x" }],
      },
      {
        type: "http",
        name: "linear-esopo",
        url: "https://mcp.linear.app/mcp",
        headers: [{ name: "Authorization", value: "Bearer tok" }],
      },
    ]);
  });
});
