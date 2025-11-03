import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import BrowserWindow from './components/BrowserWindow';
import './App.css';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';

function BrowserApp() {
  const [initialUrl] = useState<string>('https://quack.build');

  useEffect(() => {
    // Listen for initial URL from Rust
    const unlisten = listen<string>('browser-initial-url', (event) => {
      console.log('🦆 Received initial URL:', event.payload);

      // TODO: Navigate the first tab to this URL
      // For now, just log it - we'll need to expose a method from BrowserWindow
      // to programmatically navigate
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleFileOpen = async (filePath: string) => {
    try {
      // Send message to main window to open file
      await invoke('emit_to_main', {
        event: 'open-file-from-browser',
        payload: { filePath }
      });
      console.log('🦆 Sent file open request to main window:', filePath);
    } catch (error) {
      console.error('Failed to send file open request:', error);
    }
  };

  return (
    <BrowserWindow
      initialUrl={initialUrl}
      onFileOpen={handleFileOpen}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserApp />
  </React.StrictMode>
);
