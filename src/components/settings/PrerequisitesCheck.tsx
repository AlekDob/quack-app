import { useEffect, useState } from 'react';
import { usePrerequisitesStore, selectShouldShowPrerequisites } from '../../stores/prerequisitesStore';
import './PrerequisitesCheck.css';

export default function PrerequisitesCheck() {
  const {
    checkPrerequisites,
    installClaudeCLI,
    openLoginTerminal,
    completeOnboarding,
    prerequisites,
    isChecking,
    isInstalling,
    isLoggedIn,
    isLoggingIn,
  } = usePrerequisitesStore();

  const shouldShow = usePrerequisitesStore(selectShouldShowPrerequisites);
  const [isClosing, setIsClosing] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Check prerequisites on mount
  useEffect(() => {
    if (shouldShow) {
      checkPrerequisites();
    }
  }, [shouldShow, checkPrerequisites]);

  if (!shouldShow) {
    return null;
  }

  const handleInstallClaudeCLI = async () => {
    setInstallError(null);

    try {
      await installClaudeCLI();
    } catch (error) {
      console.error('[Prerequisites Check] Failed to install Claude CLI:', error);
      setInstallError('Failed to install Claude CLI. Please try installing manually.');
    }
  };

  const handleOpenLogin = async () => {
    setLoginError(null);

    try {
      await openLoginTerminal();
    } catch (error) {
      console.error('[Prerequisites Check] Failed to open login terminal:', error);
      setLoginError('Failed to open terminal. Please run "claude login" manually in your terminal.');
    }
  };

  const handleContinue = () => {
    if (prerequisites?.all_installed && isLoggedIn) {
      completeOnboarding();
      handleClose();
    }
  };

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      setIsClosing(false);
    }, 250);
  };

  const handleOpenURL = (url: string) => {
    window.open(url, '_blank');
  };

  const canContinue = (prerequisites?.all_installed ?? false) && isLoggedIn;

  return (
    <div className={`prerequisites-overlay ${isClosing ? 'closing' : ''}`}>
      <div className="prerequisites-dialog">
        {/* Header */}
        <div className="prerequisites-header">
          <div className="prerequisites-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
            </svg>
          </div>
          <h2>System Requirements Check</h2>
          <p>
            Quack requires the following tools to be installed. We'll check your system and help you install any missing components.
          </p>
        </div>

        {/* Prerequisites List */}
        <div className="prerequisites-list">
          {isChecking ? (
            <div className="prerequisites-loading">
              <div className="prerequisites-spinner" />
              <span>Checking system requirements...</span>
            </div>
          ) : prerequisites ? (
            <>
              {/* Git */}
              <div className={`prerequisite-item ${prerequisites.git.installed ? 'installed' : 'missing'}`}>
                <div className="prerequisite-status">
                  {prerequisites.git.installed ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="prerequisite-info">
                  <div className="prerequisite-name">{prerequisites.git.name}</div>
                  {prerequisites.git.version && (
                    <div className="prerequisite-version">{prerequisites.git.version}</div>
                  )}
                </div>
                {!prerequisites.git.installed && prerequisites.git.download_url && (
                  <button
                    className="prerequisite-action"
                    onClick={() => handleOpenURL(prerequisites.git.download_url!)}
                  >
                    Download
                  </button>
                )}
              </div>

              {/* Node.js */}
              <div className={`prerequisite-item ${prerequisites.nodejs.installed ? 'installed' : 'missing'}`}>
                <div className="prerequisite-status">
                  {prerequisites.nodejs.installed ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="prerequisite-info">
                  <div className="prerequisite-name">{prerequisites.nodejs.name}</div>
                  {prerequisites.nodejs.version && (
                    <div className="prerequisite-version">{prerequisites.nodejs.version}</div>
                  )}
                </div>
                {!prerequisites.nodejs.installed && prerequisites.nodejs.download_url && (
                  <button
                    className="prerequisite-action"
                    onClick={() => handleOpenURL(prerequisites.nodejs.download_url!)}
                  >
                    Download
                  </button>
                )}
              </div>

              {/* Claude CLI */}
              <div className={`prerequisite-item ${prerequisites.claude_cli.installed ? 'installed' : 'missing'}`}>
                <div className="prerequisite-status">
                  {prerequisites.claude_cli.installed ? (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="prerequisite-info">
                  <div className="prerequisite-name">{prerequisites.claude_cli.name}</div>
                  {prerequisites.claude_cli.version && (
                    <div className="prerequisite-version">{prerequisites.claude_cli.version}</div>
                  )}
                </div>
                {!prerequisites.claude_cli.installed && (
                  <button
                    className="prerequisite-action"
                    onClick={handleInstallClaudeCLI}
                    disabled={isInstalling || !prerequisites.nodejs.installed}
                    title={!prerequisites.nodejs.installed ? 'Node.js required' : 'Install via npm'}
                  >
                    {isInstalling ? (
                      <>
                        <div className="prerequisite-button-spinner" />
                        <span>Installing...</span>
                      </>
                    ) : (
                      'Install'
                    )}
                  </button>
                )}
              </div>

              {/* Claude Authentication Status */}
              {prerequisites?.claude_cli.installed && (
                <>
                  <div className="prerequisites-auth-divider">
                    <span>Authentication</span>
                  </div>
                  <div className={`prerequisite-item ${isLoggedIn ? 'installed' : 'missing'}`}>
                    <div className="prerequisite-status">
                      {isLoggedIn ? (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                    <div className="prerequisite-info">
                      <div className="prerequisite-name">Claude Account</div>
                      <div className="prerequisite-version">
                        {isLoggedIn ? 'Authenticated' : 'Login required'}
                      </div>
                    </div>
                    {!isLoggedIn && (
                      <button
                        className="prerequisite-action"
                        onClick={handleOpenLogin}
                        disabled={isLoggingIn}
                      >
                        {isLoggingIn ? (
                          <>
                            <div className="prerequisite-button-spinner" />
                            <span>Opening...</span>
                          </>
                        ) : (
                          'Login'
                        )}
                      </button>
                    )}
                  </div>

                  {isLoggingIn && !isLoggedIn && (
                    <div className="prerequisites-auth-hint">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M8 4v5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span>Complete the login in your terminal, then click "Re-check" below.</span>
                    </div>
                  )}

                  {loginError && (
                    <div className="prerequisites-error">
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M8 4v5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      <span>{loginError}</span>
                    </div>
                  )}
                </>
              )}

              {installError && (
                <div className="prerequisites-error">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 4v5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>{installError}</span>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* Actions */}
        <div className="prerequisites-actions">
          <button
            className="prerequisites-refresh"
            onClick={checkPrerequisites}
            disabled={isChecking}
            title="Re-check system requirements"
          >
            {isChecking ? 'Checking...' : 'Re-check'}
          </button>
          <button
            className="prerequisites-continue"
            onClick={handleContinue}
            disabled={!canContinue}
          >
            Continue
          </button>
        </div>

        {/* Footer */}
        <div className="prerequisites-footer">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="7" cy="7" r="5.5" />
            <path d="M7 4.5v3M7 9.5h.01" strokeLinecap="round" />
          </svg>
          <span>All components must be installed and authenticated to continue</span>
        </div>
      </div>
    </div>
  );
}
