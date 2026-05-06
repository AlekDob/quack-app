/**
 * Agent Token Stats Panel — renders inside the Side Panel Accordion.
 *
 * Shows per-agent breakdown for the current project, with each agent
 * expandable to reveal per-model detail. Deleted agents ("agenti licenziati")
 * appear in a separate section while preserving totals.
 *
 * Brain: decision-project-token-stats-sqlite
 */

import { useEffect, useMemo, useState } from 'react';
import {
  useProjectStatsStore,
  totalOf,
  normalizeProjectPath,
  type AgentStats,
  type TokenBreakdown,
} from '../stores/projectStatsStore';
import './AgentTokenStatsPanel.css';

interface AgentTokenStatsPanelProps {
  projectPath: string | null;
  /**
   * Whether the panel is visible (accordion expanded). When false the
   * component skips the SQLite refresh on projectPath change to avoid
   * paying the query cost while the user can't see the result.
   * Brain: fix-token-stats-panel-blocks-project-switch
   */
  enabled?: boolean;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatCompact(n: number): string {
  if (n === 0) return '0';
  if (Math.abs(n) < 1_000) return n.toLocaleString();
  if (Math.abs(n) < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  if (Math.abs(n) < 1_000_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  return `${(n / 1_000_000_000).toFixed(2)}B`;
}

function formatFull(n: number): string {
  return n.toLocaleString();
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function TokenCells({ b }: { b: TokenBreakdown }) {
  return (
    <div className="agent-stats-cells">
      <span title={formatFull(b.inputTokens)}>
        <em>in</em> {formatCompact(b.inputTokens)}
      </span>
      <span title={formatFull(b.outputTokens)}>
        <em>out</em> {formatCompact(b.outputTokens)}
      </span>
      <span title={formatFull(b.cacheCreationTokens)}>
        <em>c.w</em> {formatCompact(b.cacheCreationTokens)}
      </span>
      <span title={formatFull(b.cacheReadTokens)}>
        <em>c.r</em> {formatCompact(b.cacheReadTokens)}
      </span>
    </div>
  );
}

function AgentRow({ agent }: { agent: AgentStats }) {
  const [expanded, setExpanded] = useState(false);
  const total = totalOf(agent.lifetime);
  const displayName = agent.agentName || 'Unknown agent';

  return (
    <div className={`agent-stats-row ${expanded ? 'agent-stats-row--expanded' : ''}`}>
      <button
        type="button"
        className="agent-stats-row-header"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
      >
        <svg
          className={`agent-stats-chevron ${expanded ? 'agent-stats-chevron--open' : ''}`}
          viewBox="0 0 20 20"
          width="10"
          height="10"
          aria-hidden
        >
          <path d="M7 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <div className="agent-stats-identity">
          <span className="agent-stats-name">{displayName}</span>
          {agent.agentRole && (
            <span className="agent-stats-role">{agent.agentRole}</span>
          )}
        </div>
        <span
          className="agent-stats-total"
          title={`Total: ${formatFull(total)}\nMessages: ${formatFull(agent.lifetime.messageCount)}`}
        >
          {formatCompact(total)}
        </span>
      </button>

      {expanded && (
        <div className="agent-stats-body">
          <div className="agent-stats-lifetime">
            <TokenCells b={agent.lifetime} />
            <span className="agent-stats-msg-count">
              {agent.lifetime.messageCount} msg
            </span>
          </div>

          <div className="agent-stats-models-title">By model</div>
          {agent.byModel.length === 0 ? (
            <div className="agent-stats-empty-inline">No model data.</div>
          ) : (
            <ul className="agent-stats-models-list">
              {agent.byModel.map((m) => (
                <li key={m.model} className="agent-stats-model-row">
                  <span className="agent-stats-model-name">{m.model}</span>
                  <TokenCells b={m} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function AgentTokenStatsPanel({ projectPath, enabled = true }: AgentTokenStatsPanelProps) {
  // Normalize once so lookup key matches what the store wrote from Rust.
  const normalizedPath = projectPath ? normalizeProjectPath(projectPath) : null;
  const agentStats = useProjectStatsStore((s) =>
    normalizedPath ? s.agentCache[normalizedPath] : undefined
  );
  const refreshProjectAgents = useProjectStatsStore((s) => s.refreshProjectAgents);
  const lastError = useProjectStatsStore((s) => s.lastError);
  const [loading, setLoading] = useState(false);

  // Brain: fix-token-stats-panel-blocks-project-switch
  // Gating on `enabled` so a closed accordion doesn't trigger
  // get_project_agent_stats (which contends with recordUsage on the
  // SQLite mutex and made cross-project switches slow).
  useEffect(() => {
    if (!normalizedPath || !enabled) return;
    setLoading(true);
    refreshProjectAgents(normalizedPath).finally(() => setLoading(false));
  }, [normalizedPath, refreshProjectAgents, enabled]);

  // Grand total = active + deleted
  const grandTotal = useMemo(() => {
    if (!agentStats) return 0;
    const sum = (arr: AgentStats[]) =>
      arr.reduce((acc, a) => acc + totalOf(a.lifetime), 0);
    return sum(agentStats.activeAgents) + sum(agentStats.deletedAgents);
  }, [agentStats]);

  if (!projectPath) {
    return <div className="agent-stats-empty">Select a project to view stats.</div>;
  }

  if (loading && !agentStats) {
    return <div className="agent-stats-empty">Loading…</div>;
  }

  if (lastError && !agentStats) {
    return <div className="agent-stats-empty agent-stats-error">Failed: {lastError}</div>;
  }

  if (!agentStats || (agentStats.activeAgents.length === 0 && agentStats.deletedAgents.length === 0)) {
    return (
      <div className="agent-stats-empty">
        No token activity yet.
        <br />
        <small>Stats accumulate as you chat with agents.</small>
      </div>
    );
  }

  return (
    <div className="agent-stats-panel">
      <div className="agent-stats-grand">
        <span className="agent-stats-grand-label">Project total</span>
        <span className="agent-stats-grand-value" title={formatFull(grandTotal)}>
          {formatCompact(grandTotal)}
        </span>
      </div>

      {agentStats.activeAgents.length > 0 && (
        <>
          <h4 className="agent-stats-section-title">Active agents</h4>
          <div className="agent-stats-list">
            {agentStats.activeAgents.map((a) => (
              <AgentRow
                key={(a.agentId ?? 'unknown') + '-active'}
                agent={a}
              />
            ))}
          </div>
        </>
      )}

      {agentStats.deletedAgents.length > 0 && (
        <>
          <h4 className="agent-stats-section-title agent-stats-section-title--deleted">
            Agenti licenziati
          </h4>
          <div className="agent-stats-list">
            {agentStats.deletedAgents.map((a) => (
              <AgentRow
                key={(a.agentId ?? 'unknown') + '-deleted'}
                agent={a}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
