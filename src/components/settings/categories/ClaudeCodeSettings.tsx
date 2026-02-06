import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import ClaudeAuthSettings from '../../ClaudeAuthSettings';
import AuthDebugPanel from '../../AuthDebugPanel';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';

export default function ClaudeCodeSettings() {
  const [agentTeamsEnabled, setAgentTeamsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEnvVars();
  }, []);

  const loadEnvVars = async () => {
    try {
      const envVars = await invoke<Record<string, string>>('get_claude_env_vars');
      setAgentTeamsEnabled(envVars['CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS'] === '1');
    } catch (err) {
      console.error('Failed to load Claude env vars:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAgentTeams = async (enabled: boolean) => {
    setAgentTeamsEnabled(enabled);
    try {
      await invoke('set_claude_env_var', {
        key: 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
        value: enabled ? '1' : null,
      });
    } catch (err) {
      console.error('Failed to save Agent Teams setting:', err);
      setAgentTeamsEnabled(!enabled);
    }
  };

  return (
    <div className="settings-category">
      {/* Claude Authentication */}
      <SectionHeader
        title="Claude Integration"
        description="Authenticate with Claude to enable AI-powered features"
      />
      <div className="settings-group">
        <ClaudeAuthSettings />
      </div>

      {/* Experimental Features */}
      <SectionHeader
        title="Experimental Features"
        description="Enable experimental Claude Code features (written to ~/.claude/settings.json)"
      />
      <div className="settings-group">
        <SettingsRow
          label="Agent Teams"
          description="Coordinate multiple Claude Code sessions working in parallel as a team. Quack provides the visual layer."
          control={
            <IOSSwitch
              checked={agentTeamsEnabled}
              onChange={handleToggleAgentTeams}
              disabled={loading}
            />
          }
        />
      </div>

      {/* Debug Panel */}
      <SectionHeader
        title="Authentication Debug"
        description="Diagnostic information for troubleshooting authentication issues"
      />
      <div className="settings-group">
        <AuthDebugPanel />
      </div>
    </div>
  );
}
