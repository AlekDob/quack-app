import { useEffect, useMemo, useRef } from 'react';
import { useIDEStore, selectPreferredIDEName } from '../../../stores/ideStore';
import type { InstalledApp } from '../../../stores/ideStore';
import './IDESettings.css';

// App icon - uses real icon from Rust backend, with SVG fallback
const AppIcon = ({ app, size = 32 }: { app: InstalledApp; size?: number }) => {
  if (app.icon_base64) {
    return (
      <img
        src={`data:image/png;base64,${app.icon_base64}`}
        alt={app.name}
        width={size}
        height={size}
        style={{ borderRadius: '6px' }}
      />
    );
  }

  // Fallback: generic icon
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M7 8l3 3-3 3" />
      <path d="M13 11h4" />
    </svg>
  );
};

export default function IDESettings() {
  const preferredIDE = useIDEStore(s => s.preferredIDE);
  const autoLaunch = useIDEStore(s => s.autoLaunch);
  const syncFocus = useIDEStore(s => s.syncFocus);
  const fileOpenTarget = useIDEStore(s => s.fileOpenTarget);
  const isLoadingApps = useIDEStore(s => s.isLoadingApps);
  const installedApps = useIDEStore(s => s.installedApps);
  const isAddingCustomIDE = useIDEStore(s => s.isAddingCustomIDE);

  const preferredIDEName = useIDEStore(selectPreferredIDEName);

  // Memoize filtered IDE apps to avoid new array reference each render
  const ideApps = useMemo(
    () => installedApps.filter(a => a.category === 'ide'),
    [installedApps]
  );

  // Load installed apps once on mount
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      useIDEStore.getState().loadInstalledApps();
    }
  }, []);

  const handleSelectIDE = async (ideId: string) => {
    await useIDEStore.getState().setPreferredIDE(ideId);
  };

  const handleAddCustomIDE = async () => {
    try {
      const app = await useIDEStore.getState().addCustomIDE();
      if (app) {
        await useIDEStore.getState().setPreferredIDE(app.id);
      }
    } catch (error) {
      console.error('[IDESettings] Failed to add custom IDE:', error);
    }
  };

  const handleRemoveCustomIDE = async (e: React.MouseEvent, ideId: string) => {
    e.stopPropagation();
    try {
      await useIDEStore.getState().removeCustomIDE(ideId);
    } catch (error) {
      console.error('[IDESettings] Failed to remove custom IDE:', error);
    }
  };

  const handleArrangeWindows = async () => {
    if (!preferredIDE) return;
    try {
      await useIDEStore.getState().arrangeWindowsSideBySide();
    } catch (error) {
      console.error('Failed to arrange windows:', error);
    }
  };

  // Find the preferred app for the badge
  const preferredApp = ideApps.find(a => a.id === preferredIDE);

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

      {/* Current Selection + File Open Target Toggle */}
      {preferredIDE && preferredApp && (
        <div className="ide-settings-current">
          <div className="ide-settings-current-badge">
            <AppIcon app={preferredApp} size={20} />
            <span>Currently using</span>
            <strong>{preferredIDEName}</strong>
          </div>
          <label className="ide-settings-toggle ide-settings-current-toggle">
            <div className="ide-settings-toggle-info">
              <span className="ide-settings-toggle-label">Open files in external IDE</span>
              <span className="ide-settings-toggle-description">
                When disabled, files open in Quack's built-in editor (Cmd+E)
              </span>
            </div>
            <input
              type="checkbox"
              checked={fileOpenTarget === 'external'}
              onChange={(e) => useIDEStore.getState().setFileOpenTarget(e.target.checked ? 'external' : 'internal')}
            />
            <span className="ide-settings-toggle-switch" />
          </label>
        </div>
      )}

      {/* IDE Selection Grid */}
      <div className="ide-settings-section">
        <div className="ide-settings-section-header">
          <h4>Select Your IDE</h4>
          {isLoadingApps && <span className="ide-settings-detecting">Detecting...</span>}
        </div>

        <div className="ide-settings-grid">
          {ideApps.map((app) => {
            const isSelected = preferredIDE === app.id;

            return (
              <button
                key={app.id}
                className={`ide-settings-card ${isSelected ? 'selected' : ''}`}
                onClick={() => handleSelectIDE(app.id)}
                title={`Select ${app.name}`}
              >
                <div className="ide-settings-card-icon">
                  <AppIcon app={app} size={32} />
                </div>
                <div className="ide-settings-card-name">{app.name}</div>
                {isSelected && (
                  <div className="ide-settings-card-check">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="#f28c52" />
                      <path d="M5 8l2 2 4-4" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                )}
                {app.id.startsWith('custom-') && (
                  <button
                    className="ide-settings-card-remove"
                    onClick={(e) => handleRemoveCustomIDE(e, app.id)}
                    title="Remove custom IDE"
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M2 2l6 6M8 2l-6 6" />
                    </svg>
                  </button>
                )}
              </button>
            );
          })}
        </div>

        {!isLoadingApps && ideApps.length === 0 && (
          <div className="ide-settings-empty">
            No IDEs detected on your system.
          </div>
        )}

        <button
          className="ide-settings-add-custom-btn"
          onClick={handleAddCustomIDE}
          disabled={isAddingCustomIDE}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 3v12M3 9h12" />
          </svg>
          <span>{isAddingCustomIDE ? 'Adding...' : 'Add Custom IDE'}</span>
        </button>
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
              onChange={(e) => useIDEStore.getState().setAutoLaunch(e.target.checked)}
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
              onChange={(e) => useIDEStore.getState().setSyncFocus(e.target.checked)}
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
          disabled={!preferredIDE}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="3" width="7" height="14" rx="1" />
            <rect x="11" y="3" width="7" height="14" rx="1" />
          </svg>
          <span>Arrange Side-by-Side</span>
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
