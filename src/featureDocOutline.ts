/** Extract a token-cheap outline from a feature doc for pre-turn inject. */

export interface FeatureDocOutline {
  purpose?: string;
  headings: string[];
}

const MAX_HEADINGS = 12;
const MAX_OUTLINE_CHARS = 1400;

export function extractFeatureDocOutline(src: string): FeatureDocOutline {
  const body = src.replace(/^---\n[\s\S]*?\n---\n?/, "");
  let purpose: string | undefined;
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const m = line.match(/^\*\*Purpose:\*\*\s*(.+)$/i);
    if (m) {
      purpose = m[1]!.trim().slice(0, 200);
      break;
    }
  }
  const headings: string[] = [];
  for (const raw of body.split("\n")) {
    const line = raw.trim();
    const m = line.match(/^(#{2,3})\s+(.+)$/);
    if (!m) continue;
    headings.push(`${m[1]} ${m[2]!.trim()}`);
    if (headings.length >= MAX_HEADINGS) break;
  }
  return { purpose, headings };
}

export function formatFeatureOutlineBlock(
  featurePath: string,
  outline: FeatureDocOutline,
): string {
  const slug = featurePath.split("/").pop()?.replace(/\.md$/i, "") ?? featurePath;
  const lines = [`Outline (${slug}):`];
  if (outline.purpose) lines.push(`  Purpose: ${outline.purpose}`);
  if (outline.headings.length > 0) {
    lines.push(`  ${outline.headings.join(" | ")}`);
  }
  const block = lines.join("\n");
  return block.length > MAX_OUTLINE_CHARS
    ? `${block.slice(0, MAX_OUTLINE_CHARS)}…`
    : block;
}
