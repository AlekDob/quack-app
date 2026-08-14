import { Schema } from "effect";

import { TrimmedNonEmptyString } from "./baseSchemas";

export const LINEAR_ISSUE_SEARCH_LIMIT = 20;

export const LinearIssue = Schema.Struct({
  id: TrimmedNonEmptyString,
  // Human ticket code, e.g. "ALE-28". Used as the thread title prefix.
  identifier: TrimmedNonEmptyString,
  title: Schema.String,
  url: Schema.String,
  stateName: Schema.String,
  projectName: Schema.NullOr(Schema.String),
});
export type LinearIssue = typeof LinearIssue.Type;

export const LinearSearchIssuesInput = Schema.Struct({
  query: Schema.optional(Schema.String.check(Schema.isMaxLength(256))),
});
export type LinearSearchIssuesInput = typeof LinearSearchIssuesInput.Type;

export const LinearTeam = Schema.Struct({
  id: TrimmedNonEmptyString,
  key: Schema.String,
  name: Schema.String,
});
export type LinearTeam = typeof LinearTeam.Type;

export const LinearProject = Schema.Struct({
  id: TrimmedNonEmptyString,
  name: Schema.String,
  teamIds: Schema.Array(Schema.String),
});
export type LinearProject = typeof LinearProject.Type;

export const LinearCreateOptions = Schema.Struct({
  teams: Schema.Array(LinearTeam),
  projects: Schema.Array(LinearProject),
});
export type LinearCreateOptions = typeof LinearCreateOptions.Type;

export const LinearCreateIssueInput = Schema.Struct({
  title: TrimmedNonEmptyString.check(Schema.isMaxLength(256)),
  teamId: TrimmedNonEmptyString,
  projectId: Schema.optional(TrimmedNonEmptyString),
});
export type LinearCreateIssueInput = typeof LinearCreateIssueInput.Type;
