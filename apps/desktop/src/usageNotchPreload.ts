// FILE: usageNotchPreload.ts
// Purpose: Exposes only the capabilities required by the usage-notch renderer.

import { contextBridge, ipcRenderer } from "electron";
import { normalizeDesktopWsUrl, resolveDesktopWsUrlFromEnv } from "./desktopWsBridge";
import { DESKTOP_IPC_CHANNELS } from "./ipcChannels";

function getWsUrl(): string | null {
  try {
    return (
      normalizeDesktopWsUrl(ipcRenderer.sendSync(DESKTOP_IPC_CHANNELS.wsUrl)) ??
      resolveDesktopWsUrlFromEnv(process.env)
    );
  } catch {
    return resolveDesktopWsUrlFromEnv(process.env);
  }
}

contextBridge.exposeInMainWorld("usageNotchBridge", {
  getWsUrl,
  setPresentation: (presentation: "compact" | "expanded") =>
    ipcRenderer.invoke(DESKTOP_IPC_CHANNELS.usageNotch.setPresentation, presentation),
});
