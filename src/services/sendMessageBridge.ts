/**
 * Send Message Bridge
 *
 * `sendMessageForTargetAgent` lives in App.tsx as a useCallback bound to lots
 * of refs/state. Services outside the React tree (handoffService, automation,
 * remote API handlers) need to fire it programmatically. This module is a
 * minimal setter/getter that App.tsx registers on mount.
 *
 * Brain: handoff-agent-fork
 */

import type { ChatSendOptions } from '../hooks/useClaudeChat';

export type SendMessageForTargetAgentFn = (
  targetAgentId: string,
  content: string,
  options?: ChatSendOptions,
) => Promise<void>;

let impl: SendMessageForTargetAgentFn | null = null;

export function registerSendMessageForTargetAgent(fn: SendMessageForTargetAgentFn): void {
  impl = fn;
}

export function getSendMessageForTargetAgent(): SendMessageForTargetAgentFn | null {
  return impl;
}
