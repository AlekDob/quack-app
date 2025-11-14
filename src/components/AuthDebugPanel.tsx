import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import './AuthDebugPanel.css';

interface DebugInfo {
  // Environment
  anthropicApiKey: boolean;
  claudeCodeUseBedrock: boolean;
  claudeCodeUseVertex: boolean;
  nodeVersion: string;
  platform: string;

  // Claude CLI
  cliAvailable: boolean;
  cliPath: string | null;
  cliVersion: string | null;

  // Credentials
  credentialsPath: string | null;
  credentialsExists: boolean;
  credentialsValid: boolean;

  // SDK
  sdkVersion: string;
  lastError: string | null;
}

export default function AuthDebugPanel() {
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const collectDebugInfo = async () => {
    setRefreshing(true);
    try {
      // Collect all debug information via Tauri commands
      const info = await invoke<DebugInfo>('get_auth_debug_info');
      setDebugInfo(info);
    } catch (error) {
      console.error('Failed to collect debug info:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    collectDebugInfo();
  }, []);

  const copyToClipboard = async () => {
    if (!debugInfo) return;

    const text = `
Quack Authentication Debug Info
================================

Environment Variables:
- ANTHROPIC_API_KEY: ${debugInfo.anthropicApiKey ? 'Set' : 'Not set'}
- CLAUDE_CODE_USE_BEDROCK: ${debugInfo.claudeCodeUseBedrock ? 'Yes' : 'No'}
- CLAUDE_CODE_USE_VERTEX: ${debugInfo.claudeCodeUseVertex ? 'Yes' : 'No'}

System:
- Node.js: ${debugInfo.nodeVersion}
- Platform: ${debugInfo.platform}

Claude CLI:
- Available: ${debugInfo.cliAvailable ? 'Yes' : 'No'}
- Path: ${debugInfo.cliPath || 'Not found'}
- Version: ${debugInfo.cliVersion || 'N/A'}

Credentials:
- Path: ${debugInfo.credentialsPath || 'N/A'}
- File exists: ${debugInfo.credentialsExists ? 'Yes' : 'No'}
- Valid: ${debugInfo.credentialsValid ? 'Yes' : 'No'}

Claude Agent SDK:
- Version: ${debugInfo.sdkVersion}
- Last error: ${debugInfo.lastError || 'None'}
    `.trim();

    await navigator.clipboard.writeText(text);
  };

  const openCredentialsFile = async () => {
    if (!debugInfo?.credentialsPath) return;

    try {
      await invoke('open_file_externally', { path: debugInfo.credentialsPath });
    } catch (error) {
      console.error('Failed to open credentials file:', error);
      alert(`Failed to open file: ${error}`);
    }
  };

  if (loading) {
    return (
      <div className="auth-debug-panel">
        <div className="debug-loading">
          <div className="spinner" />
          <p>Collecting debug information...</p>
        </div>
      </div>
    );
  }

  if (!debugInfo) {
    return (
      <div className="auth-debug-panel">
        <p className="debug-error">Failed to collect debug information</p>
      </div>
    );
  }

  return (
    <div className="auth-debug-panel">
      <div className="debug-header">
        <h3>Authentication Debug Info</h3>
        <div className="debug-actions">
          <button
            onClick={collectDebugInfo}
            disabled={refreshing}
            className="debug-button"
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <button
            onClick={copyToClipboard}
            className="debug-button primary"
          >
            Copy to Clipboard
          </button>
        </div>
      </div>

      <div className="debug-section">
        <h4>Environment Variables</h4>
        <div className="debug-grid">
          <div className="debug-item">
            <span className="debug-label">ANTHROPIC_API_KEY</span>
            <span className={`debug-value ${debugInfo.anthropicApiKey ? 'success' : 'error'}`}>
              {debugInfo.anthropicApiKey ? 'Set' : 'Not set'}
            </span>
          </div>
          <div className="debug-item">
            <span className="debug-label">CLAUDE_CODE_USE_BEDROCK</span>
            <span className="debug-value">
              {debugInfo.claudeCodeUseBedrock ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="debug-item">
            <span className="debug-label">CLAUDE_CODE_USE_VERTEX</span>
            <span className="debug-value">
              {debugInfo.claudeCodeUseVertex ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      </div>

      <div className="debug-section">
        <h4>System Information</h4>
        <div className="debug-grid">
          <div className="debug-item">
            <span className="debug-label">Node.js Version</span>
            <span className="debug-value">{debugInfo.nodeVersion}</span>
          </div>
          <div className="debug-item">
            <span className="debug-label">Platform</span>
            <span className="debug-value">{debugInfo.platform}</span>
          </div>
        </div>
      </div>

      <div className="debug-section">
        <h4>Claude CLI</h4>
        <div className="debug-grid">
          <div className="debug-item">
            <span className="debug-label">CLI Available</span>
            <span className={`debug-value ${debugInfo.cliAvailable ? 'success' : 'error'}`}>
              {debugInfo.cliAvailable ? 'Yes' : 'No'}
            </span>
          </div>
          {debugInfo.cliPath && (
            <div className="debug-item full-width">
              <span className="debug-label">CLI Path</span>
              <span className="debug-value mono">{debugInfo.cliPath}</span>
            </div>
          )}
          {debugInfo.cliVersion && (
            <div className="debug-item">
              <span className="debug-label">CLI Version</span>
              <span className="debug-value">{debugInfo.cliVersion}</span>
            </div>
          )}
        </div>
      </div>

      <div className="debug-section">
        <h4>Credentials</h4>
        <div className="debug-grid">
          {debugInfo.credentialsPath && (
            <div className="debug-item full-width">
              <div className="debug-item-header">
                <span className="debug-label">Credentials Path</span>
                <button
                  onClick={openCredentialsFile}
                  className="open-file-button"
                  title="Open credentials file"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                    <line x1="12" y1="18" x2="12" y2="12" />
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </svg>
                </button>
              </div>
              <span className="debug-value mono">{debugInfo.credentialsPath}</span>
            </div>
          )}
          <div className="debug-item">
            <span className="debug-label">File Exists</span>
            <span className={`debug-value ${debugInfo.credentialsExists ? 'success' : 'warning'}`}>
              {debugInfo.credentialsExists ? 'Yes' : 'No'}
            </span>
          </div>
          <div className="debug-item">
            <span className="debug-label">Valid Credentials</span>
            <span className={`debug-value ${debugInfo.credentialsValid ? 'success' : 'error'}`}>
              {debugInfo.credentialsValid ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
      </div>

      <div className="debug-section">
        <h4>Claude Agent SDK</h4>
        <div className="debug-grid">
          <div className="debug-item">
            <span className="debug-label">SDK Version</span>
            <span className="debug-value">{debugInfo.sdkVersion}</span>
          </div>
          {debugInfo.lastError && (
            <div className="debug-item full-width">
              <span className="debug-label">Last Error</span>
              <span className="debug-value error">{debugInfo.lastError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
