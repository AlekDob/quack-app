// Inline file editor for modals (instructions, skills, agent file popup).
// Monaco + the shared editor tab toolbar (markdown views, git diff, save).

import { useEffect, useRef, useState } from "react";
import { fs } from "../ipc";
import { dirname } from "../pathUtils";
import { confirm as dialogConfirm } from "../dialog";
import {
  success as toastSuccess,
  error as toastError,
  errMsg,
} from "../notify";
import { Icon } from "./Icon";
import { SimpleMonacoEditor } from "./SimpleMonacoEditor";
import { MarkdownPreview } from "./MarkdownPreview";
import { MermaidPreview } from "./MermaidPreview";
import { HtmlPreviewFrame } from "./HtmlPreviewFrame";
import { EditorTabToolbar } from "./EditorTabToolbar";
import { DiffView } from "./DiffView";
import {
  isMarkdownPath,
  readEditorMdView,
  writeEditorMdView,
  type EditorMdView,
} from "../editorMdView";
import {
  isMermaidPath,
  readEditorMermaidView,
  writeEditorMermaidView,
} from "../editorMermaidView";
import {
  isHtmlPath,
  readEditorHtmlView,
  writeEditorHtmlView,
} from "../editorHtmlView";
import { htmlPreviewBaseHref } from "../htmlPreview";
import {
  readDiffSideBySide,
  writeDiffSideBySide,
} from "../editorDiffPrefs";
import { useGitDiffPair } from "../hooks/useGitDiffPair";

interface Props {
  path: string | null;
  subtitle?: string;
  starter?: string;
  onBack?: () => void;
  title?: string;
  onDirtyChange?: (dirty: boolean) => void;
  /** Workspace root for git diff (Changes view). */
  gitRoot?: string;
}

export function FileEditorPane({
  path,
  subtitle,
  starter,
  onBack,
  title,
  onDirtyChange,
  gitRoot,
}: Props) {
  const [content, setContent] = useState("");
  const [original, setOriginal] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mdView, setMdView] = useState<EditorMdView>(readEditorMdView);
  const [mermaidView, setMermaidView] = useState<EditorMdView>(readEditorMermaidView);
  const [htmlView, setHtmlView] = useState<EditorMdView>(readEditorHtmlView);
  const [showDiff, setShowDiff] = useState(false);
  const [diffSideBySide, setDiffSideBySide] = useState(readDiffSideBySide);
  const dirty = content !== original;
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const isMarkdown = !!path && isMarkdownPath(path);
  const isMermaid = !!path && isMermaidPath(path);
  const isHtml = !!path && isHtmlPath(path);
  const diagramView = isMermaid ? mermaidView : isHtml ? htmlView : mdView;
  const gitDiffPair = useGitDiffPair(gitRoot, path ?? undefined, content);

  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => {
    return () => onDirtyChange?.(false);
  }, [onDirtyChange]);

  useEffect(() => {
    if (!path) return;
    let alive = true;
    setLoading(true);
    setShowDiff(false);
    (async () => {
      let text = starter ?? "";
      try {
        if (await fs.exists(path)) text = await fs.readFile(path);
      } catch (e) {
        console.warn("FileEditorPane load failed", e);
      }
      if (!alive) return;
      setContent(text);
      setOriginal(text);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [path, starter]);

  const save = async () => {
    if (!path || !dirty) return;
    setSaving(true);
    try {
      await fs.writeFile(path, content);
    } catch {
      try {
        await fs.createDir(dirname(path));
        await fs.writeFile(path, content);
      } catch (e2) {
        setSaving(false);
        toastError(`Could not save: ${errMsg(e2)}`);
        return;
      }
    }
    setSaving(false);
    setOriginal(content);
    toastSuccess("Saved");
  };

  const back = async () => {
    if (!onBack) return;
    if (dirtyRef.current) {
      const ok = await dialogConfirm("Discard unsaved changes?", {
        okLabel: "Discard",
        cancelLabel: "Keep editing",
        danger: true,
      });
      if (!ok) return;
    }
    onBack();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (dirtyRef.current) void save();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, path]);

  const onDiagramViewChange = (view: EditorMdView) => {
    if (isMermaid) {
      setMermaidView(view);
      writeEditorMermaidView(view);
      return;
    }
    if (isHtml) {
      setHtmlView(view);
      writeEditorHtmlView(view);
      return;
    }
    setMdView(view);
    writeEditorMdView(view);
  };

  const onDiffSideBySideChange = (sideBySide: boolean) => {
    setDiffSideBySide(sideBySide);
    writeDiffSideBySide(sideBySide);
  };

  const showEditor =
    !loading &&
    !showDiff &&
    (!isMarkdown || mdView !== "preview") &&
    (!isMermaid || mermaidView !== "preview") &&
    (!isHtml || htmlView !== "preview");
  const showMarkdownPreview =
    !loading && !showDiff && isMarkdown && (mdView === "split" || mdView === "preview");
  const showMermaidPreview =
    !loading && !showDiff && isMermaid && (mermaidView === "split" || mermaidView === "preview");
  const showHtmlPreview =
    !loading && !showDiff && isHtml && (htmlView === "split" || htmlView === "preview");
  const showPreview = showMarkdownPreview || showMermaidPreview || showHtmlPreview;

  return (
    <div className="cust-editor">
      {(onBack || subtitle) && (
        <div className="cust-editor-bar">
          {onBack && (
            <button className="cust-back" onClick={() => void back()}>
              <Icon name="chevron-left" size={12} />
              <span>{title ?? "Back"}</span>
            </button>
          )}
          {subtitle && <span className="cust-editor-path">{subtitle}</span>}
        </div>
      )}
      {path && !loading && (
        <EditorTabToolbar
          showDiagramView={isMarkdown || isMermaid || isHtml}
          diagramView={diagramView}
          onDiagramViewChange={onDiagramViewChange}
          hasGitChanges={!!gitDiffPair}
          showDiff={showDiff}
          onToggleDiff={() => setShowDiff((v) => !v)}
          diffSideBySide={diffSideBySide}
          onDiffSideBySideChange={onDiffSideBySideChange}
          dirty={dirty}
          saving={saving}
          onSave={() => void save()}
        />
      )}
      <div
        className={`cust-editor-body ${
          showPreview && showEditor ? "cust-editor-body-split" : ""
        }`}
      >
        {loading && (
          <div className="cust-editor-loading">Loading…</div>
        )}
        {!loading && showDiff && gitDiffPair && path && (
          <DiffView
            originalContent={gitDiffPair.original}
            modifiedContent={gitDiffPair.modified}
            path={path}
            sideBySide={diffSideBySide}
          />
        )}
        {!loading && !showDiff && (
          <>
            {showEditor && path && (
              <div className="cust-editor-half">
                <SimpleMonacoEditor
                  path={path}
                  value={content}
                  onChange={setContent}
                />
              </div>
            )}
            {showMarkdownPreview && (
              <div className="cust-editor-preview">
                <MarkdownPreview
                  content={content}
                  interactive={mdView === "split"}
                />
              </div>
            )}
            {showMermaidPreview && (
              <div className="cust-editor-preview">
                <MermaidPreview content={content} />
              </div>
            )}
            {showHtmlPreview && (
              <div className="cust-editor-preview html-preview-half">
                <HtmlPreviewFrame
                  html={content}
                  title={path ?? "HTML preview"}
                  allowScripts
                  baseHref={path ? htmlPreviewBaseHref(path) : undefined}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
