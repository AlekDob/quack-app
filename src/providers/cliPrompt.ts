import type { ChatMessage } from "../ai";

/** Latest user turn — used when resuming a CLI session. */
export function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user") return m.content;
  }
  return "";
}

/** Flatten chat history into a single prompt for the first CLI turn. */
export function flattenMessages(messages: ChatMessage[]): string {
  const parts: string[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      parts.push(`[System]\n${m.content}\n`);
    } else if (m.role === "user") {
      parts.push(`[User]\n${m.content}\n`);
    } else if (m.role === "assistant") {
      if (m.content) parts.push(`[Assistant]\n${m.content}\n`);
    } else if (m.role === "tool") {
      parts.push(`[Tool result]\n${m.content}\n`);
    }
  }
  return parts.join("\n");
}
