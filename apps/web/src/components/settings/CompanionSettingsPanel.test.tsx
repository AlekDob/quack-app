import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const listModels = vi.fn();

vi.mock("~/nativeApi", () => ({
  ensureNativeApi: () => ({ provider: { listModels } }),
}));

import { CompanionTestStatus, runCompanionConnectionTest } from "./CompanionSettingsPanel";

describe("runCompanionConnectionTest", () => {
  beforeEach(() => {
    listModels.mockReset();
  });

  it("asks the astronaut adapter for models at the given URL", async () => {
    listModels.mockResolvedValue({ models: [{ slug: "a" }, { slug: "b" }] });

    const result = await runCompanionConnectionTest("http://imac-di-alek:4567");

    expect(listModels).toHaveBeenCalledWith({
      provider: "astronaut",
      apiEndpoint: "http://imac-di-alek:4567",
    });
    expect(result.models).toBe(2);
  });

  it("surfaces the failure so the panel can report an unreachable Companion", async () => {
    listModels.mockRejectedValue(new Error("fetch failed"));

    await expect(runCompanionConnectionTest("http://nope:4567")).rejects.toThrow("fetch failed");
  });
});

describe("CompanionTestStatus", () => {
  it("reports the model count on success", () => {
    const markup = renderToStaticMarkup(
      <CompanionTestStatus
        test={{ isPending: false, data: { models: 1, ms: 320 }, error: null }}
      />,
    );

    expect(markup).toContain("Connected · 1 model · 320 ms");
  });

  it("reports the error message on failure", () => {
    const markup = renderToStaticMarkup(
      <CompanionTestStatus
        test={{ isPending: false, data: undefined, error: new Error("fetch failed") }}
      />,
    );

    expect(markup).toContain("fetch failed");
  });

  it("renders nothing before the first test", () => {
    expect(
      renderToStaticMarkup(
        <CompanionTestStatus test={{ isPending: false, data: undefined, error: null }} />,
      ),
    ).toBe("");
  });
});
