import { afterEach, describe, expect, it, vi } from "vitest";
import {
  logAgentModePhase,
  markAgentModeSwitch,
} from "./switchPerf";

describe("agent-mode-switch perf marks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs start then phases with sinceMs", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    markAgentModeSwitch("ide");
    logAgentModePhase("editors ready", { wsId: "ws-1" });
    expect(spy).toHaveBeenCalledWith(
      "[agent-mode-switch] start",
      expect.objectContaining({ to: "ide" }),
    );
    expect(spy).toHaveBeenCalledWith(
      "[agent-mode-switch] editors ready",
      expect.objectContaining({
        to: "ide",
        wsId: "ws-1",
        sinceMs: expect.any(Number),
      }),
    );
  });

  it("logs agent direction start", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {});
    markAgentModeSwitch("agent");
    logAgentModePhase("agent-shell mounted", { wsId: "ws-2" });
    expect(spy).toHaveBeenCalledWith(
      "[agent-mode-switch] start",
      expect.objectContaining({ to: "agent" }),
    );
    expect(spy).toHaveBeenCalledWith(
      "[agent-mode-switch] agent-shell mounted",
      expect.objectContaining({ to: "agent", wsId: "ws-2" }),
    );
  });
});
