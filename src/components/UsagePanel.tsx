// Usage panel — live monitor of every Claude Code session on this machine.
// Polls the Rust `claude_usage_sessions` command every 12s (the backend
// caches results for 5s, so two polls in a row skip disk entirely) and
// renders a sortable list with cost, turns, last-activity and active/
// zombie state. Clicking a row exports the session JSONL to a markdown
// transcript in the OS cache dir and opens it as a normal editor tab.
//
// Brain: claude-usage-spike
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { formatResolvedModel } from "../modelDisplay";
import { useStore } from "../store";
import { ContextPanel } from "./ContextPanel";

interface UsageSession {
  session_id: string;
  project: string;
  project_label: string;
  primary_model: string;
  pricing_tier: string;
  turns: number;
  thinking_blocks: number;
  task_subagents: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  cache_creation_5m: number;
  cache_creation_1h: number;
  cache_hit_ratio: number;
  estimated_cost_usd: number;
  first_ts_ms: number;
  last_ts_ms: number;
  last_user_ts_ms: number;
  quack_spawned: boolean;
}

interface UsageReport {
  now_ms: number;
  sessions: UsageSession[];
  total_cost_usd: number;
  total_turns: number;
  active_count: number;
  zombie_count: number;
}

const POLL_MS = 12_000;
// Default filter on the backend: only count sessions touched in the
// last 6 hours. Anything older than that lives behind the "Show all"
// toggle. The 6h window keeps the initial payload under ~30 JSONL files
// even on machines with hundreds of historical sessions.
const DEFAULT_MIN_AGE_HOURS = 6;
// Infinite scroll: render this many rows up front, then reveal another
// page each time the sentinel scrolls into view. "Show all" can return
// hundreds of sessions, so we never mount them all at once.
const INITIAL_RENDER = 24;
const RENDER_PAGE = 24;

