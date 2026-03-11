/**
 * useBTW - BTW (By The Way) side-chain chat hook
 *
 * Uses the same SDK streaming pipeline as the main chat (send_message_via_sdk_streaming)
 * so authentication (OAuth, API key, Bedrock) works identically.
 *
 * Conversation persists across open/close — only cleared on new query.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useSettingsStore } from '../stores/settingsStore';
import { getProviderRequestFields } from '../services/claudeSDK';
import { getModelId } from '../services/modelService';
import type { ClaudeEvent } from '../types';

interface BTWState {
  isOpen: boolean;
  query: string;
  response: string;
  isLoading: boolean;
  error: string | undefined;
}

interface UseBTWReturn extends BTWState {
  model: string;
  shortcut: string;
  openBTW: () => void;
  closeBTW: () => void;
  sendQuery: (question: string) => Promise<void>;
}

const BTW_AGENT_ID = 'btw-sidechain';
const INITIAL_STATE: BTWState = {
  isOpen: false,
  query: '',
  response: '',
  isLoading: false,
  error: undefined,
};

const matchesShortcut = (e: KeyboardEvent, shortcut: string): boolean => {
  const parts = shortcut.split('+');
  const key = parts[parts.length - 1];
  const wantsMetaOrCtrl = parts.includes('Meta') || parts.includes('Ctrl');
  const wantsAlt = parts.includes('Alt');
  const wantsShift = parts.includes('Shift');
  const hasModifier = e.metaKey || e.ctrlKey;

  return (
    (wantsMetaOrCtrl ? hasModifier : !hasModifier) &&
    (wantsAlt ? e.altKey : !e.altKey) &&
    (wantsShift ? e.shiftKey : !e.shiftKey) &&
    e.key.toUpperCase() === key.toUpperCase()
  );
};

/** Extract text content from a ClaudeEvent assistant message */
function extractTextFromEvent(evt: ClaudeEvent): string {
  if (evt.type !== 'assistant' || !evt.message?.content) return '';
  const blocks = evt.message.content as Array<{ type: string; text?: string }>;
  return blocks
    .filter((b) => b.type === 'text' && b.text)
    .map((b) => b.text)
    .join('');
}

export function useBTW(): UseBTWReturn {
  const [state, setState] = useState<BTWState>(INITIAL_STATE);
  const unlistenRef = useRef<(() => void) | null>(null);

  const btwModel = useSettingsStore((s) => s.claude.btwModel) || 'haiku45';
  const btwShortcut = useSettingsStore((s) => s.general.btwShortcut) || 'Ctrl+B';

  const openBTW = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: true }));
  }, []);

  const closeBTW = useCallback(() => {
    setState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const sendQuery = useCallback(
    async (question: string) => {
      if (!question.trim()) return;

      setState((prev) => ({
        ...prev,
        query: question,
        isLoading: true,
        error: undefined,
        response: '',
      }));

      // Generate unique session key per query to avoid event mixing
      const sessionKey = `btw-${Date.now()}`;
      let collectedText = '';

      try {
        // Setup listener BEFORE invoking to avoid race condition
        const eventName = `claude-event:${BTW_AGENT_ID}`;
        unlistenRef.current?.();

        unlistenRef.current = await listen<{ sessionKey: string; event: ClaudeEvent }>(
          eventName,
          (event) => {
            const { sessionKey: evtKey, event: claudeEvent } = event.payload;
            if (evtKey !== sessionKey) return;

            const text = extractTextFromEvent(claudeEvent);
            if (text) {
              collectedText += text;
              setState((prev) => ({ ...prev, response: collectedText }));
            }
          }
        );

        // Use same SDK pipeline as main chat
        const prf = getProviderRequestFields();
        const resolvedModel = prf.provider
          ? prf.resolveModel(btwModel)
          : getModelId(btwModel);

        await invoke('send_message_via_sdk_streaming', {
          agentId: BTW_AGENT_ID,
          request: {
            prompt: question,
            model: resolvedModel,
            permissionMode: 'bypass',
            cwd: undefined,
            sessionKey,
            provider: prf.provider,
            providerBaseUrl: prf.providerBaseUrl,
            providerApiKey: prf.providerApiKey,
          },
        });

        // Invocation completed — finalize
        setState((prev) => ({ ...prev, isLoading: false }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState((prev) => ({ ...prev, error: message, isLoading: false }));
      } finally {
        unlistenRef.current?.();
        unlistenRef.current = null;
      }
    },
    [btwModel]
  );

  // Cleanup listener on unmount
  useEffect(() => {
    return () => { unlistenRef.current?.(); };
  }, []);

  // Register global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!btwShortcut) return;
      if (!matchesShortcut(e, btwShortcut)) return;
      e.preventDefault();
      e.stopPropagation();
      setState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [btwShortcut]);

  return {
    ...state,
    model: btwModel,
    shortcut: btwShortcut,
    openBTW,
    closeBTW,
    sendQuery,
  };
}
