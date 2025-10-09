import { memo } from 'react';

interface BackgroundsModalProps {
  open: boolean;
  currentBackground: string;
  onSelect: (background: string) => void;
  onClose: () => void;
}

// Available backgrounds - add more here as needed
const AVAILABLE_BACKGROUNDS = [
  { name: 'duck.png', label: 'Duck' },
  { name: 'ducks-pattern.png', label: 'Ducks Pattern' },
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

        <div className="backgrounds-grid">
          {AVAILABLE_BACKGROUNDS.map((bg) => {
            const isSelected = bg.name === currentBackground;
            const imagePath = `/images/backgrounds/${bg.name}`;

            return (
              <button
                key={bg.name}
                type="button"
                className={`background-item ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectBackground(bg.name)}
              >
                <div className="background-preview">
                  <img
                    src={imagePath}
                    alt={bg.label}
                    loading="lazy"
                  />
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

        <div className="modal-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default memo(BackgroundsModal, (prev, next) => prev.open === next.open && !next.open);
