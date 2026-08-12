import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ClaudeAuthRecoveryCard } from "./ClaudeAuthRecoveryCard";

describe("ClaudeAuthRecoveryCard", () => {
  it("shows recovery states and dismiss", () => {
    const opening = renderToStaticMarkup(
      <ClaudeAuthRecoveryCard
        status="opening"
        authenticated={false}
        onOpen={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(opening).toContain("Apro…");
    expect(opening).toContain("disabled");
    expect(opening).toContain("Ignora");
    const open = renderToStaticMarkup(
      <ClaudeAuthRecoveryCard
        status="open"
        authenticated={false}
        onOpen={() => {}}
        onDismiss={() => {}}
      />,
    );
    expect(open).toContain("Completa il login nel terminale.");
  });

  it("confirms the login only after Claude reports an authenticated session", () => {
    const complete = renderToStaticMarkup(
      <ClaudeAuthRecoveryCard status="open" authenticated onOpen={() => {}} onDismiss={() => {}} />,
    );

    expect(complete).toContain("Login effettuato");
    expect(complete).toContain("Chiudi");
    expect(complete).not.toContain("Terminale");
  });
});
