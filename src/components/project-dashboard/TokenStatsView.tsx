/**
 * Token Stats View — per-project breakdown of accumulated token usage.
 *
 * Brain: decision-project-token-stats-sqlite
 *
 * Renders:
 *   - Lifetime totals (hero section)
 *   - Active vs Deleted-sessions split
 *   - Per-provider bar (with 'legacy' bucket for historical pre-migration data)
 *   - Per-model table
 *
 * Data source: projectStatsStore (SQLite-backed, lazy fetched).
 */

import { useEffect } from 'react';
import {
  useProjectStatsStore,
  totalOf,
  normalizeProjectPath,
  type TokenBreakdown,
  type NamedBreakdown,
} from '../../stores/projectStatsStore';
import './TokenStatsView.css';

interface TokenStatsViewProps {
  projectPath: string;
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

function HeroStat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`token-stats-hero-stat ${accent ? 'token-stats-hero-stat--accent' : ''}`}>
      <div className="token-stats-hero-label">{label}</div>
      <div className="token-stats-hero-value" title={formatFull(value)}>
        {formatCompact(value)}
      </div>
    </div>
  );
}

function BreakdownRow({ label, breakdown }: { label: string; breakdown: TokenBreakdown }) {
  return (
    <div className="token-stats-breakdown-row">
      <span className="token-stats-breakdown-label">{label}</span>
      <div className="token-stats-breakdown-cells">
        <span title={formatFull(breakdown.inputTokens)}>
          <em>in</em> {formatCompact(breakdown.inputTokens)}
        </span>
        <span title={formatFull(breakdown.outputTokens)}>
          <em>out</em> {formatCompact(breakdown.outputTokens)}
        </span>
        <span title={formatFull(breakdown.cacheCreationTokens)}>
          <em>cache&nbsp;w</em> {formatCompact(breakdown.cacheCreationTokens)}
        </span>
        <span title={formatFull(breakdown.cacheReadTokens)}>
          <em>cache&nbsp;r</em> {formatCompact(breakdown.cacheReadTokens)}
        </span>
        <span className="token-stats-breakdown-count" title={`${breakdown.messageCount} messages`}>
          {breakdown.messageCount} msg
        </span>
      </div>
    </div>
  );
}

function GroupedTable({ title, items }: { title: string; items: NamedBreakdown[] }) {
  if (items.length === 0) {
    return (
      <section className="token-stats-section">
        <h3 className="token-stats-section-title">{title}</h3>
        <div className="token-stats-empty">No data yet.</div>
      </section>
    );
  }

  // Compute max total for the proportional bar
  const max = Math.max(...items.map((i) => totalOf(i)));

  return (
    <section className="token-stats-section">
      <h3 className="token-stats-section-title">{title}</h3>
      <div className="token-stats-grouped-list">
        {items.map((item) => {
          const total = totalOf(item);
          const pct = max > 0 ? (total / max) * 100 : 0;
          return (
            <div className="token-stats-grouped-item" key={item.name}>
              <div className="token-stats-grouped-header">
                <span className="token-stats-grouped-name">{item.name}</span>
                <span className="token-stats-grouped-total" title={formatFull(total)}>
                  {formatCompact(total)}
                </span>
              </div>
              <div className="token-stats-bar-track">
                <div
                  className="token-stats-bar-fill"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
              </div>
              <div className="token-stats-grouped-meta">
                <span>in {formatCompact(item.inputTokens)}</span>
                <span>out {formatCompact(item.outputTokens)}</span>
                <span>cache&nbsp;w {formatCompact(item.cacheCreationTokens)}</span>
                <span>cache&nbsp;r {formatCompact(item.cacheReadTokens)}</span>
                <span>{item.messageCount} msg</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function TokenStatsView({ projectPath }: TokenStatsViewProps) {
  const key = projectPath ? normalizeProjectPath(projectPath) : '';
  const stats = useProjectStatsStore((s) => s.projectCache[key]);
  const loading = useProjectStatsStore((s) => s.loading[key] ?? false);
  const refreshProject = useProjectStatsStore((s) => s.refreshProject);

  useEffect(() => {
    if (!projectPath) return;
    void refreshProject(projectPath);
  }, [projectPath, refreshProject]);

  if (!projectPath) {
    return <div className="token-stats-empty">No project selected.</div>;
  }

  if (loading && !stats) {
    return <div className="token-stats-empty">Loading token stats…</div>;
  }

  if (!stats || stats.lifetime.messageCount === 0) {
    return (
      <div className="token-stats-empty">
        No token activity recorded yet for this project.
        <br />
        <small>Stats accumulate as you chat with agents.</small>
      </div>
    );
  }

  const lifetimeTotal = totalOf(stats.lifetime);

  return (
    <div className="token-stats-root">
      {/* Hero */}
      <section className="token-stats-hero">
        <HeroStat label="Lifetime total" value={lifetimeTotal} accent />
        <HeroStat label="Input" value={stats.lifetime.inputTokens} />
        <HeroStat label="Output" value={stats.lifetime.outputTokens} />
        <HeroStat label="Cache write" value={stats.lifetime.cacheCreationTokens} />
        <HeroStat label="Cache read" value={stats.lifetime.cacheReadTokens} />
        <HeroStat label="Messages" value={stats.lifetime.messageCount} />
      </section>

      {/* Active vs Deleted */}
      <section className="token-stats-section">
        <h3 className="token-stats-section-title">Active vs deleted</h3>
        <div className="token-stats-breakdown-list">
          <BreakdownRow label="Active sessions" breakdown={stats.activeSessions} />
          <BreakdownRow label="Deleted sessions" breakdown={stats.deletedSessions} />
        </div>
      </section>

      <GroupedTable title="By provider" items={stats.byProvider} />
      <GroupedTable title="By model" items={stats.byModel} />

      <footer className="token-stats-footer">
        First seen: {new Date(stats.firstSeenAt).toLocaleString()}
        {' · '}
        Last updated: {new Date(stats.lastUpdatedAt).toLocaleString()}
      </footer>
    </div>
  );
}
