import { useEffect, useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import SectionHeader from '../controls/SectionHeader';
import { getCurrentVersion, getBaseVersion } from '../../../utils/version';
import { useUpdateChecker } from '../../../hooks/useUpdateChecker';
import { getTimeSinceLastCheck } from '../../../services/githubReleases';
import ChangelogViewer from '../../ChangelogViewer';

export default function AboutSettings() {
  const [appVersion, setAppVersion] = useState('0.0.0');
  const buildDate = new Date().toLocaleDateString();
  const { updateAvailable, latestRelease, isChecking, checkForUpdates } = useUpdateChecker();
  const [lastCheckTime, setLastCheckTime] = useState('never');

  useEffect(() => {
    getCurrentVersion().then(setAppVersion);
  }, []);

  // Update last check time periodically
  useEffect(() => {
    const updateCheckTime = () => {
      setLastCheckTime(getTimeSinceLastCheck());
    };

    updateCheckTime();
    const interval = setInterval(updateCheckTime, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  const handleCheckForUpdates = async () => {
    await checkForUpdates(true); // Force check
    setLastCheckTime(getTimeSinceLastCheck());
  };

  const handleDownloadUpdate = () => {
    if (latestRelease) {
      open(latestRelease.html_url);
    }
  };

  return (
    <div className="settings-category">
      <SectionHeader title="Quack" description="Multi-agentic terminal powered by Claude Code SDK" />
      <div className="settings-group">
        <div className="about-card">
          <svg className="about-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"/>
            <line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
          <div className="about-title">Quack</div>
          <div className="about-version">Version {appVersion}</div>
          <div className="about-description">
            Multi-agentic terminal emulator powered by Claude Code SDK. Work on multiple projects
            with multiple AI agents simultaneously in a unified workspace.
          </div>
        </div>
      </div>

      {/* Update Banner */}
      {updateAvailable && latestRelease && (
        <div className="settings-group">
          <div
            style={{
              background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
              border: '1px solid rgba(34, 197, 94, 0.3)',
              borderRadius: '12px',
              padding: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <svg
                style={{ width: '24px', height: '24px', color: '#22c55e', flexShrink: 0, marginTop: '2px' }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#22c55e', marginBottom: '4px' }}>
                  Update Available
                </div>
                <div style={{ fontSize: '13px', color: 'rgba(255, 255, 255, 0.7)', marginBottom: '12px' }}>
                  A new version is available: {appVersion} → {getBaseVersion(latestRelease.tag_name)}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleDownloadUpdate}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
                      color: 'white',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(34, 197, 94, 0.3)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    Download {latestRelease.tag_name}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Check for Updates Button */}
      <div className="settings-group">
        <button
          onClick={handleCheckForUpdates}
          disabled={isChecking}
          style={{
            width: '100%',
            padding: '12px 16px',
            borderRadius: '8px',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.9)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: isChecking ? 'not-allowed' : 'pointer',
            opacity: isChecking ? 0.5 : 1,
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
          }}
          onMouseEnter={(e) => {
            if (!isChecking) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }
          }}
          onMouseLeave={(e) => {
            if (!isChecking) {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }
          }}
        >
          {isChecking ? (
            <>
              <svg
                style={{ width: '16px', height: '16px', animation: 'spin 1s linear infinite' }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
              </svg>
              Checking for updates...
            </>
          ) : (
            <>
              <svg
                style={{ width: '16px', height: '16px' }}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
              Check for Updates
              {lastCheckTime !== 'never' && (
                <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)' }}>
                  • Last checked {lastCheckTime}
                </span>
              )}
            </>
          )}
        </button>
      </div>

      <SectionHeader title="Credits" />
      <div className="settings-group">
        <div className="credits-list">
          <div className="credit-item">
            <span className="credit-label">Built by</span>
            <a
              href="https://alekdob.com"
              target="_blank"
              rel="noopener noreferrer"
              className="credit-value"
              style={{
                color: '#3b82f6',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
              onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
              onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
            >
              Alek Dobrohotov
            </a>
          </div>
          <div className="credit-item">
            <span className="credit-label">Built with</span>
            <span className="credit-value">Tauri + React + TypeScript</span>
          </div>
          <div className="credit-item">
            <span className="credit-label">Terminal</span>
            <span className="credit-value">xterm.js + portable-pty</span>
          </div>
          <div className="credit-item">
            <span className="credit-label">AI Integration</span>
            <span className="credit-value">Claude Agent SDK + OpenAI</span>
          </div>
          <div className="credit-item">
            <span className="credit-label">Build Date</span>
            <span className="credit-value">{buildDate}</span>
          </div>
        </div>
      </div>

      <SectionHeader title="Resources" />
      <div className="settings-group">
        <div className="resources-list">
          <div
            className="resource-link"
            onClick={() => open('https://github.com/AlekDob/quack-releases/releases/')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && open('https://github.com/AlekDob/quack-releases/releases/')}
          >
            <svg className="resource-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/>
              <path d="M9 18c-4.51 2-5-2-7-2"/>
            </svg>
            <div>
              <div className="resource-title">GitHub Repository</div>
              <div className="resource-description">View source code and contribute</div>
            </div>
            <svg className="resource-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </div>

          <div
            className="resource-link"
            onClick={() => open('https://www.quack.build/docs')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && open('https://www.quack.build/docs')}
          >
            <svg className="resource-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            </svg>
            <div>
              <div className="resource-title">Documentation</div>
              <div className="resource-description">Learn how to use Quack effectively</div>
            </div>
            <svg className="resource-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </div>

          <div
            className="resource-link"
            onClick={() => open('https://discord.gg/bQd39uDhnc')}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && open('https://discord.gg/bQd39uDhnc')}
          >
            <svg className="resource-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div>
              <div className="resource-title">Discord Community</div>
              <div className="resource-description">Get help and connect with the community</div>
            </div>
            <svg className="resource-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </div>
        </div>
      </div>

      <SectionHeader title="Changelog" description="Release history and updates" />
      <div className="settings-group">
        <ChangelogViewer maxReleases={10} />
      </div>

      <div className="about-footer">
        <p>Built with passion by Alek Dobrohotov</p>
        <p className="about-copyright">© 2025 Quack. All rights reserved.</p>
      </div>
    </div>
  );
}
