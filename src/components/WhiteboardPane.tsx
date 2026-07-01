// Whiteboard tab — the per-workspace org-chart view. One persistent tab
// per workspace, mounted via portal into the active pane by
// WorkspaceShell (mirrors how SubagentTranscriptView is mounted).
//
// Three sub-tabs share the same agent+skill data:
//   1. Overview — counters + entry points (Open Instructions, create agent).
//   2. Organigramma — vertical tree, drag a skill chip onto an agent to
//      write `skills:` into its .md frontmatter; × on a chip to unlink.
//   3. Workflows — live preview of the operational .md + Copy / Save.
//
// All state is local (no global store). On mount + on data invalidation
// we re-load from disk; on successful writes we reload + notify the
// sub-tabs so the organigramma + preview re-render.
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";
import { useStore } from "../store";
import { loadSkills, type SkillDef } from "../skills";
import { loadSubagents, type SubagentDef } from "../subagents";
import { renderWhiteboardMd } from "../whiteboardMd";
import { MarkdownPreview } from "./MarkdownPreview";
import { success as toastSuccess, error as toastError, errMsg } from "../notify";
import { joinPath } from "../pathUtils";
import { WhiteboardOrganigramma } from "./WhiteboardOrganigramma";

interface Props {
  wsId: string;
  root: string;
  /** Pane DOM node to portal into. Null when the tab isn't active. */
  container: HTMLElement | null;
  /** Whether the host pane is currently focused & visible. */
  visible: boolean;
}

type SubTab = "overview" | "organigramma" | "workflows";

export interface WhiteboardData {
  agents: SubagentDef[];
  skills: SkillDef[];
}

export function WhiteboardPane({ wsId, root, container, visible }: Props) {
  const [subTab, setSubTab] = useState<SubTab>("organigramma");
  const [data, setData] = useState<WhiteboardData>({
    agents: [],
    skills: [],
  });
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const ws = useStore((s) => s.loaded[wsId]);
  const workspaceName = ws?.meta.name ?? "Workspace";

  // Reload both lists (project + user) on mount and whenever reloadKey
  // bumps (i.e. after a successful drag-and-drop write).
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const pathMod = await import("@tauri-apps/api/path");
      const home = await pathMod.homeDir();
      const [agents, skills] = await Promise.all([
        loadSubagents(root, home),
        loadSkills(root, home),
      ]);
      setData({ agents, skills });
    } catch (e) {
      toastError(`Couldn't load whiteboard data: ${errMsg(e)}`);
    } finally {
      setLoading(false);
    }
  }, [root]);

  useEffect(() => {
    void refresh();
  }, [refresh, reloadKey]);

  const onSkillsChanged = useCallback(() => setReloadKey((k) => k + 1), []);

  // Markdown body — recomputed whenever agents/skills reload.
  const md = useMemo(
    () =>
      renderWhiteboardMd({
        workspaceName,
        agents: data.agents,
        skills: data.skills,
      }),
    [workspaceName, data],
  );

  if (!container || !visible) return null;

  const tabs: { id: SubTab; label: string }[] = [
    { id: "organigramma", label: "Organigramma" },
    { id: "overview", label: "Overview" },
    { id: "workflows", label: "Workflows" },
  ];

  return createPortal(
    <div className="whiteboard-root">
      <div className="whiteboard-subtabs" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            className={`whiteboard-subtab ${subTab === t.id ? "active" : ""}`}
            role="tab"
            aria-selected={subTab === t.id}
            onClick={() => setSubTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        <span className="whiteboard-subtabs-spacer" />
        {loading && <span className="whiteboard-status">Loading…</span>}
      </div>

      <div className="whiteboard-body">
        {subTab === "overview" && (
          <WhiteboardOverview
            ws={workspaceName}
            root={root}
            data={data}
            onJumpOrganigramma={() => setSubTab("organigramma")}
            onJumpWorkflows={() => setSubTab("workflows")}
          />
        )}
        {subTab === "organigramma" && (
          <WhiteboardOrganigramma
            wsId={wsId}
            root={root}
            data={data}
            onMutated={onSkillsChanged}
          />
        )}
        {subTab === "workflows" && (
          <WhiteboardWorkflows root={root} md={md} data={data} />
        )}
      </div>
    </div>,
    container,
  );
}

