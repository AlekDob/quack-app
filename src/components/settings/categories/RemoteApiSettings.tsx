import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';
import type { RemoteApiConfig } from '../../../types';

export default function RemoteApiSettings() {
  const [config, setConfig] = useState<RemoteApiConfig | null>(null);
  const [localIp, setLocalIp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<'token' | 'url' | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadConfig = useCallback(async () => {
    try {
      const cfg = await invoke<RemoteApiConfig>('get_remote_config');
      setConfig(cfg);
      const ip = await invoke<string | null>('get_local_ip');
      setLocalIp(ip);
    } catch (err) {
      console.error('Failed to load remote config:', err);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleToggleEnabled = async (value: boolean) => {
    try {
      setLoading(true);
      setStatus(null);
      const updated = await invoke<RemoteApiConfig>('set_remote_enabled', { enabled: value });
      setConfig(updated);
      setStatus({
        type: 'success',
        message: value
          ? 'Remote API enabled. Restart Quack to apply network binding.'
          : 'Remote API disabled. Restart Quack to apply.',
      });
    } catch (err) {
      console.error('Failed to toggle remote API:', err);
      setStatus({ type: 'error', message: 'Failed to update settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleRegenerateToken = async () => {
    try {
      setLoading(true);
      setStatus(null);
      const updated = await invoke<RemoteApiConfig>('regenerate_remote_token');
      setConfig(updated);
      setStatus({ type: 'success', message: 'Token regenerated. Update your mobile clients.' });
    } catch (err) {
      console.error('Failed to regenerate token:', err);
      setStatus({ type: 'error', message: 'Failed to regenerate token' });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async (text: string, label: 'token' | 'url') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    }
  };

  if (!config) {
    return (
      <div className="settings-category">
        <SectionHeader title="Remote API" description="Loading..." />
      </div>
    );
  }

  const apiUrl = localIp
    ? `http://${localIp}:${config.port}/api`
    : `http://127.0.0.1:${config.port}/api`;

  const maskedToken = config.token
    ? `${config.token.slice(0, 6)}${'*'.repeat(20)}${config.token.slice(-6)}`
    : 'Not generated';

  return (
    <div className="settings-category">
      <SectionHeader
        title="Remote API"
        description="Access Quack from your phone, external tools, or automation platforms via REST API"
      />

      <div className="settings-group">
        <SettingsRow
          label="Enable Remote Access"
          description="Bind to 0.0.0.0 to allow LAN access (restart required)"
          control={
            <IOSSwitch
              checked={config.enabled}
              onChange={handleToggleEnabled}
              disabled={loading}
            />
          }
        />
        <SettingsRow
          label="Port"
          description="HTTP server port for the API"
          control={
            <span className="settings-status-value">{config.port}</span>
          }
        />
      </div>

      <SectionHeader
        title="Authentication"
        description="Bearer token required for all API requests"
      />

      <div className="settings-group">
        <SettingsRow
          label="API Token"
          description={
            <span className="remote-api-token-display">
              <code className="remote-api-token-code">{maskedToken}</code>
            </span>
          }
          control={
            <div className="remote-api-token-actions">
              {config.token && (
                <button
                  onClick={() => handleCopy(config.token!, 'token')}
                  className="ios-button ios-button-secondary"
                  disabled={loading}
                >
                  {copied === 'token' ? 'Copied!' : 'Copy'}
                </button>
              )}
              <button
                onClick={handleRegenerateToken}
                className="ios-button ios-button-secondary"
                disabled={loading}
              >
                Regenerate
              </button>
            </div>
          }
        />
      </div>

      <SectionHeader
        title="Connection"
        description="Use these details to connect from mobile or external tools"
      />

      <div className="settings-group">
        <SettingsRow
          label="API Base URL"
          description={
            <code className="remote-api-url-display">{apiUrl}</code>
          }
          control={
            <button
              onClick={() => handleCopy(apiUrl, 'url')}
              className="ios-button ios-button-secondary"
              disabled={loading}
            >
              {copied === 'url' ? 'Copied!' : 'Copy URL'}
            </button>
          }
        />
        <SettingsRow
          label="Local IP"
          description="Your machine's LAN address"
          control={
            <span className="settings-status-value">
              {localIp || 'Not available'}
            </span>
          }
        />
        <SettingsRow
          label="Status"
          description="Current API availability"
          control={
            <span className={`remote-api-status-badge ${config.enabled ? 'active' : 'inactive'}`}>
              {config.enabled ? 'LAN accessible' : 'Localhost only'}
            </span>
          }
        />
      </div>

      <SectionHeader
        title="Available Endpoints"
        description="REST API reference for integrations"
      />

      <div className="settings-group">
        <div className="remote-api-endpoints">
          <div className="remote-api-endpoint">
            <span className="remote-api-method get">GET</span>
            <span className="remote-api-path">/api/status</span>
            <span className="remote-api-desc">Health check and overview</span>
          </div>
          <div className="remote-api-endpoint">
            <span className="remote-api-method get">GET</span>
            <span className="remote-api-path">/api/agents</span>
            <span className="remote-api-desc">List all agents</span>
          </div>
          <div className="remote-api-endpoint">
            <span className="remote-api-method get">GET</span>
            <span className="remote-api-path">/api/sessions</span>
            <span className="remote-api-desc">List all sessions</span>
          </div>
          <div className="remote-api-endpoint">
            <span className="remote-api-method get">GET</span>
            <span className="remote-api-path">/api/jobs</span>
            <span className="remote-api-desc">List automation jobs</span>
          </div>
          <div className="remote-api-endpoint">
            <span className="remote-api-method post">POST</span>
            <span className="remote-api-path">/api/jobs/:id/fire</span>
            <span className="remote-api-desc">Fire a job manually</span>
          </div>
          <div className="remote-api-endpoint">
            <span className="remote-api-method post">POST</span>
            <span className="remote-api-path">/api/execute</span>
            <span className="remote-api-desc">Execute agent prompt</span>
          </div>
        </div>
      </div>

      <div className="settings-group">
        <div className="settings-info-box">
          <svg className="info-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 16v-4"/>
            <path d="M12 8h.01"/>
          </svg>
          <span>
            All requests require <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', color: '#60a5fa' }}>Authorization: Bearer {'<token>'}</code> header.
            The token is generated locally and never leaves your machine.
          </span>
        </div>
      </div>

      {status && (
        <div className={`notification-status ${status.type === 'success' ? 'success' : 'error'}`}>
          <span className="status-icon">
            {status.type === 'success' ? '\u2713' : '\u2715'}
          </span>
          <span className="status-message">{status.message}</span>
        </div>
      )}
    </div>
  );
}
