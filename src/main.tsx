import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// REMOVED: monaco-environment import was causing React initialization issues in production builds
// Monaco configuration is now handled lazily in CodeEditorMonaco component
import { initTestModeInterception } from './utils/tauriInvokeWrapper' // Test mode interception
import './index.css'
// TEMPORARY: Switch between App.tsx and AppRefactored.tsx for testing
import App from './App.tsx'  // Original (6528 lines)
// import App from './AppRefactored.tsx'  // Refactored with Context API (1000 lines)
import ErrorBoundary from './components/ErrorBoundary'
import { AppProviders } from './contexts'
import { invoke } from '@tauri-apps/api/core'

// Initialize test mode interception BEFORE rendering
initTestModeInterception();

// 🔒 Disable context menu (Reload/Inspect Element) in production builds
// Only allow for developer (alekdob) on their Mac
async function setupContextMenuProtection() {
  // Skip in development mode - allow devtools
  if (import.meta.env.DEV) {
    console.log('[Security] Dev mode - context menu enabled');
    return;
  }

  try {
    // Get current macOS username
    const username = await invoke<string>('get_current_username');
    const isDeveloper = username === 'alekdob';

    if (isDeveloper) {
      console.log('[Security] Developer detected - context menu enabled');
      return;
    }

    // Disable context menu for all other users in production
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });

    // Also disable keyboard shortcuts for devtools
    document.addEventListener('keydown', (e) => {
      // Cmd+Option+I (Mac DevTools)
      if (e.metaKey && e.altKey && e.key === 'i') {
        e.preventDefault();
        return false;
      }
      // Cmd+Option+J (Mac Console)
      if (e.metaKey && e.altKey && e.key === 'j') {
        e.preventDefault();
        return false;
      }
      // Cmd+Shift+C (Mac Inspect Element)
      if (e.metaKey && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        return false;
      }
      // F12 (Windows/Linux DevTools)
      if (e.key === 'F12') {
        e.preventDefault();
        return false;
      }
    });

    console.log('[Security] Context menu disabled for production');
  } catch (error) {
    console.warn('[Security] Failed to setup context menu protection:', error);
    // If we can't determine the user, disable by default in production
    document.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      return false;
    });
  }
}

// Setup context menu protection
setupContextMenuProtection();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
