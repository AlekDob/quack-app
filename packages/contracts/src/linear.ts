import { Schema } from "effect";

import { TrimmedNonEmptyString } from "./baseSchemas";

export const LINEAR_ISSUE_SEARCH_LIMIT = 20;
export const LINEAR_WORKSPACE_LIMIT = 8;
export const LINEAR_WORKSPACE_LABEL_MAX = 64;

export const LinearWorkspace = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: TrimmedNonEmptyString,
  urlKey: TrimmedNonEmptyString,
  // User-chosen name in Settings / @ picker. Empty or absent → Linear org `name`.
  label: Schema.optional(Schema.String.check(Schema.isMaxLength(LINEAR_WORKSPACE_LABEL_MAX))),
});
export type LinearWorkspace = typeof LinearWorkspace.Type;

export const LinearIssue = Schema.Struct({
  id: TrimmedNonEmptyString,
  // Human ticket code, e.g. "ALE-28". Used as the thread title prefix.
  identifier: TrimmedNonEmptyString,
  title: Schema.String,
  url: Schema.String,
  stateName: Schema.String,
  projectName: Schema.NullOr(Schema.String),
  workspaceId: TrimmedNonEmptyString,
  workspaceName: TrimmedNonEmptyString,
  workspaceUrlKey: TrimmedNonEmptyString,
});
export type LinearIssue = typeof LinearIssue.Type;

export const LinearSearchIssuesInput = Schema.Struct({
  query: Schema.optional(Schema.String.check(Schema.isMaxLength(256))),
});
export type LinearSearchIssuesInput = typeof LinearSearchIssuesInput.Type;

export const LinearCycle = Schema.Struct({
  id: TrimmedNonEmptyString,
  number: Schema.Number,
  name: Schema.NullOr(Schema.String),
  startsAt: Schema.String,
  endsAt: Schema.String,
  isActive: Schema.Boolean,
});
export type LinearCycle = typeof LinearCycle.Type;

export const LinearTeam = Schema.Struct({
  id: TrimmedNonEmptyString,
  key: Schema.String,
  name: Schema.String,
  cycles: Schema.Array(LinearCycle),
});
export type LinearTeam = typeof LinearTeam.Type;

export const LinearProject = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: Schema.String,
  teamIds: Schema.Array(Schema.String),
});
export type LinearProject = typeof LinearProject.Type;

export const LinearWorkspaceCreateOptions = Schema.Struct({
  workspace: LinearWorkspace,
  teams: Schema.Array(LinearTeam),
  projects: Schema.Array(LinearProject),
});
export type LinearWorkspaceCreateOptions = typeof LinearWorkspaceCreateOptions.Type;

export const LinearCreateOptions = Schema.Struct({
  workspaces: Schema.Array(LinearWorkspaceCreateOptions),
});
export type LinearCreateOptions = typeof LinearCreateOptions.Type;

export const LinearCreateIssueInput = Schema.Struct({
  workspaceId: TrimmedNonEmptyString,
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
  teamId: TrimmedNonEmptyString,
  projectId: Schema.optional(TrimmedNonEmptyString),
  cycleId: Schema.optional(TrimmedNonEmptyString),
  // Markdown body. Pasted images are appended as `![name](assetUrl)` by the client.
  description: Schema.optional(TrimmedNonEmptyString.check(Schema.isMaxLength(16_000))),
});
export type LinearCreateIssueInput = typeof LinearCreateIssueInput.Type;
