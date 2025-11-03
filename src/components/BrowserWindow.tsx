import { useCallback, useEffect, useRef, useState } from 'react';
import { open } from '@tauri-apps/plugin-shell';
import { invoke } from '@tauri-apps/api/core';
import './BrowserWindow.css';

interface BrowserTab {
  id: string;
  label: string;
  url: string;
}

interface BrowserWindowProps {
  initialUrl?: string;
  onFileOpen?: (filePath: string) => void;
}

export default function BrowserWindow({
  initialUrl = 'https://quack.build',
  onFileOpen,
}: BrowserWindowProps) {
  const [tabs, setTabs] = useState<BrowserTab[]>([
    { id: 'tab-1', label: 'New Tab', url: initialUrl }
  ]);
  const [activeTabId, setActiveTabId] = useState('tab-1');
  const [inputUrls, setInputUrls] = useState<Record<string, string>>({ 'tab-1': initialUrl });
  const [inspectorActive, setInspectorActive] = useState<Record<string, boolean>>({});
  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});

  const activeTab = tabs.find(t => t.id === activeTabId);
  const activeUrl = activeTab?.url || initialUrl;
  const activeInputUrl = inputUrls[activeTabId] || activeUrl;
  const isLocalhost = activeUrl.includes('localhost') || activeUrl.includes('127.0.0.1');

  // Listen for messages from inspector script
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { type, fileName, lineNumber, columnNumber } = event.data;

      if (type === 'quack-open-file' && fileName && onFileOpen) {
        console.log('🦆 Opening file from inspector:', fileName);
        onFileOpen(fileName);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onFileOpen]);

  // Inject inspector script when iframe loads
  useEffect(() => {
    if (!activeTabId) return;

    const iframe = iframeRefs.current[activeTabId];
    if (!iframe) return;

    const handleLoad = async () => {
      // Only inject for localhost URLs (CORS restriction)
      if (!activeUrl.includes('localhost') && !activeUrl.includes('127.0.0.1')) {
        console.warn('🦆 Inspector only works for localhost URLs');
        return;
      }

      // Wait for iframe to be ready
      await new Promise(resolve => setTimeout(resolve, 1500));

      try {
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!iframeDoc) {
          console.error('🦆 Cannot access iframe document (CORS)');
          return;
        }

        // Load inspector script
        const response = await fetch('/inspector-script.js');
        const scriptContent = await response.text();

        // Inject script
        const script = iframeDoc.createElement('script');
        script.textContent = scriptContent;
        script.type = 'text/javascript';
        (iframeDoc.head || iframeDoc.body).appendChild(script);

        console.log('🦆 Inspector script injected successfully!');
      } catch (error) {
        console.error('🦆 Failed to inject inspector:', error);
      }
    };

    iframe.addEventListener('load', handleLoad);

    return () => {
      iframe.removeEventListener('load', handleLoad);
    };
  }, [activeTabId, activeUrl]);

  const handleNavigate = useCallback((tabId: string, newUrl: string) => {
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

    // Extract domain/hostname for tab label
    let label = 'New Tab';
    try {
      const urlObj = new URL(finalUrl);
      label = urlObj.hostname;
    } catch (error) {
      console.warn('🦆 Invalid URL for label extraction:', finalUrl);
    }

    setTabs(prev => prev.map(tab =>
      tab.id === tabId ? { ...tab, url: finalUrl, label } : tab
    ));
    setInputUrls(prev => ({ ...prev, [tabId]: finalUrl }));

    console.log('🦆 Navigated to:', finalUrl, 'Label:', label);
  }, []);

  const handleGoBack = useCallback(() => {
    if (!activeTabId) return;
    const iframe = iframeRefs.current[activeTabId];
    if (iframe?.contentWindow) {
      iframe.contentWindow.history.back();
    }
  }, [activeTabId]);

  const handleGoForward = useCallback(() => {
    if (!activeTabId) return;
    const iframe = iframeRefs.current[activeTabId];
    if (iframe?.contentWindow) {
      iframe.contentWindow.history.forward();
    }
  }, [activeTabId]);

  const handleRefresh = useCallback(() => {
    if (!activeTabId) return;
    const iframe = iframeRefs.current[activeTabId];
    if (iframe && activeTab) {
      iframe.src = activeTab.url;
    }
  }, [activeTabId, activeTab]);

  const handleOpenInBrowser = useCallback(async () => {
    if (!activeInputUrl) return;
    try {
      await open(activeInputUrl);
      console.log('🦆 Opened in external browser:', activeInputUrl);
    } catch (error) {
      console.error('Failed to open in browser:', error);
    }
  }, [activeInputUrl]);

  const handleOpenNatively = useCallback(async () => {
    if (!activeInputUrl) return;
    try {
      const windowLabel = await invoke<string>('open_browser_window', {
        initialUrl: activeInputUrl
      });
      console.log('🦆 Opened natively:', activeInputUrl, windowLabel);
    } catch (error) {
      console.error('Failed to open native window:', error);
    }
  }, [activeInputUrl]);

  const toggleInspector = useCallback(() => {
    if (!activeTabId) return;

    const newState = !inspectorActive[activeTabId];
    setInspectorActive(prev => ({ ...prev, [activeTabId]: newState }));

    // Send toggle message to iframe
    const iframe = iframeRefs.current[activeTabId];
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage({
        type: 'quack-inspector-toggle',
        enabled: newState
      }, '*');
    }

    console.log('🦆 Inspector toggled:', newState);
  }, [activeTabId, inspectorActive]);

  const handleNewTab = useCallback(() => {
    const newTabId = `tab-${Date.now()}`;
    const newTab: BrowserTab = {
      id: newTabId,
      label: 'New Tab',
      url: 'https://quack.build'
    };

    setTabs(prev => [...prev, newTab]);
    setInputUrls(prev => ({ ...prev, [newTabId]: 'https://quack.build' }));
    setActiveTabId(newTabId);

    console.log('🦆 New tab created:', newTabId);
  }, []);

  const handleCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);

      // If closing active tab, switch to another
      if (tabId === activeTabId && filtered.length > 0) {
        setActiveTabId(filtered[filtered.length - 1].id);
      }

      // If no tabs left, create a new one
      if (filtered.length === 0) {
        const newTabId = `tab-${Date.now()}`;
        const newTab: BrowserTab = {
          id: newTabId,
          label: 'New Tab',
          url: 'https://quack.build'
        };
        setInputUrls({ [newTabId]: 'https://quack.build' });
        setActiveTabId(newTabId);
        return [newTab];
      }

      return filtered;
    });

    // Cleanup
    delete iframeRefs.current[tabId];
    setInputUrls(prev => {
      const updated = { ...prev };
      delete updated[tabId];
      return updated;
    });
    setInspectorActive(prev => {
      const updated = { ...prev };
      delete updated[tabId];
      return updated;
    });
  }, [activeTabId]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && activeTabId) {
      handleNavigate(activeTabId, activeInputUrl);
    }
  }, [activeTabId, activeInputUrl, handleNavigate]);

  return (
    <div className="browser-window">
      {/* Tab Bar */}
      <div className="browser-tab-bar">
        <div className="browser-tabs">
          {tabs.map(tab => (
            <div
              key={tab.id}
              className={`browser-tab-item ${activeTabId === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTabId(tab.id)}
            >
              <span className="browser-tab-label">{tab.label}</span>
              <button
                type="button"
                className="browser-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseTab(tab.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="browser-new-tab-button"
          onClick={handleNewTab}
          title="New Tab"
        >
          +
        </button>
      </div>

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
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M13 8C13 10.7614 10.7614 13 8 13C5.23858 13 3 10.7614 3 8C3 5.23858 5.23858 3 8 3C9.44027 3 10.7392 3.62858 11.6458 4.63889M11.6458 4.63889V2M11.6458 4.63889H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <input
          type="text"
          className="browser-url-input"
          value={activeInputUrl}
          onChange={(e) => setInputUrls(prev => ({ ...prev, [activeTabId]: e.target.value }))}
          onKeyDown={handleKeyDown}
          placeholder="Enter URL..."
          spellCheck={false}
        />

        <div className="browser-actions">
          {/* Inspector toggle - only show for localhost URLs */}
          {isLocalhost && (
            <button
              type="button"
              className={`browser-action-button ${inspectorActive[activeTabId] ? 'active' : ''}`}
              onClick={toggleInspector}
              title="Toggle Inspector (Alt+Shift+Q)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L14 6V10L8 14L2 10V6L8 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 8L14 6M8 8L2 6M8 8V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
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

      {/* Iframe Content for localhost, or prompt for external sites */}
      <div className="browser-content">
        {tabs.map(tab => {
          const isTabLocalhost = tab.url.includes('localhost') || tab.url.includes('127.0.0.1');

          return (
            <div
              key={tab.id}
              className="browser-iframe-container"
              style={{ display: activeTabId === tab.id ? 'flex' : 'none' }}
            >
              {isTabLocalhost ? (
                <iframe
                  ref={(el) => {
                    if (el) iframeRefs.current[tab.id] = el;
                  }}
                  src={tab.url}
                  className="browser-iframe"
                  title={`Browser Tab ${tab.label}`}
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
                />
              ) : (
                <div className="browser-native-prompt">
                  <div className="browser-native-prompt-content">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" className="browser-native-icon">
                      <path d="M21 3H3C1.89543 3 1 3.89543 1 5V19C1 20.1046 1.89543 21 3 21H21C22.1046 21 23 20.1046 23 19V5C23 3.89543 22.1046 3 21 3Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M1 7H23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <circle cx="5.5" cy="5" r="0.5" fill="currentColor"/>
                      <circle cx="7.5" cy="5" r="0.5" fill="currentColor"/>
                      <circle cx="9.5" cy="5" r="0.5" fill="currentColor"/>
                    </svg>
                    <h3>External Site</h3>
                    <p>
                      This site cannot be displayed in an iframe due to security restrictions (X-Frame-Options).
                    </p>
                    <p className="browser-native-url">{tab.url}</p>
                    <div className="browser-native-actions">
                      <button
                        type="button"
                        className="browser-native-button primary"
                        onClick={handleOpenNatively}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M2 8C2 5.23858 4.23858 3 7 3H9M9 3L7 1M9 3L7 5M14 8C14 10.7614 11.7614 13 9 13H7M7 13L9 15M7 13L9 11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Open Natively
                      </button>
                      <button
                        type="button"
                        className="browser-native-button"
                        onClick={handleOpenInBrowser}
                      >
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                          <path d="M12 9V12.5C12 12.7761 11.7761 13 11.5 13H3.5C3.22386 13 3 12.7761 3 12.5V4.5C3 4.22386 3.22386 4 3.5 4H7M10 3H13M13 3V6M13 3L7 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        Open in System Browser
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
