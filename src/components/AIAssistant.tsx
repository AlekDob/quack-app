import { useEffect, useRef, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import type {
  AISuggestion,
  AIRequest,
  TerminalContext,
  AIQuestion,
  AIAnswer,
  AIPromptImprovement
} from '../types'

interface AIAssistantProps {
  intent?: string
  context: TerminalContext
  onClose: () => void
  onSelectCommand: (command: string) => void
}

type Mode = 'selection' | 'terminal-helper' | 'prompt-engineer'
type PromptEngineerStep = 'input' | 'questions' | 'improvement'

export default function AIAssistant({
  intent = '',
  context,
  onClose,
  onSelectCommand,
}: AIAssistantProps) {
  // Mode and navigation
  const [mode, setMode] = useState<Mode>('selection')
  const [promptEngineerStep, setPromptEngineerStep] = useState<PromptEngineerStep>('input')

  // Terminal Helper states
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null)

  // Prompt Engineer states
  const [questions, setQuestions] = useState<AIQuestion[]>([])
  const [answers, setAnswers] = useState<Map<number, string>>(new Map())
  const [improvement, setImprovement] = useState<AIPromptImprovement | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)

  // Common states
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [closing, setClosing] = useState(false)
  const [inputValue, setInputValue] = useState(intent)
  const [hasSubmitted, setHasSubmitted] = useState(intent.trim().length > 0)
  const [showCopyNotification, setShowCopyNotification] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const answerInputRef = useRef<HTMLInputElement>(null)

  const handleClose = () => {
    setClosing(true)
    setTimeout(() => {
      onClose()
    }, 250)
  }

  const handleModeSelect = (selectedMode: 'terminal-helper' | 'prompt-engineer') => {
    setMode(selectedMode)
    if (selectedMode === 'terminal-helper' && inputValue.trim().length > 0) {
      setHasSubmitted(true)
      setLoading(true)
      setError(null)
    }
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

  const handleAnswerSubmit = () => {
    const currentAnswer = answers.get(currentQuestionIndex + 1) || ''
    if (currentAnswer.trim().length === 0) {
      return
    }

    // If this was the last question, fetch improvement
    if (currentQuestionIndex >= questions.length - 1) {
      fetchPromptImprovement()
    } else {
      setCurrentQuestionIndex(currentQuestionIndex + 1)
      setTimeout(() => {
        answerInputRef.current?.focus()
      }, 100)
    }
  }

  const updateAnswer = (questionNumber: number, value: string) => {
    const newAnswers = new Map(answers)
    newAnswers.set(questionNumber, value)
    setAnswers(newAnswers)
  }

  // Fetch Terminal Helper suggestion
  useEffect(() => {
    if (!hasSubmitted || mode !== 'terminal-helper') {
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
  }, [hasSubmitted, inputValue, context, mode])

  // Fetch Prompt Engineering questions
  useEffect(() => {
    if (!hasSubmitted || mode !== 'prompt-engineer' || promptEngineerStep !== 'input') {
      return
    }

    const fetchQuestions = async () => {
      try {
        const result = await invoke<AIQuestion[]>('get_prompt_engineering_questions', {
          originalPrompt: inputValue.trim(),
        })
        setQuestions(result)
        setPromptEngineerStep('questions')
        setLoading(false)
        setTimeout(() => {
          answerInputRef.current?.focus()
        }, 100)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
        setLoading(false)
      }
    }

    void fetchQuestions()
  }, [hasSubmitted, inputValue, mode, promptEngineerStep])

  // Fetch prompt improvement
  const fetchPromptImprovement = async () => {
    setLoading(true)
    setError(null)

    try {
      const answersArray: AIAnswer[] = Array.from(answers.entries()).map(([questionNumber, answer]) => ({
        questionNumber,
        answer,
      }))

      const result = await invoke<AIPromptImprovement>('improve_prompt_with_answers', {
        originalPrompt: inputValue.trim(),
        answers: answersArray,
      })

      setImprovement(result)
      setPromptEngineerStep('improvement')
      setLoading(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setLoading(false)
    }
  }

  // Focus management
  useEffect(() => {
    if (!hasSubmitted && inputRef.current) {
      inputRef.current.focus()
    }
  }, [hasSubmitted])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closing) return

      if (e.key === 'Escape') {
        handleClose()
      } else if (e.key === 'Enter') {
        if (!hasSubmitted && mode === 'terminal-helper') {
          e.preventDefault()
          handleSubmit()
        } else if (suggestion && !loading && !error && mode === 'terminal-helper') {
          onSelectCommand(suggestion.command)
          handleClose()
        } else if (promptEngineerStep === 'questions' && !loading) {
          e.preventDefault()
          handleAnswerSubmit()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [suggestion, loading, error, closing, hasSubmitted, mode, promptEngineerStep, onSelectCommand])

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => {
        setShowCopyNotification(true)
        setTimeout(() => setShowCopyNotification(false), 3000)
      })
      .catch(console.error)
  }

  const isImprovementView = mode === 'prompt-engineer' && promptEngineerStep === 'improvement'

  return (
    <div className={`ai-assistant-overlay ${closing ? 'closing' : ''}`} onClick={handleClose}>
      <div className={`ai-assistant-modal ${isImprovementView ? 'ai-modal-large' : 'ai-modal-compact'}`} onClick={(e) => e.stopPropagation()}>
        <div className="ai-assistant-header">
          <div className="ai-assistant-title">
            <span className="ai-icon">🤖</span>
            {mode === 'selection' && 'AI Assistant'}
            {mode === 'terminal-helper' && 'Terminal Command Helper'}
            {mode === 'prompt-engineer' && 'Prompt Engineer'}
          </div>
          <button className="ai-close-btn" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="ai-assistant-content">
          {/* Mode Selection */}
          {mode === 'selection' && (
            <div className="ai-mode-selection">
              <div className="ai-mode-label">Choose an AI mode:</div>
              <div className="ai-mode-cards">
                <button
                  className="ai-mode-card"
                  onClick={() => handleModeSelect('terminal-helper')}
                >
                  <span className="ai-mode-icon">⚡</span>
                  <div className="ai-mode-card-content">
                    <h3 className="ai-mode-card-title">Terminal Helper</h3>
                    <p className="ai-mode-card-description">
                      Get command suggestions for terminal operations
                    </p>
                  </div>
                </button>

                <button
                  className="ai-mode-card"
                  onClick={() => handleModeSelect('prompt-engineer')}
                >
                  <span className="ai-mode-icon">✨</span>
                  <div className="ai-mode-card-content">
                    <h3 className="ai-mode-card-title">Prompt Engineer</h3>
                    <p className="ai-mode-card-description">
                      Improve your AI prompts with interactive questions
                    </p>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Terminal Helper Mode */}
          {mode === 'terminal-helper' && (
            <>
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
            </>
          )}

          {/* Prompt Engineer Mode */}
          {mode === 'prompt-engineer' && (
            <>
              {promptEngineerStep === 'input' && !hasSubmitted && (
                <div className="ai-input-section">
                  <div>
                    <div className="ai-input-label">Enter your AI prompt to improve:</div>
                    <textarea
                      ref={inputRef as any}
                      className="ai-input-field ai-textarea"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="e.g., Build a web app with user authentication..."
                      rows={4}
                      autoFocus
                    />
                  </div>
                  <div className="ai-input-button-wrapper">
                    <button
                      className="ai-btn ai-btn-primary"
                      onClick={handleSubmit}
                      disabled={inputValue.trim().length === 0}
                    >
                      Improve Prompt
                    </button>
                  </div>
                </div>
              )}

              {promptEngineerStep === 'questions' && !loading && questions.length > 0 && (
                <div className="ai-questions-section">
                  <div className="ai-original-prompt">
                    <div className="ai-original-prompt-label">Original Prompt:</div>
                    <div className="ai-original-prompt-text">{inputValue}</div>
                  </div>

                  <div className="ai-question-progress">
                    Question {currentQuestionIndex + 1} of {questions.length}
                  </div>

                  <div className="ai-question-card">
                    <div className="ai-question-text">
                      {questions[currentQuestionIndex].question}
                    </div>
                    <input
                      ref={answerInputRef}
                      type="text"
                      className="ai-input-field"
                      value={answers.get(currentQuestionIndex + 1) || ''}
                      onChange={(e) => updateAnswer(currentQuestionIndex + 1, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          handleAnswerSubmit()
                        }
                      }}
                      placeholder="Your answer..."
                      autoFocus
                    />
                  </div>

                  <div className="ai-question-navigation">
                    {currentQuestionIndex > 0 && (
                      <button
                        className="ai-btn ai-btn-secondary"
                        onClick={() => {
                          setCurrentQuestionIndex(currentQuestionIndex - 1)
                          setTimeout(() => answerInputRef.current?.focus(), 100)
                        }}
                      >
                        ← Previous
                      </button>
                    )}
                    <button
                      className="ai-btn ai-btn-primary"
                      onClick={handleAnswerSubmit}
                      disabled={!answers.get(currentQuestionIndex + 1)?.trim()}
                    >
                      {currentQuestionIndex >= questions.length - 1 ? 'Generate' : 'Next'} →
                    </button>
                  </div>
                </div>
              )}

              {promptEngineerStep === 'improvement' && improvement && !loading && (
                <div className="ai-improvement-section">
                  <div className="ai-improvement-comparison">
                    <div className="ai-prompt-box ai-prompt-original">
                      <div className="ai-prompt-box-header">
                        <span className="ai-prompt-box-label">Original</span>
                        <button
                          className="ai-copy-btn"
                          onClick={() => copyToClipboard(improvement.originalPrompt)}
                          title="Copy original prompt"
                        >
                          📋
                        </button>
                      </div>
                      <div className="ai-prompt-box-content">{improvement.originalPrompt}</div>
                    </div>

                    <div className="ai-prompt-separator">→</div>

                    <div className="ai-prompt-box ai-prompt-improved">
                      <div className="ai-prompt-box-header">
                        <span className="ai-prompt-box-label">Improved</span>
                        <button
                          className="ai-copy-btn"
                          onClick={() => copyToClipboard(improvement.improvedPrompt)}
                          title="Copy improved prompt"
                        >
                          📋
                        </button>
                      </div>
                      <div className="ai-prompt-box-content">{improvement.improvedPrompt}</div>
                    </div>
                  </div>

                  <div className="ai-improvements-list">
                    <div className="ai-improvements-label">Key Improvements:</div>
                    <ul className="ai-improvements-items">
                      {improvement.improvements.map((item, index) => (
                        <li key={index} className="ai-improvement-item">
                          <span className="ai-improvement-bullet">✓</span>
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="ai-improvement-confidence">
                    <span className="ai-confidence-label">Improvement Confidence:</span>
                    <div className="ai-confidence-bar">
                      <div
                        className="ai-confidence-fill"
                        style={{
                          width: `${improvement.confidence * 100}%`,
                          backgroundColor: getConfidenceColor(improvement.confidence),
                        }}
                      />
                    </div>
                    <span
                      className="ai-confidence-text"
                      style={{ color: getConfidenceColor(improvement.confidence) }}
                    >
                      {getConfidenceLabel(improvement.confidence)}
                    </span>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Loading State */}
          {loading && hasSubmitted && (
            <div className="ai-loading">
              <div className="ai-spinner"></div>
              <p>
                {mode === 'prompt-engineer' && promptEngineerStep === 'input' && 'Generating questions...'}
                {mode === 'prompt-engineer' && promptEngineerStep === 'questions' && 'Improving your prompt...'}
                {mode === 'terminal-helper' && 'Thinking...'}
              </p>
            </div>
          )}

          {/* Error State */}
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
        </div>

        {/* Footer */}
        {mode === 'terminal-helper' && suggestion && !loading && !error && hasSubmitted && (
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

        {mode === 'prompt-engineer' && improvement && !loading && !error && (
          <div className="ai-assistant-footer">
            <button className="ai-btn ai-btn-secondary" onClick={handleClose}>
              Close <span className="ai-kbd">Esc</span>
            </button>
          </div>
        )}

        {(mode === 'selection' || (!hasSubmitted && !loading)) && (
          <div className="ai-assistant-footer">
            <button className="ai-btn ai-btn-secondary" onClick={handleClose}>
              Cancel <span className="ai-kbd">Esc</span>
            </button>
          </div>
        )}
      </div>

      {showCopyNotification && (
        <div className="ai-copy-notification">
          Text copied
        </div>
      )}
    </div>
  )
}
