import { useCallback, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import './BrowserManager.css';

export default function BrowserManager() {
  const [url, setUrl] = useState('https://quack.build');
  const [isOpening, setIsOpening] = useState(false);

  const handleOpenBrowser = useCallback(async () => {
    if (!url.trim()) return;

    let finalUrl = url.trim();
    // Auto-detect protocol
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      // If it looks like localhost or has a port, use http
      if (finalUrl.includes('localhost') || finalUrl.match(/:\d+/)) {
        finalUrl = `http://${finalUrl}`;
      } else {
        finalUrl = `https://${finalUrl}`;
      }
    }

    setIsOpening(true);
    try {
      const windowLabel = await invoke<string>('open_browser_window', {
        initialUrl: finalUrl
      });
      console.log('🦆 Browser window opened:', windowLabel, 'URL:', finalUrl);
      toast.success('Browser window opened!', {
        description: finalUrl,
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to open browser window:', error);
      toast.error('Failed to open browser', {
        description: String(error),
        duration: 3000,
      });
    } finally {
      setIsOpening(false);
    }
  }, [url]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleOpenBrowser();
    }
  }, [handleOpenBrowser]);

  const handleQuickLink = useCallback((quickUrl: string) => {
    setUrl(quickUrl);
  }, []);

  return (
    <div className="browser-manager">
      <div className="browser-manager-header">
        <svg className="browser-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="2" y1="12" x2="22" y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
        <h1>Browser Manager</h1>
      </div>

      <p className="browser-manager-description">
        Enter a URL to open in a native browser window. Inspector works automatically on localhost URLs!
      </p>

      <div className="url-input-container">
        <input
          type="text"
          className="url-input"
          placeholder="Enter URL (e.g., google.com or localhost:5173)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          disabled={isOpening}
        />
        <button
          className="open-button"
          onClick={handleOpenBrowser}
          disabled={isOpening || !url.trim()}
        >
          {isOpening ? (
            <>
              <span className="spinner"></span>
              Opening...
            </>
          ) : (
            <>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                <polyline points="15 3 21 3 21 9"/>
                <line x1="10" y1="14" x2="21" y2="3"/>
              </svg>
              Open in Browser Window
            </>
          )}
        </button>
      </div>

      <div className="quick-links">
        <h3>Quick Links</h3>
        <div className="quick-links-grid">
          <button
            className="quick-link-button"
            onClick={() => handleQuickLink('https://quack.build')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
            Quack Build
          </button>
          <button
            className="quick-link-button"
            onClick={() => handleQuickLink('localhost:5173')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            localhost:5173
          </button>
          <button
            className="quick-link-button"
            onClick={() => handleQuickLink('localhost:3000')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/>
              <line x1="8" y1="21" x2="16" y2="21"/>
              <line x1="12" y1="17" x2="12" y2="21"/>
            </svg>
            localhost:3000
          </button>
          <button
            className="quick-link-button"
            onClick={() => handleQuickLink('https://google.com')}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="10"/>
              <line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
            </svg>
            Google
          </button>
        </div>
      </div>

      <div className="info-cards">
        <div className="info-card">
          <div className="info-card-icon">🦆</div>
          <h4>Inspector for Localhost</h4>
          <p>
            When you open a <code>localhost</code> URL, the inspector will be automatically injected.
            Use <kbd>Alt</kbd> + <kbd>Shift</kbd> + <kbd>Q</kbd> to toggle it.
          </p>
        </div>
        <div className="info-card">
          <div className="info-card-icon">🌐</div>
          <h4>All Sites Work</h4>
          <p>
            Native WebView windows work with all sites including Google, Facebook, and any other website without restrictions.
          </p>
        </div>
        <div className="info-card">
          <div className="info-card-icon">📂</div>
          <h4>Open Files in Quack</h4>
          <p>
            Click on components in the inspector to open their source files directly in Quack's tab system.
          </p>
        </div>
      </div>
    </div>
  );
}
