import { useEffect, useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import TerminalView from './TerminalView';
import type { TerminalInfo } from '../types';
import './StandaloneTerminal.css';

/**
 * Standalone Terminal Component
 * Renders a single terminal in an independent window
 * Used when opening new terminal windows via TerminalWindowButton
 */
export default function StandaloneTerminal() {
  const [terminal, setTerminal] = useState<TerminalInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initTerminal = async () => {
      try {
        // Get terminal ID from URL params
        const params = new URLSearchParams(window.location.search);
        const terminalId = params.get('terminal');
        const cwd = params.get('cwd');
        const color = params.get('color') || '#f28c52';

        if (!terminalId) {
          throw new Error('Missing terminal ID in URL parameters');
        }

        // Get window label for terminal label
        const currentWindow = getCurrentWindow();
        const windowLabel = currentWindow.label;

        // Initialize terminal info
        const terminalInfo: TerminalInfo = {
          id: terminalId,
          label: windowLabel,
          cwd: cwd || await invoke<string>('get_home_dir'),
          color,
          status: 'idle',
          alive: true,
        };

        setTerminal(terminalInfo);
        setLoading(false);
      } catch (err) {
        console.error('Failed to initialize standalone terminal:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    initTerminal();
  }, []);

  const handleTerminalInput = () => {
    // Terminal input is handled directly by TerminalView
  };

  const handleTerminalOutput = () => {
    // Terminal output is handled directly by TerminalView
  };

  const handleUpdateRecentCommands = () => {
    // No recent commands tracking in standalone mode
  };

  if (loading) {
    return (
      <div className="standalone-terminal-loading">
        <div className="loading-spinner" />
        <p>Initializing terminal...</p>
      </div>
    );
  }

  if (error || !terminal) {
    return (
      <div className="standalone-terminal-error">
        <h2>Failed to initialize terminal</h2>
        <p>{error || 'Unknown error'}</p>
      </div>
    );
  }

  return (
    <div className="standalone-terminal-container">
      <TerminalView
        activeId={terminal.id}
        terminals={[terminal]}
        onUserInput={handleTerminalInput}
        onOutput={handleTerminalOutput}
        onUpdateRecentCommands={handleUpdateRecentCommands}
      />
    </div>
  );
}
