// agentContextNav pulls in the store (React tree) at import time, which reads
// navigator/localStorage. Stub them (import is dynamic so the stubs land first)
// instead of adding a jsdom dependency for one test.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";

type Nav = typeof import("./agentContextNav");
let nav: Nav;

beforeAll(async () => {
  const g = globalThis as Record<string, unknown>;
  g.navigator ??= { platform: "MacIntel" };
  g.localStorage ??= {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
  };
  nav = await import("./agentContextNav");
});

describe("agent context collapse", () => {
  beforeEach(() => nav.setAgentContextCollapsed(true));

  it("defaults to collapsed", () => {
    expect(nav.isAgentContextCollapsed()).toBe(true);
  });

  it("expands when a view is focused", () => {
    nav.focusAgentFiles("ws1");
    expect(nav.isAgentContextCollapsed()).toBe(false);
    expect(nav.getAgentContextPanel("ws1")).toBe("files");
  });

  it("toggle collapses only when that view is already open", () => {
    nav.toggleAgentFiles("ws1"); // collapsed -> open Files
    expect(nav.isAgentContextCollapsed()).toBe(false);
    nav.toggleAgentFiles("ws1"); // open Files -> collapse
    expect(nav.isAgentContextCollapsed()).toBe(true);
  });
});
