import { useState } from "react";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";
import type { SubagentDef } from "../subagents";

// Composer pill that shows who the next message is addressed to. Default is
// Jack (the built-in assistant, feature 005); picking a discovered subagent
// delegates the turn to it. The active agent is DERIVED from the composer's
// attachedAgents set upstream — this component owns no delegation state, it
// just renders the choice and reports selections back.

interface SubagentPillProps {
  agents: SubagentDef[];
  /** The subagent the turn is currently addressed to, or null for Jack. */
  active: SubagentDef | null;
  /** null = reset to Jack (clear delegation). */
  onSelect: (agent: SubagentDef | null) => void;
  disabled?: boolean;
}

export function SubagentPill({
  agents,
  active,
  onSelect,
  disabled,
}: SubagentPillProps) {
  const [open, setOpen] = useState(false);
  // No subagents discovered (non-Claude-Code, or none defined): the pill is
  // pure Jack branding with no menu to open.
  const hasMenu = agents.length > 0 && !disabled;

  const pick = (agent: SubagentDef | null) => {
    onSelect(agent);
    setOpen(false);
  };

  return (
    <div className="ai-agent-wrap">
      {open && hasMenu && (
        <>
          <div className="ai-mode-backdrop" onClick={() => setOpen(false)} />
          <div className="ai-agent-menu" role="menu">
            <button
              type="button"
              className={`ai-agent-item ${active === null ? "active" : ""}`}
              onClick={() => pick(null)}
            >
              <span className="ai-agent-item-mark">
                <AIIcon size={18} />
              </span>
              <span className="ai-agent-item-text">
                <span className="ai-agent-item-name">Jack</span>
                <span className="ai-agent-item-role">Default assistant</span>
              </span>
            </button>
            {agents.map((a) => (
              <button
                key={a.name}
                type="button"
                className={`ai-agent-item ${active?.name === a.name ? "active" : ""}`}
                onClick={() => pick(a)}
              >
                <img
                  className="ai-agent-item-mark"
                  src={a.avatar}
                  alt=""
                  aria-hidden="true"
                />
                <span className="ai-agent-item-text">
                  <span className="ai-agent-item-name">{a.name}</span>
                  <span className="ai-agent-item-role">
                    {a.description
                      ? a.description.slice(0, 48)
                      : `subagent · ${a.source}`}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        className="ai-agent-pill"
        onClick={() => hasMenu && setOpen((v) => !v)}
        disabled={!hasMenu}
        title={hasMenu ? "Address this message to a subagent" : "Jack"}
      >
        {active ? (
          <img
            className="ai-agent-avatar"
            src={active.avatar}
            alt=""
            aria-hidden="true"
          />
        ) : (
          <span className="ai-agent-avatar ai-agent-avatar-jack">
            <AIIcon size={16} />
          </span>
        )}
        <span className="ai-agent-name">{active ? active.name : "Jack"}</span>
        <span className="ai-agent-role">· {active ? "Agent" : "PM"}</span>
        {hasMenu && <Icon name="chevron-down" size={13} />}
      </button>
    </div>
  );
}
