// FILE: linear/linearClient.ts
// Purpose: Minimal Linear GraphQL client: list open issues, list create targets, create an issue.
// Layer: Server external integration

import {
  LINEAR_ISSUE_SEARCH_LIMIT,
  PROVIDER_SEND_TURN_MAX_IMAGE_BYTES,
  type LinearCycle,
  type LinearCreateIssueInput,
  type LinearIssue,
  type LinearWorkspace,
  type LinearWorkspaceCreateOptions,
} from "@synara/contracts";
import { linearWorkspaceDisplayName } from "@synara/shared/linearMentions";
import { outboundHttp } from "@synara/shared/outboundHttp";

import { fetchJson } from "../providerUsage/http";

const LINEAR_API_URL = "https://api.linear.app/graphql";
const ALLOWED_ORIGINS = ["https://api.linear.app"] as const;

export class LinearApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LinearApiError";
  }
}

const ISSUE_FIELDS = "id identifier title url state { name } project { name }";

// Anything not shipped and not dropped. Linear state types are:
// triage | backlog | unstarted | started | completed | canceled.
const OPEN_ISSUE_FILTER = { state: { type: { nin: ["completed", "canceled"] } } } as const;

interface RawIssue {
  readonly id?: unknown;
  readonly identifier?: unknown;
  readonly title?: unknown;
  readonly url?: unknown;
  readonly state?: { readonly name?: unknown } | null;
  readonly project?: { readonly name?: unknown } | null;
}

interface RawCycle {
  readonly id?: unknown;
  readonly number?: unknown;
  readonly name?: unknown;
  readonly startsAt?: unknown;
  readonly endsAt?: unknown;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toIssue(raw: RawIssue, workspace: LinearWorkspace): LinearIssue | null {
  const id = text(raw.id);
  const identifier = text(raw.identifier);
  if (!id || !identifier) return null;
  const projectName = text(raw.project?.name);
  return {
    id,
    identifier,
    title: text(raw.title),
    url: text(raw.url),
    stateName: text(raw.state?.name),
    projectName: projectName.length > 0 ? projectName : null,
    workspaceId: workspace.id,
    workspaceName: linearWorkspaceDisplayName(workspace),
    workspaceUrlKey: workspace.urlKey,
  };
}

function toCycle(raw: RawCycle, isActive: boolean): LinearCycle | null {
  const id = text(raw.id);
  const number = typeof raw.number === "number" ? raw.number : Number.NaN;
  const startsAt = text(raw.startsAt);
  const endsAt = text(raw.endsAt);
  if (!id || !Number.isFinite(number) || !startsAt || !endsAt) return null;
  return {
    id,
    number,
    name: typeof raw.name === "string" ? raw.name : null,
    startsAt,
    endsAt,
    isActive,
  };
}

async function linearGraphql(
  apiKey: string,
  query: string,
  variables: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const result = await fetchJson({
    service: "linear",
    url: LINEAR_API_URL,
    allowedOrigins: ALLOWED_ORIGINS,
    method: "POST",
    headers: { authorization: apiKey, "content-type": "application/json" },
    body: { query, variables },
  });
  if (result.status === 401 || result.status === 403) {
    throw new LinearApiError("Linear rejected the API key. Check it in Settings, Linear.");
  }
  if (!result.ok) {
    throw new LinearApiError(`Linear request failed with status ${result.status}.`);
  }
  const payload = (result.json ?? {}) as {
    data?: Record<string, unknown>;
    errors?: ReadonlyArray<{ message?: unknown }>;
  };
  const firstError = payload.errors?.[0];
  if (firstError) {
    throw new LinearApiError(text(firstError.message) || "Linear returned a GraphQL error.");
  }
  if (!payload.data) {
    throw new LinearApiError("Linear returned an empty response.");
  }
  return payload.data;
}

function parseOrganization(raw: unknown): LinearWorkspace | null {
  const organization = raw as { id?: unknown; name?: unknown; urlKey?: unknown } | null;
  const id = text(organization?.id);
  const name = text(organization?.name);
  const urlKey = text(organization?.urlKey);
  if (!id || !name || !urlKey) return null;
  return { id, name, urlKey };
}

export async function fetchLinearOrganization(apiKey: string): Promise<LinearWorkspace> {
  const data = await linearGraphql(
    apiKey,
    `query {
      organization { id name urlKey }
      viewer { organization { id name urlKey } }
    }`,
    {},
  );
  const workspace =
    parseOrganization(data.organization) ??
    parseOrganization((data.viewer as { organization?: unknown } | null)?.organization);
  if (!workspace) {
    throw new LinearApiError("Linear did not return a workspace for that API key.");
  }
  return workspace;
}

/**
 * Open issues, newest activity first. With a search term we go through Linear's own
 * search so typing a ticket code ("ale-28") matches as well as words from the title.
 */
export async function searchLinearIssues(
  apiKey: string,
  term: string,
  workspace: LinearWorkspace,
): Promise<ReadonlyArray<LinearIssue>> {
  const trimmed = term.trim();
  const data = trimmed
    ? await linearGraphql(
        apiKey,
        `query($term: String!, $filter: IssueFilter, $first: Int!) {
          searchIssues(term: $term, filter: $filter, first: $first) { nodes { ${ISSUE_FIELDS} } }
        }`,
        { term: trimmed, filter: OPEN_ISSUE_FILTER, first: LINEAR_ISSUE_SEARCH_LIMIT },
      )
    : await linearGraphql(
        apiKey,
        `query($filter: IssueFilter, $first: Int!) {
          issues(filter: $filter, first: $first, orderBy: updatedAt) { nodes { ${ISSUE_FIELDS} } }
        }`,
        { filter: OPEN_ISSUE_FILTER, first: LINEAR_ISSUE_SEARCH_LIMIT },
      );
  const connection = (trimmed ? data.searchIssues : data.issues) as {
    nodes?: ReadonlyArray<RawIssue>;
  } | null;
  return (connection?.nodes ?? []).flatMap((node) => {
    const issue = toIssue(node, workspace);
    return issue ? [issue] : [];
  });
}

export type LinearWorkspaceKey = {
  readonly workspace: LinearWorkspace;
  readonly apiKey: string;
};

export async function searchLinearIssuesAcrossWorkspaces(
  workspaces: ReadonlyArray<LinearWorkspaceKey>,
  term: string,
): Promise<ReadonlyArray<LinearIssue>> {
  const results = await Promise.allSettled(
    workspaces.map((entry) => searchLinearIssues(entry.apiKey, term, entry.workspace)),
  );
  const issues: LinearIssue[] = [];
  const failures: unknown[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      issues.push(...result.value);
    } else {
      failures.push(result.reason);
    }
  }
  if (issues.length === 0 && failures.length > 0 && workspaces.length > 0) {
    const first = failures[0];
    throw first instanceof Error ? first : new LinearApiError("Linear search failed.");
  }
  return issues;
}

