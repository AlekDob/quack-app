import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ComposerBrowserActivityPill } from "./ComposerBrowserActivityPill";

describe("ComposerBrowserActivityPill", () => {
  it("renders the browser status, host, and accessible open action", () => {
    const markup = renderToStaticMarkup(
      <ComposerBrowserActivityPill
        activity={{ label: "Browser in use", hostname: "github.com", statusKind: "running" }}
        onOpenBrowser={() => {}}
      />,
    );

    expect(markup).toContain("Browser in use");
    expect(markup).toContain("github.com");
    expect(markup).toContain("Open Browser: Browser in use · github.com");
  });

  it("renders attention status in the action label", () => {
    const markup = renderToStaticMarkup(
      <ComposerBrowserActivityPill
        activity={{ label: "Sign-in needed", hostname: undefined, statusKind: "attention" }}
        onOpenBrowser={() => {}}
      />,
    );

    expect(markup).toContain("Open Browser: Sign-in needed");
  });
});
