// FILE: ProviderHealthBanner.tsx
// Purpose: Surfaces provider availability warnings next to the composer.
// Layer: Chat status presentation
// Exports: ProviderHealthBanner

import { PROVIDER_DISPLAY_NAMES, type ServerProviderStatus } from "@synara/contracts";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "../ui/alert";
import { IconButton } from "../ui/icon-button";
import { CircleAlertIcon, TriangleAlertIcon, XIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";

export const ProviderHealthBanner = function ProviderHealthBanner({
  onDismiss,
  status,
}: {
  onDismiss?: () => void;
  status: ServerProviderStatus | null;
}) {
  if (!status || status.status === "ready") {
    return null;
  }

  const providerLabel = PROVIDER_DISPLAY_NAMES[status.provider] ?? status.provider;
  const defaultMessage =
    status.status === "error"
      ? `${providerLabel} provider is unavailable.`
      : `${providerLabel} provider has limited availability.`;
  const title = `${providerLabel} provider status`;
  const isError = status.status === "error";
  const Icon = isError ? CircleAlertIcon : TriangleAlertIcon;

  return (
    <Alert className={cn("mb-2 pr-10")} variant={isError ? "error" : "warning"}>
      <Icon />
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription className="line-clamp-3" title={status.message ?? defaultMessage}>
        {status.message ?? defaultMessage}
      </AlertDescription>
      {onDismiss ? (
        <AlertAction className="absolute top-2 right-2">
          <IconButton
            className={cn(
              "size-6 rounded-full sm:size-6",
              isError
                ? "text-destructive/60 hover:bg-destructive/10 hover:text-destructive focus-visible:ring-destructive/35"
                : "text-warning/60 hover:bg-warning/10 hover:text-warning focus-visible:ring-warning/35",
            )}
            label="Dismiss provider status"
            title="Dismiss provider status"
            onClick={onDismiss}
          >
            <XIcon className="size-3.5" />
          </IconButton>
        </AlertAction>
      ) : null}
    </Alert>
  );
};
