/**
 * Feature Map — Floating toolbar for annotation mode toggle
 * HTML overlay positioned over the canvas.
 */

import React from 'react';
import type { AnnotationMode } from './annotationTypes';
import './FeatureMapView.css';

interface Props {
  mode: AnnotationMode;
  onModeChange: (mode: AnnotationMode) => void;
}

function SelectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 4l7.07 17 2.51-7.39L21 11.1 4 4z"
        stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
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
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="3" strokeDasharray="5 3" />
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

const BUTTONS: { mode: AnnotationMode; label: string; Icon: () => React.JSX.Element }[] = [
  { mode: 'select', label: 'Select', Icon: SelectIcon },
  { mode: 'postit', label: 'Post-it', Icon: PostItIcon },
  { mode: 'group', label: 'Group', Icon: GroupIcon },
  { mode: 'image', label: 'Image', Icon: ImageIcon },
];

export default function AnnotationToolbar({ mode, onModeChange }: Props) {
  return (
    <div className="fm-ann-toolbar">
      {BUTTONS.map(({ mode: m, label, Icon }) => (
        <button
          key={m}
          className={`fm-ann-btn ${mode === m ? 'active' : ''}`}
          onClick={() => onModeChange(m)}
          title={label}
        >
          <Icon />
        </button>
      ))}
    </div>
  );
}
