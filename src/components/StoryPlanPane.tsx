import { useEffect, useState } from "react";
import { parseStoryPlanKey } from "../storyPlanTab";
import { findStory } from "../works";
import { hydrateWorks, subscribeWorks } from "../worksCache";
import { useStore } from "../store";
import { openStoryDrawer } from "../storyDrawer";
import { Icon } from "./Icon";
import { MarkdownPreview } from "./MarkdownPreview";

interface Props {
  tabKey: string;
  visible?: boolean;
  /** Legacy embedded mode (no header). */
  embedded?: boolean;
}

export function StoryPlanPane({ tabKey, visible = true, embedded = false }: Props) {
  const parsed = parseStoryPlanKey(tabKey);
  const ws = useStore((s) =>
    parsed ? s.loaded[parsed.wsId] : undefined,
  );
  const root = ws?.meta.root;
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [shortId, setShortId] = useState("");

  useEffect(() => {
    if (!parsed || !root) return;
    const apply = (snap: Awaited<ReturnType<typeof hydrateWorks>>) => {
      const s = findStory(snap, parsed.storyId);
      if (!s) return;
      setShortId(s.shortId);
      setTitle(s.title);
      setBody(s.bodyMd ?? "");
    };
    void hydrateWorks(root).then(apply);
    return subscribeWorks(root, apply);
  }, [parsed, root]);

  if (!visible || !parsed || !root) {
    return (
      <div className="story-plan-pane story-plan-pane-error">
        <Icon name="alert-triangle" size={20} />
        <span>Story is no longer available.</span>
      </div>
    );
  }

  return (
    <div className={`story-plan-pane${embedded ? " story-plan-pane--embedded" : ""}`}>
      {!embedded ? (
        <div className="story-plan-pane-head">
          <Icon name="check-square" size={14} />
          <span>{shortId || "Story"}</span>
          {title ? <span className="story-plan-pane-title">{title}</span> : null}
        </div>
      ) : null}
      <div className="story-plan-pane-body">
        {body ? (
          <MarkdownPreview content={body} />
        ) : (
          <p className="story-plan-pane-empty">Planning in progress…</p>
        )}
      </div>
    </div>
  );
}

/** Open the Works story drawer (chat StoryPlanDrawer retired). */
export function openStoryPlanTab(
  wsId: string,
  _chatId: string | undefined,
  storyId: string,
): void {
  const root = useStore.getState().loaded[wsId]?.meta.root;
  if (!root) return;
  openStoryDrawer({ wsId, root, storyId });
}
