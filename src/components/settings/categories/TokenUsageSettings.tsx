/**
 * Token Usage Settings — global cross-project dashboard.
 *
 * Brain: decision-project-token-stats-sqlite
 *
 * Top-level: cross-project grand totals + sortable table of projects.
 * Clicking a project row drills into the same TokenStatsView used inside the
 * per-project dashboard tab, so visual consistency is guaranteed.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  useProjectStatsStore,
  totalOf,
  type ProjectSummary,
} from '../../../stores/projectStatsStore';
import TokenStatsView from '../../project-dashboard/TokenStatsView';
import '../../project-dashboard/TokenStatsView.css';
import './TokenUsageSettings.css';

type SortKey = 'total' | 'input' | 'output' | 'messages' | 'updated';

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

function sortSummaries(items: ProjectSummary[], key: SortKey): ProjectSummary[] {
  const sorted = [...items];
  switch (key) {
    case 'total':
      sorted.sort((a, b) => totalOf(b.lifetime) - totalOf(a.lifetime));
      break;
    case 'input':
      sorted.sort((a, b) => b.lifetime.inputTokens - a.lifetime.inputTokens);
      break;
    case 'output':
      sorted.sort((a, b) => b.lifetime.outputTokens - a.lifetime.outputTokens);
      break;
    case 'messages':
      sorted.sort((a, b) => b.lifetime.messageCount - a.lifetime.messageCount);
      break;
    case 'updated':
      sorted.sort((a, b) => b.lastUpdatedAt - a.lastUpdatedAt);
      break;
  }
  return sorted;
}

export default function TokenUsageSettings() {
  const summaries = useProjectStatsStore((s) => s.allSummaries);
  const refreshAll = useProjectStatsStore((s) => s.refreshAll);
  const lastError = useProjectStatsStore((s) => s.lastError);

  const [sortKey, setSortKey] = useState<SortKey>('total');
  const [drilldown, setDrilldown] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    refreshAll().finally(() => setLoading(false));
  }, [refreshAll]);

  const sorted = useMemo(() => sortSummaries(summaries, sortKey), [summaries, sortKey]);

  const grandTotal = useMemo(
    () => summaries.reduce((acc, s) => acc + totalOf(s.lifetime), 0),
    [summaries]
  );
  const grandInput = useMemo(
    () => summaries.reduce((acc, s) => acc + s.lifetime.inputTokens, 0),
    [summaries]
  );
  const grandOutput = useMemo(
    () => summaries.reduce((acc, s) => acc + s.lifetime.outputTokens, 0),
    [summaries]
  );
  const grandMessages = useMemo(
    () => summaries.reduce((acc, s) => acc + s.lifetime.messageCount, 0),
    [summaries]
  );

  // Drilldown view
  if (drilldown) {
    return (
      <div className="token-usage-settings">
        <button
          type="button"
          className="token-usage-back-button"
          onClick={() => setDrilldown(null)}
        >
          ← Back to all projects
        </button>
        <TokenStatsView projectPath={drilldown} />
      </div>
    );
  }

  return (
    <div className="token-usage-settings">
      <header className="token-usage-header">
        <div>
          <h2 className="token-usage-title">Token Usage</h2>
          <p className="token-usage-subtitle">
            Lifetime totals across all projects. Click a row for per-provider
            and per-model breakdown.
          </p>
        </div>
        <button
          type="button"
          className="token-usage-refresh"
          onClick={() => {
            setLoading(true);
            refreshAll().finally(() => setLoading(false));
          }}
          disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      {lastError && (
        <div className="token-usage-error">
          Failed to load: {lastError}
        </div>
      )}

      {/* Grand totals */}
      <section className="token-usage-grand-totals">
        <div className="token-usage-grand-stat token-usage-grand-stat--accent">
          <span className="token-usage-grand-label">Grand total</span>
          <span className="token-usage-grand-value" title={formatFull(grandTotal)}>
            {formatCompact(grandTotal)}
          </span>
        </div>
        <div className="token-usage-grand-stat">
          <span className="token-usage-grand-label">Input</span>
          <span className="token-usage-grand-value" title={formatFull(grandInput)}>
            {formatCompact(grandInput)}
          </span>
        </div>
        <div className="token-usage-grand-stat">
          <span className="token-usage-grand-label">Output</span>
          <span className="token-usage-grand-value" title={formatFull(grandOutput)}>
            {formatCompact(grandOutput)}
          </span>
        </div>
        <div className="token-usage-grand-stat">
          <span className="token-usage-grand-label">Messages</span>
          <span className="token-usage-grand-value">{formatFull(grandMessages)}</span>
        </div>
        <div className="token-usage-grand-stat">
          <span className="token-usage-grand-label">Projects</span>
          <span className="token-usage-grand-value">{summaries.length}</span>
        </div>
      </section>

      {/* Table */}
      {summaries.length === 0 ? (
        <div className="token-usage-empty">
          {loading ? 'Loading…' : 'No projects with recorded token usage yet.'}
        </div>
      ) : (
        <div className="token-usage-table-wrap">
          <table className="token-usage-table">
            <thead>
              <tr>
                <th>Project</th>
                <Th label="Total" k="total" sortKey={sortKey} onSort={setSortKey} />
                <Th label="Input" k="input" sortKey={sortKey} onSort={setSortKey} />
                <Th label="Output" k="output" sortKey={sortKey} onSort={setSortKey} />
                <Th label="Messages" k="messages" sortKey={sortKey} onSort={setSortKey} />
                <Th label="Last update" k="updated" sortKey={sortKey} onSort={setSortKey} />
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const total = totalOf(row.lifetime);
                return (
                  <tr
                    key={row.projectPath}
                    className="token-usage-row"
                    onClick={() => setDrilldown(row.projectPath)}
                    title="Open breakdown"
                  >
                    <td className="token-usage-project-cell">
                      <span className="token-usage-project-name">
                        {row.projectName || row.projectPath}
                      </span>
                      <span className="token-usage-project-path">{row.projectPath}</span>
                    </td>
                    <td className="token-usage-num" title={formatFull(total)}>
                      {formatCompact(total)}
                    </td>
                    <td className="token-usage-num" title={formatFull(row.lifetime.inputTokens)}>
                      {formatCompact(row.lifetime.inputTokens)}
                    </td>
                    <td className="token-usage-num" title={formatFull(row.lifetime.outputTokens)}>
                      {formatCompact(row.lifetime.outputTokens)}
                    </td>
                    <td className="token-usage-num">{formatFull(row.lifetime.messageCount)}</td>
                    <td className="token-usage-num token-usage-date">
                      {row.lastUpdatedAt ? new Date(row.lastUpdatedAt).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ThProps {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  onSort: (k: SortKey) => void;
}

function Th({ label, k, sortKey, onSort }: ThProps) {
  const active = sortKey === k;
  return (
    <th
      className={`token-usage-th-sortable ${active ? 'token-usage-th--active' : ''}`}
      onClick={() => onSort(k)}
    >
      {label}
      {active && <span className="token-usage-sort-caret"> ▾</span>}
    </th>
  );
}
