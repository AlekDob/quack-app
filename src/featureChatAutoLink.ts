// Auto-pin a feature doc when an agent Write/Edit succeeds under FEATURE_DIR.
// Also covers Skill/Task forks: Write may live in a sidechain while the parent
// only sees Skill/Task (or a leaked tool_call without a tool_result).

import type { ToolCall } from "./ai";
import {
  extractEditDiffs,
  pathOf,
} from "./components/chatToolRender";
import { featureLabelFromSlug } from "./featureCatalog";
import { useStore } from "./store";
import { FEATURE_DIR, parseFeatureNum } from "./worksFeatureModules";

const FEATURE_BASENAME = /^\d{3}-.+\.md$/i;
const FEATURE_PATH_IN_TEXT =
  /documentation\/features\/(\d{3}-[A-Za-z0-9][A-Za-z0-9_-]*)\.md/gi;

function norm(p: string): string {
  return p.replace(/\\/g, "/");
}

function isToolResultError(
  result: string | undefined,
  isError?: boolean,
): boolean {
  if (isError === true) return true;
  if (typeof result !== "string") return true;
  return /^Error|error:/i.test(result.trim());
}

/** Skill / Task / Agent — feature Write often happens in a forked sidechain. */
export function isDelegatingTool(name: string): boolean {
  const n = name.toLowerCase();
  return n === "skill" || n === "task" || n === "agent";
}

/** Map an edit path to a feature slug, or null if not a feature doc. */
export function featureSlugFromEditPath(
  path: string,
  root: string,
): string | null {
  if (!path || path === "(unknown)") return null;
  const p = norm(path);
  const r = norm(root).replace(/\/+$/, "");
  const prefix = `${r}/${FEATURE_DIR}/`;
  let file: string | null = null;
  if (p.startsWith(prefix)) {
    file = p.slice(prefix.length);
  } else {
    const marker = `/${FEATURE_DIR}/`;
    const i = p.indexOf(marker);
    if (i >= 0) file = p.slice(i + marker.length);
    else if (p.startsWith(`${FEATURE_DIR}/`)) {
      file = p.slice(FEATURE_DIR.length + 1);
    }
  }
  if (!file || file.includes("/")) return null;
  if (!FEATURE_BASENAME.test(file)) return null;
  const slug = file.replace(/\.md$/i, "");
  if (parseFeatureNum(slug) == null) return null;
  return slug;
}

/** Last feature slug mentioned in free text (Skill result, etc.). */
export function featureSlugFromResultText(text: string): string | null {
  let last: string | null = null;
  FEATURE_PATH_IN_TEXT.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = FEATURE_PATH_IN_TEXT.exec(text)) !== null) {
    if (parseFeatureNum(m[1]) != null) last = m[1];
  }
  return last;
}

/** Slug from a Write/Edit/MultiEdit tool_call (no result yet). */
export function featureSlugFromToolCall(
  call: ToolCall,
  root: string,
): string | null {
  if (!extractEditDiffs(call)?.length) return null;
  return featureSlugFromEditPath(pathOf(call), root);
}

/** Slug if this successful edit touched a feature doc; else null. */
export function featureSlugFromSuccessfulEdit(
  call: ToolCall,
  root: string,
  result?: string,
  isError?: boolean,
): string | null {
  if (isToolResultError(result, isError)) return null;
  if (!extractEditDiffs(call)?.length) return null;
  return featureSlugFromEditPath(pathOf(call), root);
}

/**
 * Slug from Skill/Task/Agent result text (forked feature-creator), or from
 * any result that explicitly says a feature doc was created.
 */
export function featureSlugFromDelegateResult(
  call: ToolCall,
  result?: string,
  isError?: boolean,
): string | null {
  if (isToolResultError(result, isError)) return null;
  const text = result as string;
  const name = call.function.name;
  const created = /Feature doc created at/i.test(text);
  if (!isDelegatingTool(name) && !created) return null;
  return featureSlugFromResultText(text);
}

/** Pin chat to feature if none linked yet. Returns slug if linked. */
export function pinFeatureOnChat(
  wsId: string,
  chatId: string,
  slug: string,
): string | null {
  const chat = useStore.getState().loaded[wsId]?.aiChats[chatId];
  if (!chat || chat.featureId) return null;
  useStore.getState().setAIChatFeature(wsId, chatId, {
    id: slug,
    label: featureLabelFromSlug(slug),
    pinned: true,
  });
  return slug;
}
