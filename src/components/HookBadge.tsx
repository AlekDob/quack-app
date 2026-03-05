import type { HookExecutionEvent, HookType } from '../types';
import './HookBadge.css';

/**
 * HookBadge - Inline badge showing hook execution in chat
 * Shows when a hook has been triggered with success/error state
 */

interface HookBadgeProps {
  event: HookExecutionEvent;
  compact?: boolean;
}

// Hook type colors matching HooksPanel
const HOOK_TYPE_COLORS: Record<HookType, string> = {
  'PreToolUse': '#f59e0b',    // amber
  'PostToolUse': '#10b981',   // green
  'Notification': '#3b82f6',  // blue
  'Stop': '#ef4444',          // red
  'SubagentStop': '#8b5cf6',  // purple
};

export function HookBadge({ event, compact = false }: HookBadgeProps) {
  const typeColor = HOOK_TYPE_COLORS[event.hookType] || '#888';
  const statusColor = event.success ? '#10b981' : '#ef4444';
  const statusIcon = event.success ? '✓' : '✗';

  if (compact) {
    return (
      <span
        className="hook-badge-compact"
        style={{
          '--type-color': typeColor,
          '--status-color': statusColor,
        } as React.CSSProperties}
        title={`${event.hookName} (${event.hookType}) - ${event.success ? 'Success' : 'Failed'}`}
      >
        <span className="hook-badge-icon">🪝</span>
        <span className="hook-badge-status">{statusIcon}</span>
      </span>
    );
  }

  return (
    <div
      className="hook-badge"
      style={{
        '--type-color': typeColor,
        '--status-color': statusColor,
      } as React.CSSProperties}
    >
      <span className="hook-badge-icon">🪝</span>
      <span className="hook-badge-name">{event.hookName}</span>
      <span className="hook-badge-type">{event.hookType}</span>
      {event.toolName && (
        <>
          <span className="hook-badge-arrow">→</span>
          <code className="hook-badge-tool">{event.toolName}</code>
        </>
      )}
      <span className="hook-badge-status-indicator" data-success={event.success}>
        {statusIcon}
      </span>
      {event.error && (
        <span className="hook-badge-error" title={event.error}>
          {event.error.substring(0, 30)}...
        </span>
      )}
    </div>
  );
}

/**
 * HookExecutionList - Shows multiple hook executions in a collapsible list
 */
interface HookExecutionListProps {
  events: HookExecutionEvent[];
  defaultExpanded?: boolean;
}

export function HookExecutionList({ events, defaultExpanded = false }: HookExecutionListProps) {
  if (events.length === 0) return null;

  const successCount = events.filter(e => e.success).length;
  const failCount = events.length - successCount;

  return (
    <details className="hook-execution-list" open={defaultExpanded}>
      <summary className="hook-execution-summary">
        <span className="hook-icon">🪝</span>
        <span className="hook-count">
          {events.length} hook{events.length !== 1 ? 's' : ''} executed
        </span>
        {successCount > 0 && (
          <span className="hook-success-count">{successCount} ✓</span>
        )}
        {failCount > 0 && (
          <span className="hook-fail-count">{failCount} ✗</span>
        )}
      </summary>
      <div className="hook-execution-details">
        {events.map((event, idx) => (
          <HookBadge key={`${event.hookId}-${idx}`} event={event} />
        ))}
      </div>
    </details>
  );
}

export default HookBadge;
