import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { executeRemoteTask } from '../services/remoteApi';
import { useSessionStore } from '../stores/sessionStore';
import { useTerminalStore } from '../stores/terminalStore';
import './TeamDelegationPopover.css';

interface TeamDelegationPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  currentSessionId: string;
  projectPath: string;
}

// Brain: 025-team-delegation-footer
export default function TeamDelegationPopover({
  isOpen,
  onClose,
  currentSessionId,
  projectPath,
}: TeamDelegationPopoverProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [task, setTask] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Read local agents from terminal store (sidebar agents)
  const terminals = useTerminalStore(s => s.terminals);
  const sessions = useSessionStore(s => s.sessions);

  // Derive current agent ID from session
  const resolvedAgentId = useMemo(() => {
    const session = sessions.find(s => s.id === currentSessionId);
    return session?.agentId ?? '';
  }, [currentSessionId, sessions]);

  // Filter: show all project agents except the current one
  const available = useMemo(() => {
    return terminals.filter(t => t.id !== resolvedAgentId);
  }, [terminals, resolvedAgentId]);

  useEffect(() => {
    if (!isOpen) return;
    setSelected(new Set());
    setTask('');
    setError(null);
  }, [isOpen]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  const toggleAgent = useCallback((id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleDelegate = useCallback(async () => {
    if (selected.size === 0 || !task.trim()) return;
    setLoading(true);
    setError(null);

    let successCount = 0;
    const errors: string[] = [];

    for (const agentId of selected) {
      const agent = terminals.find(t => t.id === agentId);
      const agentProject = agent?.cwd || projectPath;
      const result = await executeRemoteTask({
        agentId,
        prompt: task.trim(),
        leadSessionId: currentSessionId,
        projectPath: agentProject || projectPath,
      });
      if (result.success) successCount++;
      else errors.push(`${agent?.label ?? agentId}: ${result.error}`);
    }

    setLoading(false);
    if (errors.length > 0) {
      setError(errors.join(', '));
    }
    if (successCount > 0) {
      onClose();
    }
  }, [selected, task, terminals, currentSessionId, projectPath, onClose]);

  if (!isOpen) return null;

  return (
    <div className="team-delegation-popover" ref={popoverRef}>
      <div className="team-delegation-header">
        <span>Delega al Team</span>
        <button className="team-delegation-close" onClick={onClose}>×</button>
      </div>

      {available.length === 0 ? (
        <div className="team-delegation-empty">
          Nessun agente disponibile
        </div>
      ) : (
        <div className="team-delegation-agents">
          {available.map(agent => (
            <label key={agent.id} className="team-delegation-agent-row">
              <input
                type="checkbox"
                checked={selected.has(agent.id)}
                onChange={() => toggleAgent(agent.id)}
              />
              <span className="team-delegation-agent-name">{agent.label}</span>
              <span className={`team-delegation-agent-status ${agent.status ?? 'idle'}`}>
                {agent.status ?? 'idle'}
              </span>
            </label>
          ))}
        </div>
      )}

      <textarea
        className="team-delegation-task"
        placeholder="Descrivi il task da delegare..."
        value={task}
        onChange={e => setTask(e.target.value)}
        rows={3}
      />

      {error && <div className="team-delegation-error">{error}</div>}

      <button
        className="team-delegation-submit"
        disabled={loading || selected.size === 0 || !task.trim()}
        onClick={handleDelegate}
      >
        {loading ? 'Delegando...' : `Delega a ${selected.size} agent${selected.size !== 1 ? 'i' : 'e'}`}
      </button>
    </div>
  );
}
