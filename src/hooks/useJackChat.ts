import { useState, useCallback, useRef, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '../stores/settingsStore';
import { getProviderRequestFields } from '../services/claudeSDK';
import { getModelId } from '../services/modelService';
import {
  JACK_AGENT_ID,
  JACK_EVENT_NAME,
  buildJackSystemPrompt,
} from '../services/jackPersonalityService';
import { useJackStore } from '../stores/jackStore';
import { isSdkStreamEnabled, SDK_DISABLED_MESSAGE } from '../utils/sdkStreamGuard';
import type { JackAgentSnapshot, JackProjectSnapshot, JackTimelineItem } from '../stores/jackStore';
import type { ClaudeEvent } from '../types';

const MAX_CONTEXT_CHARS = 50_000;

interface UseJackChatOptions {
  agents: JackAgentSnapshot[];
  projects: JackProjectSnapshot[];
}

interface UseJackChatReturn {
  isStreaming: boolean;
  error: string | undefined;
  sendMessage: (text: string) => Promise<void>;
  stopStreaming: () => Promise<void>;
}

function isAssistantText(event: ClaudeEvent): string {
  if (event.type !== 'assistant' || !event.message?.content) return '';
  const blocks = event.message.content as Array<{ type: string; text?: string }>;
  return blocks
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('');
}

function buildHistoryFromTimeline(timeline: JackTimelineItem[]): string {
  if (!timeline.length) return '';
  const recent = timeline.slice(-40);
  const lines: string[] = [];
  for (const item of recent) {
    if (item.kind === 'user') {
      const content = item.content.length > 4000
        ? item.content.slice(0, 4000) + '...[truncated]'
        : item.content;
      lines.push(`[User]: ${content}`);
    } else {
      const text = isAssistantText(item.event);
      if (text) {
        const trimmed = text.length > 4000 ? text.slice(0, 4000) + '...[truncated]' : text;
        lines.push(`[Assistant]: ${trimmed}`);
      }
    }
  }
  return lines.join('\n\n');
}

export function useJackChat(options: UseJackChatOptions): UseJackChatReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const unlistenRef = useRef<(() => void) | null>(null);
  const isStreamingRef = useRef(false);
  isStreamingRef.current = isStreaming;
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isStreamingRef.current) return;

    // Fase 9 (069): graceful degradation when the SDK stream kill-switch is on.
    if (!isSdkStreamEnabled()) {
      setError(SDK_DISABLED_MESSAGE);
      return;
    }

    const store = useJackStore.getState();
    let session = store.sessions.find((s) => s.id === store.activeSessionId);
    if (!session) {
      session = store.createSession();
    }
    const sessionId = session.id;

    // Auto-title from first user message
    if (session.timeline.length === 0) {
      const title = text.trim().slice(0, 50);
      store.renameSession(sessionId, title);
    }

    // Brain: fix-jack-multisession-events-wrong-session
    // sessionId catturato qui DEVE essere usato per ogni append (utente + eventi).
    // Mai usare activeSessionId dallo store durante callback async — l'utente
    // puo' switchare sessione durante lo streaming, eventi atterrerebbero altrove.
    const userItem: JackTimelineItem = {
      kind: 'user',
      id: `user-${Date.now()}`,
      content: text.trim(),
      timestamp: Date.now(),
    };
    store.appendToSession(sessionId, userItem);

    setIsStreaming(true);
    setError(undefined);
    useJackStore.getState().setStreamingSessionId(sessionId);

    const sessionKey = `jack-${Date.now()}`;

    try {
      unlistenRef.current?.();
      unlistenRef.current = await listen<{ sessionKey: string; event: ClaudeEvent }>(
        JACK_EVENT_NAME,
        (payload) => {
          const { sessionKey: evtKey, event: claudeEvent } = payload.payload;
          if (evtKey !== sessionKey) return;

          // Capture SDK session ID for multi-turn continuation
          const evt = claudeEvent as { session_id?: string };
          if (evt.session_id) {
            useJackStore.getState().setSdkSessionId(sessionId, evt.session_id);
          }

          useJackStore.getState().appendToSession(sessionId, {
            kind: 'event',
            id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            event: claudeEvent,
            timestamp: Date.now(),
          });
        }
      );

      const { agents, projects } = optionsRef.current;
      const systemContext = buildJackSystemPrompt(agents, projects);
      const history = buildHistoryFromTimeline(session.timeline);

      let fullPrompt = [systemContext, history, `[User]: ${text.trim()}`]
        .filter(Boolean)
        .join('\n\n');
      if (fullPrompt.length > MAX_CONTEXT_CHARS) {
        fullPrompt = fullPrompt.slice(-MAX_CONTEXT_CHARS);
      }

      const prf = getProviderRequestFields();
      const claude = useSettingsStore.getState().claude;
      const model = claude.jackModel || claude.model || 'sonnet';
      const resolvedModel = prf.provider ? prf.resolveModel(model) : getModelId(model);

      await invoke('send_message_via_sdk_streaming', {
        agentId: JACK_AGENT_ID,
        request: {
          prompt: fullPrompt,
          model: resolvedModel,
          permissionMode: 'bypass',
          sessionKey,
          sessionId: session.sdkSessionId ?? undefined,
          provider: prf.provider,
          providerBaseUrl: prf.providerBaseUrl,
          providerApiKey: prf.providerApiKey,
          toolSearchMode: useSettingsStore.getState().claude.toolSearchMode,
        },
      });

      setIsStreaming(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setIsStreaming(false);
    } finally {
      unlistenRef.current?.();
      unlistenRef.current = null;
      useJackStore.getState().setStreamingSessionId(null);
    }
  }, []);

  const stopStreaming = useCallback(async () => {
    try {
      await invoke('abort_sdk_stream', { agentId: JACK_AGENT_ID });
    } catch {
      // ignore
    }
    setIsStreaming(false);
    unlistenRef.current?.();
    unlistenRef.current = null;
    useJackStore.getState().setStreamingSessionId(null);
  }, []);

  useEffect(() => {
    return () => { unlistenRef.current?.(); };
  }, []);

  return { isStreaming, error, sendMessage, stopStreaming };
}
