import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSSwitch from '../controls/IOSSwitch';
import IOSInput from '../controls/IOSInput';

export default function NotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
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

      const [token, chatId] = await invoke<[string | null, string | null]>('get_telegram_config');
      setTelegramToken(token || '');
      setTelegramChatId(chatId || '');

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

  const handleSaveTelegram = async () => {
    if (!telegramToken.trim() || !telegramChatId.trim()) {
      setTestStatus({ type: 'error', message: 'Please fill in both Token and Chat ID' });
      return;
    }

    try {
      setLoading(true);
      await invoke('set_telegram_config', {
        token: telegramToken.trim(),
        chatId: telegramChatId.trim(),
      });
      setTestStatus({ type: 'success', message: 'Telegram settings saved!' });
    } catch (err) {
      console.error('Failed to save Telegram config:', err);
      setTestStatus({ type: 'error', message: 'Failed to save Telegram settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleTestTelegram = async () => {
    try {
      setLoading(true);
      setTestStatus(null);
      const result = await invoke<string>('send_telegram_test');
      setTestStatus({ type: 'success', message: result });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setTestStatus({ type: 'error', message: errorMsg });
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
        title="Telegram Bot"
        description="Most reliable option with message history"
      />
      <div className="settings-group">
        <SettingsRow
          label="Bot Token"
          description="Get from @BotFather on Telegram"
          control={
            <IOSInput
              type="password"
              value={telegramToken}
              onChange={setTelegramToken}
              placeholder="123456789:ABC..."
            />
          }
        />
        <SettingsRow
          label="Chat ID"
          description="Your Telegram chat identifier"
          control={
            <IOSInput
              type="text"
              value={telegramChatId}
              onChange={setTelegramChatId}
              placeholder="123456789"
            />
          }
        />
        <div className="notification-actions">
          <button
            onClick={handleSaveTelegram}
            disabled={loading}
            className="ios-button ios-button-primary"
          >
            Save Config
          </button>
          <button
            onClick={handleTestTelegram}
            disabled={loading || !telegramToken || !telegramChatId}
            className="ios-button ios-button-secondary"
          >
            Test Telegram
          </button>
        </div>
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

      {/* Status Message */}
      {testStatus && (
        <div className={`notification-status ${testStatus.type === 'success' ? 'success' : 'error'}`}>
          <span className="status-icon">
            {testStatus.type === 'success' ? '✓' : '✕'}
          </span>
          <span className="status-message">{testStatus.message}</span>
        </div>
      )}
    </div>
  );
}
