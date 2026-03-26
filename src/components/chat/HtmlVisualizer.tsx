/**
 * HtmlVisualizer — Renders AI-generated HTML in a sandboxed iframe inline in chat.
 * Supports auto-resize, code/preview toggle, and copy-to-clipboard.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { wrapHtmlForSandbox } from './htmlVisualizerUtils';
import { CopyButton } from './CopyButton';
import './HtmlVisualizer.css';

// === CONSTANTS ===

const DEFAULT_HEIGHT = 400;
const MAX_HEIGHT = 600;
const MIN_HEIGHT = 60;

// === TYPES ===

interface HtmlVisualizerProps {
  html: string;
  title?: string;
  maxHeight?: number;
  collapsible?: boolean;
}

// === COMPONENT ===

/** Sandboxed inline HTML renderer for interactive visualizations */
export default function HtmlVisualizer({
  html,
  title,
  maxHeight = MAX_HEIGHT,
  collapsible = true,
}: HtmlVisualizerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [showCode, setShowCode] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);

  // WHY: useMemo prevents iframe re-mount on every render (srcDoc reference stability)
  const wrappedHtml = useMemo(() => wrapHtmlForSandbox(html), [html]);

  // Reset loading state when html content changes
  useEffect(() => { setIsLoaded(false); }, [html]);

  // Listen for auto-resize messages from THIS iframe only
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // WHY: event.source check prevents other iframes from manipulating this visualizer
      if (iframeRef.current && event.source !== iframeRef.current.contentWindow) return;
      if (event.data?.type !== 'quack-viz-resize') return;
      const newHeight = Math.max(MIN_HEIGHT, Math.min(event.data.height, maxHeight));
      setHeight(newHeight);
      setIsLoaded(true);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [maxHeight]);

  const handleIframeLoad = useCallback(() => {
    // Fallback: mark as loaded after iframe fires load event
    setTimeout(() => setIsLoaded(true), 500);
  }, []);

  const toggleCode = useCallback(() => setShowCode(prev => !prev), []);
  const toggleCollapse = useCallback(() => setCollapsed(prev => !prev), []);

  return (
    <div className="html-visualizer">
      {/* Toolbar */}
      <div className="html-viz-toolbar">
        <span className="html-viz-label">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 4L1 8L5 12M11 4L15 8L11 12" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {title || 'Visualizer'}
        </span>

        <button type="button" className={`html-viz-btn ${showCode ? 'active' : ''}`} onClick={toggleCode}>
          {showCode ? 'Preview' : 'Code'}
        </button>
        <CopyButton text={html} className="html-viz-btn" />
        {collapsible && (
          <button type="button" className="html-viz-btn" onClick={toggleCollapse}>
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        )}
      </div>

      {/* Content: iframe preview or raw code */}
      {showCode ? (
        <div className="html-viz-code-view">
          <pre>{html}</pre>
        </div>
      ) : (
        <div
          className={`html-viz-iframe-container ${collapsed ? 'collapsed' : ''}`}
          style={{ height: collapsed ? 0 : height }}
        >
          {!isLoaded && !collapsed && (
            <div className="html-viz-loading">
              <div className="html-viz-spinner" />
              Rendering...
            </div>
          )}
          <iframe
            ref={iframeRef}
            srcDoc={wrappedHtml}
            sandbox="allow-scripts"
            className="html-viz-iframe"
            style={{ height }}
            title="Interactive visualization"
            onLoad={handleIframeLoad}
          />
        </div>
      )}
    </div>
  );
}
