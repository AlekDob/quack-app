import { describe, expect, it } from "vitest";
import type { ToolCall } from "./ai";
import {
  featureSlugFromDelegateResult,
  featureSlugFromEditPath,
  featureSlugFromResultText,
  featureSlugFromToolCall,
  isDelegatingTool,
} from "./featureChatAutoLink";

const ROOT = "/Users/me/proj";

function call(
  name: string,
  args: Record<string, unknown>,
  id = "t1",
): ToolCall {
  return { id, function: { name, arguments: args } };
}

describe("featureSlugFromEditPath", () => {
  it("accepts abs path under documentation/features", () => {
    expect(
      featureSlugFromEditPath(
        `${ROOT}/documentation/features/104-scadenzario-avviso.md`,
        ROOT,
      ),
    ).toBe("104-scadenzario-avviso");
  });

  it("accepts relative FEATURE_DIR path", () => {
    expect(
      featureSlugFromEditPath(
        "documentation/features/054-works-layer.md",
        ROOT,
      ),
    ).toBe("054-works-layer");
  });

  it("rejects diary and non-NNN basename", () => {
    expect(
      featureSlugFromEditPath(
        `${ROOT}/documentation/diary/2026-07-20.md`,
        ROOT,
      ),
    ).toBeNull();
    expect(
      featureSlugFromEditPath(
        `${ROOT}/documentation/features/readme.md`,
        ROOT,
      ),
    ).toBeNull();
  });

  it("rejects nested paths under features/", () => {
    expect(
      featureSlugFromEditPath(
        `${ROOT}/documentation/features/sub/054-works-layer.md`,
        ROOT,
      ),
    ).toBeNull();
  });

  it("rejects unknown sentinel", () => {
    expect(featureSlugFromEditPath("(unknown)", ROOT)).toBeNull();
  });
});

describe("featureSlugFromToolCall", () => {
  it("picks slug from Write of a feature doc", () => {
    expect(
      featureSlugFromToolCall(
        call("Write", {
          file_path: `${ROOT}/documentation/features/113-inbox-tool-rail.md`,
          content: "# 113\n",
        }),
        ROOT,
      ),
    ).toBe("113-inbox-tool-rail");
  });

  it("ignores non-edit tools", () => {
    expect(
      featureSlugFromToolCall(
        call("Read", {
          file_path: `${ROOT}/documentation/features/113-inbox-tool-rail.md`,
        }),
        ROOT,
      ),
    ).toBeNull();
  });
});

describe("featureSlugFromDelegateResult", () => {
  it("parses feature-creator Skill result", () => {
    const text =
      'Skill "feature-creator" completed (forked execution).\n\n' +
      "Result:\nFeature doc created at " +
      "`/Users/me/proj/documentation/features/113-inbox-tool-rail.md`.\n";
    expect(
      featureSlugFromDelegateResult(call("Skill", { skill: "feature-creator" }), text),
    ).toBe("113-inbox-tool-rail");
  });

  it("ignores Read results that mention a feature path", () => {
    expect(
      featureSlugFromDelegateResult(
        call("Read", {
          file_path: `${ROOT}/documentation/features/113-inbox-tool-rail.md`,
        }),
        "---\ntype: feature\n",
      ),
    ).toBeNull();
  });

  it("accepts explicit created-at wording on any tool", () => {
    expect(
      featureSlugFromDelegateResult(
        call("Bash", { command: "echo ok" }),
        "Feature doc created at documentation/features/054-works-layer.md",
      ),
    ).toBe("054-works-layer");
  });

  it("rejects errors", () => {
    expect(
      featureSlugFromDelegateResult(
        call("Skill", { skill: "feature-creator" }),
        "Error: skill failed",
        true,
      ),
    ).toBeNull();
  });
});

describe("featureSlugFromResultText", () => {
  it("returns the last feature path in text", () => {
    expect(
      featureSlugFromResultText(
        "saw documentation/features/112-old.md then " +
          "documentation/features/113-inbox-tool-rail.md",
      ),
    ).toBe("113-inbox-tool-rail");
  });
});

describe("isDelegatingTool", () => {
  it("matches Skill/Task/Agent", () => {
    expect(isDelegatingTool("Skill")).toBe(true);
    expect(isDelegatingTool("Task")).toBe(true);
    expect(isDelegatingTool("Agent")).toBe(true);
    expect(isDelegatingTool("Write")).toBe(false);
  });
});
