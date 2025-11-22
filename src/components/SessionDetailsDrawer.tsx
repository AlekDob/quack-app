import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { toast } from 'sonner';
import type { SessionDetails, SessionHistoryMessage } from '../types';
import { useSessions } from '../hooks/useSessions';
import MarkdownText from './MarkdownText';

interface SessionDetailsDrawerProps {
  isOpen: boolean;
  sessionId: string | null;
  currentActiveSessionId?: string;
  onClose: () => void;
  onResumeSession: (sessionId: string) => void;
  onExportSession?: (sessionId: string) => void;
  onDeleteSession?: (sessionId: string) => void;
}

export default function SessionDetailsDrawer({
  isOpen,
  sessionId,
  currentActiveSessionId,
  onClose,
  onResumeSession,
  onExportSession: _onExportSession,
  onDeleteSession,
}: SessionDetailsDrawerProps) {
  const [details, setDetails] = useState<SessionDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [metadataExpanded, setMetadataExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [visibleMessageCount, setVisibleMessageCount] = useState(5); // Start with 5 messages
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesTopRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const previousScrollHeight = useRef<number>(0);
  const { loadSessionDetails, deleteSession } = useSessions();

  // Load session details when drawer opens
  useEffect(() => {
    if (isOpen && sessionId) {
      loadDetails();
      setVisibleMessageCount(5); // Reset to 5 messages
    } else if (!isOpen) {
      // Reset state when drawer closes
      setDetails(null);
      setError(null);
      setShowDeleteConfirm(false);
      setAutoScroll(true);
      setVisibleMessageCount(5);
    }
  }, [isOpen, sessionId]);

  const loadDetails = async () => {
    if (!sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const sessionDetails = await loadSessionDetails(sessionId);
      if (sessionDetails) {
        setDetails(sessionDetails);
        // Auto-scroll to bottom when loaded
        setTimeout(() => scrollToBottom(), 100);
      } else {
        setError('Failed to load session details');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      setLoading(false);
    }
  };

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setAutoScroll(true);
  }, []);

  const handleScroll = useCallback(() => {
    if (!scrollContainerRef.current || !details) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setAutoScroll(isNearBottom);

    // Infinite scroll reverse: Load more messages when scrolling near the top
    const isNearTop = scrollTop < 100;
    const hasMoreMessages = visibleMessageCount < details.messages.length;

    if (isNearTop && hasMoreMessages && !isLoadingMore) {
      setIsLoadingMore(true);

      // Save current scroll position
      previousScrollHeight.current = scrollHeight;

      // Load 5 more messages
      setTimeout(() => {
        setVisibleMessageCount(prev => Math.min(prev + 5, details.messages.length));
        setIsLoadingMore(false);

        // Restore scroll position after new messages are rendered
        setTimeout(() => {
          if (scrollContainerRef.current) {
            const newScrollHeight = scrollContainerRef.current.scrollHeight;
            const scrollDiff = newScrollHeight - previousScrollHeight.current;
            scrollContainerRef.current.scrollTop = scrollTop + scrollDiff;
          }
        }, 50);
      }, 300);
    }
  }, [details, visibleMessageCount, isLoadingMore]);

  const handleResume = () => {
    if (sessionId) {
      onResumeSession(sessionId);
      onClose();
    }
  };

  const handleDelete = async () => {
    if (!sessionId) return;

    const result = await deleteSession(sessionId);
    if (result.success) {
      toast.success('Session deleted successfully');
      onDeleteSession?.(sessionId);
      onClose();
    } else {
      toast.error(result.error || 'Failed to delete session', {
        duration: 5000,
      });
    }
    setShowDeleteConfirm(false);
  };

  const formatCost = (cost: number | undefined | null) => {
    if (!cost && cost !== 0) return '$0.00';
    return cost < 0.01 ? `$${cost.toFixed(6)}` : `$${cost.toFixed(4)}`;
  };

  const formatTokens = (tokens: number | undefined | null): string => {
    if (!tokens && tokens !== 0) return '0';
    if (tokens >= 1000000) return `${(tokens / 1000000).toFixed(1)}M`;
    if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}K`;
    return tokens.toString();
  };

  const formatTimeAgo = (timestamp: number | undefined | null): string => {
    if (!timestamp) return 'Unknown';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  if (!isOpen) return null;

  return (
    <div className="session-details-drawer fixed inset-0 z-50 pointer-events-none">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300 pointer-events-auto ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div
        className={`absolute right-0 top-0 h-full bg-[#0a0a0a] border-l border-white/10 shadow-2xl transition-transform duration-300 pointer-events-auto ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{
          width: 'min(600px, 100vw)',
          background: 'linear-gradient(135deg, rgba(10,10,10,0.98) 0%, rgba(15,15,20,0.98) 100%)'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <header className="flex-shrink-0 px-6 py-4 border-b border-white/10 bg-black/30 backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-semibold text-white truncate">
                  {details?.title || 'Loading...'}
                </h2>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  <StatusBadge status={details?.status || 'completed'} />
                  {details && details.workingDirectory && (
                    <span className="text-xs text-white/40 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                      {details.workingDirectory.split('/').pop() || 'Unknown'}
                    </span>
                  )}
                  {details && details.agentName && (
                    <span className="text-xs text-white/40 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      {details.agentName}
                    </span>
                  )}
                  {details && (
                    <span className="text-xs text-white/40">
                      {formatTimeAgo(details.updatedAt)}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 relative z-[60]">
                <button
                  onClick={onClose}
                  className="p-2 rounded-lg hover:bg-white/10 text-white/70 hover:text-white transition-colors"
                  title="Close"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          {/* Metadata Section */}
          {details && (
            <div className="flex-shrink-0 border-b border-white/10">
              <button
                onClick={() => setMetadataExpanded(!metadataExpanded)}
                className="w-full px-6 py-3 flex items-center justify-between hover:bg-white/5 transition-colors"
              >
                <span className="text-sm font-medium text-white/70">Session Details</span>
                <svg
                  className={`w-4 h-4 text-white/50 transition-transform ${metadataExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {metadataExpanded && (
                <div className="px-6 pb-4 space-y-3">
                  {/* Always show Session ID */}
                  <MetadataRow
                    icon="🆔"
                    label="Session ID"
                    value={details.id}
                    monospace
                    copyable
                  />

                  {/* Only show model if valid */}
                  {details.model && details.model !== 'Unknown' && (
                    <MetadataRow
                      icon="🤖"
                      label="Model"
                      value={details.model}
                    />
                  )}

                  {/* Only show working directory if set */}
                  {details.workingDirectory && details.workingDirectory !== 'Not set' && (
                    <MetadataRow
                      icon="📁"
                      label="Working Directory"
                      value={details.workingDirectory}
                      monospace
                    />
                  )}

                  {/* Only show statistics if we have valid message count */}
                  {details.messageCount !== undefined && details.messageCount > 0 && (
                    <MetadataRow
                      icon="📊"
                      label="Statistics"
                      value={`${details.messageCount} messages • ${formatTokens(details.totalTokens)} tokens • ${formatCost(details.totalCost)}`}
                    />
                  )}

                  {/* Only show dates if valid (not 0 or invalid) */}
                  {details.createdAt && details.createdAt > 0 && !isNaN(details.createdAt) && (
                    <MetadataRow
                      icon="📅"
                      label="Created"
                      value={new Date(details.createdAt).toLocaleString()}
                    />
                  )}

                  {details.updatedAt && details.updatedAt > 0 && !isNaN(details.updatedAt) && (
                    <MetadataRow
                      icon="🔄"
                      label="Updated"
                      value={new Date(details.updatedAt).toLocaleString()}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Messages Timeline */}
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-6 py-4 space-y-4"
          >
            {loading ? (
              <LoadingState />
            ) : error ? (
              <ErrorState error={error} onRetry={loadDetails} />
            ) : details ? (
              <>
                {/* Timestamp Toggle */}
                <div className="flex justify-end mb-4">
                  <button
                    onClick={() => setShowTimestamps(!showTimestamps)}
                    className="text-xs text-white/40 hover:text-white/60 transition-colors"
                  >
                    {showTimestamps ? 'Hide' : 'Show'} timestamps
                  </button>
                </div>

                {/* Load More Indicator (top) */}
                {visibleMessageCount < details.messages.length && (
                  <div ref={messagesTopRef} className="flex justify-center py-3">
                    {isLoadingMore ? (
                      <div className="flex items-center gap-2 text-xs text-white/40">
                        <div className="w-4 h-4 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                        <span>Loading older messages...</span>
                      </div>
                    ) : (
                      <div className="text-xs text-white/30">
                        Scroll up to load older messages ({details.messages.length - visibleMessageCount} more)
                      </div>
                    )}
                  </div>
                )}

                {/* Messages - show only last N messages */}
                {details.messages.slice(-visibleMessageCount).map((message, index) => (
                  <MessageCard
                    key={details.messages.length - visibleMessageCount + index}
                    message={message}
                    showTimestamp={showTimestamps}
                    events={details.events}
                    index={index}
                  />
                ))}

                <div ref={messagesEndRef} />
              </>
            ) : null}
          </div>

          {/* Scroll to Bottom Button */}
          {!autoScroll && (
            <button
              onClick={scrollToBottom}
              className="absolute bottom-24 right-8 p-3 rounded-full bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 shadow-lg backdrop-blur-sm transition-all"
              title="Scroll to bottom"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          )}

          {/* Footer Actions */}
          <footer className="flex-shrink-0 px-6 py-4 border-t border-white/10 bg-black/30 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              {/* Resume Session - Hidden if this is the current active session */}
              {sessionId !== currentActiveSessionId ? (
                <button
                  onClick={handleResume}
                  disabled={!details}
                  className="px-4 py-2.5 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                  Resume Session
                </button>
              ) : (
                <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-500/20 text-green-400 text-sm">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Active Session
                </div>
              )}

              {/* Delete Actions */}
              <div className="flex items-center gap-3">
                {showDeleteConfirm ? (
                  <>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-2.5 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      className="px-3 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                    >
                      Confirm Delete
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    disabled={!details}
                    className="px-4 py-2.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

// Helper Components

interface StatusBadgeProps {
  status: 'active' | 'completed' | 'error';
}

function StatusBadge({ status }: StatusBadgeProps) {
  const configs = {
    active: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    completed: 'bg-green-500/20 text-green-400 border-green-500/30',
    error: 'bg-red-500/20 text-red-400 border-red-500/30',
  };

  return (
    <span className={`px-2 py-1 text-[10px] font-medium rounded-md border uppercase ${configs[status]}`}>
      {status}
    </span>
  );
}

interface MetadataRowProps {
  icon: string;
  label: string;
  value: string;
  monospace?: boolean;
  copyable?: boolean;
}

function MetadataRow({ icon, label, value, monospace, copyable }: MetadataRowProps) {
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="flex items-start gap-3">
      <span className="text-base mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-white/50 mb-1">{label}</div>
        <div className={`text-sm text-white/90 break-all ${monospace ? 'font-mono' : ''}`}>
          {value}
          {copyable && (
            <button
              onClick={handleCopy}
              className="ml-2 p-1 rounded hover:bg-white/10 text-white/40 hover:text-white/60 transition-colors inline-flex"
              title="Copy"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface MessageCardProps {
  message: SessionHistoryMessage;
  showTimestamp: boolean;
  events: any[];
  index: number;
}

const MessageCard = memo(({ message, showTimestamp, events: _events, index }: MessageCardProps) => {
  const isUser = message.role === 'user';
  const timestamp = message.timestamp || Date.now();

  return (
    <div
      className={`flex ${isUser ? 'justify-start' : 'justify-end'} animate-fade-in`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div
        className={`max-w-[85%] px-4 py-3 rounded-2xl ${
          isUser
            ? 'bg-blue-500/10 border border-blue-500/20'
            : 'bg-purple-500/10 border border-purple-500/20'
        }`}
      >
        {/* Role indicator */}
        <div className={`flex items-center gap-2 mb-2 ${isUser ? 'text-blue-400' : 'text-purple-400'}`}>
          <span className="text-xs font-medium uppercase">
            {isUser ? 'You' : 'Assistant'}
          </span>
          {showTimestamp && (
            <span className="text-[10px] opacity-60">
              {formatTimestamp(timestamp)}
            </span>
          )}
        </div>

        {/* Message content */}
        <div className="text-xs text-white/80 leading-relaxed">
          <MarkdownText>{message.content || ''}</MarkdownText>
        </div>

        {/* Tool calls */}
        {message.tool_calls && message.tool_calls.length > 0 && (
          <div className="mt-3 space-y-2">
            {message.tool_calls.map((tool, i) => (
              <ToolCallCard key={i} tool={tool} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

MessageCard.displayName = 'MessageCard';

interface ToolCallCardProps {
  tool: { name: string; input: Record<string, unknown> };
}

function ToolCallCard({ tool }: ToolCallCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-black/20 rounded-lg p-2.5 border border-white/5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v3.586l-1.293-1.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V8z" clipRule="evenodd" />
          </svg>
          <span className="text-xs font-medium text-yellow-400">{tool.name}</span>
        </div>
        <svg
          className={`w-3 h-3 text-white/40 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <pre className="mt-2 p-2 bg-black/30 rounded text-[10px] text-white/60 overflow-x-auto">
          {JSON.stringify(tool.input, null, 2)}
        </pre>
      )}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      <p className="mt-4 text-sm text-white/40">Loading session details...</p>
    </div>
  );
}

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <svg className="w-12 h-12 text-red-400/50 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
      <p className="text-sm text-red-400 mb-4">{error}</p>
      <button
        onClick={onRetry}
        className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white/70 text-sm transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}

// Helper function to format timestamp
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-fade-in {
    animation: fade-in 0.3s ease-out forwards;
    opacity: 0;
  }
`;
document.head.appendChild(style);