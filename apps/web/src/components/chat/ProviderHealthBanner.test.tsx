// FILE: ProviderHealthBanner.test.tsx
// Purpose: Guards the composer-adjacent provider status banner copy and dismiss control.
// Layer: Component rendering tests
// Depends on: the banner component and React server rendering.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { ServerProviderStatus } from "@synara/contracts";

import { ProviderHealthBanner } from "./ProviderHealthBanner";

function unavailableClaudeStatus(
  overrides: Partial<ServerProviderStatus> = {},
): ServerProviderStatus {
  return {
    provider: "claudeAgent",
    available: false,
    status: "error",
    authStatus: "unauthenticated",
    checkedAt: "2026-08-21T00:00:00.000Z",
    message: "Claude is not authenticated. Run `claude auth login` and try again.",
    ...overrides,
  };
}

describe("ProviderHealthBanner", () => {
  it("renders the provider status message for unavailable providers", () => {
    const markup = renderToStaticMarkup(
      <ProviderHealthBanner status={unavailableClaudeStatus()} />,
    );

    expect(markup).toContain("Claude provider status");
    expect(markup).toContain("Claude is not authenticated. Run `claude auth login` and try again.");
  });

  it("hides when the provider is ready", () => {
    const markup = renderToStaticMarkup(
      <ProviderHealthBanner
        status={unavailableClaudeStatus({
          available: true,
          status: "ready",
          authStatus: "authenticated",
          message: undefined,
        })}
      />,
    );

    expect(markup).toBe("");
  });

  it("renders the dismiss control when onDismiss is provided", () => {
    const markup = renderToStaticMarkup(
      <ProviderHealthBanner status={unavailableClaudeStatus()} onDismiss={() => {}} />,
    );

    expect(markup).toContain("Dismiss provider status");
  });
});
