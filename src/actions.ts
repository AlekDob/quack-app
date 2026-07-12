import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { openUrl, revealItemInDir } from "@tauri-apps/plugin-opener";

// Injected by vite from package.json — same hook the Splash uses.
declare const __APP_VERSION__: string;
import { findPaneById, parseKey, useStore } from "./store";
import { addNewAIChat, defaultNewChatAnchor } from "./addNewAIChat";
import { openPalette } from "./paletteBus";
import { openSettings } from "./settingsBus";
import { openTaskManager } from "./taskManagerBus";
import { openShortcuts } from "./shortcutsBus";
import { openNotifications } from "./notifyBus";
import { openFootprint } from "./footprintBus";
import { requestAIPrompt } from "./aiBus";
import { getActiveEditor, requestDiff } from "./editorState";
import {
  alert as dialogAlert,
  choice as dialogChoice,
  confirm as dialogConfirm,
  prompt as dialogPrompt,
} from "./dialog";
import { addTemplate, getTemplates } from "./aiTemplates";
import { fs, git as gitApi, pty } from "./ipc";
import {
  error as toastError,
  errMsg,
  info as toastInfo,
  success as toastSuccess,
} from "./notify";
import {
  cycleAutoClosingBrackets,
  getEditorSettings,
  toggleAutoSave,
  toggleFormatOnSave,
  toggleInsertFinalNewline,
  toggleMinimap,
  toggleTrimTrailingWhitespace,
  toggleWordWrap,
  zoomIn,
  zoomOut,
  zoomReset,
} from "./editorSettings";
import { joinPath } from "./pathUtils";
import { QUACK_DISCORD, QUACK_HOME } from "./quackLinks";
import { revealInTree } from "./revealInTree";
import { toggleZenMode } from "./zenMode";
import { toggleAgentMode } from "./agentMode";
import { toggleDock } from "./dock";
import {
  invalidateClaudeAuthCache,
  scheduleClaudeAuthRecheck,
} from "./claudeAuthStatus";
import { beginClaudeLoginWatch } from "./claudeLoginTerminal";

function runEditorAction(actionId: string) {
  const ed = getActiveEditor();
  if (!ed) return;
  const a = ed.getAction(actionId);
  if (a) void a.run();
}

const s = () => useStore.getState();

/** The tabs pane that currently owns keyboard focus (activePaneId),
 *  searched in both the editor area and the bottom panel. */
function activeTabsPane() {
  const wsId = s().activeId;
  if (!wsId) return null;
  const ws = s().loaded[wsId];
  const id = ws?.layout.activePaneId;
  if (!ws || !id) return null;
  const pane =
    findPaneById(ws.layout.editorRoot, id) ??
    (ws.layout.bottomRoot ? findPaneById(ws.layout.bottomRoot, id) : null);
  return pane && pane.kind === "tabs" ? { wsId, pane } : null;
}

function cycleActiveTab(dir: 1 | -1) {
  const at = activeTabsPane();
  if (!at || at.pane.tabs.length < 2) return;
  const len = at.pane.tabs.length;
  const cur = at.pane.active ? at.pane.tabs.indexOf(at.pane.active) : 0;
  const next = at.pane.tabs[(cur + dir + len) % len];
  s().setActiveTab(at.wsId, at.pane.id, next);
}

/**
 * Scan every loaded workspace for files with unsaved buffer edits and,
 * if any exist, surface a danger-style confirm naming a sample of them.
 * Returns true if it's safe to proceed (no dirty files OR user confirmed),
 * false if the user backed out. Used by Reload Window, the title-bar
 * close button, and any future action that would silently discard work.
 *
 * `verb` is the present-tense action shown to the user — "Reload",
 * "Close", etc.
 */
export async function confirmDiscardUnsaved(verb: string): Promise<boolean> {
  const dirty: { wsId: string; path: string }[] = [];
  const dirtyNames: string[] = [];
  for (const [wsId, ws] of Object.entries(s().loaded)) {
    for (const [path, f] of Object.entries(ws.files)) {
      if (f.contents !== f.original) {
        dirty.push({ wsId, path });
        const name = path.replace(/\\/g, "/").split("/").pop();
        if (dirtyNames.length < 5 && name) dirtyNames.push(name);
      }
    }
  }
  if (dirty.length === 0) return true;
  const sample = dirtyNames.join(", ");
  const more =
    dirty.length > dirtyNames.length
      ? `, +${dirty.length - dirtyNames.length} more`
      : "";
  const picked = await dialogChoice(
    `${dirty.length} file${dirty.length === 1 ? " has" : "s have"} unsaved changes: ${sample}${more}`,
    [
      { value: "save", label: `Save All & ${verb}`, kind: "primary" },
      { value: "discard", label: `${verb} Without Saving`, kind: "danger" },
      { value: "cancel", label: "Cancel" },
    ],
    { title: "Unsaved changes" },
  );
  if (picked === "cancel" || picked === null) return false;
  if (picked === "save") {
    const results = await Promise.all(
      dirty.map((d) => s().saveFile(d.wsId, d.path)),
    );
    // A failed save (locked / read-only file) must block the verb —
    // proceeding would discard exactly what the user asked to keep.
    return results.every((ok) => ok);
  }
  return true;
}

