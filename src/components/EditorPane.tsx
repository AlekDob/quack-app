import Editor, { type Monaco } from "@monaco-editor/react";
import { useEffect, useRef, useState } from "react";
import type { editor } from "monaco-editor";
import { useStore } from "../store";
import { useResolvedTheme } from "../theme";
import { MarkdownPreview } from "./MarkdownPreview";
import {
  setEditorState,
  clearEditorState,
  onEditorGoto,
  requestMdPreviewScroll,
  setActiveEditor,
  setMonacoInstance,
} from "../editorState";
import { useEditorSettings } from "../editorSettings";
import { fs, git as gitApi } from "../ipc";
import { fsBus, pathsEqual } from "../fsBus";
import { warning } from "../notify";
import { pushRecentFile } from "../recentFiles";
import { confirm as dialogConfirm } from "../dialog";
import { langOf } from "../langDetect";
import { dirname } from "../pathUtils";
import { EditorBreadcrumbs } from "./EditorBreadcrumbs";
import { EditorTabToolbar } from "./EditorTabToolbar";
import { DiffView } from "./DiffView";
import { requestAIPrompt } from "../aiBus";
import { registerResumeComponent } from "../resumeDebug";
import {
  loadViewState,
  saveViewState,
} from "../editorViewState";
import {
  toggleLineBookmark,
  getLineBookmarks,
  nextLineBookmark,
  prevLineBookmark,
  subscribeLineBookmarks,
} from "../lineBookmarks";
import {
  loadEditorConfig,
  type EditorConfigResolved,
} from "../editorConfig";
import {
  isMarkdownPath,
  readEditorMdView,
  writeEditorMdView,
  type EditorMdView,
} from "../editorMdView";
import {
  readDiffSideBySide,
  writeDiffSideBySide,
} from "../editorDiffPrefs";
import { useGitDiffPair } from "../hooks/useGitDiffPair";

// Right-click "Ask AI to …" actions registered with Monaco. Each one
// grabs the current selection (or the whole file when nothing is
// selected) and ships a pre-composed prompt to the active AI chat
// panel via the aiBus. They're cheap, lazily registered, and only
// active for the focused editor — matching the way users already think
// about per-pane chrome.
interface AIAction {
  id: string;
  label: string;
  prompt: string;
}
const AI_ACTIONS: AIAction[] = [
  {
    id: "askAI.explain",
    label: "Ask AI to explain",
    prompt: "Explain what this code does, step by step.",
  },
  {
    id: "askAI.refactor",
    label: "Ask AI to refactor",
    prompt:
      "Suggest a refactor that improves readability or correctness. Show the proposed change as a diff.",
  },
  {
    id: "askAI.fix",
    label: "Ask AI to find bugs",
    prompt:
      "Review this code for bugs, edge cases, and likely failure modes. Propose concrete fixes.",
  },
  {
    id: "askAI.test",
    label: "Ask AI to write tests",
    prompt:
      "Write tests for this code. Cover the golden path plus the obvious edge cases.",
  },
  {
    id: "askAI.docs",
    label: "Ask AI to add docs",
    prompt:
      "Add concise documentation comments to this code. Keep them grounded in what the code does, not aspirational descriptions.",
  },
];

interface GitChangeRange {
  kind: "added" | "modified" | "deleted";
  startLine: number;
  endLine: number;
}

