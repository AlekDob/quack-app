import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ClaudeAuthRecoveryCard } from "./ClaudeAuthRecoveryCard";

describe("ClaudeAuthRecoveryCard", () => {
  it("shows recovery states and dismiss", () => {
    const opening = renderToStaticMarkup(
      <ClaudeAuthRecoveryCard status="opening" onOpen={() => {}} onDismiss={() => {}} />,
    );
    expect(opening).toContain("Apro…");
    expect(opening).toContain("disabled");
    expect(opening).toContain("Ignora");
    const open = renderToStaticMarkup(
      <ClaudeAuthRecoveryCard status="open" onOpen={() => {}} onDismiss={() => {}} />,
    );
    expect(open).toContain("Completa il login nel terminale.");
  });
});
