import { useState } from "react";
import { AIIcon } from "./AIIcon";
import { Icon } from "./Icon";
import type { SubagentDef } from "../subagents";
import type { PresetDefinition } from "../presets";

// Composer pill that shows who the next message is addressed to. Default is
// Jack (the built-in assistant, feature 005). The dropdown lists ONLY
// primary agents — Jack + presets (Milo/Nora/Vera + custom), which shape
// THIS session (model/effort/instructions), no isolated context. Real
// Claude Code subagents are deliberately NOT listed here (that turned this
// into a technical catalog dump) — delegate to one by typing `@name` in the
// composer instead (MentionSuggestions, feature 004); `active`/`onSelect`
// stay wired so the pill face still reflects a text-delegated subagent.

interface SubagentPillProps {
  agents: SubagentDef[];
  /** The subagent the turn is currently addressed to (via @-mention), or
   *  null for Jack/preset. Not selectable from this dropdown anymore. */
  active: SubagentDef | null;
  /** null = reset to Jack (clear delegation). */
  onSelect: (agent: SubagentDef | null) => void;
  presets: PresetDefinition[];
  activePresetId: string | null;
  onSelectPreset: (id: string | null) => void;
}

export function SubagentPill({
  active,
  onSelect,
  presets,
  activePresetId,
  onSelectPreset,
}: SubagentPillProps) {
  const [open, setOpen] = useState(false);
  const activePreset = activePresetId
    ? (presets.find((p) => p.id === activePresetId) ?? null)
    : null;

  const pickJack = () => {
    onSelect(null);
    onSelectPreset(null);
    setOpen(false);
  };
  const pickPreset = (id: string) => {
    onSelectPreset(id);
    onSelect(null);
    setOpen(false);
  };

  return (
    <div className="ai-agent-wrap">
      {open && (
        <>
          <div className="ai-mode-backdrop" onClick={() => setOpen(false)} />
          <div className="ai-agent-menu" role="menu">
            <button
              type="button"
              className={`ai-agent-item ${!active && !activePreset ? "active" : ""}`}
              onClick={pickJack}
            >
              <span className="ai-agent-item-mark">
                <AIIcon size={18} />
              </span>
              <span className="ai-agent-item-text">
                <span className="ai-agent-item-name">Jack</span>
                <span className="ai-agent-item-role">Default assistant · Planner</span>
              </span>
            </button>
            {presets.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`ai-agent-item ${activePresetId === p.id ? "active" : ""}`}
                onClick={() => pickPreset(p.id)}
              >
                <img className="ai-agent-item-mark" src={p.avatar} alt="" aria-hidden="true" />
                <span className="ai-agent-item-text">
                  <span className="ai-agent-item-name">{p.label}</span>
                  <span className="ai-agent-item-role">{p.role}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        className="ai-agent-pill"
        onClick={() => setOpen((v) => !v)}
        title="Choose a primary agent — @-mention in the composer to delegate to a subagent"
      >
        {activePreset ? (
          <img className="ai-agent-avatar" src={activePreset.avatar} alt="" aria-hidden="true" />
        ) : active ? (
          <img className="ai-agent-avatar" src={active.avatar} alt="" aria-hidden="true" />
        ) : (
          <span className="ai-agent-avatar ai-agent-avatar-jack">
            <AIIcon size={16} />
          </span>
        )}
        <span className="ai-agent-name">
          {activePreset ? activePreset.label : active ? active.name : "Jack"}
        </span>
        <span className="ai-agent-role">
          · {activePreset ? activePreset.role : active ? "Agent" : "PM"}
        </span>
        <Icon name="chevron-down" size={13} />
      </button>
    </div>
  );
}
