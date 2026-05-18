/**
 * Codex prompt composer.
 *
 * Codex `exec` has NO native slash-command expansion (openai/codex#3641) and
 * NO native skill discovery (verified 2026-05-17 spike: it only `ls`/`cat`s
 * `.agents/skills` as plain files, zero skill events). The Claude path gets
 * both for free from the Claude Agent SDK CLI (`settingSources` + `Skill`
 * tool, see claudeSDK.ts). To reach agent-level UX parity WITHOUT
 * reimplementing the harness, Quack composes the equivalent context into the
 * Codex prompt itself — pure prompt composition, exactly the Quack-owned
 * layer per the agent-level abstraction decision.
 *
 * Imported ONLY from the `backend === 'codex'` send branch, so the Claude
 * path is byte-identical and never touches this module.
 *
 * Brain: decision-quack-abstraction-agent-level-not-model-level
 * Brain: pattern-backend-capability-gated-ui
 */
import { invoke } from '@tauri-apps/api/core';
import type { SlashCommand, SlashCommandsResponse } from '../hooks/useSlashCommands';
import type { SkillInfo } from '../types';

const COMMAND_PATTERN = /^\/([a-zA-Z][a-zA-Z0-9_-]*)/gm;

/**
 * Expand `/command` references into <command-context> blocks. Mirrors the
 * canonical format of `useSlashCommands.expandCommandsInMessage` (kept in
 * sync; that hook copy is unused in the live send path — the Claude SDK CLI
 * expands natively, so only the Codex backend needs this).
 */
export function expandSlashCommands(
  message: string,
  commands: SlashCommand[],
): { expandedMessage: string; commandsFound: string[] } {
  const found: string[] = [];
  const contexts: string[] = [];
  let match: RegExpExecArray | null;
  COMMAND_PATTERN.lastIndex = 0;
  while ((match = COMMAND_PATTERN.exec(message)) !== null) {
    const name = match[1];
    if (found.includes(name)) continue;
    const cmd = commands.find((c) => c.name === name);
    if (cmd && cmd.content) {
      found.push(name);
      contexts.push(
        `<command-context name="${name}" description="${cmd.description}">`,
        cmd.content,
        `</command-context>`,
      );
    }
  }
  if (found.length === 0) return { expandedMessage: message, commandsFound: [] };
  return {
    expandedMessage: `${contexts.join('\n\n')}\n\n---\n\n${message}`,
    commandsFound: found,
  };
}

/** Load project + global slash commands (best-effort, never throws). */
async function loadCommands(basePath: string): Promise<SlashCommand[]> {
  try {
    const res = await invoke<SlashCommandsResponse>('list_slash_commands', { basePath });
    return [...res.builtin, ...res.custom];
  } catch (err) {
    console.warn('[codexPromptComposer] command load failed:', err);
    return [];
  }
}

/**
 * Build an <available-skills> index (name + description + path) for the
 * agent's selected skills. We inject the INDEX, not full bodies: the
 * 2026-05-17 spike showed Codex will `cat` a SKILL.md by path when told it
 * exists — reproducing Claude's progressive disclosure without prompt bloat.
 * Autonomous discovery across ALL skills stays Claude-only (capability gate).
 */
async function buildSkillsIndex(
  basePath: string,
  selectedSkills: string[],
): Promise<string> {
  if (selectedSkills.length === 0) return '';
  let skills: SkillInfo[] = [];
  try {
    skills = await invoke<SkillInfo[]>('list_skills', { workingDir: basePath });
  } catch (err) {
    console.warn('[codexPromptComposer] skill load failed:', err);
    return '';
  }
  const picked = skills.filter((s) => selectedSkills.includes(s.name));
  if (picked.length === 0) return '';
  const lines = picked.map(
    (s) => `- **${s.name}**: ${s.description || 'no description'} (read: \`${s.file_path}\`)`,
  );
  return [
    '<available-skills>',
    'You have these Quack skills available. When a task matches a skill, read',
    'its SKILL.md at the given path (e.g. `cat <path>`) and follow it.',
    ...lines,
    '</available-skills>',
  ].join('\n');
}

export interface ComposeCodexPromptArgs {
  message: string;
  basePath: string;
  selectedSkills?: string[];
}

/**
 * Codex-only: compose slash-command + skill context into the prompt — the
 * equivalent of what the Claude Agent SDK CLI does natively for Claude.
 * Best-effort: on any failure it returns the original message unchanged so a
 * Codex turn never breaks because of composition.
 */
export async function composeCodexPrompt(args: ComposeCodexPromptArgs): Promise<string> {
  const { message } = args;
  const basePath = args.basePath;
  const selectedSkills = args.selectedSkills ?? [];
  if (!basePath) return message;

  const commands = await loadCommands(basePath);
  const { expandedMessage, commandsFound } = expandSlashCommands(message, commands);
  const skillsIndex = await buildSkillsIndex(basePath, selectedSkills);

  if (commandsFound.length === 0 && !skillsIndex) return message;

  const blocks: string[] = [];
  if (skillsIndex) blocks.push(skillsIndex);
  blocks.push(expandedMessage); // already includes command-contexts + message
  return blocks.join('\n\n');
}
