/**
 * ToolGifWidget - Displays animated GIFs during tool execution
 *
 * Shows a contextual GIF reaction when AI tools are being executed,
 * making the streaming chat more visually engaging.
 */

import React, { useState, useEffect } from 'react';
import type { GiphyGif } from '../services/giphyService';
import './ToolGifWidget.css';

interface ToolGifWidgetProps {
  /** The tool name being executed */
  toolName: string;
  /** The GIF to display */
  gif: GiphyGif;
  /** Whether the tool is still loading/executing */
  isLoading?: boolean;
  /** Callback when the widget should be dismissed */
  onDismiss?: () => void;
}

export const ToolGifWidget: React.FC<ToolGifWidgetProps> = ({
  toolName,
  gif,
  isLoading = true,
  onDismiss,
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  // Auto-dismiss when tool completes (with fade-out animation)
  useEffect(() => {
    if (!isLoading && imageLoaded) {
      // Short delay before starting exit animation
      const exitTimer = setTimeout(() => {
        setIsExiting(true);
      }, 500);

      // Dismiss after animation completes
      const dismissTimer = setTimeout(() => {
        onDismiss?.();
      }, 800); // 500ms delay + 300ms animation

      return () => {
        clearTimeout(exitTimer);
        clearTimeout(dismissTimer);
      };
    }
  }, [isLoading, imageLoaded, onDismiss]);

  // Format tool name for display
  const formatToolName = (name: string): string => {
    // Remove MCP prefixes and format nicely
    let formatted = name
      .replace(/^mcp__[^_]+__/, '') // Remove mcp__xxx__ prefix
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/\b\w/g, (c) => c.toUpperCase()); // Capitalize first letters

    // Truncate if too long
    if (formatted.length > 25) {
      formatted = formatted.substring(0, 22) + '...';
    }

    return formatted;
  };

  return (
    <div className={`tool-gif-widget ${isExiting ? 'exiting' : ''} ${imageLoaded ? 'loaded' : 'loading'}`}>
      <div className="tool-gif-container">
        {/* Loading skeleton before image loads */}
        {!imageLoaded && (
          <div className="tool-gif-skeleton">
            <div className="tool-gif-skeleton-pulse" />
          </div>
        )}

        {/* GIF image */}
        <img
          src={gif.previewUrl || gif.url}
          alt={gif.title}
          className={`tool-gif-image ${imageLoaded ? 'visible' : 'hidden'}`}
          onLoad={() => setImageLoaded(true)}
          onError={() => {
            console.warn('[ToolGifWidget] Failed to load GIF:', gif.url);
            onDismiss?.();
          }}
        />

        {/* Tool name badge */}
        <div className="tool-gif-badge">
          {isLoading && (
            <div className="tool-gif-spinner">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" opacity="0.25" />
                <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
              </svg>
            </div>
          )}
          {!isLoading && (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
            </svg>
          )}
          <span className="tool-gif-badge-text">{formatToolName(toolName)}</span>
        </div>
      </div>

      {/* Giphy attribution (required by Giphy API terms) */}
      <div className="tool-gif-attribution">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M2.667 0h18.666C22.8 0 24 1.2 24 2.667v18.666C24 22.8 22.8 24 21.333 24H2.667C1.2 24 0 22.8 0 21.333V2.667C0 1.2 1.2 0 2.667 0z" />
          <path
            fill="#fff"
            d="M5.333 5.333h2.667v13.334H5.333V5.333zm4 2.667h2.667v-2.667h5.333v2.667h-2.666v5.333h2.666v2.667h-5.333v-2.667h-2.667V8z"
          />
        </svg>
      </div>
    </div>
  );
};

export default ToolGifWidget;
