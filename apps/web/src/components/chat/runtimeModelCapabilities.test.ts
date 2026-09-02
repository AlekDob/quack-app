import type { ProviderModelDescriptor } from "@synara/contracts";
import { describe, expect, it } from "vitest";

import {
  getRuntimeAwareModelCapabilities,
  resolveRuntimeModelDescriptor,
} from "./runtimeModelCapabilities";

describe("resolveRuntimeModelDescriptor", () => {
  it("matches a Claude model by its resolved canonical id", () => {
    const runtimeModels: ReadonlyArray<ProviderModelDescriptor> = [
      {
        slug: "sonnet",
        resolvedModel: "claude-sonnet-5",
        name: "Claude Sonnet 5",
        supportsAutoMode: false,
      },
    ];

    expect(
      resolveRuntimeModelDescriptor({
        provider: "claudeAgent",
        model: "claude-sonnet-5",
        runtimeModels,
      }),
    ).toBe(runtimeModels[0]);
  });
});

describe("getRuntimeAwareModelCapabilities for a Claude model Quack has never heard of", () => {
  const runtimeModel: ProviderModelDescriptor = {
    slug: "claude-fable-9[1m]",
    resolvedModel: "claude-fable-9",
    name: "Fable",
    supportedReasoningEfforts: [{ value: "low" }, { value: "high" }, { value: "max" }],
    supportsFastMode: false,
  };

  it("takes its effort ladder from runtime discovery", () => {
    const capabilities = getRuntimeAwareModelCapabilities({
      provider: "claudeAgent",
      model: "claude-fable-9",
      runtimeModel,
    });

    expect(capabilities.reasoningEffortLevels.map((effort) => effort.value)).toEqual([
      "low",
      "high",
      "max",
      "ultracode",
    ]);
    expect(capabilities.supportsFastMode).toBe(false);
    // Auto-compact is a Claude-wide control, so it must survive the unknown slug.
    expect(capabilities.autoCompactWindowOptions?.length).toBeGreaterThan(0);
  });
});
