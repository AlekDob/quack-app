/**
 * CopyButton — Reusable copy-to-clipboard button with visual feedback.
 * Used by MarkdownText code blocks and HtmlVisualizer.
 */
import { useState } from 'react';

interface CopyButtonProps {
  text: string;
  className?: string;
}

/** Copy content to clipboard with copied/idle state toggle */
export function CopyButton({ text, className = 'md-copy-button' }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  return (
    <button
      className={className}
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy to clipboard'}
      type="button"
    >
      {copied ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M13.5 3.5L6 11L2.5 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="5" y="5" width="9" height="9" rx="1" />
          <path d="M3 11V3a2 2 0 0 1 2-2h8" />
        </svg>
      )}
      <span className="md-copy-label">{copied ? 'Copied!' : 'Copy'}</span>
    </button>
  );
}
