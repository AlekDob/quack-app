import type { WorkBlock } from "./works";

export interface SlashCommand {
  id: string;
  label: string;
  hint: string;
  glyph: string;
}

export const SLASH_COMMANDS: SlashCommand[] = [
  { id: "text", label: "Text", hint: "Plain paragraph", glyph: "Aa" },
  { id: "h2", label: "Heading 2", hint: "Section title", glyph: "H2" },
  { id: "h3", label: "Heading 3", hint: "Subsection", glyph: "H3" },
  { id: "bullet", label: "Bulleted list", hint: "Unordered list", glyph: "•" },
  { id: "numbered", label: "Numbered list", hint: "Ordered list", glyph: "1." },
  { id: "todo", label: "To-do list", hint: "Checklist items", glyph: "[]" },
  { id: "code", label: "Code", hint: "Fenced snippet", glyph: "</>" },
  { id: "divider", label: "Divider", hint: "Horizontal rule", glyph: "—" },
];

export function emptyParagraph(): WorkBlock {
  return { type: "paragraph", text: "" };
}

export function isEmptyBlock(b: WorkBlock): boolean {
  if (b.type === "paragraph" || b.type === "heading") return !b.text.trim();
  if (b.type === "divider") return false;
  if (b.type === "code" || b.type === "tech_refs") return !b.text.trim();
  if (b.type === "bullet" || b.type === "ordered") {
    return b.items.every((i) => !i.trim());
  }
  if (b.type === "checklist") {
    return b.items.every((i) => !i.text.trim());
  }
  return false;
}

export function trimBlocks(blocks: WorkBlock[]): WorkBlock[] {
  const copy = [...blocks];
  while (copy.length > 1) {
    const last = copy[copy.length - 1]!;
    if (isEmptyBlock(last)) copy.pop();
    else break;
  }
  return copy;
}

export function withTrailingEmpty(blocks: WorkBlock[]): WorkBlock[] {
  const base = trimBlocks(blocks);
  if (base.length === 0) return [emptyParagraph()];
  const last = base[base.length - 1]!;
  if (last.type === "paragraph" && !last.text) return base;
  return [...base, emptyParagraph()];
}

export function slashQuery(text: string): string | null {
  if (!text.startsWith("/")) return null;
  const m = text.match(/^\/(\w*)$/);
  return m ? m[1]!.toLowerCase() : null;
}

export function filterSlashCommands(query: string): SlashCommand[] {
  if (!query) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (c) =>
      c.id.includes(query) ||
      c.label.toLowerCase().includes(query),
  );
}

export function applySlashCommand(
  blocks: WorkBlock[],
  idx: number,
  cmdId: string,
): WorkBlock[] {
  const cur = blocks[idx];
  const raw =
    cur?.type === "paragraph" || cur?.type === "heading" ? cur.text : "";
  const text = raw.replace(/^\/\w*\s?/, "").trim();
  const next = mkSlashBlock(cmdId, text);
  return blocks.map((b, i) => (i === idx ? next : b));
}

function mkSlashBlock(cmdId: string, text: string): WorkBlock {
  if (cmdId === "h2") return { type: "heading", level: 2, text };
  if (cmdId === "h3") return { type: "heading", level: 3, text };
  if (cmdId === "bullet") {
    return { type: "bullet", items: text ? [text] : [""] };
  }
  if (cmdId === "numbered") {
    return { type: "ordered", items: text ? [text] : [""] };
  }
  if (cmdId === "todo") {
    return { type: "checklist", items: [{ text, done: false }] };
  }
  if (cmdId === "code") return { type: "code", lang: "", text };
  if (cmdId === "divider") return { type: "divider" };
  return { type: "paragraph", text };
}

export function patchBlock(
  blocks: WorkBlock[],
  idx: number,
  block: WorkBlock,
): WorkBlock[] {
  return blocks.map((b, i) => (i === idx ? block : b));
}

export function insertBlockAfter(
  blocks: WorkBlock[],
  idx: number,
  block: WorkBlock = emptyParagraph(),
): WorkBlock[] {
  const next = [...blocks];
  next.splice(idx + 1, 0, block);
  return next;
}

export function removeBlockAt(blocks: WorkBlock[], idx: number): WorkBlock[] {
  if (blocks.length <= 1) return [emptyParagraph()];
  return blocks.filter((_, i) => i !== idx);
}

export function mergeBlockUp(blocks: WorkBlock[], idx: number): WorkBlock[] {
  if (idx <= 0) return blocks;
  const prev = blocks[idx - 1]!;
  const cur = blocks[idx]!;
  if (prev.type !== "paragraph" || cur.type !== "paragraph") {
    return removeBlockAt(blocks, idx);
  }
  const merged: WorkBlock = {
    type: "paragraph",
    text: `${prev.text}${cur.text}`,
  };
  return blocks
    .map((b, i) => (i === idx - 1 ? merged : b))
    .filter((_, i) => i !== idx);
}
