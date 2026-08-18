// FILE: linearMentions.ts
// Purpose: Shared `linear://` mention path convention for composer Linear issue mentions.
// Layer: Shared runtime utilities (consumed by both server and web)
// Exports: LINEAR_MENTION_PATH_PREFIX, isLinearMentionPath, linearMentionPathForIdentifier,
//          identifierFromLinearMentionPath, linearIssueWebUrlForIdentifier,
//          linearMentionNameFromIssue

export const LINEAR_MENTION_PATH_PREFIX = "linear://";

export function isLinearMentionPath(path: string): boolean {
  return path.startsWith(LINEAR_MENTION_PATH_PREFIX);
}

export function linearMentionPathForIdentifier(identifier: string): string {
  return `${LINEAR_MENTION_PATH_PREFIX}${identifier}`;
}

export function identifierFromLinearMentionPath(path: string): string | null {
  if (!isLinearMentionPath(path)) return null;
  const identifier = path.slice(LINEAR_MENTION_PATH_PREFIX.length).trim();
  return identifier.length > 0 ? identifier : null;
}

export function linearIssueWebUrlForIdentifier(identifier: string): string {
  return `https://linear.app/issue/${identifier}`;
}

export function linearMentionNameFromIssue(issue: {
  identifier: string;
  title: string;
}): string {
  return `${issue.identifier} ${issue.title}`;
}