// ── Overview ─────────────────────────────────────────────────────────
function WhiteboardOverview({
  ws,
  root,
  data,
  onJumpOrganigramma,
  onJumpWorkflows,
}: {
  ws: string;
  root: string;
  data: WhiteboardData;
  onJumpOrganigramma: () => void;
  onJumpWorkflows: () => void;
}) {
  const projectAgents = data.agents.filter((a) => a.source === "project");
  const userAgents = data.agents.filter((a) => a.source === "user");
  const projectSkills = data.skills.filter((s) => s.source === "project");
  const userSkills = data.skills.filter((s) => s.source === "user");
  const isEmpty = data.agents.length === 0 && data.skills.length === 0;
  const counterStyle: CSSProperties = {
    textAlign: "center",
    padding: "16px 12px",
    borderRadius: "var(--radius-md)",
    background: "var(--bg-alt)",
    border: "1px solid var(--border)",
    minWidth: 120,
  };
  return (
    <div className="whiteboard-overview">
      <div className="whiteboard-overview-head">
        <div className="whiteboard-overview-title">{ws}</div>
        <div className="whiteboard-overview-sub">
          <code>{root}</code>
        </div>
      </div>

      {isEmpty ? (
        <div className="whiteboard-empty">
          <AIIcon size={28} />
          <div className="whiteboard-empty-title">
            Nothing here yet — that's OK.
          </div>
          <div className="whiteboard-empty-hint">
            Create your first subagent from the <em>Agent Customizations</em>
            modal's <em>Skills</em> tab (it can also scaffold an{" "}
            <em>Agents</em> section), or drop a <code>.md</code> file into{" "}
            <code>.claude/agents/</code>.
          </div>
          <div className="whiteboard-empty-row">
            <button
              className="cust-btn primary"
              onClick={onJumpOrganigramma}
            >
              <Icon name="whiteboard" size={12} /> Open Organigramma
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            className="whiteboard-overview-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <div style={counterStyle}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: "var(--fg)",
                }}
              >
                {data.agents.length}
              </div>
              <div className="whiteboard-counter-label">subagents</div>
              <div className="whiteboard-counter-sub">
                {projectAgents.length} project · {userAgents.length} global
              </div>
            </div>
            <div style={counterStyle}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: "var(--fg)",
                }}
              >
                {data.skills.length}
              </div>
              <div className="whiteboard-counter-label">skills</div>
              <div className="whiteboard-counter-sub">
                {projectSkills.length} project · {userSkills.length} global
              </div>
            </div>
            <div style={counterStyle}>
              <div
                style={{
                  fontSize: 24,
                  fontWeight: 600,
                  color: "var(--fg)",
                }}
              >
                {data.agents.reduce((n, a) => n + a.skills.length, 0)}
              </div>
              <div className="whiteboard-counter-label">links</div>
              <div className="whiteboard-counter-sub">
                skill ↔ agent bindings
              </div>
            </div>
          </div>

          <div className="whiteboard-overview-actions">
            <button className="cust-btn" onClick={onJumpOrganigramma}>
              <Icon name="git-branch" size={12} /> View organigramma
            </button>
            <button className="cust-btn" onClick={onJumpWorkflows}>
              <Icon name="file-text" size={12} /> Open workflows .md
            </button>
          </div>
        </>
      )}

      <WhiteboardLegend />
    </div>
  );
}

function WhiteboardLegend() {
  return (
    <div className="whiteboard-legend">
      <div className="whiteboard-legend-title">How to use this tab</div>
      <ul>
        <li>
          <strong>Organigramma</strong> — drag a skill chip onto an agent to
          link them. Click the <code>×</code> on a chip to unlink.
        </li>
        <li>
          <strong>Workflows</strong> — preview the operational .md, copy it to
          your clipboard, or save it to <code>.codetta/whiteboard.md</code>.
        </li>
        <li>
          All edits write the <code>skills:</code> frontmatter of the agent's{" "}
          <code>.md</code> file — reviewable in git, easy to hand-edit.
        </li>
      </ul>
    </div>
  );
}

// ── Workflows ────────────────────────────────────────────────────────
function WhiteboardWorkflows({
  root,
  md,
  data,
}: {
  root: string;
  md: string;
  data: WhiteboardData;
}) {
  const savedAtRef = useRef<string | null>(null);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(md);
      toastSuccess("Whiteboard copied to clipboard");
    } catch (e) {
      toastError(`Couldn't copy: ${errMsg(e)}`);
    }
  };
  const onSave = async () => {
    try {
      const dir = joinPath(root, ".codetta");
      if (!(await (await import("../ipc")).fs.exists(dir))) {
        await (await import("../ipc")).fs.createDir(dir);
      }
      const filePath = joinPath(root, ".codetta", "whiteboard.md");
      await (await import("../ipc")).fs.writeFile(filePath, md);
      savedAtRef.current = new Date().toISOString();
      toastSuccess(`Saved to ${filePath}`);
    } catch (e) {
      toastError(`Couldn't save: ${errMsg(e)}`);
    }
  };
  return (
    <div className="whiteboard-workflows">
      <div className="whiteboard-workflows-bar">
        <div className="whiteboard-workflows-info">
          <strong>Workflows.md</strong> — {data.agents.length} agents,{" "}
          {data.skills.length} skills.
        </div>
        <div className="whiteboard-workflows-actions">
          <button className="cust-btn" onClick={() => void onCopy()}>
            <Icon name="copy" size={12} /> Copy as Markdown
          </button>
          <button
            className="cust-btn primary"
            onClick={() => void onSave()}
          >
            <Icon name="save" size={12} /> Save to .codetta/whiteboard.md
          </button>
        </div>
      </div>
      <div className="whiteboard-workflows-preview">
        <MarkdownPreview content={md} />
      </div>
    </div>
  );
}
