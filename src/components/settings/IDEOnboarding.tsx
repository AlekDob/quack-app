import { useEffect, useState } from 'react';
import { useIDEStore, IDE_REGISTRY, selectShouldShowOnboarding } from '../../stores/ideStore';
import './IDEOnboarding.css';

// IDE Icons as SVG components (same as IDESettings)
const IDEIcon = ({ ideId, size = 32 }: { ideId: string; size?: number }) => {
  const iconStyle = { width: size, height: size };

  switch (ideId) {
    case 'vscode':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
          <path d="M17.5 2L9 10.5L4 6.5L2 8L6.5 12L2 16L4 17.5L9 13.5L17.5 22L22 20V4L17.5 2Z" fill="#007ACC" />
          <path d="M17.5 2V22L22 20V4L17.5 2Z" fill="#1F9CF0" />
        </svg>
      );
    case 'cursor':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="4" fill="#1a1a1a" stroke="#fff" strokeWidth="1.5" />
          <path d="M8 8L16 12L8 16V8Z" fill="#fff" />
        </svg>
      );
    case 'windsurf':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
          <path d="M12 2L22 12L12 22L2 12L12 2Z" fill="#00b4d8" />
          <path d="M12 6L18 12L12 18L6 12L12 6Z" fill="#0077b6" />
        </svg>
      );
    case 'zed':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" fill="#084" />
          <text x="12" y="16" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">Z</text>
        </svg>
      );
    case 'intellij':
    case 'webstorm':
    case 'pycharm':
    case 'goland':
    case 'rubymine':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
          <rect x="2" y="2" width="20" height="20" rx="3" fill="#000" />
          <rect x="4" y="16" width="10" height="3" fill="#fff" />
          <rect x="4" y="5" width="4" height="4" fill="#fc801d" />
          <rect x="10" y="5" width="4" height="4" fill="#087cfa" />
          <rect x="16" y="5" width="4" height="4" fill="#fe2857" />
        </svg>
      );
    case 'sublime':
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none">
          <path d="M4 4L20 8L20 12L4 8L4 4Z" fill="#ff9800" />
          <path d="M4 12L20 16L20 20L4 16L4 12Z" fill="#ff9800" />
        </svg>
      );
    default:
      return (
        <svg style={iconStyle} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 9l6 6M15 9l-6 6" />
        </svg>
      );
  }
};

export default function IDEOnboarding() {
  const {
    detectedIDEs,
    isDetecting,
    detectInstalledIDEs,
    setPreferredIDE,
    completeOnboarding,
  } = useIDEStore();

  const shouldShow = useIDEStore(selectShouldShowOnboarding);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedIDE, setSelectedIDE] = useState<string | null>(null);

  // Detect IDEs on mount
  useEffect(() => {
    if (shouldShow) {
      detectInstalledIDEs();
    }
  }, [shouldShow, detectInstalledIDEs]);

  if (!shouldShow) {
    return null;
  }

  const handleSelectIDE = async () => {
    if (!selectedIDE) return;

    await setPreferredIDE(selectedIDE);
    completeOnboarding();
    handleClose();
  };

  const handleSkip = () => {
    completeOnboarding();
    handleClose();
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
    }, 250);
  };

  return (
    <div className={`ide-onboarding-overlay ${isClosing ? 'closing' : ''}`}>
      <div className="ide-onboarding-dialog">
        {/* Header */}
        <div className="ide-onboarding-header">
          <div className="ide-onboarding-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8" />
              <path d="M12 17v4" />
              <path d="M7 8l3 3-3 3" />
              <path d="M13 11h4" />
            </svg>
          </div>
          <h2>Choose Your Code Editor</h2>
          <p>
            Quack works best alongside your favorite IDE. Select your preferred
            editor to enable seamless file navigation and dual-window workflow.
          </p>
        </div>

        {/* IDE Grid */}
        <div className="ide-onboarding-grid">
          {isDetecting ? (
            <div className="ide-onboarding-loading">
              <div className="ide-onboarding-spinner" />
              <span>Detecting installed IDEs...</span>
            </div>
          ) : (
            Object.entries(IDE_REGISTRY).map(([ideId, info]) => {
              const detected = detectedIDEs.find(d => d.id === ideId);
              const isInstalled = !!detected;
              const isSelected = selectedIDE === ideId;

              return (
                <button
                  key={ideId}
                  className={`ide-onboarding-card ${isSelected ? 'selected' : ''} ${!isInstalled ? 'not-installed' : ''}`}
                  onClick={() => isInstalled && setSelectedIDE(ideId)}
                  disabled={!isInstalled}
                >
                  <div className="ide-onboarding-card-icon">
                    <IDEIcon ideId={ideId} size={40} />
                  </div>
                  <div className="ide-onboarding-card-name">{info.name}</div>
                  {isSelected && (
                    <div className="ide-onboarding-card-check">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" fill="#f28c52" />
                        <path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                  {!isInstalled && (
                    <div className="ide-onboarding-card-unavailable">Not installed</div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Actions */}
        <div className="ide-onboarding-actions">
          <button
            className="ide-onboarding-skip"
            onClick={handleSkip}
          >
            Skip for now
          </button>
          <button
            className="ide-onboarding-continue"
            onClick={handleSelectIDE}
            disabled={!selectedIDE}
          >
            Continue with {selectedIDE ? IDE_REGISTRY[selectedIDE]?.name : 'selected IDE'}
          </button>
        </div>

        {/* Footer */}
        <div className="ide-onboarding-footer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5.5" />
            <path d="M7 4.5v3M7 9.5h.01" strokeLinecap="round" />
          </svg>
          <span>You can change this later in Settings</span>
        </div>
      </div>
    </div>
  );
}
