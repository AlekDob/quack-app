import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import MarkdownText from './MarkdownText';
import { useIDEStore } from '../stores/ideStore';
import './PlanWidget.css';

interface PlanWidgetProps {
  plan: string;
  defaultExpanded?: boolean;
  workingDirectory?: string; // Current working directory of the agent
  pendingApprovalRequestId?: string; // If set, shows approve/reject buttons
  onApprovalResponse?: (requestId: string, approved: boolean, feedback?: string) => void;
}

const PlanWidget: React.FC<PlanWidgetProps> = ({
  plan,
  defaultExpanded = true,
  workingDirectory,
  pendingApprovalRequestId,
  onApprovalResponse,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [savedFilePath, setSavedFilePath] = useState<string | null>(null);
  const [isResponded, setIsResponded] = useState(false);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [feedback, setFeedback] = useState('');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(plan);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy plan:', err);
    }
  };

  const handleSaveToFile = async () => {
    try {
      const normalizedTitle = planTitle
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();

      const today = new Date().toISOString().split('T')[0];
      const filename = `${normalizedTitle}-${today}.md`;
      const planningDir = workingDirectory
        ? `${workingDirectory}/planning`
        : 'planning';

      await invoke('create_directory', { path: planningDir });

      const filepath = `${planningDir}/${filename}`;
      await invoke('write_file_content', {
        path: filepath,
        content: plan,
      });

      setSavedFilePath(filepath);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      console.error('[PlanWidget] Failed to save plan to file:', err);
    }
  };

  const handleOpenFile = async () => {
    if (!savedFilePath) return;
    try {
      const { openFileInIDE } = useIDEStore.getState();
      await openFileInIDE(savedFilePath);
    } catch (err) {
      console.error('[PlanWidget] Failed to open file:', err);
    }
  };

  const handleApprove = () => {
    if (!pendingApprovalRequestId || !onApprovalResponse) return;
    setIsResponded(true);
    onApprovalResponse(pendingApprovalRequestId, true);
  };

  const handleReject = () => {
    if (!pendingApprovalRequestId || !onApprovalResponse) return;
    if (showFeedbackInput && feedback.trim()) {
      setIsResponded(true);
      onApprovalResponse(pendingApprovalRequestId, false, feedback.trim());
    } else {
      setShowFeedbackInput(true);
    }
  };

  const handleRejectWithFeedback = () => {
    if (!pendingApprovalRequestId || !onApprovalResponse) return;
    setIsResponded(true);
    onApprovalResponse(
      pendingApprovalRequestId,
      false,
      feedback.trim() || 'User rejected the plan'
    );
  };

  // Extract title from plan (first line starting with ##)
  const planTitle =
    plan.match(/^##\s+(.+)$/m)?.[1] || 'Implementation Plan';

  const isPendingApproval =
    !!pendingApprovalRequestId && !isResponded;

  return (
    <div
      className={`plan-widget ${isPendingApproval ? 'plan-widget-pending' : ''}`}
    >
      <div
        className="plan-widget-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="plan-widget-title">
          <svg
            className="plan-widget-icon"
            width="20"
            height="20"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M0 1.75C0 .784.784 0 1.75 0h12.5C15.216 0 16 .784 16 1.75v12.5A1.75 1.75 0 0114.25 16H1.75A1.75 1.75 0 010 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25H1.75zM3.5 6.75A.75.75 0 014.25 6h7a.75.75 0 010 1.5h-7a.75.75 0 01-.75-.75zm.75 2.25a.75.75 0 000 1.5h4a.75.75 0 000-1.5h-4z" />
          </svg>
          <span className="plan-title-text">{planTitle}</span>
          <span
            className={`plan-widget-badge ${isPendingApproval ? 'plan-widget-badge-pending' : ''}`}
          >
            {isPendingApproval ? 'Awaiting Approval' : 'Plan Mode'}
          </span>
        </div>
        <div className="plan-widget-actions">
          {savedFilePath && (
            <button
              className="plan-widget-copy-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenFile();
              }}
              title="Open saved plan file"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M1.75 2.5a.25.25 0 00-.25.25v10.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V5.664a.25.25 0 00-.073-.177l-2.914-2.914a.25.25 0 00-.177-.073H1.75zM0 2.75C0 1.784.784 1 1.75 1h8.836c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v8.586A1.75 1.75 0 0113.5 16h-11A1.75 1.75 0 010 14.25V2.75z" />
                <path d="M5.5 5.75a.75.75 0 01.75-.75h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75zm0 2.5a.75.75 0 01.75-.75h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75zm0 2.5a.75.75 0 01.75-.75h4a.75.75 0 010 1.5h-4a.75.75 0 01-.75-.75z" />
              </svg>
            </button>
          )}
          <button
            className="plan-widget-copy-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleSaveToFile();
            }}
            title="Save plan to file (planning/*.md)"
          >
            {isSaved ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V4.664a.25.25 0 00-.073-.177l-2.914-2.914a.25.25 0 00-.177-.073H3.75z" />
                <path d="M4.75 7.5a.75.75 0 01.75-.75h5a.75.75 0 010 1.5h-5a.75.75 0 01-.75-.75zm0 2a.75.75 0 01.75-.75h5a.75.75 0 010 1.5h-5a.75.75 0 01-.75-.75zm0 2a.75.75 0 01.75-.75h2a.75.75 0 010 1.5h-2a.75.75 0 01-.75-.75z" />
              </svg>
            )}
          </button>
          <button
            className="plan-widget-copy-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleCopy();
            }}
            title="Copy plan to clipboard"
          >
            {isCopied ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
              </svg>
            )}
          </button>
          <svg
            className={`plan-widget-chevron ${isExpanded ? 'expanded' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M12.78 6.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 7.28a.75.75 0 011.06-1.06L8 9.94l3.72-3.72a.75.75 0 011.06 0z" />
          </svg>
        </div>
      </div>

      {isExpanded && (
        <div className="plan-widget-content">
          <div className="plan-widget-markdown">
            <MarkdownText>{plan}</MarkdownText>
          </div>

          <div className="plan-widget-footer">
            {isPendingApproval ? (
              <div className="plan-approval-actions">
                {showFeedbackInput ? (
                  <div className="plan-feedback-row">
                    <input
                      type="text"
                      className="plan-feedback-input"
                      placeholder="Why are you rejecting? (optional)"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRejectWithFeedback();
                        if (e.key === 'Escape') setShowFeedbackInput(false);
                      }}
                      autoFocus
                    />
                    <button
                      className="plan-approval-btn plan-reject-btn"
                      onClick={handleRejectWithFeedback}
                    >
                      Reject
                    </button>
                    <button
                      className="plan-approval-btn plan-cancel-btn"
                      onClick={() => setShowFeedbackInput(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="plan-approval-row">
                    <span className="plan-approval-label">
                      Review the plan and approve to proceed
                    </span>
                    <div className="plan-approval-buttons">
                      <button
                        className="plan-approval-btn plan-reject-btn"
                        onClick={handleReject}
                      >
                        Reject
                      </button>
                      <button
                        className="plan-approval-btn plan-approve-btn"
                        onClick={handleApprove}
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : isResponded ? (
              <div className="plan-widget-info plan-widget-approved">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
                </svg>
                <span>Plan approved</span>
              </div>
            ) : (
              <div className="plan-widget-info">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 16 16"
                  fill="currentColor"
                >
                  <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1113 0 6.5 6.5 0 01-13 0z" />
                  <path d="M8 4a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 018 4zm0 8a1 1 0 100-2 1 1 0 000 2z" />
                </svg>
                <span>Review the plan above and respond to proceed</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanWidget;
