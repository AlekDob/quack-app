// FILE: usageNotchIpc.ts
// Purpose: Narrow IPC boundary for the primary renderer and usage-notch renderer.

import type { IpcMain } from "electron";
import type { UsageNotchManager } from "./usageNotchManager";

export function registerUsageNotchIpcHandlers(input: {
  ipcMain: Pick<IpcMain, "handle" | "removeHandler">;
  channels: {
    readonly setEnabled: string;
    readonly setPresentation: string;
    readonly getState: string;
  };
  manager: UsageNotchManager;
}): void {
  for (const channel of Object.values(input.channels)) input.ipcMain.removeHandler(channel);
  input.ipcMain.handle(input.channels.getState, () => input.manager.getState());
  input.ipcMain.handle(input.channels.setEnabled, (_event, enabled: unknown) =>
    input.manager.setEnabled(enabled === true),
  );
  input.ipcMain.handle(input.channels.setPresentation, (_event, presentation: unknown) =>
    input.manager.setPresentation(presentation === "expanded" ? "expanded" : "compact"),
  );
}
