import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "../store";
import {
  getAgentContextPanel,
  setAgentContextPanel,
  subscribeAgentContextPanel,
  termIdOfPanel,
  termPanelOf,
  type AgentContextPanel,
} from "../agentContextNav";
import { SourceControlPanel } from "./SourceControlPanel";
import { FileTree } from "./FileTree";
import { AgentAddViewMenu } from "./AgentAddViewMenu";
import { AgentTerminalPanel } from "./AgentTerminalPanel";
import { Icon } from "./Icon";

interface Props {
  wsId: string;
  root: string;
  frozen?: boolean;
  onOpenFile: (path: string) => void;
}

/** Agent Mode right column: Changes / Files / project Terminals + add-view. */
export function AgentContextColumn({
  wsId,
  root,
  frozen,
  onOpenFile,
}: Props) {
  const terminalsMap = useStore((s) => s.loaded[wsId]?.terminals);
  const terminals = terminalsMap ? Object.values(terminalsMap) : [];
  const closeTerminalStore = useStore((s) => s.closeTerminal);

  const [contextPanel, setLocalPanel] = useState<AgentContextPanel>(() =>
    getAgentContextPanel(wsId),
  );
  useEffect(() => {
    setLocalPanel(getAgentContextPanel(wsId));
    return subscribeAgentContextPanel(() =>
      setLocalPanel(getAgentContextPanel(wsId)),
    );
  }, [wsId]);

  const setContextPanel = useCallback(
    (panel: AgentContextPanel) => setAgentContextPanel(wsId, panel),
    [wsId],
  );

  const [addViewOpen, setAddViewOpen] = useState(false);
  const addViewRef = useRef<HTMLButtonElement>(null);
  const activeTermId = termIdOfPanel(contextPanel);

  useEffect(() => {
    if (!activeTermId || !terminalsMap) return;
    if (terminalsMap[activeTermId]) return;
    const ids = Object.keys(terminalsMap);
    setContextPanel(ids.length ? termPanelOf(ids[ids.length - 1]) : "changes");
  }, [activeTermId, terminalsMap, setContextPanel]);

  const createTerminal = useCallback(() => {
    const id = useStore.getState().addTerminal(wsId, "bottom");
    setContextPanel(termPanelOf(id));
  }, [wsId, setContextPanel]);

  const removeTerminal = useCallback(
    (termId: string) => {
      closeTerminalStore(wsId, termId);
      const cur = getAgentContextPanel(wsId);
      if (cur !== termPanelOf(termId)) return;
      const rest = Object.keys(
        useStore.getState().loaded[wsId]?.terminals ?? {},
      ).filter((id) => id !== termId);
      setContextPanel(
        rest.length > 0 ? termPanelOf(rest[rest.length - 1]) : "changes",
      );
    },
    [closeTerminalStore, wsId, setContextPanel],
  );

  return (
    <aside
      className={`agent-context${activeTermId ? " agent-context--terminal" : ""}${frozen ? " is-chat-switch-frozen" : ""}`}
    >
      <div className="agent-context-tabs" role="tablist" aria-label="Workspace context">
        <div className="agent-context-tabs-scroll">
          <button
            className={`agent-context-tab ${contextPanel === "changes" ? "active" : ""}`}
            role="tab"
            aria-selected={contextPanel === "changes"}
            onClick={() => setContextPanel("changes")}
          >
            Changes
          </button>
          <button
            className={`agent-context-tab ${contextPanel === "files" ? "active" : ""}`}
            role="tab"
            aria-selected={contextPanel === "files"}
            onClick={() => setContextPanel("files")}
          >
            Files
          </button>
          {terminals.map((t) => {
            const panel = termPanelOf(t.id);
            const active = contextPanel === panel;
            return (
              <div
                key={t.id}
                className={`agent-context-term-tab${active ? " active" : ""}`}
              >
                <button
                  type="button"
                  className="agent-context-tab agent-context-tab--term"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setContextPanel(panel)}
                  title={t.title}
                >
                  <Icon name="terminal" size={12} />
                  <span className="agent-context-tab-label">{t.title}</span>
                </button>
                <button
                  type="button"
                  className="agent-context-tab-close"
                  title="Close Terminal"
                  aria-label={`Close ${t.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeTerminal(t.id);
                  }}
                >
                  <Icon name="x" size={10} />
                </button>
              </div>
            );
          })}
        </div>
        <button
          ref={addViewRef}
          type="button"
          className="agent-context-add"
          title="Add view"
          aria-label="Add view"
          aria-haspopup="menu"
          aria-expanded={addViewOpen}
          onClick={() => setAddViewOpen((v) => !v)}
        >
          <Icon name="plus" size={14} />
        </button>
      </div>
      <AgentAddViewMenu
        open={addViewOpen}
        anchor={addViewRef.current}
        onClose={() => setAddViewOpen(false)}
        onAddTerminal={createTerminal}
      />
      <div className="agent-context-body">
        <div
          className="agent-context-pane"
          style={{ display: contextPanel === "changes" ? "flex" : "none" }}
        >
          <SourceControlPanel
            key={`sc:${wsId}`}
            wsId={wsId}
            root={root}
            compact
          />
        </div>
        <div
          className="agent-context-pane"
          style={{ display: contextPanel === "files" ? "flex" : "none" }}
        >
          <FileTree
            key={`ft:${wsId}`}
            wsId={wsId}
            root={root}
            onOpenFile={(_id, p) => onOpenFile(p)}
          />
        </div>
        {(terminals.length > 0 || !!activeTermId) && (
          <div
            className="agent-context-pane agent-context-pane--terminal"
            style={{ display: activeTermId ? "flex" : "none" }}
          >
            <AgentTerminalPanel
              key={`term-panel:${wsId}`}
              wsId={wsId}
              root={root}
              activeTermId={activeTermId}
              onCreate={createTerminal}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
