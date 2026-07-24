/** Agent Mode warm host LRU — keep recently viewed live chats mounted so
 *  session hops are CSS toggles (Cursor-feel) instead of remount+hydrate.
 *
 *  IDE already has this via open `ai:` tabs (`tabOpen`). Agent Mode has no
 *  tab strip, so this module is the equivalent warm set.
 */

const MAX_WARM = 5;
const order: string[] = [];

/** Mark a chat as recently selected (MRU). Call before the mount pass. */
export function touchAgentChatWarm(chatId: string): void {
  const i = order.indexOf(chatId);
  if (i >= 0) order.splice(i, 1);
  order.unshift(chatId);
  while (order.length > MAX_WARM) order.pop();
}

export function isAgentChatWarm(chatId: string): boolean {
  return order.includes(chatId);
}

export function agentChatWarmIds(): readonly string[] {
  return order;
}

/** Test helper — wipe the LRU between cases. */
export function clearAgentChatWarm(): void {
  order.length = 0;
}
