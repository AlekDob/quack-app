/**
 * Teammate Stream Tab Component
 *
 * Renders a teammate's session stream in a dedicated tab.
 * Watches the session JSONL file for real-time updates via Tauri backend.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useAgentAvatar } from '../hooks/useAgentAvatar';

interface TeammateStreamTabProps {
  sessionId: string;
  teammateName: string;
  teammateColor?: string;
}

interface StreamEvent {
  type: string;
  message?: {
    id?: string;
    content?: ContentBlock[];
  };
  result?: string;
  session_id?: string;
  total_cost_usd?: number;
  usage?: { input_tokens: number; output_tokens: number };
  [key: string]: unknown;
}

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  input?: Record<string, unknown>;
  id?: string;
  thinking?: string;
  tool_use_id?: string;
  content?: string;
  is_error?: boolean;
}

const DEFAULT_COLOR = '#00D9FF';

export function TeammateStreamTab({
  sessionId, teammateName, teammateColor = DEFAULT_COLOR,
}: TeammateStreamTabProps) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const avatarUrl = useAgentAvatar(teammateName);

  const hexToRgba = useCallback((hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }, []);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [events]);

  // Initialize: load existing events and start watching
  useEffect(() => {
    let unlisten: UnlistenFn | null = null;

    const init = async () => {
      try {
        // Load existing events
        const existing = await invoke<StreamEvent[]>(
          'read_teammate_session', { sessionId }
        );
        setEvents(existing);
        setLoading(false);

        // Start file watcher
        await invoke('start_teammate_watcher', {
          sessionId, agentName: teammateName,
        });
        setIsLive(true);

        // Listen for new events
        unlisten = await listen<StreamEvent>(
          `teammate-event:${sessionId}`,
          (event) => {
            const evt = event.payload;
            setEvents(prev => [...prev, evt]);

            // Check if session completed
            if (evt.type === 'result') {
              setIsLive(false);
            }
          }
        );
      } catch (err) {
        console.error('[TeammateStreamTab] Init error:', err);
        setLoading(false);
      }
    };

    init();

    return () => {
      unlisten?.();
      invoke('stop_teammate_watcher', { sessionId }).catch(() => {});
    };
  }, [sessionId, teammateName]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: '#0a0a0f',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '12px 16px',
        borderBottom: `1px solid ${hexToRgba(teammateColor, 0.2)}`,
        background: hexToRgba(teammateColor, 0.05),
        flexShrink: 0,
      }}>
        <img
          src={avatarUrl}
          alt={teammateName}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: `2px solid ${hexToRgba(teammateColor, 0.5)}`,
          }}
        />
        <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
          {teammateName}
        </span>
        {isLive && (
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '10px',
            color: '#4ade80',
          }}>
            <span style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: '#4ade80',
              animation: 'teammate-pulse 1.5s ease-in-out infinite',
            }} />
            Live
          </span>
        )}
        {!isLive && !loading && (
          <span style={{
            fontSize: '10px',
            color: 'rgba(255,255,255,0.4)',
          }}>
            Session ended
          </span>
        )}
      </div>

      {/* Event stream */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
        }}
      >
        {loading && (
          <div style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '12px',
            textAlign: 'center',
            padding: '20px',
          }}>
            Loading session...
          </div>
        )}

        {!loading && events.length === 0 && (
          <div style={{
            color: 'rgba(255,255,255,0.4)',
            fontSize: '12px',
            textAlign: 'center',
            padding: '20px',
          }}>
            No events yet. Waiting for activity...
          </div>
        )}

        {events.map((evt, i) => (
          <EventCard key={i} event={evt} color={teammateColor} />
        ))}
      </div>
    </div>
  );
}

/** Render a single event as a compact card */
function EventCard({ event, color }: { event: StreamEvent; color: string }) {
  const hexToRgba = (hex: string, alpha: number): string => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  if (event.type === 'assistant' && event.message?.content) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {event.message.content.map((block, j) =>
          renderBlock(block, j, color, hexToRgba)
        )}
      </div>
    );
  }

  if (event.type === 'user' && event.message?.content) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {event.message.content.map((block, j) => (
          <div key={j} style={{
            fontSize: '11px',
            color: block.is_error ? '#ef4444' : 'rgba(255,255,255,0.35)',
            padding: '2px 8px',
            fontFamily: 'monospace',
          }}>
            {block.type === 'tool_result' && (
              <span>
                {block.is_error ? 'Error' : 'Result'}: {
                  typeof block.content === 'string'
                    ? block.content.slice(0, 120)
                    : '(output)'
                }
                {typeof block.content === 'string' && block.content.length > 120 ? '...' : ''}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (event.type === 'result') {
    return (
      <div style={{
        fontSize: '11px',
        color: hexToRgba(color, 0.8),
        padding: '6px 8px',
        borderTop: `1px solid ${hexToRgba(color, 0.15)}`,
        marginTop: '4px',
      }}>
        Session completed
        {event.usage && (
          <span style={{ marginLeft: '8px', opacity: 0.6 }}>
            ({event.usage.input_tokens + event.usage.output_tokens} tokens)
          </span>
        )}
        {event.total_cost_usd !== undefined && (
          <span style={{ marginLeft: '8px', opacity: 0.6 }}>
            ${event.total_cost_usd.toFixed(4)}
          </span>
        )}
      </div>
    );
  }

  // System or unknown events — skip silently
  return null;
}

/** Render a content block (text, tool_use, thinking) */
function renderBlock(
  block: ContentBlock,
  key: number,
  color: string,
  hexToRgba: (hex: string, alpha: number) => string,
) {
  if (block.type === 'text' && block.text) {
    return (
      <div key={key} style={{
        fontSize: '12px',
        color: 'rgba(255,255,255,0.85)',
        padding: '2px 0',
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {block.text}
      </div>
    );
  }

  if (block.type === 'tool_use') {
    const filePath = block.input?.file_path || block.input?.path ||
      block.input?.pattern || block.input?.command || '';
    return (
      <div key={key} style={{
        fontSize: '11px',
        padding: '4px 8px',
        borderRadius: '4px',
        background: hexToRgba(color, 0.06),
        border: `1px solid ${hexToRgba(color, 0.12)}`,
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        margin: '2px 0',
      }}>
        <span style={{ color: hexToRgba(color, 0.9), fontWeight: 500 }}>
          {block.name}
        </span>
        {filePath && (
          <span style={{
            color: 'rgba(255,255,255,0.4)',
            fontFamily: 'monospace',
            fontSize: '10px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {String(filePath).length > 60
              ? `...${String(filePath).slice(-57)}`
              : String(filePath)}
          </span>
        )}
      </div>
    );
  }

  if (block.type === 'thinking' && block.thinking) {
    return (
      <div key={key} style={{
        fontSize: '11px',
        color: 'rgba(255,255,255,0.3)',
        padding: '2px 8px',
        fontStyle: 'italic',
        borderLeft: '2px solid rgba(255,255,255,0.1)',
      }}>
        {block.thinking.slice(0, 200)}
        {block.thinking.length > 200 ? '...' : ''}
      </div>
    );
  }

  return null;
}
