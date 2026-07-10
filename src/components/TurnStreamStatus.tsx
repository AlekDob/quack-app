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

function StaleSuffix({
  idleSec,
  onStop,
}: {
  idleSec: number;
  onStop: () => void;
}) {
  const looksStuck = idleSec >= 30;
  const label = looksStuck
    ? `Unusually slow (${idleSec}s)`
    : `Still working (${idleSec}s)`;
  return (
    <span className="ai-stale-suffix">
      <span
        className={`ai-stale-shimmer${looksStuck ? " ai-stale-shimmer-stuck" : ""}`}
      >
        {label}
      </span>
      {looksStuck ? (
        <button
          type="button"
          className="ai-inline-stop"
          onClick={onStop}
          title="Cancel this turn"
        >
          <Icon name="stop" size={11} />
          <span>Stop</span>
        </button>
      ) : null}
    </span>
  );
}

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

  const staleSuffix = stale ? (
    <StaleSuffix idleSec={idleSec} onStop={onStop} />
  ) : null;
  const tpsTrail =
    streaming !== null && tokensPerSec !== null ? (
      <span className="ai-inline-tps">{tokensPerSec.toFixed(1)} t/s</span>
    ) : undefined;

  return (
    <>
      {planning && (
        <div className="ai-inline-status-row">
          <div className="ai-turn-hint">
            <span className="ai-spinner" />
            <span>{warmingUp ? "Loading model…" : "Planning next moves…"}</span>
          </div>
          {staleSuffix}
        </div>
      )}
      {runningTools &&
        (activeToolLabels.length === 0 ? (
          <StatusPill trail={tpsTrail} suffix={staleSuffix}>
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
                trail={tpsTrail}
                suffix={staleSuffix}
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
          suffix={staleSuffix}
        >
          <span className="ai-spinner" />
          <span>Generating…</span>
        </StatusPill>
      )}
      {stale && !planning && !runningTools && !generating && staleSuffix}
    </>
  );
}
