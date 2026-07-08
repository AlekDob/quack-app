import { invoke } from "@tauri-apps/api/core";
import { requestChatStop } from "./aiStopBus";
import { parseQualifiedModel } from "./providers/types";
import type { AIChatDescriptor } from "./store";

/** Stop an agent turn for a chat tab — CLI subprocess tree + panel abort.
 *  Does NOT touch workspace PTY terminals (Terminal 1, make dev full, etc.).
 *  Those are only killed when the user closes that terminal tab, enables
 *  idle-terminal close, or closes the whole workspace. */
export async function stopChatAgent(
  desc: Pick<AIChatDescriptor, "id" | "sessionId" | "model">,
): Promise<void> {
  requestChatStop(desc.id);
  const providerId = desc.model
    ? parseQualifiedModel(desc.model)?.providerId
    : "claude-code";
  if (providerId === "cursor-cli") {
    await invoke("cursor_code_kill_session", {
      chatSessionId: desc.sessionId,
    }).catch(() => {});
    return;
  }
  if (providerId === "claude-code" || !providerId) {
    await invoke("claude_code_kill_session", {
      chatSessionId: desc.sessionId,
    }).catch(() => {});
  }
}
