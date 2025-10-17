import SectionHeader from '../controls/SectionHeader';

export default function AboutSettings() {
  const appVersion = '1.0.0'; // TODO: Get from Tauri config or package.json
  const buildDate = new Date().toLocaleDateString();

  return (
    <div className="settings-category">
      <SectionHeader title="Quack" description="Multi-agentic terminal emulator" />
      <div className="settings-group">
        <div className="about-card">
          <svg className="about-logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 17 10 11 4 5"/>
            <line x1="12" y1="19" x2="20" y2="19"/>
          </svg>
          <div className="about-title">Quack</div>
          <div className="about-version">Version {appVersion}</div>
          <div className="about-description">
            A powerful multi-terminal emulator with integrated AI assistance,
            built with Tauri and React.
          </div>
        </div>
      </div>

      <SectionHeader title="Credits" />
      <div className="settings-group">
        <div className="credits-list">
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
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="resource-link"
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
          </a>

          <a
            href="https://docs.claude.com/en/api/agent-sdk/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="resource-link"
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
          </a>

          <a
            href="mailto:support@quack.app"
            className="resource-link"
          >
            <svg className="resource-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            <div>
              <div className="resource-title">Support</div>
              <div className="resource-description">Get help and report issues</div>
            </div>
            <svg className="resource-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="5" y1="12" x2="19" y2="12"/>
              <polyline points="12 5 19 12 12 19"/>
            </svg>
          </a>
        </div>
      </div>

      <div className="about-footer">
        <p>Made with love by Quack Agency</p>
        <p className="about-copyright">© 2025 Quack. All rights reserved.</p>
      </div>
    </div>
  );
}
