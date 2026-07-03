import { Icon } from "./Icon";
import {
  RunningToolList,
  StatusPill,
} from "./chatToolRender";
import type { ChatMessage } from "../ai";

type ToolLabel = {
  id?: string;
  name: string;
  detail: string;
  preview?: string;
  status: "running" | "done" | "error";
};

type Props = {
  runningTools: boolean;
  streaming: string | null;
  streamingBlocks: NonNullable<ChatMessage["blocks"]>;
  activeToolLabels: ToolLabel[];
  tokensPerSec: number | null;
  warmingUp: boolean;
  lastStreamEventAt: number | null;
  onStop: () => void;
};

export function TurnStreamStatus({
  runningTools,
  streaming,
  streamingBlocks,
  activeToolLabels,
  tokensPerSec,
  warmingUp,
  lastStreamEventAt,
  onStop,
}: Props) {
  const planning =
    streaming !== null &&
    streaming.trim().length === 0 &&
    streamingBlocks.length === 0 &&
    !runningTools;

  const generating =
    streaming !== null &&
    tokensPerSec !== null &&
    !runningTools &&
    !(warmingUp && streaming.length === 0) &&
    !(streaming.length === 0 && streamingBlocks.length === 0 && !warmingUp);

  const idleSec =
    streaming !== null && lastStreamEventAt !== null
      ? Math.floor((Date.now() - lastStreamEventAt) / 1000)
      : 0;
  const stale = streaming !== null && lastStreamEventAt !== null && idleSec >= 10;

  if (!runningTools && !planning && !generating && !stale) return null;

  return (
    <>
      {planning && (
        <div className="ai-turn-hint">
          <span className="ai-spinner" />
          <span>{warmingUp ? "Loading model…" : "Planning next moves…"}</span>
        </div>
      )}
      {runningTools &&
        (activeToolLabels.length === 0 ? (
          <StatusPill
            trail={
              streaming !== null && tokensPerSec !== null ? (
                <span className="ai-inline-tps">
                  {tokensPerSec.toFixed(1)} t/s
                </span>
              ) : undefined
            }
          >
            <span className="ai-spinner" />
            <span>Running tools…</span>
          </StatusPill>
        ) : (() => {
            const done = activeToolLabels.filter(
              (t) => t.status === "done" || t.status === "error",
            ).length;
            const total = activeToolLabels.length;
            const allDone = done === total;
            const streamStillActive = streaming !== null;
            const toolsRenderedInline = streamingBlocks.some(
              (b) => b.kind === "tool_call",
            );
            const header =
              allDone && streamStillActive
                ? `Got ${total} tool result${total === 1 ? "" : "s"} — generating response…`
                : allDone
                  ? `Finished ${total} tool${total === 1 ? "" : "s"}`
                  : `${done} of ${total} done · ${total - done} running`;
            return (
              <StatusPill
                trail={
                  streaming !== null && tokensPerSec !== null ? (
                    <span className="ai-inline-tps">
                      {tokensPerSec.toFixed(1)} t/s
                    </span>
                  ) : undefined
                }
                list={
                  !toolsRenderedInline ? (
                    <RunningToolList entries={activeToolLabels} />
                  ) : undefined
                }
              >
                {allDone && !streamStillActive ? (
                  <span className="ai-running-check">
                    <Icon name="check" size={12} />
                  </span>
                ) : (
                  <span className="ai-spinner" />
                )}
                <span>{header}</span>
              </StatusPill>
            );
          })())}
      {generating && (
        <StatusPill
          trail={
            <span className="ai-inline-tps">{tokensPerSec!.toFixed(1)} t/s</span>
          }
        >
          <span className="ai-spinner" />
          <span>Generating…</span>
        </StatusPill>
      )}
      {stale && (() => {
        const looksStuck = idleSec >= 30;
        return (
          <StatusPill
            trail={
              looksStuck ? (
                <button
                  type="button"
                  className="ai-inline-stop"
                  onClick={onStop}
                  title="Cancel this turn"
                >
                  <Icon name="stop" size={11} />
                  <span>Stop</span>
                </button>
              ) : undefined
            }
          >
            <span
              className={`ai-inline-stale${looksStuck ? " ai-inline-stale-stuck" : ""}`}
            >
              {looksStuck
                ? `Unusually slow (${idleSec}s)`
                : `Still working (${idleSec}s)`}
            </span>
          </StatusPill>
        );
      })()}
    </>
  );
}
