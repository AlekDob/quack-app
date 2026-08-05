// FILE: EnvironmentGitStatusSummary.tsx
// Purpose: Show pending local and remote Git work below the Environment Changes row.
// Layer: Environment panel UI

import { useQuery } from "@tanstack/react-query";

import { ArrowDownIcon, ArrowUpIcon, GitCommitIcon } from "~/lib/icons";
import { gitStatusQueryOptions } from "~/lib/gitReactQuery";

import { buildGitStatusSummary } from "./EnvironmentPanel.logic";
import { ENVIRONMENT_ROW_ICON_CLASS_NAME, EnvironmentRowBody } from "./EnvironmentRow";

export function EnvironmentGitStatusSummary({
  gitCwd,
  enabled,
}: {
  gitCwd: string | null;
  enabled: boolean;
}) {
  const { data: status, isError, isFetching } = useQuery(gitStatusQueryOptions(gitCwd, enabled));

  if (!status || isError || isFetching) {
    return null;
  }

  const items = buildGitStatusSummary(status);
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="ml-6 flex flex-col">
      {items.map((item) => {
        const Icon =
          item.type === "commit"
            ? GitCommitIcon
            : item.type === "pull"
              ? ArrowDownIcon
              : ArrowUpIcon;
        const color = item.tone === "success" ? "text-success" : "text-warning";
        return (
          <div
            key={item.type}
            className="flex items-center gap-2 px-2 py-1 text-[length:var(--app-font-size-ui,12px)]"
          >
            <EnvironmentRowBody
              icon={
                <Icon className={`${ENVIRONMENT_ROW_ICON_CLASS_NAME} ${color}`} aria-hidden />
              }
              label={<span className={color}>{item.label}</span>}
            />
          </div>
        );
      })}
    </div>
  );
}
