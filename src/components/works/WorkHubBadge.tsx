import { useEffect, useState } from "react";
import { findWork } from "../../works";
import { hydrateWorks, subscribeWorks } from "../../worksCache";

type Props = {
  root: string;
  workItemId?: string;
};

export function WorkHubBadge({ root, workItemId }: Props) {
  const [shortId, setShortId] = useState<string | null>(null);

  useEffect(() => {
    if (!workItemId) {
      setShortId(null);
      return;
    }
    const apply = (snap: Awaited<ReturnType<typeof hydrateWorks>>) => {
      setShortId(findWork(snap, workItemId)?.shortId ?? null);
    };
    void hydrateWorks(root).then(apply);
    return subscribeWorks(root, apply);
  }, [root, workItemId]);

  if (!shortId) return null;
  return (
    <span className="agent-hub-work-badge" title={`Work ${shortId}`}>
      {shortId}
    </span>
  );
}
