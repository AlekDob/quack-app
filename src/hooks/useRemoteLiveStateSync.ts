/**
 * useRemoteLiveStateSync
 *
 * Mirrors the in-memory chatStore state (`chatLoadingMap`, `pendingQuestionsMap`,
 * last assistant message status) into the Rust backend via three `notify_*`
 * Tauri commands. The backend stores them in `SessionLiveStateMap` and
 * broadcasts a `WsEvent` so the mobile PWA Task Hub can render priorities
 * (Needs attention / Working / Agent done / Other) in real time without
 * round-tripping the desktop frontend.
 *
 * Brain: pattern-remote-api-architecture
 */

import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useChatStore } from '../stores/chatStore';
import { useSessionStore } from '../stores/sessionStore';
import type { RemoteApiConfig } from '../types';

type Snapshot = {
  isStreaming: boolean;
  pendingCount: number;
  lastRole?: string;
  lastStatus?: string;
};

const DEBOUNCE_MS = 150;

function pickLastMessageInfo(messages: ReturnType<typeof useChatStore.getState>['chatSessions'] extends Map<string, infer T> ? T : never): {
  role?: string;
  status?: string;
} {
  if (!messages || messages.length === 0) return {};
  const last = messages[messages.length - 1];
  return { role: last.role, status: last.status };
}

export function useRemoteLiveStateSync(): void {
  // Cached snapshot per session: avoid spamming notify_* when nothing changed.
  const cacheRef = useRef<Map<string, Snapshot>>(new Map());
  // Per-session debounce timers.
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Cached agentId lookup (session_id -> agent_id) to attach to WS events.
  const agentIdRef = useRef<Map<string, string>>(new Map());
  // Remote-enabled flag (skip all work when off).
  const enabledRef = useRef<boolean>(false);

  // Check remote config on mount, then poll every 30s (cheap, in-process).
  useEffect(() => {
    let cancelled = false;

    const refreshEnabled = async () => {
      try {
        const cfg = await invoke<RemoteApiConfig>('get_remote_config');
        if (!cancelled) enabledRef.current = !!cfg?.enabled;
      } catch {
        if (!cancelled) enabledRef.current = false;
      }
    };

    refreshEnabled();
    const id = setInterval(refreshEnabled, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Keep agentId map up-to-date from sessionStore.
  useEffect(() => {
    const update = () => {
      const map = new Map<string, string>();
      for (const s of useSessionStore.getState().sessions) {
        map.set(s.id, s.agentId);
      }
      agentIdRef.current = map;
    };
    update();
    return useSessionStore.subscribe(update);
  }, []);

  useEffect(() => {
    const schedule = (sessionId: string, next: Snapshot) => {
      if (!enabledRef.current) return;
      const prev = cacheRef.current.get(sessionId);

      // No-op if nothing changed.
      if (
        prev &&
        prev.isStreaming === next.isStreaming &&
        prev.pendingCount === next.pendingCount &&
        prev.lastRole === next.lastRole &&
        prev.lastStatus === next.lastStatus
      ) {
        return;
      }

      // Debounce per-session to coalesce bursty updates.
      const existing = timersRef.current.get(sessionId);
      if (existing) clearTimeout(existing);

      const timer = setTimeout(() => {
        const agentId = agentIdRef.current.get(sessionId);
        const before = cacheRef.current.get(sessionId);

        // Diff and fire only the relevant commands.
        if (!before || before.isStreaming !== next.isStreaming) {
          invoke('notify_session_streaming', {
            sessionId,
            isStreaming: next.isStreaming,
            agentId,
          }).catch(() => {});
        }
        if (!before || before.pendingCount !== next.pendingCount) {
          invoke('notify_session_pending_question', {
            sessionId,
            count: next.pendingCount,
            agentId,
          }).catch(() => {});
        }
        if (
          next.lastRole &&
          (!before || before.lastRole !== next.lastRole || before.lastStatus !== next.lastStatus)
        ) {
          invoke('notify_session_message', {
            sessionId,
            role: next.lastRole,
            status: next.lastStatus,
            agentId,
          }).catch(() => {});
        }

        cacheRef.current.set(sessionId, next);
        timersRef.current.delete(sessionId);
      }, DEBOUNCE_MS);

      timersRef.current.set(sessionId, timer);
    };

    const computeAndSchedule = () => {
      const state = useChatStore.getState();
      const ids = new Set<string>();
      state.chatSessions.forEach((_, id) => ids.add(id));
      state.chatLoadingMap.forEach((_, id) => ids.add(id));
      state.pendingQuestionsMap.forEach((_, id) => ids.add(id));

      ids.forEach((sessionId) => {
        const messages = state.chatSessions.get(sessionId) ?? [];
        const { role, status } = pickLastMessageInfo(messages);
        const isStreaming =
          state.chatLoadingMap.get(sessionId) === true ||
          (role === 'assistant' && status === 'streaming');
        const pendingCount = state.pendingQuestionsMap.get(sessionId)?.size ?? 0;

        schedule(sessionId, {
          isStreaming,
          pendingCount,
          lastRole: role,
          lastStatus: status,
        });
      });
    };

    // Run once immediately, then subscribe to chat store changes.
    computeAndSchedule();
    const unsub = useChatStore.subscribe(computeAndSchedule);
    return () => {
      unsub();
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current.clear();
    };
  }, []);
}
