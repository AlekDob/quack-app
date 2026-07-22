/**
 * Decide whether a Claude Code attach buffer should be replayed into the
 * chat after a remount (project switch / refresh).
 *
 * Streaming checkpoints persist a partial assistant row. When the CLI
 * turn later finishes (or the buffer is richer), a naive "last role is
 * assistant → skip" gate freezes the truncated text forever. Compare
 * reconstructed buffer text length against the Quack checkpoint instead.
 */

export interface AttachBufferLine {
  kind?: string;
  line?: string;
  code?: number;
}

/** Sum of assistant-visible text chars reconstructible from attach lines. */
export function attachBufferAssistantChars(lines: AttachBufferLine[]): number {
  let n = 0;
  let msgGotDeltas = false;
  for (const ln of lines) {
    if (ln.kind === "stderr" && ln.line) {
      n += `\n[claude] ${ln.line}`.length;
      continue;
    }
    if (ln.kind !== "line" || !ln.line) continue;
    try {
      const obj = JSON.parse(ln.line) as {
        type?: string;
        delta?: { type?: string; text?: string };
        message?: { content?: Array<{ type?: string; text?: string }> };
      };
      if (obj.type === "message_start") {
        msgGotDeltas = false;
        continue;
      }
      if (
        obj.type === "content_block_delta" &&
        obj.delta?.type === "text_delta" &&
        typeof obj.delta.text === "string"
      ) {
        msgGotDeltas = true;
        n += obj.delta.text.length;
        continue;
      }
      if (obj.type === "assistant" && Array.isArray(obj.message?.content)) {
        if (msgGotDeltas) continue;
        for (const block of obj.message.content) {
          if (block.type === "text" && typeof block.text === "string") {
            n += block.text.length;
          }
        }
      }
    } catch {
      /* skip non-JSON */
    }
  }
  return n;
}

/**
 * When the attach stream has already ended and Quack already ends on an
 * assistant row: skip replay iff Quack's text is at least as long as the
 * buffer (refresh would otherwise duplicate a completed turn).
 */
export function shouldSkipEndedAttachReplay(
  lastAssistantChars: number,
  bufferChars: number,
): boolean {
  return bufferChars <= lastAssistantChars;
}