function fmtAge(ms: number, now: number): string {
  if (!ms) return "—";
  const d = now - ms;
  if (d < 0) return "now";
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function fmtCost(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return "<$0.01";
  if (n < 10) return `$${n.toFixed(2)}`;
  return `$${Math.round(n)}`;
}

function fmtTokens(n: number): string {
  if (n < 1000) return `${n}`;
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}k`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

type SortKey = "cost" | "turns" | "last_activity" | "cache_hit";

type UsageView = "sessions" | "context";

// The Usage tab is portal-mounted only while it's the active tab, so the
// component unmounts when the user opens another tab (e.g. clicking a skill
// opens its .md) and remounts on return — losing local state. Persist the
// chosen view per workspace at module level so returning keeps Context
// selected instead of snapping back to Sessions.
const viewByWs = new Map<string, UsageView>();

// Shell: a segmented control switching between the live session monitor
// and the context-cost analyzer. Each view mounts its own effects, so the
// 12s session poll never runs while the Context view is open.
export function UsagePanel({ wsId, root }: { wsId: string; root: string }) {
  const [view, setViewState] = useState<UsageView>(() => viewByWs.get(wsId) ?? "sessions");
  const setView = (v: UsageView) => {
    viewByWs.set(wsId, v);
    setViewState(v);
  };
  return (
    <div className="usage-root">
      <div className="usage-tabs" role="tablist">
        <button
          className={`usage-tab ${view === "sessions" ? "is-on" : ""}`}
          onClick={() => setView("sessions")}
        >
          Sessions
        </button>
        <button
          className={`usage-tab ${view === "context" ? "is-on" : ""}`}
          onClick={() => setView("context")}
        >
          Context
        </button>
      </div>
      {view === "sessions" ? (
        <SessionsView />
      ) : (
        <div className="usage-panel">
          <div className="usage-content">
            <ContextPanel wsId={wsId} root={root} />
          </div>
        </div>
      )}
    </div>
  );
}

function SessionsView() {
  const [report, setReport] = useState<UsageReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("last_activity");
  const [showAll, setShowAll] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);
  const [visible, setVisible] = useState(INITIAL_RENDER);
  const pollRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const activeId = useStore((s) => s.activeId);
  const sessionOpen = useStore((s) => s.sessionOpen);

  useEffect(() => {
    let cancelled = false;
    const fetchOnce = async () => {
      try {
        const r = await invoke<UsageReport>("claude_usage_sessions", {
          minAgeMin: showAll ? 0 : DEFAULT_MIN_AGE_HOURS * 60,
        });
        if (!cancelled) {
          setReport(r);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    void fetchOnce();
    pollRef.current = window.setInterval(fetchOnce, POLL_MS);
    return () => {
      cancelled = true;
      if (pollRef.current !== null) {
        window.clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [showAll]);

  // Click a row: open a new tab in the active editor pane backed by the
// lazy chunked loader. Re-clicking focuses the existing tab.
  const openSession = (s: UsageSession) => {
    if (!activeId) return;
    setOpening(s.session_id);
    try {
      sessionOpen(activeId, s.project, s.session_id);
    } finally {
      // The pane mounts synchronously and starts fetching — drop the
      // "opening" highlight immediately so the user sees the new tab
      // with its real header right away.
      window.setTimeout(() => setOpening(null), 50);
    }
  };

  const sessions = useMemo(() => {
    if (!report) return [] as UsageSession[];
    // Rust already filtered by minAgeMin; sort + tiny dedupe.
    const arr = report.sessions.slice();
    arr.sort((a, b) => {
      switch (sortKey) {
        case "cost":
          return b.estimated_cost_usd - a.estimated_cost_usd;
        case "turns":
          return b.turns - a.turns;
        case "cache_hit":
          return a.cache_hit_ratio - b.cache_hit_ratio;
        case "last_activity":
        default:
          return b.last_ts_ms - a.last_ts_ms;
      }
    });
    return arr;
  }, [report, sortKey]);

  // Reset the window when the dataset's shape changes (sort / show-all).
  // We deliberately DON'T reset on every 12s poll — that would snap the
  // list back to the top while the user is reading.
  useEffect(() => {
    setVisible(INITIAL_RENDER);
  }, [sortKey, showAll]);

  // Infinite scroll: reveal another page when the sentinel enters the
  // panel's viewport. Root is the scrolling panel so it works inside the
  // tab without depending on the document scroll.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = panelRef.current;
    if (!sentinel || !root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible((v) => v + RENDER_PAGE);
        }
      },
      { root, rootMargin: "240px" },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  }, [sessions.length, visible]);

  const shown = sessions.slice(0, visible);
  const hasMore = visible < sessions.length;

  if (error) {
    return (
      <div className="usage-panel">
        <div className="usage-error">Failed to load usage: {error}</div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="usage-panel">
        <div className="usage-loading">Scanning ~/.claude/projects/…</div>
      </div>
    );
  }

  return (
    <div className="usage-panel" ref={panelRef}>
      <div className="usage-content">
        <div className="usage-summary">
          <SummaryStat label="Total cost" highlight>
            {fmtCost(report.total_cost_usd)}
          </SummaryStat>
          <SummaryStat label="Active">
            {report.active_count}
            {report.zombie_count > 0 && (
              <span className="usage-zombie-badge">
                {report.zombie_count} zombie
              </span>
            )}
          </SummaryStat>
          <SummaryStat label="Turns">
            {report.total_turns.toLocaleString()}
          </SummaryStat>
          <SummaryStat label="Sessions">{report.sessions.length}</SummaryStat>
        </div>

        <div className="usage-controls">
          <div className="usage-sort">
            <label>Sort by</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="last_activity">Last activity</option>
              <option value="cost">Cost</option>
              <option value="turns">Turns</option>
              <option value="cache_hit">Worst cache hit</option>
            </select>
          </div>
          <button
            className={`usage-toggle ${showAll ? "is-on" : ""}`}
            onClick={() => setShowAll((v) => !v)}
            title="Show all sessions (including old/idle)"
          >
            {showAll ? `Last ${DEFAULT_MIN_AGE_HOURS}h only` : "Show all"}
          </button>
        </div>

        {sessions.length === 0 ? (
          <div className="usage-empty">
            {showAll
              ? "No Claude Code sessions found on this machine."
              : `No sessions in the last ${DEFAULT_MIN_AGE_HOURS}h. Click Show all to see older ones.`}
          </div>
        ) : (
          <>
            <ul className="usage-list">
              {shown.map((s) => (
                <SessionRow
                  key={s.session_id}
                  s={s}
                  now={report.now_ms}
                  opening={opening === s.session_id}
                  onOpen={() => void openSession(s)}
                />
              ))}
            </ul>
            {hasMore && (
              <div className="usage-sentinel" ref={sentinelRef} aria-hidden="true">
                <span className="usage-spinner" />
                Loading more…
              </div>
            )}
            <div className="usage-foot-count">
              {shown.length} of {sessions.length} sessions
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Summary metric card. Keeps the four-up grid DRY and the render short.
function SummaryStat(props: {
  label: string;
  highlight?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`usage-stat ${props.highlight ? "is-highlight" : ""}`}>
      <span className="usage-stat-label">{props.label}</span>
      <span className="usage-stat-value">{props.children}</span>
    </div>
  );
}

type RowState = "active" | "zombie" | "idle" | "fresh";

// Derive the live state from the timestamps the backend already gives us
// (no parallel source of truth — see CLAUDE.md agent-state model).
function rowStateOf(s: UsageSession, now: number): RowState {
  const ageMin = (now - s.last_ts_ms) / 60000;
  const userAgeMin =
    s.last_user_ts_ms > 0 ? (now - s.last_user_ts_ms) / 60000 : Infinity;
  const isActive = ageMin < 10;
  if (isActive && s.last_user_ts_ms > 0 && userAgeMin > 30) return "zombie";
  if (isActive) return "active";
  return s.last_user_ts_ms === 0 ? "fresh" : "idle";
}

// One session = one clickable card. Cost is the visual anchor (right,
// bold); a thin cache-hit bar gives at-a-glance efficiency.
function SessionRow(props: {
  s: UsageSession;
  now: number;
  opening: boolean;
  onOpen: () => void;
}) {
  const { s, now, opening, onOpen } = props;
  const state = rowStateOf(s, now);
  const cachePct = Math.round(s.cache_hit_ratio * 100);
  return (
    <li
      className={`usage-row state-${state} ${opening ? "opening" : ""}`}
      onClick={() => !opening && onOpen()}
      role="button"
      tabIndex={0}
      title="Open session transcript as a tab"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div className="usage-row-head">
        <span className={`usage-state-dot state-${state}`} aria-hidden="true" />
        <span className="usage-row-project" title={s.project}>
          {s.project_label || s.project || "—"}
        </span>
        {s.quack_spawned && (
          <span className="usage-source-tag" title="Spawned by Quack">
            Qk
          </span>
        )}
        <span className="usage-row-model" title={s.primary_model}>
          {formatResolvedModel(s.primary_model) ?? "—"}
        </span>
        <span className="usage-row-cost">{fmtCost(s.estimated_cost_usd)}</span>
      </div>
      <div className="usage-row-meta">
        <span className="usage-chip">{s.turns}t</span>
        <span className="usage-chip" title="Cache-read tokens">
          {fmtTokens(s.cache_read_tokens)} read
        </span>
        {s.thinking_blocks > 0 && (
          <span className="usage-chip" title="Thinking blocks">
            {s.thinking_blocks} think
          </span>
        )}
        {s.task_subagents > 0 && (
          <span className="usage-chip" title="Subagent spawns">
            {s.task_subagents} sub
          </span>
        )}
        <span className="usage-row-when" title="Last user message">
          {fmtAge(s.last_ts_ms, now)} ago
        </span>
      </div>
      <div className="usage-cache" title={`Cache hits ${cachePct}%`}>
        <div className="usage-cache-bar">
          <div
            className="usage-cache-fill"
            style={{ width: `${Math.max(2, cachePct)}%` }}
          />
        </div>
        <span className="usage-cache-label">{cachePct}% cache</span>
      </div>
    </li>
  );
}
