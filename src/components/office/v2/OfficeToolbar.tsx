import { memo, useEffect, useState } from 'react';
import { STICKER_CATALOG } from './officeStickerCatalog';

export type OfficeMode = 'select' | 'postit' | 'group' | 'sticker';

interface Props {
  mode: OfficeMode;
  onModeChange: (mode: OfficeMode) => void;
  activeSticker: string | null;
  onStickerChange: (kind: string | null) => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
}

const MODE_SHORTCUTS: Record<string, OfficeMode> = {
  '1': 'select',
  '2': 'postit',
  '3': 'group',
  '4': 'sticker',
};

function SelectIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 4l7.07 17 2.51-7.39L21 11.1 4 4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function PostItIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h11l5 5v11H4z" />
      <path d="M15 4v5h5" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="16" x2="13" y2="16" />
    </svg>
  );
}

function GroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 2" />
      <rect x="7" y="7" width="4" height="4" rx="1" fill="currentColor" stroke="none" />
      <rect x="13" y="13" width="4" height="4" rx="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function StickerIcon() {
  // Armchair top-down — clearly "furniture"
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 11V7a2 2 0 012-2h10a2 2 0 012 2v4" />
      <path d="M3 11a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
      <line x1="7" y1="17" x2="7" y2="20" />
      <line x1="17" y1="17" x2="17" y2="20" />
    </svg>
  );
}

function UndoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 00-15-6.7L3 13" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0115-6.7L21 13" />
    </svg>
  );
}

function OfficeToolbarImpl({ mode, onModeChange, activeSticker, onStickerChange, canUndo, canRedo, onUndo, onRedo }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (mode !== 'sticker') {
      setPickerOpen(false);
      onStickerChange(null);
    }
  }, [mode, onStickerChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.key === 'Escape') {
        onModeChange('select');
        return;
      }
      const m = MODE_SHORTCUTS[e.key];
      if (m) {
        if (m === 'sticker') setPickerOpen(p => !p);
        onModeChange(m);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onModeChange]);

  const btn = (m: OfficeMode, Icon: () => React.JSX.Element, shortcut: string, onClickExtra?: () => void) => (
    <button
      type="button"
      className={`office-toolbar__btn ${mode === m ? 'active' : ''}`}
      onClick={() => {
        onModeChange(m);
        onClickExtra?.();
      }}
      title={`${m} (${shortcut})`}
    >
      <Icon />
    </button>
  );

  return (
    <>
      {mode === 'sticker' && pickerOpen && (
        <div className="office-sticker-picker">
          {STICKER_CATALOG.map(s => (
            <button
              key={s.id}
              type="button"
              className={`office-sticker-picker__item ${activeSticker === s.id ? 'active' : ''}`}
              onClick={() => onStickerChange(s.id)}
              title={s.label}
            >
              <svg className="office-sticker-picker__preview" viewBox="-40 -30 80 60" width="36" height="28">
                {s.render()}
              </svg>
              <span>{s.label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="office-toolbar">
        {btn('select', SelectIcon, '1')}
        {btn('postit', PostItIcon, '2')}
        {btn('group', GroupIcon, '3')}
        {btn('sticker', StickerIcon, '4', () => setPickerOpen(p => !p))}
        <div className="office-toolbar__divider" />
        <button
          type="button"
          className="office-toolbar__btn"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          className="office-toolbar__btn"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
        >
          <RedoIcon />
        </button>
      </div>
    </>
  );
}

export const OfficeToolbar = memo(OfficeToolbarImpl);
