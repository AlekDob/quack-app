// Whiteboard organigramma — vertical tree: Jack (root) → configurable
// Presets → delegable subagents. Click an agent/preset to open its .md;
// click Jack or a preset card to edit it (same drawer for both — Jack has
// no backing file either, so his edits persist as an override layer too).
//
// Skill linking (drag a skill chip onto an agent) was removed — it added a
// wall of "unassigned skills" clutter that obscured the actual org chart.
// Skills still exist as a concept (Overview counters, Workflows .md export)
// but no longer render here.

import { useState } from "react";
import type { SubagentDef } from "../subagents";
import type { WhiteboardData } from "./WhiteboardPane";
import { openFileAndReveal } from "../revealInTree";
import { error as toastError } from "../notify";
import { AIIcon } from "./AIIcon";
import { WhiteboardPresetGroup } from "./WhiteboardPresets";
import { AgentCreateDrawer } from "./AgentCreateDrawer";
import { effectivePresetDefinition, getJackDefinition, type PresetDefinition } from "../presets";

interface Props {
  wsId: string;
  root: string;
  data: WhiteboardData;
  onMutated: () => void;
}

export function WhiteboardOrganigramma({ wsId, root, data, onMutated }: Props) {
  const { agents, presets } = data;
  const projectAgents = agents.filter((a) => a.source === "project");
  const userAgents = agents.filter((a) => a.source === "user");

  // One drawer instance shared by Jack's root card and every preset card —
  // both are "agents" in the same override-backed sense (see src/presets/).
  const [creating, setCreating] = useState(false);
  const [editingAgent, setEditingAgent] = useState<PresetDefinition | null>(null);
  const jackDef = effectivePresetDefinition(getJackDefinition());

  return (
    <div className="whiteboard-org">
      {/* Root — Jack. He IS the planner: presets below cover the rest. */}
      <div className="whiteboard-org-root-row">
        <div
          className="whiteboard-org-root"
          onClick={() => setEditingAgent(jackDef)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setEditingAgent(jackDef);
            }
          }}
          title="Click to edit Jack — model, effort, mode, instructions"
        >
          <AIIcon size={36} />
          <div className="whiteboard-org-root-text">
            <div className="whiteboard-org-root-name">{jackDef.label}</div>
            <div className="whiteboard-org-role">{jackDef.role}</div>
          </div>
        </div>
        <div className="whiteboard-org-stem" />
      </div>

      <WhiteboardPresetGroup
        root={root}
        presets={presets}
        onEdit={setEditingAgent}
        onCreate={() => setCreating(true)}
        onMutated={onMutated}
      />

      <AgentCreateDrawer
        open={creating || !!editingAgent}
        root={root}
        editing={editingAgent}
        onClose={() => {
          setCreating(false);
          setEditingAgent(null);
        }}
        onCreated={onMutated}
      />

      {agents.length === 0 && (
        <div className="whiteboard-empty">
          <AIIcon size={28} />
          <div className="whiteboard-empty-title">No subagents yet.</div>
          <div className="whiteboard-empty-hint">
            Add a <code>.md</code> file in <code>.claude/agents/</code> and it
            will appear here.
          </div>
        </div>
      )}

      {userAgents.length > 0 && (
        <OrgGroup wsId={wsId} title="Global subagents" agents={userAgents} />
      )}
      {projectAgents.length > 0 && (
        <OrgGroup wsId={wsId} title="Project subagents" agents={projectAgents} />
      )}
    </div>
  );
}

// ── Group (Project / Global) ─────────────────────────────────────────
function OrgGroup({
  wsId,
  title,
  agents,
}: {
  wsId: string;
  title: string;
  agents: SubagentDef[];
}) {
  return (
    <div className="whiteboard-org-group">
      <div className="whiteboard-org-group-title">{title}</div>
      <div className="whiteboard-org-group-agents">
        {agents.map((a) => (
          <AgentNode key={a.name} wsId={wsId} agent={a} />
        ))}
      </div>
    </div>
  );
}

// ── Single agent node — click to open its .md ────────────────────────
function AgentNode({ wsId, agent }: { wsId: string; agent: SubagentDef }) {
  const openAgentFile = () => {
    if (!agent.path) {
      toastError(`${agent.name} has no known file path.`);
      return;
    }
    void openFileAndReveal(wsId, agent.path);
  };

  return (
    <div
      className="whiteboard-org-agent"
      onClick={openAgentFile}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openAgentFile();
        }
      }}
      title={agent.path ?? `${agent.name} — click to open its .md file`}
    >
      <div className="whiteboard-org-agent-head">
        <img
          className="whiteboard-org-agent-avatar"
          src={agent.avatar}
          alt=""
          aria-hidden="true"
        />
        <div className="whiteboard-org-agent-meta">
          <div className="whiteboard-org-agent-name">{agent.name}</div>
          {agent.description && (
            <div className="whiteboard-org-agent-desc" title={agent.description}>
              {agent.description}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