function activeFilePath(wsId: string | null): string | null {
  if (!wsId) return null;
  const ws = s().loaded[wsId];
  if (!ws) return null;
  const paneId = ws.layout.activePaneId;
  if (!paneId) return null;
  const pane =
    findPaneById(ws.layout.editorRoot, paneId) ??
    (ws.layout.bottomRoot ? findPaneById(ws.layout.bottomRoot, paneId) : null);
  if (!pane || pane.kind !== "tabs" || !pane.active) return null;
  const parsed = parseKey(pane.active);
  return parsed?.kind === "file" ? parsed.path : null;
}

export interface CommandSpec {
  id: string;
  label: string;
  category: "File" | "View" | "Terminal" | "AI" | "Help" | "Workspace" | "Edit";
  /** Short secondary line in the palette (right side, muted). */
  hint?: string;
  accel?: string;
  /** Don't dispatch this accel while the user is typing in a terminal
   *  or plain input — for keys shells/inputs own (Ctrl+W is
   *  delete-previous-word in every readline; Ctrl+PageUp/Down are tmux
   *  bindings). The command stays runnable from the palette/menu. */
  skipWhenTyping?: boolean;
  run: () => void | Promise<void>;
}

export const commands: CommandSpec[] = [
  {
    id: "file.open_folder",
    label: "Open Folder…",
    category: "File",
    accel: "Ctrl+O",
    run: async () => {
      const sel = await openDialog({ directory: true, multiple: false });
      if (typeof sel === "string") await s().openWorkspace(sel);
    },
  },
  {
    id: "file.close_workspace",
    label: "Close Workspace",
    category: "File",
    accel: "Ctrl+Shift+W",
    run: () => {
      const wsId = s().activeId;
      if (wsId) void s().closeWorkspace(wsId);
    },
  },
  {
    id: "workspace.open_recent",
    label: "Open Recent Workspace…",
    category: "Workspace",
    run: async () => {
      const recent = s().recent ?? [];
      if (recent.length === 0) {
        toastInfo("No recent workspaces yet — open a folder with Ctrl+O.");
        return;
      }
      const list = recent
        .slice(0, 20)
        .map((w, i) => `${i + 1}. ${w.name}  —  ${w.root}`)
        .join("\n");
      const choice = await dialogPrompt(
        `Pick a recent workspace (1-${Math.min(recent.length, 20)}):\n${list}`,
        "1",
        { title: "Open Recent", okLabel: "Open" },
      );
      const idx = parseInt(choice ?? "", 10) - 1;
      const target = recent[idx];
      if (!target) return;
      void s().openWorkspace(target.root);
    },
  },
  {
    id: "file.save",
    label: "Save",
    category: "File",
    accel: "Ctrl+S",
    run: async () => {
      const wsId = s().activeId;
      const path = activeFilePath(wsId);
      if (!wsId || !path) return;
      // Format-on-save: only fire when the user explicitly saved (this
      // path), not via auto-save. We also gate on the active editor
      // actually pointing at the file being saved — saving a buffer
      // from a non-focused tab would otherwise reformat the focused
      // tab instead, which is wrong.
      const settings = getEditorSettings();
      if (settings.formatOnSave) {
        const ed = getActiveEditor();
        const model = ed?.getModel();
        const edPath = model?.uri.fsPath ?? model?.uri.path ?? "";
        if (ed && edPath === path) {
          try {
            const action = ed.getAction("editor.action.formatDocument");
            if (action) await action.run();
          } catch {
            // No formatter for this language, or the formatter
            // threw — fall through and save what's in the buffer.
          }
        }
      }
      void s().saveFile(wsId, path);
    },
  },
  // Escape hatch for when Format on Save is enabled but the user knows
  // the formatter would mangle hand-tuned alignment or break a partial
  // edit (e.g. mid-refactor, intentionally non-canonical whitespace).
  // Skips formatDocument and writes the buffer as-is.
  //
  // The "Ctrl+K S" accel mirrors VS Code's chord for the same action.
  // Codetta's dispatcher doesn't handle chord shortcuts yet, but
  // declaring it lets the keyboard-shortcut reference modal display the
  // hint, and a future chord-aware dispatcher will pick it up.
  {
    id: "file.save_no_format",
    label: "Save Without Formatting",
    category: "File",
    accel: "Ctrl+K S",
    run: () => {
      const wsId = s().activeId;
      const path = activeFilePath(wsId);
      if (!wsId || !path) return;
      void s().saveFile(wsId, path);
    },
  },
  {
    id: "file.save_all",
    label: "Save All",
    category: "File",
    accel: "Ctrl+Shift+S",
    run: () => {
      const wsId = s().activeId;
      if (wsId) void s().saveAllFiles(wsId);
    },
  },
  {
    id: "file.revert",
    label: "Revert File (Reload from Disk)",
    category: "File",
    run: async () => {
      const wsId = s().activeId;
      const path = activeFilePath(wsId);
      if (!wsId || !path) return;
      const ws = s().loaded[wsId];
      const f = ws?.files[path];
      if (!ws || !f) return;
      // Confirm if there are unsaved changes — reverting silently
      // discarding work would be a footgun.
      if (f.contents !== f.original) {
        const ok = await dialogConfirm(
          `Revert ${path.split(/[\\/]/).pop()}?\n\nThis discards your unsaved buffer changes and reloads the file from disk.`,
          {
            title: "Revert file",
            okLabel: "Revert",
            cancelLabel: "Cancel",
            danger: true,
          },
        );
        if (!ok) return;
      }
      let onDisk: string;
      try {
        onDisk = await fs.readFile(path);
      } catch (e) {
        toastError(`Couldn't read ${path}: ${errMsg(e)}`);
        return;
      }
      // Atomically replace BOTH `contents` and `original` so the
      // dirty-tracker resets cleanly. Mirror the helper EditorPane
      // already uses for its own reload path.
      useStore.setState((st) => {
        const w = st.loaded[wsId];
        if (!w || !w.files[path]) return st;
        return {
          loaded: {
            ...st.loaded,
            [wsId]: {
              ...w,
              files: {
                ...w.files,
                [path]: {
                  ...w.files[path],
                  contents: onDisk,
                  original: onDisk,
                },
              },
            },
          },
        };
      });
      toastSuccess("File reverted from disk");
    },
  },
  {
    id: "file.quit",
    label: "Quit",
    category: "File",
    accel: "Ctrl+Q",
    run: async () => {
      if (!(await confirmDiscardUnsaved("Quit"))) return;
      const { teardownBeforeQuit, closeMainWindow } = await import("./appQuit");
      await teardownBeforeQuit();
      await closeMainWindow();
    },
  },
  {
    id: "view.toggle_sidebar",
    label: "Toggle Sidebar",
    category: "View",
    accel: "Ctrl+B",
    run: () => {
      const wsId = s().activeId;
      const ws = wsId ? s().loaded[wsId] : null;
      if (ws && wsId) s().setSidebarVisible(wsId, !ws.layout.sidebarVisible);
    },
  },
  {
    id: "view.toggle_panel",
    label: "Toggle Panel",
    category: "View",
    accel: "Ctrl+J",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) return;
      const ws = s().loaded[wsId];
      if (!ws) return;
      if (ws.layout.bottomVisible && ws.layout.bottomRoot) {
        s().setBottomVisible(wsId, false);
      } else {
        s().setBottomVisible(wsId, true);
        if (!ws.layout.bottomRoot) s().addTerminal(wsId, "bottom");
      }
    },
  },
  {
    id: "view.toggle_zen",
    label: "Toggle Zen Mode",
    category: "View",
    accel: "F11",
    run: () => {
      toggleZenMode();
    },
  },
  {
    id: "view.toggle_agent",
    label: "Toggle Agent Mode",
    category: "View",
    accel: "Ctrl+Shift+A",
    run: () => {
      toggleAgentMode();
    },
  },
  {
    id: "view.toggle_dock",
    label: "Toggle Project Dock",
    category: "View",
    accel: "Ctrl+Shift+D",
    run: () => {
      void toggleDock();
    },
  },
  {
    id: "view.files",
    label: "Show Explorer",
    category: "View",
    accel: "Ctrl+Shift+E",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) return;
      s().setSidebarVisible(wsId, true);
      s().setSidebarView(wsId, "files");
    },
  },
  {
    id: "view.source_control",
    label: "Show Source Control",
    category: "View",
    accel: "Ctrl+Shift+G",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) return;
      s().setSidebarVisible(wsId, true);
      s().setSidebarView(wsId, "git");
    },
  },
  {
    id: "view.quack_store",
    label: "Quack Store",
    category: "View",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) return;
      s().storeOpen(wsId);
    },
  },
  {
    id: "view.search",
    label: "Search Files…",
    category: "View",
    accel: "Ctrl+Shift+F",
    run: () => {
      // Open the sidebar Search panel section (creating it if missing,
      // un-collapsing if collapsed) and focus its input. Falls back to
      // the command-palette text-search when there's no active
      // workspace — the panel needs a root to search against.
      const st = useStore.getState();
      const wsId = st.activeId;
      if (!wsId) {
        openPalette("? ");
        return;
      }
      const ws = st.loaded[wsId];
      if (!ws) {
        openPalette("? ");
        return;
      }
      const existing = ws.layout.sidebarSections.find(
        (s) => s.view === "search",
      );
      if (!existing) {
        st.toggleSidebarSection(wsId, "search"); // adds it, uncollapsed
      } else if (existing.collapsed) {
        st.collapseSidebarSection(wsId, "search", false);
      }
      // Make sure the sidebar itself is visible — it auto-hides when
      // every section is removed, and the user may have toggled it
      // off via Ctrl+B.
      if (!ws.layout.sidebarVisible) st.setSidebarVisible(wsId, true);
      // Focus the input on the next frame so the section has mounted.
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLInputElement>(
          ".search-panel-input",
        );
        el?.focus();
        el?.select();
      });
    },
  },
  {
    id: "view.search_palette",
    label: "Quick Search (palette)…",
    category: "View",
    accel: "Ctrl+Alt+F",
    run: () => openPalette("? "),
  },
  {
    id: "view.goto_symbol",
    label: "Go to Symbol…",
    category: "View",
    accel: "Ctrl+T",
    run: () => openPalette("@"),
  },
  {
    id: "view.quick_open",
    label: "Quick Open File…",
    category: "View",
    accel: "Ctrl+P",
    run: () => openPalette(""),
  },
  {
    id: "view.tasks",
    label: "Show Tasks (npm scripts)",
    category: "View",
    accel: "Ctrl+Alt+P",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) return;
      s().setSidebarVisible(wsId, true);
      s().setSidebarView(wsId, "tasks");
    },
  },
  {
    id: "view.ai",
    label: "Show AI Chat",
    category: "View",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) return;
      s().setSidebarVisible(wsId, true);
      s().setSidebarView(wsId, "ai");
    },
  },
  {
    id: "view.todos",
    label: "Show TODO / FIXME",
    category: "View",
    accel: "Ctrl+Alt+T",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) return;
      s().setSidebarVisible(wsId, true);
      s().setSidebarView(wsId, "todos");
    },
  },
  {
    id: "edit.reopen_closed_tab",
    label: "Reopen Closed Tab",
    category: "Edit",
    accel: "Ctrl+Shift+T",
    run: async () => {
      const wsId = s().activeId;
      if (!wsId) return;
      const reopened = await s().reopenClosedTab(wsId);
      if (!reopened) {
        toastInfo("No recently closed tabs to reopen");
      }
    },
  },
  {
    id: "edit.format_document",
    label: "Format Document",
    category: "Edit",
    accel: "Ctrl+Shift+I",
    run: () => runEditorAction("editor.action.formatDocument"),
  },
  {
    id: "file.reveal_in_explorer",
    label:
      // Match the platform's actual file-manager wording so users
      // searching the palette for "Finder" or "Explorer" find it.
      navigator.userAgent.includes("Mac")
        ? "Reveal Active File in Finder"
        : "Reveal Active File in File Explorer",
    category: "File",
    run: async () => {
      const ed = getActiveEditor();
      const model = ed?.getModel();
      if (!ed || !model) {
        toastError("Open a file first");
        return;
      }
      const fsPath = model.uri.fsPath ?? model.uri.path;
      try {
        await revealItemInDir(fsPath);
      } catch (e) {
        toastError(`Couldn't reveal: ${errMsg(e)}`);
      }
    },
  },
  {
    id: "edit.compare_with_clipboard",
    label: "Compare Active File with Clipboard",
    category: "Edit",
    run: async () => {
      const ed = getActiveEditor();
      const model = ed?.getModel();
      if (!ed || !model) {
        toastError("Open a file first");
        return;
      }
      let clip = "";
      try {
        clip = await navigator.clipboard.readText();
      } catch (e) {
        toastError(`Couldn't read clipboard: ${errMsg(e)}`);
        return;
      }
      const fsPath = model.uri.fsPath ?? model.uri.path;
      const filename = fsPath.split(/[\\/]/).pop() || fsPath;
      requestDiff({
        path: filename,
        refspec: "clipboard",
        // Convention from SourceControlPanel: original = the side
        // we're "comparing against," modified = the editor buffer.
        // Putting the clipboard on the original side lets the user
        // read the diff as "what would change if I pasted this in."
        originalContent: clip,
        modifiedContent: model.getValue(),
        language: model.getLanguageId() || "plaintext",
      });
    },
  },
  {
    id: "edit.compare_with_file",
    label: "Compare Active File with…",
    category: "Edit",
    run: async () => {
      const ed = getActiveEditor();
      const model = ed?.getModel();
      if (!ed || !model) {
        toastError("Open a file first");
        return;
      }
      let picked: string | string[] | null = null;
      try {
        picked = await openDialog({
          multiple: false,
          directory: false,
          title: "Pick a file to compare with",
        });
      } catch (e) {
        toastError(`Couldn't open file picker: ${errMsg(e)}`);
        return;
      }
      if (!picked || Array.isArray(picked)) return;
      let other: string;
      try {
        other = await fs.readFile(picked);
      } catch (e) {
        toastError(`Couldn't read ${picked}: ${errMsg(e)}`);
        return;
      }
      const fsPath = model.uri.fsPath ?? model.uri.path;
      const filename = fsPath.split(/[\\/]/).pop() || fsPath;
      requestDiff({
        path: filename,
        refspec: picked,
        originalContent: other,
        modifiedContent: model.getValue(),
        language: model.getLanguageId() || "plaintext",
      });
    },
  },
  {
    id: "edit.goto_line",
    label: "Go to Line…",
    category: "Edit",
    accel: "Ctrl+G",
    run: () => runEditorAction("editor.action.gotoLine"),
  },
  {
    id: "edit.find_in_file",
    label: "Find in File",
    category: "Edit",
    accel: "Ctrl+F",
    run: () => runEditorAction("actions.find"),
  },
  {
    id: "edit.replace_in_file",
    label: "Replace in File",
    category: "Edit",
    accel: "Ctrl+H",
    run: () => runEditorAction("editor.action.startFindReplaceAction"),
  },
  {
    id: "edit.toggle_word_wrap",
    label: "Toggle Word Wrap",
    category: "View",
    accel: "Alt+Z",
    run: () => toggleWordWrap(),
  },
  {
    id: "edit.toggle_auto_save",
    label: "Toggle Auto-Save",
    category: "File",
    run: () => toggleAutoSave(),
  },
  {
    id: "view.toggle_minimap",
    label: "Toggle Minimap",
    category: "View",
    accel: "Ctrl+Alt+M",
    run: () => toggleMinimap(),
  },
  {
    id: "view.close_tab",
    label: "Close Tab",
    category: "View",
    accel: "Ctrl+W",
    skipWhenTyping: true,
    run: () => {
      const at = activeTabsPane();
      if (!at?.pane.active) return;
      void s().closeTab(at.wsId, at.pane.active);
    },
  },
  {
    id: "view.next_tab",
    label: "Next Tab",
    category: "View",
    accel: "Ctrl+PageDown",
    skipWhenTyping: true,
    run: () => cycleActiveTab(1),
  },
  {
    id: "view.prev_tab",
    label: "Previous Tab",
    category: "View",
    accel: "Ctrl+PageUp",
    skipWhenTyping: true,
    run: () => cycleActiveTab(-1),
  },
  {
    id: "view.settings",
    label: "Open Settings…",
    category: "View",
    accel: "Ctrl+,",
    run: () => openSettings(),
  },
  {
    id: "view.settings_ai_providers",
    label: "Settings: AI Providers (API Keys)",
    category: "View",
    run: () => openSettings("ai-providers"),
  },
  {
    id: "view.settings_ai_privacy",
    label: "Settings: AI Privacy Exclusions",
    category: "View",
    run: () => openSettings("ai-privacy"),
  },
  {
    id: "edit.toggle_trim_trailing_ws",
    label: "Toggle: Trim Trailing Whitespace on Save",
    category: "File",
    run: () => toggleTrimTrailingWhitespace(),
  },
  {
    id: "edit.toggle_insert_final_newline",
    label: "Toggle: Insert Final Newline on Save",
    category: "File",
    run: () => toggleInsertFinalNewline(),
  },
  {
    id: "edit.toggle_format_on_save",
    label: "Toggle: Format on Save",
    category: "File",
    run: () => toggleFormatOnSave(),
  },
  {
    id: "edit.cycle_auto_closing",
    label: "Cycle Auto-Closing Brackets",
    category: "File",
    run: () => cycleAutoClosingBrackets(),
  },
  {
    id: "edit.goto_symbol",
    label: "Go to Symbol…",
    category: "Edit",
    accel: "Ctrl+Shift+O",
    run: () => runEditorAction("editor.action.quickOutline"),
  },
  {
    id: "edit.fold_all",
    label: "Fold All",
    category: "Edit",
    accel: "Ctrl+K Ctrl+0",
    run: () => runEditorAction("editor.foldAll"),
  },
  {
    id: "edit.unfold_all",
    label: "Unfold All",
    category: "Edit",
    accel: "Ctrl+K Ctrl+J",
    run: () => runEditorAction("editor.unfoldAll"),
  },
  {
    id: "edit.fold",
    label: "Fold",
    category: "Edit",
    run: () => runEditorAction("editor.fold"),
  },
  {
    id: "edit.unfold",
    label: "Unfold",
    category: "Edit",
    run: () => runEditorAction("editor.unfold"),
  },
  {
    id: "view.zoom_in",
    label: "Zoom In",
    category: "View",
    accel: "Ctrl+=",
    run: () => zoomIn(),
  },
  {
    id: "view.zoom_out",
    label: "Zoom Out",
    category: "View",
    accel: "Ctrl+-",
    run: () => zoomOut(),
  },
  {
    id: "view.zoom_reset",
    label: "Reset Zoom",
    category: "View",
    accel: "Ctrl+0",
    run: () => zoomReset(),
  },
  {
    id: "view.reveal_in_tree",
    label: "Reveal Active File in Explorer",
    category: "View",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) return;
      const ws = s().loaded[wsId];
      const k = ws?.layout.activePaneId
        ? findPaneById(ws.layout.editorRoot, ws.layout.activePaneId)
        : null;
      const active = k && k.kind === "tabs" ? k.active : null;
      if (!active) return;
      const parsed = parseKey(active);
      if (parsed?.kind !== "file") return;
      revealInTree(wsId, parsed.path);
    },
  },
  {
    id: "view.task_manager",
    label: "Task Manager",
    category: "View",
    // Ctrl+Shift+Esc belongs to Windows; Ctrl+Alt+M is the minimap.
    accel: "Ctrl+Alt+U",
    run: () => {
      openTaskManager();
    },
  },
  {
    id: "view.reload",
    label: "Reload Window",
    category: "View",
    accel: "Ctrl+R",
    run: async () => {
      // Ctrl+R is the browser-refresh muscle memory; a stray hit shouldn't
      // silently throw away unsaved work. Chat history is already
      // refresh-safe (sessions are persisted + resumeable).
      if (!(await confirmDiscardUnsaved("Reload"))) return;
      window.location.reload();
    },
  },
  {
    id: "terminal.toggle",
    label: "Toggle Terminal Panel",
    category: "Terminal",
    // Ctrl+` matches the universal convention: show/hide the terminal
    // panel. It used to spawn a brand-new PTY on every press, so
    // muscle-memory users accumulated a pile of shells.
    accel: "Ctrl+`",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) return;
      const ws = s().loaded[wsId];
      if (!ws) return;
      if (ws.layout.bottomVisible && ws.layout.bottomRoot) {
        s().setBottomVisible(wsId, false);
      } else {
        s().setBottomVisible(wsId, true);
        if (!ws.layout.bottomRoot) s().addTerminal(wsId, "bottom");
      }
    },
  },
  {
    id: "terminal.new_bottom",
    label: "New Terminal",
    category: "Terminal",
    run: () => {
      const wsId = s().activeId;
      if (wsId) s().addTerminal(wsId, "bottom");
    },
  },
  {
    id: "terminal.new_editor",
    label: "New Terminal in Editor Area",
    category: "Terminal",
    accel: "Ctrl+Shift+`",
    run: () => {
      const wsId = s().activeId;
      if (wsId) s().addTerminal(wsId, "editor");
    },
  },
  {
    id: "terminal.claude_code",
    label: "Open Claude Code Terminal",
    category: "Terminal",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) {
        toastError("Open a workspace first");
        return;
      }
      // Launch the claude CLI directly in the workspace root — the
      // one-keystroke path into a terminal AI session. Windows needs a
      // cmd host (claude is claude.cmd from npm and PATHEXT doesn't
      // apply to raw spawns); POSIX drops back to the login shell when
      // claude exits so the tab stays usable.
      const isWin = navigator.userAgent.includes("Windows");
      const shell = isWin
        ? { path: "cmd.exe", args: ["/k", "claude"], label: "Claude Code" }
        : {
            path: "/bin/sh",
            args: ["-lc", 'claude; exec "${SHELL:-/bin/sh}"'],
            label: "Claude Code",
          };
      s().addTerminal(wsId, "bottom", shell);
    },
  },
  {
    id: "terminal.claude_login",
    label: "Sign in to Claude Code",
    category: "Terminal",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) {
        toastError("Open a workspace first");
        return;
      }
      const isWin = navigator.userAgent.includes("Windows");
      const shell = isWin
        ? { path: "cmd.exe", args: ["/k", "claude"], label: "Claude Code" }
        : {
            path: "/bin/sh",
            args: ["-lc", 'claude; exec "${SHELL:-/bin/sh}"'],
            label: "Claude Code",
          };
      // Taller bottom panel so the interactive /login menu is readable.
      const LOGIN_TERM_H = 440;
      s().setBottomVisible(wsId, true);
      const curH = s().loaded[wsId]?.layout.termH ?? 240;
      s().setTermH(wsId, Math.max(curH, LOGIN_TERM_H));
      const termId = s().addTerminal(wsId, "bottom", shell);
      void beginClaudeLoginWatch(wsId, termId);
      toastInfo(
        "Follow the browser prompt in the terminal, then return here.",
      );
      invalidateClaudeAuthCache();
      scheduleClaudeAuthRecheck();
      setTimeout(() => {
        const ws = s().loaded[wsId];
        const t = ws?.terminals[termId];
        if (!t?.ptyId) return;
        void pty.write(t.ptyId, "/login\r");
      }, 1200);
    },
  },
  {
    id: "ai.new_chat",
    label: "New AI Chat",
    category: "AI",
    accel: "Ctrl+Alt+N",
    run: () => {
      const wsId = s().activeId;
      if (wsId) addNewAIChat(wsId, "editor", defaultNewChatAnchor());
    },
  },
  {
    id: "ai.review_file",
    label: "Ask AI to Review This File",
    category: "AI",
    run: () => {
      const wsId = s().activeId;
      const path = activeFilePath(wsId);
      if (!wsId || !path) {
        toastError("Open a file first");
        return;
      }
      const ws = s().loaded[wsId];
      const file = ws?.files[path];
      if (!file) {
        toastError("Open a file first");
        return;
      }
      const filename = path.split(/[\\/]/).pop() || path;
      const ed = getActiveEditor();
      const lang = ed?.getModel()?.getLanguageId() || "";
      const text = `Review this entire file. Call out bugs, edge cases, naming issues, and architectural smells. Be specific — quote the lines you're commenting on.\n\n\`\`\`${lang} ${filename}\n${file.contents}\n\`\`\``;
      // Mirror EditorPane's askAI.* pattern: make sure the chat panel
      // is mounted before dispatching, otherwise the bus event lands
      // before any subscriber and only the 1.5s replay buffer saves us.
      const store = useStore.getState();
      if (!store.loaded[wsId]?.layout?.aiPanelVisible) {
        store.setAIPanelVisible(wsId, true);
      }
      requestAnimationFrame(() => {
        requestAIPrompt({ wsId, text, send: true });
      });
    },
  },
  {
    id: "ai.summarize_file",
    label: "Ask AI to Summarize This File",
    category: "AI",
    run: () => {
      const wsId = s().activeId;
      const path = activeFilePath(wsId);
      if (!wsId || !path) {
        toastError("Open a file first");
        return;
      }
      const ws = s().loaded[wsId];
      const file = ws?.files[path];
      if (!file) {
        toastError("Open a file first");
        return;
      }
      const filename = path.split(/[\\/]/).pop() || path;
      const ed = getActiveEditor();
      const lang = ed?.getModel()?.getLanguageId() || "";
      const text = `Give a concise summary of what this file does. Lead with the one-sentence purpose, then list the key exports / functions.\n\n\`\`\`${lang} ${filename}\n${file.contents}\n\`\`\``;
      const store = useStore.getState();
      if (!store.loaded[wsId]?.layout?.aiPanelVisible) {
        store.setAIPanelVisible(wsId, true);
      }
      requestAnimationFrame(() => {
        requestAIPrompt({ wsId, text, send: true });
      });
    },
  },
  {
    id: "ai.claude_md_open",
    label: "Claude Code: Open project CLAUDE.md",
    category: "AI",
    run: () => void openProjectClaudeMd(),
  },
  {
    id: "ai.claude_md_init",
    label: "Claude Code: Init project CLAUDE.md (with scaffold)",
    category: "AI",
    run: () => void initProjectClaudeMd(),
  },
  {
    id: "ai.claude_md_user_open",
    label: "Claude Code: Open user CLAUDE.md (~/.claude/CLAUDE.md)",
    category: "AI",
    run: () => void openUserClaudeMd(),
  },
  {
    id: "view.open_whiteboard",
    label: "Open Team",
    category: "View",
    hint: "Organize agents, presets, and skills per workspace",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) {
        toastError("Open a workspace first");
        return;
      }
      s().wbOpen(wsId);
    },
  },
  {
    id: "view.open_works",
    label: "Open Works",
    category: "View",
    hint: "Project work items — modules, kanban, tickets",
    run: () => {
      const wsId = s().activeId;
      if (!wsId) {
        toastError("Open a workspace first");
        return;
      }
      s().worksOpen(wsId);
    },
  },
  {
    id: "help.shortcuts",
    label: "Keyboard Shortcuts",
    category: "Help",
    accel: "F1",
    run: () => openShortcuts(),
  },
  {
    id: "ai.generate_commit_message",
    label: "Generate Commit Message from Staged Diff",
    category: "AI",
    run: async () => {
      const wsId = s().activeId;
      if (!wsId) return;
      const ws = s().loaded[wsId];
      if (!ws) return;
      let diff = "";
      try {
        diff = await gitApi.diffStaged(ws.meta.root);
      } catch (e) {
        toastError(`Couldn't read staged diff: ${errMsg(e)}`);
        return;
      }
      const trimmed = diff.trim();
      if (!trimmed) {
        toastInfo("No staged changes — git add some files first.");
        return;
      }
      // Cap the diff at 60 KB so a giant rebase doesn't blow up the
      // context window. The model gets a hint that more was elided
      // so it can reason about partiality.
      const MAX_BYTES = 60 * 1024;
      const elided = trimmed.length > MAX_BYTES;
      const sample = elided ? trimmed.slice(0, MAX_BYTES) : trimmed;
      const text = `Draft a Conventional Commits-style commit message for these staged changes. Use this format:

  <type>: <terse summary, ~60 chars max>

  <body bullets explaining WHY, not WHAT — the diff already shows the what>

Type vocabulary: feat, fix, refactor, docs, test, chore, style, perf, build, ci. Pick the one that matches the dominant change.

${elided ? "(Diff truncated to ~60 KB — full diff is larger.)\n\n" : ""}Staged diff:

\`\`\`diff
${sample}
\`\`\``;
      requestAIPrompt({ wsId, text, send: true });
    },
  },
  {
    id: "help.website",
    label: "Quack Website",
    category: "Help",
    run: async () => {
      try {
        await openUrl(QUACK_HOME);
      } catch {
        /* ignore */
      }
    },
  },
  {
    id: "help.discord",
    label: "Join Discord",
    category: "Help",
    run: async () => {
      try {
        await openUrl(QUACK_DISCORD);
      } catch {
        /* ignore */
      }
    },
  },
  {
    id: "help.about",
    label: "About Quack",
    category: "Help",
    run: () =>
      void dialogAlert(
        `Quack v${__APP_VERSION__} — a lightweight Tauri-based code editor with first-class AI.\n\nMulti-workspace · multi-terminal (with pop-out) · integrated git · drag-and-drop splits · BYOK AI (Anthropic, OpenAI, Ollama, Claude Code).\n\n${QUACK_HOME}`,
        { title: "About Quack" },
      ),
  },
  {
    id: "view.footprint",
    label: "Show Workspace Footprint",
    category: "View",
    run: () => openFootprint(),
  },
  {
    id: "view.notifications",
    label: "Show Notifications",
    category: "View",
    run: () => openNotifications(),
  },
  {
    id: "view.sort_tabs_alpha",
    label: "Sort Tabs Alphabetically",
    category: "View",
    run: () => {
      const wsId = s().activeId;
      if (wsId) s().sortActiveTabsAlphabetical(wsId);
    },
  },
  {
    id: "view.sort_tabs_recent",
    label: "Sort Tabs by Last Used",
    category: "View",
    run: () => {
      const wsId = s().activeId;
      if (wsId) s().sortActiveTabsByRecent(wsId);
    },
  },
  {
    id: "ai.run_template",
    label: "Run AI Template…",
    category: "AI",
    run: async () => {
      // Open a tiny custom prompt UI: re-use the existing dialogPrompt
      // pattern (src/dialog.ts) twice — first to PICK the template, then
      // to confirm/edit before sending.
      const tpls = getTemplates();
      if (tpls.length === 0) {
        toastInfo(
          "No AI templates yet. Use 'AI: Save AI Template…' to add one.",
        );
        return;
      }
      // Build a "1. Label\n2. Label\n…" picker via dialogPrompt and let
      // the user type a number. Cheap UI but no new component to ship.
      const list = tpls.map((t, i) => `${i + 1}. ${t.label}`).join("\n");
      const choice = await dialogPrompt(
        `Pick a template (1-${tpls.length}):\n${list}`,
        "1",
        { title: "AI Templates", okLabel: "Pick" },
      );
      const idx = parseInt(choice ?? "", 10) - 1;
      const t = tpls[idx];
      if (!t) return;
      const wsId = s().activeId;
      if (!wsId) return;
      requestAIPrompt({ wsId, text: t.prompt, send: false });
    },
  },
  {
    id: "ai.save_template",
    label: "Save AI Template…",
    category: "AI",
    run: async () => {
      const label = await dialogPrompt("Template name", "", {
        title: "Save AI Template",
        okLabel: "Save",
      });
      if (!label || !label.trim()) return;
      const prompt = await dialogPrompt(
        "Template body — the AI prompt that this template will send",
        "",
        { title: "Save AI Template", okLabel: "Save" },
      );
      if (!prompt || !prompt.trim()) return;
      addTemplate(label.trim(), prompt.trim());
      toastSuccess(`Saved template "${label.trim()}"`);
    },
  },
];

