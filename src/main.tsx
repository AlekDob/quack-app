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

// Initialize test mode interception BEFORE rendering
initTestModeInterception();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
