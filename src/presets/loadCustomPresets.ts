// Discovery for user-created presets: markdown files with YAML frontmatter
// living in `<workspace>/.quack/presets/` — deliberately NOT
// `.claude/agents/`, so custom presets never show up in the @-mention menu
// or get delegated as a Task (a preset shapes the CURRENT session; it is
// not a subagent). Mirrors subagents.ts's parser/discovery shape.
import { fs, type DirEntry } from "../ipc";
import { frontmatterField } from "../subagents";
import { migrateLegacyQuackSubpath, quackAbs } from "../quackDir";
import { defaultPresetAvatar } from "./avatarStore";
import type { EffortLevel, ModelTier, OutputStyle, PresetDefinition } from "./types";

const MODEL_TIERS: readonly ModelTier[] = ["reasoning", "balanced", "fast"];
const OUTPUT_STYLES: readonly OutputStyle[] = ["concise", "structured", "terse-review"];
const EFFORT_LEVELS: readonly EffortLevel[] = ["low", "medium", "high", "xhigh", "max"];
const PERM_MODES: readonly string[] = ["plan", "acceptEdits", "auto", "bypassPermissions"];

function slugFromFileName(fileName: string): string {
  return fileName.replace(/\.md$/, "");
}

function bodyOf(src: string): string {
  const fm = src.match(/^---\n[\s\S]*?\n---\n?/);
  return (fm ? src.slice(fm[0].length) : src).trim();
}

function parseCustomPreset(src: string, fileName: string, path: string): PresetDefinition {
  const slug = slugFromFileName(fileName);
  const name = frontmatterField(src, "name") ?? slug;
  const modelTierRaw = frontmatterField(src, "model");
  const modelTier = (MODEL_TIERS as readonly string[]).includes(modelTierRaw ?? "")
    ? (modelTierRaw as ModelTier)
    : "balanced";
  const effortRaw = frontmatterField(src, "effort");
  const effort = (EFFORT_LEVELS as readonly string[]).includes(effortRaw ?? "")
    ? (effortRaw as EffortLevel)
    : "medium";
  const outputStyleRaw = frontmatterField(src, "outputStyle");
  const outputStyle = (OUTPUT_STYLES as readonly string[]).includes(outputStyleRaw ?? "")
    ? (outputStyleRaw as OutputStyle)
    : "concise";
  const permModeRaw = frontmatterField(src, "permMode");
  const permMode = PERM_MODES.includes(permModeRaw ?? "") ? (permModeRaw as string) : null;
  return {
    id: slug,
    label: name,
    role: frontmatterField(src, "role") ?? "Custom preset",
    source: "custom",
    avatar: frontmatterField(src, "avatar") ?? defaultPresetAvatar(slug),
    purpose: frontmatterField(src, "description") ?? "",
    whenToUse: "",
    whenNotToUse: "",
    defaults: { modelTier, effort, thinking: null, outputStyle, permMode },
    escalation: "",
    instructions: bodyOf(src) || undefined,
    path,
  };
}

/** Preset .md files never carry a `skills:` list — that field is specific
 *  to delegable subagents. Nothing to filter: this dir is presets-only. */
export async function loadCustomPresets(root: string): Promise<PresetDefinition[]> {
  await migrateLegacyQuackSubpath(root, "presets");
  const dir = quackAbs(root, "presets");
  let entries: DirEntry[];
  try {
    entries = await fs.listDir(dir);
  } catch {
    return []; // directory doesn't exist yet — fine
  }
  const out: PresetDefinition[] = [];
  for (const e of entries) {
    if (e.is_dir || !e.name.endsWith(".md")) continue;
    try {
      out.push(parseCustomPreset(await fs.readFile(e.path), e.name, e.path));
    } catch {
      /* unreadable file — skip */
    }
  }
  return out;
}
