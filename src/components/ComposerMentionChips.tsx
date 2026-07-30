// Cursor-style mention chips above the composer textarea.
// Files, skills, and features render as colored inline text (ComposerInputHighlight).

import { openBrainDoc } from "../brainInject";
import type { AttachedBrainHit } from "../brainMention";
import type { SkillDef } from "../skills";
import type { SubagentDef } from "../subagents";
import { Icon } from "./Icon";

export type ComposerMentionChip =
  | { kind: "brain"; hit: AttachedBrainHit }
  | { kind: "agent"; agent: SubagentDef };

type Props = {
  wsId: string;
  root: string;
  brainHits: AttachedBrainHit[];
  agents: SubagentDef[];
  attachedAgentNames: string[];
  onRemoveBrain: (path: string) => void;
  onRemoveAgent: (name: string) => void;
};

export function ComposerMentionChips({
  wsId,
  root,
  brainHits,
  agents,
  attachedAgentNames,
  onRemoveBrain,
  onRemoveAgent,
}: Props) {
  const chips: ComposerMentionChip[] = [];
  for (const hit of brainHits) chips.push({ kind: "brain", hit });
  for (const name of attachedAgentNames) {
    const agent = agents.find((a) => a.name === name);
    if (agent) chips.push({ kind: "agent", agent });
  }

  if (chips.length === 0) return null;

  return (
    <div className="composer-mention-chips" aria-label="Mentions">
      {chips.map((chip) => (
        <MentionChip
          key={chipKey(chip)}
          chip={chip}
          wsId={wsId}
          root={root}
          onRemove={() =>
            chip.kind === "brain"
              ? onRemoveBrain(chip.hit.path)
              : onRemoveAgent(chip.agent.name)
          }
        />
      ))}
    </div>
  );
}

function chipKey(chip: ComposerMentionChip): string {
  return chip.kind === "brain"
    ? `brain:${chip.hit.path}`
    : `agent:${chip.agent.name}`;
}

function MentionChip({
  chip,
  wsId,
  root,
  onRemove,
}: {
  chip: ComposerMentionChip;
  wsId: string;
  root: string;
  onRemove: () => void;
}) {
  const label = chip.kind === "brain" ? chip.hit.title : chip.agent.name;
  const onOpen =
    chip.kind === "brain"
      ? () => void openBrainDoc(wsId, root, chip.hit.path)
      : undefined;

  return (
    <span className={`composer-mention-chip composer-mention-chip--${chip.kind}`}>
      {chip.kind === "agent" ? (
        <img
          className="composer-mention-chip-avatar"
          src={chip.agent.avatar}
          alt=""
          aria-hidden="true"
        />
      ) : (
        <span className="composer-mention-chip-icon" aria-hidden>
          <Icon name="brain" size={12} />
        </span>
      )}
      {onOpen ? (
        <button type="button" className="composer-mention-chip-label" onClick={onOpen}>
          {label}
        </button>
      ) : (
        <span className="composer-mention-chip-label">{label}</span>
      )}
      <button
        type="button"
        className="composer-mention-chip-remove"
        onClick={onRemove}
        aria-label={`Remove ${label}`}
        title="Remove"
      >
        <Icon name="x" size={10} />
      </button>
    </span>
  );
}

export function parseLeadingSkill(
  input: string,
  skills: SkillDef[],
): SkillDef | null {
  const t = input.trimStart();
  if (!t.startsWith("/")) return null;
  const m = t.match(/^\/([^\s/]+)/);
  if (!m) return null;
  return skills.find((s) => s.name === m[1]) ?? null;
}

export function stripLeadingSkill(input: string, skillName: string): string {
  const re = new RegExp(`^\\s*/${skillName}(?:\\s+|$)`);
  return input.replace(re, "").trimStart();
}
