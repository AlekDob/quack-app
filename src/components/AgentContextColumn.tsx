import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import {
  getAgentContextPanel,
  isAgentContextCollapsed,
  setAgentContextCollapsed,
  setAgentContextPanel,
  subscribeAgentContextPanel,
  termIdOfPanel,
  termPanelOf,
  type AgentContextPanel,
} from "../agentContextNav";
import {
  getPlanBuyIn,
  subscribePlanBuyIn,
} from "../planBuyInStore";
import { getChatDocs, subscribeChatDocs } from "../chatDocsStore";
import { AgentDocsPanel } from "./AgentDocsPanel";
import { getCachedSession } from "../chatStoreCache";
import { readProviderSessionIds } from "../providerSession";
import { SourceControlPanel } from "./SourceControlPanel";
import { FileTree } from "./FileTree";
import { AgentAddViewMenu } from "./AgentAddViewMenu";
import { AgentTerminalPanel } from "./AgentTerminalPanel";
import { AgentPlanPane } from "./PlanPane";
import { Icon } from "./Icon";

interface Props {
  wsId: string;
  root: string;
  activeChatId: string | null;
  frozen?: boolean;
  /** Pixel width owned by AgentModeShell resize (persisted). */
  width: number;
  onOpenFile: (path: string) => void;
}

