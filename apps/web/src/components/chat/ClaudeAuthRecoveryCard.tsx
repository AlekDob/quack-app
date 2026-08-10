// FILE: ClaudeAuthRecoveryCard.tsx
// Purpose: Presents the Claude sign-in recovery action inside the transcript.

import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import { EXPANDED_NOTIFICATION_SURFACE_CLASS_NAME } from "../ui/notificationSurface";
import { CircleAlertIcon } from "~/lib/icons";

export type ClaudeAuthRecoveryStatus = "idle" | "opening" | "open" | "failed";

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
  return (
    <Alert className={EXPANDED_NOTIFICATION_SURFACE_CLASS_NAME} variant="warning">
      <CircleAlertIcon />
      <AlertTitle>Sign in to Claude</AlertTitle>
      <AlertDescription>
        <span>
          Quack will open a terminal and run <code>claude auth login --claudeai</code>.
        </span>
        {unavailableReason ? <span>{unavailableReason}</span> : null}
        {error ? <span className="text-destructive">{error}</span> : null}
      </AlertDescription>
      <AlertAction>
        <Button size="sm" disabled={opening || unavailable} onClick={onOpen}>
          {opening
            ? "Opening terminal…"
            : status === "open"
              ? "Open login terminal"
              : "Sign in to Claude"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </AlertAction>
    </Alert>
  );
}
