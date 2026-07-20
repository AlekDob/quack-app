/** Dev console + Perf Audit timeline for chat/tab switch — filter: `[chat-switch]`. */

import { recordPerfEvent } from "./perfAuditBus";

function pickElapsed(data?: Record<string, unknown>): number | undefined {
  if (!data) return undefined;
  for (const key of ["elapsedMs", "loadMs", "sinceMs"] as const) {
    const v = data[key];
    if (typeof v === "number") return v;
  }
  return undefined;
}

export function logChatSwitch(
  msg: string,
  data?: Record<string, unknown>,
): void {
  if (data) console.log(`[chat-switch] ${msg}`, data);
  else console.log(`[chat-switch] ${msg}`);
  recordPerfEvent("chat-switch", msg, {
    elapsedMs: pickElapsed(data),
    detail: data,
  });
}
