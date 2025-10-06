import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AISuggestion, AIRequest, TerminalContext } from '../types'

interface AIAssistantProps {
  intent: string
  context: TerminalContext
  onClose: () => void
  onSelectCommand: (command: string) => void
}

export default function AIAssistant({
  intent,
  context,
  onClose,
  onSelectCommand,
}: AIAssistantProps) {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => {
      onClose()
    }, 250) // Match animation duration
  }

  useEffect(() => {
    const fetchSuggestion = async () => {
      try {
        const request: AIRequest = {
          intent,
          context,
          requestType: 'command',
        }

        const result = await invoke<AISuggestion>('get_ai_suggestion', { request })
        setSuggestion(result)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    }

    void fetchSuggestion()
  }, [intent, context])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closing) return // Ignore keys during close animation

      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'Enter' && suggestion && !loading && !error) {
        onSelectCommand(suggestion.command)
        handleClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [suggestion, loading, error, closing, onSelectCommand])

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'var(--color-success)'
    if (confidence >= 0.7) return 'var(--color-warning)'
    return 'var(--color-error)'
  }

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.9) return 'High'
    if (confidence >= 0.7) return 'Medium'
    return 'Low'
  }

  return (
    <div className={`ai-assistant-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
      <div className="ai-assistant-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ai-assistant-header">
          <div className="ai-assistant-title">
            <span className="ai-icon">🤖</span>
            AI Command Assistant
          </div>
          <button className="ai-close-btn" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="ai-assistant-content">
          <div className="ai-intent-display">
            <span className="ai-intent-label">Intent:</span>
            <span className="ai-intent-text">{intent}</span>
          </div>

          {loading && (
            <div className="ai-loading">
              <div className="ai-spinner"></div>
              <p>Thinking...</p>
            </div>
          )}

          {error && (
            <div className="ai-error">
              <span className="ai-error-icon">⚠️</span>
              <div className="ai-error-content">
                <p className="ai-error-title">Error</p>
                <p className="ai-error-message">{error}</p>
                {error.includes('API key') && (
                  <p className="ai-error-hint">
                    Please configure your OpenAI API key in Settings
                  </p>
                )}
              </div>
            </div>
          )}

          {suggestion && !loading && !error && (
            <div className="ai-suggestion">
              <div className="ai-suggestion-header">
                <div className="ai-confidence">
                  <span className="ai-confidence-label">Confidence:</span>
                  <div className="ai-confidence-bar">
                    <div
                      className="ai-confidence-fill"
                      style={{
                        width: `${suggestion.confidence * 100}%`,
                        backgroundColor: getConfidenceColor(suggestion.confidence),
                      }}
                    />
                  </div>
                  <span
                    className="ai-confidence-text"
                    style={{ color: getConfidenceColor(suggestion.confidence) }}
                  >
                    {getConfidenceLabel(suggestion.confidence)}
                  </span>
                </div>
              </div>

              <div className="ai-command-block">
                <div className="ai-command-label">Suggested Command</div>
                <code className="ai-command">{suggestion.command}</code>
              </div>

              <div className="ai-explanation">
                <span className="ai-explanation-icon">💡</span>
                {suggestion.explanation}
              </div>

              {suggestion.alternative && (
                <div className="ai-alternative">
                  <div className="ai-alternative-label">Alternative:</div>
                  <code className="ai-alternative-command">{suggestion.alternative}</code>
                  <button
                    className="ai-btn ai-btn-secondary"
                    onClick={() => {
                      onSelectCommand(suggestion.alternative!)
                      handleClose()
                    }}
                  >
                    Use Alternative
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {suggestion && !loading && !error && (
          <div className="ai-assistant-footer">
            <button className="ai-btn ai-btn-secondary" onClick={handleClose}>
              Cancel <span className="ai-kbd">Esc</span>
            </button>
            <button
              className="ai-btn ai-btn-primary"
              onClick={() => {
                onSelectCommand(suggestion.command)
                handleClose()
              }}
            >
              Execute <span className="ai-kbd">⏎</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
