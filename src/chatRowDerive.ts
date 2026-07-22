// Per-message memoized derivation for the chat transcript rows.
//
// WHY: the row renderer (`renderAt` in AIChatPanel) runs a batch of regex /
// parse passes (strip brain-save + works blocks, extract code + tagged
// blocks, split <think>, parse brain-save + works-story proposals) for EVERY
// message in the visible window. During streaming the parent re-renders up to
// once per frame, so that O(n) work ran ~60x/sec over messages whose content
// never changes. Caching by message-object identity + content collapses it to
// O(1) per frame (only the streaming message, whose content is still growing,
// recomputes). Committed messages hit the cache.
//
// This is a pure memo layer — it returns exactly what the inline code computed
// before, just cached — so it changes performance, not behavior.

import type { ChatMessage, ToolCall } from "./ai";
import {
  extractCodeBlocks,
  extractTaggedCodeBlocks,
  isShellLang,
  splitThinking,
} from "./chatTextUtils";
import { stripWorksDirectiveBlocks, parseWorksNewStoryBlock } from "./worksAgentDirectives";
import { stripBrainSaveBlocks, parseBrainSaveProposal } from "./brainSave";

type Tagged = ReturnType<typeof extractTaggedCodeBlocks>;

export interface DerivedRow {
  /** content with brain-save + works directive blocks stripped. */
  bodyForRender: string;
  /** fenced code blocks (```lang\n…```) extracted from bodyForRender. */
  blocks: string[];
  /** text to insert on "Insert": joined code blocks, else the body. */
  insertText: string;
  taggedBlocks: Tagged;
  shellBlocks: Tagged;
  shellText: string;
  split: { thinking: string; visible: string };
  brainProposalParsed: ReturnType<typeof parseBrainSaveProposal>;
  worksNewStoryParsed: ReturnType<typeof parseWorksNewStoryBlock>;
}

const rowCache = new WeakMap<object, { content: string; derived: DerivedRow }>();

/** Assistant-style derivation of a message's content, memoized by (object,
 *  content). Callers apply their own role / streaming gates around it. */
export function deriveRow(m: ChatMessage): DerivedRow {
  const hit = rowCache.get(m);
  if (hit && hit.content === m.content) return hit.derived;
  const bodyForRender = stripWorksDirectiveBlocks(stripBrainSaveBlocks(m.content));
  const blocks = extractCodeBlocks(bodyForRender);
  const taggedBlocks = extractTaggedCodeBlocks(bodyForRender);
  const shellBlocks = taggedBlocks.filter((b) => isShellLang(b.lang));
  const derived: DerivedRow = {
    bodyForRender,
    blocks,
    insertText: blocks.length > 0 ? blocks.join("\n\n") : bodyForRender,
    taggedBlocks,
    shellBlocks,
    shellText: shellBlocks.map((b) => b.code).join("\n"),
    split: splitThinking(bodyForRender),
    brainProposalParsed: parseBrainSaveProposal(m.content),
    worksNewStoryParsed: parseWorksNewStoryBlock(m.content),
  };
  rowCache.set(m, { content: m.content, derived });
  return derived;
}

export interface ToolMaps {
  callsById: Map<string, ToolCall>;
  resultsById: Map<string, string>;
  erroredIds: Set<string>;
}

const toolCache = new WeakMap<
  object,
  { calls: unknown; results: unknown; maps: ToolMaps }
>();

/** Build the id→call / id→result / errored-id lookups InterleavedBlocks needs,
 *  memoized by the message's tool_calls / tool_results array identity so the
 *  maps keep a stable reference across frames — which lets `memo(InterleavedBlocks)`
 *  bail out for committed rows. */
export function deriveToolMaps(m: ChatMessage): ToolMaps {
  const hit = toolCache.get(m);
  if (hit && hit.calls === m.tool_calls && hit.results === m.tool_results) {
    return hit.maps;
  }
  const callsById = new Map<string, ToolCall>();
  for (const c of m.tool_calls ?? []) {
    if (typeof c.id === "string") callsById.set(c.id, c);
  }
  const resultsById = new Map<string, string>();
  const erroredIds = new Set<string>();
  for (const tr of m.tool_results ?? []) {
    if (tr.tool_use_id) resultsById.set(tr.tool_use_id, tr.content);
    if (tr.tool_use_id && tr.is_error) erroredIds.add(tr.tool_use_id);
  }
  const maps: ToolMaps = { callsById, resultsById, erroredIds };
  toolCache.set(m, { calls: m.tool_calls, results: m.tool_results, maps });
  return maps;
}
