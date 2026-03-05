import React, { useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import { emit } from '@tauri-apps/api/event';
import { getCurrentWindow } from '@tauri-apps/api/window';
import PipAgentCard from './PipAgentCard';
import type { PipAgentState } from '../types';

const PipWindow: React.FC = () => {
  const [agents, setAgents] = useState<PipAgentState[]>([]);
  const [, setIsDragging] = useState(false);

  // Listen for agent state updates from main window
  useEffect(() => {
    const unlisten = listen<PipAgentState[]>('pip-agents-update', (event) => {
      setAgents(event.payload);
    });

    // Request initial agent data
    emit('pip-window-ready');

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  // Handle agent click - send event to main window to focus on that agent
  const handleAgentClick = useCallback((agent: PipAgentState) => {
    emit('pip-agent-clicked', {
      agentId: agent.agentId,
      sessionId: agent.sessionId,
    });
  }, []);

  // Handle titlebar drag to move window
  const handleTitlebarMouseDown = useCallback(async () => {
    setIsDragging(true);
    const window = getCurrentWindow();
    try {
      await window.startDragging();
    } catch (error) {
      console.error('🦆 Failed to start window dragging:', error);
    }
  }, []);

  const handleTitlebarMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle window close - save position and size
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const window = getCurrentWindow();
      const position = await window.outerPosition();
      const size = await window.outerSize();

      await emit('pip-window-closing', {
        position: { x: position.x, y: position.y },
        size: { width: size.width, height: size.height },
      });
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return (
    <div
      className="pip-window"
      style={{
        width: '100%',
        height: '100%',
        background: 'rgba(10, 12, 16, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRadius: '12px',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Title Bar - Draggable */}
      <div
        className="pip-titlebar flex items-center justify-between px-4 py-3 cursor-move select-none"
        style={{
          background: 'rgba(20, 24, 32, 0.8)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
        onMouseDown={handleTitlebarMouseDown}
        onMouseUp={handleTitlebarMouseUp}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">🦆</span>
          <span className="text-sm font-semibold" style={{ color: '#f28c52' }}>
            Active Agents
          </span>
          {agents.length > 0 && (
            <span
              className="px-1.5 py-0.5 rounded text-xs font-medium"
              style={{
                background: 'rgba(242, 140, 82, 0.2)',
                color: '#f28c52',
              }}
            >
              {agents.length}
            </span>
          )}
        </div>

        {/* Window Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={async () => {
              const window = getCurrentWindow();
              await window.minimize();
            }}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>─</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              const window = getCurrentWindow();
              await window.close();
            }}
            className="w-6 h-6 rounded-full flex items-center justify-center transition-colors"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
            }}
          >
            <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.6)' }}>×</span>
          </button>
        </div>
      </div>

      {/* Content - Scrollable Agent List */}
      <div
        className="pip-content flex-1 overflow-y-auto p-4"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(242, 140, 82, 0.3) rgba(255, 255, 255, 0.05)',
        }}
      >
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="text-5xl mb-4">🦆</div>
            <div
              className="text-sm font-medium mb-2"
              style={{ color: 'rgba(255, 255, 255, 0.7)' }}
            >
              No Active Agents
            </div>
            <div
              className="text-xs"
              style={{ color: 'rgba(255, 255, 255, 0.5)' }}
            >
              Start a chat in the main window to see agents here
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {agents.map((agent) => (
              <PipAgentCard
                key={agent.agentId}
                agent={agent}
                onClick={() => handleAgentClick(agent)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer - Optional Stats */}
      {agents.length > 0 && (
        <div
          className="pip-footer px-4 py-2 text-xs text-center"
          style={{
            background: 'rgba(20, 24, 32, 0.6)',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            color: 'rgba(255, 255, 255, 0.5)',
          }}
        >
          {agents.filter((a) => a.status !== 'idle' && a.status !== 'completed').length > 0 && (
            <>
              {agents.filter((a) => a.status !== 'idle' && a.status !== 'completed').length} agent
              {agents.filter((a) => a.status !== 'idle' && a.status !== 'completed').length === 1
                ? ' is'
                : 's are'}{' '}
              working
            </>
          )}
          {agents.filter((a) => a.status !== 'idle' && a.status !== 'completed').length === 0 && (
            <>All agents idle</>
          )}
        </div>
      )}
    </div>
  );
};

export default PipWindow;
