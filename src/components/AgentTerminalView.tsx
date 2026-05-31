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
import { useSettingsStore } from '../stores/settingsStore';
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

/** Convert a #rrggbb / #rgb hex to an rgba() string (for the selection tint). */
function accentRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const n = parseInt(full, 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

// --- Experimental: highlight the user's own messages with the accent. --------
// claude renders its user-message bars itself (ANSI frames in the PTY), so we
// cannot recolor them directly. Instead we capture the EXACT text the user
// submits (ground truth from term.onData), then — once claude has redrawn it
// into a bar — locate that line in the xterm buffer and lay an accent
// decoration UNDER it. Best-effort: bails on edited/escape/pasted input.
// Disable with localStorage 'quack:cliHighlightUser' = '0'.
const HIGHLIGHT_USER_MESSAGES = (() => {
  try {
    return localStorage.getItem('quack:cliHighlightUser') !== '0';
  } catch {
    return true;
  }
})();

const HL_SCAN_LINES = 60; // how far above the cursor to look for the bar
const HL_RETRIES = 14; // claude redraw can lag a few frames
const HL_RETRY_MS = 120;

/** Lay a full-width accent band under buffer line `y` (absolute buffer index). */
function decorateUserLine(term: Terminal, y: number): void {
  const active = term.buffer.active;
  const offset = y - (active.baseY + active.cursorY); // negative = above cursor
  const marker = term.registerMarker(offset);
  if (!marker) return;
  const accent = useSettingsStore.getState().appearance.accentColor;
  // layer:'top' (not 'bottom') — claude paints the bar's grey via cell
  // backgrounds, which sit ABOVE a 'bottom' decoration and would hide it. A
  // translucent 'top' tint reads over both the grey and the text.
  const deco = term.registerDecoration({ marker, x: 0, width: term.cols, layer: 'top' });
  deco?.onRender((el) => {
    el.style.backgroundColor = accentRgba(accent, 0.22);
    el.style.borderLeft = `3px solid ${accent}`;
    el.style.boxSizing = 'border-box';
    el.style.width = '100%';
    el.style.pointerEvents = 'none';
  });
}

/** Find the nearest line above the cursor whose text matches `needle`. */
function highlightSubmitted(term: Terminal, needle: string): boolean {
  const active = term.buffer.active;
  const cursorAbs = active.baseY + active.cursorY;
  const lo = Math.max(0, cursorAbs - HL_SCAN_LINES);
  // Skip the live input line itself (cursorAbs); the committed bar sits above.
  for (let y = cursorAbs - 1; y >= lo; y--) {
    const line = active.getLine(y);
    if (!line) continue;
    // Strip claude's bar prefix ("> ", vertical rules, spaces) before matching.
    const stripped = line.translateToString(true).replace(/^[\s>│┃|]+/, '').trim();
    if (stripped.length === 0) continue;
    if (stripped === needle || stripped.startsWith(needle)) {
      decorateUserLine(term, y);
      return true;
    }
  }
  return false;
}

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

/**
 * Read the bottom `maxLines` of an agent terminal's rendered buffer as plain
 * text. This is the input for screen-based state detection (the herdr method):
 * the rendered screen is the ground truth that corrects lossy hooks. Buffers
 * stay live across mounts/tab-switches, so background sessions are readable too.
 * Returns null when no live instance exists for the session.
 */
export function readAgentTerminalScreen(sessionId: string, maxLines = 80): string | null {
  const inst = agentTerminalInstances.get(terminalIdFor(sessionId));
  if (!inst) return null;
  const buf = inst.term.buffer.active;
  const end = buf.length;
  const start = Math.max(0, end - maxLines);
  const lines: string[] = [];
  for (let y = start; y < end; y++) {
    const line = buf.getLine(y);
    lines.push(line ? line.translateToString(true) : '');
  }
  return lines.join('\n');
}

/** Session ids of all live agent terminals (for the arbitration sweep). */
export function listAgentTerminalSessionIds(): string[] {
  return [...agentTerminalInstances.keys()].map((id) => id.replace(/^agent-cli-/, ''));
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
  }
  // Always kill the PTY (and its `claude` child), even when no live xterm
  // instance exists in this run's Map — the backend registry is authoritative
  // for the process, so the reaper can reach orphans the frontend never tracked.
  invoke('close_terminal', { id }).catch(() => {});
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
  // Accent from Settings → drives the cursor (where the user types) and the
  // text selection tint. The user-message bars themselves are rendered by the
  // claude CLI inside the PTY (its own ANSI frames) and are NOT recolorable
  // from here without fragile TUI parsing — see the view header.
  const accentColor = useSettingsStore((s) => s.appearance.accentColor);

  // Live-update the persisted instance's theme when the accent changes (the
  // xterm is created once and kept alive across mounts, so a prop/store change
  // must be pushed onto term.options rather than recreating it).
  useEffect(() => {
    const inst = agentTerminalInstances.get(terminalId);
    if (!inst) return;
    inst.term.options.theme = {
      ...(inst.term.options.theme || {}),
      cursor: accentColor,
      selectionBackground: accentRgba(accentColor, 0.3),
    };
  }, [accentColor, terminalId]);

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
        theme: {
          background: '#0F1115',
          foreground: '#ffffff',
          cursor: accentColor || color,
          selectionBackground: accentRgba(accentColor || color, 0.3),
        },
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
      // xterm → PTY (+ capture the submitted line for accent highlighting).
      let pendingInput = '';
      const scheduleHighlight = (submitted: string) => {
        const needle = submitted.trim();
        if (needle.length < 1) return;
        let tries = 0;
        const attempt = () => {
          if (highlightSubmitted(term, needle)) return;
          if (tries++ < HL_RETRIES) window.setTimeout(attempt, HL_RETRY_MS);
        };
        window.setTimeout(attempt, 140);
      };
      term.onData((data) => {
        invoke('write_to_terminal', { id: terminalId, data }).catch(() => {});
        if (!HIGHLIGHT_USER_MESSAGES) return;
        for (let i = 0; i < data.length; i++) {
          const ch = data[i];
          const code = ch.charCodeAt(0);
          if (ch === '\r' || ch === '\n') {
            const submitted = pendingInput;
            pendingInput = '';
            scheduleHighlight(submitted);
          } else if (code === 0x7f || code === 0x08) {
            pendingInput = pendingInput.slice(0, -1); // backspace
          } else if (code === 0x1b) {
            pendingInput = ''; // escape seq (arrows/paste/edit) → bail on this line
            break;
          } else if (code >= 0x20) {
            pendingInput += ch;
          }
        }
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
        background: '#0F1115',
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
        <div
          ref={containerRef}
          style={{ position: 'absolute', inset: 0, overflow: 'hidden', padding: '8px 12px' }}
        />
      )}
    </div>
  );
}
