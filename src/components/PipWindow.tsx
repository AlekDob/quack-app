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

  // Group agents by status
  const groupedAgents = useMemo(() => {
    const groups = new Map<StatusGroup, PipAgentState[]>();
    for (const agent of agents) {
      const group = STATUS_GROUP_MAP[agent.status] || 'idle';
      const list = groups.get(group) || [];
      list.push(agent);
      groups.set(group, list);
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
    </div>
  );
};

export default PipWindow;
