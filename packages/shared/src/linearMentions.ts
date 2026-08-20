// FILE: linearMentions.ts
// Purpose: Shared `linear://` mention path convention for composer Linear issue mentions.
// Layer: Shared runtime utilities (consumed by both server and web)
// Exports: LINEAR_MENTION_PATH_PREFIX, isLinearMentionPath, linearMentionPathForIdentifier,
//          parseLinearMentionPath, identifierFromLinearMentionPath, linearIssueWebUrlForIdentifier,
//          linearMentionNameFromIssue, linearWorkspaceDisplayName

export const LINEAR_MENTION_PATH_PREFIX = "linear://";

export type LinearMentionRef = {
  identifier: string;
  urlKey: string | null;
};

export function isLinearMentionPath(path: string): boolean {
  return path.startsWith(LINEAR_MENTION_PATH_PREFIX);
}

export function linearMentionPathForIdentifier(identifier: string, urlKey?: string | null): string {
  const id = identifier.trim();
  const key = urlKey?.trim() ?? "";
  return key.length > 0
    ? `${LINEAR_MENTION_PATH_PREFIX}${key}/${id}`
    : `${LINEAR_MENTION_PATH_PREFIX}${id}`;
}

export function parseLinearMentionPath(path: string): LinearMentionRef | null {
  if (!isLinearMentionPath(path)) return null;
  const rest = path.slice(LINEAR_MENTION_PATH_PREFIX.length).trim();
  if (rest.length === 0) return null;
  const slash = rest.indexOf("/");
  if (slash === -1) {
    return { identifier: rest, urlKey: null };
  }
  const urlKey = rest.slice(0, slash).trim();
  const identifier = rest.slice(slash + 1).trim();
  if (urlKey.length === 0 || identifier.length === 0 || identifier.includes("/")) {
    return null;
  }
  return { identifier, urlKey };
}

export function identifierFromLinearMentionPath(path: string): string | null {
  return parseLinearMentionPath(path)?.identifier ?? null;
}

export function linearIssueWebUrlForIdentifier(identifier: string, urlKey?: string | null): string {
  const key = urlKey?.trim() ?? "";
  return key.length > 0
    ? `https://linear.app/${key}/issue/${identifier}`
    : `https://linear.app/issue/${identifier}`;
}

export function linearMentionNameFromIssue(issue: { identifier: string; title: string }): string {
  return `${issue.identifier} ${issue.title}`;
}

/** Settings / @ picker name. `label` is the user's nickname; `name` is Linear's org. */
export function linearWorkspaceDisplayName(workspace: {
  name: string;
  label?: string | null | undefined;
}): string {
  const label = workspace.label?.trim() ?? "";
  return label.length > 0 ? label : workspace.name;
}
