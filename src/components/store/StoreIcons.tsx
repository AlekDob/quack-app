import type { ReactElement } from 'react';
import { getAvatarUrl } from '../../utils/agentAvatars';

// Category-specific gradients - each type has its own color
export const CATEGORY_GRADIENTS: Record<string, string> = {
  skills: 'linear-gradient(135deg, #f28c52, #e67339)',
  agents: 'linear-gradient(135deg, #f28c52, #fbbf24)',
  'agent-bundles': 'linear-gradient(135deg, #f28c52, #fbbf24)',
  droids: 'linear-gradient(135deg, #4ecdc4, #26a69a)',
  rules: 'linear-gradient(135deg, #60a5fa, #3b82f6)',
  hooks: 'linear-gradient(135deg, #a78bfa, #8b5cf6)',
  mcp: 'linear-gradient(135deg, #34d399, #10b981)',
  commands: 'linear-gradient(135deg, #f472b6, #ec4899)',
  default: 'linear-gradient(135deg, #6b7280, #4b5563)',
};

export function getCategoryGradient(category: string): string {
  return CATEGORY_GRADIENTS[category] || CATEGORY_GRADIENTS.default;
}

export function VerifiedIcon(): ReactElement {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
      <path
        d="M10 1l2.5 1.5L15 2l1 2.5L18 6l-.5 2.5L19 11l-2 2 .5 2.5-2.5 1L14 19l-2.5-.5L9 19l-1.5-2.5L5 16l-1-2.5L2 11l.5-2.5L1 6l2-2-.5-2.5L5 1l2.5.5L10 1z"
        fill="#00D9FF"
        opacity="0.9"
      />
      <path d="M7 10l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function formatInstallCount(count: number): string {
  if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
  return String(count);
}

// Discover page icon (compass)
export function getDiscoverIcon(size = 14): ReactElement {
  return (
    <svg viewBox="0 0 20 20" style={{ width: size, height: size, color: 'white' }}>
      <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <polygon points="10,4 12,8 16,10 12,12 10,16 8,12 4,10 8,8" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

// Category icons - matches SidePanelAccordion for uniformity
export function getCategoryIcon(category: string, size = 14): ReactElement {
  const s = { width: size, height: size, color: 'white' };

  switch (category) {
    case 'skills':
      return (
        <svg viewBox="0 0 20 20" style={s}>
          <path d="M10 2l2 4 4.5 0.5-3.25 3 1 4.5-4.25-2.5-4.25 2.5 1-4.5L3.5 6.5 8 6z" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
    case 'agents':
    case 'agent-bundles':
      return (
        <svg viewBox="0 0 20 20" style={s}>
          <circle cx="10" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 17a5 5 0 0 1 10 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'droids':
      return (
        <svg viewBox="0 0 20 20" style={s}>
          <rect x="4" y="4" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="7.5" cy="9" r="1.3" fill="currentColor" />
          <circle cx="12.5" cy="9" r="1.3" fill="currentColor" />
          <line x1="7.5" y1="13" x2="12.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'rules':
      return (
        <svg viewBox="0 0 20 20" style={s}>
          <path d="M4 3h8l4 4v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M5 10l1.5 1.5L9 9M5 14l1.5 1.5L9 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'hooks':
      return (
        <svg viewBox="0 0 20 20" style={s}>
          <path d="M10 3v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M10 10c0 2.5-2 4-4 4s-4-1.5-4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="3" r="1.5" fill="currentColor" />
        </svg>
      );
    case 'mcp':
      return (
        <svg viewBox="0 0 20 20" style={s}>
          <path d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="8" r="1.5" fill="currentColor" />
          <circle cx="13" cy="8" r="1.5" fill="currentColor" />
          <path d="M7 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case 'commands':
      return (
        <svg viewBox="0 0 20 20" style={s}>
          <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M6 7l2 2-2 2M10 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 20 20" style={s}>
          <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      );
  }
}

/** Check if a resource has a duck avatar (agent-bundles with suggestedAvatar) */
export function hasDuckAvatar(icon?: string): boolean {
  return !!icon && icon.startsWith('duck') && icon.endsWith('.jpeg');
}

/** Get the resolved URL for a duck avatar */
export function getDuckAvatarUrl(icon: string): string {
  return getAvatarUrl(icon);
}