function parseDiffHunks(diff: string): GitChangeRange[] {
  const out: GitChangeRange[] = [];
  if (!diff) return out;
  const lines = diff.split("\n");
  let i = 0;
  while (i < lines.length) {
    const m = lines[i].match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (!m) {
      i++;
      continue;
    }
    let newLine = parseInt(m[1], 10);
    i++;
    let buffer: { startLine: number; hasRemove: boolean } | null = null;
    let pendingRemove = false;
    while (
      i < lines.length &&
      !lines[i].startsWith("@@") &&
      !lines[i].startsWith("diff ") &&
      !lines[i].startsWith("--- ") &&
      !lines[i].startsWith("+++ ")
    ) {
      const line = lines[i];
      const c = line[0];
      if (c === "+") {
        if (!buffer)
          buffer = { startLine: newLine, hasRemove: pendingRemove };
        newLine++;
        pendingRemove = false;
      } else if (c === "-") {
        if (buffer) {
          out.push({
            kind: buffer.hasRemove ? "modified" : "added",
            startLine: buffer.startLine,
            endLine: newLine - 1,
          });
          buffer = null;
        }
        pendingRemove = true;
      } else if (c === " ") {
        if (buffer) {
          out.push({
            kind: buffer.hasRemove ? "modified" : "added",
            startLine: buffer.startLine,
            endLine: newLine - 1,
          });
          buffer = null;
        }
        if (pendingRemove) {
          out.push({
            kind: "deleted",
            startLine: newLine,
            endLine: newLine,
          });
          pendingRemove = false;
        }
        newLine++;
      }
      i++;
    }
    if (buffer) {
      out.push({
        kind: buffer.hasRemove ? "modified" : "added",
        startLine: buffer.startLine,
        endLine: newLine - 1,
      });
    }
    if (pendingRemove) {
      out.push({
        kind: "deleted",
        startLine: Math.max(1, newLine - 1),
        endLine: Math.max(1, newLine - 1),
      });
    }
  }
  return out;
}