export function findCommand(id: string): CommandSpec | undefined {
  return commands.find((c) => c.id === id);
}

export function runCommand(id: string) {
  const c = findCommand(id);
  if (!c) return;
  void c.run();
}

export function commandsForCategory(
  cat: CommandSpec["category"],
): CommandSpec[] {
  return commands.filter((c) => c.category === cat);
}

// -----------------------------------------------------------------
// CLAUDE.md helpers
//
// CLAUDE.md is Claude Code's persistent per-project context file. The
// CLI auto-loads `<workspace>/CLAUDE.md` (and the user-level
// `~/.claude/CLAUDE.md`) into every prompt's system message. Most users
// don't know it exists — these palette commands surface it.
// -----------------------------------------------------------------


async function ensureClaudeMd(absPath: string, scaffold: string | null): Promise<void> {
  const exists = await fs.exists(absPath).catch(() => false);
  if (!exists) {
    if (scaffold !== null) {
      await fs.writeFile(absPath, scaffold);
    } else {
      // Empty stub so the file exists for the editor.
      await fs.writeFile(absPath, "");
    }
  }
}

async function projectClaudeMdPath(): Promise<string | null> {
  const wsId = s().activeId;
  if (!wsId) {
    toastError("Open a workspace first.");
    return null;
  }
  const ws = s().loaded[wsId];
  if (!ws) return null;
  return joinPath(ws.meta.root, "CLAUDE.md");
}

