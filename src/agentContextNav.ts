// Agent Mode right-column panel selection — module pub/sub so StatusBar
// / commands can focus Terminal without prop-drilling through the shell.
// Descriptors stay in WorkspaceData.terminals; this only tracks which
// view is showing (Changes / Files / term:<id>).

import { useEffect, useState } from "react";
import { useStore } from "./store";

export type AgentContextPanel = "changes" | "files" | `term:${string}`;

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
    setAgentContextPanel(wsId, termPanelOf(id));
    return;
  }
  const cur = termIdOfPanel(getAgentContextPanel(wsId));
  const pick = cur && ws.terminals[cur] ? cur : ids[ids.length - 1];
  setAgentContextPanel(wsId, termPanelOf(pick));
}

/** Toggle: terminal view ↔ Changes (Agent Mode panel substitute). */
export function toggleAgentTerminal(wsId: string): void {
  const panel = getAgentContextPanel(wsId);
  if (termIdOfPanel(panel)) {
    setAgentContextPanel(wsId, "changes");
    return;
  }
  focusAgentTerminal(wsId);
}

/** New PTY + select it in the Agent Mode tab strip. */
export function newAgentTerminal(wsId: string): void {
  const id = useStore.getState().addTerminal(wsId, "bottom");
  setAgentContextPanel(wsId, termPanelOf(id));
}
