// Cursor-style context window breakdown for the composer popover.
// Static categories are estimated from disk scans (~char/4); conversation
// is the remainder of the live context fill from the last API call.

import { invoke } from "@tauri-apps/api/core";
import { claudeMcp } from "./ipc";
import { loadWorkspaceRules } from "./workspaceRules";

export interface ContextSegment {
  id: string;
  label: string;
  tokens: number;
  /** True when weight is scanned/estimated, not from the API snapshot. */
  estimate: boolean;
}

export interface ContextBreakdown {
  segments: ContextSegment[];
  total: number;
}

/** CC fixed overhead — system prompt + built-in tool defs (order of magnitude). */
const SYSTEM_PROMPT_EST = 3_500;
const TOOL_DEFS_EST = 8_700;
const MCP_PER_SERVER_EST = 600;

interface ContextAsset {
  kind: string;
  effective_tokens: number;
}

interface ContextReport {
  assets: ContextAsset[];
}

function sumTokens(assets: ContextAsset[], kind: string): number {
  return assets
    .filter((a) => a.kind === kind)
    .reduce((s, a) => s + a.effective_tokens, 0);
}

function pushSeg(
  out: ContextSegment[],
  id: string,
  label: string,
  tokens: number,
): void {
  if (tokens <= 0) return;
  out.push({ id, label, tokens, estimate: true });
}

function fitStaticToTotal(
  segments: ContextSegment[],
  contextUsed: number,
): ContextSegment[] {
  const staticSum = segments.reduce((s, x) => s + x.tokens, 0);
  if (contextUsed <= 0 || staticSum <= contextUsed) return segments;
  const scale = (contextUsed * 0.9) / staticSum;
  return segments.map((seg) => ({
    ...seg,
    tokens: Math.max(1, Math.round(seg.tokens * scale)),
  }));
}

export async function buildContextBreakdown(
  root: string,
  contextUsed: number,
): Promise<ContextBreakdown> {
  const segments: ContextSegment[] = [];

  pushSeg(segments, "system", "System prompt", SYSTEM_PROMPT_EST);
  pushSeg(segments, "tools", "Tool definitions", TOOL_DEFS_EST);

  const rules = await loadWorkspaceRules(root);
  if (rules?.bytes) {
    pushSeg(segments, "rules", "Rules", Math.ceil(rules.bytes / 4));
  }

  try {
    const report = await invoke<ContextReport>("claude_context_assets", { root });
    pushSeg(segments, "skills", "Skills", sumTokens(report.assets, "skill"));
    pushSeg(
      segments,
      "subagents",
      "Subagent definitions",
      sumTokens(report.assets, "agent"),
    );
  } catch {
    /* scan unavailable */
  }

  try {
    const servers = await claudeMcp.list(root);
    pushSeg(
      segments,
      "mcp",
      "MCP & dynamic tools",
      servers.length * MCP_PER_SERVER_EST,
    );
  } catch {
    /* MCP list unavailable */
  }

  const fitted = fitStaticToTotal(segments, contextUsed);
  const staticSum = fitted.reduce((s, x) => s + x.tokens, 0);
  const conversation = Math.max(0, contextUsed - staticSum);
  if (conversation > 0) {
    fitted.push({
      id: "conversation",
      label: "Conversation",
      tokens: conversation,
      estimate: false,
    });
  }

  return { segments: fitted, total: contextUsed };
}
