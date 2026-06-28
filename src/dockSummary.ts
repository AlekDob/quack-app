// Shared contract between the main window (producer) and the floating Dock
// window (renderer). The Dock is a separate webview, so it can't read the
// main window's in-memory stores directly — the main window's
// AgentHubWatcher computes a compact per-project summary and broadcasts it
// over a Tauri event; the Dock listens and renders. It also drives the
// native macOS Dock-icon badge (total items needing attention).

import { invoke } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { useStore } from "./store";
import {
  getAgentStatus,
  isSeen,
  resolveDisplayStatus,
} from "./agentStatusStore";
import { getWorkspaceColor } from "./workspaceColors";

/** One project (open workspace) as the Dock shows it: a colored circle with
 *  attention counters. */
export interface DockProject {
  wsId: string;
  name: string;
  colorHex: string | null;
  /** Chats that finished and haven't been looked at yet. */
  ready: number;
  /** Chats blocked on a permission request or a question. */
  needsInput: number;
}

// Tauri event channel names — main ⇄ dock.
export const DOCK_SUMMARY_EVENT = "dock:summary";
export const DOCK_FOCUS_EVENT = "dock:focus-project";
export const DOCK_REQUEST_EVENT = "dock:request";

/**
 * Per-project counts, using the SAME display status the Agent Hub shows
 * (so a chat that reads "Ready" in the hub is counted here too — earlier
 * the dock only counted live records and missed resting-ready chats).
 * "ready" is the resting state (waiting for the user); "needs-input" is a
 * pending permission/question. Archived/done/working chats aren't counted.
 */
export function computeDockProjects(): DockProject[] {
  const { loaded } = useStore.getState();
  const out: DockProject[] = [];
  for (const [wsId, ws] of Object.entries(loaded)) {
    let ready = 0;
    let needsInput = 0;
    for (const chat of Object.values(ws.aiChats)) {
      const status = resolveDisplayStatus({
        lifecycle: chat.archivedAt
          ? "archived"
          : chat.doneAt
            ? "done"
            : "active",
        live: getAgentStatus(chat.id),
        seen: isSeen(chat.id),
      });
      if (status === "needs-input") needsInput++;
      else if (status === "ready") ready++;
    }
    out.push({
      wsId,
      name: ws.meta.name,
      colorHex: getWorkspaceColor(wsId)?.hex ?? null,
      ready,
      needsInput,
    });
  }
  return out;
}

/** Broadcast the current summary to the Dock window and update the native
 *  Dock-icon badge. Fire-and-forget; safe when no Dock window exists. */
export function emitDockSummary(): void {
  const projects = computeDockProjects();
  void emit(DOCK_SUMMARY_EVENT, projects);
  const total = projects.reduce((n, p) => n + p.ready + p.needsInput, 0);
  void invoke("set_dock_badge", { count: total }).catch(() => {});
}
