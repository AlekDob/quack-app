import { useMemo } from "react";
import type { SessionUsage, AgentUsageSummary, DailyUsageSummary } from "../types";

interface UsagePanelProps {
  sessions: SessionUsage[];
  onClearUsage?: () => void;
}

/**
 * Usage Panel - Cost tracking for Claude Agent SDK
 * Based on https://docs.claude.com/en/api/agent-sdk/cost-tracking
 */
export default function UsagePanel({ sessions, onClearUsage }: UsagePanelProps) {
  // Calculate daily summaries from session data
  const dailySummaries = useMemo(() => {
    const summariesMap: Record<string, DailyUsageSummary> = {};

    sessions.forEach((session) => {
      const date = new Date(session.started_at).toISOString().split("T")[0];

      if (!summariesMap[date]) {
        summariesMap[date] = {
          date,
          total_cost_usd: 0,
          total_steps: 0,
          session_count: 0,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          agents: {},
        };
      }

      const daySummary = summariesMap[date];
      daySummary.total_cost_usd += session.total_cost_usd;
      daySummary.total_steps += session.step_count;
      daySummary.session_count += 1;
      daySummary.usage.input_tokens += session.usage.input_tokens;
      daySummary.usage.output_tokens += session.usage.output_tokens;
      daySummary.usage.cache_creation_input_tokens =
        (daySummary.usage.cache_creation_input_tokens || 0) + (session.usage.cache_creation_input_tokens || 0);
      daySummary.usage.cache_read_input_tokens =
        (daySummary.usage.cache_read_input_tokens || 0) + (session.usage.cache_read_input_tokens || 0);

      // Update agent summary within day
      if (!daySummary.agents[session.agent_name]) {
        daySummary.agents[session.agent_name] = {
          agent_name: session.agent_name,
          total_sessions: 0,
          total_cost_usd: 0,
          total_steps: 0,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          last_used: session.last_updated,
        };
      }

      const agentSummary = daySummary.agents[session.agent_name];
      agentSummary.total_sessions += 1;
      agentSummary.total_cost_usd += session.total_cost_usd;
      agentSummary.total_steps += session.step_count;
      agentSummary.usage.input_tokens += session.usage.input_tokens;
      agentSummary.usage.output_tokens += session.usage.output_tokens;
      agentSummary.usage.cache_creation_input_tokens =
        (agentSummary.usage.cache_creation_input_tokens || 0) + (session.usage.cache_creation_input_tokens || 0);
      agentSummary.usage.cache_read_input_tokens =
        (agentSummary.usage.cache_read_input_tokens || 0) + (session.usage.cache_read_input_tokens || 0);
      agentSummary.last_used = Math.max(agentSummary.last_used, session.last_updated);
    });

    // Sort by date descending
    return Object.values(summariesMap).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [sessions]);

  // Total usage across all time
  const totalUsage = useMemo(() => {
    return dailySummaries.reduce(
      (acc, day) => ({
        total_cost_usd: acc.total_cost_usd + day.total_cost_usd,
        total_steps: acc.total_steps + day.total_steps,
        session_count: acc.session_count + day.session_count,
        input_tokens: acc.input_tokens + day.usage.input_tokens,
        output_tokens: acc.output_tokens + day.usage.output_tokens,
        cache_creation_tokens: acc.cache_creation_tokens + (day.usage.cache_creation_input_tokens || 0),
        cache_read_tokens: acc.cache_read_tokens + (day.usage.cache_read_input_tokens || 0),
      }),
      {
        total_cost_usd: 0,
        total_steps: 0,
        session_count: 0,
        input_tokens: 0,
        output_tokens: 0,
        cache_creation_tokens: 0,
        cache_read_tokens: 0,
      }
    );
  }, [dailySummaries]);

  // Agent summaries across all time
  const agentSummaries = useMemo(() => {
    const agentsMap: Record<string, AgentUsageSummary> = {};

    sessions.forEach((session) => {
      if (!agentsMap[session.agent_name]) {
        agentsMap[session.agent_name] = {
          agent_name: session.agent_name,
          total_sessions: 0,
          total_cost_usd: 0,
          total_steps: 0,
          usage: {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
          last_used: session.last_updated,
        };
      }

      const agentSummary = agentsMap[session.agent_name];
      agentSummary.total_sessions += 1;
      agentSummary.total_cost_usd += session.total_cost_usd;
      agentSummary.total_steps += session.step_count;
      agentSummary.usage.input_tokens += session.usage.input_tokens;
      agentSummary.usage.output_tokens += session.usage.output_tokens;
      agentSummary.usage.cache_creation_input_tokens =
        (agentSummary.usage.cache_creation_input_tokens || 0) + (session.usage.cache_creation_input_tokens || 0);
      agentSummary.usage.cache_read_input_tokens =
        (agentSummary.usage.cache_read_input_tokens || 0) + (session.usage.cache_read_input_tokens || 0);
      agentSummary.last_used = Math.max(agentSummary.last_used, session.last_updated);
    });

    // Sort by cost descending
    return Object.values(agentsMap).sort((a, b) => b.total_cost_usd - a.total_cost_usd);
  }, [sessions]);

  const formatCost = (cost: number) => {
    if (cost === 0) return "$0.00";
    if (cost < 0.01) return `$${cost.toFixed(4)}`;
    return `$${cost.toFixed(2)}`;
  };

  const formatTokens = (tokens: number) => {
    if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(2)}M`;
    if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateString === today.toISOString().split("T")[0]) return "Today";
    if (dateString === yesterday.toISOString().split("T")[0]) return "Yesterday";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined
    });
  };

  return (
    <div className="usage-panel">
      <div className="usage-panel-header">
        <h2 className="usage-panel-title">Usage & Costs</h2>
        {onClearUsage && sessions.length > 0 && (
          <button
            type="button"
            className="usage-panel-clear-button"
            onClick={onClearUsage}
            title="Clear all usage data"
          >
            Clear
          </button>
        )}
      </div>

      {sessions.length === 0 ? (
        <div className="usage-panel-empty">
          <div className="usage-empty-icon">📊</div>
          <h3 className="usage-empty-title">No Usage Data</h3>
          <p className="usage-empty-description">
            Start using AI agents to see usage statistics and cost tracking here.
          </p>
        </div>
      ) : (
        <>
          {/* Total Summary Card */}
          <div className="usage-summary-card">
            <div className="usage-summary-header">
              <h3 className="usage-summary-title">Total Usage</h3>
              <div className="usage-summary-cost">{formatCost(totalUsage.total_cost_usd)}</div>
            </div>
            <div className="usage-summary-stats">
              <div className="usage-stat">
                <div className="usage-stat-label">Sessions</div>
                <div className="usage-stat-value">{totalUsage.session_count}</div>
              </div>
              <div className="usage-stat">
                <div className="usage-stat-label">Steps</div>
                <div className="usage-stat-value">{totalUsage.total_steps}</div>
              </div>
              <div className="usage-stat">
                <div className="usage-stat-label">Input Tokens</div>
                <div className="usage-stat-value">{formatTokens(totalUsage.input_tokens)}</div>
              </div>
              <div className="usage-stat">
                <div className="usage-stat-label">Output Tokens</div>
                <div className="usage-stat-value">{formatTokens(totalUsage.output_tokens)}</div>
              </div>
            </div>
            {(totalUsage.cache_read_tokens > 0 || totalUsage.cache_creation_tokens > 0) && (
              <div className="usage-summary-cache">
                <div className="usage-cache-label">Cache</div>
                <div className="usage-cache-stats">
                  {totalUsage.cache_creation_tokens > 0 && (
                    <span className="usage-cache-stat">
                      Created: {formatTokens(totalUsage.cache_creation_tokens)}
                    </span>
                  )}
                  {totalUsage.cache_read_tokens > 0 && (
                    <span className="usage-cache-stat">
                      Read: {formatTokens(totalUsage.cache_read_tokens)}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Agents Summary */}
          {agentSummaries.length > 0 && (
            <div className="usage-section">
              <h3 className="usage-section-title">By Agent</h3>
              <div className="usage-agents-list">
                {agentSummaries.map((agent) => (
                  <div key={agent.agent_name} className="usage-agent-card">
                    <div className="usage-agent-header">
                      <div className="usage-agent-name">{agent.agent_name}</div>
                      <div className="usage-agent-cost">{formatCost(agent.total_cost_usd)}</div>
                    </div>
                    <div className="usage-agent-stats">
                      <span className="usage-agent-stat">
                        {agent.total_sessions} {agent.total_sessions === 1 ? "session" : "sessions"}
                      </span>
                      <span className="usage-agent-stat-separator">•</span>
                      <span className="usage-agent-stat">
                        {agent.total_steps} {agent.total_steps === 1 ? "step" : "steps"}
                      </span>
                      <span className="usage-agent-stat-separator">•</span>
                      <span className="usage-agent-stat">
                        {formatTokens(agent.usage.input_tokens + agent.usage.output_tokens)} tokens
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Daily Breakdown */}
          {dailySummaries.length > 0 && (
            <div className="usage-section">
              <h3 className="usage-section-title">Daily Breakdown</h3>
              <div className="usage-daily-list">
                {dailySummaries.map((day) => (
                  <details key={day.date} className="usage-day-details" open={day.date === new Date().toISOString().split("T")[0]}>
                    <summary className="usage-day-summary">
                      <div className="usage-day-header">
                        <div className="usage-day-date">{formatDate(day.date)}</div>
                        <div className="usage-day-cost">{formatCost(day.total_cost_usd)}</div>
                      </div>
                      <div className="usage-day-stats">
                        <span className="usage-day-stat">
                          {day.session_count} {day.session_count === 1 ? "session" : "sessions"}
                        </span>
                        <span className="usage-day-stat-separator">•</span>
                        <span className="usage-day-stat">
                          {day.total_steps} {day.total_steps === 1 ? "step" : "steps"}
                        </span>
                      </div>
                    </summary>
                    <div className="usage-day-content">
                      {Object.values(day.agents).map((agent) => (
                        <div key={agent.agent_name} className="usage-day-agent">
                          <div className="usage-day-agent-name">{agent.agent_name}</div>
                          <div className="usage-day-agent-details">
                            <span className="usage-day-agent-cost">{formatCost(agent.total_cost_usd)}</span>
                            <span className="usage-day-agent-stats">
                              {agent.total_sessions} {agent.total_sessions === 1 ? "session" : "sessions"} •
                              {formatTokens(agent.usage.input_tokens + agent.usage.output_tokens)} tokens
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
