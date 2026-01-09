import { useState, useRef } from 'react';
import { toast } from 'sonner';
import './SessionIdDisplay.css';

interface SessionIdDisplayProps {
  sessionId: string;
  className?: string;
}

/**
 * SessionIdDisplay Component
 *
 * Displays a truncated Claude session ID with click-to-copy functionality.
 * Shows first 8 characters with "..." and full ID on hover.
 *
 * @example
 * <SessionIdDisplay sessionId="abc123def456..." />
 */
export default function SessionIdDisplay({ sessionId, className = '' }: SessionIdDisplayProps) {
  const [isCopied, setIsCopied] = useState(false);
  const copyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleCopySessionId = async () => {
    try {
      await navigator.clipboard.writeText(sessionId);
      setIsCopied(true);
      toast.success('Session ID copied to clipboard');

      // Reset copied state after 2 seconds
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
      }, 2000);
    } catch (err) {
      console.error('[SessionIdDisplay] Failed to copy session ID:', err);
      toast.error('Failed to copy session ID');
    }
  };

  // Truncate to first 8 chars
  const truncatedId = sessionId.length > 8 ? `${sessionId.slice(0, 8)}...` : sessionId;

  return (
    <button
      className={`session-id-display ${isCopied ? 'copied' : ''} ${className}`}
      onClick={handleCopySessionId}
      title={`Session: ${sessionId}\nClick to copy`}
      type="button"
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="session-icon"
      >
        {isCopied ? (
          // Checkmark icon when copied
          <polyline points="20 6 9 17 4 12" />
        ) : (
          // Chat bubble icon
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        )}
      </svg>
      <span className="session-id-text">{truncatedId}</span>
    </button>
  );
}
