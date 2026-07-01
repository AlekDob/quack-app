// Tiny frontmatter read/write helpers for the whiteboard drag-and-drop.
// We intentionally avoid a YAML dependency: agent .md files use only a few
// scalar/list fields, so a regex-based in-place patch is enough and keeps
// the bundle dependency-free.
//
// Reading: shared with subagents.ts (frontmatterField + frontmatterList).
// Writing: setFrontmatterList(filePath, key, list) replaces (or inserts)
// the `key: [...]` block in the YAML frontmatter and preserves whatever
// body follows it. Safe to call repeatedly; idempotent.

import { fs } from "./ipc";
import { frontmatterField, frontmatterList } from "./subagents";

/**
 * Update a single list-valued frontmatter key on a markdown file.
 * - Replaces an existing `key:` block (block form first, then inline).
 * - If the key isn't present, inserts it just before the closing `---`.
 * - If the file has no frontmatter at all, adds a minimal one.
 * - Preserves the body (everything after the closing `---`) verbatim.
 *
 * Empty `list` removes the key entirely (so an agent with no skills
 * shows no orphan `skills: []`).
 */
export async function setFrontmatterList(
  filePath: string,
  key: string,
  list: string[],
): Promise<void> {
  const src = await fs.readFile(filePath);
  const next = patchFrontmatterList(src, key, list);
  if (next === src) return;
  await fs.writeFile(filePath, next);
}

/**
 * Pure variant of {@link setFrontmatterList} (testable, no I/O).
 * Returns the new file contents; returns the original string unchanged
 * when no patch is required (covers the "key already absent and list is
 * empty" edge case so the writer skips a no-op write).
 */
export function patchFrontmatterList(
  src: string,
  key: string,
  list: string[],
): string {
  const fm = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fm) {
    // No frontmatter at all — synthesise one. Empty body is fine.
    if (list.length === 0) return src;
    const body = src.length > 0 && !src.startsWith("\n") ? "\n" + src : src;
    return `---\n${key}:\n${list.map((s) => `  - ${s}`).join("\n")}\n---\n${body}`;
  }

  // fm[1] is the frontmatter body (between the --- fences).
  // tail is everything after the closing fence (may or may not start
  // with a newline depending on the source — the regex's optional \n?
  // after `---` consumes the first one when present).
  const lines = fm[1].split("\n");
  const keyIdx = lines.findIndex((l) => l.trimStart().startsWith(`${key}:`));
  const tail = src.slice(fm[0].length);

  // Remove the key entirely when the list is empty.
  if (list.length === 0) {
    if (keyIdx < 0) return src;
    let end = keyIdx;
    while (end + 1 < lines.length && /^\s+-\s/.test(lines[end + 1])) end++;
    const nextLines = [...lines.slice(0, keyIdx), ...lines.slice(end + 1)];
    return `---\n${nextLines.join("\n")}\n---\n${tail}`;
  }

  const block = `${key}:\n${list.map((s) => `  - ${s}`).join("\n")}`;

  if (keyIdx < 0) {
    // Insert just before the closing fence.
    const last = lines[lines.length - 1] ?? "";
    const sep = last === "" ? "" : "\n";
    const nextLines = `${lines.join("\n")}${sep}${block}`;
    return `---\n${nextLines}\n---\n${tail}`;
  }

  // Replace existing block — drop the key line AND any indented `- item` lines.
  let end = keyIdx;
  while (end + 1 < lines.length && /^\s+-\s/.test(lines[end + 1])) end++;
  const nextLines = [...lines.slice(0, keyIdx), block, ...lines.slice(end + 1)];
  return `---\n${nextLines.join("\n")}\n---\n${tail}`;
}

/**
 * Update a single scalar (boolean/string) frontmatter key on a markdown
 * file. `value === null` removes the key. Used by the Context view to set
 * `disable-model-invocation` on a project skill's SKILL.md — the canonical,
 * versioned way to hide a skill you author (per Claude Code docs). Mirrors
 * {@link setFrontmatterList} but for a one-line scalar.
 */
export async function setFrontmatterScalar(
  filePath: string,
  key: string,
  value: boolean | string | null,
): Promise<void> {
  const src = await fs.readFile(filePath);
  const next = patchFrontmatterScalar(src, key, value);
  if (next === src) return;
  await fs.writeFile(filePath, next);
}

/** Pure variant of {@link setFrontmatterScalar} (testable, no I/O). */
export function patchFrontmatterScalar(
  src: string,
  key: string,
  value: boolean | string | null,
): string {
  const fm = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!fm) {
    if (value === null) return src;
    const body = src.length > 0 && !src.startsWith("\n") ? "\n" + src : src;
    return `---\n${key}: ${value}\n---\n${body}`;
  }
  const lines = fm[1].split("\n");
  const keyIdx = lines.findIndex((l) => l.trimStart().startsWith(`${key}:`));
  const tail = src.slice(fm[0].length);
  if (value === null) {
    if (keyIdx < 0) return src;
    const nextLines = [...lines.slice(0, keyIdx), ...lines.slice(keyIdx + 1)];
    return `---\n${nextLines.join("\n")}\n---\n${tail}`;
  }
  const line = `${key}: ${value}`;
  if (keyIdx < 0) {
    const last = lines[lines.length - 1] ?? "";
    const sep = last === "" ? "" : "\n";
    return `---\n${lines.join("\n")}${sep}${line}\n---\n${tail}`;
  }
  const nextLines = [...lines.slice(0, keyIdx), line, ...lines.slice(keyIdx + 1)];
  return `---\n${nextLines.join("\n")}\n---\n${tail}`;
}

/** Re-export for convenience. */
export { frontmatterField, frontmatterList };
