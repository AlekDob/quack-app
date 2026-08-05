import { describe, expect, it } from "vitest";

import { resolveFileRevealAbsolutePath, revealInFolderLabel } from "./fileReferenceContextMenu";

describe("resolveFileRevealAbsolutePath", () => {
  it("returns absolute paths unchanged after stripping position suffixes", () => {
    expect(resolveFileRevealAbsolutePath("/repo/app/src/a.ts:12:4", "/repo/app")).toBe(
      "/repo/app/src/a.ts",
    );
  });

  it("joins workspace-relative paths to the workspace root", () => {
    expect(resolveFileRevealAbsolutePath("docs/recap.md", "/repo/app")).toBe(
      "/repo/app/docs/recap.md",
    );
  });

  it("returns null when a relative path has no workspace root", () => {
    expect(resolveFileRevealAbsolutePath("docs/recap.md", null)).toBeNull();
  });

  it("rejects relative paths that escape the workspace", () => {
    expect(resolveFileRevealAbsolutePath("../outside.ts", "/repo/app")).toBeNull();
  });
});

describe("revealInFolderLabel", () => {
  it("uses Finder on macOS", () => {
    expect(revealInFolderLabel("MacIntel")).toBe("Reveal in Finder");
  });

  it("uses Explorer on Windows", () => {
    expect(revealInFolderLabel("Win32")).toBe("Show in Explorer");
  });

  it("uses Folder elsewhere", () => {
    expect(revealInFolderLabel("Linux x86_64")).toBe("Show in Folder");
  });
});
