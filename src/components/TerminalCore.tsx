import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Terminal, type IDisposable, type ILink } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { openUrl } from "@tauri-apps/plugin-opener";
import { pty } from "../ipc";
import { useStore } from "../store";
import { useResolvedTheme } from "../theme";
import { getEditorSettings, useEditorSettings } from "../editorSettings";
import { setEditorGoto } from "../editorState";
import { ContextMenu } from "./ContextMenu";
import { registerResumeComponent } from "../resumeDebug";
import { logAgentModePhase } from "../switchPerf";

/**
 * Match `path:line` and `path:line:col` patterns in terminal output so the
 * user can click a compiler error / stack-trace frame / `grep -n` hit and
 * jump to the source location.
 *
 * Coverage:
 *   - Windows absolute: `C:\foo\bar.ts:12:5` / `C:/foo/bar.ts:12`
 *   - POSIX absolute:   `/home/x/file.rs:42`
 *   - POSIX relative:   `./src/foo.tsx:10:3` / `../lib/x.js:7`
 *   - Bare relative:    `src/foo.tsx:8` / `Cargo.toml:14`
 *
 * Capture groups: [1] = line, [2] = optional column. The full match is the
 * `path:line(:col)?` substring; we strip the trailing `:line(:col)?` to get
 * the path itself.
 *
 * The leading optional prefix excludes anything starting with a URL scheme
 * (the engine's longest-match would never produce one anyway because `://`
 * doesn't fit our shape, but we also reject hits whose path starts with
 * `http` defensively further below).
 */
const PATH_LINE_COL_RE =
  /(?:[A-Za-z]:[\\/]|\.{1,2}[\\/]|\/)?(?:[\w.\-]+[\\/])*[\w.\-]+\.\w+:(\d+)(?::(\d+))?/g;

/** http(s) URLs in terminal output — dev-server addresses, package
 *  registry links, CI URLs. Activated via the system browser. */
const URL_RE = /https?:\/\/[^\s"'<>()[\]]+/g;

/** Release WKWebView can mis-route Backspace via the hidden textarea and
 *  echo a space; send canonical erase sequences straight to the PTY. */
function termEditKeySeq(e: KeyboardEvent): string | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  if (e.key === "Backspace") return "\x7f";
  if (e.key === "Delete") return "\x1b[3~";
  return null;
}

const xtermDark = {
  background: "#1e1e1e",
  foreground: "#d4d4d4",
  cursor: "#d4d4d4",
  cursorAccent: "#1e1e1e",
  selectionBackground: "#264f78",
  selectionForeground: "#ffffff",
  selectionInactiveBackground: "#3a3d41",
  black: "#000000",
  red: "#cd3131",
  green: "#0dbc79",
  yellow: "#e5e510",
  blue: "#2472c8",
  magenta: "#bc3fbc",
  cyan: "#11a8cd",
  white: "#e5e5e5",
  brightBlack: "#666666",
  brightRed: "#f14c4c",
  brightGreen: "#23d18b",
  brightYellow: "#f5f543",
  brightBlue: "#3b8eea",
  brightMagenta: "#d670d6",
  brightCyan: "#29b8db",
  brightWhite: "#ffffff",
};
const xtermLight = {
  background: "#ffffff",
  foreground: "#1f1f1f",
  cursor: "#1f1f1f",
  cursorAccent: "#ffffff",
  selectionBackground: "#add6ff",
  selectionForeground: "#000000",
  selectionInactiveBackground: "#e5ebf1",
  black: "#000000",
  red: "#cd3131",
  green: "#107c10",
  yellow: "#795e26",
  blue: "#0451a5",
  magenta: "#bc05bc",
  cyan: "#0598bc",
  white: "#555555",
  brightBlack: "#7a7a7a",
  brightRed: "#cd3131",
  brightGreen: "#14ce14",
  brightYellow: "#8a6f1a",
  brightBlue: "#0451a5",
  brightMagenta: "#bc05bc",
  brightCyan: "#0598bc",
  brightWhite: "#3b3b3b",
};

