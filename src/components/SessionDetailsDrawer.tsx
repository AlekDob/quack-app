import { useEffect, useState } from 'react';
import type { SessionInfo, SessionDetails } from '../types';
import { useSessions } from '../hooks/useSessions';

interface SessionDetailsDrawerProps {
  session: SessionInfo | null;
  open: boolean;
  onClose: () => void;
  onResume: (sessionId: string) => void;
  onDelete: (sessionId: string) => Promise<void>;
}

export function SessionDetailsDrawer({
  session,
  open,
  onClose,
  onResume,
  onDelete,
}: SessionDetailsDrawerProps) {
  const { loadSessionDetails } = useSessions();
  const [details, setDetails] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (open && session) {
      setLoading(true);
      loadSessionDetails(session.id)
        .then((d) => setDetails(d))
        .catch((err) => console.error('Failed to load session details:', err))
        .finally(() => setLoading(false));
    } else {
      setDetails(null);
    }
  }, [open, session, loadSessionDetails]);

  useEffect(() => {
    if (!open) return;

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose]);

  if (!open || !session) return null;

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete session "${session.title}"?`)) {
      return;
    }

    setDeleting(true);
    try {
      await onDelete(session.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete session:', err);
      alert('Failed to delete session. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 w-[600px] bg-[#1a1a1a] border-l border-white/10 z-50 flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-6 py-4 border-b border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-white mb-1 truncate">
                {session.title}
              </h2>
              <div className="flex flex-col gap-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-white/50">ID:</span>
                  <code className="text-white/70 font-mono bg-white/5 px-2 py-0.5 rounded break-all select-all">
                    {session.id}
                  </code>
                </div>
                {session.model && (
                  <span className="text-white/50 capitalize">{session.model}</span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-sm text-white/30">Loading session details...</div>
            </div>
          ) : !details ? (
            <div className="text-center py-12">
              <p className="text-sm text-red-400">Failed to load session details</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid grid-cols-3 gap-4">
                <StatCard
                  label="Messages"
                  value={(details.messageCount ?? 0).toString()}
                  icon={
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                  }
                />
                <StatCard
                  label="Total Tokens"
                  value={formatNumber(details.totalTokens ?? 0)}
                  icon={
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                  }
                />
                <StatCard
                  label="Total Cost"
                  value={`$${(details.totalCost ?? 0).toFixed(4)}`}
                  icon={
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  }
                />
              </div>

              {/* Token Usage Breakdown */}
              {details.usage && (
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <h3 className="text-sm font-semibold text-white mb-3">Token Usage</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-white/50">Input</span>
                      <span className="font-mono text-white">
                        {formatNumber(details.usage.input_tokens ?? 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/50">Output</span>
                      <span className="font-mono text-white">
                        {formatNumber(details.usage.output_tokens ?? 0)}
                      </span>
                    </div>
                    {(details.usage.cache_creation_input_tokens ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Cache Creation</span>
                        <span className="font-mono text-white">
                          {formatNumber(details.usage.cache_creation_input_tokens ?? 0)}
                        </span>
                      </div>
                    )}
                    {(details.usage.cache_read_input_tokens ?? 0) > 0 && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Cache Read</span>
                        <span className="font-mono text-white">
                          {formatNumber(details.usage.cache_read_input_tokens ?? 0)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Working Directory */}
              {details.workingDirectory && (
                <div className="p-4 rounded-lg bg-white/5 border border-white/10">
                  <h3 className="text-sm font-semibold text-white mb-2">Working Directory</h3>
                  <code className="text-xs text-white/70 font-mono break-all">
                    {details.workingDirectory}
                  </code>
                </div>
              )}

              {/* Messages */}
              <div>
                <h3 className="text-sm font-semibold text-white mb-3">Conversation</h3>
                {!details.messages || details.messages.length === 0 ? (
                  <div className="text-center py-6">
                    <p className="text-sm text-white/30">No messages found in this session</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {details.messages.map((msg, idx) => (
                      <div
                        key={idx}
                        className={`p-3 rounded-lg ${
                          msg.role === 'user'
                            ? 'bg-blue-500/10 border border-blue-500/20'
                            : 'bg-white/5 border border-white/10'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`text-xs font-medium uppercase ${
                              msg.role === 'user' ? 'text-blue-400' : 'text-white/70'
                            }`}
                          >
                            {msg.role}
                          </span>
                        </div>
                        <p className="text-sm text-white/80 whitespace-pre-wrap break-words">
                          {msg.content && msg.content.length > 500
                            ? `${msg.content.substring(0, 500)}...`
                            : msg.content ?? '(empty message)'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-6 py-4 border-t border-white/10">
          <div className="flex gap-3">
            <button
              onClick={() => onResume(session.id)}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-lg bg-blue-500 hover:bg-blue-600 disabled:bg-blue-500/50 disabled:cursor-not-allowed text-white font-medium transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Resume Session
            </button>
            <button
              onClick={handleDelete}
              disabled={loading || deleting}
              className="px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 disabled:bg-red-500/10 disabled:cursor-not-allowed text-red-400 font-medium transition-colors duration-200 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

function StatCard({ label, value, icon }: StatCardProps) {
  return (
    <div className="p-4 rounded-lg bg-white/5 border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-4 h-4 text-white/40">{icon}</div>
        <span className="text-xs text-white/50">{label}</span>
      </div>
      <p className="text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function formatNumber(num: number): string {
  return num.toLocaleString();
}
