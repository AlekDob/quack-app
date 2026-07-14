import type { ToolCall } from "../ai";
import { MarkdownPreview } from "./MarkdownPreview";
import { ToolCallRow } from "./chatToolRender";

export interface TranscriptTurn {
  role: "user" | "assistant";
  content: string;
  tool_calls?: ToolCall[];
  tool_results?: { tool_use_id: string; content: string }[];
}

interface Props {
  turns: TranscriptTurn[];
  assistantAvatar: string;
  assistantName: string;
  assistantTitle?: string;
}

/** Read-only transcript turns — same markup as the main chat stream. */
export function TranscriptTurnRows({
  turns,
  assistantAvatar,
  assistantName,
  assistantTitle = "Subagent",
}: Props) {
  return (
    <>
      {turns.map((m, i) => {
        if (m.role === "user") {
          if (!m.content.trim()) return null;
          return (
            <div key={i} className="ai-turn">
              <div className="ai-msg ai-msg-user">
                <div className="ai-user-bar is-expanded">
                  <div className="ai-user-bar-main">
                    <MarkdownPreview content={m.content} />
                  </div>
                </div>
              </div>
            </div>
          );
        }
        if (m.role !== "assistant") return null;
        const results = new Map<string, string>();
        (m.tool_results ?? []).forEach((r) =>
          results.set(r.tool_use_id, r.content),
        );
        const calls = m.tool_calls ?? [];
        return (
          <div key={i} className="ai-msg ai-msg-assistant">
            <span className="ai-msg-role">
              <img
                className="ai-msg-avatar"
                src={assistantAvatar}
                alt=""
                aria-hidden="true"
              />
              <span className="ai-msg-identity">
                <span className="ai-msg-name">{assistantName}</span>
                <span className="ai-msg-title">{assistantTitle}</span>
              </span>
            </span>
            {calls.length > 0 && (
              <div className="ai-tcalls">
                {calls.map((c, j) => (
                  <ToolCallRow
                    key={c.id ?? j}
                    call={c}
                    result={c.id ? results.get(c.id) : undefined}
                  />
                ))}
              </div>
            )}
            {m.content.trim() && (
              <div className="ai-msg-body">
                <MarkdownPreview content={m.content} />
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}
