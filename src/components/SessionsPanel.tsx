import { useState, useMemo } from 'react';
import type { SessionInfo } from '../types';
import { useSessions } from '../hooks/useSessions';

interface SessionsPanelProps {
  onSelectSession: (session: SessionInfo) => void;
}

const SESSIONS_PER_PAGE = 50;

export function SessionsPanel({ onSelectSession }: SessionsPanelProps) {
  const { sessions, loading, error, loadSessions } = useSessions();
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(SESSIONS_PER_PAGE);

  // Filter sessions based on search
  const filteredSessions = useMemo(() => {
    return sessions.filter((session) => {
      // Check if session has at least ONE valid piece of data
      const hasValidTitle = session.title && session.title !== 'Untitled Session';
      const hasValidProject = session.workingDirectory && session.workingDirectory !== 'unknown';
      const hasValidDate = (session.updatedAt && session.updatedAt !== 0 && !isNaN(session.updatedAt)) ||
                          (session.createdAt && session.createdAt !== 0 && !isNaN(session.createdAt));

      // Only show sessions with at least 1 out of 3 valid criteria
      // This allows sessions with valid dates to show even if title/project are unknown
      const validCount = [hasValidTitle, hasValidProject, hasValidDate].filter(Boolean).length;
      if (validCount < 1) {
        return false;
      }

      // Apply search filter
      const query = searchQuery.toLowerCase();
      if (!query) return true;

      return (
        session.title.toLowerCase().includes(query) ||
        session.id.toLowerCase().includes(query) ||
        session.model?.toLowerCase().includes(query) ||
        session.workingDirectory?.toLowerCase().includes(query)
      );
    });
  }, [sessions, searchQuery]);

  // Group sessions by project (working directory) first, then by time
  const groupedSessions = useMemo(() => {
    return groupSessionsByProject(filteredSessions.slice(0, visibleCount));
  }, [filteredSessions, visibleCount]);

  const hasMore = visibleCount < filteredSessions.length;

  const loadMore = () => {
    setVisibleCount(prev => Math.min(prev + SESSIONS_PER_PAGE, filteredSessions.length));
  };

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
          <>
            <div className="space-y-6">
              {Object.entries(groupedSessions).map(([projectKey, projectData]) => (
                <div key={projectKey}>
                  {/* Project Header - hide if Unknown Project */}
                  {projectData.name !== 'Unknown Project' && (
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-white/10">
                      <svg className="w-4 h-4 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                      </svg>
                      <span className="text-xs font-semibold text-white/70 truncate">
                        {projectData.name}
                      </span>
                      <span className="text-[10px] text-white/30 ml-auto">
                        {projectData.sessions.length} sessions
                      </span>
                    </div>
                  )}

                  {/* Time periods within project */}
                  {Object.entries(projectData.byTime).map(([period, periodSessions]) => (
                    <div key={period} className="mb-4">
                      {/* Hide period header if it's "Unknown" or other invalid values */}
                      {period !== 'Unknown' && period.toLowerCase() !== 'unknown' && (
                        <div className="flex items-center gap-2 mb-2 ml-4">
                          <div className="w-1 h-1 rounded-full bg-white/20" />
                          <span className="text-[10px] font-medium text-white/30 uppercase tracking-wider">
                            {period}
                          </span>
                          <div className="flex-1 h-px bg-white/5" />
                          <span className="text-[9px] text-white/25">{periodSessions.length}</span>
                        </div>
                      )}
                      <div className="space-y-2 ml-4">
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
              ))}
            </div>

            {/* Load More Button */}
            {hasMore && (
              <div className="mt-4 pb-4 px-4">
                <button
                  onClick={loadMore}
                  className="w-full py-2 px-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-sm text-white/70 hover:text-white transition-all duration-200"
                >
                  Load More ({filteredSessions.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </>
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
        <div className="flex-1">
          <h4 className="text-sm font-medium text-white/90 line-clamp-2 group-hover:text-white transition-colors">
            {session.title}
          </h4>
          <p className="text-[10px] text-white/30 mt-1 font-mono">
            {session.id}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {session.backend === 'codex' && (
            <span className="px-1.5 py-0.5 text-[9px] font-medium rounded border uppercase border-emerald-500/40 text-emerald-300/90">
              Codex
            </span>
          )}
          <span className={`px-1.5 py-0.5 text-[9px] font-medium rounded border uppercase ${statusColor}`}>
            {session.status}
          </span>
        </div>
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
        {/* Date - hide if Unknown date */}
        {(() => {
          const dateStr = formatTimeAgo(session.updatedAt);
          return dateStr !== 'Unknown date' && (
            <span className="text-[10px] text-white/30">
              {dateStr}
            </span>
          );
        })()}
        {(session.totalCost ?? 0) > 0 && (
          <span className="text-[10px] font-medium text-white/50">
            ${session.totalCost.toFixed(4)}
          </span>
        )}
      </div>
    </button>
  );
}

// Helper: Extract project name from working directory
function getProjectName(workingDir: string | undefined | null): string {
  if (!workingDir) return 'Unknown Project';

  // Extract last part of path as project name
  const parts = workingDir.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'Unknown Project';
}

// Helper: Group sessions by project, then by time
function groupSessionsByProject(sessions: SessionInfo[]): Record<string, {
  name: string;
  path: string;
  sessions: SessionInfo[];
  byTime: Record<string, SessionInfo[]>;
}> {
  const projectGroups: Record<string, {
    name: string;
    path: string;
    sessions: SessionInfo[];
    byTime: Record<string, SessionInfo[]>;
  }> = {};

  // Group by project first
  for (const session of sessions) {
    const projectPath = session.workingDirectory || 'unknown';
    const projectName = getProjectName(session.workingDirectory);

    if (!projectGroups[projectPath]) {
      projectGroups[projectPath] = {
        name: projectName,
        path: projectPath,
        sessions: [],
        byTime: {},
      };
    }

    projectGroups[projectPath].sessions.push(session);
  }

  // Now group each project's sessions by time
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const oneWeek = 7 * oneDay;
  const oneMonth = 30 * oneDay;

  for (const project of Object.values(projectGroups)) {
    const timeGroups: Record<string, SessionInfo[]> = {
      Today: [],
      Yesterday: [],
      'This Week': [],
      'This Month': [],
      Older: [],
    };

    for (const session of project.sessions) {
      // Fix: Ensure timestamp is valid
      const timestamp = session.updatedAt || session.createdAt || 0;
      if (timestamp === 0) {
        timeGroups.Older.push(session);
        continue;
      }

      const diff = now - timestamp;

      if (diff < 0) {
        // Future timestamp, treat as today
        timeGroups.Today.push(session);
      } else if (diff < oneDay) {
        timeGroups.Today.push(session);
      } else if (diff < 2 * oneDay) {
        timeGroups.Yesterday.push(session);
      } else if (diff < oneWeek) {
        timeGroups['This Week'].push(session);
      } else if (diff < oneMonth) {
        timeGroups['This Month'].push(session);
      } else {
        timeGroups.Older.push(session);
      }
    }

    // Remove empty time groups
    project.byTime = Object.fromEntries(
      Object.entries(timeGroups).filter(([, sessions]) => sessions.length > 0)
    );
  }

  return projectGroups;
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
function formatTimeAgo(timestamp: number | undefined | null): string {
  // Fix: Handle invalid timestamps
  if (!timestamp || timestamp === 0 || isNaN(timestamp)) {
    return 'Unknown date';
  }

  const now = Date.now();
  const diff = now - timestamp;

  // Future timestamp
  if (diff < 0) {
    return 'just now';
  }

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
  if (months < 12) {
    return `${months}mo ago`;
  }
  const years = Math.floor(months / 12);
  return `${years}y ago`;
}
