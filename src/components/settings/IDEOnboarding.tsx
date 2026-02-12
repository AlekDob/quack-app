import { useEffect, useMemo, useRef, useState } from 'react';
import { useIDEStore, selectShouldShowOnboarding } from '../../stores/ideStore';
import type { InstalledApp } from '../../stores/ideStore';
import './IDEOnboarding.css';

// App icon - uses real icon from Rust backend, with SVG fallback
const AppIcon = ({ app, size = 40 }: { app: InstalledApp; size?: number }) => {
  if (app.icon_base64) {
    return (
      <img
        src={`data:image/png;base64,${app.icon_base64}`}
        alt={app.name}
        width={size}
        height={size}
        style={{ borderRadius: '8px' }}
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

export default function IDEOnboarding() {
  const isLoadingApps = useIDEStore((s) => s.isLoadingApps);
  const loadInstalledApps = useIDEStore((s) => s.loadInstalledApps);
  const setPreferredIDE = useIDEStore((s) => s.setPreferredIDE);
  const completeOnboarding = useIDEStore((s) => s.completeOnboarding);

  const shouldShow = useIDEStore(selectShouldShowOnboarding);
  const installedApps = useIDEStore(s => s.installedApps);
  const [isClosing, setIsClosing] = useState(false);
  const [selectedIDE, setSelectedIDE] = useState<string | null>(null);

  // Memoize filtered IDE apps to avoid new array reference each render
  const ideApps = useMemo(
    () => installedApps.filter(a => a.category === 'ide'),
    [installedApps]
  );

  // Load installed apps once when onboarding is shown
  const hasLoadedRef = useRef(false);
  useEffect(() => {
    if (shouldShow && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      loadInstalledApps();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldShow]);

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

  // Find the selected app for the button label
  const selectedApp = ideApps.find(a => a.id === selectedIDE);

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
          {isLoadingApps ? (
            <div className="ide-onboarding-loading">
              <div className="ide-onboarding-spinner" />
              <span>Detecting installed IDEs...</span>
            </div>
          ) : (
            ideApps.map((app) => {
              const isSelected = selectedIDE === app.id;

              return (
                <button
                  key={app.id}
                  className={`ide-onboarding-card ${isSelected ? 'selected' : ''}`}
                  onClick={() => setSelectedIDE(app.id)}
                >
                  <div className="ide-onboarding-card-icon">
                    <AppIcon app={app} size={40} />
                  </div>
                  <div className="ide-onboarding-card-name">{app.name}</div>
                  {isSelected && (
                    <div className="ide-onboarding-card-check">
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="9" fill="#f28c52" />
                        <path d="M6 10l3 3 5-6" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>

        {!isLoadingApps && ideApps.length === 0 && (
          <div className="ide-onboarding-loading">
            <span>No IDEs detected on your system.</span>
          </div>
        )}

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
            Continue with {selectedApp?.name || 'selected IDE'}
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
