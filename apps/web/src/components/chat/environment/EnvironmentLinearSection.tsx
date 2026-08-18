// FILE: EnvironmentLinearSection.tsx
// Purpose: "Linear" section of the Environment panel — unique linear:// mentions
//          from the current composer draft and this thread's sent user messages.
// Layer: Environment panel section

import type { ProviderMentionReference } from "@synara/contracts";
import { identifierFromLinearMentionPath } from "@synara/shared/linearMentions";

import { CentralIcon } from "~/lib/central-icons";
import { ArrowUpRightIcon } from "~/lib/icons";
import { resolveLinearIssueUrl } from "~/lib/linearIssueUrls";

import {
  ENVIRONMENT_ROW_ICON_CLASS_NAME,
  EnvironmentLabeledSection,
  EnvironmentRow,
} from "./EnvironmentRow";

export type LinearEnvironmentItem = {
  identifier: string;
  title: string;
  url: string;
};

export function collectLinearEnvironmentItems(
  mentions: ReadonlyArray<ProviderMentionReference>,
): LinearEnvironmentItem[] {
  const items: LinearEnvironmentItem[] = [];
  const seen = new Set<string>();
  for (const mention of mentions) {
    const identifier = identifierFromLinearMentionPath(mention.path);
    if (!identifier || seen.has(identifier)) continue;
    seen.add(identifier);
    const prefix = `${identifier} `;
    const title = mention.name.startsWith(prefix)
      ? mention.name.slice(prefix.length)
      : mention.name === identifier
        ? ""
        : mention.name;
    items.push({
      identifier,
      title,
      url: resolveLinearIssueUrl(identifier),
    });
  }
  return items;
}

export function EnvironmentLinearSection({
  mentions,
  onOpenUrl,
  onClose,
}: {
  mentions: ReadonlyArray<ProviderMentionReference>;
  onOpenUrl?: (url: string) => void;
  onClose: () => void;
}) {
  const items = collectLinearEnvironmentItems(mentions);
  if (items.length === 0) return null;

  return (
    <EnvironmentLabeledSection label="Linear">
      {items.map((item) => (
        <EnvironmentRow
          key={item.identifier}
          icon={<CentralIcon name="linear" className={ENVIRONMENT_ROW_ICON_CLASS_NAME} />}
          label={
            <span className="truncate">
              {item.identifier}
              {item.title ? ` ${item.title}` : ""}
            </span>
          }
          trailing={<ArrowUpRightIcon className={ENVIRONMENT_ROW_ICON_CLASS_NAME} aria-hidden />}
          onClick={() => {
            if (onOpenUrl) {
              onOpenUrl(item.url);
            } else {
              window.open(item.url, "_blank", "noopener,noreferrer");
            }
            onClose();
          }}
        />
      ))}
    </EnvironmentLabeledSection>
  );
}
