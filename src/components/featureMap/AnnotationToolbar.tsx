/**
 * Feature Map — Floating toolbar for annotation mode toggle
 * HTML overlay positioned over the canvas.
 */

import type { AnnotationMode } from './annotationTypes';
import './FeatureMapView.css';

interface Props {
  mode: AnnotationMode;
  onModeChange: (mode: AnnotationMode) => void;
}

const BUTTONS: { mode: AnnotationMode; label: string; icon: string }[] = [
  { mode: 'select', label: 'Seleziona', icon: 'M5 3l14 9-14 9V3z' },
  { mode: 'postit', label: 'Post-it', icon: 'M4 4h16v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4z M4 4l5 5' },
  { mode: 'group', label: 'Gruppo', icon: 'M3 3h18v18H3z' },
];

export default function AnnotationToolbar({ mode, onModeChange }: Props) {
  return (
    <div className="fm-ann-toolbar">
      {BUTTONS.map(btn => (
        <button
          key={btn.mode}
          className={`fm-ann-btn ${mode === btn.mode ? 'active' : ''}`}
          onClick={() => onModeChange(btn.mode)}
          title={btn.label}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={btn.icon} />
          </svg>
        </button>
      ))}
    </div>
  );
}
