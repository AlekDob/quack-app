import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { TerminalWindowApp } from './components/TerminalWindowApp';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <TerminalWindowApp />
  </StrictMode>
);
