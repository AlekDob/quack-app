import type { ChatMessage } from "../ai";

/** Wire-only hint so a lost --resume flatten still points the CLI at attachments. */
export function wireUserContent(m: ChatMessage): string {
  const imgs = m.images;
  if (!imgs?.length) return m.content;
  if (imgs.some((i) => i.path && m.content.includes(i.path))) return m.content;
  const paths = imgs.map((i) => i.path).filter(Boolean).join(", ");
  if (!paths) return m.content;
  const n = imgs.length;
  return (
    `${m.content}\n\n[Attached ${n === 1 ? "image" : "images"} — ` +
    `view with your Read tool: ${paths}]`
  );
}

/** Latest user turn — used when resuming a CLI session. */
export function lastUserMessage(messages: ChatMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role === "user") return wireUserContent(m);
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
 * Some CLIs accept `system` separately — inlining it as
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
      convoParts.push(`[User]\n${wireUserContent(m)}\n`);
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
