import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useStore } from "./store";
import { startFsBusOnce } from "./fsBus";
import { commands, confirmDiscardUnsaved, runCommand } from "./actions";
import {
  accelMatches,
  isModifierOnly,
  normalizeAccel,
  parseChordAccel,
} from "./accelMatch";
import { IS_MACOS, bootstrapTheme } from "./theme";
import { installNativeMenu, refreshNativeMenuBinding } from "./nativeMenu";
import { onPaletteOpen } from "./paletteBus";
import { onFootprintOpen } from "./footprintBus";
import { basename } from "./pathUtils";
import { tryRouteDropToChat } from "./imageAttach";
import { WorkspacePicker } from "./components/WorkspacePicker";
import { WorkspaceShell } from "./components/WorkspaceShell";
import { AgentModeShell } from "./components/AgentModeShell";
import { TopBar } from "./components/TopBar";
import { ActivityBar } from "./components/ActivityBar";
import { AIChatsRail } from "./components/AIChatsRail";
import { AgentHubWatcher } from "./components/AgentHubWatcher";
import { DockWindow } from "./components/DockWindow";
import { openDock, isDockEnabled } from "./dock";
import {
  emitDockSummary,
  DOCK_REQUEST_EVENT,
  DOCK_FOCUS_EVENT,
} from "./dockSummary";
import { getAgentStatus, markSeen } from "./agentStatusStore";
import { CommandPalette } from "./components/CommandPalette";
import { DragGhost } from "./components/DragGhost";
import { StatusBar } from "./components/StatusBar";
import { Toasts } from "./components/Toast";
import { DiffModal } from "./components/DiffModal";
import { ToolResultDrawer } from "./components/ToolResultDrawer";
import { Splash } from "./components/Splash";
import { RecentFilesOverlay } from "./components/RecentFilesOverlay";
import { getRecentFiles } from "./recentFiles";
import { useEditorState } from "./editorState";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { Dialog } from "./components/Dialog";
import { SettingsModal } from "./components/SettingsModal";
import { WelcomeModal } from "./components/WelcomeModal";
import { TaskManagerModal } from "./components/TaskManagerModal";
import { FootprintModal } from "./components/FootprintModal";
import { TerminalPopoutWindow } from "./components/TerminalPopoutWindow";
import { ShortcutReferenceModal } from "./components/ShortcutReferenceModal";
import { onShortcutsOpen } from "./shortcutsBus";
import { ToastHistoryModal } from "./components/ToastHistoryModal";
import { onNotificationsOpen } from "./notifyBus";
import { useZenMode } from "./zenMode";
import { useAgentMode } from "./agentMode";
import { installResumeDebug } from "./resumeDebug";
import { prefetchModelDiscovery } from "./modelDiscoveryStore";
import { teardownBeforeQuit, quitArmed } from "./appQuit";
import "./App.css";

// When this document was opened as a terminal pop-out window, render only
// the popout shell (no workspace, no toolbars, no store hydration).
const IS_POPOUT = (() => {
  try {
    return new URLSearchParams(window.location.search).get("popout") === "1";
  } catch {
    return false;
  }
})();

const IS_DOCK = (() => {
  try {
    return new URLSearchParams(window.location.search).get("dock") === "1";
  } catch {
    return false;
  }
})();

// Command ids whose accelerators are dispatched by the bespoke `if/else`
// chain in `onKey` below. Anything in this set is INTENTIONALLY skipped by
// the generic accel-fallthrough loop further down, because the manual
// branch does something the generic dispatcher can't (palette toggle,
// recent-files cycling, dirty-buffer guards inline, etc). New accels that
// just want "press this, run that command" should NOT be added here —
// that's the whole point of the fallthrough.
// True when the keystroke belongs to a terminal or a plain text input.
// Chords must NOT arm there: Ctrl+K is kill-to-end-of-line in a shell,
// and an armed chord silently swallows the next keystroke (or fires
// file.save_no_format). Monaco is deliberately exempt-from-the-exemption
// — app chords should keep working while coding.
function isChordExemptTarget(e: KeyboardEvent): boolean {
  const t = e.target as HTMLElement | null;
  if (!t || typeof t.closest !== "function") return false;
  if (t.closest(".xterm") || t.closest(".xterm-helper-textarea")) return true;
  if (t.closest(".monaco-editor")) return false;
  const tag = t.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return t.isContentEditable === true;
}

