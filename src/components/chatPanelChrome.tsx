// Smaller chrome components for the AI chat panel — toolbar entries,
// status chips, dropdowns. Pulled out of AIChatPanel.tsx because every
// one of them is presentational + prop-driven and adds nothing useful
// to the giant render function. Grouped together because they share
// the same kind of one-off scope.
//
// Components:
//   - TimelineScrubber: bottom-of-history slider for scrubbing past turns
//   - ClaudeSessionsButton: toolbar dropdown for Claude Code session resume
//   - TodosCard: collapsible TodoWrite progress card
//   - UsageChip: inline cost / tokens / cache / duration label
//   - HeaderMenu: ⋯ dropdown with history / refresh / settings entries
//
// Helpers:
//   - formatRelative(ms): "just now" / "5m ago" / "2h ago" / "3d ago"
//
// Anything stateful here uses local React state only — no closures over
// chat panel state. That's why the AIChatPanel render isn't any harder
// to read after extraction; these were already hermetic.

import { useEffect, useState } from "react";
import { claudeCode as claudeCodeIpc, type ClaudeSession } from "../ipc";
import { Icon } from "./Icon";

// ---------- TimelineScrubber ----------

interface TimelineScrubberProps {
  totalMessages: number;
  scrubIndex: number | null;
  onScrub: (i: number) => void;
  onReset: () => void;
  onBranch?: () => void;
}

export function TimelineScrubber({
  totalMessages,
  scrubIndex,
  onScrub,
  onReset,
  onBranch,
}: TimelineScrubberProps) {
  // Slider range is 0..totalMessages-1; full-conversation = max value,
  // shown as live (no scrub badge).
  const max = Math.max(0, totalMessages - 1);
  const value = scrubIndex ?? max;
  const isScrubbed = scrubIndex !== null && scrubIndex < max;
  return (
    <div className={`ai-scrubber ${isScrubbed ? "active" : ""}`}>
      <input
        type="range"
        min={0}
        max={max}
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value, 10);
          // Snapping the right edge clears scrub so the user falls
          // back to live view without a separate Reset click.
          if (v >= max) onReset();
          else onScrub(v);
        }}
        className="ai-scrubber-range"
        title="Scrub through past turns"
        aria-label={`Chat history scrubber: turn ${value + 1} of ${totalMessages}`}
        aria-valuetext={
          isScrubbed
            ? `Viewing turn ${value + 1} of ${totalMessages}`
            : "Live view, latest turn"
        }
      />
      <div className="ai-scrubber-info">
        {isScrubbed ? (
          <>
            <span className="ai-scrubber-pos">
              Turn {value + 1} / {totalMessages}
            </span>
            {onBranch && (
              <button
                className="ai-scrubber-btn"
                onClick={onBranch}
                title="Open a new chat tab with the conversation up to this point"
              >
                <Icon name="git-branch" size={11} />
                <span>Branch from here</span>
              </button>
            )}
            <button
              className="ai-scrubber-btn"
              onClick={onReset}
              title="Drop scrub, jump back to live view"
            >
              <Icon name="rotate-ccw" size={11} />
              <span>Live</span>
            </button>
          </>
        ) : (
          <span className="ai-scrubber-hint">
            ← drag to revisit any earlier turn
          </span>
        )}
      </div>
    </div>
  );
}

// ---------- ClaudeSessionsButton ----------

interface ClaudeSessionsButtonProps {
  cwd: string;
  onResume: (id: string) => void | Promise<void>;
}

