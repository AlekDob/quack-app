// Write-paths for custom presets — create a brand-new one, or update an
// existing one in place. The one thing the organigramma couldn't do for
// agents before (feature 018 is edit-only). Lives next to
// loadCustomPresets.ts, which reads back what these write.
import { fs } from "../ipc";
import { quackAbs } from "../quackDir";
import type { EffortLevel, ModelTier, OutputStyle } from "./types";

function slugify(label: string): string {
  const base = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "preset";
}

async function uniqueSlug(dir: string, label: string): Promise<string> {
  const base = slugify(label);
  let slug = base;
  let n = 2;
  while (await fs.exists(`${dir}/${slug}.md`)) {
    slug = `${base}-${n++}`;
  }
  return slug;
}

export interface NewPresetInput {
  label: string; // proper first name, e.g. "Ada"
  role: string; // short subtitle, e.g. "Researcher"
  description: string;
  modelTier: ModelTier;
  effort: EffortLevel;
  outputStyle: OutputStyle;
  permMode?: string | null; // forced Claude Code permission mode; null/omitted = Ask
  instructions: string;
  avatar?: string;
}

function renderPresetMd(input: NewPresetInput): string {
  return [
    "---",
    `name: ${input.label}`,
    `role: ${input.role}`,
    `description: ${input.description}`,
    `model: ${input.modelTier}`,
    `effort: ${input.effort}`,
    `outputStyle: ${input.outputStyle}`,
    ...(input.permMode ? [`permMode: ${input.permMode}`] : []),
    ...(input.avatar ? [`avatar: ${input.avatar}`] : []),
    "---",
    "",
    input.instructions.trim(),
    "",
  ].join("\n");
}

/** Create `<root>/.quack/presets/<slug>.md` and return its slug (= preset id). */
export async function createPreset(root: string, input: NewPresetInput): Promise<string> {
  const dir = quackAbs(root, "presets");
  if (!(await fs.exists(dir))) await fs.createDir(dir);
  const slug = await uniqueSlug(dir, input.label);
  await fs.writeFile(`${dir}/${slug}.md`, renderPresetMd(input));
  return slug;
}

/** Rewrite an existing custom preset's `.md` in place — the slug (and thus
 *  the preset id / filename) never changes even if the display name does,
 *  so overrides keyed on the old id (lcp.presets.v1) and any references
 *  stay valid. */
export async function updatePreset(path: string, input: NewPresetInput): Promise<void> {
  await fs.writeFile(path, renderPresetMd(input));
}