const HANDLED_BY_MANUAL_BRANCHES = new Set<string>([
  "file.save",
  "file.save_all",
  "file.open_folder",
  "file.close_workspace",
  "view.toggle_sidebar",
  "view.toggle_panel",
  "view.files",
  "view.source_control",
  "view.search",
  "view.search_palette",
  "view.todos",
  "view.goto_symbol",
  "edit.goto_symbol",
  "view.reload",
  "edit.goto_line",
  "view.zoom_in",
  "view.zoom_out",
  "view.zoom_reset",
  "edit.format_document",
  "view.settings",
  "edit.reopen_closed_tab",
  "terminal.toggle",
  // view.quick_open (Ctrl+P) is handled inline by the palette toggle
  // branch — leave it manual so the toggle behaviour survives.
  "view.quick_open",
  // F11 zen toggle is dispatched at the top of onKey before the Ctrl
  // gate, so it's also a manual branch.
  "view.toggle_zen",
  // Alt+Z word wrap has its own handler (`onAltKey`).
  "edit.toggle_word_wrap",
]);

// Two-step "chord" shortcut state, e.g. Ctrl+K Ctrl+0. The leading combo
// arms `chordPending`; the follow-up combo within CHORD_TIMEOUT_MS commits
// the action. Module-scope (not React state) because the keydown handler
// already runs from a stable effect listener and we want zero re-render
// churn when the chord is in flight. A stuck chord auto-clears so it can't
// silently swallow later normal keystrokes.
let chordPending: { leading: string; armedAt: number } | null = null;
const CHORD_TIMEOUT_MS = 2000;

