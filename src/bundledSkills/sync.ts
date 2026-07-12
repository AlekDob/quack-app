// Write app-bundled skills into the workspace so Claude Code can invoke them.

import { fs } from "../ipc";
import { joinPath } from "../pathUtils";
import { frontmatterField } from "../subagents";
import {
  APP_BUNDLED_SKILLS,
  QUACK_BUNDLED_VERSION_FIELD,
  type AppBundledSkill,
} from "./index";

function diskBundledVersion(existing: string): number {
  const raw = frontmatterField(existing, QUACK_BUNDLED_VERSION_FIELD);
  return raw ? Number.parseInt(raw, 10) : 0;
}

async function ensureOne(root: string, skill: AppBundledSkill): Promise<string> {
  const skillDir = joinPath(root, ".claude", "skills", skill.dirName);
  const path = joinPath(skillDir, "SKILL.md");
  let existing: string | null = null;
  try {
    existing = await fs.readFile(path);
  } catch {
    /* first seed */
  }
  if (existing && diskBundledVersion(existing) >= skill.version) return path;
  await fs.createDir(skillDir);
  await fs.writeFile(path, skill.content);
  return path;
}

/** Retired app skills — remove seeded copies so slash menu stays at two skills. */
const RETIRED_APP_SKILLS = ["feature-creator"];

async function retireBundledSkills(root: string): Promise<void> {
  for (const name of RETIRED_APP_SKILLS) {
    const path = joinPath(root, ".claude", "skills", name, "SKILL.md");
    try {
      await fs.delete(path);
    } catch {
      /* already gone */
    }
  }
}

/** Idempotent — seeds or upgrades Quack-owned skills under `.claude/skills/`. */
export async function ensureAppBundledSkills(root: string): Promise<void> {
  await fs.createDir(joinPath(root, ".claude", "skills"));
  await retireBundledSkills(root);
  for (const skill of APP_BUNDLED_SKILLS) {
    await ensureOne(root, skill);
  }
}
