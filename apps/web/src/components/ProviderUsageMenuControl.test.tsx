// FILE: ProviderUsageMenuControl.test.tsx
// Purpose: Keeps header usage passive while the open Environment panel loads live provider usage.

import type { ProviderKind } from "@synara/contracts";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useProviderUsageMenuModel } from "./ProviderUsageMenuControl";

const mocks = vi.hoisted(() => ({
  useAppSettings: vi.fn(),
  useProviderUsageSummary: vi.fn(),
  useStore: vi.fn(),
}));

vi.mock("~/appSettings", () => ({ useAppSettings: mocks.useAppSettings }));
vi.mock("~/hooks/useProviderUsageSummary", () => ({
  useProviderUsageSummary: mocks.useProviderUsageSummary,
}));
vi.mock("~/store", () => ({ useStore: mocks.useStore }));
vi.mock("~/storeSelectors", () => ({ createAllThreadsSelector: () => () => [] }));

function readModel(provider: ProviderKind, fetchProviderData?: boolean) {
  function Probe() {
    useProviderUsageMenuModel(
      provider,
      fetchProviderData === undefined ? {} : { fetchProviderData },
    );
    return null;
  }

  renderToStaticMarkup(<Probe />);
}

beforeEach(() => {
  mocks.useAppSettings.mockReturnValue({ settings: { codexHomePath: "" } });
  mocks.useProviderUsageSummary.mockReturnValue({
    rateLimits: [],
    usageLines: [],
    usageNotice: undefined,
    isLoading: false,
  });
  mocks.useStore.mockReturnValue([]);
  mocks.useProviderUsageSummary.mockClear();
});

describe("useProviderUsageMenuModel", () => {
  it("keeps header usage passive by default", () => {
    readModel("codex");

    expect(mocks.useProviderUsageSummary).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "codex", fetchProviderData: false }),
    );
  });

  it.each(["claudeAgent", "cursor"] as const)(
    "loads live usage for %s when enabled",
    (provider) => {
      readModel(provider, true);

      expect(mocks.useProviderUsageSummary).toHaveBeenCalledWith(
        expect.objectContaining({ provider, fetchProviderData: true }),
      );
    },
  );
});
