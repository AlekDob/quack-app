/**
 * AgentTerminalView (WS-pivot: embedded CLI)
 * ------------------------------------------------------------------
 * The new CENTER for agent sessions: an embedded interactive Claude Code
 * CLI in a real PTY.
 *
 * CRITICAL — persistence pattern (mirrors the proven XTermInstance):
 * the xterm instance, its addons and its `terminal-data` listener are kept
 * ALIVE in a module-level Map keyed by terminalId. On every (re)mount we
 * REUSE the live instance and just re-parent its DOM into the new container.
 * We NEVER dispose on unmount. This is what makes it survive:
 *   - React StrictMode's mount→unmount→remount (a dispose/recreate here loses
 *     the shell prompt + claude's TUI frames that were emitted to the first,
 *     discarded mount — leaving an empty terminal with only a cursor)
 *   - tab switches between sessions
 * Disposal happens only via the explicit disposeAgentTerminal() below.
 *
 * Sizing uses a ResizeObserver + window resize + a rAF retry on (re)attach so
 * xterm and the PTY stay locked together (a mismatch garbles claude's TUI).
 *
 * Wired to Quack's portable-pty backend (create_agent_terminal /
 * write_to_terminal / resize_terminal + `terminal-data` events).
 *
 * Brain: 069-embedded-cli-hooks-pivot
 */
import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { listen } from '@tauri-apps/api/event';
import { invoke } from '@tauri-apps/api/core';
import '@xterm/xterm/css/xterm.css';
import './AgentTerminalView.css';

interface AgentTerminalViewProps {
  /** Quack session id — becomes QUACK_SESSION_ID, the authoritative status key. */
  sessionId: string;
  /** Working directory for the agent's project. */
  cwd: string;
  /** Accent color (cursor) for the terminal. */
  color?: string;
  /** Display label for the spawned terminal. */
  label?: string;
  /** Whether this view is currently visible (kept for API parity; unused). */
  isActive?: boolean;
  /** Auto-run `claude` once the PTY is ready (default true). */
  autostart?: boolean;
  /** Optional extra args appended to the `claude` launch command (e.g. `--resume <id>`). */
  claudeArgs?: string;
}

const terminalIdFor = (sessionId: string) => `agent-cli-${sessionId}`;

interface AgentTermInstance {
  term: Terminal;
  fitAddon: FitAddon;
  unlistenData: () => void;
  unlistenExit: () => void;
}

// Live xterm instances, persisted across mounts/tab-switches (see header).
const agentTerminalInstances = new Map<string, AgentTermInstance>();
// In-flight creations, so StrictMode's two overlapping mounts don't both create
// a PTY/xterm for the same id (the loser would leak + steal `terminal-data`).
const initInFlight = new Map<string, Promise<void>>();
// Autostart guards: claude is launched exactly once per PTY lifetime, and never
// relaunched when the user exits it and re-opens the tab.
const createdTerminals = new Set<string>(); // PTYs we spawned this app lifetime
const launchedTerminals = new Set<string>(); // PTYs we've typed `claude` into

function launchClaudeInto(terminalId: string, claudeArgs?: string) {
  if (launchedTerminals.has(terminalId)) return;
  launchedTerminals.add(terminalId);
  const base = claudeArgs ? `claude ${claudeArgs}` : 'claude';
  invoke('write_to_terminal', { id: terminalId, data: `clear && ${base}\n` }).catch(() => {});
}

/** Fully tear down an agent terminal (call when its session/tab is closed). */
export function disposeAgentTerminal(sessionId: string): void {
  const id = terminalIdFor(sessionId);
  const inst = agentTerminalInstances.get(id);
  if (inst) {
    try {
      inst.unlistenData();
      inst.unlistenExit();
      inst.term.dispose();
    } catch {
      /* ignore */
    }
    agentTerminalInstances.delete(id);
    invoke('close_terminal', { id }).catch(() => {});
  }
  createdTerminals.delete(id);
  launchedTerminals.delete(id);
}