interface Props {
  termId: string;
  cwd: string;
  container: HTMLElement | null;
  visible: boolean;
  shellPath?: string;
  shellArgs?: string[];
  title?: string;
  /** If set, attach to an already-running PTY (survived a reload) instead of spawning. */
  ptyId?: string;
  /** Called when this terminal first acquires (or freshly re-acquires) a PTY id. */
  onPtyIdChange?: (id: string) => void;
}

/** A single match in the terminal scrollback. row is absolute (incl. scrollback). */
interface Match {
  row: number;
  col: number;
  length: number;
}

export function TerminalCore({
  termId,
  cwd,
  container,
  visible,
  shellPath,
  shellArgs,
  title,
  ptyId,
  onPtyIdChange,
}: Props) {
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const ptyIdRef = useRef<string | null>(null);
  const hostNodeRef = useRef<HTMLDivElement | null>(null);
  // The link provider's `provideLinks` closure runs for the lifetime of the
  // terminal — keep cwd in a ref so we always resolve relative paths against
  // the *current* workspace root if the terminal is later re-bound.
  const cwdRef = useRef(cwd);
  useEffect(() => {
    cwdRef.current = cwd;
  }, [cwd]);
  const resolvedTheme = useResolvedTheme();
  // Terminal font tracks the editor's font size so Ctrl+= / Ctrl+- zoom
  // and the settings slider apply everywhere, not just in Monaco.
  const { fontSize } = useEditorSettings();

  // Right-click context menu. Without it the raw WebView2 menu showed
  // (with a Refresh item that could discard unsaved work).
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(
    null,
  );

  // --- Find overlay state -------------------------------------------------
  const [findOpen, setFindOpen] = useState(false);
  const [findQuery, setFindQuery] = useState("");
  const [findCaseSensitive, setFindCaseSensitive] = useState(false);
  const [matches, setMatches] = useState<Match[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const findInputRef = useRef<HTMLInputElement | null>(null);

  // Update xterm theme when app theme changes.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    try {
      term.options.theme =
        resolvedTheme === "dark" ? xtermDark : xtermLight;
    } catch {
      /* ignore */
    }
  }, [resolvedTheme]);

  // Stable touch helper: fired from input, focus, and mount. Cheap;
  // updates a module-level Map keyed by wsId+termId. We resolve wsId
  // from the store by scanning loaded workspaces for the one that owns
  // this termId — keeps the prop surface unchanged so the pop-out
  // window (which doesn't know wsId) just naturally becomes a no-op
  // when the terminal isn't found in any main-window workspace.
  const touchSelf = useCallback(() => {
    try {
      const loaded = useStore.getState().loaded;
      for (const [wsId, ws] of Object.entries(loaded)) {
        if (ws.terminals[termId]) {
          useStore.getState().touchTerminal(wsId, termId);
          return;
        }
      }
    } catch {
      /* ignore */
    }
  }, [termId]);

  // Mount-once: create xterm + spawn PTY. Tear down on real unmount.
  useEffect(() => {
    // Bootstrap the idle-close clock. Without this, a workspace that
    // was loaded from disk would spawn this terminal with no recorded
    // activity timestamp; the sweeper bootstraps to "now" too, but
    // doing it here is cheaper and keeps the sweeper code simpler.
    touchSelf();
    const initialTheme =
      document.documentElement.dataset.theme === "light"
        ? xtermLight
        : xtermDark;
    const term = new Terminal({
      fontFamily: 'Cascadia Mono, Consolas, "Courier New", monospace',
      // Read imperatively — this mount-once effect must not re-run (it
      // would respawn the PTY); the live-update effect below handles
      // later font-size changes.
      fontSize: getEditorSettings().fontSize,
      theme: initialTheme,
      cursorBlink: true,
      convertEol: true,
      allowProposedApi: true,
      scrollback: 5000,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;

    // Register with the resume-debug registry so a wake-from-standby can
    // refit xterm (its internal canvas occasionally desyncs from the
    // surrounding flex layout after macOS sleep).
    const unregisterTerm = registerResumeComponent({
      id: `xterm:${termId}`,
      kind: "xterm",
      snapshot: () => {
        const host = hostNodeRef.current;
        return {
          cols: term.cols,
          rows: term.rows,
          box: host ? `${host.clientWidth}x${host.clientHeight}` : "detached",
          visible: host ? host.getBoundingClientRect().width > 0 : false,
        };
      },
      heal: () => {
        try {
          fit.fit();
        } catch {
          /* ignore — see resumeDebug contract */
        }
      },
    });

    // Ref callbacks fire BEFORE this effect, so by the time we create
    // the Terminal here the host div may already exist. Open onto it.
    if (hostNodeRef.current) {
      try {
        term.open(hostNodeRef.current);
      } catch {
        /* ignore */
      }
      requestAnimationFrame(() => {
        try {
          if (hostNodeRef.current && hostNodeRef.current.offsetWidth > 0) {
            fit.fit();
          }
        } catch {
          /* ignore */
        }
        try {
          term.focus();
        } catch {
          /* ignore */
        }
      });
    }

    term.attachCustomKeyEventHandler((e) => {
      if (e.type !== "keydown") return true;
      const editSeq = termEditKeySeq(e);
      if (editSeq) {
        if (ptyIdRef.current) void pty.write(ptyIdRef.current, editSeq);
        return false;
      }
      const k = e.key.toLowerCase();
      if (e.ctrlKey && e.shiftKey && k === "c") {
        const sel = term.getSelection();
        if (sel) void navigator.clipboard.writeText(sel);
        return false;
      }
      if (e.ctrlKey && e.shiftKey && k === "v") {
        void navigator.clipboard.readText().then((t) => {
          if (t && ptyIdRef.current) void pty.write(ptyIdRef.current, t);
        });
        return false;
      }
      if (e.ctrlKey && !e.shiftKey && k === "c") {
        const sel = term.getSelection();
        if (sel) {
          void navigator.clipboard.writeText(sel);
          term.clearSelection();
        } else if (ptyIdRef.current) {
          void pty.write(ptyIdRef.current, "\x03");
        }
        return false;
      }
      // Ctrl+F: open find overlay (terminal-focused only — Monaco has its own
      // Ctrl+F because that handler never sees keys typed inside the editor).
      if (e.ctrlKey && !e.shiftKey && !e.altKey && k === "f") {
        const sel = term.getSelection();
        // Defer to React state — refs aren't reactive, so we use a CustomEvent
        // dispatched on the host node and listen on it from a state-aware
        // effect below.
        const host = hostNodeRef.current;
        if (host) {
          host.dispatchEvent(
            new CustomEvent("codetta:term-find-open", {
              detail: { selection: sel || "" },
              bubbles: false,
            }),
          );
        }
        return false;
      }
      return true;
    });

    // Make `path:line[:col]` substrings clickable so the user can jump from
    // a compiler error / stack-trace frame / `grep -n` hit straight to the
    // source location in the editor. Uses xterm's built-in link provider —
    // no addon needed.
    const linkDisposable: IDisposable = term.registerLinkProvider({
      provideLinks(bufferLineNumber, callback) {
        const buf = term.buffer.active;
        // xterm hands us 1-based line numbers; the buffer API is 0-based.
        const line = buf.getLine(bufferLineNumber - 1);
        if (!line) {
          callback(undefined);
          return;
        }
        const text = line.translateToString(true);
        if (!text) {
          callback(undefined);
          return;
        }
        const links: ILink[] = [];
        // Reset lastIndex defensively — the regex is shared & /g.
        PATH_LINE_COL_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = PATH_LINE_COL_RE.exec(text)) !== null) {
          const matchText = m[0];
          const lineNum = parseInt(m[1] ?? "0", 10);
          const colNum = m[2] ? parseInt(m[2], 10) : 1;
          if (!Number.isFinite(lineNum) || lineNum < 1) continue;
          // Strip the `:line(:col)?` suffix to recover the path itself.
          const suffixLen =
            1 + m[1]!.length + (m[2] ? 1 + m[2].length : 0);
          const pathText = matchText.slice(0, matchText.length - suffixLen);
          // Defensive: skip URLs (xterm's URL link addon isn't loaded here,
          // so this is mainly future-proofing).
          if (/^[a-z]+:\/\//i.test(pathText)) continue;
          // xterm's IBufferRange uses 1-based, inclusive cell positions on
          // the *current* buffer line. translateToString collapses double-
          // width cells, so column-from-string-index matches cell index for
          // the common case of ASCII compiler output. That's good enough
          // here — at worst the underline is slightly off for CJK runs.
          const startCol = m.index + 1;
          const endCol = m.index + matchText.length; // inclusive
          links.push({
            range: {
              start: { x: startCol, y: bufferLineNumber },
              end: { x: endCol, y: bufferLineNumber },
            },
            text: matchText,
            decorations: { underline: true, pointerCursor: true },
            activate: () => {
              void (async () => {
                const root = cwdRef.current;
                const isWindowsAbs = /^[A-Za-z]:[\\/]/.test(pathText);
                const isPosixAbs = pathText.startsWith("/");
                const abs =
                  isWindowsAbs || isPosixAbs
                    ? pathText
                    : root
                      ? // joinPath duplicated here to avoid widening this
                        // file's import surface; mirrors src/pathUtils.ts.
                        root.replace(/[\\/]+$/, "") +
                        "/" +
                        pathText.replace(/^[\\/]+/, "")
                      : null;
                if (!abs) return;
                // Find the workspace this terminal belongs to by matching
                // its cwd against loaded workspace roots. `cwd` is set by
                // WorkspaceShell to `ws.meta.root`, so the lookup is
                // unambiguous.
                const state = useStore.getState();
                const norm = (p: string) =>
                  p.replace(/\\/g, "/").replace(/\/+$/, "");
                const wsId = Object.keys(state.loaded).find(
                  (id) => norm(state.loaded[id]!.meta.root) === norm(root),
                );
                if (!wsId) return;
                try {
                  await state.openFile(wsId, abs);
                  setEditorGoto(lineNum, colNum);
                } catch {
                  // openFile already toasts / logs on read failure.
                }
              })();
            },
          });
        }
        callback(links.length > 0 ? links : undefined);
      },
    });

    // Second provider: clickable http(s) URLs → system browser. The
    // opener plugin permission is already granted app-wide; only the
    // path:line provider existed before, so dev-server addresses and
    // registry links printed by tools were dead text.
    const urlLinkDisposable: IDisposable = term.registerLinkProvider({
      provideLinks(bufferLineNumber, callback) {
        const line = term.buffer.active.getLine(bufferLineNumber - 1);
        const text = line?.translateToString(true) ?? "";
        if (!text) {
          callback(undefined);
          return;
        }
        const links: ILink[] = [];
        URL_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = URL_RE.exec(text)) !== null) {
          // Trailing punctuation is almost never part of the URL
          // ("see https://example.com." in prose).
          const url = m[0].replace(/[.,;:!?]+$/, "");
          if (!url) continue;
          links.push({
            range: {
              start: { x: m.index + 1, y: bufferLineNumber },
              end: { x: m.index + url.length, y: bufferLineNumber },
            },
            text: url,
            decorations: { underline: true, pointerCursor: true },
            activate: () => {
              void openUrl(url).catch(() => {});
            },
          });
        }
        callback(links.length > 0 ? links : undefined);
      },
    });

    let unlistenOut: (() => void) | undefined;
    let unlistenExit: (() => void) | undefined;
    let cancelled = false;
    let ourId: string | null = null;
    const earlyOut: Array<{ sid: string; data: string }> = [];
    let earlyExit = false;

    void (async () => {
      try {
        unlistenOut = await pty.onOutput((sid, data) => {
          if (ourId === null) {
            earlyOut.push({ sid, data });
          } else if (sid === ourId) {
            term.write(data);
          }
        });
        unlistenExit = await pty.onExit((sid) => {
          if (ourId === null) {
            if (sid) earlyExit = true;
          } else if (sid === ourId) {
            term.writeln("\r\n[process exited]");
          }
        });
        let id: string;
        let attached = false;
        if (ptyId) {
          try {
            attached = await pty.sessionExists(ptyId);
          } catch {
            attached = false;
          }
          if (cancelled) return;
        }
        if (ptyId && attached) {
          id = ptyId;
          // Replay the rolling scrollback the backend kept for us so the
          // terminal looks like it never went away.
          const replayT0 = performance.now();
          let replayChars = 0;
          try {
            const buf = await pty.getBuffer(ptyId);
            if (cancelled) return;
            if (buf) {
              replayChars = buf.length;
              term.write(buf);
            }
          } catch {
            /* ignore */
          }
          ourId = id;
          ptyIdRef.current = id;
          // Anything that may have arrived on the live stream during the
          // scrollback fetch is almost certainly already inside scrollback;
          // discard it instead of writing duplicates.
          earlyOut.length = 0;
          earlyExit = false;
          term.writeln(
            "\r\n\x1b[2m[reattached to running shell]\x1b[22m",
          );
          logAgentModePhase("terminal attached", {
            termId,
            reattached: true,
            replayMs: Math.round(performance.now() - replayT0),
            replayChars,
          });
        } else {
          id = await pty.spawn({
            cwd,
            cols: term.cols || 80,
            rows: term.rows || 24,
            shell: shellPath,
            args: shellArgs,
            title,
          });
          if (cancelled) {
            void pty.kill(id);
            return;
          }
          onPtyIdChange?.(id);
          ourId = id;
          ptyIdRef.current = id;
          for (const ev of earlyOut) {
            if (ev.sid === id) term.write(ev.data);
          }
          earlyOut.length = 0;
          if (earlyExit) term.writeln("\r\n[process exited]");
          logAgentModePhase("terminal attached", {
            termId,
            reattached: false,
          });
        }

        term.onData((data) => {
          if (ptyIdRef.current) void pty.write(ptyIdRef.current, data);
          // User typed something — they're clearly still using this
          // terminal, so reset the idle-close clock.
          touchSelf();
        });
        term.onResize(({ cols, rows }) => {
          if (ptyIdRef.current) void pty.resize(ptyIdRef.current, cols, rows);
        });
      } catch (e) {
        try {
          term.writeln(`\r\n[failed to start shell: ${String(e)}]`);
        } catch {
          /* ignore */
        }
      }
    })();

    return () => {
      cancelled = true;
      unlistenOut?.();
      unlistenExit?.();
      unregisterTerm();
      try {
        linkDisposable.dispose();
        urlLinkDisposable.dispose();
      } catch {
        /* ignore */
      }
      // Intentionally NOT killing the PTY here. The store's closeTerminal
      // and closeWorkspace explicitly kill PTYs they own; everything else
      // (hot reload, page reload, terminal-tab unmount during workspace
      // switch) leaves the PTY alive so the user can re-attach to it.
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
      ptyIdRef.current = null;
    };
  }, []);

  // Apply font-size changes live. Refit after — a bigger glyph means
  // fewer cols/rows fit, and without the refit the bottom rows clip
  // until the next resize. Skip the fit while hidden (display:none host
  // reports 0×0 and would collapse the grid to 1×1).
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    try {
      term.options.fontSize = fontSize;
      if (hostNodeRef.current && hostNodeRef.current.offsetWidth > 0) {
        fitRef.current?.fit();
      }
    } catch {
      /* ignore */
    }
  }, [fontSize]);

  // Whenever the host node mounts (or remounts in a new portal target),
  // bind xterm to it and refit.
  const setHostRef = useCallback((node: HTMLDivElement | null) => {
    hostNodeRef.current = node;
    if (!node) return;
    const term = termRef.current;
    if (!term) return;
    try {
      term.open(node);
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() => {
      try {
        if (node.offsetWidth > 0) fitRef.current?.fit();
      } catch {
        /* ignore */
      }
      try {
        term.focus();
      } catch {
        /* ignore */
      }
    });
  }, []);

  // Bridge the Ctrl+F keydown (raised inside xterm's custom key handler) to
  // React state so the overlay opens. The CustomEvent carries any selection
  // text to pre-fill the input with.
  useEffect(() => {
    const node = hostNodeRef.current;
    if (!node) return;
    const handler = (ev: Event) => {
      const sel = (ev as CustomEvent<{ selection: string }>).detail?.selection ?? "";
      setFindQuery(sel);
      setFindOpen(true);
    };
    node.addEventListener("codetta:term-find-open", handler);
    return () => node.removeEventListener("codetta:term-find-open", handler);
  }, [container]);

  // Track size changes on the current host.
  useEffect(() => {
    const node = hostNodeRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => {
      if (node.offsetWidth > 0 && node.offsetHeight > 0) {
        try {
          fitRef.current?.fit();
        } catch {
          /* ignore */
        }
      }
    });
    ro.observe(node);
    return () => ro.disconnect();
  }, [container]);

  // Refit + focus on visibility transitions.
  useEffect(() => {
    if (!visible) return;
    const node = hostNodeRef.current;
    if (!node) return;
    requestAnimationFrame(() => {
      try {
        if (node.offsetWidth > 0) fitRef.current?.fit();
      } catch {
        /* ignore */
      }
      try {
        if (!findOpen) termRef.current?.focus();
      } catch {
        /* ignore */
      }
    });
  }, [visible, container, findOpen]);

  // ------------------------------------------------------------------------
  // Find: scan the active buffer (scrollback + viewport) for the query.
  // We deliberately recompute matches on every keystroke or option toggle.
  // The active buffer caps at `scrollback` (5000) lines, which is fine for
  // a per-keystroke linear scan.
  // ------------------------------------------------------------------------
  const recomputeMatches = useCallback(
    (query: string, caseSensitive: boolean): Match[] => {
      const term = termRef.current;
      if (!term || !query) return [];
      const buf = term.buffer.active;
      const totalLines = buf.length;
      const needle = caseSensitive ? query : query.toLowerCase();
      const out: Match[] = [];
      for (let row = 0; row < totalLines; row++) {
        const line = buf.getLine(row);
        if (!line) continue;
        const text = line.translateToString(true);
        const hay = caseSensitive ? text : text.toLowerCase();
        let from = 0;
        while (from <= hay.length - needle.length) {
          const idx = hay.indexOf(needle, from);
          if (idx === -1) break;
          out.push({ row, col: idx, length: needle.length });
          from = idx + Math.max(needle.length, 1);
        }
      }
      return out;
    },
    [],
  );

  // Re-scan whenever the query, options, or open-state change.
  useEffect(() => {
    if (!findOpen) {
      setMatches([]);
      setMatchIndex(0);
      try {
        termRef.current?.clearSelection();
      } catch {
        /* ignore */
      }
      return;
    }
    const next = recomputeMatches(findQuery, findCaseSensitive);
    setMatches(next);
    setMatchIndex(0);
  }, [findOpen, findQuery, findCaseSensitive, recomputeMatches]);

  // Highlight the current match (if any) by selecting it in xterm. xterm's
  // `select(col, row, length)` uses absolute buffer rows, which is what
  // recomputeMatches stores. We also scroll it into view.
  useEffect(() => {
    const term = termRef.current;
    if (!term) return;
    if (!findOpen || matches.length === 0) {
      try {
        term.clearSelection();
      } catch {
        /* ignore */
      }
      return;
    }
    const m = matches[Math.min(matchIndex, matches.length - 1)];
    if (!m) return;
    try {
      term.select(m.col, m.row, m.length);
      term.scrollToLine(Math.max(0, m.row - Math.floor(term.rows / 2)));
    } catch {
      /* ignore */
    }
  }, [findOpen, matches, matchIndex]);

  const closeFind = useCallback(() => {
    setFindOpen(false);
    setMatches([]);
    setMatchIndex(0);
    try {
      termRef.current?.clearSelection();
    } catch {
      /* ignore */
    }
    // Hand focus back to the terminal so typing resumes immediately.
    requestAnimationFrame(() => {
      try {
        termRef.current?.focus();
      } catch {
        /* ignore */
      }
    });
  }, []);

  const findNext = useCallback(() => {
    if (matches.length === 0) return;
    setMatchIndex((i) => (i + 1) % matches.length);
  }, [matches.length]);

  const findPrev = useCallback(() => {
    if (matches.length === 0) return;
    setMatchIndex((i) => (i - 1 + matches.length) % matches.length);
  }, [matches.length]);

  // Autofocus + select-all when the overlay opens.
  useEffect(() => {
    if (!findOpen) return;
    requestAnimationFrame(() => {
      try {
        const inp = findInputRef.current;
        if (inp) {
          inp.focus();
          inp.select();
        }
      } catch {
        /* ignore */
      }
    });
  }, [findOpen]);

  const onFindKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      closeFind();
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      if (e.shiftKey) findPrev();
      else findNext();
      return;
    }
  };

  if (!container) return null;

  return createPortal(
    <>
      <div
        ref={setHostRef}
        className="term-host"
        style={{ display: visible ? "block" : "none" }}
        onMouseDown={() => {
          // Don't steal focus from the find input when it's open and the
          // user is interacting with it — but a click on the terminal
          // surface itself should still focus xterm.
          try {
            if (!findOpen) termRef.current?.focus();
          } catch {
            /* ignore */
          }
          // Mouse-down inside the terminal area = the user is engaging
          // with it (selecting text, focusing to type). Reset the idle
          // clock so the auto-close-idle-terminals sweeper holds off.
          touchSelf();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setCtxMenu({ x: e.clientX, y: e.clientY });
        }}
      />
      {ctxMenu && (
        <ContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          items={[
            {
              label: "Copy",
              disabled: !termRef.current?.hasSelection(),
              onClick: () => {
                const sel = termRef.current?.getSelection();
                if (sel) void navigator.clipboard.writeText(sel);
              },
            },
            {
              label: "Paste",
              onClick: () => {
                void navigator.clipboard.readText().then((t) => {
                  // term.paste(), not pty.write(): xterm wraps the text
                  // in bracketed-paste escapes and converts \n → \r, so
                  // multi-line pastes don't execute line-by-line.
                  if (t) termRef.current?.paste(t);
                });
              },
            },
            "separator",
            {
              label: "Select All",
              onClick: () => termRef.current?.selectAll(),
            },
            {
              label: "Clear",
              onClick: () => termRef.current?.clear(),
            },
            "separator",
            {
              label: "Find…",
              onClick: () => {
                hostNodeRef.current?.dispatchEvent(
                  new CustomEvent("codetta:term-find-open", {
                    detail: { selection: termRef.current?.getSelection() ?? "" },
                  }),
                );
              },
            },
          ]}
          onClose={() => setCtxMenu(null)}
        />
      )}
      {visible && findOpen && (
        <div
          className="term-find-overlay"
          // Stop the parent's onMouseDown from yanking focus back to xterm
          // while the user is clicking around inside the overlay.
          onMouseDown={(e) => e.stopPropagation()}
        >
          <input
            ref={findInputRef}
            className="term-find-input"
            type="text"
            placeholder="Find in terminal"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            onKeyDown={onFindKeyDown}
            spellCheck={false}
            autoComplete="off"
          />
          <span className="term-find-count">
            {findQuery
              ? matches.length === 0
                ? "0 matches"
                : `${matchIndex + 1} / ${matches.length}`
              : ""}
          </span>
          <button
            className={
              "term-find-btn term-find-toggle" +
              (findCaseSensitive ? " active" : "")
            }
            type="button"
            title="Match case (Aa)"
            aria-pressed={findCaseSensitive}
            onClick={() => setFindCaseSensitive((v) => !v)}
          >
            Aa
          </button>
          <button
            className="term-find-btn"
            type="button"
            title="Previous match (Shift+Enter)"
            onClick={findPrev}
            disabled={matches.length === 0}
          >
            {"↑"}
          </button>
          <button
            className="term-find-btn"
            type="button"
            title="Next match (Enter)"
            onClick={findNext}
            disabled={matches.length === 0}
          >
            {"↓"}
          </button>
          <button
            className="term-find-btn term-find-close"
            type="button"
            title="Close (Esc)"
            onClick={closeFind}
          >
            {"✕"}
          </button>
        </div>
      )}
    </>,
    container,
  );
}
