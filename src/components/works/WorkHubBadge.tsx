import { useEffect, useState } from "react";
import { findStory, findWork } from "../../works";
import { storyForWork } from "../../worksBrainRefs";
import { hydrateWorks, subscribeWorks } from "../../worksCache";

type Props = {
  root: string;
  workItemId?: string;
  storyId?: string;
  planning?: boolean;
};

export function WorkHubBadge({
  root,
  workItemId,
  storyId,
  planning,
}: Props) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!workItemId && !storyId) {
      setLabel(null);
      return;
    }
    const apply = (snap: Awaited<ReturnType<typeof hydrateWorks>>) => {
      const work = workItemId ? findWork(snap, workItemId) : undefined;
      const story =
        (storyId ? findStory(snap, storyId) : undefined) ??
        (work ? storyForWork(snap, work) : undefined);
      if (work && story) {
        setLabel(`${story.shortId} › ${work.shortId}`);
      } else if (story && (planning || !work)) {
        setLabel(story.shortId);
      } else if (work) {
        setLabel(work.shortId);
      } else {
        setLabel(null);
      }
    };
    void hydrateWorks(root).then(apply);
    return subscribeWorks(root, apply);
  }, [root, workItemId, storyId, planning]);

  if (!label) return null;
  return (
    <span className="agent-hub-work-badge" title={`Work ${label}`}>
      {label}
    </span>
  );
}
