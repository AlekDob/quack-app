/**
 * ToolGifInline - Inline GIF display for tool execution
 *
 * Shows a GIF as a chat bubble (WhatsApp style) when tools execute.
 * The GIF remains visible as part of the conversation history.
 *
 * Features smart rate limiting to avoid GIF overload:
 * - Shows GIF only every N consecutive tools
 * - Different rates for different tool categories
 */

import React, { useState, useEffect, useMemo } from 'react';
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

// Smart rate limiting: track consecutive tools
let toolCounter = 0;
const processedToolIds = new Set<string>();

// How many tools between GIFs (higher = fewer GIFs)
const GIF_INTERVAL = 3;

// Tool category mapping
type ToolCategory = 'brain' | 'fileOps' | 'shell' | 'search' | 'agents' | 'never';

const TOOL_CATEGORIES: Record<string, ToolCategory> = {
  // Brain/Memory
  'mcp__brain': 'brain',
  'mcp__memory': 'brain',
  // File operations
  'read': 'fileOps',
  'write': 'fileOps',
  'edit': 'fileOps',
  // Shell
  'bash': 'shell',
  'killshell': 'shell',
  // Search
  'grep': 'search',
  'glob': 'search',
  'websearch': 'search',
  'webfetch': 'search',
  'mcp__semantic-search': 'search',
  // Agents
  'task': 'agents',
  // Never show
  'todowrite': 'never',
  'askuserquestion': 'never',
};

/**
 * Get the category for a tool
 */
function getToolCategory(toolName: string): ToolCategory {
  const normalizedName = toolName.toLowerCase();

  for (const [pattern, category] of Object.entries(TOOL_CATEGORIES)) {
    if (normalizedName.includes(pattern)) {
      return category;
    }
  }

  // Default to fileOps for unknown tools
  return 'fileOps';
}

/**
 * Determine if this tool should show a GIF based on:
 * 1. Category settings (user preferences)
 * 2. Smart rate limiting (avoid spam)
 */
function shouldShowGif(
  toolName: string,
  toolId: string,
  categories: { brain: boolean; fileOps: boolean; shell: boolean; search: boolean; agents: boolean }
): boolean {
  const category = getToolCategory(toolName);

  // Never show for certain tools
  if (category === 'never') {
    return false;
  }

  // Check if category is enabled
  if (!categories[category]) {
    return false;
  }

  // Already processed this tool? Keep the same decision
  if (processedToolIds.has(toolId)) {
    return fetchedGifs.has(toolId) && fetchedGifs.get(toolId) !== null;
  }

  // Mark as processed
  processedToolIds.add(toolId);

  // Increment counter
  toolCounter++;

  // Brain and Agent tools always show (important)
  if (category === 'brain' || category === 'agents') {
    return true;
  }

  // Other tools: show every N tools to avoid spam
  return toolCounter % GIF_INTERVAL === 1;
}

export const ToolGifInline: React.FC<ToolGifInlineProps> = ({ toolName, toolId }) => {
  const [gif, setGif] = useState<GiphyGif | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Get settings - use individual selectors to avoid object recreation
  const enableToolGifs = useSettingsStore((s) => s.general?.enableToolGifs ?? true);
  const brainEnabled = useSettingsStore((s) => s.general?.toolGifCategories?.brain ?? true);
  const fileOpsEnabled = useSettingsStore((s) => s.general?.toolGifCategories?.fileOps ?? true);
  const shellEnabled = useSettingsStore((s) => s.general?.toolGifCategories?.shell ?? true);
  const searchEnabled = useSettingsStore((s) => s.general?.toolGifCategories?.search ?? false);
  const agentsEnabled = useSettingsStore((s) => s.general?.toolGifCategories?.agents ?? true);

  // Memoize categories object to prevent infinite loops
  const toolGifCategories = useMemo(() => ({
    brain: brainEnabled,
    fileOps: fileOpsEnabled,
    shell: shellEnabled,
    search: searchEnabled,
    agents: agentsEnabled,
  }), [brainEnabled, fileOpsEnabled, shellEnabled, searchEnabled, agentsEnabled]);

  useEffect(() => {
    // Skip if GIFs are disabled or Giphy not configured
    if (!enableToolGifs || !isGiphyConfigured()) {
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

    // Smart rate limiting + category check
    if (!shouldShowGif(toolName, toolId, toolGifCategories)) {
      setIsLoading(false);
      fetchedGifs.set(toolId, null);
      return;
    }

    // Fetch GIF - pass toolId for caching
    pendingFetches.add(toolId);
    setIsLoading(true);
    setHasError(false);

    getGifForTool(toolName, toolId)
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
  }, [toolName, toolId, enableToolGifs, toolGifCategories]);

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

  // Get friendly tool name for display
  const getDisplayToolName = (name: string): string => {
    // Remove mcp__ prefix and clean up
    const cleaned = name.replace(/^mcp__\w+__/, '').replace(/_/g, ' ');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  };

  return (
    <div className="tool-gif-inline">
      <div className="tool-gif-inline__wrapper">
        <div className="tool-gif-inline__container">
          <img
            src={gif.previewUrl || gif.url}
            alt={gif.title || `${toolName} in action`}
            className="tool-gif-inline__image"
            loading="lazy"
          />
          <div className="tool-gif-inline__attribution">
            <img
              src="https://giphy.com/static/img/giphy_logo_square_social.png"
              alt="GIPHY"
              className="tool-gif-inline__giphy-logo"
            />
          </div>
        </div>
        <div className="tool-gif-inline__caption">
          Using {getDisplayToolName(toolName)}...
        </div>
      </div>
    </div>
  );
};

export default ToolGifInline;
