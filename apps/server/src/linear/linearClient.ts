// FILE: linear/linearClient.ts
// Purpose: Minimal Linear GraphQL client: list open issues, list create targets, create an issue.
// Layer: Server external integration

import {
  LINEAR_ISSUE_SEARCH_LIMIT,
  type LinearCreateIssueInput,
  type LinearCreateOptions,
  type LinearIssue,
} from "@synara/contracts";

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

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function toIssue(raw: RawIssue): LinearIssue | null {
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
    throw new LinearApiError("Linear rejected the API key. Check it in Settings, Integrations.");
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

/**
 * Open issues, newest activity first. With a search term we go through Linear's own
 * search so typing a ticket code ("ale-28") matches as well as words from the title.
 */
export async function searchLinearIssues(
  apiKey: string,
  term: string,
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
    const issue = toIssue(node);
    return issue ? [issue] : [];
  });
}

/** Teams and projects the key can write to, for the "new issue" form. */
export async function listLinearCreateOptions(apiKey: string): Promise<LinearCreateOptions> {
  const data = await linearGraphql(
    apiKey,
    `query {
      teams(first: 100) { nodes { id key name } }
      projects(first: 100) { nodes { id name teams(first: 25) { nodes { id } } } }
    }`,
    {},
  );
  const teams = (data.teams as { nodes?: ReadonlyArray<Record<string, unknown>> } | null)?.nodes;
  const projects = (data.projects as { nodes?: ReadonlyArray<Record<string, unknown>> } | null)
    ?.nodes;
  return {
    teams: (teams ?? []).map((team) => ({
      id: text(team.id),
      key: text(team.key),
      name: text(team.name),
    })),
    projects: (projects ?? []).map((project) => ({
      id: text(project.id),
      name: text(project.name),
      teamIds: (
        (project.teams as { nodes?: ReadonlyArray<{ id?: unknown }> } | null)?.nodes ?? []
      ).map((team) => text(team.id)),
    })),
  };
}

export async function createLinearIssue(
  apiKey: string,
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
      },
    },
  );
  const payload = data.issueCreate as { success?: unknown; issue?: RawIssue | null } | null;
  const issue = payload?.issue ? toIssue(payload.issue) : null;
  if (!payload?.success || !issue) {
    throw new LinearApiError("Linear did not create the issue.");
  }
  return issue;
}
