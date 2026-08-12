// FILE: ClaudeAuthRecoveryCard.tsx
// Purpose: Presents the Claude sign-in recovery action inside the transcript.

import { Button } from "../ui/button";
import { CircleAlertIcon } from "~/lib/icons";

export type ClaudeAuthRecoveryStatus = "idle" | "opening" | "open" | "failed";

// The card only exists while Claude is unauthenticated: once the provider reports
// an authenticated session the stale thread error is cleared and this unmounts,
// so there is no "logged in" state to render here.
export function ClaudeAuthRecoveryCard({
  status,
  error,
  unavailableReason,
  onOpen,
  onDismiss,
}: {
  status: ClaudeAuthRecoveryStatus;
  error?: string | null;
  unavailableReason?: string | null;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const opening = status === "opening";
  const unavailable = unavailableReason != null;
  const terminalIsOpen = status === "open";
  return (
    <div
      className="flex w-fit max-w-[min(100%,30rem)] items-center gap-3 rounded-xl border border-border/70 bg-background/72 px-3 py-2.5 text-sm shadow-sm/5 backdrop-blur-sm"
      role="status"
    >
      <CircleAlertIcon className="size-4 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Accedi a Claude</p>
        <p className="text-muted-foreground">
          {unavailableReason ??
            (terminalIsOpen
              ? "Completa il login nel terminale."
              : "Apri il terminale per accedere.")}
        </p>
        {error ? <p className="mt-1 text-destructive">{error}</p> : null}
      </div>
      <Button size="sm" variant="outline" disabled={opening || unavailable} onClick={onOpen}>
        {opening ? "Apro…" : terminalIsOpen ? "Terminale" : "Apri terminale"}
      </Button>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        Ignora
      </Button>
    </div>
  );
}
