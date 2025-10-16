import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';

export function NotificationSettings() {
  const [enabled, setEnabled] = useState(false);
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [ntfyTopic, setNtfyTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [testStatus, setTestStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Load preferences on mount
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

  const handleToggleEnabled = async () => {
    try {
      setLoading(true);
      const newValue = !enabled;
      await invoke('set_mobile_notifications_enabled', { enabled: newValue });
      setEnabled(newValue);
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
    <div className="h-full overflow-y-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold text-gray-100">📱 Mobile Notifications</h2>
          <p className="text-sm text-gray-400">
            Get notified on your iPhone when AI chat responses complete
          </p>
        </div>

        {/* Master Toggle */}
        <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
          <label className="flex items-center justify-between cursor-pointer">
            <div>
              <div className="text-base font-medium text-gray-100">Enable Mobile Notifications</div>
              <div className="text-sm text-gray-400 mt-1">
                Receive push notifications when AI completes responses
              </div>
            </div>
            <button
              onClick={handleToggleEnabled}
              disabled={loading}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                enabled ? 'bg-blue-500' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </label>
        </div>

        {/* Telegram Section */}
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-100">Telegram Bot</h3>
              <p className="text-sm text-gray-400 mt-1">Most reliable option with message history</p>
            </div>
            <a
              href="https://core.telegram.org/bots#6-botfather"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              Setup Guide
            </a>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Bot Token</label>
              <input
                type="password"
                value={telegramToken}
                onChange={(e) => setTelegramToken(e.target.value)}
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Chat ID</label>
              <input
                type="text"
                value={telegramChatId}
                onChange={(e) => setTelegramChatId(e.target.value)}
                placeholder="123456789"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveTelegram}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
              >
                Save Config
              </button>
              <button
                onClick={handleTestTelegram}
                disabled={loading || !telegramToken || !telegramChatId}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
              >
                Test Telegram
              </button>
            </div>
          </div>
        </div>

        {/* ntfy.sh Section */}
        <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-100">ntfy.sh</h3>
              <p className="text-sm text-gray-400 mt-1">Simplest setup, just choose a topic name</p>
            </div>
            <a
              href="https://ntfy.sh"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-400 hover:text-blue-300 underline"
            >
              ntfy.sh Docs
            </a>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Topic Name</label>
              <input
                type="text"
                value={ntfyTopic}
                onChange={(e) => setNtfyTopic(e.target.value)}
                placeholder="quack-alek-ai-2025"
                className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-md text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">
                Choose a unique topic name, then subscribe to it in the ntfy iOS app
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleSaveNtfy}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
              >
                Save Topic
              </button>
              <button
                onClick={handleTestNtfy}
                disabled={loading || !ntfyTopic}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
              >
                Test ntfy.sh
              </button>
            </div>
          </div>
        </div>

        {/* Status Message */}
        {testStatus && (
          <div
            className={`rounded-lg p-4 border ${
              testStatus.type === 'success'
                ? 'bg-green-900/20 border-green-700 text-green-300'
                : 'bg-red-900/20 border-red-700 text-red-300'
            }`}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg">
                {testStatus.type === 'success' ? '✅' : '❌'}
              </span>
              <span className="text-sm">{testStatus.message}</span>
            </div>
          </div>
        )}

        {/* Info Box */}
        <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-4">
          <div className="flex gap-3">
            <span className="text-2xl">💡</span>
            <div className="text-sm text-blue-200 space-y-2">
              <p className="font-medium">Setup Tips:</p>
              <ul className="list-disc list-inside space-y-1 text-blue-300">
                <li>For Telegram: Create a bot via @BotFather, get your Chat ID with getUpdates API</li>
                <li>For ntfy.sh: Install the ntfy app from App Store, subscribe to your topic</li>
                <li>Both channels work in parallel for maximum reliability</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
