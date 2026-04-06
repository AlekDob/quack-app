import React, { useState, useMemo, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import MarkdownText from './MarkdownText';
import { AgentAvatar } from './AgentAvatar';
import { useTerminalStore } from '../stores/terminalStore';
import './PlanWidget.css';

interface PlanWidgetProps {
  plan: string;
  defaultExpanded?: boolean;
  workingDirectory?: string;
  pendingApprovalRequestId?: string;
  onApprovalResponse?: (requestId: string, approved: boolean, feedback?: string) => void;
  currentSessionId?: string;
}

// Brain: 047-plan-delegate-remote
const PlanWidget: React.FC<PlanWidgetProps> = ({
  plan,
  defaultExpanded = true,
  workingDirectory,
  pendingApprovalRequestId,
  onApprovalResponse,
  currentSessionId,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isCopied, setIsCopied] = useState(false);
  const [isResponded, setIsResponded] = useState(false);
  const [approvalResult, setApprovalResult] = useState<'approved' | 'rejected' | 'delegated' | null>(null);
  const [delegatedTo, setDelegatedTo] = useState<string | null>(null);
  const [showFeedbackInput, setShowFeedbackInput] = useState(false);
  const [showAgentPicker, setShowAgentPicker] = useState(false);
  const [feedback, setFeedback] = useState('');

  // Agent picker: read from synced terminal store (App.tsx syncs useState → Zustand)
  // Filter: same project (cwd) as active agent, excluding self
  const terminals = useTerminalStore(s => s.terminals);
  const activeId = useTerminalStore(s => s.activeId);

  const availableAgents = useMemo(() => {
    const active = terminals.find(t => t.id === activeId);
    if (!active) return terminals.filter(t => t.id !== activeId);
    return terminals.filter(t => t.id !== activeId && t.cwd === active.cwd);
  }, [terminals, activeId]);

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
      await invoke('write_file_content', {
        path: `${planningDir}/${filename}`,
        content: plan,
      });
      toast.success('Plan saved');
    } catch (err) {
      console.error('[PlanWidget] Failed to save:', err);
    }
  };

  const handleApprove = () => {
    if (!pendingApprovalRequestId || !onApprovalResponse) return;
    setIsResponded(true);
    setApprovalResult('approved');
    onApprovalResponse(pendingApprovalRequestId, true);
  };

  const handleReject = () => {
    if (!pendingApprovalRequestId || !onApprovalResponse) return;
    if (showFeedbackInput && feedback.trim()) {
      setIsResponded(true);
      setApprovalResult('rejected');
      onApprovalResponse(pendingApprovalRequestId, false, feedback.trim());
    } else {
      setShowFeedbackInput(true);
    }
  };

  const handleRejectWithFeedback = () => {
    if (!pendingApprovalRequestId || !onApprovalResponse) return;
    setIsResponded(true);
    setApprovalResult('rejected');
    onApprovalResponse(
      pendingApprovalRequestId,
      false,
      feedback.trim() || 'User rejected the plan'
    );
  };

  // Brain: 047-plan-delegate-remote
  const handleDelegateToAgent = useCallback(async (agentId: string) => {
    const agent = terminals.find(t => t.id === agentId);
    if (!agent) return;

    setShowAgentPicker(false);
    setIsResponded(true);
    setApprovalResult('delegated');
    setDelegatedTo(agent.label);

    try {
      // Use Tauri invoke (not HTTP fetch) to avoid CORS issues.
      // The Rust command emits "remote-execute" → App.tsx listener creates session.
      await invoke<string>('delegate_plan_to_agent', {
        agentId,
        prompt: `Execute the following approved plan:\n\n${plan}`,
        leadSessionId: currentSessionId || null,
        projectPath: agent.cwd || workingDirectory || null,
      });

      // Reject locally so the lead agent exits plan mode WITHOUT executing.
      // The feedback tells the agent the plan was delegated to someone else.
      if (pendingApprovalRequestId && onApprovalResponse) {
        onApprovalResponse(
          pendingApprovalRequestId,
          false,
          `Plan delegated to ${agent.label}. Do not execute this plan — another agent is handling it.`
        );
      }

      toast.success(`Plan delegated to ${agent.label}`);
    } catch (err) {
      toast.error(`Delegation failed: ${err}`);
      setIsResponded(false);
      setApprovalResult(null);
      setDelegatedTo(null);
    }
  }, [terminals, plan, currentSessionId, workingDirectory]);

  const planTitle =
    plan.match(/^##\s+(.+)$/m)?.[1] || 'Implementation Plan';

  const isPendingApproval =
    !!pendingApprovalRequestId && !isResponded;

  return (
    <div className={`plan-widget ${isPendingApproval ? 'plan-widget-pending' : ''}`}>
      <div
        className="plan-widget-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="plan-widget-title">
          <span className="plan-title-text">{planTitle}</span>
          {isPendingApproval && (
            <span className="plan-widget-badge">Awaiting Review</span>
          )}
        </div>
        <div className="plan-widget-actions">
          <button
            className="plan-widget-action-btn"
            onClick={(e) => { e.stopPropagation(); handleSaveToFile(); }}
            title="Save plan"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0113.25 16h-9.5A1.75 1.75 0 012 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 00.25-.25V4.664a.25.25 0 00-.073-.177l-2.914-2.914a.25.25 0 00-.177-.073H3.75z" />
            </svg>
          </button>
          <button
            className="plan-widget-action-btn"
            onClick={(e) => { e.stopPropagation(); handleCopy(); }}
            title="Copy plan"
          >
            {isCopied ? (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z" />
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z" />
              </svg>
            )}
          </button>
          <svg
            className={`plan-widget-chevron ${isExpanded ? 'expanded' : ''}`}
            width="14" height="14" viewBox="0 0 16 16" fill="currentColor"
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
                      placeholder="Feedback (optional)"
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRejectWithFeedback();
                        if (e.key === 'Escape') setShowFeedbackInput(false);
                      }}
                      autoFocus
                    />
                    <button className="plan-btn plan-btn-ghost" onClick={handleRejectWithFeedback}>Reject</button>
                    <button className="plan-btn plan-btn-ghost" onClick={() => setShowFeedbackInput(false)}>Cancel</button>
                  </div>
                ) : showAgentPicker ? (
                  <div className="plan-agent-picker">
                    <div className="plan-agent-picker-header">
                      <span>Delegate to</span>
                      <button className="plan-btn plan-btn-ghost" onClick={() => setShowAgentPicker(false)}>Cancel</button>
                    </div>
                    <div className="plan-agent-picker-list">
                      {availableAgents.length === 0 ? (
                        <span className="plan-agent-picker-empty">No agents available</span>
                      ) : (
                        availableAgents.map(agent => (
                          <button
                            key={agent.id}
                            className="plan-agent-picker-row"
                            onClick={() => handleDelegateToAgent(agent.id)}
                          >
                            <AgentAvatar
                              agentName={agent.label}
                              avatarFilename={agent.avatar}
                              className="plan-agent-picker-avatar"
                            />
                            <span className="plan-agent-picker-name">{agent.label}</span>
                            <span className={`plan-agent-picker-status ${agent.status ?? 'idle'}`}>
                              {agent.status ?? 'idle'}
                            </span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="plan-approval-row">
                    <div className="plan-approval-buttons">
                      <button className="plan-btn plan-btn-ghost" onClick={handleReject}>Reject</button>
                      <button className="plan-btn plan-btn-secondary" onClick={() => setShowAgentPicker(true)}>Delegate</button>
                      <button className="plan-btn plan-btn-primary" onClick={handleApprove}>Approve</button>
                    </div>
                  </div>
                )}
              </div>
            ) : isResponded ? (
              <div className={`plan-result ${approvalResult === 'rejected' ? 'plan-result-rejected' : ''}`}>
                <span>
                  {approvalResult === 'delegated'
                    ? `Delegated to ${delegatedTo}`
                    : approvalResult === 'approved'
                      ? 'Plan approved'
                      : 'Plan rejected'}
                </span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlanWidget;
