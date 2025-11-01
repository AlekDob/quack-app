import { useCallback, useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { inspectorBridge } from '../services/inspectorBridge';
import './BrowserTab.css';

interface BrowserTabProps {
  tabId?: string;
  initialUrl?: string;
  onUrlChange?: (url: string) => void;
  onFileOpen?: (filePath: string, line?: number, column?: number) => void;
}

export default function BrowserTab({
  initialUrl = 'https://google.com',
  onUrlChange,
  onFileOpen,
}: BrowserTabProps) {
  const [url, setUrl] = useState(initialUrl);
  const [inputUrl, setInputUrl] = useState(initialUrl);
  const [isLoading, setIsLoading] = useState(false);
  const [inspectorActive, setInspectorActive] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Initialize inspector bridge
  useEffect(() => {
    inspectorBridge.init();

    return () => {
      inspectorBridge.destroy();
    };
  }, []);

  // Listen for inspector events
  useEffect(() => {
    const handleInspectorClick = (data: any) => {
      console.log('🦆 Inspector click:', data);

      if (data.component?.fileName && onFileOpen) {
        onFileOpen(
          data.component.fileName,
          data.component.lineNumber,
          data.component.columnNumber
        );
      }
    };

    inspectorBridge.on('click', handleInspectorClick);

    return () => {
      inspectorBridge.off('click', handleInspectorClick);
    };
  }, [onFileOpen]);

  // Inject inspector script when iframe loads
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const handleLoad = async () => {
      setIsLoading(false);

      // Wait a bit for iframe to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      try {
        await inspectorBridge.injectScript(iframe);
        console.log('🦆 Inspector script injected!');
      } catch (error) {
        console.error('Failed to inject inspector:', error);
      }
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [url]);

  const handleNavigate = useCallback((newUrl: string) => {
    // Ensure URL has protocol
    let finalUrl = newUrl.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      // Check if it's localhost or a domain
      if (finalUrl.includes('localhost') || finalUrl.match(/:\d+/)) {
        finalUrl = `http://${finalUrl}`;
      } else {
        finalUrl = `https://${finalUrl}`;
      }
    }

    setIsLoading(true);
    setUrl(finalUrl);
    setInputUrl(finalUrl);
    onUrlChange?.(finalUrl);
  }, [onUrlChange]);

  const handleGoBack = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.history.back();
    }
  }, []);

  const handleGoForward = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe?.contentWindow) {
      iframe.contentWindow.history.forward();
    }
  }, []);

  const handleRefresh = useCallback(() => {
    const iframe = iframeRef.current;
    if (iframe) {
      setIsLoading(true);
      iframe.src = url;
    }
  }, [url]);

  const handleOpenInBrowser = useCallback(async () => {
    try {
      await open(url);
      console.log('🦆 Opened in external browser:', url);
    } catch (error) {
      console.error('Failed to open in browser:', error);
    }
  }, [url]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleNavigate(inputUrl);
    }
  }, [inputUrl, handleNavigate]);

  const toggleInspector = useCallback(() => {
    const newState = !inspectorActive;
    setInspectorActive(newState);
    inspectorBridge.toggle(newState);
    console.log('🦆 Inspector toggled:', newState);
  }, [inspectorActive]);

  return (
    <div className="browser-tab">
      {/* Navigation Bar */}
      <div className="browser-navbar">
        <div className="browser-nav-controls">
          <button
            type="button"
            className="browser-nav-button"
            onClick={handleGoBack}
            title="Go Back"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="browser-nav-button"
            onClick={handleGoForward}
            title="Go Forward"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 12L10 8L6 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="browser-nav-button"
            onClick={handleRefresh}
            title="Refresh"
            disabled={isLoading}
          >
            {isLoading ? (
              <svg className="browser-loading-spinner" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="31.4 31.4" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M13 8C13 10.7614 10.7614 13 8 13C5.23858 13 3 10.7614 3 8C3 5.23858 5.23858 3 8 3C9.44027 3 10.7392 3.62858 11.6458 4.63889M11.6458 4.63889V2M11.6458 4.63889H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

        <input
          type="text"
          className="browser-url-input"
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter URL..."
          spellCheck={false}
        />

        <div className="browser-actions">
          <button
            type="button"
            className={`browser-action-button ${inspectorActive ? 'active' : ''}`}
            onClick={toggleInspector}
            title="Toggle Inspector (Alt+Shift+Q)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 8L14 6M8 8L2 6M8 8V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="browser-action-button"
            onClick={handleOpenInBrowser}
            title="Open in External Browser"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 9V12.5C12 12.7761 11.7761 13 11.5 13H3.5C3.22386 13 3 12.7761 3 12.5V4.5C3 4.22386 3.22386 4 3.5 4H7M10 3H13M13 3V6M13 3L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Iframe Browser Container */}
      <div className="browser-iframe-container">
        <iframe
          ref={iframeRef}
          src={url}
          className="browser-iframe"
          title="Browser"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
        />
      </div>
    </div>
  );
}
