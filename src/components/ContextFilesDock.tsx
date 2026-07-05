import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useEditorState } from "../editorState";
import { basename, isUnderRoot, relPath } from "../pathUtils";
import { useStore } from "../store";
import { useWorkspaceChatContext } from "../workspaceChatContext";
import { Icon } from "./Icon";

type CtxFile = { path: string; kind: "editor" | "attached" };

const POP_GAP = 6;
const POP_MARGIN = 8;

function contextLabel(n: number): string {
  if (n === 1) return "1 file in context";
  return `${n} files in context`;
}

function clampPopPos(btn: DOMRect, popW: number, popH: number) {
  let left = btn.right - popW;
  left = Math.max(POP_MARGIN, Math.min(left, window.innerWidth - popW - POP_MARGIN));
  let top = btn.top - popH - POP_GAP;
  if (top < POP_MARGIN) top = btn.bottom + POP_GAP;
  return { left, top };
}

function buildContextFiles(
  root: string,
  editorPath: string | null,
  attachContext: boolean,
  attachedFiles: string[],
): { active: CtxFile[]; editorInWs: string | null } {
  const editorInWs =
    editorPath && isUnderRoot(editorPath, root) ? editorPath : null;
  const active: CtxFile[] = [];
  const seen = new Set<string>();

  if (attachContext && editorInWs) {
    active.push({ path: editorInWs, kind: "editor" });
    seen.add(editorInWs);
  }
  for (const f of attachedFiles) {
    if (!isUnderRoot(f, root) || seen.has(f)) continue;
    active.push({ path: f, kind: "attached" });
    seen.add(f);
  }
  return { active, editorInWs };
}

type Props = { wsId: string; root: string };

export function ContextFilesDock({ wsId, root }: Props) {
  const editorState = useEditorState();
  const ctx = useWorkspaceChatContext(wsId);
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popPos, setPopPos] = useState({ left: 0, top: 0 });

  const { active, editorInWs } = useMemo(
    () =>
      buildContextFiles(
        root,
        editorState.filePath,
        ctx.attachContext,
        ctx.attachedFiles,
      ),
    [root, editorState.filePath, ctx.attachContext, ctx.attachedFiles],
  );

  const showDock = editorInWs !== null || ctx.attachedFiles.some((f) => isUnderRoot(f, root));
  if (!showDock) return null;

  const scheduleClose = () => {
    leaveTimer.current = setTimeout(() => setOpen(false), 120);
  };
  const cancelClose = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !popRef.current) return;
    const btn = btnRef.current.getBoundingClientRect();
    const pop = popRef.current.getBoundingClientRect();
    setPopPos(clampPopPos(btn, pop.width, pop.height));
  }, [open, active.length, ctx.attachContext]);

  useEffect(() => () => cancelClose(), []);

  const openFile = (path: string) => {
    void useStore.getState().openFile(wsId, path);
  };

  const popover =
    open &&
    createPortal(
      <div
        ref={popRef}
        className="ai-context-popover liquid-glass"
        style={{ left: popPos.left, top: popPos.top }}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
        role="tooltip"
      >
        <div className="ai-context-popover-head">Shared with the model</div>
        <ul className="ai-context-popover-list">
          {editorInWs && (
            <li className="ai-context-popover-row">
              <button
                type="button"
                className="ai-context-popover-file"
                onClick={() => openFile(editorInWs)}
                title={editorInWs}
              >
                <span className="ai-context-popover-name">
                  {basename(editorInWs)}
                </span>
                <span className="ai-context-popover-meta">Active editor</span>
              </button>
              <button
                type="button"
                className={`ai-context-popover-toggle${ctx.attachContext ? " on" : ""}`}
                onClick={() => ctx.setAttachContext(!ctx.attachContext)}
                title={
                  ctx.attachContext
                    ? "Stop sending this file with every message"
                    : "Send this file with every message"
                }
              >
                {ctx.attachContext ? "ON" : "OFF"}
              </button>
            </li>
          )}
          {ctx.attachedFiles
            .filter((f) => isUnderRoot(f, root))
            .map((path) => (
              <li key={path} className="ai-context-popover-row">
                <button
                  type="button"
                  className="ai-context-popover-file"
                  onClick={() => openFile(path)}
                  title={path}
                >
                  <span className="ai-context-popover-name">
                    {basename(path)}
                  </span>
                  <span className="ai-context-popover-meta">
                    {relPath(path, root)}
                  </span>
                </button>
                <button
                  type="button"
                  className="ai-context-popover-remove"
                  onClick={() =>
                    ctx.setAttachedFiles((prev) => prev.filter((p) => p !== path))
                  }
                  title="Remove from next message"
                  aria-label={`Remove ${basename(path)}`}
                >
                  <Icon name="x" size={11} />
                </button>
              </li>
            ))}
        </ul>
        {active.length === 0 && (
          <p className="ai-context-popover-empty">
            No files attached — turn the editor ON or @-mention a file.
          </p>
        )}
      </div>,
      document.body,
    );

  return (
    <div className="ai-context-dock">
      <button
        ref={btnRef}
        type="button"
        className={`ai-context-dock-btn${active.length > 0 ? " has-files" : ""}`}
        onMouseEnter={() => {
          cancelClose();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
        onFocus={() => setOpen(true)}
        onBlur={scheduleClose}
        title="Files shared with the model for this project"
      >
        {active.length > 0 ? contextLabel(active.length) : "No files in context"}
      </button>
      {popover}
    </div>
  );
}
