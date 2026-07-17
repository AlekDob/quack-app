// Open Team / Works from the agents sidebar while respecting agent mode:
// in agent mode the editor chrome is hidden, so surfaces land in the
// right drawer instead of a background tab.

import { getAgentMode } from "./agentMode";
import { useStore, wbKey, worksKey } from "./store";

export type AgentSurfaceNav = "team" | "works";

export function openAgentSurface(wsId: string, surface: AgentSurfaceNav): void {
  const tabKey = surface === "team" ? wbKey(wsId) : worksKey(wsId);
  const st = useStore.getState();
  if (getAgentMode()) {
    st.moveTabToDrawer(wsId, tabKey);
    return;
  }
  if (surface === "team") st.wbOpen(wsId);
  else st.worksOpen(wsId);
}
