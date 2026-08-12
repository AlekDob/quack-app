import { GlobeIcon } from "~/lib/icons";
import { cn } from "~/lib/utils";

import { Button } from "../ui/button";
import { Tooltip, TooltipPopup, TooltipTrigger } from "../ui/tooltip";
import type { ComposerBrowserActivityPresentation } from "./ComposerActivityStrip.logic";

interface ComposerBrowserActivityPillProps {
  activity: ComposerBrowserActivityPresentation;
  onOpenBrowser: () => void;
}

export function ComposerBrowserActivityPill({
  activity,
  onOpenBrowser,
}: ComposerBrowserActivityPillProps) {
  const status = activity.hostname ? `${activity.label} · ${activity.hostname}` : activity.label;
  const needsAttention = activity.statusKind === "attention";

  return (
    <div className="pb-2" data-testid="composer-browser-activity-pill">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="secondary-outline"
              size="xs"
              shape="capsule"
              className={cn(
                "max-w-full transition-colors",
                needsAttention && "border-warning/40 bg-warning/4 text-warning",
              )}
              onClick={onOpenBrowser}
              aria-label={`Open Browser: ${status}`}
            >
              <span className="relative flex size-3.5 shrink-0 items-center justify-center">
                <GlobeIcon className="size-3.5" aria-hidden />
                <span
                  aria-hidden
                  className={cn(
                    "absolute -right-0.5 -top-0.5 size-1.5 rounded-full",
                    needsAttention ? "bg-warning" : "bg-primary animate-pulse",
                  )}
                />
              </span>
              <span className="truncate">{activity.label}</span>
              {activity.hostname ? (
                <span className="truncate text-muted-foreground">{activity.hostname}</span>
              ) : null}
            </Button>
          }
        />
        <TooltipPopup side="top">Open Browser: {status}</TooltipPopup>
      </Tooltip>
    </div>
  );
}
