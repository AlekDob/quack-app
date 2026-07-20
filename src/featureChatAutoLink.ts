// Auto-pin a feature doc when an agent Write/Edit succeeds under FEATURE_DIR.

import type { ToolCall } from "./ai";
import {
  extractEditDiffs,
  pathOf,
} from "./components/chatToolRender";
import { featureLabelFromSlug } from "./featureCatalog";
import { useStore } from "./store";
import { FEATURE_DIR, parseFeatureNum } from "./worksFeatureModules";

const FEATURE_BASENAME = /^\d{3}-.+\.md$/i;

function norm(p: string): string {
  return p.replace(/\\/g, "/");
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

function isToolResultError(
  result: string | undefined,
  isError?: boolean,
): boolean {
  if (isError === true) return true;
  if (typeof result !== "string") return true;
  return /^Error|error:/i.test(result.trim());
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
