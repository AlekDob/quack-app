// Cursor-style inline mention chips inside the composer input row.

import { fileIconName } from "../fileIcons";
import { openBrainDoc } from "../brainInject";
import type { AttachedBrainHit } from "../brainMention";
import type { SubagentDef } from "../subagents";
import type { SkillDef } from "../skills";
import { basename, relPath } from "../pathUtils";
import { Icon } from "./Icon";

export type ComposerMentionChip =
  | { kind: "brain"; hit: AttachedBrainHit }
  | { kind: "file"; abs: string; rel: string }
  | { kind: "agent"; agent: SubagentDef }
  | { kind: "skill"; skill: SkillDef };

type Props = {
  wsId: string;
  root: string;
  brainHits: AttachedBrainHit[];
  files: string[];
  agents: SubagentDef[];
  attachedAgentNames: string[];
  skill: SkillDef | null;
  onRemoveBrain: (path: string) => void;
  onRemoveFile: (abs: string) => void;
  onRemoveAgent: (name: string) => void;
  onRemoveSkill: () => void;
};

export function ComposerMentionChips({
  wsId,
  root,
  brainHits,
  files,
  agents,
  attachedAgentNames,
  skill,
  onRemoveBrain,
  onRemoveFile,
  onRemoveAgent,
  onRemoveSkill,
}: Props) {
  const chips: ComposerMentionChip[] = [];
  for (const hit of brainHits) chips.push({ kind: "brain", hit });
  for (const abs of files) {
    chips.push({ kind: "file", abs, rel: relPath(abs, root) });
  }
  for (const name of attachedAgentNames) {
    const agent = agents.find((a) => a.name === name);
    if (agent) chips.push({ kind: "agent", agent });
  }
  if (skill) chips.push({ kind: "skill", skill });

  if (chips.length === 0) return null;

  return (
    <div className="composer-mention-chips" aria-label="Mentions">
      {chips.map((chip) => (
        <MentionChip
          key={chipKey(chip)}
          chip={chip}
          wsId={wsId}
          root={root}
          onRemove={() => removeChip(chip, {
            onRemoveBrain,
            onRemoveFile,
            onRemoveAgent,
            onRemoveSkill,
          })}
        />
      ))}
    </div>
  );
}

function chipKey(chip: ComposerMentionChip): string {
  switch (chip.kind) {
    case "brain":
      return `brain:${chip.hit.path}`;
    case "file":
      return `file:${chip.abs}`;
    case "agent":
      return `agent:${chip.agent.name}`;
    case "skill":
      return `skill:${chip.skill.name}`;
  }
}

function removeChip(
  chip: ComposerMentionChip,
  handlers: {
    onRemoveBrain: (path: string) => void;
    onRemoveFile: (abs: string) => void;
    onRemoveAgent: (name: string) => void;
    onRemoveSkill: () => void;
  },
): void {
  switch (chip.kind) {
    case "brain":
      handlers.onRemoveBrain(chip.hit.path);
      break;
    case "file":
      handlers.onRemoveFile(chip.abs);
      break;
    case "agent":
      handlers.onRemoveAgent(chip.agent.name);
      break;
    case "skill":
      handlers.onRemoveSkill();
      break;
  }
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
  const variant = chip.kind;
  const label =
    chip.kind === "brain"
      ? chip.hit.title
      : chip.kind === "file"
        ? basename(chip.abs)
        : chip.kind === "agent"
          ? chip.agent.name
          : chip.skill.name;

  const onOpen =
    chip.kind === "brain"
      ? () => void openBrainDoc(wsId, root, chip.hit.path)
      : undefined;

  return (
    <span className={`composer-mention-chip composer-mention-chip--${variant}`}>
      {chip.kind === "agent" ? (
        <img
          className="composer-mention-chip-avatar"
          src={chip.agent.avatar}
          alt=""
          aria-hidden="true"
        />
      ) : (
        <span className="composer-mention-chip-icon" aria-hidden>
          <Icon
            name={
              chip.kind === "brain"
                ? "brain"
                : chip.kind === "skill"
                  ? "zap"
                  : fileIconName(basename(chip.abs))
            }
            size={12}
          />
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
