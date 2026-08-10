import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ClaudeAuthRecoveryCard } from "./ClaudeAuthRecoveryCard";

describe("ClaudeAuthRecoveryCard", () => {
  it("shows recovery states and dismiss", () => {
    const opening = renderToStaticMarkup(
      <ClaudeAuthRecoveryCard status="opening" onOpen={() => {}} onDismiss={() => {}} />,
    );
    expect(opening).toContain("Opening terminal…");
    expect(opening).toContain("disabled");
    expect(opening).toContain("Dismiss");
    const open = renderToStaticMarkup(
      <ClaudeAuthRecoveryCard status="open" onOpen={() => {}} onDismiss={() => {}} />,
    );
    expect(open).toContain("Open login terminal");
  });
});
