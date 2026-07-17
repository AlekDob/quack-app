import { describe, expect, it } from "vitest";
import type { ToolCall } from "../ai";
import {
  batchDiffTotals,
  batchSummaryLabel,
  batchRenderCost,
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

  it("puts Edited first with lowercase explored (Cursor order)", () => {
    const items = [
      item("Edit", { file_path: "a.ts", old_string: "a", new_string: "ab" }, "1"),
      item("Edit", { file_path: "b.ts", old_string: "x", new_string: "xy" }, "2"),
      item("Read", { file_path: "c.ts" }, "3"),
    ];
    expect(batchSummaryLabel(items, { live: false })).toBe(
      "Edited 2 files, explored 1 file",
    );
  });

  it("single-file edit uses basename", () => {
    const items = [
      item(
        "Edit",
        { file_path: "src/formatWorkedDuration.ts", old_string: "a", new_string: "ab" },
        "1",
      ),
    ];
    expect(batchSummaryLabel(items, { live: false })).toBe(
      "Edited formatWorkedDuration.ts",
    );
  });

  it("includes commands with edits", () => {
    const items = [
      item("Bash", { command: "ls" }, "1"),
      item("Edit", { file_path: "a.ts", old_string: "a", new_string: "ab" }, "2"),
    ];
    expect(batchSummaryLabel(items, { live: true })).toContain("Editing");
    expect(batchSummaryLabel(items, { live: true })).toContain("Running 1 command");
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

describe("batchRenderCost (collapsed loads less text)", () => {
  function bigExploreBatch(n: number): BatchItem[] {
    const out: BatchItem[] = [];
    for (let i = 0; i < n; i++) {
      if (i % 3 === 0) {
        out.push(
          item(
            "Grep",
            {
              pattern: `very-long-pattern-with-lots-of-chars-${i}-`.repeat(4),
              path: `src/deep/nested/path/module-${i}/index.ts`,
            },
            `g${i}`,
          ),
        );
      } else {
        out.push(
          item(
            "Read",
            {
              file_path: `documentation/features/${String(i).padStart(3, "0")}-long-feature-name.md`,
              offset: 1,
              limit: 80,
            },
            `r${i}`,
          ),
        );
      }
    }
    return out;
  }

  function editHeavyBatch(n: number): BatchItem[] {
    const body = "x".repeat(400);
    return Array.from({ length: n }, (_, i) =>
      item(
        "Edit",
        {
          file_path: `src/components/File${i}.tsx`,
          old_string: body,
          new_string: `${body}\n${body}`,
        },
        `e${i}`,
      ),
    );
  }

  it("collapsed explore batch is one short line vs N detail lines", () => {
    const items = bigExploreBatch(24);
    const collapsed = batchRenderCost(items, "collapsed");
    const expanded = batchRenderCost(items, "expanded");
    expect(collapsed.lines).toBe(1);
    expect(expanded.lines).toBeGreaterThan(20);
    // Default paint mounts far less text than expanding every Grep/Read.
    expect(collapsed.chars).toBeLessThan(expanded.chars / 5);
    expect(collapsed.chars).toBeLessThan(80);
  });

  it("collapsed edit batch avoids mounting diff bodies until expand", () => {
    const items = editHeavyBatch(8);
    const collapsed = batchRenderCost(items, "collapsed");
    const expanded = batchRenderCost(items, "expanded");
    expect(collapsed.lines).toBe(1);
    expect(collapsed.chars).toBeLessThan(60);
    // Expanded pays for old+new bodies — orders of magnitude more.
    expect(expanded.chars).toBeGreaterThan(collapsed.chars * 50);
  });

  it("solo tool stays one line (no group overhead)", () => {
    const items = [
      item(
        "Edit",
        {
          file_path: "openapi.yaml",
          old_string: "a".repeat(200),
          new_string: "b".repeat(200),
        },
        "1",
      ),
    ];
    const collapsed = batchRenderCost(items, "collapsed");
    const expanded = batchRenderCost(items, "expanded");
    expect(collapsed.lines).toBe(1);
    expect(expanded.lines).toBe(1);
    expect(collapsed.chars).toBe(expanded.chars);
  });
});
