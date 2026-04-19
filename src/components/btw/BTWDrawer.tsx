/**
 * BTWDrawer - "By The Way" side-chain chat overlay
 *
 * Slide-in drawer from the right. Fires ephemeral queries to `btw_query`
 * without touching the main agent session. Editorial terminal aesthetic.
 */

import { useEffect, useRef, useState } from 'react';
import './BTWDrawer.css';

export interface BTWDrawerProps {
  isOpen: boolean;
  query: string;
  response: string;
  isLoading: boolean;
  error?: string;
  model: string;
  onSendQuery: (question: string) => void;
  onClose: () => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODEL_LABELS: Record<string, string> = {
  haiku45: 'Haiku 4.5',
  sonnet46: 'Sonnet 4.6',
  opus46: 'Opus 4.6',
};

// ── Sub-components ────────────────────────────────────────────────────────────

function BTWHeader({ model, onClose }: { model: string; onClose: () => void }) {
  return (
    <div className="btw-header">
      <div className="btw-header-left">
        <span className="btw-title">BTW</span>
        <span className="btw-model-badge">{MODEL_LABELS[model] || model}</span>
      </div>
      <button
        type="button"
        className="btw-close-btn"
        onClick={onClose}
        aria-label="Close BTW drawer"
        title="Close (ESC)"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="btw-loading-dots" aria-label="Loading response" role="status">
      <span />
      <span />
      <span />
    </div>
  );
}

function BTWResponseArea({
  query,
  response,
  isLoading,
  error,
}: {
  query: string;
  response: string;
  isLoading: boolean;
  error?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [response, isLoading]);

  const isEmpty = !query && !response && !isLoading && !error;

  return (
    <div className="btw-response-area" ref={scrollRef}>
      {isEmpty && (
        <p className="btw-placeholder">
          Quick question without interrupting the agent.
          <br />
          <span style={{ opacity: 0.5, fontSize: 11 }}>Press Enter to send</span>
        </p>
      )}

      {query && !isEmpty && (
        <div className="btw-query-bubble">
          <span className="btw-bubble-label">You</span>
          <p>{query}</p>
        </div>
      )}

      {isLoading && <LoadingDots />}

      {error && (
        <div className="btw-error-bubble" role="alert">
          <span className="btw-bubble-label btw-bubble-label--error">Error</span>
          <p>{error}</p>
        </div>
      )}

      {response && !isLoading && (
        <div className="btw-response-bubble">
          <span className="btw-bubble-label">BTW</span>
          <pre className="btw-response-text">{response}</pre>
        </div>
      )}
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function BTWInput({
  onSend,
  isLoading,
  isOpen,
}: {
  onSend: (q: string) => void;
  isLoading: boolean;
  isOpen: boolean;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isOpen) inputRef.current?.focus();
  }, [isOpen]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (!trimmed || isLoading) return;
    onSend(trimmed);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="btw-input-area">
      <textarea
        ref={inputRef}
        className="btw-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask something..."
        rows={1}
        disabled={isLoading}
        aria-label="BTW question input"
      />
      <button
        type="button"
        className="btw-send-btn"
        onClick={handleSubmit}
        disabled={isLoading || !value.trim()}
        aria-label="Send question"
      >
        <SendIcon />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function BTWDrawer({
  isOpen,
  query,
  response,
  isLoading,
  error,
  model,
  onSendQuery,
  onClose,
}: BTWDrawerProps) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [isOpen, onClose]);

  return (
    <>
      {isOpen && (
        <div
          className="btw-backdrop"
          style={{
            opacity: isOpen ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className="btw-panel"
        role="complementary"
        aria-label="BTW side-chain chat"
        style={{
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          opacity: isOpen ? 1 : 0,
          transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.2s ease',
          pointerEvents: isOpen ? 'auto' : 'none',
        }}
      >
        <BTWHeader model={model} onClose={onClose} />
        <BTWResponseArea query={query} response={response} isLoading={isLoading} error={error} />
        <BTWInput onSend={onSendQuery} isLoading={isLoading} isOpen={isOpen} />
      </aside>
    </>
  );
}
