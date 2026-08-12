// FILE: ProjectPicker.logic.ts
// Purpose: Pure helpers for the project picker — selection dispatch, path formatting, platform sniffing.
// Exports: ActiveFolderOption, startActiveFolderSelection, basenameOfPath, directorySearchHaystack, joinDirectoryPath, getNavigatorPlatform

import { type ProjectDirectoryEntry, type ProjectId, type SpaceId } from "@synara/contracts";

export interface ActiveFolderOption {
  projectId: ProjectId | null;
  spaceId: SpaceId | null;
  spaceName: string;
  cwd: string;
  primaryLabel: string;
  secondaryLabel: string | null;
}

/**
 * Existing projects switch the draft into that project; raw paths stay workspace roots.
 *
 * Kept out of the component: the caller runs this inside a `try`, and React Compiler cannot lower a
 * conditional expression there — inlining it makes the whole picker skip compilation.
 */
export function startActiveFolderSelection(
  folder: ActiveFolderOption,
  handlers: {
    isProjectSelectionMode: boolean;
    onSelectProject?: ((projectId: ProjectId) => void | Promise<void>) | undefined;
    onSelectWorkspaceRoot?: ((workspaceRoot: string) => void) | undefined;
  },
): void | Promise<void> {
  if (folder.projectId && handlers.onSelectProject) {
    return handlers.onSelectProject(folder.projectId);
  }
  if (handlers.isProjectSelectionMode) {
    return undefined;
  }
  return handlers.onSelectWorkspaceRoot?.(folder.cwd);
}

export function basenameOfPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const normalized = value.replace(/[\\/]+$/, "");
  const separatorIndex = Math.max(normalized.lastIndexOf("/"), normalized.lastIndexOf("\\"));
  const basename = separatorIndex === -1 ? normalized : normalized.slice(separatorIndex + 1);
  return basename.length > 0 ? basename : null;
}

export function directorySearchHaystack(entry: ProjectDirectoryEntry): string {
  return [entry.name, entry.path].join(" ").toLowerCase();
}

export function joinDirectoryPath(rootPath: string, relativePath: string): string {
  if (!relativePath) return rootPath;
  const separator = rootPath.includes("\\") ? "\\" : "/";
  const normalizedRoot = rootPath.endsWith(separator) ? rootPath.slice(0, -1) : rootPath;
  const normalizedRelative = relativePath.split(/[\\/]+/).join(separator);
  return `${normalizedRoot}${separator}${normalizedRelative}`;
}

export function getNavigatorPlatform(): string {
  const navigatorLike = globalThis.navigator as
    | (Navigator & { userAgentData?: { platform?: string } })
    | undefined;
  return [navigatorLike?.platform, navigatorLike?.userAgentData?.platform]
    .filter(Boolean)
    .join(" ");
}
