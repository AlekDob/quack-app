import { useEffect, useState } from 'react';
import { useIDEStore, IDE_REGISTRY, selectPreferredIDEName } from '../../../stores/ideStore';
import './IDESettings.css';

// IDE Icons as SVG components
const IDEIcon = ({ ideId, size = 24 }: { ideId: string; size?: number }) => {
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

export default function IDESettings() {
  const {
    preferredIDE,
    autoLaunch,
    syncFocus,
    detectedIDEs,
    isDetecting,
    detectInstalledIDEs,
    setPreferredIDE,
    setAutoLaunch,
    setSyncFocus,
    arrangeWindowsSideBySide,
  } = useIDEStore();

  const preferredIDEName = useIDEStore(selectPreferredIDEName);
  const [isArranging, setIsArranging] = useState(false);

  // Detect IDEs on mount
  useEffect(() => {
    detectInstalledIDEs();
  }, [detectInstalledIDEs]);

  const handleSelectIDE = async (ideId: string) => {
    await setPreferredIDE(ideId);
  };

  const handleArrangeWindows = async () => {
    if (!preferredIDE) return;

    setIsArranging(true);
    try {
      await arrangeWindowsSideBySide();
    } catch (error) {
      console.error('Failed to arrange windows:', error);
    } finally {
      setIsArranging(false);
    }
  };

  return (
    <div className="ide-settings">
      {/* Header */}
      <div className="ide-settings-header">
        <div className="ide-settings-header-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8" />
            <path d="M12 17v4" />
            <path d="M7 8l3 3-3 3" />
            <path d="M13 11h4" />
          </svg>
        </div>
        <div className="ide-settings-header-text">
          <h3>External IDE Integration</h3>
          <p>Connect Quack with your preferred code editor for a seamless dual-window workflow.</p>
        </div>
      </div>

      {/* Current Selection */}
      {preferredIDE && (
        <div className="ide-settings-current">
          <div className="ide-settings-current-badge">
            <IDEIcon ideId={preferredIDE} size={20} />
            <span>Currently using</span>
            <strong>{preferredIDEName}</strong>
          </div>
        </div>
      )}

      {/* IDE Selection Grid */}
      <div className="ide-settings-section">
        <div className="ide-settings-section-header">
          <h4>Select Your IDE</h4>
          {isDetecting && <span className="ide-settings-detecting">Detecting...</span>}
        </div>

        <div className="ide-settings-grid">
          {Object.entries(IDE_REGISTRY).map(([ideId, info]) => {
            const detected = detectedIDEs.find(d => d.id === ideId);
            const isInstalled = !!detected;
            const isSelected = preferredIDE === ideId;

            return (
              <button
                key={ideId}
                className={`ide-settings-card ${isSelected ? 'selected' : ''} ${!isInstalled ? 'not-installed' : ''}`}
                onClick={() => isInstalled && handleSelectIDE(ideId)}
                disabled={!isInstalled}
                title={isInstalled ? `Select ${info.name}` : `${info.name} not installed`}
              >
                <div className="ide-settings-card-icon">
                  <IDEIcon ideId={ideId} size={32} />
                </div>
                <div className="ide-settings-card-name">{info.name}</div>
                {isSelected && (
                  <div className="ide-settings-card-check">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="#f28c52" />
                      <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {!isInstalled && (
                  <div className="ide-settings-card-unavailable">Not installed</div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Settings Toggles */}
      <div className="ide-settings-section">
        <h4>Behavior</h4>

        <div className="ide-settings-toggles">
          <label className="ide-settings-toggle">
            <div className="ide-settings-toggle-info">
              <span className="ide-settings-toggle-label">Auto-launch IDE</span>
              <span className="ide-settings-toggle-description">
                Open your IDE automatically when Quack starts
              </span>
            </div>
            <input
              type="checkbox"
              checked={autoLaunch}
              onChange={(e) => setAutoLaunch(e.target.checked)}
              disabled={!preferredIDE}
            />
            <span className="ide-settings-toggle-switch" />
          </label>

          <label className="ide-settings-toggle">
            <div className="ide-settings-toggle-info">
              <span className="ide-settings-toggle-label">Sync Focus</span>
              <span className="ide-settings-toggle-description">
                Bring both windows to foreground together
              </span>
            </div>
            <input
              type="checkbox"
              checked={syncFocus}
              onChange={(e) => setSyncFocus(e.target.checked)}
              disabled={!preferredIDE}
            />
            <span className="ide-settings-toggle-switch" />
          </label>
        </div>
      </div>

      {/* Window Management */}
      <div className="ide-settings-section">
        <h4>Window Management</h4>

        <button
          className="ide-settings-arrange-btn"
          onClick={handleArrangeWindows}
          disabled={!preferredIDE || isArranging}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="7" height="14" rx="1" />
            <rect x="11" y="3" width="7" height="14" rx="1" />
          </svg>
          <span>{isArranging ? 'Arranging...' : 'Arrange Side-by-Side'}</span>
          <span className="ide-settings-arrange-hint">Quack left, IDE right</span>
        </button>
      </div>

      {/* Info Notice */}
      <div className="ide-settings-notice">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6.5" />
          <path d="M8 5v4M8 11h.01" strokeLinecap="round" />
        </svg>
        <span>
          Files modified by AI agents will automatically open in your IDE.
          Git diff is handled natively by your editor.
        </span>
      </div>
    </div>
  );
}
