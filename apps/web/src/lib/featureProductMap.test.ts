import { describe, expect, it } from "vitest";

import { topLevelFunctionaryNodes } from "./functionaryMap";
import {
  buildFeatureProductMap,
  colorForFeatureFileType,
  isFeatureDocFilename,
  parseFeatureProductDoc,
} from "./featureProductMap";

const sampleMarkdown = `---
type: feature-doc
tags: [composer, activity-strip]
---

## Composer Activity Strip

**Purpose:** One panel above the composer showing everything running right now.
**Stack:** React / TypeScript

### Files

| Type      | Path                                                          | Exports/Purpose |
| --------- | ------------------------------------------------------------- | --------------- |
| Logic     | \`apps/web/src/components/chat/ComposerActivityStrip.logic.ts\` | row types |
| Component | \`apps/web/src/components/chat/ComposerActivityStrip.tsx\`      | unified strip |
| Test      | \`apps/web/src/components/chat/ComposerActivityStrip.logic.test.ts\` | tests |

### Data Flow

- Subagents stay as they were.
`;

describe("isFeatureDocFilename", () => {
  it("accepts numbered feature docs", () => {
    expect(isFeatureDocFilename("015-composer-activity-strip.md")).toBe(true);
  });

  it("rejects other markdown", () => {
    expect(isFeatureDocFilename("README.md")).toBe(false);
  });
});

describe("parseFeatureProductDoc", () => {
  it("builds a parent from the slug and children from the Files table", () => {
    const parsed = parseFeatureProductDoc("015-composer-activity-strip.md", sampleMarkdown);
    expect(parsed?.feature).toMatchObject({
      id: "composer-activity-strip",
      label: "Composer Activity Strip",
      description: "One panel above the composer showing everything running right now.",
      parentId: "scope:composer",
    });
    expect(parsed?.files).toHaveLength(3);
    expect(parsed?.files.map((file) => file.id)).toEqual([
      "composer-activity-strip:apps/web/src/components/chat/ComposerActivityStrip.logic.ts",
      "composer-activity-strip:apps/web/src/components/chat/ComposerActivityStrip.tsx",
      "composer-activity-strip:apps/web/src/components/chat/ComposerActivityStrip.logic.test.ts",
    ]);
    expect(parsed?.files.map((file) => file.label)).toEqual([
      "ComposerActivityStrip.logic.ts",
      "ComposerActivityStrip.tsx",
      "ComposerActivityStrip.logic.test.ts",
    ]);
    expect(parsed?.files.map((file) => file.display?.color)).toEqual([
      colorForFeatureFileType("Logic"),
      colorForFeatureFileType("Component"),
      colorForFeatureFileType("Test"),
    ]);
  });

  it("keeps a building with no children when Files is missing", () => {
    const parsed = parseFeatureProductDoc(
      "002-brand-mark.md",
      "## Brand Mark\n\n**Purpose:** The duck.\n",
    );
    expect(parsed?.feature.id).toBe("brand-mark");
    expect(parsed?.files).toEqual([]);
  });
});

describe("colorForFeatureFileType", () => {
  it("maps known types and falls back for others", () => {
    expect(colorForFeatureFileType("Component")).toBe("#81afa6");
    expect(colorForFeatureFileType("Server")).toBe("#b17f9f");
    expect(colorForFeatureFileType("Contracts")).toBe("#7a9bb8");
    expect(colorForFeatureFileType("Test")).toBe("#d2a36c");
    expect(colorForFeatureFileType("Native")).toBe("#c48b8b");
    expect(colorForFeatureFileType("Logic")).toBe("#9b87b4");
    expect(colorForFeatureFileType("Consumer")).toBe("#c8dfe2");
  });
});

describe("buildFeatureProductMap", () => {
  it("groups features under the first tag and hides rooms from the top level", () => {
    const map = buildFeatureProductMap([
      { filename: "015-composer-activity-strip.md", contents: sampleMarkdown },
    ]);
    expect(topLevelFunctionaryNodes(map).map((node) => node.id)).toEqual([
      "composer-activity-strip",
    ]);
    expect(map.edges).toEqual([]);
    expect(map.nodes.some((node) => node.id === "scope:composer" && node.kind === "scope")).toBe(
      true,
    );
  });
});
