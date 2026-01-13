/**
 * NewSessionModal Component
 *
 * Simple modal for creating a new AgentSession.
 * Only requires a title (optional - defaults to timestamp-based name).
 *
 * Used when clicking "+" under an agent card in the sidebar.
 */

import { useState, useEffect, useCallback } from 'react';
import './NewSessionModal.css';

interface NewSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string) => void;
  agentName?: string; // For display in header
}

/**
 * Generate default session title based on timestamp
 */
function generateDefaultTitle(): string {
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'short' });
  const day = now.getDate();
  const hour = now.getHours().toString().padStart(2, '0');
  const minute = now.getMinutes().toString().padStart(2, '0');
  return `Session ${month} ${day} ${hour}:${minute}`;
}

export default function NewSessionModal({
  isOpen,
  onClose,
  onSubmit,
  agentName,
}: NewSessionModalProps) {
  const [title, setTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Handle form submission
  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;

    setIsSubmitting(true);

    // Use provided title or generate default
    const sessionTitle = title.trim() || generateDefaultTitle();
    onSubmit(sessionTitle);
  }, [title, isSubmitting, onSubmit]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, onClose]
  );

  // Handle backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) {
        onClose();
      }
    },
    [onClose]
  );

  if (!isOpen) return null;

  return (
    <div
      className="new-session-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="new-session-modal" role="dialog" aria-modal="true">
        {/* Header */}
        <div className="new-session-modal-header">
          <h2>New Session</h2>
          {agentName && (
            <span className="new-session-modal-agent">for {agentName}</span>
          )}
          <button className="new-session-modal-close" onClick={onClose}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="new-session-modal-content">
          <div className="new-session-form-field">
            <label htmlFor="session-title">
              Session Name
              <span className="new-session-optional">(optional)</span>
            </label>
            <input
              id="session-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={generateDefaultTitle()}
              autoFocus
            />
            <span className="new-session-hint">
              Leave empty to use auto-generated name
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="new-session-modal-footer">
          <button
            className="new-session-button secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            className="new-session-button primary"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="new-session-spinner" />
                Creating...
              </>
            ) : (
              'Create Session'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
