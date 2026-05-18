import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { QuackAgentEvent } from '../types/agentBackend';

interface WrappedEvent { sessionKey: string; turnId: string | null; event: QuackAgentEvent }

/** Subscribe to Codex unified events for one agent. `onEvent` feeds the
 *  existing chat store (same callbacks the Claude path uses for text/tool/usage). */
export function useCodexEventStream(
  agentId: string | undefined,
  onEvent: (sessionKey: string, turnId: string | null, ev: QuackAgentEvent) => void,
) {
  useEffect(() => {
    if (!agentId) return;
    let unlisten: (() => void) | undefined;
    listen<WrappedEvent>(`codex-event:${agentId}`, (e) => {
      onEvent(e.payload.sessionKey, e.payload.turnId, e.payload.event);
    }).then((u) => { unlisten = u; });
    return () => unlisten?.();
  }, [agentId, onEvent]);
}
