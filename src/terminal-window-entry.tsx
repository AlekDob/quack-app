/**
 * Terminal Window Entry Point
 *
 * Note: StrictMode is intentionally disabled for the terminal window
 * because XTerm.js doesn't handle double-mounting well in React 18's
 * strict mode (which mounts components twice in development).
 * This prevents duplicate event listeners and rendering issues.
 */
import { createRoot } from 'react-dom/client';
import { TerminalWindowApp } from './components/TerminalWindowApp';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(<TerminalWindowApp />);
