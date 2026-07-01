// Workspace AI rules loader — reads optional persistent instructions
// from the workspace and prepends them to the system prompt for ALL
// providers, not just Claude Code.
//
// Why this exists: Claude Code already auto-loads CLAUDE.md natively.
// Anthropic API / OpenAI / Ollama users had no equivalent — opening a
// chat in a Django project gave the model no idea about Django
// conventions, project-specific patterns, or "always do X here"
// preferences. This module closes that gap so the same rules apply
// regardless of which provider the user picks.
//
// File search order (first hit wins):
//   1. .codetta/rules.md   — explicitly Codetta's, takes precedence so
//                            users can override CLAUDE.md per-editor
//   2. CLAUDE.md           — shared with the Claude Code CLI; common
//                            case for users who already authored it
//   3. .cursorrules        — Cursor-style; lets users migrating from
//                            Cursor reuse what they had
//   4. .cursor/rules.md    — newer Cursor convention (multi-file rules
//                            collapse to the first one found)
//
// Truncated to MAX_RULES_BYTES so a runaway rules file can't blow up
// the system prompt and burn unexpected tokens.

import { fs } from "./ipc";
import { matchExclusion } from "./aiPrivacy";

const RULES_PATHS = [
  ".codetta/rules.md",
  "CLAUDE.md",
  ".cursorrules",
  ".cursor/rules.md",
] as const;

const MAX_RULES_BYTES = 16 * 1024;

export interface LoadedRules {
  /** Workspace-relative path of the file we read. */
  source: string;
  /** Absolute path, for the "open this file" affordance in the UI. */
  absolutePath: string;
  /** Rules text, possibly truncated. Empty string if the file existed
   *  but had no useful content. */
  text: string;
  /** True when MAX_RULES_BYTES was hit and the body got truncated. */
  truncated: boolean;
  /** Full trimmed size in chars (BEFORE truncation) — drives the header
   *  token-weight indicator, which must reflect the real file, not the
   *  16 KB slice we inject for non-CC providers. */
  bytes: number;
}

function joinPath(root: string, rel: string): string {
  const r = root.replace(/\\/g, "/").replace(/\/+$/, "");
  return `${r}/${rel}`;
}

/**
 * Look for a rules file in the workspace and return its contents.
 * Returns null when no candidate exists. Respects AI privacy
 * exclusions — if the user has globbed the rules file path out (e.g.
 * `**​/CLAUDE.md` is in their exclusions for some reason), we silently
 * skip it instead of leaking the contents.
 *
 * fs.exists / fs.readFile both throw on permission errors; we swallow
 * those and try the next candidate so a partially-readable workspace
 * still makes progress.
 */
export async function loadWorkspaceRules(
  root: string,
): Promise<LoadedRules | null> {
  for (const rel of RULES_PATHS) {
    const abs = joinPath(root, rel);
    let exists = false;
    try {
      exists = await fs.exists(abs);
    } catch {
      continue;
    }
    if (!exists) continue;
    if (matchExclusion(abs)) {
      // The user explicitly excluded this path from AI uploads.
      // Skip silently and try the next candidate — eventually we
      // may surface a "rules file blocked by privacy rules" hint
      // in the UI, but for now treat it as "no rules."
      continue;
    }
    let raw: string;
    try {
      raw = await fs.readFile(abs);
    } catch {
      continue;
    }
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const truncated = trimmed.length > MAX_RULES_BYTES;
    return {
      source: rel,
      absolutePath: abs,
      text: truncated
        ? trimmed.slice(0, MAX_RULES_BYTES) + "\n\n[…rules truncated]"
        : trimmed,
      truncated,
      bytes: trimmed.length,
    };
  }
  return null;
}
