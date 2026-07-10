import { pulseChatSwitch } from "./chatSwitch";
import { openNewChatNamePrompt } from "./newChatNamePrompt";
import { useStore, type TerminalLocation } from "./store";

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

/** Create a chat tab, focus it, and prompt for a human-readable name. */
export function addNewAIChat(
  wsId: string,
  location: TerminalLocation = "editor",
  anchor?: { x: number; y: number },
): string {
  pulseChatSwitch();
  const chatId = useStore.getState().addAIChat(wsId, location);
  useStore.getState().focusAIChat(wsId, chatId);
  openNewChatNamePrompt({
    wsId,
    chatId,
    anchor: anchor ?? defaultNewChatAnchor(),
  });
  return chatId;
}