/** Agent Mode right column: Changes / Files / Plan / project Terminals. */
export function AgentContextColumn({
  wsId,
  root,
  activeChatId,
  frozen,
  width,
  onOpenFile,
}: Props) {
  const terminalsMap = useStore((s) => s.loaded[wsId]?.terminals);
  const terminals = terminalsMap ? Object.values(terminalsMap) : [];
  const closeTerminalStore = useStore((s) => s.closeTerminal);

  const [contextPanel, setLocalPanel] = useState<AgentContextPanel>(() =>
    getAgentContextPanel(wsId),
  );
  const [collapsed, setLocalCollapsed] = useState(isAgentContextCollapsed);
  useEffect(() => {
    setLocalPanel(getAgentContextPanel(wsId));
    return subscribeAgentContextPanel(() => {
      setLocalPanel(getAgentContextPanel(wsId));
      setLocalCollapsed(isAgentContextCollapsed());
    });
  }, [wsId]);

  // Picking a view from the collapsed rail also expands the column.
  const setContextPanel = useCallback(
    (panel: AgentContextPanel) => {
      setAgentContextCollapsed(false);
      setAgentContextPanel(wsId, panel);
    },
    [wsId],
  );

  const [addViewOpen, setAddViewOpen] = useState(false);
  const addViewRef = useRef<HTMLButtonElement>(null);
  const activeTermId = termIdOfPanel(contextPanel);

  const [planRev, setPlanRev] = useState(0);
  useEffect(() => subscribePlanBuyIn(() => setPlanRev((n) => n + 1)), []);

  const planBuyIn = useMemo(() => {
    void planRev;
    if (!activeChatId) return null;
    const session = getCachedSession(wsId, activeChatId);
    const sessionId = session
      ? readProviderSessionIds(session)["claude-code"]
      : undefined;
    return getPlanBuyIn({ chatId: activeChatId, sessionId });
  }, [planRev, activeChatId, wsId]);

  const hasPlan = !!planBuyIn?.plan;

  // Docs (.md/.mmd) seen in this chat's stream — tab appears only when non-empty.
  const [docs, setDocs] = useState(() => getChatDocs(activeChatId));
  useEffect(() => {
    setDocs(getChatDocs(activeChatId));
    return subscribeChatDocs(() => setDocs(getChatDocs(activeChatId)));
  }, [activeChatId]);
  const hasDocs = docs.length > 0;

  // Fall back when the Docs tab disappears (chat switch to one without docs).
  // Selection only — must NOT expand a collapsed rail.
  useEffect(() => {
    if (hasDocs) return;
    if (getAgentContextPanel(wsId) !== "docs") return;
    setAgentContextPanel(wsId, "changes");
  }, [hasDocs, wsId]);

  // Hide Plan tab when buy-in clears; fall back if it was selected.
  useEffect(() => {
    if (hasPlan) return;
    if (getAgentContextPanel(wsId) !== "plan") return;
    setAgentContextPanel(wsId, "changes");
  }, [hasPlan, wsId]);

  // Terminal closed elsewhere → reselect without expanding a collapsed rail.
  useEffect(() => {
    if (!activeTermId || !terminalsMap) return;
    if (terminalsMap[activeTermId]) return;
    const ids = Object.keys(terminalsMap);
    setAgentContextPanel(
      wsId,
      ids.length ? termPanelOf(ids[ids.length - 1]) : "changes",
    );
  }, [activeTermId, terminalsMap, wsId]);

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

  // Collapsed default (Cursor-style): thin icon rail, panes stay mounted below.
  if (collapsed) {
    return (
      <aside className="agent-context agent-context--rail">
        <div className="agent-context-rail" aria-label="Workspace context">
          <button
            ref={addViewRef}
            type="button"
            className="agent-context-rail-btn"
            title="Add view"
            aria-label="Add view"
            aria-haspopup="menu"
            aria-expanded={addViewOpen}
            onClick={() => setAddViewOpen((v) => !v)}
          >
            <Icon name="plus" size={15} />
          </button>
          <button
            type="button"
            className="agent-context-rail-btn"
            title="Changes"
            aria-label="Changes"
            onClick={() => setContextPanel("changes")}
          >
            <Icon name="git-branch" size={15} />
          </button>
          <button
            type="button"
            className="agent-context-rail-btn"
            title="Files"
            aria-label="Files"
            onClick={() => setContextPanel("files")}
          >
            <Icon name="folder" size={15} />
          </button>
          {hasDocs && (
            <button
              type="button"
              className="agent-context-rail-btn"
              title={`Docs (${docs.length})`}
              aria-label="Docs"
              onClick={() => setContextPanel("docs")}
            >
              <Icon name="file-text" size={15} />
            </button>
          )}
          {hasPlan && (
            <button
              type="button"
              className="agent-context-rail-btn"
              title="Plan"
              aria-label="Plan"
              onClick={() => setContextPanel("plan")}
            >
              <Icon name="check-square" size={15} />
            </button>
          )}
          <button
            type="button"
            className="agent-context-rail-btn"
            title="Terminal"
            aria-label="Terminal"
            onClick={() =>
              terminals.length > 0
                ? setContextPanel(termPanelOf(terminals[terminals.length - 1].id))
                : createTerminal()
            }
          >
            <Icon name="terminal" size={15} />
          </button>
        </div>
        <AgentAddViewMenu
          open={addViewOpen}
          anchor={addViewRef.current}
          onClose={() => setAddViewOpen(false)}
          onAddTerminal={createTerminal}
        />
      </aside>
    );
  }

  return (
    <aside
      className={`agent-context${frozen ? " is-chat-switch-frozen" : ""}`}
      style={{ width, flexBasis: width }}
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
          {hasDocs && (
            <button
              className={`agent-context-tab agent-context-tab--plan ${contextPanel === "docs" ? "active" : ""}`}
              role="tab"
              aria-selected={contextPanel === "docs"}
              onClick={() => setContextPanel("docs")}
              title="Documentation touched in this chat"
            >
              <Icon name="file-text" size={12} />
              <span className="agent-context-tab-label">Docs</span>
            </button>
          )}
          {hasPlan && (
            <button
              className={`agent-context-tab agent-context-tab--plan ${contextPanel === "plan" ? "active" : ""}`}
              role="tab"
              aria-selected={contextPanel === "plan"}
              onClick={() => setContextPanel("plan")}
              title="Plan"
            >
              <Icon name="check-square" size={12} />
              <span className="agent-context-tab-label">Plan</span>
            </button>
          )}
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
        <button
          type="button"
          className="agent-context-add"
          title="Collapse panel"
          aria-label="Collapse panel"
          onClick={() => setAgentContextCollapsed(true)}
        >
          <Icon name="chevron-right" size={14} />
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
        {hasDocs && (
          <div
            className="agent-context-pane"
            style={{ display: contextPanel === "docs" ? "flex" : "none" }}
          >
            <AgentDocsPanel wsId={wsId} root={root} docs={docs} />
          </div>
        )}
        {hasPlan && planBuyIn && (
          <div
            className="agent-context-pane"
            style={{ display: contextPanel === "plan" ? "flex" : "none" }}
          >
            <AgentPlanPane plan={planBuyIn.plan} />
          </div>
        )}
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
