import { pulseChatSwitch } from "./chatSwitch";
import { setHubExpanded } from "./hubPrefs";
import { markNewChat } from "./switchPerf";
import { activeAiChatId, useStore, type TerminalLocation } from "./store";

export function anchorFromElement(
  el: HTMLElement | null,
): { x: number; y: number } {
  if (!el) return defaultNewChatAnchor();
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.bottom + 8 };
}

export function defaultNewChatAnchor(): { x: number; y: number } {
  const hubBtn = document.querySelector<HTMLElement>(
    ".agent-hub-add:not(:disabled)",
  );
  if (hubBtn) return anchorFromElement(hubBtn);
  return { x: window.innerWidth * 0.5, y: window.innerHeight * 0.28 };
}

/** Close the legacy singleton side panel so only tabbed hub sessions run. */
function dismissLegacyAiPanel(wsId: string): void {
  const ws = useStore.getState().loaded[wsId];
  if (!ws?.layout.aiPanelVisible) return;
  useStore.getState().setAIPanelVisible(wsId, false);
}

/** Create a chat tab, focus it, and flag inline naming in the empty panel. */
export function addNewAIChat(
  wsId: string,
  location: TerminalLocation = "editor",
  _anchor?: { x: number; y: number },
): string {
  dismissLegacyAiPanel(wsId);
  // Surface the session in the Agent Hub (collapsed 44px rail is easy to miss).
  setHubExpanded(true);
  pulseChatSwitch({ veil: false, source: "addNewAIChat" });
  const chatId = useStore.getState().addAIChat(wsId, location);
  markNewChat(chatId); // dev: time the fresh-panel mount cascade
  useStore.getState().focusAIChat(wsId, chatId);
  useStore.getState().setAIChatNamePending(wsId, chatId, true);
  return chatId;
}

/**
 * Focus the active tabbed AI chat, or create one. Prefer this over the
 * legacy `aiPanelVisible` singleton — orphan panels never appear in the
 * hub and double-subscribe to prompts with sticky multitask hosts.
 */
export function ensureFocusedAIChat(wsId: string): string {
  dismissLegacyAiPanel(wsId);
  const ws = useStore.getState().loaded[wsId];
  const active = ws ? activeAiChatId(ws) : null;
  if (active) {
    useStore.getState().focusAIChat(wsId, active);
    setHubExpanded(true);
    return active;
  }
  return addNewAIChat(wsId, "editor");
}
