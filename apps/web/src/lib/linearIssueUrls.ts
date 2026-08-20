// FILE: linearIssueUrls.ts
// Purpose: Remember Linear issue URLs from the picker so chips can open the real
//          issue page. Keyed by linear:// path, including workspace slug.
// Layer: Web UI helper

import {
  linearIssueWebUrlForIdentifier,
  parseLinearMentionPath,
} from "@synara/shared/linearMentions";

const rememberedLinearIssueUrls = new Map<string, string>();

export function rememberLinearIssueUrl(path: string, url: string): void {
  const trimmed = url.trim();
  if (trimmed.length > 0) {
    rememberedLinearIssueUrls.set(path, trimmed);
  }
}

export function resolveLinearIssueUrl(path: string): string {
  const remembered = rememberedLinearIssueUrls.get(path);
  if (remembered) return remembered;
  const parsed = parseLinearMentionPath(path.startsWith("linear://") ? path : `linear://${path}`);
  if (!parsed) return linearIssueWebUrlForIdentifier(path);
  return linearIssueWebUrlForIdentifier(parsed.identifier, parsed.urlKey);
}
