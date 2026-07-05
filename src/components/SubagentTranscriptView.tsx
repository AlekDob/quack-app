import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { claudeCode, type LoadedMessage } from "../ipc";
import { MarkdownPreview } from "./MarkdownPreview";
import { ToolCallRow } from "./chatToolRender";
import { duckAvatarFor } from "../subagents";
import type { ToolCall } from "../ai";

interface Props {
  root: string;
  sessionId: string;
  toolUseId: string;
  agentType: string;
  /** Editor pane mount target. Omit when `inline` is true (agent mode split). */
  container?: HTMLElement | null;
  visible: boolean;
  /** Render in-place instead of portaling into an editor pane. */
  inline?: boolean;
  onClose?: () => void;
}

type LoadState =
  | { phase: "loading" }
  | { phase: "error"; message: string }
  | { phase: "ready"; description: string; messages: LoadedMessage[] };

/**
 * Read-only viewer for one subagent's full transcript, loaded from the
 * Claude Code sidechain jsonl on disk. There's deliberately NO composer —
 * a subagent isn't a chat you can talk to; you're inspecting what it did.
 */
export function SubagentTranscriptView({
  root,
  sessionId,
  toolUseId,
  agentType,
  container = null,
  visible,
  inline = false,
  onClose,
}: Props) {
  const [state, setState] = useState<LoadState>({ phase: "loading" });

  // Load once per (session, toolUseId). The transcript is immutable on
  // disk, so there's nothing to refresh.
  useEffect(() => {
    let cancelled = false;
    setState({ phase: "loading" });
    claudeCode
      .loadSubagent(root, sessionId, toolUseId)
      .then((r) => {
        if (!cancelled)
          setState({
            phase: "ready",
            description: r.description,
            messages: r.messages,
          });
      })
      .catch((e) => {
        if (!cancelled) setState({ phase: "error", message: String(e) });
      });
    return () => {
      cancelled = true;
    };
  }, [root, sessionId, toolUseId]);

  if (!inline && !container) return null;
  const desc = state.phase === "ready" ? state.description : "";
  const body = (
    <div
      className="subagent-view"
      style={{ display: visible ? "flex" : "none" }}
    >
      <div className="subagent-view-header">
        <img
          className="subagent-view-avatar"
          src={duckAvatarFor(agentType)}
          alt=""
          aria-hidden="true"
        />
        <div className="subagent-view-id">
          <div className="subagent-view-name">{agentType || "Subagent"}</div>
          <div className="subagent-view-sub">
            Subagent · read-only{desc ? ` · ${desc}` : ""}
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            className="subagent-view-close"
            onClick={onClose}
            title="Close"
            aria-label="Close subagent transcript"
          >
            ×
          </button>
        )}
      </div>
      <div className="subagent-view-body">
        {state.phase === "loading" && (
          <div className="subagent-view-note">Loading transcript…</div>
        )}
        {state.phase === "error" && (
          <div className="subagent-view-note">
            Couldn't load this subagent's transcript — it may have been
            cleaned up.
            <br />
            <code>{state.message}</code>
          </div>
        )}
        {state.phase === "ready" && (
          <SubagentMessages messages={state.messages} />
        )}
      </div>
    </div>
  );
  return inline ? body : createPortal(body, container!);
}

function SubagentMessages({ messages }: { messages: LoadedMessage[] }) {
  return (
    <>
      {messages.map((m, i) => {
        if (m.role === "user") {
          if (!m.content.trim()) return null; // tool-result echo / empty
          return (
            <div key={i} className="subagent-msg subagent-msg-user">
              <MarkdownPreview content={m.content} />
            </div>
          );
        }
        if (m.role !== "assistant") return null;
        const results = new Map<string, string>();
        (m.tool_results ?? []).forEach((r) =>
          results.set(r.tool_use_id, r.content),
        );
        return (
          <div key={i} className="subagent-msg subagent-msg-assistant">
            {m.content.trim() && <MarkdownPreview content={m.content} />}
            {(m.tool_calls ?? []).map((c, j) => (
              <ToolCallRow
                key={c.id ?? j}
                call={c as ToolCall}
                result={c.id ? results.get(c.id) : undefined}
              />
            ))}
          </div>
        );
      })}
    </>
  );
}
