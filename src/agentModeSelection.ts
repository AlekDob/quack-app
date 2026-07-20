/** Survives Agent Mode ↔ IDE shell remount (component state does not). */

const selectedByWs = new Map<string, string>();

export function getAgentSelectedChat(wsId: string): string | undefined {
  return selectedByWs.get(wsId);
}

export function setAgentSelectedChat(wsId: string, chatId: string): void {
  selectedByWs.set(wsId, chatId);
}

export function clearAgentSelectedChat(wsId: string): void {
  selectedByWs.delete(wsId);
}
