// Subagent discovery for the @-mention composer. Claude Code subagents are
// markdown files with YAML frontmatter living in `.claude/agents/` — both
// project-local (<workspace>/.claude/agents) and user-global
// (~/.claude/agents). We surface them in the chat composer so the user can
// @-mention one and delegate a turn to it (see AIChatPanel send flow).
import { fs, type DirEntry } from "./ipc";

export interface SubagentDef {
  name: string;
  description: string;
  source: "project" | "user";
  /** Public URL of the duck avatar, e.g. "/images/ducks/duck12.jpeg". */
  avatar: string;
  /** Slugs of skills attached to this agent (from `skills:` frontmatter).
   *  Empty array when unset — agents without skills still appear in the
   *  organigramma, just without child leaves. */
  skills: string[];
  /** Absolute path to the .md file backing this agent. Needed by the
   *  whiteboard drag-and-drop to write back the frontmatter `skills:`
   *  list. Null when the file's location couldn't be resolved. */
  path: string | null;
}

// Number of duck avatars shipped in public/images/ducks/ (duck1..duckN).
const DUCK_COUNT = 35;

// Stable string hash → duck index. Same agent name always maps to the same
// duck, so an avatar never shuffles between sessions.
function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Resolve an agent's duck avatar. A frontmatter `avatar:` value wins —
 * it accepts "duck12", a bare "12", or a full "/path.png". Otherwise we
 * derive a deterministic duck from the agent name.
 */
export function duckAvatarFor(name: string, explicit?: string): string {
  if (explicit) {
    if (explicit.startsWith("/")) return explicit;
    const m = explicit.match(/(\d+)/);
    if (m) return `/images/ducks/duck${m[1]}.jpeg`;
  }
  const idx = (hashName(name) % DUCK_COUNT) + 1;
  return `/images/ducks/duck${idx}.jpeg`;
}

// Minimal frontmatter scalar reader. Agent/skill files use simple
// `key: value` lines, so a full YAML parser (and a new dependency) would be
// overkill; we only need a few top-level scalars. Shared with skills.ts.
export function frontmatterField(src: string, key: string): string | undefined {
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return undefined;
  const line = fm[1]
    .split("\n")
    .find((l) => l.trimStart().startsWith(`${key}:`));
  if (!line) return undefined;
  return line
    .slice(line.indexOf(":") + 1)
    .trim()
    .replace(/^["']|["']$/g, "");
}

/**
 * Read a YAML-ish list from frontmatter. Accepts both the block form
 *
 *   skills:
 *     - code-navigation
 *     - brand-guidelines
 *
 * and the inline form `skills: [code-navigation, brand-guidelines]`.
 * Quotes around items are stripped. Unset / empty → [].
 */
export function frontmatterList(src: string, key: string): string[] {
  const fm = src.match(/^---\n([\s\S]*?)\n---/);
  if (!fm) return [];
  const body = fm[1];
  const lines = body.split("\n");
  const keyIdx = lines.findIndex((l) => l.trimStart().startsWith(`${key}:`));
  if (keyIdx < 0) return [];
  const head = lines[keyIdx].slice(lines[keyIdx].indexOf(":") + 1).trim();
  // Inline form: `skills: [a, b, c]`
  if (head.startsWith("[") && head.endsWith("]")) {
    return head
      .slice(1, -1)
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  // Inline-form fallback: anything after the colon on the same line
  // (still useful if someone writes `skills: a, b` on one line).
  if (head && !head.startsWith("-")) {
    return head
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  // Block form: gather subsequent indented lines starting with `-`.
  const out: string[] = [];
  for (let i = keyIdx + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (raw.trim() === "") continue;
    // A non-indented, non-empty line ends the block.
    if (!/^\s/.test(raw)) break;
    const m = raw.match(/^\s*-\s*(.+?)\s*$/);
    if (!m) break; // malformed — don't guess
    out.push(m[1].replace(/^["']|["']$/g, ""));
  }
  return out;
}

// Parse one .md file into a SubagentDef, falling back to the filename.
function parseAgent(
  src: string,
  fileName: string,
  source: SubagentDef["source"],
  path: string,
): SubagentDef {
  const name = frontmatterField(src, "name") ?? fileName.replace(/\.md$/, "");
  return {
    name,
    description: frontmatterField(src, "description") ?? "",
    source,
    avatar: duckAvatarFor(name, frontmatterField(src, "avatar")),
    skills: frontmatterList(src, "skills"),
    path,
  };
}

async function readAgentDir(
  dir: string,
  source: SubagentDef["source"],
): Promise<SubagentDef[]> {
  let entries: DirEntry[];
  try {
    entries = await fs.listDir(dir);
  } catch {
    return []; // directory doesn't exist — fine
  }
  const out: SubagentDef[] = [];
  for (const e of entries) {
    if (e.is_dir || !e.name.endsWith(".md")) continue;
    try {
      out.push(
        parseAgent(await fs.readFile(e.path), e.name, source, e.path),
      );
    } catch {
      /* unreadable file — skip */
    }
  }
  return out;
}

/**
 * Load all available subagents. Project agents win name collisions over
 * user-global ones (same precedence as Claude Code's own resolution).
 */
export async function loadSubagents(
  root: string,
  homeDir: string | null,
): Promise<SubagentDef[]> {
  const proj = await readAgentDir(`${root}/.claude/agents`, "project");
  const user = homeDir
    ? await readAgentDir(`${homeDir}/.claude/agents`, "user")
    : [];
  const seen = new Set(proj.map((a) => a.name));
  return [...proj, ...user.filter((a) => !seen.has(a.name))];
}
