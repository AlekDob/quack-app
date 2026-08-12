// FILE: EnvironmentGitStatusSummary.tsx
// Purpose: Show pending local and remote Git work below the Environment Changes row.
// Layer: Environment panel UI

import { useQuery } from "@tanstack/react-query";

import { Skeleton } from "~/components/ui/skeleton";
import { Tooltip, TooltipPopup, TooltipTrigger } from "~/components/ui/tooltip";
import { ArrowDownIcon, ArrowUpIcon, GitCommitIcon } from "~/lib/icons";
import { gitStatusQueryOptions } from "~/lib/gitReactQuery";

import { buildGitStatusSummary } from "./EnvironmentPanel.logic";

export function EnvironmentGitStatusSummary({
  gitCwd,
  enabled,
}: {
  gitCwd: string | null;
  enabled: boolean;
}) {
  const { data: status, isError, isLoading } = useQuery(gitStatusQueryOptions(gitCwd, enabled));

  if (isLoading) {
    return <Skeleton className="ml-8 mt-1 h-4 w-28" aria-label="Loading Git status" />;
  }

  if (!status || isError) {
    return null;
  }

  const items = buildGitStatusSummary(status);
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="-mt-0.5 mb-1 ml-8 flex items-center gap-2 font-system-ui text-[length:var(--app-font-size-ui-sm,11px)] font-normal">
      {items.map((item) => {
        const Icon =
          item.type === "commit"
            ? GitCommitIcon
            : item.type === "pull"
              ? ArrowDownIcon
              : ArrowUpIcon;
        const color = "text-muted-foreground/72";
        const count =
          item.type === "commit"
            ? status.workingTree.files.length
            : item.type === "pull"
              ? status.behindCount
              : status.aheadCount;
        return (
          <Tooltip key={item.type}>
            <TooltipTrigger
              render={
                <span aria-label={item.label} className={`inline-flex items-center gap-1 ${color}`}>
                  <Icon className={`size-3 ${color}`} aria-hidden />
                  <span className="tabular-nums">{count}</span>
                </span>
              }
            />
            <TooltipPopup side="top">{item.label}</TooltipPopup>
          </Tooltip>
        );
      })}
    </div>
  );
}
