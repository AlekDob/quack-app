import { useEffect, useState } from "react";
import { acceptanceFromBlocks } from "../worksBlocks";
import {
  getWorkProgress,
  subscribeWorkProgress,
} from "../workProgressStore";
import type { WorkItem } from "../works";

type Props = {
  work?: WorkItem;
};

export function ComposerWorkActions({ work }: Props) {
  const [, bump] = useState(0);
  useEffect(() => subscribeWorkProgress(() => bump((n) => n + 1)), []);

  if (!work) return null;

  const acc = acceptanceFromBlocks(work.descriptionBlocks);
  const progress = getWorkProgress(work.id);
  const hasMeta =
    acc.total > 0 ||
    work.linkedChatIds.length > 1 ||
    (progress?.activeTasks ?? 0) > 0 ||
    progress?.hasEdits;

  if (!hasMeta) return null;

  return (
    <div className="ai-composer-work-actions">
      {acc.total > 0 && (
        <span className="ai-composer-work-meta">
          Acceptance {acc.done}/{acc.total}
        </span>
      )}
      {work.linkedChatIds.length > 1 && (
        <span className="ai-composer-work-meta">
          {work.linkedChatIds.length} linked sessions
        </span>
      )}
      {(progress?.activeTasks ?? 0) > 0 && (
        <span className="ai-composer-work-meta">
          {progress!.activeTasks} active tasks
        </span>
      )}
      {progress?.hasEdits && (
        <span className="ai-composer-work-meta ai-composer-work-meta--edits">
          Has edits
        </span>
      )}
    </div>
  );
}
