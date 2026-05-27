import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useJackChat } from '../../hooks/useJackChat';
import { useJackStore } from '../../stores/jackStore';
import { AgentAvatar } from '../AgentAvatar';
import StreamMessage from '../StreamMessage';
import { JACK_AVATAR } from '../../services/jackPersonalityService';
import type { JackTimelineItem } from '../../stores/jackStore';
import type { ClaudeEvent } from '../../types';
import '../StreamMessage.css';

export default function JackChat() {
  const agents = useJackStore((s) => s.agents);
  const projects = useJackStore((s) => s.projects);
  const sessions = useJackStore((s) => s.sessions);
  const activeSessionId = useJackStore((s) => s.activeSessionId);
  const streamingSessionId = useJackStore((s) => s.streamingSessionId);

  const activeSession = useMemo(
    () => sessions.find((s) => s.id === activeSessionId),
    [sessions, activeSessionId]
  );

  const { isStreaming, error, sendMessage, stopStreaming } =
    useJackChat({ agents, projects });

  // Brain: fix-jack-multisession-events-wrong-session
  // L'UI di streaming (Stop, "sta pensando") deve mostrarsi solo sulla sessione
  // che sta effettivamente streamando, non su tutte quante.
  const isThisSessionStreaming = isStreaming && streamingSessionId === activeSessionId;

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.timeline.length, isStreaming]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  }, [input, isStreaming, sendMessage]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Build the linear stream events list for StreamMessage's `streamMessages` prop
  const streamEvents = useMemo<ClaudeEvent[]>(() => {
    if (!activeSession) return [];
    return activeSession.timeline
      .filter((it): it is Extract<JackTimelineItem, { kind: 'event' }> => it.kind === 'event')
      .map((it) => it.event);
  }, [activeSession]);

  const timeline = activeSession?.timeline ?? [];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      overflow: 'hidden',
    }}>
      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '16px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}>
        {timeline.length === 0 && <EmptyState />}

        {timeline.map((item, idx) => {
          if (item.kind === 'user') {
            return <UserBubble key={item.id} content={item.content} />;
          }
          // Hide consecutive headers when same role
          const prev = timeline[idx - 1];
          const showHeader = !prev || prev.kind === 'user';
          return (
            <div key={item.id} className="stream-message-wrapper">
              <StreamMessage
                message={item.event}
                streamMessages={streamEvents}
                agentName="Jack"
                agentAvatar={JACK_AVATAR}
                showHeader={showHeader}
                showThinkingBlocks={true}
              />
            </div>
          );
        })}

        {isThisSessionStreaming && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: 0.5, padding: '4px 8px' }}>
            <span style={{ fontSize: 12 }}>Jack sta pensando...</span>
          </div>
        )}

        {error && (
          <div style={{
            padding: '8px 12px',
            background: 'rgba(239,68,68,0.15)',
            borderRadius: 8,
            color: '#f87171',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div style={{
        padding: '12px 16px',
        borderTop: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        gap: 8,
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Chiedi qualcosa a Jack..."
          rows={1}
          style={{
            flex: 1,
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            padding: '10px 12px',
            color: 'inherit',
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'none',
            outline: 'none',
            maxHeight: 120,
          }}
        />
        {isThisSessionStreaming ? (
          <button onClick={stopStreaming} style={btnStyle('#ef4444')}>Stop</button>
        ) : (
          <button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            title={isStreaming ? 'Un\'altra sessione sta streamando, aspetta...' : undefined}
            style={btnStyle(input.trim() && !isStreaming ? 'var(--accent, #FF6B35)' : '#555')}
          >
            Invia
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      opacity: 0.6,
      gap: 10,
      paddingTop: 60,
    }}>
      <AgentAvatar
        agentName="Jack"
        avatarFilename={JACK_AVATAR}
        style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
      />
      <div style={{ fontSize: 15, fontWeight: 500 }}>Jack — Project Manager</div>
      <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 280 }}>
        Chiedi stato progetti, delega task, organizza il lavoro
      </div>
    </div>
  );
}

function UserBubble({ content }: { content: string }) {
  return (
    <div style={{
      alignSelf: 'flex-end',
      maxWidth: '85%',
      padding: '10px 14px',
      borderRadius: 12,
      background: 'var(--accent, #FF6B35)',
      color: '#fff',
      fontSize: 14,
      lineHeight: 1.5,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {content}
    </div>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '8px 16px',
    background: bg,
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    flexShrink: 0,
  };
}
