/**
 * ToolGifOverlay - Displays GIF reactions during tool execution
 *
 * This component renders GIF widgets for active tools in an overlay
 * positioned at the bottom of the chat stream.
 */

import React, { useEffect, useRef, useCallback } from 'react';
import { useToolGifReaction } from '../hooks/useToolGifReaction';
import { useSettingsStore } from '../stores/settingsStore';
import ToolGifWidget from './ToolGifWidget';
import type { ClaudeEvent } from '../types';
import './ToolGifOverlay.css';

interface ToolGifOverlayProps {
  /** Current stream events to monitor for tool_use */
  events: ClaudeEvent[];
}

export const ToolGifOverlay: React.FC<ToolGifOverlayProps> = ({ events }) => {
  // Get settings - with defensive fallback
  const enableToolGifs = useSettingsStore((s) => s.general?.enableToolGifs ?? false);

  // Track which tools we've already processed
  const processedTools = useRef<Set<string>>(new Set());
  const completedTools = useRef<Set<string>>(new Set());

  // Use the GIF reaction hook
  const { activeGifs, onToolStart, onToolComplete, dismissGif, isEnabled } = useToolGifReaction({
    enabled: enableToolGifs,
    maxConcurrentGifs: 2,
    minDisplayTime: 1500,
  });

  // Process events for tool_use and tool_result
  useEffect(() => {
    // Guard: don't process if not enabled or no events
    if (!isEnabled || !events || !events.length) return;

    events.forEach((event) => {
      // Handle tool_use events (tool starting)
      if (event.type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'tool_use' && block.id && block.name) {
            const toolId = block.id;
            const toolName = block.name;

            // Skip if already processed
            if (processedTools.current.has(toolId)) continue;
            processedTools.current.add(toolId);

            // Skip certain tools that don't benefit from GIFs
            const skipTools = ['todowrite', 'askuserquestion'];
            if (skipTools.includes(toolName.toLowerCase())) continue;

            // Trigger GIF for this tool
            onToolStart(toolId, toolName);
          }
        }
      }

      // Handle tool_result events (tool completed)
      if (event.type === 'user' && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            const toolId = block.tool_use_id;

            // Skip if already marked as completed
            if (completedTools.current.has(toolId)) continue;
            completedTools.current.add(toolId);

            // Mark tool as complete
            onToolComplete(toolId);
          }
        }
      }
    });
  }, [events, isEnabled, onToolStart, onToolComplete]);

  // Handle dismiss
  const handleDismiss = useCallback(
    (toolId: string) => {
      dismissGif(toolId);
    },
    [dismissGif]
  );

  // Don't render if disabled, no events, or no active GIFs
  if (!isEnabled || !events || activeGifs.size === 0) {
    return null;
  }

  return (
    <div className="tool-gif-overlay">
      {Array.from(activeGifs.values()).map((toolGif) => (
        <ToolGifWidget
          key={toolGif.toolId}
          toolName={toolGif.toolName}
          gif={toolGif.gif}
          isLoading={!toolGif.isComplete}
          onDismiss={() => handleDismiss(toolGif.toolId)}
        />
      ))}
    </div>
  );
};

export default ToolGifOverlay;
