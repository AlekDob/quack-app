import React, { useState, useCallback } from 'react';
import type { AskUserQuestion, AskUserQuestionAnswers } from '../types';
import './AskUserQuestionWidget.css';

interface AskUserQuestionWidgetProps {
  questions: AskUserQuestion[];
  toolUseId: string;
  onSubmit: (toolUseId: string, answers: AskUserQuestionAnswers) => void;
  disabled?: boolean;
  existingAnswers?: AskUserQuestionAnswers;
}

/**
 * Interactive widget for AskUserQuestion tool
 * Renders questions with selectable options inline in the chat
 */
const AskUserQuestionWidget: React.FC<AskUserQuestionWidgetProps> = ({
  questions,
  toolUseId,
  onSubmit,
  disabled = false,
  existingAnswers,
}) => {
  // State for tracking selections per question (by header)
  const [selections, setSelections] = useState<AskUserQuestionAnswers>(() => {
    if (existingAnswers) return existingAnswers;
    // Initialize with empty selections
    const initial: AskUserQuestionAnswers = {};
    questions.forEach((q) => {
      initial[q.header] = q.multiSelect ? [] : '';
    });
    return initial;
  });

  // State for "Other" text inputs
  const [otherTexts, setOtherTexts] = useState<Record<string, string>>({});
  const [showOther, setShowOther] = useState<Record<string, boolean>>({});

  // Handle option selection
  const handleOptionSelect = useCallback((header: string, label: string, multiSelect: boolean) => {
    if (disabled) return;

    setSelections((prev) => {
      if (multiSelect) {
        const current = (prev[header] as string[]) || [];
        if (current.includes(label)) {
          // Deselect
          return { ...prev, [header]: current.filter((l) => l !== label) };
        } else {
          // Select
          return { ...prev, [header]: [...current, label] };
        }
      } else {
        // Single select - just set the value
        return { ...prev, [header]: label };
      }
    });

    // Hide "Other" input if a regular option is selected (single select)
    if (!multiSelect) {
      setShowOther((prev) => ({ ...prev, [header]: false }));
    }
  }, [disabled]);

  // Handle "Other" option toggle
  const handleOtherToggle = useCallback((header: string, multiSelect: boolean) => {
    if (disabled) return;

    setShowOther((prev) => {
      const newShow = !prev[header];
      if (!newShow && !multiSelect) {
        // If hiding Other in single-select, clear the selection
        setSelections((s) => ({ ...s, [header]: '' }));
      }
      return { ...prev, [header]: newShow };
    });

    // For single select, clear the regular selection when Other is shown
    if (!multiSelect) {
      setSelections((prev) => ({ ...prev, [header]: '' }));
    }
  }, [disabled]);

  // Handle "Other" text change
  const handleOtherTextChange = useCallback((header: string, text: string) => {
    setOtherTexts((prev) => ({ ...prev, [header]: text }));
  }, []);

  // Check if form is valid (at least one selection per question)
  const isValid = questions.every((q) => {
    const selection = selections[q.header];
    const hasOther = showOther[q.header] && otherTexts[q.header]?.trim();

    if (q.multiSelect) {
      const arr = selection as string[];
      return (arr && arr.length > 0) || hasOther;
    } else {
      return selection || hasOther;
    }
  });

  // Handle submit
  const handleSubmit = useCallback(() => {
    if (!isValid || disabled) return;

    // Build final answers, incorporating "Other" text
    const finalAnswers: AskUserQuestionAnswers = {};
    questions.forEach((q) => {
      if (showOther[q.header] && otherTexts[q.header]?.trim()) {
        if (q.multiSelect) {
          const arr = (selections[q.header] as string[]) || [];
          finalAnswers[q.header] = [...arr, `Other: ${otherTexts[q.header].trim()}`];
        } else {
          finalAnswers[q.header] = `Other: ${otherTexts[q.header].trim()}`;
        }
      } else {
        finalAnswers[q.header] = selections[q.header];
      }
    });

    onSubmit(toolUseId, finalAnswers);
  }, [isValid, disabled, questions, selections, showOther, otherTexts, toolUseId, onSubmit]);

  // Check if this was already answered
  const isAnswered = disabled && existingAnswers;

  return (
    <div className={`ask-user-widget ${disabled ? 'disabled' : ''} ${isAnswered ? 'answered' : ''}`}>
      <div className="ask-user-header">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.5a6.5 6.5 0 110-13 6.5 6.5 0 010 13zm0-11a1 1 0 00-1 1v4a1 1 0 002 0V4.5a1 1 0 00-1-1zm0 8a1 1 0 100-2 1 1 0 000 2z"/>
        </svg>
        <span className="ask-user-title">
          {isAnswered ? 'Question Answered' : 'Agent needs your input'}
        </span>
        {isAnswered && (
          <span className="ask-user-answered-badge">Answered</span>
        )}
      </div>

      <div className="ask-user-questions">
        {questions.map((q, idx) => {
          const selection = selections[q.header];
          const isMulti = q.multiSelect;
          const selectedArray = isMulti ? (selection as string[]) || [] : [];
          const selectedSingle = !isMulti ? (selection as string) : '';

          return (
            <div key={`${q.header}-${idx}`} className="ask-user-question">
              <div className="ask-user-question-header">
                <span className="ask-user-chip">{q.header}</span>
                <span className="ask-user-question-text">{q.question}</span>
                {isMulti && (
                  <span className="ask-user-multi-hint">(Select multiple)</span>
                )}
              </div>

              <div className="ask-user-options">
                {q.options.map((opt, optIdx) => {
                  const isSelected = isMulti
                    ? selectedArray.includes(opt.label)
                    : selectedSingle === opt.label;

                  return (
                    <button
                      key={`${opt.label}-${optIdx}`}
                      className={`ask-user-option ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleOptionSelect(q.header, opt.label, isMulti)}
                      disabled={disabled}
                      type="button"
                    >
                      <div className="ask-user-option-check">
                        {isMulti ? (
                          // Checkbox style
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            {isSelected ? (
                              <path
                                d="M2 3.5A1.5 1.5 0 013.5 2h7A1.5 1.5 0 0112 3.5v7a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 10.5v-7zm3.854 4.854l4-4a.5.5 0 00-.708-.708L5.5 7.293 4.354 6.146a.5.5 0 10-.708.708l1.5 1.5a.5.5 0 00.708 0z"
                                fill="currentColor"
                              />
                            ) : (
                              <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                            )}
                          </svg>
                        ) : (
                          // Radio style
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                            {isSelected && <circle cx="7" cy="7" r="3" fill="currentColor" />}
                          </svg>
                        )}
                      </div>
                      <div className="ask-user-option-content">
                        <span className="ask-user-option-label">{opt.label}</span>
                        <span className="ask-user-option-desc">{opt.description}</span>
                      </div>
                    </button>
                  );
                })}

                {/* Other option */}
                <button
                  className={`ask-user-option ask-user-other-toggle ${showOther[q.header] ? 'selected' : ''}`}
                  onClick={() => handleOtherToggle(q.header, isMulti)}
                  disabled={disabled}
                  type="button"
                >
                  <div className="ask-user-option-check">
                    {isMulti ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        {showOther[q.header] ? (
                          <path
                            d="M2 3.5A1.5 1.5 0 013.5 2h7A1.5 1.5 0 0112 3.5v7a1.5 1.5 0 01-1.5 1.5h-7A1.5 1.5 0 012 10.5v-7zm3.854 4.854l4-4a.5.5 0 00-.708-.708L5.5 7.293 4.354 6.146a.5.5 0 10-.708.708l1.5 1.5a.5.5 0 00.708 0z"
                            fill="currentColor"
                          />
                        ) : (
                          <rect x="2" y="2" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
                        )}
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.5" />
                        {showOther[q.header] && <circle cx="7" cy="7" r="3" fill="currentColor" />}
                      </svg>
                    )}
                  </div>
                  <div className="ask-user-option-content">
                    <span className="ask-user-option-label">Other</span>
                    <span className="ask-user-option-desc">Provide a custom answer</span>
                  </div>
                </button>

                {/* Other text input */}
                {showOther[q.header] && (
                  <div className="ask-user-other-input">
                    <input
                      type="text"
                      placeholder="Type your answer..."
                      value={otherTexts[q.header] || ''}
                      onChange={(e) => handleOtherTextChange(q.header, e.target.value)}
                      disabled={disabled}
                      autoFocus
                    />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!disabled && (
        <div className="ask-user-actions">
          <button
            className="ask-user-submit"
            onClick={handleSubmit}
            disabled={!isValid}
            type="button"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
              <path d="M13.854 3.146a.5.5 0 010 .708l-7 7a.5.5 0 01-.708 0l-3.5-3.5a.5.5 0 11.708-.708L6.5 9.793l6.646-6.647a.5.5 0 01.708 0z"/>
            </svg>
            Submit Answer
          </button>
        </div>
      )}
    </div>
  );
};

export default AskUserQuestionWidget;