/** Teams and projects the key can write to, for the "new issue" form. */
export async function listLinearCreateOptions(
  apiKey: string,
  workspace: LinearWorkspace,
): Promise<LinearWorkspaceCreateOptions> {
  const data = await linearGraphql(
    apiKey,
    `query {
      teams(first: 100) {
        nodes {
          id key name
          activeCycle { id number name startsAt endsAt }
          futureCycles: cycles(first: 15, filter: { isFuture: { eq: true } }) {
            nodes { id number name startsAt endsAt }
          }
        }
      }
      projects(first: 100) { nodes { id name teams(first: 25) { nodes { id } } } }
    }`,
    {},
  );
  const teams = (data.teams as { nodes?: ReadonlyArray<Record<string, unknown>> } | null)?.nodes;
  const projects = (data.projects as { nodes?: ReadonlyArray<Record<string, unknown>> } | null)
    ?.nodes;
  return {
    workspace,
    teams: (teams ?? []).map((team) => {
      const activeCycle = team.activeCycle ? toCycle(team.activeCycle as RawCycle, true) : null;
      const futureCycles = (
        (team.futureCycles as { nodes?: ReadonlyArray<RawCycle> } | null)?.nodes ?? []
      ).flatMap((cycle) => {
        const parsed = toCycle(cycle, false);
        return parsed ? [parsed] : [];
      });
      const cycles = [...(activeCycle ? [activeCycle] : []), ...futureCycles]
        .filter((cycle, index, all) => all.findIndex((item) => item.id === cycle.id) === index)
        .sort(
          (left, right) =>
            Number(right.isActive) - Number(left.isActive) ||
            left.startsAt.localeCompare(right.startsAt),
        );
      return {
        id: text(team.id),
        key: text(team.key),
        name: text(team.name),
        cycles,
      };
    }),
    projects: (projects ?? []).map((project) => ({
      id: text(project.id),
      name: text(project.name),
      teamIds: (
        (project.teams as { nodes?: ReadonlyArray<{ id?: unknown }> } | null)?.nodes ?? []
      ).map((team) => text(team.id)),
    })),
  };
}