function MainApp() {
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);
  const openIds = useStore((s) => s.openIds);
  const activeId = useStore((s) => s.activeId);
  const loaded = useStore((s) => s.loaded);
  // WorkspaceShells are a stacked overlay (only the active one is shown via
  // `display`), so their DOM order is irrelevant to what's visible. But Monaco
  // editors crash ("InstantiationService has been disposed") if React MOVES
  // their DOM node — which is exactly what reordering `openIds` (drag-to-
  // reorder) would do. So mount the shells in a STABLE order: append newly
  // opened ids, drop closed ones, never reorder. Only the ActivityBar icons
  // reflect the user's chosen order.
  const shellOrderRef = useRef<string[]>([]);
  const shellOrder = useMemo(() => {
    const kept = shellOrderRef.current.filter((id) => openIds.includes(id));
    const added = openIds.filter((id) => !kept.includes(id));
    const next = [...kept, ...added];
    shellOrderRef.current = next;
    return next;
  }, [openIds]);
  const zen = useZenMode();
  const agentMode = useAgentMode();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => onShortcutsOpen(() => setShortcutsOpen(true)), []);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  useEffect(
    () => onNotificationsOpen(() => setNotificationsOpen(true)),
    [],
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteInitial, setPaletteInitial] = useState("");
  // Mirror paletteOpen into a ref so the keyboard-shortcut effect below
  // can read its current value without listing it as a dependency.
  // Without the ref, every palette open/close would tear down + re-add
  // four global keydown listeners.
  const paletteOpenRef = useRef(paletteOpen);
  useEffect(() => {
    paletteOpenRef.current = paletteOpen;
  }, [paletteOpen]);
  const [footprintOpen, setFootprintOpen] = useState(false);
  const [recentOverlayOpen, setRecentOverlayOpen] = useState(false);
  const [recentSelected, setRecentSelected] = useState(0);
  const [recentList, setRecentList] = useState<string[]>([]);
  // Min-display latch for the splash. Without this, fast hydrations
  // (warm OS cache, no workspaces to restore) flash the brand for a
  // few frames or skip it entirely. We hold the splash visible until
  // 700 ms after first paint regardless of hydration state.
  const [splashMinElapsed, setSplashMinElapsed] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setSplashMinElapsed(true), 700);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    bootstrapTheme();
    startFsBusOnce();
    // macOS: move the menubar into the native system menu bar (no-op on
    // Win/Linux, which keep the in-window TopBar menus).
    void installNativeMenu();
    prefetchModelDiscovery();
    void hydrate();
  }, [hydrate]);

  // Install the resume-debug listeners once at mount. Editor and terminal
  // panes register themselves into the registry when they mount, so by the
  // time the user resumes from macOS sleep the registry already knows
  // about every Monaco/xterm instance worth healing. Idempotent — safe to
  // call again in StrictMode.
  useEffect(() => installResumeDebug(), []);

  // Guard the OS close button / Alt+F4 / taskbar-close against unsaved
  // edits. The custom titlebar × had its own confirm, but every other
  // close path silently discarded all dirty buffers — the single
  // highest-stakes hole in the app. The titlebar × now routes through
  // window.close() so this is the one confirm for every path.
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let closing = false;
    void getCurrentWindow()
      .onCloseRequested(async (event) => {
        if (closing || quitArmed()) return;
        const ok = await confirmDiscardUnsaved("Close");
        if (!ok) {
          event.preventDefault();
          return;
        }
        closing = true;
        await teardownBeforeQuit();
      })
      .then((u) => {
        unlisten = u;
      })
      .catch(() => {});
    return () => unlisten?.();
  }, []);

  // macOS: re-bind the native app menu when main regains focus. Tauri 2
  // drops custom menu-item callbacks after another webview (Dock, popout)
  // took focus — predefined items still work but Quit/commands go silent.
  useEffect(() => {
    if (!IS_MACOS) return;
    let unlisten: (() => void) | undefined;
    void getCurrentWindow()
      .onFocusChanged(({ payload: focused }) => {
        if (focused) void refreshNativeMenuBinding();
      })
      .then((u) => {
        unlisten = u;
      })
      .catch(() => {});
    return () => unlisten?.();
  }, []);

  // Reflect active workspace + file in the OS window title. Depend only
  // on the active workspace's NAME (not the whole `loaded` map) so the
  // setTitle IPC doesn't fire on every unrelated buffer/layout mutation.
  const editorState = useEditorState();
  const activeWsName = activeId ? loaded[activeId]?.meta.name ?? null : null;
  useEffect(() => {
    const file = editorState.filePath;
    let title = "Quack";
    if (activeWsName && file) {
      title = `${basename(file)} — ${activeWsName} — Quack`;
    } else if (activeWsName) {
      title = `${activeWsName} — Quack`;
    }
    getCurrentWindow()
      .setTitle(title)
      .catch(() => {});
  }, [activeWsName, editorState.filePath]);

  useEffect(() => {
    return onPaletteOpen((initial) => {
      setPaletteInitial(initial);
      setPaletteOpen(true);
    });
  }, []);

  useEffect(() => {
    return onFootprintOpen(() => setFootprintOpen(true));
  }, []);

  // Native OS drag-and-drop into the window. Tauri intercepts HTML
  // drop events on the webview by default, so we listen via the
  // window API instead. Each dropped path opens as a tab (files only —
  // directories drop to nothing for now; the file tree handles those).
  // We light up a CSS class on the body so the rest of the chrome can
  // dim during a drag, giving the user a clear "drop here works" cue.
  const [dropOver, setDropOver] = useState(false);
  useEffect(() => {
    let off: (() => void) | undefined;
    void getCurrentWindow()
      .onDragDropEvent(async (event) => {
        const t = event.payload.type;
        if (t === "enter" || t === "over") {
          setDropOver(true);
        } else if (t === "leave") {
          setDropOver(false);
        } else if (t === "drop") {
          setDropOver(false);
          const wsId = useStore.getState().activeId;
          if (!wsId) return;
          const paths = (event.payload as { paths: string[] }).paths ?? [];
          // Images dropped over the AI chat attach to the composer instead
          // of opening as editor tabs. The chat panel registers its rect +
          // handler; this no-ops (falls through to open-as-tab) when the
          // drop lands elsewhere or carries no images.
          const pos = (event.payload as { position?: { x: number; y: number } })
            .position;
          if (tryRouteDropToChat(paths, pos)) return;
          for (const p of paths) {
            // openFile handles "already open" (activates the tab) and
            // unreadable paths (logs + bails) — caller-side filtering
            // for directories would race with stat IPC. Let openFile
            // do its thing.
            try {
              await useStore.getState().openFile(wsId, p);
            } catch {
              /* ignore individual failures so the rest of a multi-drop
                 still lands */
            }
          }
        }
      })
      .then((unlisten) => {
        off = unlisten;
      });
    return () => {
      off?.();
    };
  }, []);

  // Pop-out windows announce a redock request via this event (from the
  // popout's Re-dock button OR its own onCloseRequested handler). Main is
  // authoritative: it closes the popout window (popout's self-close is
  // unreliable in some Tauri 2 situations), then flips the popped flag.
  // The window's `tauri://destroyed` listener (registered in popOutTerminal)
  // is the safety net if the close itself races or fails.
  useEffect(() => {
    let off: (() => void) | undefined;
    void listen<{ wsId: string; termId: string }>(
      "popout:redock",
      async (e) => {
        const { wsId, termId } = e.payload;
        const ws = useStore.getState().loaded[wsId];
        if (!ws || !ws.terminals[termId]) return;
        // Force-close the popout from main so we don't depend on the
        // popout's own close() succeeding.
        try {
          const { WebviewWindow } = await import(
            "@tauri-apps/api/webviewWindow"
          );
          const w = await WebviewWindow.getByLabel(`popout-${termId}`);
          if (w) await w.close();
        } catch (err) {
          console.warn("popout close failed", err);
        }
        useStore.getState().setTerminalPopped(wsId, termId, false);
      },
    ).then((u) => {
      off = u;
    });
    return () => {
      off?.();
    };
  }, []);

  // Floating Dock bridge. The Dock is a separate window that renders a
  // per-project status summary; the main window is the producer. Auto-open
  // it on boot (unless the user closed it), answer its initial pull
  // (dock:request → push summary), and handle clicks (dock:focus-project →
  // jump to that project's most urgent chat).
  useEffect(() => {
    if (!hydrated) return;
    if (isDockEnabled()) {
      void openDock().then(() => refreshNativeMenuBinding());
    }
    const offs: Array<() => void> = [];
    void listen(DOCK_REQUEST_EVENT, () => emitDockSummary()).then((u) =>
      offs.push(u),
    );
    void listen<string>(DOCK_FOCUS_EVENT, async (e) => {
      const wsId = e.payload;
      const st = useStore.getState();
      if (!st.loaded[wsId]) return;
      if (st.activeId !== wsId) await st.setActiveWorkspace(wsId);
      const ws = useStore.getState().loaded[wsId];
      if (!ws) return;
      // Most urgent first: needs-input → ready → most-recent.
      const chats = Object.values(ws.aiChats).filter((c) => !c.archivedAt);
      const pick =
        chats.find((c) => getAgentStatus(c.id)?.derived === "needs-input") ??
        chats.find((c) => getAgentStatus(c.id)?.derived === "ready") ??
        chats.sort((a, b) => b.createdAt - a.createdAt)[0];
      if (pick) {
        markSeen(pick.id);
        useStore.getState().focusAIChat(wsId, pick.id);
      }
    }).then((u) => offs.push(u));
    return () => offs.forEach((f) => f());
  }, [hydrated]);

  // After a Ctrl+R reload, popout windows from the previous session may
  // still be alive. Mark their terminals as popped so the main window
  // doesn't double-mount the xterm against the same PTY.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void (async () => {
      try {
        const { WebviewWindow } = await import(
          "@tauri-apps/api/webviewWindow"
        );
        const all = await WebviewWindow.getAll();
        if (cancelled) return;
        const poppedTermIds = new Set<string>();
        for (const w of all) {
          const m = w.label.match(/^popout-(.+)$/);
          if (m) poppedTermIds.add(m[1]);
        }
        if (poppedTermIds.size === 0) return;
        const state = useStore.getState();
        for (const wsId of state.openIds) {
          const ws = state.loaded[wsId];
          if (!ws) continue;
          for (const termId of Object.keys(ws.terminals)) {
            if (poppedTermIds.has(termId)) {
              state.setTerminalPopped(wsId, termId, true);
            }
          }
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  // Start a fs watcher per open workspace. We deliberately depend only on
  // the SHAPE of the open list (ids + their roots), not the full `loaded`
  // map — otherwise every buffer edit / layout tweak re-invokes the watch
  // command for every open ws. The Rust side deduplicates so it's
  // idempotent, but cheap is better than free IPC roundtrips.
  // Sorted so drag-to-reorder (which permutes openIds) doesn't change the key
  // and needlessly re-run the watch effect — only the SET of ids+roots matters.
  const watchKey = openIds
    .map((id) => `${id}:${loaded[id]?.meta.root ?? ""}`)
    .sort()
    .join("|");
  useEffect(() => {
    for (const id of openIds) {
      const meta = loaded[id]?.meta;
      if (!meta) continue;
      void invoke("fs_watch_start", {
        wsId: id,
        root: meta.root,
      }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchKey]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // ---- Chord pre-check ----
      // Chords (e.g. Ctrl+K Ctrl+0) take a two-step path: a leading
      // combo arms `chordPending`, then the follow-up combo commits.
      // Modifier-only keydowns (Ctrl, Shift, Alt, Meta on their own)
      // are skipped at this layer — otherwise just *holding* Ctrl
      // before pressing K would clear/arm the state spuriously.
      if (!isModifierOnly(e) && !isChordExemptTarget(e)) {
        // Expire a stale pending chord before doing anything else, so
        // a 5-minutes-later keystroke isn't reinterpreted as the second
        // half of a forgotten chord.
        if (
          chordPending !== null &&
          Date.now() - chordPending.armedAt > CHORD_TIMEOUT_MS
        ) {
          chordPending = null;
        }

        if (chordPending !== null) {
          // Second half of a chord. Look for a command whose accel
          // parses as a chord with a matching leading combo and whose
          // follow-up matches this event.
          const leading = chordPending.leading;
          let matched = false;
          for (const c of commands) {
            if (!c.accel) continue;
            const chord = parseChordAccel(c.accel);
            if (!chord) continue;
            if (normalizeAccel(chord.leading) !== leading) continue;
            if (accelMatches(chord.followup, e)) {
              e.preventDefault();
              runCommand(c.id);
              matched = true;
              break;
            }
          }
          // Whether or not we matched, the chord is consumed: a
          // mis-typed second key cancels the chord and falls through
          // to normal handling on the *next* keystroke (this one is
          // dropped if matched, or treated as normal if not).
          chordPending = null;
          if (matched) return;
          // Fall through: treat this keystroke as a regular shortcut.
        } else {
          // No chord pending — see if this event arms one. We walk
          // every command with a chord accel; if any leading combo
          // matches, set pending and swallow the event.
          for (const c of commands) {
            if (!c.accel) continue;
            const chord = parseChordAccel(c.accel);
            if (!chord) continue;
            if (accelMatches(chord.leading, e)) {
              chordPending = {
                leading: normalizeAccel(chord.leading),
                armedAt: Date.now(),
              };
              e.preventDefault();
              return;
            }
          }
        }
      }

      // F11 toggles zen mode globally — no modifiers required so it
      // matches the platform convention and works even when no
      // workspace is open.
      if (e.key === "F11" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        runCommand("view.toggle_zen");
        return;
      }
      // F1 opens the keyboard-shortcut reference. Conventional Help
      // key; we own it because there's no native browser/OS Help
      // dialog worth deferring to in a Tauri app.
      if (e.key === "F1" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        runCommand("help.shortcuts");
        return;
      }
      const ctrl = e.ctrlKey || e.metaKey;
      if (!ctrl) return;
      const k = e.key;
      // Command palette. Ctrl+P = quick-open (files); Ctrl+Shift+P =
      // command mode (the "> " prefix) per universal muscle memory —
      // they used to be identical, which made Ctrl+Shift+P feel broken
      // to anyone arriving from VS Code/Sublime.
      if ((k === "p" || k === "P") && !e.altKey) {
        e.preventDefault();
        if (paletteOpenRef.current) {
          setPaletteOpen(false);
        } else {
          setPaletteInitial(e.shiftKey ? "> " : "");
          setPaletteOpen(true);
        }
        return;
      }
      // Map shortcuts to commands. The whole chain is gated on !Alt —
      // these branches describe plain Ctrl(+Shift) combos, and matching
      // them while Alt was held meant Ctrl+Alt+T / Ctrl+Alt+P style
      // registry accels fired the WRONG command instead of falling
      // through to the generic dispatcher below.
      const lower = k.toLowerCase();
      if (e.altKey) {
        if (lower === "f" && !e.shiftKey) {
          e.preventDefault();
          runCommand("view.search_palette");
        }
      } else if (lower === "s" && !e.shiftKey) {
        e.preventDefault();
        runCommand("file.save");
      } else if (lower === "s" && e.shiftKey) {
        e.preventDefault();
        runCommand("file.save_all");
      } else if (lower === "o" && !e.shiftKey) {
        e.preventDefault();
        runCommand("file.open_folder");
      } else if (lower === "o" && e.shiftKey) {
        e.preventDefault();
        runCommand("edit.goto_symbol");
      } else if (lower === "w" && e.shiftKey) {
        e.preventDefault();
        runCommand("file.close_workspace");
      } else if (lower === "b" && !e.shiftKey) {
        e.preventDefault();
        runCommand("view.toggle_sidebar");
      } else if (lower === "j" && !e.shiftKey) {
        e.preventDefault();
        runCommand("view.toggle_panel");
      } else if (lower === "e" && e.shiftKey) {
        e.preventDefault();
        runCommand("view.files");
      } else if (lower === "g" && e.shiftKey) {
        e.preventDefault();
        runCommand("view.source_control");
      } else if (lower === "f" && e.shiftKey) {
        e.preventDefault();
        runCommand("view.search");
      } else if (lower === "t" && e.shiftKey) {
        e.preventDefault();
        runCommand("edit.reopen_closed_tab");
      } else if (lower === "t" && !e.shiftKey) {
        e.preventDefault();
        runCommand("view.goto_symbol");
      } else if (lower === "r" && !e.shiftKey) {
        e.preventDefault();
        runCommand("view.reload");
      } else if (k === "`") {
        e.preventDefault();
        runCommand("terminal.toggle");
      } else if (lower === "g" && !e.shiftKey) {
        e.preventDefault();
        runCommand("edit.goto_line");
      } else if ((k === "=" || k === "+") && !e.shiftKey) {
        e.preventDefault();
        runCommand("view.zoom_in");
      } else if (k === "-") {
        e.preventDefault();
        runCommand("view.zoom_out");
      } else if (k === "0") {
        e.preventDefault();
        runCommand("view.zoom_reset");
      } else if (lower === "i" && e.shiftKey) {
        e.preventDefault();
        runCommand("edit.format_document");
      } else if (k === ",") {
        e.preventDefault();
        runCommand("view.settings");
      }

      // Generic accelerator fallthrough.
      //
      // Every command above is handled with bespoke logic (palette toggle,
      // recent-files cycling, etc) — those branches stay. But for any NEW
      // command that just wants "press this accel, run my command" we
      // dispatch by walking the registry. That way adding `accel: "Ctrl+M"`
      // to a command in actions.ts is enough; no second edit here.
      //
      // We skip ids that are already handled explicitly above so the
      // dedicated branches keep ownership of their accel (e.g. file.save
      // also runs format-on-save inline; we don't want to double-fire).
      const handledAbove = HANDLED_BY_MANUAL_BRANCHES;
      for (const c of commands) {
        if (!c.accel) continue;
        if (handledAbove.has(c.id)) continue;
        // Keys the shell/input owns (Ctrl+W = delete-word in readline)
        // must reach it, not close the user's tab.
        if (c.skipWhenTyping && isChordExemptTarget(e)) continue;
        if (accelMatches(c.accel, e)) {
          e.preventDefault();
          runCommand(c.id);
          return;
        }
      }
    }
    // Alt+Z: word wrap toggle (no Ctrl).
    function onAltKey(e: KeyboardEvent) {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        runCommand("edit.toggle_word_wrap");
      }
    }

    // Ctrl+Tab / Ctrl+Shift+Tab: recent-files cycling overlay.
    // The overlay opens on first press, advances on subsequent presses while
    // Ctrl is held, and commits on Ctrl release.
    function onTabKey(e: KeyboardEvent) {
      if (e.key !== "Tab" || !(e.ctrlKey || e.metaKey)) return;
      const wsId = useStore.getState().activeId;
      if (!wsId) return;
      const list = getRecentFiles(wsId);
      if (list.length < 2) return;
      e.preventDefault();
      setRecentList(list);
      const len = list.length;
      setRecentOverlayOpen((wasOpen) => {
        setRecentSelected((cur) => {
          if (!wasOpen) {
            return e.shiftKey ? len - 1 : 1;
          }
          const delta = e.shiftKey ? -1 : 1;
          return ((cur + delta) % len + len) % len;
        });
        return true;
      });
    }
    function onCtrlUp(e: KeyboardEvent) {
      if (e.key === "Control" || e.key === "Meta") {
        // Use functional update to read latest state without subscribing.
        setRecentOverlayOpen((open) => {
          if (!open) return false;
          // Activate the selected file.
          setRecentSelected((idx) => {
            setRecentList((list) => {
              const wsId = useStore.getState().activeId;
              const path = list[idx];
              if (wsId && path) {
                void useStore.getState().openFile(wsId, path);
              }
              return list;
            });
            return idx;
          });
          return false;
        });
      }
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setRecentOverlayOpen((open) => (open ? false : open));
      }
    }

    window.addEventListener("keydown", onAltKey);
    window.addEventListener("keydown", onTabKey);
    window.addEventListener("keyup", onCtrlUp);
    window.addEventListener("keydown", onEsc);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onAltKey);
      window.removeEventListener("keydown", onTabKey);
      window.removeEventListener("keyup", onCtrlUp);
      window.removeEventListener("keydown", onEsc);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  // Min-display gate so the splash brand doesn't flash for 30 ms
  // when hydration is fast. Holds the splash until BOTH conditions
  // are met: hydrated AND we've been mounted for ~700 ms.
  if (!hydrated || !splashMinElapsed) {
    return <Splash />;
  }

  return (
    <div className={`app ${zen ? "app-zen" : ""} ${agentMode ? "app-agent" : ""} ${dropOver ? "app-drop-over" : ""}`}>
      {!zen && <TopBar onOpenPalette={() => setPaletteOpen(true)} />}
      <div
        className="shell-stack"
        data-sidebar-side={
          activeId ? (loaded[activeId]?.layout.sidebarSide ?? "left") : "left"
        }
      >
        {!zen && !agentMode && <ActivityBar />}
        <div className="workspace-area">
          {openIds.length === 0 ? (
            <WorkspacePicker />
          ) : agentMode && activeId ? (
            // Agent mode fully replaces the editor-centric shell (rather
            // than overlaying it) so a given AI chat is never mounted
            // twice — a double-mounted AIChatPanel would double-subscribe
            // to the same session's stream events. Terminals tear down and
            // replay backend scrollback on return, same as Zen / reload.
            //
            // NOT keyed by activeId: the shell stays mounted across
            // workspace switches so its per-workspace session selection
            // survives clicking between workspaces in the sessions list.
            <AgentModeShell wsId={activeId} />
          ) : (
            shellOrder.map((id) => (
              <WorkspaceShell
                key={id}
                wsId={id}
                isActive={id === activeId}
              />
            ))
          )}
        </div>
        {/* Cross-project Agent Hub — editor layout only; agent mode
            embeds the hub in AgentModeShell's left sidebar. */}
        {!zen && !agentMode && openIds.length > 0 && <AIChatsRail />}
      </div>
      {zen && (
        // Tiny escape hatch for users who hit F11 by accident or
        // forget the shortcut — clicking exits zen, hovering reveals
        // the keystroke. Idle-fade keeps it from being a permanent
        // distraction in the corner.
        <button
          className="zen-exit"
          onClick={() => runCommand("view.toggle_zen")}
          title="Exit Zen Mode (F11)"
          aria-label="Exit Zen Mode"
        >
          F11
        </button>
      )}
      {!zen && <StatusBar onOpenPalette={() => setPaletteOpen(true)} />}
      <CommandPalette
        open={paletteOpen}
        initialQuery={paletteInitial}
        onClose={() => setPaletteOpen(false)}
      />
      <DragGhost />
      <Toasts />
      <AgentHubWatcher />
      <DiffModal />
      <ToolResultDrawer />
      <Dialog />
      <SettingsModal />
      <WelcomeModal />
      <TaskManagerModal />
      <ShortcutReferenceModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
      <ToastHistoryModal
        open={notificationsOpen}
        onClose={() => setNotificationsOpen(false)}
      />
      <FootprintModal
        open={footprintOpen}
        onClose={() => setFootprintOpen(false)}
      />
      {/* ClaudePermissionOverlay now mounts inline inside AIChatPanel
          so the request appears in the chat next to the agent text
          that triggered it, not as a full-screen modal. */}
      <RecentFilesOverlay
        open={recentOverlayOpen}
        files={recentList}
        selectedIndex={recentSelected}
        workspaceRoot={
          activeId ? loaded[activeId]?.meta.root : undefined
        }
        onSelect={(i) => setRecentSelected(i)}
      />
    </div>
  );
}

export default function App() {
  if (IS_DOCK) return <DockWindow />;
  return IS_POPOUT ? <TerminalPopoutWindow /> : <MainApp />;
}
