import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import SectionHeader from '../controls/SectionHeader';
import SettingsRow from '../controls/SettingsRow';
import IOSInput from '../controls/IOSInput';

type ImageModel = 'gpt-image-1.5' | 'gpt-image-1' | 'gpt-image-1-mini' | 'dall-e-3';

export default function AIAssistantSettings() {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo'>('gpt-4o-mini');
  const [imageModel, setImageModel] = useState<ImageModel>('gpt-image-1.5');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadSavedSettings();
  }, []);

  const loadSavedSettings = async () => {
    try {
      const savedKey = await invoke<string | null>('get_ai_api_key');
      if (savedKey) {
        const decoded = atob(savedKey);
        setApiKey(decoded);
      }

      const savedModel = await invoke<string>('get_ai_model');
      setModel(savedModel as typeof model);

      const savedImageModel = await invoke<string>('get_image_model');
      setImageModel(savedImageModel as ImageModel);
    } catch (err) {
      console.error('Failed to load saved AI settings:', err);
    }
  };

  const handleSaveAndTest = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('Please enter an API key');
      setTestResult('error');
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      setErrorMessage('Invalid API key format. OpenAI keys start with "sk-"');
      setTestResult('error');
      return;
    }

    setTesting(true);
    setTestResult(null);
    setErrorMessage('');

    try {
      await invoke('save_api_key', { key: apiKey });
      await invoke('set_ai_model', { model });
      await invoke('set_image_model', { model: imageModel });

      const connected = await invoke<boolean>('test_api_connection');

      if (connected) {
        setTestResult('success');
        setErrorMessage('');
      } else {
        setTestResult('error');
        setErrorMessage('Connection test failed. Please check your API key.');
      }
    } catch (err) {
      setTestResult('error');
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="settings-category">
      {/* OpenAI Section */}
      <SectionHeader
        title="OpenAI API Key"
        description="Your API key is stored locally and encrypted. Get your key from OpenAI Platform."
      />
      <div className="settings-group">
        <SettingsRow
          label="API Key"
          description="Enter your OpenAI API key (starts with sk-)"
          control={
            <IOSInput
              type="text"
              value={apiKey}
              onChange={setApiKey}
              placeholder="sk-..."
              spellCheck={false}
            />
          }
        />
        <div className="notification-actions">
          <button
            className="ios-button ios-button-primary"
            onClick={handleSaveAndTest}
            disabled={testing}
          >
            {testing ? 'Testing...' : 'Save & Test'}
          </button>
        </div>

        {testResult === 'success' && (
          <div className="notification-status success">
            <span className="status-icon">✓</span>
            <span className="status-message">Connected successfully!</span>
          </div>
        )}

        {testResult === 'error' && (
          <div className="notification-status error">
            <span className="status-icon">✕</span>
            <span className="status-message">{errorMessage || 'Connection failed'}</span>
          </div>
        )}
      </div>

      {/* Model Selection */}
      <SectionHeader
        title="AI Model"
        description="Choose the model for AI suggestions. gpt-4o-mini is recommended for best cost/performance."
      />
      <div className="settings-group">
        <div className="ai-model-options">
          <label className="ai-model-option">
            <input
              type="radio"
              name="model"
              value="gpt-4o-mini"
              checked={model === 'gpt-4o-mini'}
              onChange={(e) => setModel(e.target.value as typeof model)}
            />
            <div className="ai-model-info">
              <div className="ai-model-name">GPT-4o Mini</div>
              <div className="ai-model-desc">Fast & economical (~$0.15/1M tokens)</div>
              <div className="ai-model-badge ai-model-badge-recommended">Recommended</div>
            </div>
          </label>

          <label className="ai-model-option">
            <input
              type="radio"
              name="model"
              value="gpt-4o"
              checked={model === 'gpt-4o'}
              onChange={(e) => setModel(e.target.value as typeof model)}
            />
            <div className="ai-model-info">
              <div className="ai-model-name">GPT-4o</div>
              <div className="ai-model-desc">Most capable (~$2.50/1M tokens)</div>
            </div>
          </label>

          <label className="ai-model-option">
            <input
              type="radio"
              name="model"
              value="gpt-3.5-turbo"
              checked={model === 'gpt-3.5-turbo'}
              onChange={(e) => setModel(e.target.value as typeof model)}
            />
            <div className="ai-model-info">
              <div className="ai-model-name">GPT-3.5 Turbo</div>
              <div className="ai-model-desc">Budget option (~$0.50/1M tokens)</div>
            </div>
          </label>
        </div>
      </div>

      {/* Image Generation Model */}
      <SectionHeader
        title="Image Generation Model"
        description="Choose the model for image generation skills. gpt-image-1.5 is the latest and most capable."
      />
      <div className="settings-group">
        <div className="ai-model-options">
          <label className="ai-model-option">
            <input
              type="radio"
              name="imageModel"
              value="gpt-image-1.5"
              checked={imageModel === 'gpt-image-1.5'}
              onChange={(e) => setImageModel(e.target.value as ImageModel)}
            />
            <div className="ai-model-info">
              <div className="ai-model-name">GPT Image 1.5</div>
              <div className="ai-model-desc">Latest, best photorealism & text rendering</div>
              <div className="ai-model-badge ai-model-badge-recommended">Recommended</div>
            </div>
          </label>

          <label className="ai-model-option">
            <input
              type="radio"
              name="imageModel"
              value="gpt-image-1"
              checked={imageModel === 'gpt-image-1'}
              onChange={(e) => setImageModel(e.target.value as ImageModel)}
            />
            <div className="ai-model-info">
              <div className="ai-model-name">GPT Image 1</div>
              <div className="ai-model-desc">High quality (~$0.01-$0.25/image)</div>
            </div>
          </label>

          <label className="ai-model-option">
            <input
              type="radio"
              name="imageModel"
              value="gpt-image-1-mini"
              checked={imageModel === 'gpt-image-1-mini'}
              onChange={(e) => setImageModel(e.target.value as ImageModel)}
            />
            <div className="ai-model-info">
              <div className="ai-model-name">GPT Image 1 Mini</div>
              <div className="ai-model-desc">Fast & affordable (~$0.005-$0.05/image)</div>
            </div>
          </label>

          <label className="ai-model-option">
            <input
              type="radio"
              name="imageModel"
              value="dall-e-3"
              checked={imageModel === 'dall-e-3'}
              onChange={(e) => setImageModel(e.target.value as ImageModel)}
            />
            <div className="ai-model-info">
              <div className="ai-model-name">DALL-E 3</div>
              <div className="ai-model-desc">Previous gen (~$0.04-$0.12/image, deprecated 05/2026)</div>
            </div>
          </label>
        </div>
      </div>
    </div>
  );
}
