import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { listen, emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import PipAgentCard from './PipAgentCard';
import type { PipAgentState, PipAgentStatus } from '../types';

// Status grouping: active first, then idle/completed
type StatusGroup = 'working' | 'done' | 'idle';

const STATUS_GROUP_MAP: Record<PipAgentStatus, StatusGroup> = {
  streaming: 'working',
  executing: 'working',
  thinking: 'working',
  error: 'working',
  completed: 'done',
  idle: 'idle',
};

const GROUP_LABELS: Record<StatusGroup, string> = {
  working: 'Working',
  done: 'Completed',
  idle: 'Idle',
};

// Group order priority
const GROUP_ORDER: StatusGroup[] = ['working', 'done', 'idle'];

const PipWindow: React.FC = () => {
  const [agents, setAgents] = useState<PipAgentState[]>([]);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; agent: PipAgentState } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ agentId: string; sessionId: string; currentTitle: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');

  useEffect(() => {
    const unlisten = listen<PipAgentState[]>('pip-agents-update', (event) => {
      setAgents(event.payload);
    });
    emit('pip-window-ready');
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleAgentClick = useCallback((agent: PipAgentState) => {
    emit('pip-agent-clicked', {
      agentId: agent.agentId,
      sessionId: agent.sessionId,
    });
  }, []);

  // Context menu handlers
  const handleCardContextMenu = useCallback((e: React.MouseEvent, agent: PipAgentState) => {
    if (!agent.sessionId) return;
    setContextMenu({ x: e.clientX, y: e.clientY, agent });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    document.addEventListener('click', close);
    document.addEventListener('contextmenu', close);
    return () => {
      document.removeEventListener('click', close);
      document.removeEventListener('contextmenu', close);
    };
  }, [contextMenu]);

  const handleMarkDone = useCallback(() => {
    if (!contextMenu?.agent.sessionId) return;
    emit('pip-session-mark-done', { sessionId: contextMenu.agent.sessionId });
    setContextMenu(null);
  }, [contextMenu]);

  const handleDelete = useCallback(() => {
    if (!contextMenu?.agent.sessionId) return;
    emit('pip-session-delete', { sessionId: contextMenu.agent.sessionId });
    setContextMenu(null);
  }, [contextMenu]);

  const handleRenameRequest = useCallback(() => {
    if (!contextMenu?.agent.sessionId) return;
    setRenameDialog({
      agentId: contextMenu.agent.agentId,
      sessionId: contextMenu.agent.sessionId,
      currentTitle: contextMenu.agent.lastMessage || contextMenu.agent.agentName,
    });
    setRenameValue(contextMenu.agent.lastMessage || contextMenu.agent.agentName);
    setContextMenu(null);
  }, [contextMenu]);

  const handleRenameConfirm = useCallback(() => {
    if (!renameDialog || !renameValue.trim()) return;
    emit('pip-session-rename', { sessionId: renameDialog.sessionId, newTitle: renameValue.trim() });
    setRenameDialog(null);
    setRenameValue('');
  }, [renameDialog, renameValue]);

  const handleRenameCancel = useCallback(() => {
    setRenameDialog(null);
    setRenameValue('');
  }, []);

  const handleDragStart = useCallback(async () => {
    try { await getCurrentWindow().startDragging(); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const handleBeforeUnload = async () => {
      const w = getCurrentWindow();
      const pos = await w.outerPosition();
      const size = await w.outerSize();
      await emit('pip-window-closing', {
        position: { x: pos.x, y: pos.y },
        size: { width: size.width, height: size.height },
      });
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Group agents by status, sorted by lastActivity descending (most recent first)
  const groupedAgents = useMemo(() => {
    const groups = new Map<StatusGroup, PipAgentState[]>();
    for (const agent of agents) {
      const group = STATUS_GROUP_MAP[agent.status] || 'idle';
      const list = groups.get(group) || [];
      list.push(agent);
      groups.set(group, list);
    }
    // Sort each group: most recent activity first
    for (const [, list] of groups) {
      list.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
    }
    return GROUP_ORDER
      .filter((g) => groups.has(g))
      .map((g) => ({ group: g, label: GROUP_LABELS[g], items: groups.get(g)! }));
  }, [agents]);

  const workingCount = agents.filter(
    (a) => a.status !== 'idle' && a.status !== 'completed'
  ).length;

  return (
    <div style={{
      width: '100%',
      height: '100%',
      background: 'rgba(10, 12, 16, 0.96)',
      backdropFilter: 'blur(20px)',
      borderRadius: '0',
      overflow: 'hidden',
      border: 'none',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    }}>
      {/* Titlebar */}
      <div
        onMouseDown={handleDragStart}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'rgba(20, 24, 32, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-color, #f28c52)' }}>
            Active Agents
          </span>
          {agents.length > 0 && (
            <span style={{
              fontSize: '10px',
              fontWeight: 600,
              color: 'var(--accent-color, #f28c52)',
              background: 'var(--accent-surface, rgba(242, 140, 82, 0.10))',
              padding: '1px 6px',
              borderRadius: '999px',
            }}>
              {agents.length}
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            type="button"
            onClick={async () => getCurrentWindow().minimize()}
            style={{
              width: '20px', height: '20px', borderRadius: '50%', border: 'none',
              background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer', fontSize: '10px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            -
          </button>
          <button
            type="button"
            onClick={async () => getCurrentWindow().close()}
            style={{
              width: '20px', height: '20px', borderRadius: '50%', border: 'none',
              background: 'rgba(255, 255, 255, 0.05)', color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer', fontSize: '10px', display: 'flex',
              alignItems: 'center', justifyContent: 'center',
            }}
          >
            x
          </button>
        </div>
      </div>

      {/* Agent list — scrollable, grouped by status */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '6px 8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
        scrollbarWidth: 'thin',
        scrollbarColor: 'var(--accent-border, rgba(242, 140, 82, 0.25)) transparent',
      }}>
        {agents.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', flex: 1, color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '12px', padding: '24px 0', gap: '8px',
          }}>
            No active sessions
          </div>
        ) : (
          groupedAgents.map(({ group, label, items }) => (
            <div key={group}>
              <div style={{
                fontSize: '9px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                color: 'rgba(255, 255, 255, 0.35)',
                padding: '6px 4px 3px',
              }}>
                {label} {items.length}
              </div>
              {items.map((agent) => (
                <PipAgentCard
                  key={`${agent.agentId}-${agent.sessionId}`}
                  agent={agent}
                  onClickAgent={handleAgentClick}
                  onContextMenu={handleCardContextMenu}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {agents.length > 0 && (
        <div style={{
          padding: '5px 12px',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.35)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          textAlign: 'center',
        }}>
          {workingCount > 0 ? `${workingCount} working` : 'All idle'}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: contextMenu.x,
            top: contextMenu.y,
            zIndex: 99999,
            background: 'rgba(30, 30, 35, 0.98)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '8px',
            padding: '4px',
            minWidth: '160px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <button
            onClick={handleMarkDone}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '6px 10px', background: 'transparent', border: 'none',
              borderRadius: '4px', color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '11px', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Mark as Done
          </button>
          <button
            onClick={handleRenameRequest}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '6px 10px', background: 'transparent', border: 'none',
              borderRadius: '4px', color: 'rgba(255, 255, 255, 0.9)',
              fontSize: '11px', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
            </svg>
            Rename Session
          </button>
          <button
            onClick={handleDelete}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
              padding: '6px 10px', background: 'transparent', border: 'none',
              borderRadius: '4px', color: '#ef4444',
              fontSize: '11px', cursor: 'pointer',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            </svg>
            Delete Session
          </button>
        </div>
      )}

      {/* Rename Dialog */}
      {renameDialog && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 100000,
          background: 'rgba(0, 0, 0, 0.5)', backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: 'rgba(30, 30, 35, 0.98)', border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px', padding: '16px', width: '260px',
            boxShadow: '0 12px 40px rgba(0, 0, 0, 0.5)',
          }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: '#e7ebf3', marginBottom: '10px' }}>
              Rename Session
            </div>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm();
                if (e.key === 'Escape') handleRenameCancel();
              }}
              autoFocus
              style={{
                width: '100%', padding: '8px 10px', fontSize: '11px',
                background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '6px', color: '#e7ebf3', outline: 'none',
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '10px' }}>
              <button
                onClick={handleRenameCancel}
                style={{
                  padding: '5px 12px', fontSize: '10px', background: 'transparent',
                  border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '6px',
                  color: 'rgba(255, 255, 255, 0.7)', cursor: 'pointer',
                }}
              >
                Annulla
              </button>
              <button
                onClick={handleRenameConfirm}
                style={{
                  padding: '5px 12px', fontSize: '10px',
                  background: 'var(--accent-color, #f28c52)', border: 'none',
                  borderRadius: '6px', color: '#fff', cursor: 'pointer', fontWeight: 600,
                }}
              >
                Rinomina
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipWindow;
