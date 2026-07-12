// Skill discovery for the `/`-command composer. Claude Code skills are
// folders containing a `SKILL.md` (with YAML frontmatter) under
// `.claude/skills/` — both project-local (<workspace>/.claude/skills) and
// user-global (~/.claude/skills). We surface them in the slash menu so the
// user can pick one with `/skill-name`, the same way the CLI invokes it.
//
// Parallel to subagents.ts (the @-mention loader); reuses its frontmatter
// reader so there's one place that parses `.claude/` asset metadata.
import { fs, type DirEntry } from "./ipc";
import { frontmatterField } from "./subagents";

export interface SkillDef {
  /** Slug used as `/name`, e.g. "code" / "feature-creator". */
  name: string;
  description: string;
  source: "project" | "user" | "bundled";
  /** Absolute path to the SKILL.md backing this skill. Used by the
   *  whiteboard click-to-open action. */
  path: string;
}

// First meaningful prose line of a SKILL.md that lacks a `description:`
// frontmatter field — skip the frontmatter block and the H1 title.
function firstParagraph(src: string): string {
  const body = src.replace(/^---\n[\s\S]*?\n---\n?/, "");
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    return line;
  }
  return "";
}

function parseSkill(
  src: string,
  dirName: string,
  source: SkillDef["source"],
  path: string,
): SkillDef {
  const name = frontmatterField(src, "name") ?? dirName;
  const description =
    frontmatterField(src, "description") ?? firstParagraph(src);
  // Keep slash rows tidy — the full description lives in the skill itself.
  return { name, description: description.slice(0, 120), source, path };
}

async function readSkillsDir(
  dir: string,
  source: SkillDef["source"],
): Promise<SkillDef[]> {
  let entries: DirEntry[];
  try {
    entries = await fs.listDir(dir);
  } catch {
    return []; // directory doesn't exist — fine
  }
  const out: SkillDef[] = [];
  for (const e of entries) {
    if (!e.is_dir) continue; // each skill is a folder with a SKILL.md inside
    try {
      const md = await fs.readFile(`${e.path}/SKILL.md`);
      out.push(parseSkill(md, e.name, source, `${e.path}/SKILL.md`));
    } catch {
      /* no SKILL.md (not a skill folder) — skip */
    }
  }
  return out;
}

/**
 * Load all available skills. Project skills win name collisions over
 * user-global ones; bundled repo skills (`documentation/skills/`) are lowest.
 */
export async function loadSkills(
  root: string,
  homeDir: string | null,
): Promise<SkillDef[]> {
  const proj = await readSkillsDir(`${root}/.claude/skills`, "project");
  const user = homeDir
    ? await readSkillsDir(`${homeDir}/.claude/skills`, "user")
    : [];
  const bundled = await readSkillsDir(`${root}/documentation/skills`, "bundled");
  const seen = new Set(proj.map((s) => s.name));
  const userFiltered = user.filter((s) => !seen.has(s.name));
  for (const s of userFiltered) seen.add(s.name);
  const bundledFiltered = bundled.filter((s) => !seen.has(s.name));
  return [...proj, ...userFiltered, ...bundledFiltered];
}
