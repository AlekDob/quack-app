/**
 * useClaudeEventListener Hook
 *
 * Centralized hook for managing Claude SDK event listeners.
 * Handles listener setup, pre-warming, and cleanup to prevent race conditions.
 *
 * Key features:
 * - Pre-warms listener when agent is selected (before first message)
 * - Persists listeners until agent is explicitly deleted
 * - Prevents race conditions with Tauri's internal event registration
 */

import { useEffect, useRef, useCallback } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { ClaudeEvent } from '../types';

export interface UseClaudeEventListenerOptions {
  /** Whether Tauri is available */
  tauriAvailable: boolean;
  /** Currently active agent ID */
  activeId: string | null;
  /** All agent IDs that have chat sessions */
  activeAgentIds: string[];
  /** Callback when event is received - handles all event processing */
  onEventReceived: (agentId: string, event: ClaudeEvent) => void;
}

export interface UseClaudeEventListenerReturn {
  /** Ensure listener is ready for an agent (call before invoke) */
  ensureListenerReady: (agentId: string) => Promise<void>;
  /** Clean up listener for a specific agent (call when agent deleted) */
  cleanupListener: (agentId: string) => void;
  /** Check if listener exists for an agent */
  hasListener: (agentId: string) => boolean;
}

/**
 * Hook for managing Claude SDK event listeners
 * All event processing is delegated to the onEventReceived callback
 */
export function useClaudeEventListener(
  options: UseClaudeEventListenerOptions
): UseClaudeEventListenerReturn {
  const {
    tauriAvailable,
    activeId,
    activeAgentIds,
    onEventReceived,
  } = options;

  // Track active listeners - using ref to avoid re-renders
  const activeListenersRef = useRef<Map<string, UnlistenFn>>(new Map());

  // Store onEventReceived in ref to avoid stale closures
  const onEventReceivedRef = useRef(onEventReceived);
  useEffect(() => {
    onEventReceivedRef.current = onEventReceived;
  }, [onEventReceived]);

  /**
   * Set up listener for an agent
   */
  const setupListener = useCallback(async (agentId: string, source: string): Promise<boolean> => {
    if (activeListenersRef.current.has(agentId)) {
      console.log(`[ClaudeListener:${source}] Already exists for: ${agentId}`);
      return true;
    }

    const eventName = `claude-event:${agentId}`;
    console.log(`[ClaudeListener:${source}] Setting up for: ${agentId}`);

    try {
      const unlisten = await listen<ClaudeEvent>(eventName, (event) => {
        console.log(`🎯 [ClaudeListener:${source}] Event received for ${agentId}:`, {
          type: event.payload.type,
        });
        // Delegate all event processing to the callback
        onEventReceivedRef.current(agentId, event.payload);
      });

      activeListenersRef.current.set(agentId, unlisten);
      console.log(`[ClaudeListener:${source}] Ready for: ${agentId}`);
      return true;
    } catch (error) {
      console.error(`[ClaudeListener:${source}] Failed for ${agentId}:`, error);
      return false;
    }
  }, []);

  /**
   * PRE-WARM: Set up listener when agent is selected
   * This gives Tauri time to register the listener before any events are emitted
   */
  useEffect(() => {
    if (!tauriAvailable || !activeId) return;
    setupListener(activeId, 'PreWarm');
  }, [tauriAvailable, activeId, setupListener]);

  /**
   * MULTI-LISTENER: Set up listeners for all agents with chat sessions
   */
  useEffect(() => {
    if (!tauriAvailable) return;

    // Setup listener for each active agent
    activeAgentIds.forEach((agentId) => {
      setupListener(agentId, 'Multi');
    });

    // Cleanup: Don't remove listeners - they persist until explicitly deleted
    return () => {
      console.log('[ClaudeListener] Effect cleanup - listeners preserved:',
        Array.from(activeListenersRef.current.keys())
      );
    };
  }, [tauriAvailable, activeAgentIds, setupListener]);

  /**
   * Ensure listener is ready before invoke
   */
  const ensureListenerReady = useCallback(async (agentId: string) => {
    const exists = await setupListener(agentId, 'Ensure');

    if (!exists) {
      // Wait for Tauri registration if we just created the listener
      console.log(`[ClaudeListener:Ensure] Waiting for Tauri registration...`);
      await new Promise(resolve => setTimeout(resolve, 150));
      console.log(`[ClaudeListener:Ensure] Registration complete for: ${agentId}`);
    }
  }, [setupListener]);

  /**
   * Clean up listener for a specific agent (call when agent is deleted)
   */
  const cleanupListener = useCallback((agentId: string) => {
    const unlisten = activeListenersRef.current.get(agentId);
    if (unlisten) {
      unlisten();
      activeListenersRef.current.delete(agentId);
      console.log(`[ClaudeListener] Cleaned up for: ${agentId}`);
    }
  }, []);

  /**
   * Check if listener exists for an agent
   */
  const hasListener = useCallback((agentId: string) => {
    return activeListenersRef.current.has(agentId);
  }, []);

  return {
    ensureListenerReady,
    cleanupListener,
    hasListener,
  };
}
