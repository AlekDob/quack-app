import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { claudeCode, type LoadedMessage } from "../ipc";
import { duckAvatarFor } from "../subagents";
import { streamModelLabel } from "../streamModelLabel";
import type { ToolCall } from "../ai";
import { TranscriptTurnRows, type TranscriptTurn } from "./TranscriptTurnRows";

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
  | {
      phase: "ready";
      description: string;
      model?: string | null;
      messages: LoadedMessage[];
    };

function toTranscriptTurns(messages: LoadedMessage[]): TranscriptTurn[] {
  return messages.flatMap((m) => {
    if (m.role !== "user" && m.role !== "assistant") return [];
    return [
      {
        role: m.role,
        content: m.content,
        tool_calls: m.tool_calls as ToolCall[] | undefined,
        tool_results: m.tool_results,
      },
    ];
  });
}

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
            model: r.model,
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
  const modelLabel =
    state.phase === "ready" ? streamModelLabel(state.model) : null;
  const name = agentType || "Subagent";
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
          <div className="subagent-view-name">
            {name}
            {modelLabel && (
              <span className="subagent-view-model"> {modelLabel}</span>
            )}
          </div>
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
      <div className="ai-panel compact subagent-view-body">
        <div className="ai-messages">
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
            <TranscriptTurnRows
              turns={toTranscriptTurns(state.messages)}
              assistantAvatar={duckAvatarFor(agentType)}
              assistantName={name}
              assistantTitle="Subagent · read-only"
            />
          )}
        </div>
      </div>
    </div>
  );
  return inline ? body : createPortal(body, container!);
}
