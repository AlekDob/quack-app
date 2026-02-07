import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSInput from '../controls/IOSInput';

interface IntegrationsSettingsProps {
  onOpenTelegramSetup?: () => void;
}

export default function IntegrationsSettings({ onOpenTelegramSetup }: IntegrationsSettingsProps) {
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    loadTelegramConfig();
  }, []);

  const loadTelegramConfig = async () => {
    try {
      const [token, chatId] = await invoke<[string | null, string | null]>('get_telegram_config');
      setTelegramToken(token || '');
      setTelegramChatId(chatId || '');
    } catch (err) {
      console.error('Failed to load Telegram config:', err);
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

  return (
    <div className="settings-category">
      <SectionHeader
        title="Telegram"
        description="Connect Telegram for agent notifications and message history"
      />

      {onOpenTelegramSetup && (
        <div className="settings-group">
          <SettingsRow
            label="Quick Setup"
            description="Link your Telegram account with the guided setup wizard"
            control={
              <button
                onClick={onOpenTelegramSetup}
                className="ios-button ios-button-primary"
              >
                Link Telegram
              </button>
            }
          />
        </div>
      )}

      <SectionHeader
        title="Manual Configuration"
        description="Or configure manually with Bot Token and Chat ID"
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
