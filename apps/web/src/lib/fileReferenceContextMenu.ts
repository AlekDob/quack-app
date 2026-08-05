// FILE: fileReferenceContextMenu.ts
// Purpose: Right-click menu shared by file rows, file previews, and chat file
//          chips (explorer, changed-file lists, dock file pane, markdown links).
// Layer: Web UI helpers
// Exports: resolveFileRevealAbsolutePath, revealInFolderLabel,
//          showFileReferenceContextMenu

import {
  isLocalAbsolutePath,
  isWorkspaceRelativePathSafe,
  joinWorkspaceRelativePath,
} from "@synara/shared/path";

import { formatSelectionLabel, type ChatFileReference } from "~/lib/chatReferences";
import { isMacPlatform, isWindowsPlatform } from "~/lib/utils";
import { readNativeApi } from "~/nativeApi";
import { toastManager } from "~/components/ui/toast";

// Trailing `:line` / `:line:col` suffix carried by resolved markdown file links.
const FILE_POSITION_SUFFIX_PATTERN = /:\d+(?::\d+)?$/;

/** Absolute filesystem path for `shell.showInFolder`, or null when unresolved. */
export function resolveFileRevealAbsolutePath(
  rawPath: string,
  workspaceRoot: string | null | undefined,
): string | null {
  const withoutPosition = rawPath.trim().replace(FILE_POSITION_SUFFIX_PATTERN, "");
  if (withoutPosition.length === 0) {
    return null;
  }
  if (isLocalAbsolutePath(withoutPosition)) {
    return withoutPosition;
  }
  if (
    workspaceRoot &&
    workspaceRoot.trim().length > 0 &&
    isWorkspaceRelativePathSafe(withoutPosition)
  ) {
    return joinWorkspaceRelativePath(workspaceRoot, withoutPosition);
  }
  return null;
}

/** Platform-native label for revealing a path in the OS file manager. */
export function revealInFolderLabel(platform = navigator.platform): string {
  if (isMacPlatform(platform)) {
    return "Reveal in Finder";
  }
  if (isWindowsPlatform(platform)) {
    return "Show in Explorer";
  }
  return "Show in Folder";
}

// Right-click menu shared by explorer rows, changed-file rows, the file
// preview, and chat stream file chips. Falls back to a no-op outside the
// desktop app (native contextMenu IPC is unavailable).
export async function showFileReferenceContextMenu(input: {
  path: string;
  position: { x: number; y: number };
  /** Workspace cwd used to resolve relative paths for Reveal in Finder. */
  workspaceRoot?: string | null | undefined;
  /** Line/column range from source views, or a quoted snippet from surfaces
   * without stable source lines (rendered markdown preview). */
  selection?: Omit<ChatFileReference, "path"> | null;
  onReferenceInChat: ((reference: ChatFileReference) => void) | undefined;
  onAskWhyInChat?: ((reference: ChatFileReference) => void) | undefined;
}): Promise<void> {
  const api = readNativeApi();
  if (!api) {
    return;
  }
  const reference: ChatFileReference = {
    path: input.path.replace(FILE_POSITION_SUFFIX_PATTERN, ""),
    ...input.selection,
  };
  const rangeLabel = formatSelectionLabel(reference);
  const hasSnippet = typeof reference.snippet === "string" && reference.snippet.trim().length > 0;
  const revealAbsolutePath = resolveFileRevealAbsolutePath(input.path, input.workspaceRoot);
  const clicked = await api.contextMenu.show(
    [
      ...(input.onReferenceInChat
        ? [
            {
              id: "reference-in-chat" as const,
              label: rangeLabel
                ? `Reference ${rangeLabel} in chat`
                : hasSnippet
                  ? "Reference selection in chat"
                  : "Mention in chat",
            },
          ]
        : []),
      ...(input.onAskWhyInChat
        ? [
            {
              id: "ask-why-in-chat" as const,
              label: rangeLabel ? `Ask why ${rangeLabel} changed` : "Ask why this changed",
            },
          ]
        : []),
      { id: "copy-path" as const, label: "Copy path" },
      ...(revealAbsolutePath
        ? [
            {
              id: "reveal-in-folder" as const,
              label: revealInFolderLabel(),
            },
          ]
        : []),
    ],
    input.position,
  );
  if (clicked === "reference-in-chat") {
    input.onReferenceInChat?.(reference);
    return;
  }
  if (clicked === "ask-why-in-chat") {
    input.onAskWhyInChat?.(reference);
    return;
  }
  if (clicked === "copy-path") {
    void navigator.clipboard?.writeText(reference.path);
    return;
  }
  if (clicked === "reveal-in-folder" && revealAbsolutePath) {
    try {
      await api.shell.showInFolder(revealAbsolutePath);
    } catch (error) {
      toastManager.add({
        type: "error",
        title: "Failed to reveal file",
        description: error instanceof Error ? error.message : "An error occurred.",
      });
    }
  }
}
