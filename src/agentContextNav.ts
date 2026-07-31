// Agent Mode right-column panel selection — module pub/sub so StatusBar
// / commands can focus Terminal without prop-drilling through the shell.
// Descriptors stay in WorkspaceData.terminals; this only tracks which
// view is showing (Changes / Files / Plan / term:<id>).

import { useEffect, useState } from "react";
import { useStore } from "./store";
import { getJson, setJson } from "./localStore";

export type AgentContextPanel =
  | "changes"
  | "files"
  | "docs"
  | "plan"
  | `term:${string}`;

const panelByWs = new Map<string, AgentContextPanel>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function getAgentContextPanel(wsId: string): AgentContextPanel {
  return panelByWs.get(wsId) ?? "changes";
}

export function setAgentContextPanel(
  wsId: string,
  panel: AgentContextPanel,
): void {
  if (panelByWs.get(wsId) === panel) return;
  panelByWs.set(wsId, panel);
  notify();
}

export function subscribeAgentContextPanel(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useAgentContextPanel(wsId: string): AgentContextPanel {
  const [panel, setPanel] = useState(() => getAgentContextPanel(wsId));
  useEffect(() => {
    setPanel(getAgentContextPanel(wsId));
    return subscribeAgentContextPanel(() =>
      setPanel(getAgentContextPanel(wsId)),
    );
  }, [wsId]);
  return panel;
}

// Cursor-style default: the context column starts collapsed to an icon rail
// and only expands on demand (persisted globally, not per project).
const COLLAPSED_KEY = "lcp.agent.contextCollapsed";
let collapsed = getJson(
  COLLAPSED_KEY,
  true,
  (v): v is boolean => typeof v === "boolean",
);

export function isAgentContextCollapsed(): boolean {
  return collapsed;
}

export function setAgentContextCollapsed(next: boolean): void {
  if (collapsed === next) return;
  collapsed = next;
  setJson(COLLAPSED_KEY, next);
  notify();
}

export function toggleAgentContextCollapsed(): void {
  setAgentContextCollapsed(!collapsed);
}

/** Select a panel and make sure the column is visible (expand if collapsed). */
function openPanel(wsId: string, panel: AgentContextPanel): void {
  setAgentContextCollapsed(false);
  setAgentContextPanel(wsId, panel);
}

export function termPanelOf(id: string): AgentContextPanel {
  return `term:${id}`;
}

export function termIdOfPanel(panel: AgentContextPanel): string | null {
  return panel.startsWith("term:") ? panel.slice(5) : null;
}

/** Show a project terminal in Agent Mode (create one if none exist). */
export function focusAgentTerminal(wsId: string): void {
  const ws = useStore.getState().loaded[wsId];
  if (!ws) return;
  const ids = Object.keys(ws.terminals);
  if (ids.length === 0) {
    const id = useStore.getState().addTerminal(wsId, "bottom");
    openPanel(wsId, termPanelOf(id));
    return;
  }
  const cur = termIdOfPanel(getAgentContextPanel(wsId));
  const pick = cur && ws.terminals[cur] ? cur : ids[ids.length - 1];
  openPanel(wsId, termPanelOf(pick));
}

/** Toggle: terminal view ↔ collapsed rail (Agent Mode panel substitute). */
export function toggleAgentTerminal(wsId: string): void {
  if (!collapsed && termIdOfPanel(getAgentContextPanel(wsId))) {
    setAgentContextCollapsed(true);
    return;
  }
  focusAgentTerminal(wsId);
}

/** New PTY + select it in the Agent Mode tab strip. */
export function newAgentTerminal(wsId: string): void {
  const id = useStore.getState().addTerminal(wsId, "bottom");
  openPanel(wsId, termPanelOf(id));
}

/** Show the on-demand Plan tab (ExitPlanMode buy-in). */
export function focusAgentPlan(wsId: string): void {
  openPanel(wsId, "plan");
}

/** Show Files in the Agent Mode context column (Explorer substitute). */
export function focusAgentFiles(wsId: string): void {
  openPanel(wsId, "files");
}

/** Show Changes in the Agent Mode context column (Source Control substitute). */
export function focusAgentChanges(wsId: string): void {
  openPanel(wsId, "changes");
}

/** Toggle Files ↔ collapsed rail — Agent Mode stand-in for Toggle Sidebar. */
export function toggleAgentFiles(wsId: string): void {
  if (!collapsed && getAgentContextPanel(wsId) === "files") {
    setAgentContextCollapsed(true);
    return;
  }
  focusAgentFiles(wsId);
}