async function userClaudeMdPath(): Promise<string | null> {
  try {
    const { homeDir, join } = await import("@tauri-apps/api/path");
    const home = await homeDir();
    return await join(home, ".claude", "CLAUDE.md");
  } catch (e) {
    toastError(`Cannot resolve home directory: ${errMsg(e)}`);
    return null;
  }
}

async function openInActiveWorkspace(absPath: string): Promise<void> {
  const wsId = s().activeId;
  if (!wsId) return;
  await s().openFile(wsId, absPath);
}

async function openProjectClaudeMd(): Promise<void> {
  const path = await projectClaudeMdPath();
  if (!path) return;
  try {
    await ensureClaudeMd(path, null);
    await openInActiveWorkspace(path);
  } catch (e) {
    toastError(`Failed to open CLAUDE.md: ${errMsg(e)}`);
  }
}

async function initProjectClaudeMd(): Promise<void> {
  const path = await projectClaudeMdPath();
  if (!path) return;
  const exists = await fs.exists(path).catch(() => false);
  if (exists) {
    const ok = await dialogConfirm(
      "CLAUDE.md already exists in this workspace. Overwrite with the scaffold? (Tip: open it instead via the palette to edit in place.)",
      {
        title: "Overwrite CLAUDE.md?",
        okLabel: "Overwrite",
        cancelLabel: "Cancel",
        danger: true,
      },
    );
    if (!ok) {
      await openInActiveWorkspace(path);
      return;
    }
  }
  const wsId = s().activeId!;
  const ws = s().loaded[wsId];
  const scaffold = buildClaudeMdScaffold(ws?.meta.name ?? "this project");
  try {
    await fs.writeFile(path, scaffold);
    await openInActiveWorkspace(path);
    toastSuccess("CLAUDE.md scaffolded — edit and save to use it on the next Claude Code turn.");
  } catch (e) {
    toastError(`Failed to write CLAUDE.md: ${errMsg(e)}`);
  }
}

