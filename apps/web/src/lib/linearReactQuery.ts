// FILE: linearReactQuery.ts
// Purpose: React Query options for the Linear issue picker in the composer `@` menu.
// Layer: Web data access

import type { LinearCreateIssueInput } from "@synara/contracts";
import { queryOptions } from "@tanstack/react-query";

import { ensureNativeApi } from "~/nativeApi";

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
