import './MaxPlanStatsModal.css';
import type { MaxPlanHistoryData, DailyUsage } from '../hooks/useMaxPlanHistory';
import { getPlanDisplayName } from '../hooks/useMaxPlanTracking';

interface MaxPlanStatsModalProps {
  history: MaxPlanHistoryData;
  onClose: () => void;
  onExport: () => void;
  onClear: () => void;
}

export default function MaxPlanStatsModal({
  history,
  onClose,
  onExport,
  onClear,
}: MaxPlanStatsModalProps) {
  const recentDays = history.dailyUsage.slice(0, 14).reverse(); // Last 14 days, chronological order
  const recentWeeks = history.weeklyUsage.slice(0, 8).reverse(); // Last 8 weeks, chronological order

  return (
    <div className="maxplan-stats-overlay" onClick={onClose}>
      <div className="maxplan-stats-modal fallout-style" onClick={(e) => e.stopPropagation()}>
        <div className="maxplan-stats-header fallout-header">
          <h3>📊 MAX PLAN ANALYTICS</h3>
          <button className="maxplan-stats-close" onClick={onClose}>✕</button>
        </div>

        <div className="maxplan-stats-content fallout-content">
          {/* Summary Stats */}
          <div className="maxplan-summary-grid">
            <div className="maxplan-summary-card">
              <div className="maxplan-summary-label">Total Messages</div>
              <div className="maxplan-summary-value">{history.totalMessages.toLocaleString()}</div>
            </div>
            <div className="maxplan-summary-card">
              <div className="maxplan-summary-label">Total Tokens</div>
              <div className="maxplan-summary-value">{formatTokens(history.totalTokens)}</div>
            </div>
            <div className="maxplan-summary-card">
              <div className="maxplan-summary-label">Avg Messages/Day</div>
              <div className="maxplan-summary-value">{Math.round(history.averageMessagesPerDay)}</div>
            </div>
            <div className="maxplan-summary-card">
              <div className="maxplan-summary-label">Avg Tokens/Day</div>
              <div className="maxplan-summary-value">{formatTokens(history.averageTokensPerDay)}</div>
            </div>
          </div>

          {/* Peak Usage */}
          {history.peakDay && (
            <div className="maxplan-peak-section">
              <div className="maxplan-section-title">🏆 PEAK USAGE</div>
              <div className="maxplan-peak-grid">
                <div className="maxplan-peak-card">
                  <div className="maxplan-peak-label">Peak Day</div>
                  <div className="maxplan-peak-value">
                    {formatDate(history.peakDay.date)} - {history.peakDay.messageCount} messages
                  </div>
                </div>
                {history.peakWeek && (
                  <div className="maxplan-peak-card">
                    <div className="maxplan-peak-label">Peak Week</div>
                    <div className="maxplan-peak-value">
                      {history.peakWeek.week} - {history.peakWeek.messageCount} messages
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Daily Chart */}
          {recentDays.length > 0 && (
            <div className="maxplan-chart-section">
              <div className="maxplan-section-title">📈 DAILY USAGE (LAST 14 DAYS)</div>
              <BarChart data={recentDays} type="daily" />
            </div>
          )}

          {/* Weekly Chart */}
          {recentWeeks.length > 0 && (
            <div className="maxplan-chart-section">
              <div className="maxplan-section-title">📊 WEEKLY USAGE (LAST 8 WEEKS)</div>
              <WeeklyBarChart data={recentWeeks} />
            </div>
          )}

          {/* No Data Message */}
          {history.dailyUsage.length === 0 && (
            <div className="maxplan-no-data">
              <span className="maxplan-no-data-icon">📊</span>
              <div className="maxplan-no-data-text">
                No usage data yet. Start using Claude to track your Max Plan consumption!
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="maxplan-actions">
            <button className="maxplan-action-btn primary" onClick={onExport}>
              📥 Export Data
            </button>
            <button className="maxplan-action-btn danger" onClick={onClear}>
              🗑️ Clear History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Bar Chart Component for Daily Usage
function BarChart({ data, type }: { data: DailyUsage[]; type: 'daily' }) {
  if (data.length === 0) return null;

  const maxMessages = Math.max(...data.map(d => d.messageCount));
  const chartHeight = 200;
  const barWidth = 100 / data.length;

  return (
    <div className="maxplan-chart">
      <svg width="100%" height={chartHeight} className="maxplan-chart-svg">
        {data.map((day, index) => {
          const barHeight = maxMessages > 0 ? (day.messageCount / maxMessages) * (chartHeight - 40) : 0;
          const x = `${index * barWidth}%`;
          const y = chartHeight - barHeight - 20;

          return (
            <g key={day.date}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={`${barWidth * 0.8}%`}
                height={barHeight}
                className="maxplan-chart-bar"
                data-tooltip={`${formatDate(day.date)}: ${day.messageCount} messages`}
              />
              {/* Value Label */}
              <text
                x={`${index * barWidth + barWidth / 2}%`}
                y={y - 5}
                className="maxplan-chart-value"
                textAnchor="middle"
              >
                {day.messageCount}
              </text>
              {/* Date Label */}
              <text
                x={`${index * barWidth + barWidth / 2}%`}
                y={chartHeight - 5}
                className="maxplan-chart-label"
                textAnchor="middle"
              >
                {formatShortDate(day.date)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Weekly Bar Chart Component
function WeeklyBarChart({ data }: { data: any[] }) {
  if (data.length === 0) return null;

  const maxMessages = Math.max(...data.map(w => w.messageCount));
  const chartHeight = 200;
  const barWidth = 100 / data.length;

  return (
    <div className="maxplan-chart">
      <svg width="100%" height={chartHeight} className="maxplan-chart-svg">
        {data.map((week, index) => {
          const barHeight = maxMessages > 0 ? (week.messageCount / maxMessages) * (chartHeight - 40) : 0;
          const x = `${index * barWidth}%`;
          const y = chartHeight - barHeight - 20;

          return (
            <g key={week.week}>
              {/* Bar */}
              <rect
                x={x}
                y={y}
                width={`${barWidth * 0.8}%`}
                height={barHeight}
                className="maxplan-chart-bar weekly"
                data-tooltip={`${week.week}: ${week.messageCount} messages`}
              />
              {/* Value Label */}
              <text
                x={`${index * barWidth + barWidth / 2}%`}
                y={y - 5}
                className="maxplan-chart-value"
                textAnchor="middle"
              >
                {week.messageCount}
              </text>
              {/* Week Label */}
              <text
                x={`${index * barWidth + barWidth / 2}%`}
                y={chartHeight - 5}
                className="maxplan-chart-label"
                textAnchor="middle"
              >
                {formatWeekLabel(week.week)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// Helper Functions
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatShortDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
}

function formatWeekLabel(weekStr: string): string {
  // Convert "2025-W03" to "W03"
  return weekStr.split('-')[1] || weekStr;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return tokens.toLocaleString();
}