// Replace both `contents` and `original` for an open file with the given
// disk content, atomically. Used after a confirmed reload-from-disk so
// the editor view AND the dirty-tracker both move in lockstep — setting
// only one would either leave the buffer "dirty" against itself or
// silently flag the on-disk content as unsaved.
function replaceFileFromDisk(wsId: string, path: string, onDisk: string) {
  useStore.setState((s) => {
    const w = s.loaded[wsId];
    if (!w || !w.files[path]) return s;
    return {
      loaded: {
        ...s.loaded,
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
}

interface Props {
  wsId: string;
  path: string;
}

export function EditorPane({ wsId, path }: Props) {
  const file = useStore((s) => s.loaded[wsId]?.files[path]);
  const update = useStore((s) => s.updateFileContents);
  const resolvedTheme = useResolvedTheme();
  const settings = useEditorSettings();
  const wsRoot = useStore((s) => s.loaded[wsId]?.meta.root ?? "");
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const decorationsRef = useRef<editor.IEditorDecorationsCollection | null>(
    null,
  );
  const [mdView, setMdView] = useState<EditorMdView>(readEditorMdView);
  const [showDiff, setShowDiff] = useState(false);
  const [diffSideBySide, setDiffSideBySide] = useState(readDiffSideBySide);
  const [saving, setSaving] = useState(false);
  // Per-file `.editorconfig` overlay. Loaded async whenever the file
  // path or workspace root changes; while it's resolving, the editor
  // shows the global settings — see src/editorConfig.ts for the
  // intended UX caveats.
  const [ec, setEc] = useState<EditorConfigResolved>({});
  useEffect(() => {
    if (!path || !wsRoot) {
      setEc({});
      return;
    }
    let cancelled = false;
    void loadEditorConfig(path, wsRoot).then((r) => {
      if (!cancelled) setEc(r);
    });
    return () => {
      cancelled = true;
    };
  }, [path, wsRoot]);
  // Mirror of "the markdown split preview is currently active" so the
  // editor's scroll listener (registered once in onMount) can read
  // the current value without re-registering on every state change.
  const mdSplitActiveRef = useRef(false);

  const language = file ? langOf(path) : null;
  const isMarkdown = isMarkdownPath(path);
  const dirty = !!file && file.contents !== file.original;
  const gitDiffPair = useGitDiffPair(
    wsRoot || undefined,
    path,
    file?.contents ?? "",
  );

  useEffect(() => {
    setShowDiff(false);
  }, [path]);

  const onMdViewChange = (view: EditorMdView) => {
    setMdView(view);
    writeEditorMdView(view);
  };

  const onDiffSideBySideChange = (sideBySide: boolean) => {
    setDiffSideBySide(sideBySide);
    writeDiffSideBySide(sideBySide);
  };

  const save = async () => {
    if (!dirty) return;
    setSaving(true);
    await useStore.getState().saveFile(wsId, path);
    setSaving(false);
  };

  // Keep the scroll-sync mirror updated so the onMount listener sees
  // the current state without needing to re-register.
  useEffect(() => {
    mdSplitActiveRef.current =
      isMarkdown && mdView === "split" && !showDiff;
  }, [isMarkdown, mdView, showDiff]);

  // Apply runtime settings changes (font size, word wrap) without remounting.
  // The .editorconfig overlay (`ec`) wins for tabSize / insertSpaces when
  // present; everything else stays driven by the global settings.
  useEffect(() => {
    if (!editorRef.current) return;
    editorRef.current.updateOptions({
      fontSize: settings.fontSize,
      wordWrap: settings.wordWrap,
      tabSize: ec.tab_width ?? ec.indent_size ?? settings.tabSize,
      insertSpaces: ec.indent_style
        ? ec.indent_style === "space"
        : undefined,
      minimap: { enabled: settings.minimap },
      autoClosingBrackets: settings.autoClosingBrackets,
      renderWhitespace: settings.renderWhitespace,
      stickyScroll: { enabled: settings.stickyScroll },
      formatOnType: settings.formatOnTypePaste,
      formatOnPaste: settings.formatOnTypePaste,
    });
  }, [
    settings.fontSize,
    settings.wordWrap,
    settings.tabSize,
    settings.minimap,
    settings.autoClosingBrackets,
    settings.renderWhitespace,
    settings.stickyScroll,
    settings.formatOnTypePaste,
    ec,
  ]);

  // Per-file view-state preservation. When the editor's model swaps
  // (the user clicked a different tab and this pane is re-bound to a
  // new path), snapshot the old path's scroll + cursor + folding so
  // returning to it later restores the same view, then load any
  // stashed state for the new path. Initial restore lives in
  // onMount below, since editorRef isn't assigned until then.
  const prevPathRef = useRef<string | null>(null);
  useEffect(() => {
    const ed = editorRef.current;
    if (!ed) {
      // First render before Monaco has called onMount — nothing to
      // do yet. onMount handles the initial restore directly.
      prevPathRef.current = path;
      return;
    }
    const prevPath = prevPathRef.current;
    if (prevPath && prevPath !== path) {
      try {
        saveViewState(prevPath, ed.saveViewState());
      } catch {
        /* ignore — stale editor, model already torn down */
      }
    }
    const requested = loadViewState(path);
    if (requested) {
      requestAnimationFrame(() => {
        try {
          ed.restoreViewState(requested);
        } catch {
          /* ignore */
        }
      });
    }
    prevPathRef.current = path;
    return () => {
      const cur = prevPathRef.current;
      if (cur) {
        try {
          saveViewState(cur, ed.saveViewState());
        } catch {
          /* ignore */
        }
      }
    };
  }, [path]);

  // Auto-save: debounce-save when contents change while auto-save is on.
  // file?.contents and file?.original already cover every relevant
  // change — the bare `file` was a redundant duplicate (Zustand spreads
  // a new file object on every contents update).
  useEffect(() => {
    if (!settings.autoSave || !file) return;
    if (file.contents === file.original) return;
    const t = window.setTimeout(() => {
      void useStore.getState().saveFile(wsId, path);
    }, settings.autoSaveDelayMs);
    return () => window.clearTimeout(t);
  }, [
    settings.autoSave,
    settings.autoSaveDelayMs,
    file?.contents,
    file?.original,
    wsId,
    path,
  ]);

  useEffect(() => {
    setEditorState({ filePath: path, language });
    pushRecentFile(wsId, path);
    // Mark the file as "just touched" so the idle-buffer sweeper knows
    // someone is paying attention to it. The sweeper resets to "now"
    // again on focus + cursor moves below; this mount call covers the
    // common case where the user opens a tab and then walks away
    // without ever bringing focus to the editor body.
    useStore.getState().touchFile(wsId, path);
    return () => {
      clearEditorState();
    };
  }, [path, language, wsId]);

  // External-file-change detection: when the watcher reports the parent
  // directory changed, check if our file is dirty in memory and ALSO has
  // a different on-disk content. Prompt to reload.
  //
  // Dependency note: we deliberately omit `file` from the deps array.
  // Including it caused this effect to tear down + re-register the dir
  // listener on every keystroke (file.contents mutates on each
  // updateFileContents). Reads inside the handler go through
  // useStore.getState(), so there's no stale-closure risk. The component
  // returns null at the bottom when file is undefined, which natural-
  // unmount-cleans the effect via React's normal lifecycle.
  useEffect(() => {
    let canceled = false;
    let pendingTimer: number | null = null;

    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as {
        wsId: string;
        dir: string;
      };
      if (detail.wsId !== wsId) return;
      if (!pathsEqual(detail.dir, dirname(path))) return;
      if (pendingTimer) window.clearTimeout(pendingTimer);
      pendingTimer = window.setTimeout(async () => {
        if (canceled) return;
        try {
          const onDisk = await fs.readFile(path);
          const cur = useStore.getState().loaded[wsId]?.files[path];
          if (!cur) return;
          if (onDisk === cur.contents) return;
          if (cur.contents === cur.original) {
            // Not dirty — silently reload from disk.
            replaceFileFromDisk(wsId, path, onDisk);
            return;
          }
          // Dirty — prompt before clobbering the user's edits.
          const ok = await dialogConfirm(
            `${path}\n\nThis file changed on disk while you have unsaved edits. Reload from disk and discard your changes?`,
            {
              title: "File changed on disk",
              okLabel: "Reload",
              cancelLabel: "Keep mine",
              danger: true,
            },
          );
          if (ok && !canceled) {
            replaceFileFromDisk(wsId, path, onDisk);
          }
        } catch {
          warning(`File no longer accessible: ${path}`);
        }
      }, 200);
    };
    fsBus.addEventListener("dir", handler);
    return () => {
      canceled = true;
      fsBus.removeEventListener("dir", handler);
      if (pendingTimer) window.clearTimeout(pendingTimer);
    };
  }, [wsId, path]);

  // Inline git gutter: poll git diff and apply line decorations.
  useEffect(() => {
    if (!file) return;
    let cancelled = false;
    let debounce: number | null = null;

    const computeAndApply = async () => {
      const ed = editorRef.current;
      const m = monacoRef.current;
      if (!ed || !m) return;
      const wsRoot = useStore.getState().loaded[wsId]?.meta.root;
      if (!wsRoot) return;
      const root = wsRoot.replace(/\\/g, "/").replace(/\/+$/, "");
      const norm = path.replace(/\\/g, "/");
      if (!norm.startsWith(root + "/")) return;
      const rel = norm.slice(root.length + 1);
      let diff = "";
      try {
        diff = await gitApi.diff(wsRoot, rel);
      } catch {
        return; // not a git repo, or other error — skip silently
      }
      if (cancelled) return;
      const ranges = parseDiffHunks(diff);
      const decos: editor.IModelDeltaDecoration[] = ranges.map((r) => ({
        range: new m.Range(r.startLine, 1, r.endLine, 1),
        options: {
          isWholeLine: true,
          linesDecorationsClassName: `git-gutter git-gutter-${r.kind}`,
        },
      }));
      if (!decorationsRef.current) {
        decorationsRef.current = ed.createDecorationsCollection(decos);
      } else {
        decorationsRef.current.set(decos);
      }
    };

    const schedule = () => {
      if (debounce) window.clearTimeout(debounce);
      debounce = window.setTimeout(() => {
        debounce = null;
        void computeAndApply();
      }, 300);
    };

    schedule();

    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as {
        wsId: string;
        dir: string;
      };
      if (detail.wsId !== wsId) return;
      const fileDir = dirname(path);
      // Re-check on changes near our file or to .git (HEAD/index moved).
      if (
        pathsEqual(detail.dir, fileDir) ||
        detail.dir.replace(/\\/g, "/").endsWith("/.git")
      ) {
        schedule();
      }
    };
    fsBus.addEventListener("dir", handler);

    return () => {
      cancelled = true;
      fsBus.removeEventListener("dir", handler);
      if (debounce) window.clearTimeout(debounce);
      decorationsRef.current?.clear();
      decorationsRef.current = null;
    };
  }, [file?.original, wsId, path]);

  if (!file) return null;

  const showEditor = !showDiff && (!isMarkdown || mdView !== "preview");
  const showPreview =
    !showDiff && isMarkdown && (mdView === "split" || mdView === "preview");

  return (
    <div className="editor-host">
      <EditorBreadcrumbs wsId={wsId} root={wsRoot} path={path} />
      <EditorTabToolbar
        isMarkdown={isMarkdown}
        mdView={mdView}
        onMdViewChange={onMdViewChange}
        hasGitChanges={!!gitDiffPair}
        showDiff={showDiff}
        onToggleDiff={() => setShowDiff((v) => !v)}
        diffSideBySide={diffSideBySide}
        onDiffSideBySideChange={onDiffSideBySideChange}
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
      />
      <div
        className={`editor-body ${
          showPreview && showEditor ? "editor-body-split" : ""
        }`}
      >
        {showDiff && gitDiffPair ? (
          <DiffView
            originalContent={gitDiffPair.original}
            modifiedContent={gitDiffPair.modified}
            path={path}
            sideBySide={diffSideBySide}
          />
        ) : (
          <>
            {showEditor && (
              <div className="editor-half">
      <Editor
        height="100%"
        path={path}
        // Don't dispose the text model on unmount. Tab switches remount
        // this whole component (the portal key is pane.id+path), and
        // disposing the model destroyed the UNDO STACK every time the
        // user looked at another tab. Models are reused by `path` on
        // remount; the store disposes them when the buffer truly closes
        // (closeTab / idle unload / close workspace).
        keepCurrentModel
        language={language ?? "plaintext"}
        value={file.contents}
        theme={resolvedTheme === "dark" ? "vs-dark" : "vs"}
        options={{
          fontSize: settings.fontSize,
          minimap: { enabled: settings.minimap },
          scrollBeyondLastLine: false,
          tabSize: ec.tab_width ?? ec.indent_size ?? settings.tabSize,
          insertSpaces: ec.indent_style
            ? ec.indent_style === "space"
            : undefined,
          renderWhitespace: settings.renderWhitespace,
          smoothScrolling: true,
          automaticLayout: true,
          wordWrap: settings.wordWrap,
          stickyScroll: { enabled: settings.stickyScroll },
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: "active",
            indentation: true,
          },
          mouseWheelZoom: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          padding: { top: 8 },
          rulers: settings.rulers,
          autoClosingBrackets: settings.autoClosingBrackets,
          formatOnType: settings.formatOnTypePaste,
          formatOnPaste: settings.formatOnTypePaste,
        }}
        onMount={(ed: editor.IStandaloneCodeEditor, monaco: Monaco) => {
          editorRef.current = ed;
          monacoRef.current = monaco;
          setMonacoInstance(monaco);
          setActiveEditor(ed);
          // Register with the resume-debug registry so a wake-from-standby
          // can re-trigger Monaco layout (its WebGL/canvas renderer
          // occasionally lands at 0×0 after macOS sleep). The function
          // `unregisterMonaco` is closed over inside onDidDispose below.
          const unregisterMonaco = registerResumeComponent({
            id: `monaco:${wsId}:${path}`,
            kind: "monaco",
            snapshot: () => {
              const dom = ed.getContainerDomNode();
              const model = ed.getModel();
              return {
                hasModel: !!model,
                lines: model?.getLineCount() ?? 0,
                box: dom
                  ? `${dom.clientWidth}x${dom.clientHeight}`
                  : "detached",
                visible: dom
                  ? dom.offsetParent !== null ||
                    // offsetParent is null for fixed/absolute positioned
                    // nodes that ARE visible (Monaco hosts use position:
                    // relative) — fall back to the bounding rect.
                    dom.getBoundingClientRect().width > 0
                  : false,
              };
            },
            heal: () => {
              try {
                ed.layout();
              } catch {
                /* ignore — see resumeDebug contract */
              }
            },
          });
          // keepCurrentModel can hand us a model that went stale while
          // this file was a background tab (the AI's edit_file or an
          // accepted external-change reload updates the store buffer
          // without a mounted editor). Re-sync via executeEdits so the
          // undo stack survives — model.setValue would wipe it.
          {
            const model = ed.getModel();
            if (model && model.getValue() !== file.contents) {
              ed.executeEdits("codetta-resync", [
                {
                  range: model.getFullModelRange(),
                  text: file.contents,
                },
              ]);
              ed.pushUndoStop();
            }
          }
          // Initial view-state restore for this pane's first path.
          // The path-effect above only handles subsequent path
          // swaps; the first one needs handling here because
          // editorRef.current was null when that effect first ran.
          const initial = loadViewState(path);
          if (initial) {
            try {
              ed.restoreViewState(initial);
            } catch {
              /* ignore */
            }
          }
          prevPathRef.current = path;
          // Mark file as touched on mount + on every focus, so the
          // idle-buffer-unload sweeper knows this buffer is in use.
          useStore.getState().touchFile(wsId, path);
          ed.onDidFocusEditorWidget(() => {
            setActiveEditor(ed);
            useStore.getState().touchFile(wsId, path);
          });
          ed.onDidChangeCursorPosition((e) => {
            setEditorState({
              line: e.position.lineNumber,
              col: e.position.column,
            });
            useStore.getState().touchFile(wsId, path);
          });
          ed.onDidChangeCursorSelection(() => {
            const sel = ed.getSelection();
            const model = ed.getModel();
            if (!sel || !model || sel.isEmpty()) {
              setEditorState({ selectionText: "", selectionLines: 0 });
              return;
            }
            const text = model.getValueInRange(sel);
            const lines =
              sel.endLineNumber - sel.startLineNumber + 1;
            setEditorState({ selectionText: text, selectionLines: lines });
          });
          const off = onEditorGoto(({ line, col }) => {
            try {
              ed.revealPositionInCenter({ lineNumber: line, column: col });
              ed.setPosition({ lineNumber: line, column: col });
              ed.focus();
            } catch {
              /* ignore */
            }
          });
          // Editor → preview scroll-sync: when the user scrolls the
          // markdown editor in split mode, push the topmost visible
          // source line to the preview so it follows along. We only
          // dispatch when the split preview is currently active —
          // editing a markdown file with the preview hidden produces
          // a noisy stream of bus events otherwise. mdSplitActiveRef
          // gives us the up-to-date flag without rebinding the
          // listener every time the state changes.
          const offScroll = ed.onDidScrollChange(() => {
            if (!mdSplitActiveRef.current) return;
            try {
              const ranges = ed.getVisibleRanges();
              const top = ranges[0]?.startLineNumber ?? 1;
              requestMdPreviewScroll(top);
            } catch {
              /* ignore */
            }
          });
          // Register right-click "Ask AI to …" actions. They live in
          // their own context-menu group so they're visually grouped
          // under one section header, separated from Monaco's
          // built-ins. We also bind Cmd/Ctrl+I to "explain" since it's
          // the highest-frequency action.
          const disposables = AI_ACTIONS.map((action, idx) =>
            ed.addAction({
              id: action.id,
              label: action.label,
              contextMenuGroupId: "askai",
              contextMenuOrder: idx,
              keybindings:
                action.id === "askAI.explain"
                  ? [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI]
                  : undefined,
              run: (editor) => {
                const model = editor.getModel();
                if (!model) return;
                const sel = editor.getSelection();
                let snippet: string;
                if (sel && !sel.isEmpty()) {
                  snippet = model.getValueInRange(sel);
                } else {
                  snippet = model.getValue();
                }
                if (!snippet.trim()) return;
                const lang = model.getLanguageId() || "";
                const filename = path.split(/[\\/]/).pop() || path;
                const text = `${action.prompt}\n\n\`\`\`${lang} ${filename}\n${snippet}\n\`\`\``;
                // Make sure the chat panel is mounted (it ignores bus
                // events if hidden because it isn't listening). Toggle
                // visibility then schedule the dispatch a frame later
                // so the panel has a chance to subscribe.
                const store = useStore.getState();
                if (!store.loaded[wsId]?.layout?.aiPanelVisible) {
                  store.setAIPanelVisible(wsId, true);
                }
                requestAnimationFrame(() => {
                  requestAIPrompt({ wsId, text, send: true });
                });
              },
            }),
          );
          // Line-level bookmarks: Ctrl+F2 toggles a bookmark on the
          // current line, F2 / Shift+F2 jump to the next / previous
          // bookmark in this file (wrapping). Session-scoped — see
          // src/lineBookmarks.ts for the rationale.
          const bookmarkDisposables = [
            ed.addAction({
              id: "bookmark.toggle",
              label: "Toggle Bookmark on Line",
              contextMenuGroupId: "bookmarks",
              contextMenuOrder: 1,
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.F2],
              run: (editor) => {
                const pos = editor.getPosition();
                if (!pos) return;
                toggleLineBookmark(path, pos.lineNumber);
              },
            }),
            ed.addAction({
              id: "bookmark.next",
              label: "Next Bookmark",
              contextMenuGroupId: "bookmarks",
              contextMenuOrder: 2,
              keybindings: [monaco.KeyCode.F2],
              run: (editor) => {
                const pos = editor.getPosition();
                const from = pos?.lineNumber ?? 0;
                const target = nextLineBookmark(path, from);
                if (target == null) return;
                editor.setPosition({ lineNumber: target, column: 1 });
                editor.revealLineInCenter(target);
              },
            }),
            ed.addAction({
              id: "bookmark.prev",
              label: "Previous Bookmark",
              contextMenuGroupId: "bookmarks",
              contextMenuOrder: 3,
              keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F2],
              run: (editor) => {
                const pos = editor.getPosition();
                const from = pos?.lineNumber ?? Number.MAX_SAFE_INTEGER;
                const target = prevLineBookmark(path, from);
                if (target == null) return;
                editor.setPosition({ lineNumber: target, column: 1 });
                editor.revealLineInCenter(target);
              },
            }),
          ];
          // Bookmark gutter decorations. We use an overview-ruler tick
          // only (no glyph margin) because enabling glyphMargin would
          // shift the editor's left padding for every file, which is a
          // user-visible layout change that's overkill for an
          // ephemeral session-scoped feature. The ruler tick on the
          // right edge is enough to convey "this line is bookmarked".
          // Kept in a separate collection from the git-diff gutter so
          // the two don't trample each other on update.
          let bookmarkDecorations:
            | editor.IEditorDecorationsCollection
            | null = null;
          const applyBookmarkDecorations = () => {
            const lines = getLineBookmarks(path);
            const decos: editor.IModelDeltaDecoration[] = lines.map((l) => ({
              range: new monaco.Range(l, 1, l, 1),
              options: {
                isWholeLine: true,
                overviewRuler: {
                  color: "var(--accent)",
                  position: monaco.editor.OverviewRulerLane.Center,
                },
              },
            }));
            if (!bookmarkDecorations) {
              bookmarkDecorations = ed.createDecorationsCollection(decos);
            } else {
              bookmarkDecorations.set(decos);
            }
          };
          applyBookmarkDecorations();
          const unsubBookmarks = subscribeLineBookmarks((changedPath) => {
            if (changedPath !== path) return;
            applyBookmarkDecorations();
          });
          // Symbol-navigation shortcuts. These are thin wrappers that
          // delegate to Monaco's built-in commands via ed.trigger. They
          // only do something useful for languages where a Monaco
          // language service is actually running — TypeScript and
          // JavaScript work out of the box. For Rust, Python, Go, etc.
          // without an LSP plugged in, these silently no-op. That's
          // acceptable for now; documenting the limitation here is
          // enough until we wire up real LSP support.
          const navDisposables = [
            ed.addAction({
              id: "nav.gotoDef",
              label: "Go to Definition",
              contextMenuGroupId: "navigation",
              contextMenuOrder: 1,
              keybindings: [monaco.KeyCode.F12],
              run: (editor) => {
                editor.trigger("source", "editor.action.revealDefinition", null);
              },
            }),
            ed.addAction({
              id: "nav.findRefs",
              label: "Find All References",
              contextMenuGroupId: "navigation",
              contextMenuOrder: 2,
              keybindings: [monaco.KeyMod.Shift | monaco.KeyCode.F12],
              run: (editor) => {
                editor.trigger("source", "editor.action.goToReferences", null);
              },
            }),
            ed.addAction({
              id: "nav.peekDef",
              label: "Peek Definition",
              contextMenuGroupId: "navigation",
              contextMenuOrder: 3,
              keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.F12],
              run: (editor) => {
                editor.trigger("source", "editor.action.peekDefinition", null);
              },
            }),
            ed.addAction({
              id: "nav.gotoImpl",
              label: "Go to Implementation",
              contextMenuGroupId: "navigation",
              contextMenuOrder: 4,
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12],
              run: (editor) => {
                editor.trigger("source", "editor.action.goToImplementation", null);
              },
            }),
          ];
          // Multi-cursor shortcuts. Thin wrappers around Monaco built-ins.
          const multicursorDisposables = [
            ed.addAction({
              id: "multicursor.addAbove",
              label: "Add Cursor Above",
              contextMenuGroupId: "multicursor",
              contextMenuOrder: 1,
              keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.UpArrow,
              ],
              run: (editor) => {
                editor.trigger("source", "editor.action.insertCursorAbove", null);
              },
            }),
            ed.addAction({
              id: "multicursor.addBelow",
              label: "Add Cursor Below",
              contextMenuGroupId: "multicursor",
              contextMenuOrder: 2,
              keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.DownArrow,
              ],
              run: (editor) => {
                editor.trigger("source", "editor.action.insertCursorBelow", null);
              },
            }),
            ed.addAction({
              id: "multicursor.addLineEnds",
              label: "Add Cursors to Line Ends",
              contextMenuGroupId: "multicursor",
              contextMenuOrder: 3,
              keybindings: [
                monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyI,
              ],
              run: (editor) => {
                editor.trigger(
                  "source",
                  "editor.action.insertCursorAtEndOfEachLineSelected",
                  null,
                );
              },
            }),
            ed.addAction({
              id: "multicursor.selectNext",
              label: "Add Selection to Next Find Match",
              contextMenuGroupId: "multicursor",
              contextMenuOrder: 4,
              keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD],
              run: (editor) => {
                editor.trigger(
                  "source",
                  "editor.action.addSelectionToNextFindMatch",
                  null,
                );
              },
            }),
          ];
          ed.onDidDispose(() => {
            unregisterMonaco();
            off();
            offScroll.dispose();
            for (const d of disposables) d.dispose();
            for (const d of bookmarkDisposables) d.dispose();
            unsubBookmarks();
            bookmarkDecorations?.clear();
            bookmarkDecorations = null;
            for (const d of navDisposables) d.dispose();
            for (const d of multicursorDisposables) d.dispose();
            setActiveEditor(null);
          });
        }}
        onChange={(v) => update(wsId, path, v ?? "")}
      />
              </div>
            )}
            {showPreview && (
              <div className="preview-half">
                <MarkdownPreview content={file.contents} interactive={mdView === "split"} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
