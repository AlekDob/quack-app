import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useJackChat } from '../../hooks/useJackChat';
import { useJackStore } from '../../stores/jackStore';
import { AgentAvatar } from '../AgentAvatar';
import MessageList from '../MessageList';
import { JACK_AGENT_ID, JACK_AVATAR } from '../../services/jackPersonalityService';
import { compressImage, blobToBase64 } from '../../utils/imageCompression';
import type { JackTimelineItem } from '../../stores/jackStore';
import type { ChatMessage, AskUserQuestionAnswers, ClaudeEvent } from '../../types';

interface PastedImage {
  id: string;
  path: string;
  previewUrl: string;
  name: string;
}

const MAX_JACK_IMAGES = 6;

function extToMime(ext: string): string {
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp',
  };
  return map[ext.toLowerCase()] || 'image/png';
}

function mimeToExt(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'image/webp') return 'webp';
  return 'png';
}

function timelineToMessages(timeline: JackTimelineItem[]): ChatMessage[] {
  const out: ChatMessage[] = [];
  let buffer: { events: ClaudeEvent[]; timestamp: number; id: string } | null = null;
  const flush = () => {
    if (!buffer) return;
    out.push({
      id: buffer.id,
      role: 'assistant',
      content: '',
      timestamp: buffer.timestamp,
      events: buffer.events,
    });
    buffer = null;
  };
  for (const item of timeline) {
    if (item.kind === 'user') {
      flush();
      out.push({
        id: item.id,
        role: 'user',
        content: item.content,
        timestamp: item.timestamp,
      });
    } else {
      if (!buffer) buffer = { events: [], timestamp: item.timestamp, id: item.id };
      buffer.events.push(item.event);
    }
  }
  flush();
  return out;
}

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
  const isThisSessionStreaming = isStreaming && streamingSessionId === activeSessionId;

  const [input, setInput] = useState('');
  const [pastedImages, setPastedImages] = useState<PastedImage[]>([]);
  const [pasteError, setPasteError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const handlePaste = useCallback(
    async (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = event.clipboardData?.items;
      if (!items) return;
      const files = Array.from(items)
        .filter((i) => i.kind === 'file')
        .map((i) => i.getAsFile())
        .filter((f): f is File => Boolean(f) && f!.type.startsWith('image/'));
      if (files.length === 0) return;
      event.preventDefault();

      for (const file of files) {
        if (pastedImages.length >= MAX_JACK_IMAGES) {
          setPasteError(`Max ${MAX_JACK_IMAGES} immagini per messaggio.`);
          break;
        }
        try {
          const result = await compressImage(file);
          const ext = mimeToExt(file.type);
          const base64 = await blobToBase64(result.blob);
          const tempPath = await invoke<string>('save_clipboard_file', {
            dataBase64: base64,
            extension: ext,
            suggestedName: file.name ?? null,
          });
          const previewUrl = `data:${extToMime(ext)};base64,${base64}`;
          const entry: PastedImage = {
            id: `img-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            path: tempPath,
            previewUrl,
            name: file.name || `image.${ext}`,
          };
          setPastedImages((prev) => [...prev, entry]);
          setPasteError(null);
        } catch (err) {
          console.error('Jack: paste image failed', err);
          setPasteError('Impossibile incollare immagine.');
        }
      }
    },
    [pastedImages.length]
  );

  const removeImage = useCallback((id: string) => {
    setPastedImages((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // AskUserQuestion: listen for events targeting Jack
  const pendingRequestsRef = useRef<Array<{ requestId: string; sessionKey?: string }>>([]);
  const [pendingQuestionIds, setPendingQuestionIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unlisten = listen<{
      requestId: string;
      questions: unknown[];
      agentId: string;
      sessionKey?: string;
    }>('ask-user-question', (event) => {
      if (event.payload.agentId !== JACK_AGENT_ID) return;
      const { requestId, sessionKey } = event.payload;
      pendingRequestsRef.current.push({ requestId, sessionKey });
      setPendingQuestionIds((prev) => {
        const next = new Set(prev);
        next.add(requestId);
        return next;
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handleUserQuestionAnswer = useCallback(
    async (_toolUseId: string, answers: AskUserQuestionAnswers) => {
      const pending = pendingRequestsRef.current;
      if (pending.length === 0) return;
      const { requestId } = pending[pending.length - 1];
      pendingRequestsRef.current = pending.slice(0, -1);
      try {
        await invoke('answer_user_question', {
          agentId: JACK_AGENT_ID,
          requestId,
          answers,
        });
      } catch (err) {
        console.error('Jack: failed to submit answer', err);
      }
      setPendingQuestionIds((prev) => {
        const next = new Set(prev);
        next.delete(requestId);
        return next;
      });
    },
    []
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, [activeSessionId]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if ((!trimmed && pastedImages.length === 0) || isStreaming) return;
    let text = trimmed;
    if (pastedImages.length > 0) {
      const list = pastedImages.map((i) => `- ${i.path}`).join('\n');
      text = `${trimmed}\n\n[Pasted images — read them with Read tool to see content]\n${list}`.trim();
    }
    setInput('');
    setPastedImages([]);
    setPasteError(null);
    await sendMessage(text);
  }, [input, isStreaming, sendMessage, pastedImages]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const messages = useMemo<ChatMessage[]>(
    () => (activeSession ? timelineToMessages(activeSession.timeline) : []),
    [activeSession]
  );

  const isEmpty = messages.length === 0;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      flex: 1,
      overflow: 'hidden',
    }}>
      {/* Messages */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {isEmpty ? (
          <EmptyState />
        ) : (
          <MessageList
            messages={messages}
            loading={isThisSessionStreaming}
            agentName="Jack"
            agentAvatar={JACK_AVATAR}
            onUserQuestionAnswer={handleUserQuestionAnswer}
            pendingQuestionIds={pendingQuestionIds}
            showThinkingBlocks={true}
            currentSessionId={activeSessionId ?? undefined}
          />
        )}

        {error && (
          <div style={{
            padding: '8px 12px',
            margin: '0 16px 8px',
            background: 'rgba(239,68,68,0.15)',
            borderRadius: 8,
            color: '#f87171',
            fontSize: 13,
          }}>
            {error}
          </div>
        )}
      </div>

      {/* Pasted images preview */}
      {(pastedImages.length > 0 || pasteError) && (
        <div style={{
          padding: '8px 16px 0',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          flexShrink: 0,
        }}>
          {pasteError && (
            <div style={{ fontSize: 12, color: '#f87171' }}>{pasteError}</div>
          )}
          {pastedImages.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {pastedImages.map((img) => (
                <div key={img.id} style={{
                  position: 'relative',
                  width: 56, height: 56,
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.15)',
                }}>
                  <img src={img.previewUrl} alt={img.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button
                    onClick={() => removeImage(img.id)}
                    aria-label="Remove image"
                    style={{
                      position: 'absolute', top: 2, right: 2,
                      width: 18, height: 18,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(0,0,0,0.7)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: 12,
                      lineHeight: '18px',
                      padding: 0,
                    }}
                  >×</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

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
          onPaste={handlePaste}
          placeholder="Chiedi qualcosa a Jack... (incolla immagini con Cmd+V)"
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
            disabled={(!input.trim() && pastedImages.length === 0) || isStreaming}
            title={isStreaming ? 'Un\'altra sessione sta streamando, aspetta...' : undefined}
            style={btnStyle((input.trim() || pastedImages.length > 0) && !isStreaming ? 'var(--accent, #FF6B35)' : '#555')}
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
