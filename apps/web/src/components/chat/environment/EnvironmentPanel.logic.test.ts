import { describe, expect, it } from "vitest";

import type { GitStatusResult } from "@synara/contracts";

import { buildGitStatusSummary, shouldShowStudioFolderRow } from "./EnvironmentPanel.logic";

function status(overrides: Partial<GitStatusResult> = {}): GitStatusResult {
  return {
    branch: "main",
    hasWorkingTreeChanges: false,
    workingTree: { files: [], insertions: 0, deletions: 0 },
    hasUpstream: true,
    upstreamBranch: "main",
    aheadCount: 0,
    behindCount: 0,
    pr: null,
    ...overrides,
  };
}

describe("shouldShowStudioFolderRow", () => {
  it("shows a picked Studio reference folder only when the native shell can open it", () => {
    expect(
      shouldShowStudioFolderRow({
        isStudioChat: true,
        studioFolderPath: "/Users/tester/Projects/demo",
        nativeShellAvailable: true,
      }),
    ).toBe(true);
    expect(
      shouldShowStudioFolderRow({
        isStudioChat: true,
        studioFolderPath: "/Users/tester/Projects/demo",
        nativeShellAvailable: false,
      }),
    ).toBe(false);
  });

  it("hides the row outside Studio and when no folder was picked", () => {
    expect(
      shouldShowStudioFolderRow({
        isStudioChat: false,
        studioFolderPath: "/Users/tester/Projects/demo",
        nativeShellAvailable: true,
      }),
    ).toBe(false);
    expect(
      shouldShowStudioFolderRow({
        isStudioChat: true,
        studioFolderPath: null,
        nativeShellAvailable: true,
      }),
    ).toBe(false);
  });
});

describe("buildGitStatusSummary", () => {
  it("shows commit, pull, and push work together", () => {
    expect(
      buildGitStatusSummary(
        status({
          hasWorkingTreeChanges: true,
          workingTree: {
            files: [{ path: "src/app.ts", insertions: 1, deletions: 0 }],
            insertions: 1,
            deletions: 0,
          },
          behindCount: 2,
          aheadCount: 3,
        }),
      ),
    ).toEqual([
      { type: "commit", tone: "warning", label: "1 change to commit" },
      { type: "pull", tone: "warning", label: "Pull 2" },
      { type: "push", tone: "success", label: "Push 3" },
    ]);
  });

  it("hides the summary when Git is clean and aligned", () => {
    expect(buildGitStatusSummary(status())).toEqual([]);
  });
});
