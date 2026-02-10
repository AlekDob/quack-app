import { useState, useCallback, useEffect } from 'react';
import type { TerminalInfo, TeamConfig } from '../types';
import { useTeamStore } from '../stores/teamStore';

interface TeamCreationModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  agents: TerminalInfo[];
  editingTeam?: TeamConfig | null;
}

export default function TeamCreationModal({
  isOpen,
  onClose,
  projectPath,
  agents,
  editingTeam,
}: TeamCreationModalProps) {
  const [teamName, setTeamName] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [selectedAgentIds, setSelectedAgentIds] = useState<Set<string>>(new Set());
  const [leadAgentId, setLeadAgentId] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createTeam = useTeamStore((s) => s.createTeam);
  const disbandTeam = useTeamStore((s) => s.disbandTeam);

  const isEditMode = !!editingTeam;

  // Reset or pre-populate form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editingTeam) {
        setTeamName(editingTeam.name);
        setTaskDescription(editingTeam.taskDescription || '');
        setSelectedAgentIds(new Set(editingTeam.members.map((m) => m.agentId)));
        setLeadAgentId(editingTeam.leadAgentId);
      } else {
        setTeamName('');
        setTaskDescription('');
        setSelectedAgentIds(new Set());
        setLeadAgentId('');
      }
      setIsSubmitting(false);
    }
  }, [isOpen, editingTeam]);

  const toggleAgent = useCallback((agentId: string) => {
    setSelectedAgentIds((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
        if (leadAgentId === agentId) setLeadAgentId('');
      } else {
        next.add(agentId);
        if (next.size === 1) setLeadAgentId(agentId);
      }
      return next;
    });
  }, [leadAgentId]);

  const handleSubmit = useCallback(async () => {
    if (isSubmitting || selectedAgentIds.size < 2 || !leadAgentId) return;
    setIsSubmitting(true);

    try {
      const name = teamName.trim() || `Team ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
      // Build avatar map from agents for team enrichment
      const agentAvatars = new Map<string, { avatar?: string; color?: string }>();
      for (const agent of agents) {
        agentAvatars.set(agent.id, { avatar: agent.avatar, color: agent.color });
      }

      // In edit mode: create new team FIRST, then disband old
      // This way if createTeam fails, the old team is still intact
      await createTeam(
        projectPath,
        name,
        leadAgentId,
        Array.from(selectedAgentIds),
        taskDescription.trim() || undefined,
        agentAvatars,
      );

      if (isEditMode && editingTeam) {
        await disbandTeam(projectPath, editingTeam.id);
      }

      onClose();
    } catch (err) {
      console.error('Failed to save team:', err);
      setIsSubmitting(false);
    }
  }, [isSubmitting, selectedAgentIds, leadAgentId, teamName, taskDescription, projectPath, createTeam, disbandTeam, isEditMode, editingTeam, onClose, agents]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && !e.shiftKey && selectedAgentIds.size >= 2 && leadAgentId) {
      e.preventDefault();
      handleSubmit();
    }
  }, [onClose, handleSubmit, selectedAgentIds, leadAgentId]);

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="new-session-modal-backdrop"
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div className="new-session-modal" role="dialog" aria-modal="true" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div className="new-session-modal-header">
          <h2>{isEditMode ? 'Edit Agent Team' : 'Create Agent Team'}</h2>
          <button className="new-session-modal-close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="new-session-modal-content" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {/* Team Name */}
          <div className="new-session-form-field">
            <label htmlFor="team-name">
              Team Name <span className="new-session-optional">(optional)</span>
            </label>
            <input
              id="team-name"
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="e.g., Refactor Auth"
              autoFocus
            />
          </div>

          {/* Task Description */}
          <div className="new-session-form-field">
            <label htmlFor="team-task">
              Task <span className="new-session-optional">(optional)</span>
            </label>
            <input
              id="team-task"
              type="text"
              value={taskDescription}
              onChange={(e) => setTaskDescription(e.target.value)}
              placeholder="What should this team work on?"
            />
          </div>

          {/* Agent Selection */}
          <div className="new-session-form-field">
            <label>Select Agents (min 2)</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: 200, overflowY: 'auto' }}>
              {agents.map((agent) => {
                const isSelected = selectedAgentIds.has(agent.id);
                const isLead = leadAgentId === agent.id;

                return (
                  <div
                    key={agent.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${isSelected ? agent.color + '55' : 'rgba(255,255,255,0.08)'}`,
                      background: isSelected ? `${agent.color}10` : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onClick={() => toggleAgent(agent.id)}
                  >
                    {/* Checkbox */}
                    <div style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      border: `2px solid ${isSelected ? agent.color : 'rgba(255,255,255,0.2)'}`,
                      background: isSelected ? agent.color : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {isSelected && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>

                    {/* Avatar dot */}
                    <div style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: agent.color,
                      flexShrink: 0,
                    }} />

                    {/* Name */}
                    <span style={{
                      fontSize: '0.8rem',
                      color: 'rgba(255,255,255,0.85)',
                      flex: 1,
                    }}>
                      {agent.label}
                    </span>

                    {/* Lead radio */}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setLeadAgentId(agent.id);
                        }}
                        style={{
                          padding: '2px 6px',
                          borderRadius: 4,
                          border: `1px solid ${isLead ? 'rgba(255,107,53,0.5)' : 'rgba(255,255,255,0.15)'}`,
                          background: isLead ? 'rgba(255,107,53,0.2)' : 'transparent',
                          color: isLead ? 'rgba(255,107,53,0.9)' : 'rgba(255,255,255,0.4)',
                          fontSize: '0.65rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {isLead ? 'LEAD' : 'Set Lead'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Warning */}
          <div style={{
            padding: '8px 10px',
            borderRadius: 6,
            background: 'rgba(255, 200, 0, 0.08)',
            border: '1px solid rgba(255, 200, 0, 0.15)',
            fontSize: '0.7rem',
            color: 'rgba(255, 200, 0, 0.7)',
            lineHeight: 1.4,
          }}>
            Each teammate runs a separate Claude Code session. Token usage scales with team size.
          </div>
        </div>

        {/* Footer */}
        <div className="new-session-modal-footer">
          <button className="new-session-button secondary" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </button>
          <button
            className="new-session-button primary"
            onClick={handleSubmit}
            disabled={isSubmitting || selectedAgentIds.size < 2 || !leadAgentId}
            style={{
              background: 'rgba(255, 107, 53, 0.2)',
              color: 'rgba(255, 107, 53, 0.95)',
              borderColor: 'rgba(255, 107, 53, 0.3)',
            }}
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Save Changes' : 'Create Team'}
          </button>
        </div>
      </div>
    </div>
  );
}
