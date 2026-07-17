import { describe, expect, it } from "vitest";
import type { ToolCall } from "../ai";
import {
  batchDiffTotals,
  batchSummaryLabel,
  detailToolLabel,
  readLineRange,
  type BatchItem,
} from "./chatActionSummary";

function item(name: string, args: Record<string, unknown> = {}, id?: string): BatchItem {
  const call: ToolCall = { id: id ?? name, function: { name, arguments: args } };
  return { id: call.id!, call };
}

describe("batchSummaryLabel", () => {
  it("uses present tense when live", () => {
    const items = [
      item("Read", { file_path: "a.ts" }, "1"),
      item("Grep", { pattern: "foo" }, "2"),
    ];
    expect(batchSummaryLabel(items, { live: true })).toBe(
      "Exploring 1 file, 1 search",
    );
  });

  it("uses past tense when done", () => {
    const items = [
      item("Read", { file_path: "a.ts" }, "1"),
      item("Read", { file_path: "b.ts" }, "2"),
      item("Grep", { pattern: "x" }, "3"),
    ];
    expect(batchSummaryLabel(items, { live: false })).toBe(
      "Explored 2 files, 1 search",
    );
  });

  it("includes commands and edits", () => {
    const items = [
      item("Bash", { command: "ls" }, "1"),
      item("Edit", { file_path: "a.ts", old_string: "a", new_string: "ab" }, "2"),
    ];
    expect(batchSummaryLabel(items, { live: true })).toBe(
      "Running 1 command, Editing 1 file",
    );
    expect(batchSummaryLabel(items, { live: false })).toContain("Ran ls");
    expect(batchSummaryLabel(items, { live: false })).toContain("Edited 1 file");
  });

  it("hides edits when hideEdits", () => {
    const items = [
      item("Read", { file_path: "a.ts" }, "1"),
      item("Edit", { file_path: "a.ts", old_string: "a", new_string: "b" }, "2"),
    ];
    expect(batchSummaryLabel(items, { live: false, hideEdits: true })).toBe(
      "Explored 1 file",
    );
  });
});

describe("readLineRange", () => {
  it("formats Lstart-end from offset/limit", () => {
    expect(readLineRange({ offset: 1, limit: 80 })).toBe("L1-80");
    expect(readLineRange({ offset: 10, limit: 5 })).toBe("L10-14");
    expect(readLineRange({})).toBe("");
  });
});

describe("detailToolLabel", () => {
  it("phrases Grep and Read with ranges", () => {
    expect(
      detailToolLabel({
        function: {
          name: "Grep",
          arguments: { pattern: "foo", path: "src" },
        },
      }),
    ).toBe("Grepped foo in src");
    expect(
      detailToolLabel({
        function: {
          name: "Read",
          arguments: { file_path: "hubPrefs.ts", offset: 1, limit: 80 },
        },
      }),
    ).toBe("Read hubPrefs.ts L1-80");
  });
});

describe("batchDiffTotals", () => {
  it("sums edit diffs", () => {
    const items = [
      item(
        "Edit",
        { file_path: "a.ts", old_string: "a\nb", new_string: "a\nb\nc" },
        "1",
      ),
    ];
    const t = batchDiffTotals(items);
    expect(t).not.toBeNull();
    expect(t!.added).toBeGreaterThan(0);
  });
});
