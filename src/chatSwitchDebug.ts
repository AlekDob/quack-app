/** Dev console trace for chat/tab switch perf — filter: `[chat-switch]`. */

export function logChatSwitch(
  msg: string,
  data?: Record<string, unknown>,
): void {
  if (data) console.log(`[chat-switch] ${msg}`, data);
  else console.log(`[chat-switch] ${msg}`);
}
