// FILE: ProviderIcon.test.tsx
// Purpose: Covers shared provider icon rendering that many chat surfaces reuse.
// Layer: web UI tests
// Depends on: react-dom server rendering and ProviderIcon provider mapping.

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PROVIDER_OPTIONS } from "../session-logic";
import { ProviderIcon, PROVIDER_ICON_COMPONENT_BY_PROVIDER } from "./ProviderIcon";

describe("ProviderIcon", () => {
  it("uses Antigravity branding", () => {
    expect(PROVIDER_ICON_COMPONENT_BY_PROVIDER).not.toHaveProperty("gemini");

    const markup = renderToStaticMarkup(<ProviderIcon provider="antigravity" />);
    expect(markup).toContain('viewBox="0 0 16 15"');
    expect(markup).toContain("#FFE432");
  });

  it("uses the reversed Central icon for opencode in dark mode", () => {
    const markup = renderToStaticMarkup(
      <ProviderIcon provider="opencode" className="size-4 text-muted-foreground" />,
    );

    expect(markup).toContain("dark:hidden");
    expect(markup).toContain("hidden dark:inline-block");
    expect(markup).toContain("dark:text-foreground/90");
    expect(markup).toContain("/central-icons-reversed/opencode.svg");
  });

  it("renders an icon for every provider shown in the picker", () => {
    expect(Object.keys(PROVIDER_ICON_COMPONENT_BY_PROVIDER).toSorted()).toEqual(
      PROVIDER_OPTIONS.map((option) => option.value).toSorted(),
    );

    for (const { value: provider } of PROVIDER_OPTIONS) {
      expect(() => renderToStaticMarkup(<ProviderIcon provider={provider} />)).not.toThrow();
    }
  });
});
