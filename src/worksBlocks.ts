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