export function ClaudeSessionsButton({
  cwd,
  onResume,
}: ClaudeSessionsButtonProps) {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<ClaudeSession[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await claudeCodeIpc.listSessions(cwd);
      setSessions(list);
    } catch (e) {
      setSessions([]);
      console.warn("listSessions failed", e);
    } finally {
      setLoading(false);
    }
  };

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".ai-cc-sessions-popover")) return;
      if (t?.closest(".ai-cc-sessions-btn")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="ai-cc-sessions-wrap">
      <button
        className={`ai-cc-sessions-btn ${open ? "active" : ""}`}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) void load();
            return next;
          });
        }}
        title="Resume an on-disk Claude Code session for this workspace"
      >
        ⟲ Sessions
      </button>
      {open && (
        <div className="ai-cc-sessions-popover">
          {loading && (
            <div className="ai-cc-sessions-empty">
              <span className="ai-spinner" /> Loading…
            </div>
          )}
          {!loading && sessions && sessions.length === 0 && (
            <div className="ai-cc-sessions-empty">
              No Claude Code sessions yet for this workspace.
              <br />
              <span className="ai-cc-sessions-hint">
                Sessions appear after your first chat with Claude Code.
              </span>
            </div>
          )}
          {!loading &&
            sessions &&
            sessions.map((s) => (
              <button
                key={s.id}
                className="ai-cc-session"
                onClick={() => {
                  void onResume(s.id);
                  setOpen(false);
                }}
                title={`${s.turn_count} turn${s.turn_count === 1 ? "" : "s"} · ${s.cost_usd > 0 ? `$${s.cost_usd.toFixed(4)} · ` : ""}${formatRelative(s.last_turn_at_ms)}`}
              >
                <div className="ai-cc-session-title">{s.title}</div>
                {s.preview && s.preview !== s.title && (
                  <div className="ai-cc-session-preview">{s.preview}</div>
                )}
                <div className="ai-cc-session-meta">
                  <span>
                    {s.turn_count} turn{s.turn_count === 1 ? "" : "s"}
                  </span>
                  {s.cost_usd > 0 && <span>${s.cost_usd.toFixed(4)}</span>}
                  <span>{formatRelative(s.last_turn_at_ms)}</span>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

function formatRelative(ms: number): string {
  if (!ms) return "";
  const diff = Date.now() - ms;
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.round(diff / 3_600_000)}h ago`;
  return `${Math.round(diff / 86_400_000)}d ago`;
}

// ---------- TodosCard ----------

interface TodosCardProps {
  items: Array<{
    content: string;
    status: "pending" | "in_progress" | "completed";
    activeForm?: string;
  }>;
}

export function TodosCard({ items }: TodosCardProps) {
  // Astronave-style: a compact chip that lives above the composer and expands
  // UPWARD into a panel on click (collapsed by default so the plan stays out
  // of the way until you want it).
  const [open, setOpen] = useState(false);
  const total = items.length;
  const done = items.filter((t) => t.status === "completed").length;
  const inProgress = items.find((t) => t.status === "in_progress");
  const summary = inProgress
    ? `${done}/${total} · ${inProgress.activeForm ?? inProgress.content}`
    : `Plan · ${done}/${total}`;
  return (
    <div className="ai-todos-wrap">
      {open && (
        <>
          <div className="ai-todos-backdrop" onClick={() => setOpen(false)} />
          <div className="ai-todos-pop" role="dialog">
            <ul className="ai-todos-list">
              {items.map((t, i) => (
                <li
                  key={i}
                  className={`ai-todo ai-todo-${t.status}`}
                  title={t.status}
                >
                  <span className="ai-todo-mark">
                    <Icon
                      name={
                        t.status === "completed"
                          ? "check"
                          : t.status === "in_progress"
                            ? "rotate-ccw"
                            : "circle"
                      }
                      size={11}
                    />
                  </span>
                  <span className="ai-todo-text">
                    {t.status === "in_progress" && t.activeForm
                      ? t.activeForm
                      : t.content}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
      <button
        type="button"
        className={`ai-todos-chip ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title={open ? "Hide plan" : "Show plan"}
      >
        <span className="ai-todos-icon">
          <Icon name="check-square" size={13} />
        </span>
        <span className="ai-todos-summary">{summary}</span>
        <Icon name="chevron-down" size={12} />
      </button>
    </div>
  );
}

// ---------- UsageChip ----------

interface UsageChipProps {
  usage: {
    cost?: number;
    durationMs?: number;
    model?: string;
    tokens?: {
      input: number;
      output: number;
      cacheRead: number;
      cacheCreate: number;
    };
  };
}

export function UsageChip({ usage }: UsageChipProps) {
  const t = usage.tokens;
  const fmtTokens = (n: number) =>
    n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
  const cacheTotal = (t?.cacheRead ?? 0) + (t?.cacheCreate ?? 0);
  const cachePct =
    cacheTotal > 0 && t
      ? Math.round(((t.cacheRead ?? 0) / cacheTotal) * 100)
      : null;
  const parts: string[] = [];
  if (typeof usage.cost === "number") {
    parts.push(`$${usage.cost.toFixed(4)}`);
  }
  if (t && (t.input || t.output)) {
    parts.push(`${fmtTokens(t.input)} in / ${fmtTokens(t.output)} out`);
  }
  if (cachePct !== null) {
    parts.push(`cache ${cachePct}%`);
  }
  if (typeof usage.durationMs === "number") {
    parts.push(`${(usage.durationMs / 1000).toFixed(1)}s`);
  }
  if (parts.length === 0) return null;
  return <span className="ai-usage-text">{parts.join(" · ")}</span>;
}

// ---------- HeaderMenu ----------

export function HeaderMenu({
  historyCount,
  onHistory,
  historyActive,
  onRefresh,
  onSettings,
  onBrowseModels,
}: {
  historyCount: number;
  onHistory: () => void;
  historyActive: boolean;
  onRefresh: () => void;
  onSettings: () => void;
  onBrowseModels: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (t?.closest(".ai-header-menu-popover")) return;
      if (t?.closest(".ai-header-menu-btn")) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);
  return (
    <div className="ai-header-menu-wrap">
      <button
        className={`ai-header-menu-btn ${open ? "active" : ""}`}
        onClick={() => setOpen((v) => !v)}
        title="More"
        aria-label="More chat actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Icon name="more-horizontal" size={14} />
      </button>
      {open && (
        <div className="ai-header-menu-popover" role="menu">
          <button
            className="ai-header-menu-item"
            onClick={() => {
              onHistory();
              setOpen(false);
            }}
          >
            <span className="ai-header-menu-row">
              <Icon
                name={historyActive ? "chevron-down" : "chevron-right"}
                size={11}
              />
              Chat history
            </span>
            {historyCount > 0 && (
              <span className="ai-header-menu-meta">{historyCount}</span>
            )}
          </button>
          <button
            className="ai-header-menu-item"
            onClick={() => {
              onBrowseModels();
              setOpen(false);
            }}
          >
            <span className="ai-header-menu-row">
              <Icon name="plus" size={11} />
              Browse models
            </span>
          </button>
          <div className="ai-header-menu-sep" />
          <button
            className="ai-header-menu-item"
            onClick={() => {
              onRefresh();
              setOpen(false);
            }}
          >
            <span className="ai-header-menu-row">
              <Icon name="refresh" size={11} />
              Refresh providers
            </span>
          </button>
          <button
            className="ai-header-menu-item"
            onClick={() => {
              onSettings();
              setOpen(false);
            }}
          >
            <span className="ai-header-menu-row">
              <Icon name="settings" size={11} />
              Settings
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
