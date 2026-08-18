// FILE: linearIssueUrls.ts
// Purpose: Remember Linear issue URLs from the picker so chips can open the real
//          issue page, and fall back to https://linear.app/issue/<id>.
// Layer: Web UI helper

import { linearIssueWebUrlForIdentifier } from "@synara/shared/linearMentions";

const rememberedLinearIssueUrls = new Map<string, string>();

export function rememberLinearIssueUrl(identifier: string, url: string): void {
  const trimmed = url.trim();
  if (trimmed.length > 0) {
    rememberedLinearIssueUrls.set(identifier, trimmed);
  }
}

export function resolveLinearIssueUrl(identifier: string): string {
  return rememberedLinearIssueUrls.get(identifier) ?? linearIssueWebUrlForIdentifier(identifier);
}
