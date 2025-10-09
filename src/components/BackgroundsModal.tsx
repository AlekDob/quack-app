import { memo } from 'react';

interface BackgroundsModalProps {
  open: boolean;
  currentBackground: string;
  onSelect: (background: string) => void;
  onClose: () => void;
}

interface BackgroundItem {
  name: string;
  label: string;
  preview?: string;
  gradient?: string;
  type: 'image' | 'gradient';
}

interface BackgroundGroup {
  title: string;
  items: BackgroundItem[];
}

// Import backgrounds using Vite's URL constructor for proper bundling
const duckImage = new URL('../../images/backgrounds/duck.png', import.meta.url).href;
const ducksPatternImage = new URL('../../images/backgrounds/ducks-pattern.png', import.meta.url).href;
const duckPattern3Image = new URL('../../images/backgrounds/duck-pattern3.png', import.meta.url).href;

// Available backgrounds grouped by type
const BACKGROUND_GROUPS: BackgroundGroup[] = [
  {
    title: 'Images',
    items: [
      { name: 'duck.png', label: 'Duck', preview: duckImage, type: 'image' },
      { name: 'ducks-pattern.png', label: 'Ducks Pattern', preview: ducksPatternImage, type: 'image' },
      { name: 'duck-pattern3.png', label: 'Duck Pattern 3', preview: duckPattern3Image, type: 'image' },
    ],
  },
  {
    title: 'Gradients',
    items: [
      {
        name: 'gradient-orange-dark',
        label: 'Orange Dark',
        gradient: 'linear-gradient(135deg, #1a0f0a 0%, #3d2415 25%, #5a3a25 50%, #3d2415 75%, #1a0f0a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-blue-dark',
        label: 'Blue Dark',
        gradient: 'linear-gradient(135deg, #0a0f1a 0%, #15243d 25%, #20355a 50%, #15243d 75%, #0a0f1a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-green-dark',
        label: 'Green Dark',
        gradient: 'linear-gradient(135deg, #0a1a0f 0%, #15392d 25%, #20564a 50%, #15392d 75%, #0a1a0f 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-purple-dark',
        label: 'Purple Dark',
        gradient: 'linear-gradient(135deg, #160a1a 0%, #2d1539 25%, #4a2056 50%, #2d1539 75%, #160a1a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-red-dark',
        label: 'Red Dark',
        gradient: 'linear-gradient(135deg, #1a0a0a 0%, #3d1515 25%, #5a2020 50%, #3d1515 75%, #1a0a0a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-teal-dark',
        label: 'Teal Dark',
        gradient: 'linear-gradient(135deg, #0a1a1a 0%, #153d3d 25%, #205a5a 50%, #153d3d 75%, #0a1a1a 100%)',
        type: 'gradient',
      },
      {
        name: 'gradient-amber-dark',
        label: 'Amber Dark',
        gradient: 'linear-gradient(135deg, #1a150a 0%, #3d3015 25%, #5a4a20 50%, #3d3015 75%, #1a150a 100%)',
        type: 'gradient',
      },
    ],
  },
];

function BackgroundsModal({
  open,
  currentBackground,
  onSelect,
  onClose,
}: BackgroundsModalProps) {

  if (!open) {
    return null;
  }

  const handleSelectBackground = (background: string) => {
    onSelect(background);
    onClose();
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="modal-panel backgrounds-modal">
        <header className="modal-header">
          <h2>Choose Background</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </header>

        <div className="backgrounds-container">
          {BACKGROUND_GROUPS.map((group) => (
            <div key={group.title} className="backgrounds-group">
              <h3 className="backgrounds-group-title">{group.title}</h3>
              <div className="backgrounds-grid">
                {group.items.map((bg) => {
                  const isSelected = bg.name === currentBackground;

                  return (
                    <button
                      key={bg.name}
                      type="button"
                      className={`background-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleSelectBackground(bg.name)}
                    >
                      <div
                        className="background-preview"
                        style={bg.type === 'gradient' ? { background: bg.gradient } : undefined}
                      >
                        {bg.type === 'image' && (
                          <img
                            src={bg.preview}
                            alt={bg.label}
                            loading="lazy"
                          />
                        )}
                      </div>
                      <div className="background-name">{bg.label}</div>
                      {isSelected && (
                        <div className="background-selected-badge">
                          ✓
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(BackgroundsModal, (prev, next) => {
  // Re-render only if relevant props changed
  if (prev.open !== next.open) return false;
  if (prev.currentBackground !== next.currentBackground) return false;
  // Props are equal, skip re-render
  return true;
});
