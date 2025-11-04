import { useState } from 'react';
import type { SessionInfo } from '../types';
import { useSessions } from '../hooks/useSessions';

interface SessionsPanelProps {
  onSelectSession: (session: SessionInfo) => void;
}

export function SessionsPanel({ onSelectSession }: SessionsPanelProps) {
  const { sessions, loading, error, loadSessions } = useSessions();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter sessions based on search
  const filteredSessions = sessions.filter(
    (session) =>
      session.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.model?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group sessions by time period
  const groupedSessions = groupSessionsByTime(filteredSessions);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Sessions</h3>
          <button
            onClick={loadSessions}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors duration-200"
            title="Refresh sessions"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sessions..."
            className="w-full px-3 py-2 pl-8 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500/50"
          />
          <svg
            className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-white/30">Loading sessions...</div>
          </div>
        ) : error ? (
          <div className="px-3 py-6 text-center">
            <p className="text-xs text-red-400">{error}</p>
            <button
              onClick={loadSessions}
              className="mt-3 px-3 py-1.5 text-xs font-medium rounded-lg bg-white/5 hover:bg-white/10 text-white/70 transition-colors duration-200"
            >
              Retry
            </button>
          </div>
        ) : filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <svg
              className="w-12 h-12 text-white/20 mb-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-sm text-white/40">No sessions found</p>
            <p className="text-xs text-white/30 mt-1">
              {searchQuery ? 'Try a different search' : 'Start chatting to create sessions'}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(groupedSessions).map(([period, periodSessions]) => (
              <div key={period}>
                {/* Period Header */}
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                    <span className="text-[11px] font-medium text-white/40 uppercase tracking-wider">
                      {period}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[10px] text-white/30">{periodSessions.length}</span>
                </div>

                {/* Sessions List */}
                <div className="space-y-2">
                  {periodSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onClick={() => onSelectSession(session)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionCardProps {
  session: SessionInfo;
  onClick: () => void;
}

function SessionCard({ session, onClick }: SessionCardProps) {
  const statusColors = {
    active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  const statusColor = statusColors[session.status] || statusColors.completed;

  return (
    <button
      onClick={onClick}
      className="w-full p-3 rounded-lg bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 transition-all duration-200 text-left group"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-medium text-white/90 line-clamp-2 flex-1 group-hover:text-white transition-colors">
          {session.title}
        </h4>
        <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded border uppercase ${statusColor}`}>
          {session.status}
        </span>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-3 text-[11px] text-white/40">
        {/* Model */}
        {session.model && (
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 3.5a1.5 1.5 0 013 0V4a1 1 0 001 1h3a1 1 0 011 1v3a1 1 0 01-1 1h-.5a1.5 1.5 0 000 3h.5a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-.5a1.5 1.5 0 00-3 0v.5a1 1 0 01-1 1H6a1 1 0 01-1-1v-3a1 1 0 00-1-1h-.5a1.5 1.5 0 010-3H4a1 1 0 001-1V6a1 1 0 011-1h3a1 1 0 001-1v-.5z" />
            </svg>
            <span className="capitalize">{session.model}</span>
          </div>
        )}

        {/* Message count */}
        <div className="flex items-center gap-1">
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
            />
          </svg>
          <span>{session.messageCount}</span>
        </div>

        {/* Tokens */}
        {session.totalTokens != null && session.totalTokens > 0 && (
          <div className="flex items-center gap-1">
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <span>{formatTokens(session.totalTokens)}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
        <span className="text-[10px] text-white/30">
          {formatTimeAgo(session.updatedAt)}
        </span>
        {(session.totalCost ?? 0) > 0 && (
          <span className="text-[10px] font-medium text-white/50">
            ${session.totalCost.toFixed(4)}
          </span>
        )}
      </div>
    </button>
  );
}

// Helper: Group sessions by time period
function groupSessionsByTime(sessions: SessionInfo[]): Record<string, SessionInfo[]> {
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  const groups: Record<string, SessionInfo[]> = {
    Today: [],
    Yesterday: [],
    'This Week': [],
    'This Month': [],
    Older: [],
  };

  for (const session of sessions) {
    const diff = now - session.updatedAt;

    if (diff < oneDay) {
      groups.Today.push(session);
    } else if (diff < 2 * oneDay) {
      groups.Yesterday.push(session);
    } else if (diff < oneWeek) {
      groups['This Week'].push(session);
    } else if (diff < oneMonth) {
      groups['This Month'].push(session);
    } else {
      groups.Older.push(session);
    }
  }

  // Remove empty groups
  return Object.fromEntries(Object.entries(groups).filter(([, sessions]) => sessions.length > 0));
}

// Helper: Format token count
function formatTokens(tokens: number): string {
  if (tokens >= 1000000) {
    return `${(tokens / 1000000).toFixed(1)}M`;
  }
  if (tokens >= 1000) {
    return `${(tokens / 1000).toFixed(1)}K`;
  }
  return tokens.toString();
}

// Helper: Format time ago
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes}m ago`;
  }
  if (hours < 24) {
    return `${hours}h ago`;
  }
  if (days < 7) {
    return `${days}d ago`;
  }
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks}w ago`;
  }
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}
