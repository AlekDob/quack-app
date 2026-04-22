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
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15.5 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V8.5L15.5 3z" />
      <polyline points="14 3 14 9 21 9" />
    </svg>
  );
}
function GroupIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="15" rx="2" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="6" y1="8" x2="12" y2="8" strokeWidth="2" />
    </svg>
  );
}
function StickerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-9" />
      <path d="M14 3v6h6" />
      <path d="M14 3l7 7" />
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
          className="office-toolbar__btn office-toolbar__undo"
          onClick={onUndo}
          disabled={!canUndo}
          title="Undo (Cmd+Z)"
        >↶</button>
        <button
          type="button"
          className="office-toolbar__btn office-toolbar__undo"
          onClick={onRedo}
          disabled={!canRedo}
          title="Redo (Cmd+Shift+Z)"
        >↷</button>
      </div>
    </>
  );
}

export const OfficeToolbar = memo(OfficeToolbarImpl);
