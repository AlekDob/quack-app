import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './config/monaco-environment' // Configure Monaco workers BEFORE anything else
import './index.css'
// TEMPORARY: Switch between App.tsx and AppRefactored.tsx for testing
import App from './App.tsx'  // Original (6528 lines)
// import App from './AppRefactored.tsx'  // Refactored with Context API (1000 lines)
import ErrorBoundary from './components/ErrorBoundary'
import { AppProviders } from './contexts'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </ErrorBoundary>
  </StrictMode>,
)