export function AgentTerminalView({
  sessionId,
  cwd,
  color = '#4ecdc4',
  label,
  autostart = true,
  claudeArgs,
}: AgentTerminalViewProps) {
  const terminalId = terminalIdFor(sessionId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let disposedLocal = false;
    let resizeObserver: ResizeObserver | null = null;
    let onWindowResize: (() => void) | undefined;

    const syncResize = (fit: FitAddon): boolean => {
      try {
        fit.fit();
        const dims = fit.proposeDimensions();
        if (dims && dims.cols > 1 && dims.rows > 1) {
          invoke('resize_terminal', { id: terminalId, cols: dims.cols, rows: dims.rows }).catch(
            () => {}
          );
          return true;
        }
      } catch {
        /* ignore transient fit errors */
      }
      return false;
    };

    // The flex/layout height may not be resolved on the first frame after
    // (re)mount; retry across animation frames until the fit reports real dims.
    const fitUntilSized = (fit: FitAddon, attempts = 30) => {
      if (disposedLocal) return;
      if (!syncResize(fit) && attempts > 0) {
        requestAnimationFrame(() => fitUntilSized(fit, attempts - 1));
      }
    };

    const attachResizeHandlers = (fit: FitAddon) => {
      if (!containerRef.current) return;
      resizeObserver = new ResizeObserver(() => syncResize(fit));
      resizeObserver.observe(containerRef.current);
      onWindowResize = () => syncResize(fit);
      window.addEventListener('resize', onWindowResize);
    };

    const eligibleForAutostart = () => autostart && createdTerminals.has(terminalId);

    // Attach a live instance to the current container: open it here on first
    // use (guarantees term.open runs on an in-DOM node), else re-parent. Refit,
    // repaint, focus.
    const reuse = (inst: AgentTermInstance) => {
      if (!containerRef.current) return;
      if (!inst.term.element) {
        inst.term.open(containerRef.current);
      } else if (inst.term.element.parentElement !== containerRef.current) {
        containerRef.current.innerHTML = '';
        containerRef.current.appendChild(inst.term.element);
      }
      attachResizeHandlers(inst.fitAddon);
      fitUntilSized(inst.fitAddon);
      // Force a full repaint so a re-parented element (or one opened into a
      // since-detached container under StrictMode) redraws its current frame.
      requestAnimationFrame(() => {
        try {
          inst.term.refresh(0, inst.term.rows - 1);
        } catch {
          /* ignore */
        }
      });
      inst.term.focus();
      // Cover the case where the launch was scheduled on a since-discarded mount.
      if (eligibleForAutostart() && !launchedTerminals.has(terminalId)) {
        window.setTimeout(() => launchClaudeInto(terminalId, claudeArgs), 1200);
      }
    };

    // Create the PTY + xterm + listeners and store them in the Map. The xterm
    // is NOT opened here — reuse() opens it on the current in-DOM container.
    const createInstance = async (): Promise<void> => {
      const exists = await invoke<boolean>('terminal_exists', { id: terminalId }).catch(
        () => false
      );
      if (!exists) {
        await invoke('create_agent_terminal', {
          id: terminalId,
          label: label ?? `Agent ${sessionId.slice(0, 6)}`,
          color,
          cwd,
          sessionId,
        });
        createdTerminals.add(terminalId);
      }

      const term = new Terminal({
        cursorBlink: true,
        fontSize: 14,
        fontFamily: 'Menlo, Monaco, "Courier New", monospace',
        allowProposedApi: true,
        scrollback: 4000,
        theme: { background: '#1e1e1e', foreground: '#ffffff', cursor: color },
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.loadAddon(new WebLinksAddon());

      // PTY → xterm. First byte means the shell prompt is up → launch claude.
      const unlistenData = await listen<{ id: string; data: string }>('terminal-data', (event) => {
        if (event.payload?.id !== terminalId) return;
        term.write(event.payload.data);
        if (eligibleForAutostart() && !launchedTerminals.has(terminalId)) {
          // Small settle so the prompt is fully drawn before we type.
          window.setTimeout(() => launchClaudeInto(terminalId, claudeArgs), 180);
        }
      });
      const unlistenExit = await listen<{ id: string }>('terminal-exit', (event) => {
        if (event.payload?.id === terminalId) {
          term.write('\r\n\x1b[33m[sessione terminata]\x1b[0m\r\n');
        }
      });
      // xterm → PTY.
      term.onData((data) => {
        invoke('write_to_terminal', { id: terminalId, data }).catch(() => {});
      });

      agentTerminalInstances.set(terminalId, { term, fitAddon, unlistenData, unlistenExit });
    };

    (async () => {
      try {
        let inst = agentTerminalInstances.get(terminalId);
        if (!inst) {
          let pending = initInFlight.get(terminalId);
          if (!pending) {
            pending = createInstance();
            initInFlight.set(terminalId, pending);
            pending.finally(() => initInFlight.delete(terminalId));
          }
          await pending;
          inst = agentTerminalInstances.get(terminalId);
        }
        if (disposedLocal || !inst || !containerRef.current) return;

        reuse(inst);

        // Fallback launch in case the prompt fired before any data listener was
        // attached (idempotent with the first-byte trigger via launchedTerminals).
        if (eligibleForAutostart()) {
          window.setTimeout(() => launchClaudeInto(terminalId, claudeArgs), 1200);
        }
      } catch (err) {
        console.error('[AgentTerminalView] failed to start agent terminal:', err);
        if (!disposedLocal) setError(String(err));
      }
    })();

    return () => {
      disposedLocal = true;
      resizeObserver?.disconnect();
      if (onWindowResize) window.removeEventListener('resize', onWindowResize);
      // Intentionally NOT disposing the xterm/listeners — persisted in
      // agentTerminalInstances so the live PTY survives StrictMode + tab switches.
    };
  }, [terminalId, sessionId, cwd, color, label, autostart, claudeArgs]);

  return (
    <div
      className="agent-terminal-view"
      style={{
        flex: 1,
        minHeight: 0,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: '#1e1e1e',
      }}
    >
      {error ? (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(255,120,120,0.9)',
            fontSize: 13,
            padding: 24,
            textAlign: 'center',
          }}
        >
          Impossibile avviare il terminale agent: {error}
          <br />
          (Hai ricompilato il backend con `cargo tauri dev`?)
        </div>
      ) : (
        <div ref={containerRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }} />
      )}
    </div>
  );
}
