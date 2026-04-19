/**
 * Feature Map — Floating toolbar for annotation mode toggle
 * HTML overlay positioned over the canvas.
 */

import React, { useEffect } from 'react';
import type { AnnotationMode } from './annotationTypes';
import KeyboardShortcutTooltip from '../KeyboardShortcutTooltip';
import './FeatureMapView.css';

interface Props {
  mode: AnnotationMode;
  onModeChange: (mode: AnnotationMode) => void;
  selectionCount?: number;
  onCreateComponent?: () => void;
  canCreateComponent?: boolean;
}

function SelectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 4l7.07 17 2.51-7.39L21 11.1 4 4z"
        stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function LassoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Crosshair corners — marquee selection tool */}
      <path d="M3 8V5a2 2 0 012-2h3" />
      <path d="M16 3h3a2 2 0 012 2v3" />
      <path d="M21 16v3a2 2 0 01-2 2h-3" />
      <path d="M8 21H5a2 2 0 01-2-2v-3" />
    </svg>
  );
}

function PostItIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3z" />
      <polyline points="14 3 14 9 21 9" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Group rect with header bar */}
      <rect x="3" y="6" width="18" height="15" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="6" y1="8" x2="12" y2="8" strokeWidth="2" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}

function MdCardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      {/* Document card with markdown "M" bars */}
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M7 9v6M7 9l2.5 3L12 9v6" />
      <path d="M15 9v6M15 13l2 2 2-2" />
    </svg>
  );
}

const BUTTONS: { mode: AnnotationMode; label: string; shortcut: string; Icon: () => React.JSX.Element }[] = [
  { mode: 'select', label: 'Select', shortcut: '1', Icon: SelectIcon },
  { mode: 'lasso', label: 'Lasso Select', shortcut: '2', Icon: LassoIcon },
  { mode: 'postit', label: 'Post-it', shortcut: '3', Icon: PostItIcon },
  { mode: 'group', label: 'Group', shortcut: '4', Icon: GroupIcon },
  { mode: 'image', label: 'Image', shortcut: '5', Icon: ImageIcon },
  { mode: 'mdcard', label: 'MD Preview Card', shortcut: '6', Icon: MdCardIcon },
];

const SHORTCUT_MAP: Record<string, AnnotationMode> = {
  '1': 'select', '2': 'lasso', '3': 'postit', '4': 'group', '5': 'image', '6': 'mdcard',
};

export default function AnnotationToolbar({ mode, onModeChange, selectionCount = 0, onCreateComponent, canCreateComponent = true }: Props) {
  const showCreate = selectionCount >= 2 && canCreateComponent;

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const m = SHORTCUT_MAP[e.key];
      if (m) onModeChange(m);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onModeChange]);

  return (
    <div className="fm-ann-toolbar">
      {BUTTONS.map(({ mode: m, label, shortcut, Icon }) => (
        <KeyboardShortcutTooltip
          key={m}
          label={`${label} · Ctrl to cycle`}
          shortcut={shortcut}
          position="top"
        >
          <button
            className={`fm-ann-btn ${mode === m ? 'active' : ''}`}
            onClick={() => onModeChange(m)}
          >
            <Icon />
          </button>
        </KeyboardShortcutTooltip>
      ))}
      {/* Selection counter badge */}
      {selectionCount > 0 && (
        <KeyboardShortcutTooltip label={`${selectionCount} selected`} position="top">
          <span className="fm-ann-selection-badge">
            {selectionCount}
          </span>
        </KeyboardShortcutTooltip>
      )}
      {/* Create Component button — visible when 2+ items selected */}
      {selectionCount >= 2 && (
        <KeyboardShortcutTooltip
          label={showCreate ? 'Create Component' : 'Max nesting depth reached'}
          position="top"
        >
          <button
            className="fm-ann-component-btn"
            onClick={onCreateComponent}
            disabled={!showCreate}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
        </KeyboardShortcutTooltip>
      )}
    </div>
  );
}
