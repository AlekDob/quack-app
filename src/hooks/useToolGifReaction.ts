/**
 * useToolGifReaction Hook
 *
 * Manages GIF reactions during tool execution in the chat stream.
 * Automatically fetches appropriate GIFs when tools start and clears them when complete.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { getGifForTool, isGiphyConfigured, setGiphyApiKey } from '../services/giphyService';
import type { GiphyGif } from '../services/giphyService';
import { useSettingsStore } from '../stores/settingsStore';

export interface ActiveToolGif {
  toolId: string;
  toolName: string;
  gif: GiphyGif;
  startTime: number;
  isComplete: boolean;
}

export interface UseToolGifReactionOptions {
  /** Whether GIF reactions are enabled (from settings) */
  enabled?: boolean;
  /** Maximum number of simultaneous GIFs to show */
  maxConcurrentGifs?: number;
  /** Minimum time to show a GIF (ms) */
  minDisplayTime?: number;
}

export interface UseToolGifReactionReturn {
  /** Currently active tool GIFs */
  activeGifs: Map<string, ActiveToolGif>;
  /** Trigger a GIF for a tool starting */
  onToolStart: (toolId: string, toolName: string) => Promise<void>;
  /** Mark a tool as complete (GIF will fade out) */
  onToolComplete: (toolId: string) => void;
  /** Dismiss a specific GIF */
  dismissGif: (toolId: string) => void;
  /** Clear all active GIFs */
  clearAllGifs: () => void;
  /** Check if GIFs are enabled and configured */
  isEnabled: boolean;
}

const DEFAULT_OPTIONS: Required<UseToolGifReactionOptions> = {
  enabled: true,
  maxConcurrentGifs: 2,
  minDisplayTime: 1500, // Show GIF for at least 1.5s
};

export function useToolGifReaction(
  options?: UseToolGifReactionOptions
): UseToolGifReactionReturn {
  const config = { ...DEFAULT_OPTIONS, ...options };

  // Sync Giphy API key from settings store
  const storedGiphyKey = useSettingsStore((s) => s.general?.giphyApiKey ?? '');
  useEffect(() => {
    if (storedGiphyKey) {
      setGiphyApiKey(storedGiphyKey);
    }
  }, [storedGiphyKey]);

  const [activeGifs, setActiveGifs] = useState<Map<string, ActiveToolGif>>(new Map());

  // Track pending GIF fetches to avoid duplicates
  const pendingFetches = useRef<Set<string>>(new Set());

  // Track tools that completed before their GIF loaded
  const completedBeforeLoad = useRef<Set<string>>(new Set());

  // Check if feature is fully enabled
  const isEnabled = config.enabled && isGiphyConfigured();

  /**
   * Fetch and display a GIF when a tool starts
   */
  const onToolStart = useCallback(
    async (toolId: string, toolName: string) => {
      if (!isEnabled) return;

      // Skip if already fetching or displaying for this tool
      if (pendingFetches.current.has(toolId) || activeGifs.has(toolId)) {
        return;
      }

      // Limit concurrent GIFs
      if (activeGifs.size >= config.maxConcurrentGifs) {
        console.log('[useToolGifReaction] Max concurrent GIFs reached, skipping');
        return;
      }

      pendingFetches.current.add(toolId);

      try {
        const gif = await getGifForTool(toolName);

        if (gif) {
          // Check if tool completed while we were fetching
          const isAlreadyComplete = completedBeforeLoad.current.has(toolId);
          completedBeforeLoad.current.delete(toolId);

          setActiveGifs((prev) => {
            const next = new Map(prev);
            next.set(toolId, {
              toolId,
              toolName,
              gif,
              startTime: Date.now(),
              isComplete: isAlreadyComplete,
            });
            return next;
          });
        }
      } catch (error) {
        console.error('[useToolGifReaction] Failed to fetch GIF:', error);
      } finally {
        pendingFetches.current.delete(toolId);
      }
    },
    [isEnabled, activeGifs, config.maxConcurrentGifs]
  );

  /**
   * Mark a tool as complete - GIF will start fade-out animation
   */
  const onToolComplete = useCallback(
    (toolId: string) => {
      // If GIF is still loading, mark as completed before load
      if (pendingFetches.current.has(toolId)) {
        completedBeforeLoad.current.add(toolId);
        return;
      }

      setActiveGifs((prev) => {
        if (!prev.has(toolId)) return prev;

        const next = new Map(prev);
        const existing = next.get(toolId)!;

        // Check if minimum display time has passed
        const elapsed = Date.now() - existing.startTime;
        if (elapsed < config.minDisplayTime) {
          // Schedule completion after remaining time
          setTimeout(() => {
            setActiveGifs((p) => {
              const n = new Map(p);
              const e = n.get(toolId);
              if (e) {
                n.set(toolId, { ...e, isComplete: true });
              }
              return n;
            });
          }, config.minDisplayTime - elapsed);
          return prev;
        }

        next.set(toolId, { ...existing, isComplete: true });
        return next;
      });
    },
    [config.minDisplayTime]
  );

  /**
   * Dismiss a specific GIF immediately
   */
  const dismissGif = useCallback((toolId: string) => {
    setActiveGifs((prev) => {
      const next = new Map(prev);
      next.delete(toolId);
      return next;
    });
    pendingFetches.current.delete(toolId);
    completedBeforeLoad.current.delete(toolId);
  }, []);

  /**
   * Clear all active GIFs
   */
  const clearAllGifs = useCallback(() => {
    setActiveGifs(new Map());
    pendingFetches.current.clear();
    completedBeforeLoad.current.clear();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      pendingFetches.current.clear();
      completedBeforeLoad.current.clear();
    };
  }, []);

  return {
    activeGifs,
    onToolStart,
    onToolComplete,
    dismissGif,
    clearAllGifs,
    isEnabled,
  };
}

export default useToolGifReaction;
