// FILE: usageNotchManager.ts
// Purpose: Owns the lifecycle and placement of the macOS usage-notch overlay.

import type { Display, Screen } from "electron";
import {
  resolveUsageNotchBounds,
  type UsageNotchBounds,
  type UsageNotchPresentation,
} from "./usageNotchGeometry";

export interface UsageNotchWindow {
  isDestroyed(): boolean;
  setBounds(bounds: UsageNotchBounds): void;
  setIgnoreMouseEvents(ignore: boolean): void;
  setAlwaysOnTop(flag: boolean, level?: "screen-saver", relativeLevel?: number): void;
  setVisibleOnAllWorkspaces(visible: boolean, options?: { visibleOnFullScreen?: boolean }): void;
  showInactive(): void;
  destroy(): void;
}

export interface UsageNotchManagerOptions {
  readonly platform: NodeJS.Platform;
  readonly screen: Pick<Screen, "getPrimaryDisplay" | "on" | "removeListener">;
  readonly createWindow: () => UsageNotchWindow;
  readonly createLogoWindow: () => UsageNotchWindow;
}

export interface UsageNotchState {
  readonly supported: boolean;
  readonly enabled: boolean;
  readonly presentation: UsageNotchPresentation;
  readonly displayId: number | null;
}

export class UsageNotchManager {
  readonly #options: UsageNotchManagerOptions;
  #window: UsageNotchWindow | null = null;
  #logoWindow: UsageNotchWindow | null = null;
  #enabled = false;
  #presentation: UsageNotchPresentation = "compact";
  #disposed = false;
  readonly #onDisplayChanged = () => this.#applyBounds();

  constructor(options: UsageNotchManagerOptions) {
    this.#options = options;
    if (this.supported) {
      options.screen.on("display-added", this.#onDisplayChanged);
      options.screen.on("display-removed", this.#onDisplayChanged);
      options.screen.on("display-metrics-changed", this.#onDisplayChanged);
    }
  }

  get supported(): boolean {
    return this.#options.platform === "darwin";
  }

  getState(): UsageNotchState {
    return {
      supported: this.supported,
      enabled: this.#enabled,
      presentation: this.#presentation,
      displayId:
        this.#enabled && this.supported ? this.#options.screen.getPrimaryDisplay().id : null,
    };
  }

  setEnabled(enabled: boolean): UsageNotchState {
    if (this.#disposed || !this.supported) return this.getState();
    this.#enabled = enabled;
    this.#presentation = "compact";
    if (!enabled) {
      this.#destroyWindow();
      return this.getState();
    }
    this.#ensureWindow();
    this.#applyBounds();
    this.#window?.showInactive();
    this.#logoWindow?.showInactive();
    return this.getState();
  }

  setPresentation(presentation: UsageNotchPresentation): UsageNotchState {
    if (!this.#enabled || this.#disposed || !this.supported) return this.getState();
    this.#presentation = presentation;
    this.#applyBounds();
    return this.getState();
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    if (this.supported) {
      this.#options.screen.removeListener("display-added", this.#onDisplayChanged);
      this.#options.screen.removeListener("display-removed", this.#onDisplayChanged);
      this.#options.screen.removeListener("display-metrics-changed", this.#onDisplayChanged);
    }
    this.#destroyWindow();
  }

  #ensureWindow(): void {
    if (!this.#window || this.#window.isDestroyed()) {
      this.#window = this.#options.createWindow();
      this.#window.setAlwaysOnTop(true, "screen-saver");
      this.#window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
    if (!this.#logoWindow || this.#logoWindow.isDestroyed()) {
      this.#logoWindow = this.#options.createLogoWindow();
      this.#logoWindow.setIgnoreMouseEvents(true);
      this.#logoWindow.setAlwaysOnTop(true, "screen-saver");
      this.#logoWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    }
  }

  #applyBounds(): void {
    if (!this.#enabled || !this.#window || this.#window.isDestroyed()) return;
    const display: Display = this.#options.screen.getPrimaryDisplay();
    const nextBounds = resolveUsageNotchBounds({ display: display.bounds, presentation: this.#presentation });
    this.#window.setBounds(nextBounds);
    this.#logoWindow?.setBounds(
      resolveUsageNotchBounds({ display: display.bounds, presentation: "compact" }),
    );
  }

  #destroyWindow(): void {
    const logoWindow = this.#logoWindow;
    this.#logoWindow = null;
    if (logoWindow && !logoWindow.isDestroyed()) logoWindow.destroy();
    const window = this.#window;
    this.#window = null;
    if (window && !window.isDestroyed()) window.destroy();
  }
}
