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
  const { system, prompt } = splitCliPrompt(messages);
  if (!system) return prompt;
  return `[System]\n${system}\n\n${prompt}`;
}

/**
 * Split system instructions from the conversational turn(s).
 * OpenCode's HTTP API accepts `system` separately — inlining it as
 * `[System]` text makes some models echo the whole block back.
 */
export function splitCliPrompt(messages: ChatMessage[]): {
  system: string;
  prompt: string;
} {
  const systemParts: string[] = [];
  const convoParts: string[] = [];
  for (const m of messages) {
    if (m.role === "system") {
      systemParts.push(m.content);
    } else if (m.role === "user") {
      convoParts.push(`[User]\n${m.content}\n`);
    } else if (m.role === "assistant") {
      if (m.content) convoParts.push(`[Assistant]\n${m.content}\n`);
    } else if (m.role === "tool") {
      convoParts.push(`[Tool result]\n${m.content}\n`);
    }
  }
  return {
    system: systemParts.join("\n\n"),
    prompt: convoParts.join("\n"),
  };
}
