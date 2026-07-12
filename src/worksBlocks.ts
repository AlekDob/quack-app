import type { WorkBlock } from "./works";

export function blocksToMarkdown(blocks: WorkBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "paragraph") return b.text;
      if (b.type === "heading") return `${"#".repeat(b.level)} ${b.text}`;
      if (b.type === "bullet") return b.items.map((i) => `- ${i}`).join("\n");
      if (b.type === "ordered") {
        return b.items.map((i, n) => `${n + 1}. ${i}`).join("\n");
      }
      if (b.type === "checklist") {
        return b.items.map((i) => `- [${i.done ? "x" : " "}] ${i.text}`).join("\n");
      }
      if (b.type === "code") return `\`\`\`${b.lang ?? ""}\n${b.text}\n\`\`\``;
      if (b.type === "tech_refs") {
        return `---\nRiferimenti tecnici (per gli sviluppatori):\n${b.text}`;
      }
      if (b.type === "divider") return "---";
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function plainTextToBlocks(text: string): WorkBlock[] {
  const t = text.trim();
  if (!t) return [];
  return [{ type: "paragraph", text: t }];
}

function isBlockStart(line: string): boolean {
  const t = line.trim();
  return (
    t.startsWith("#") ||
    t.startsWith("```") ||
    t === "---" ||
    /^-\s+\[[ xX]\]/.test(line) ||
    /^-\s+/.test(line) ||
    /^\d+\.\s+/.test(line)
  );
}

function parseHeading(line: string): WorkBlock | null {
  const m = line.match(/^(#{2,3})\s+(.*)$/);
  if (!m) return null;
  return { type: "heading", level: m[1]!.length as 2 | 3, text: m[2]! };
}

function parseListBlock(
  lines: string[],
  start: number,
  kind: "bullet" | "ordered" | "checklist",
): { block: WorkBlock; next: number } {
  let i = start;
  if (kind === "checklist") {
    const items: { text: string; done: boolean }[] = [];
    while (i < lines.length) {
      const m = lines[i]!.match(/^-\s+\[([ xX])\]\s+(.*)$/);
      if (!m) break;
      items.push({ done: m[1]!.toLowerCase() === "x", text: m[2]! });
      i++;
    }
    return { block: { type: "checklist", items }, next: i };
  }
  if (kind === "bullet") {
    const items: string[] = [];
    while (i < lines.length && /^-\s+/.test(lines[i]!)) {
      items.push(lines[i]!.replace(/^-\s+/, ""));
      i++;
    }
    return { block: { type: "bullet", items }, next: i };
  }
  const items: string[] = [];
  while (i < lines.length && /^\d+\.\s+/.test(lines[i]!)) {
    items.push(lines[i]!.replace(/^\d+\.\s+/, ""));
    i++;
  }
  return { block: { type: "ordered", items }, next: i };
}

function parseCodeBlock(lines: string[], start: number): { block: WorkBlock; next: number } {
  const lang = lines[start]!.slice(3).trim();
  const body: string[] = [];
  let i = start + 1;
  while (i < lines.length && !lines[i]!.startsWith("```")) {
    body.push(lines[i]!);
    i++;
  }
  return {
    block: { type: "code", lang: lang || undefined, text: body.join("\n") },
    next: Math.min(i + 1, lines.length),
  };
}

function parseParagraph(lines: string[], start: number): { block: WorkBlock; next: number } {
  const body: string[] = [];
  let i = start;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim() || isBlockStart(line)) break;
    body.push(line);
    i++;
  }
  return { block: { type: "paragraph", text: body.join("\n") }, next: i };
}

/** Round-trip helper: markdown body → Notion-style blocks for the drawer editor. */
export function markdownToBlocks(md: string): WorkBlock[] {
  const src = md.trim();
  if (!src) return [];
  const lines = src.split("\n");
  const blocks: WorkBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    if (line.startsWith("```")) {
      const hit = parseCodeBlock(lines, i);
      blocks.push(hit.block);
      i = hit.next;
      continue;
    }
    if (line.trim() === "---") {
      blocks.push({ type: "divider" });
      i++;
      continue;
    }
    const heading = parseHeading(line);
    if (heading) {
      blocks.push(heading);
      i++;
      continue;
    }
    if (/^-\s+\[[ xX]\]/.test(line)) {
      const hit = parseListBlock(lines, i, "checklist");
      blocks.push(hit.block);
      i = hit.next;
      continue;
    }
    if (/^-\s+/.test(line)) {
      const hit = parseListBlock(lines, i, "bullet");
      blocks.push(hit.block);
      i = hit.next;
      continue;
    }
    if (/^\d+\.\s+/.test(line)) {
      const hit = parseListBlock(lines, i, "ordered");
      blocks.push(hit.block);
      i = hit.next;
      continue;
    }
    const hit = parseParagraph(lines, i);
    blocks.push(hit.block);
    i = hit.next;
  }
  return blocks;
}

export function toggleChecklistItem(
  blocks: WorkBlock[],
  blockIdx: number,
  itemIdx: number,
): WorkBlock[] {
  return blocks.map((b, bi) => {
    if (bi !== blockIdx || b.type !== "checklist") return b;
    const items = b.items.map((it, ii) =>
      ii === itemIdx ? { ...it, done: !it.done } : it,
    );
    return { ...b, items };
  });
}

export function acceptanceFromBlocks(blocks: WorkBlock[]): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const b of blocks) {
    if (b.type !== "checklist") continue;
    for (const it of b.items) {
      total += 1;
      if (it.done) done += 1;
    }
  }
  return { done, total };
}

export function acceptanceFromMarkdown(md: string): {
  done: number;
  total: number;
} {
  let done = 0;
  let total = 0;
  for (const line of md.split("\n")) {
    const m = line.match(/^-\s+\[([xX ])\]\s+/);
    if (!m) continue;
    total += 1;
    if (m[1]!.toLowerCase() === "x") done += 1;
  }
  return { done, total };
}
