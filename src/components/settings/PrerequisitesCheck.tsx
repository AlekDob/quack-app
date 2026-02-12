import { useEffect, useState } from 'react';
import { usePrerequisitesStore, selectShouldShowPrerequisites } from '../../stores/prerequisitesStore';
import { isMacOS } from '../../utils/platform';
import './PrerequisitesCheck.css';

const CLAUDE_INSTALL_CMD = 'sudo npm install -g @anthropic-ai/claude-code';

export default function PrerequisitesCheck() {
  const {
    checkPrerequisites,
    installXcodeCliTools,
    openNodeDownload,
    openClaudeInstallTerminal,
    openLoginTerminal,
    completeOnboarding,
    prerequisites,
    isChecking,
    isInstallingGit,
    isLoggedIn,
    isLoggingIn,
  } = usePrerequisitesStore();

  const shouldShow = usePrerequisitesStore(selectShouldShowPrerequisites);
  const [isClosing, setIsClosing] = useState(false);
  const [installError, setInstallError] = useState<string | null>(null);
  const [gitInstallError, setGitInstallError] = useState<string | null>(null);
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

  const handleRecheck = () => {
    setInstallError(null);
    setGitInstallError(null);
    setLoginError(null);
    checkPrerequisites();
  };

  const handleInstallGit = async () => {
    setGitInstallError(null);

    try {
      await installXcodeCliTools();
    } catch (error) {
      console.error('[Prerequisites Check] Failed to install Xcode CLI Tools:', error);
      setGitInstallError('Failed to launch Xcode CLI Tools installer. Please run "xcode-select --install" manually in your terminal.');
    }
  };

  const handleNodeDownload = async () => {
    try {
      await openNodeDownload();
    } catch (error) {
      console.error('[Prerequisites Check] Failed to open Node.js download page:', error);
    }
  };

  const handleInstallClaudeCLI = async () => {
    setInstallError(null);

    try {
      // Copy command to clipboard as backup
      try {
        await navigator.clipboard.writeText(CLAUDE_INSTALL_CMD);
      } catch {
        // ignore clipboard error
      }
      // Open terminal with sudo install command
      await openClaudeInstallTerminal();
    } catch (error) {
      console.error('[Prerequisites Check] Failed to install Claude CLI:', error);
      setInstallError('Failed to open terminal. Run manually: ' + CLAUDE_INSTALL_CMD);
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

  const allReady = (prerequisites?.all_installed ?? false) && isLoggedIn;

  // Determine Node.js item state
  const nodeInstalled = prerequisites?.nodejs.installed ?? false;
  const nodeVersionOk = prerequisites?.nodejs.version_satisfied ?? false;
  const nodeOutdated = nodeInstalled && !nodeVersionOk;
  const nodeReady = nodeInstalled && nodeVersionOk;

  // Claude CLI should only be installable when Node.js is installed and version is OK
  const canInstallClaude = nodeReady;

  return (
    <div className={`prerequisites-overlay ${isClosing ? 'closing' : ''}`}>
      <div className="prerequisites-dialog">
        {/* Header */}
        <div className="prerequisites-header">
          <div className="prerequisites-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
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
                {!prerequisites.git.installed && (
                  isMacOS() ? (
                    <button
                      className="prerequisite-action"
                      onClick={handleInstallGit}
                      disabled={isInstallingGit}
                      title="Install via Xcode Command Line Tools"
                    >
                      {isInstallingGit ? (
                        <>
                          <div className="prerequisite-button-spinner" />
                          <span>Installing...</span>
                        </>
                      ) : (
                        'Install'
                      )}
                    </button>
                  ) : (
                    <span className="prerequisite-hint">xcode-select --install</span>
                  )
                )}
              </div>

              {gitInstallError && (
                <div className="prerequisites-error">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                    <path d="M8 4v5M8 11h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                  <span>{gitInstallError}</span>
                </div>
              )}

              {/* Node.js */}
              <div className={`prerequisite-item ${nodeReady ? 'installed' : nodeOutdated ? 'outdated' : 'missing'}`}>
                <div className="prerequisite-status">
                  {nodeReady ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : nodeOutdated ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 8v4M12 16h.01" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M15 9l-6 6M9 9l6 6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="prerequisite-info">
                  <div className="prerequisite-name">
                    {prerequisites.nodejs.name}
                    {prerequisites.nodejs.min_version && !nodeReady && (
                      <span className="prerequisite-min-version">{prerequisites.nodejs.min_version}</span>
                    )}
                  </div>
                  {prerequisites.nodejs.version && (
                    <div className="prerequisite-version">
                      {prerequisites.nodejs.version}
                      {nodeOutdated && <span className="prerequisite-outdated-label"> (update required)</span>}
                    </div>
                  )}
                </div>
                {!nodeReady && (
                  isMacOS() ? (
                    <button
                      className="prerequisite-action"
                      onClick={handleNodeDownload}
                      title="Open Node.js download page"
                    >
                      Download
                    </button>
                  ) : (
                    <span className="prerequisite-hint">
                      {prerequisites.nodejs.download_url ? 'nodejs.org/download' : 'brew install node'}
                    </span>
                  )
                )}
              </div>

              {/* Claude CLI */}
              <div className={`prerequisite-item ${prerequisites.claude_cli.installed ? 'installed' : 'missing'}`}>
                <div className="prerequisite-status">
                  {prerequisites.claude_cli.installed ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
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
                    disabled={!canInstallClaude}
                    title={!canInstallClaude ? 'Node.js >= 18 required' : 'Opens Terminal with install command'}
                  >
                    Install
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
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
                          <circle cx="12" cy="12" r="10" />
                          <path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2">
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
            onClick={handleRecheck}
            disabled={isChecking}
            title="Re-check system requirements"
          >
            {isChecking ? 'Checking...' : 'Re-check'}
          </button>
          {allReady ? (
            <button
              className="prerequisites-continue"
              onClick={handleContinue}
            >
              Continue
            </button>
          ) : (
            <button
              className="prerequisites-skip"
              onClick={handleSkip}
              title="Skip and configure later"
            >
              Skip for now
            </button>
          )}
        </div>

        {/* Footer */}
        {!allReady && (
          <div className="prerequisites-footer">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="5.5" />
              <path d="M7 4.5v3M7 9.5h.01" strokeLinecap="round" />
            </svg>
            <span>Some features may not work without all components installed</span>
          </div>
        )}
      </div>
    </div>
  );
}
