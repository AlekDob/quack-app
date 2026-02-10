import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';
import IOSInput from '../controls/IOSInput';

export default function NotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [ntfyTopic, setNtfyTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const enabledValue = await invoke<boolean>('get_mobile_notifications_enabled');
      setEnabled(enabledValue);

      const topic = await invoke<string | null>('get_ntfy_topic');
      setNtfyTopic(topic || '');
    } catch (err) {
      console.error('Failed to load notification preferences:', err);
    }
  };

  const handleToggleEnabled = async (value: boolean) => {
    try {
      setLoading(true);
      await invoke('set_mobile_notifications_enabled', { enabled: value });
      setEnabled(value);
    } catch (err) {
      console.error('Failed to toggle notifications:', err);
      setTestStatus({ type: 'error', message: 'Failed to update settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNtfy = async () => {
    if (!ntfyTopic.trim()) {
      setTestStatus({ type: 'error', message: 'Please enter a topic name' });
      return;
    }

    try {
      setLoading(true);
      await invoke('set_ntfy_topic', { topic: ntfyTopic.trim() });
      setTestStatus({ type: 'success', message: 'ntfy.sh topic saved!' });
    } catch (err) {
      console.error('Failed to save ntfy topic:', err);
      setTestStatus({ type: 'error', message: 'Failed to save ntfy.sh topic' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestNtfy = async () => {
    try {
      setLoading(true);
      setTestStatus(null);
      const result = await invoke<string>('send_ntfy_test');
      setTestStatus({ type: 'success', message: result });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTestStatus({ type: 'error', message: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-category">
      <SectionHeader
        title="Mobile Notifications"
        description="Get notified on your iPhone when AI chat responses complete"
      />
      <div className="settings-group">
        <SettingsRow
          label="Enable Notifications"
          description="Receive push notifications when AI completes responses"
          control={
            <IOSSwitch
              checked={enabled}
              onChange={handleToggleEnabled}
              disabled={loading}
            />
          }
        />
      </div>

      <SectionHeader
        title="ntfy.sh"
        description="Simplest setup, just choose a topic name"
      />
      <div className="settings-group">
        <SettingsRow
          label="Topic Name"
          description="Choose a unique topic, then subscribe in ntfy iOS app"
          control={
            <IOSInput
              type="text"
              value={ntfyTopic}
              onChange={setNtfyTopic}
              placeholder="quack-alek-ai-2025"
            />
          }
        />
        <div className="notification-actions">
          <button
            onClick={handleSaveNtfy}
            disabled={loading}
            className="ios-button ios-button-primary"
          >
            Save Topic
          </button>
          <button
            onClick={handleTestNtfy}
            disabled={loading || !ntfyTopic}
            className="ios-button ios-button-secondary"
          >
            Test ntfy.sh
          </button>
        </div>
      </div>

      {testStatus && (
        <div className={`notification-status ${testStatus.type === 'success' ? 'success' : 'error'}`}>
          <span className="status-icon">
            {testStatus.type === 'success' ? '\u2713' : '\u2715'}
          </span>
          <span className="status-message">{testStatus.message}</span>
        </div>
      )}
    </div>
  );
}