async function openUserClaudeMd(): Promise<void> {
  const path = await userClaudeMdPath();
  if (!path) return;
  try {
    // Make sure the ~/.claude directory exists. Best-effort — the user
    // probably already has it after running `claude /login`. We don't
    // create the file pre-emptively; the editor handles non-existent
    // paths by opening an empty buffer the user saves.
    await ensureClaudeMd(path, null);
    await openInActiveWorkspace(path);
  } catch (e) {
    toastError(`Failed to open ~/.claude/CLAUDE.md: ${errMsg(e)}`);
  }
}

function buildClaudeMdScaffold(projectName: string): string {
  return `# ${projectName} — project context for Claude Code

> This file is automatically included by the Claude Code CLI on every
> prompt. Keep it short and high-signal — anything in here costs tokens
> on every turn. Delete sections you don't need.

## What this project is

<one-paragraph elevator pitch — what does the codebase do, who uses it, what's the current state>

## How to run / build / test

<exact commands the agent should use, e.g.:>

\`\`\`
npm install
npm run dev          # local dev server
npm run build        # production build
npm test             # full test suite
\`\`\`

## Conventions

- <language version, formatter, linter — e.g. "TypeScript strict mode, Prettier defaults, ESLint with @typescript-eslint">
- <commit message style, branch naming>
- <test layout — where tests live, what runner>

## Architecture in 5 bullets

- <where do feature requests typically land — frontend? backend? a specific service?>
- <key state stores / data flow>
- <external services this app talks to>
- <build / deploy pipeline>
- <anything subtle that an outsider would get wrong>

## Things to avoid

- <foot-guns specific to this codebase, e.g. "don't import from src/legacy/*">
- <files that look editable but aren't, e.g. generated code>
- <tests that are flaky and not worth chasing>
`;
}
