// FILE: EnvironmentPanel.logic.ts
// Purpose: Pure visibility policy for Environment panel actions.
// Layer: Web UI logic

import type { GitStatusResult } from "@synara/contracts";

export type GitStatusSummaryItem = {
  label: string;
  tone: "success" | "warning";
  type: "commit" | "pull" | "push";
};

export function shouldShowStudioFolderRow(input: {
  isStudioChat: boolean;
  studioFolderPath: string | null;
  nativeShellAvailable: boolean;
}): boolean {
  return input.isStudioChat && Boolean(input.studioFolderPath) && input.nativeShellAvailable;
}

export function buildGitStatusSummary(status: GitStatusResult): GitStatusSummaryItem[] {
  const items: GitStatusSummaryItem[] = [];
  const changedFiles = status.workingTree.files.length;

  if (status.hasWorkingTreeChanges) {
    items.push({
      type: "commit",
      tone: "warning",
      label: `${changedFiles} ${changedFiles === 1 ? "change" : "changes"} to commit`,
    });
  }
  if (status.behindCount > 0) {
    items.push({ type: "pull", tone: "warning", label: `Pull ${status.behindCount}` });
  }
  if (status.aheadCount > 0) {
    items.push({ type: "push", tone: "success", label: `Push ${status.aheadCount}` });
  }

  return items;
}
