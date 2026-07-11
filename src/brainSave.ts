// Parse Jack's [Brain save] proposals and persist via pinky save.

import type { BrainSaveProposal, BrainSaveStatus } from "./ai";
import { brainWorkspaceRoot } from "./brainInject";
import { pinky } from "./pinky";

const BLOCK_RE = /\[Brain save\]([\s\S]*?)\[\/Brain save\]/i;

const VALID_TYPES = new Set([
  "gotcha",
  "pattern",
  "decision",
  "diary",
  "guide",
  "note",
]);

function parseHeaderLine(line: string): [string, string] | null {
  const i = line.indexOf(":");
  if (i < 1) return null;
  return [line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim()];
}

function parseHeader(raw: string): Partial<BrainSaveProposal> {
  const out: Partial<BrainSaveProposal> = { tags: [] };
  for (const line of raw.split("\n")) {
    const kv = parseHeaderLine(line);
    if (!kv) continue;
    const [k, v] = kv;
    if (k === "title") out.title = v;
    if (k === "type" && VALID_TYPES.has(v)) out.entry_type = v as BrainSaveProposal["entry_type"];
    if (k === "reason") out.reason = v;
    if (k === "tags") {
      out.tags = v.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }
  return out;
}

/** Strip save blocks from rendered assistant prose. */
export function stripBrainSaveBlocks(content: string): string {
  return content.replace(BLOCK_RE, "").trim();
}

/** Parse the first [Brain save] block in an assistant message. */
export function parseBrainSaveProposal(content: string): BrainSaveProposal | null {
  const m = BLOCK_RE.exec(content);
  if (!m) return null;
  const inner = m[1].trim();
  const split = inner.split(/\n---\n/);
  const header = parseHeader(split[0] ?? "");
  const body = (split.slice(1).join("\n---\n") || "").trim();
  if (!header.title || !body) return null;
  return {
    title: header.title,
    entry_type: header.entry_type ?? "note",
    tags: header.tags ?? [],
    reason: header.reason,
    body,
    status: "pending",
  };
}

export async function commitBrainSave(
  wsId: string,
  proposal: BrainSaveProposal,
): Promise<{ path: string; relPath: string }> {
  const root = brainWorkspaceRoot(wsId);
  if (!root) throw new Error("Workspace not loaded");
  const res = await pinky.save(root, {
    title: proposal.title,
    body: proposal.body,
    entryType: proposal.entry_type,
    tags: proposal.tags,
  });
  return { path: res.path, relPath: res.rel_path };
}

export function withBrainSaveStatus(
  proposal: BrainSaveProposal,
  status: BrainSaveStatus,
  savedPath?: string,
): BrainSaveProposal {
  return { ...proposal, status, saved_path: savedPath };
}
