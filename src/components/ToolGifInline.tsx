/**
 * ToolGifInline - Inline GIF display for tool execution
 *
 * Shows a GIF as a chat bubble (WhatsApp style) when tools execute.
 * The GIF remains visible as part of the conversation history.
 */

import React, { useState, useEffect } from 'react';
import { getGifForTool, isGiphyConfigured } from '../services/giphyService';
import type { GiphyGif } from '../services/giphyService';
import { useSettingsStore } from '../stores/settingsStore';
import './ToolGifInline.css';

interface ToolGifInlineProps {
  /** The tool name (e.g., 'bash', 'read', 'mcp__brain__brain_search') */
  toolName: string;
  /** Unique ID for this tool use (prevents duplicate fetches) */
  toolId: string;
}

// Global cache to prevent re-fetching for same toolId
const fetchedGifs = new Map<string, GiphyGif | null>();
const pendingFetches = new Set<string>();

export const ToolGifInline: React.FC<ToolGifInlineProps> = ({ toolName, toolId }) => {
  const [gif, setGif] = useState<GiphyGif | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Get settings
  const enableToolGifs = useSettingsStore((s) => s.general?.enableToolGifs ?? false);

  // 🦆 DEBUG: Log EVERY time component mounts/renders
  console.log(`🎬 [ToolGifInline] MOUNTED/RENDERED for tool="${toolName}" id="${toolId}" enabled=${enableToolGifs} configured=${isGiphyConfigured()}`);

  useEffect(() => {
    // Skip if GIFs are disabled or Giphy not configured
    if (!enableToolGifs || !isGiphyConfigured()) {
      console.log(`[ToolGifInline] Skipping - enabled=${enableToolGifs} configured=${isGiphyConfigured()}`);
      setIsLoading(false);
      return;
    }

    // Check if we already have this GIF cached
    if (fetchedGifs.has(toolId)) {
      setGif(fetchedGifs.get(toolId) || null);
      setIsLoading(false);
      return;
    }

    // Skip if already fetching
    if (pendingFetches.has(toolId)) {
      return;
    }

    // Skip certain tools that don't need GIFs
    const skipTools = ['todowrite', 'askuserquestion'];
    if (skipTools.includes(toolName.toLowerCase())) {
      setIsLoading(false);
      fetchedGifs.set(toolId, null);
      return;
    }

    // Fetch GIF
    pendingFetches.add(toolId);
    setIsLoading(true);
    setHasError(false);

    getGifForTool(toolName)
      .then((result) => {
        fetchedGifs.set(toolId, result);
        setGif(result);
      })
      .catch((err) => {
        console.error('[ToolGifInline] Failed to fetch GIF:', err);
        fetchedGifs.set(toolId, null);
        setHasError(true);
      })
      .finally(() => {
        pendingFetches.delete(toolId);
        setIsLoading(false);
      });
  }, [toolName, toolId, enableToolGifs]);

  // Don't render if disabled or no GIF
  if (!enableToolGifs || (!gif && !isLoading)) {
    return null;
  }

  // Loading state - show subtle placeholder
  if (isLoading) {
    return (
      <div className="tool-gif-inline tool-gif-inline--loading">
        <div className="tool-gif-inline__skeleton" />
      </div>
    );
  }

  // Error state - don't show anything
  if (hasError || !gif) {
    return null;
  }

  return (
    <div className="tool-gif-inline">
      <div className="tool-gif-inline__container">
        <img
          src={gif.previewUrl || gif.url}
          alt={gif.title || `${toolName} in action`}
          className="tool-gif-inline__image"
          loading="lazy"
        />
        <div className="tool-gif-inline__attribution">
          <span className="tool-gif-inline__powered-by">Powered by</span>
          <img
            src="https://giphy.com/static/img/giphy_logo_square_social.png"
            alt="GIPHY"
            className="tool-gif-inline__giphy-logo"
          />
        </div>
      </div>
    </div>
  );
};

export default ToolGifInline;
