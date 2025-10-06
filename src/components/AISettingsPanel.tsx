import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { TokenStats } from '../types'

interface AISettingsPanelProps {
  onClose: () => void
}

export default function AISettingsPanel({ onClose }: AISettingsPanelProps) {
  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState<'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo'>('gpt-4o-mini')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [stats, setStats] = useState<TokenStats | null>(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [closing, setClosing] = useState(false)

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => {
      onClose()
    }, 250) // Match animation duration
  }

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoadingStats(true)
    try {
      const tokenStats = await invoke<TokenStats>('get_token_usage_stats')
      setStats(tokenStats)
    } catch (err) {
      console.error('Failed to load stats:', err)
    } finally {
      setLoadingStats(false)
    }
  }

  const handleSaveAndTest = async () => {
    if (!apiKey.trim()) {
      setErrorMessage('Please enter an API key')
      setTestResult('error')
      return
    }

    if (!apiKey.startsWith('sk-')) {
      setErrorMessage('Invalid API key format. OpenAI keys start with "sk-"')
      setTestResult('error')
      return
    }

    setTesting(true)
    setTestResult(null)
    setErrorMessage('')

    try {
      // Save API key
      await invoke('save_api_key', { key: apiKey })

      // Test connection
      const connected = await invoke<boolean>('test_api_connection')

      if (connected) {
        setTestResult('success')
        setErrorMessage('')
      } else {
        setTestResult('error')
        setErrorMessage('Connection test failed. Please check your API key.')
      }
    } catch (err) {
      setTestResult('error')
      setErrorMessage(err instanceof Error ? err.message : String(err))
    } finally {
      setTesting(false)
    }
  }

  const formatCost = (cost: number) => {
    return `$${cost.toFixed(4)}`
  }

  const formatTokens = (tokens: number) => {
    if (tokens >= 1000000) {
      return `${(tokens / 1000000).toFixed(2)}M`
    }
    if (tokens >= 1000) {
      return `${(tokens / 1000).toFixed(1)}K`
    }
    return tokens.toString()
  }

  return (
    <div className={`ai-settings-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
      <div className="ai-settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="ai-settings-header">
          <div>
            <h2>🤖 AI Assistant Settings</h2>
            <p>Configure OpenAI integration for command suggestions and error analysis</p>
          </div>
          <button className="ai-settings-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="ai-settings-body">
          {/* API Key Section */}
          <div className="ai-settings-section">
            <h3>OpenAI API Key</h3>
            <p className="ai-settings-description">
              Your API key is stored locally and encrypted. Get your key from{' '}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="ai-settings-link"
              >
                OpenAI Platform
              </a>
            </p>

            <div className="ai-settings-input-group">
              <input
                type="password"
                className="ai-settings-input"
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                className="ai-btn ai-btn-primary"
                onClick={handleSaveAndTest}
                disabled={testing}
              >
                {testing ? 'Testing...' : 'Save & Test'}
              </button>
            </div>

            {testResult === 'success' && (
              <div className="ai-settings-status ai-settings-status-success">
                <span className="ai-settings-status-icon">✓</span>
                Connected successfully!
              </div>
            )}

            {testResult === 'error' && (
              <div className="ai-settings-status ai-settings-status-error">
                <span className="ai-settings-status-icon">✕</span>
                {errorMessage || 'Connection failed'}
              </div>
            )}
          </div>

          {/* Model Selection */}
          <div className="ai-settings-section">
            <h3>AI Model</h3>
            <p className="ai-settings-description">
              Choose the model for AI suggestions. gpt-4o-mini is recommended for best cost/performance.
            </p>

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

          {/* Usage Statistics */}
          <div className="ai-settings-section">
            <h3>Usage Statistics</h3>
            <p className="ai-settings-description">
              Track your AI usage and estimated costs
            </p>

            {loadingStats ? (
              <div className="ai-stats-loading">Loading statistics...</div>
            ) : stats ? (
              <div className="ai-stats-grid">
                <div className="ai-stat-card">
                  <div className="ai-stat-value">{formatTokens(stats.totalTokensUsed)}</div>
                  <div className="ai-stat-label">Tokens Used</div>
                </div>

                <div className="ai-stat-card">
                  <div className="ai-stat-value">{formatCost(stats.estimatedCost)}</div>
                  <div className="ai-stat-label">Estimated Cost</div>
                </div>

                <div className="ai-stat-card">
                  <div className="ai-stat-value">{stats.requestCount}</div>
                  <div className="ai-stat-label">Requests</div>
                </div>
              </div>
            ) : (
              <div className="ai-stats-empty">No usage data yet</div>
            )}
          </div>

          {/* Features Info */}
          <div className="ai-settings-section">
            <h3>How to Use</h3>
            <div className="ai-feature-list">
              <div className="ai-feature-item">
                <span className="ai-feature-icon">💡</span>
                <div>
                  <strong>Command Assistant:</strong> Type your intent and press <code>#</code> to
                  get AI suggestions
                  <div className="ai-feature-example">
                    Example: <code>install prettier#</code>
                  </div>
                </div>
              </div>

              <div className="ai-feature-item">
                <span className="ai-feature-icon">⚡</span>
                <div>
                  <strong>Rate Limit:</strong> Max 10 requests per minute to control costs
                </div>
              </div>

              <div className="ai-feature-item">
                <span className="ai-feature-icon">💾</span>
                <div>
                  <strong>Smart Caching:</strong> Identical requests are cached for 1 hour
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="ai-settings-footer">
          <button className="ai-btn ai-btn-secondary" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
