// FILE: linearReactQuery.ts
// Purpose: React Query options for the Linear issue picker in the composer `@` menu.
// Layer: Web data access

import type { LinearCreateIssueInput } from "@synara/contracts";
import { LINEAR_UPLOAD_ROUTE_PATH } from "@synara/shared/binaryTransfer";
import { queryOptions } from "@tanstack/react-query";

import { ensureNativeApi } from "~/nativeApi";
import { resolveWsHttpUrl } from "./wsHttpUrl";

export const linearQueryKeys = {
  all: ["linear"] as const,
  issues: (query: string) => ["linear", "issues", query] as const,
  createOptions: () => ["linear", "createOptions"] as const,
};

export function linearIssuesQueryOptions(input: { query: string; enabled: boolean }) {
  return queryOptions({
    queryKey: linearQueryKeys.issues(input.query),
    queryFn: async () => ensureNativeApi().linear.searchIssues({ query: input.query }),
    enabled: input.enabled,
    // Linear rate-limits per key; the composer re-opens often, so keep results warm.
    staleTime: 60_000,
  });
}

export function linearCreateOptionsQueryOptions(enabled: boolean) {
  return queryOptions({
    queryKey: linearQueryKeys.createOptions(),
    queryFn: async () => ensureNativeApi().linear.listCreateOptions(),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export async function createLinearIssue(input: LinearCreateIssueInput) {
  return ensureNativeApi().linear.createIssue(input);
}

/**
 * Uploads one image to Linear's storage and returns its asset URL. The bytes go over
 * HTTP, never the RPC socket: WebSocket frames are capped at 2 MB and base64 inflates.
 */
export async function uploadLinearImage(input: {
  workspaceId: string;
  file: File;
}): Promise<string> {
  const params = new URLSearchParams({
    workspaceId: input.workspaceId,
    name: input.file.name,
    mimeType: input.file.type,
  });
  const response = await fetch(resolveWsHttpUrl(`${LINEAR_UPLOAD_ROUTE_PATH}?${params}`), {
    method: "POST",
    credentials: "include",
    body: input.file,
  });
  const payload = (await response.json().catch(() => null)) as {
    assetUrl?: unknown;
    error?: unknown;
  } | null;
  if (!response.ok || typeof payload?.assetUrl !== "string") {
    throw new Error(
      typeof payload?.error === "string"
        ? payload.error
        : `Image upload failed with status ${response.status}.`,
    );
  }
  return payload.assetUrl;
}
