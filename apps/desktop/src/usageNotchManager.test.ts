import { describe, expect, it, vi } from "vitest";
import { UsageNotchManager } from "./usageNotchManager";

function createHarness(platform: NodeJS.Platform = "darwin") {
  const window = {
    isDestroyed: vi.fn(() => false),
    setBounds: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    showInactive: vi.fn(),
    destroy: vi.fn(),
  };
  const logoWindow = {
    isDestroyed: vi.fn(() => false),
    setBounds: vi.fn(),
    setIgnoreMouseEvents: vi.fn(),
    setAlwaysOnTop: vi.fn(),
    setVisibleOnAllWorkspaces: vi.fn(),
    showInactive: vi.fn(),
    destroy: vi.fn(),
  };
  const screen = {
    getPrimaryDisplay: vi.fn(() => ({ id: 7, bounds: { x: 0, y: 0, width: 1440, height: 900 } })),
    on: vi.fn(),
    removeListener: vi.fn(),
  };
  const createWindow = vi.fn(() => window);
  const createLogoWindow = vi.fn(() => logoWindow);
  return {
    manager: new UsageNotchManager({ platform, screen: screen as never, createWindow, createLogoWindow }),
    window,
    logoWindow,
    screen,
    createWindow,
  };
}

describe("UsageNotchManager", () => {
  it("creates and positions a macOS overlay only after it is enabled", () => {
    const harness = createHarness();
    expect(harness.createWindow).not.toHaveBeenCalled();
    expect(harness.manager.setEnabled(true)).toMatchObject({ enabled: true, displayId: 7 });
    expect(harness.createWindow).toHaveBeenCalledOnce();
    expect(harness.logoWindow.setBounds).toHaveBeenLastCalledWith({
      x: 700,
      y: 0,
      width: 40,
      height: 40,
    });
    expect(harness.window.setBounds).toHaveBeenLastCalledWith({ x: 700, y: 0, width: 40, height: 40 });
    harness.manager.setPresentation("expanded");
    expect(harness.window.setBounds).toHaveBeenLastCalledWith({
      x: 340,
      y: 0,
      width: 760,
      height: 286,
    });
    harness.manager.setEnabled(false);
    expect(harness.window.destroy).toHaveBeenCalledOnce();
    expect(harness.logoWindow.destroy).toHaveBeenCalledOnce();
  });

  it("does nothing outside macOS", () => {
    const harness = createHarness("win32");
    expect(harness.manager.setEnabled(true)).toMatchObject({ supported: false, enabled: false });
    expect(harness.createWindow).not.toHaveBeenCalled();
  });
});
