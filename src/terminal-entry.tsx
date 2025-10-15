import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import StandaloneTerminal from './components/StandaloneTerminal';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found');
}

createRoot(rootElement).render(
  <StrictMode>
    <StandaloneTerminal />
  </StrictMode>
);
