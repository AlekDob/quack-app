import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type { AISuggestion, AIRequest, TerminalContext } from '../types'

interface AIAssistantProps {
  intent?: string
  context: TerminalContext
  onClose: () => void
  onSelectCommand: (command: string) => void
}

export default function AIAssistant({
  intent = '',
  context,
  onClose,
  onSelectCommand,
}: AIAssistantProps) {
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [inputValue, setInputValue] = useState(intent)
  const [hasSubmitted, setHasSubmitted] = useState(intent.trim().length > 0)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => {
      onClose()
    }, 250) // Match animation duration
  }

  const handleSubmit = () => {
    const trimmedInput = inputValue.trim()
    if (trimmedInput.length === 0) {
      return
    }
    setHasSubmitted(true)
    setLoading(true)
    setError(null)
  }

  useEffect(() => {
    // Focus input on mount if intent is empty
    if (!hasSubmitted && inputRef.current) {
      inputRef.current.focus()
    }
  }, [hasSubmitted])

  useEffect(() => {
    if (!hasSubmitted) {
      return
    }

    const fetchSuggestion = async () => {
      try {
        const request: AIRequest = {
          intent: inputValue.trim(),
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
  }, [hasSubmitted, inputValue, context])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closing) return // Ignore keys during close animation

      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'Enter') {
        // If input mode (not submitted yet), submit the input
        if (!hasSubmitted) {
          e.preventDefault()
          handleSubmit()
        }
        // If has suggestion and not in input, execute command
        else if (suggestion && !loading && !error) {
          onSelectCommand(suggestion.command)
          handleClose()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [suggestion, loading, error, closing, hasSubmitted, onSelectCommand])

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
          {!hasSubmitted ? (
            <div className="ai-input-section">
              <div>
                <div className="ai-input-label">What do you want to do?</div>
                <input
                  ref={inputRef}
                  type="text"
                  className="ai-input-field"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  placeholder="e.g., list all files, find large files, git status..."
                  autoFocus
                />
              </div>
              <div className="ai-input-button-wrapper">
                <button
                  className="ai-btn ai-btn-primary"
                  onClick={handleSubmit}
                  disabled={inputValue.trim().length === 0}
                >
                  Ask AI
                </button>
              </div>
            </div>
          ) : (
            <div className="ai-intent-display">
              <span className="ai-intent-label">Intent:</span>
              <span className="ai-intent-text">{inputValue}</span>
            </div>
          )}

          {loading && hasSubmitted && (
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

        {suggestion && !loading && !error && hasSubmitted && (
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

        {!hasSubmitted && (
          <div className="ai-assistant-footer">
            <button className="ai-btn ai-btn-secondary" onClick={handleClose}>
              Cancel <span className="ai-kbd">Esc</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