export async function listLinearCreateOptionsAcrossWorkspaces(
  workspaces: ReadonlyArray<LinearWorkspaceKey>,
): Promise<{ workspaces: LinearWorkspaceCreateOptions[] }> {
  const results = await Promise.all(
    workspaces.map((entry) => listLinearCreateOptions(entry.apiKey, entry.workspace)),
  );
  return { workspaces: results };
}

// Hosts Linear hands back as signed upload targets. The `uploadUrl` comes from a
// network response, so it is validated before we PUT bytes at it.
const UPLOAD_HOSTS = ["uploads.linear.app", "storage.googleapis.com"] as const;

function assertLinearUploadUrl(uploadUrl: string): URL {
  let url: URL;
  try {
    url = new URL(uploadUrl);
  } catch {
    throw new LinearApiError("Linear returned an invalid upload URL.");
  }
  const allowed =
    url.protocol === "https:" &&
    UPLOAD_HOSTS.some((host) => url.hostname === host || url.hostname.endsWith(`.${host}`));
  if (!allowed) {
    throw new LinearApiError("Linear returned an upload URL on an unexpected host.");
  }
  return url;
}

/** Uploads one file to Linear's storage and returns the asset URL to reference in markdown. */
export async function uploadLinearFile(
  apiKey: string,
  input: { name: string; mimeType: string; bytes: Uint8Array },
): Promise<string> {
  const data = await linearGraphql(
    apiKey,
    `mutation($contentType: String!, $filename: String!, $size: Int!) {
      fileUpload(contentType: $contentType, filename: $filename, size: $size) {
        success
        uploadFile { uploadUrl assetUrl headers { key value } }
      }
    }`,
    { contentType: input.mimeType, filename: input.name, size: input.bytes.byteLength },
  );
  const payload = data.fileUpload as {
    success?: unknown;
    uploadFile?: {
      uploadUrl?: unknown;
      assetUrl?: unknown;
      headers?: ReadonlyArray<{ key?: unknown; value?: unknown }> | null;
    } | null;
  } | null;
  const uploadFile = payload?.uploadFile;
  const uploadUrl = text(uploadFile?.uploadUrl);
  const assetUrl = text(uploadFile?.assetUrl);
  if (!payload?.success || !uploadUrl || !assetUrl) {
    throw new LinearApiError("Linear did not accept the file upload.");
  }
  const url = assertLinearUploadUrl(uploadUrl);

  // Every header Linear returns must be replayed verbatim (exact casing included) or the
  // signed URL answers 403. The URL expires in ~60s, so this follows the prepare at once.
  const headers: Record<string, string> = { "Content-Type": input.mimeType };
  for (const header of uploadFile?.headers ?? []) {
    const key = text(header.key);
    if (key) headers[key] = text(header.value);
  }

  const response = await outboundHttp.request({
    policy: {
      service: "linear-file-upload",
      allowedOrigins: [url.origin],
      timeoutMs: 60_000,
      maxRequestBytes: PROVIDER_SEND_TURN_MAX_IMAGE_BYTES,
      maxResponseBytes: 64 * 1024,
      maxRedirects: 0,
      maxConcurrent: 1,
      maxQueued: 8,
      requirePublicAddress: true,
    },
    url,
    method: "PUT",
    headers,
    body: input.bytes,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new LinearApiError(`Linear rejected the file upload with status ${response.status}.`);
  }
  return assetUrl;
}

export async function createLinearIssue(
  apiKey: string,
  workspace: LinearWorkspace,
  input: LinearCreateIssueInput,
): Promise<LinearIssue> {
  const data = await linearGraphql(
    apiKey,
    `mutation($input: IssueCreateInput!) {
      issueCreate(input: $input) { success issue { ${ISSUE_FIELDS} } }
    }`,
    {
      input: {
        title: input.title,
        teamId: input.teamId,
        ...(input.projectId ? { projectId: input.projectId } : {}),
        ...(input.cycleId ? { cycleId: input.cycleId } : {}),
        ...(input.description ? { description: input.description } : {}),
      },
    },
  );
  const payload = data.issueCreate as { success?: unknown; issue?: RawIssue | null } | null;
  const issue = payload?.issue ? toIssue(payload.issue, workspace) : null;
  if (!payload?.success || !issue) {
    throw new LinearApiError("Linear did not create the issue.");
  }
  return issue;
}
