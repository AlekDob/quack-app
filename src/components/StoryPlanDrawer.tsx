import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { storyPlanKey } from "../storyPlanTab";
import {
  isStoryPlanDrawerPinned,
  pinStoryPlanDrawer,
  subscribeStoryPlanDrawer,
  toggleStoryPlanDrawer,
  unpinStoryPlanDrawer,
} from "../storyPlanDrawerStore";
import { hydrateWorks, subscribeWorks } from "../worksCache";
import { findStory } from "../works";
import { acceptanceFromMarkdown } from "../worksBlocks";
import { Icon } from "./Icon";
import { StoryPlanPane } from "./StoryPlanPane";

interface Props {
  wsId: string;
  chatId: string;
  root: string;
  storyId: string;
  planning?: boolean;
}

function useDrawerPinned(wsId: string, chatId: string): boolean {
  return useSyncExternalStore(
    subscribeStoryPlanDrawer,
    () => isStoryPlanDrawerPinned(wsId, chatId),
    () => isStoryPlanDrawerPinned(wsId, chatId),
  );
}

function useHoverPeek(enabled: boolean) {
  const [peeking, setPeeking] = useState(false);
  const leaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEnter = () => {
    if (!enabled) return;
    if (leaveRef.current) clearTimeout(leaveRef.current);
    setPeeking(true);
  };
  const onLeave = () => {
    if (!enabled) return;
    leaveRef.current = setTimeout(() => setPeeking(false), 320);
  };
  useEffect(
    () => () => {
      if (leaveRef.current) clearTimeout(leaveRef.current);
    },
    [],
  );
  return { peeking, onEnter, onLeave };
}

export function StoryPlanDrawer({
  wsId,
  chatId,
  root,
  storyId,
  planning = false,
}: Props) {
  const pinned = useDrawerPinned(wsId, chatId);
  const peekEnabled = !pinned;
  const { peeking, onEnter, onLeave } = useHoverPeek(peekEnabled);
  const showPanel = pinned || peeking;
  const tabKey = storyPlanKey(wsId, chatId, storyId);

  const [shortId, setShortId] = useState("");
  const [accDone, setAccDone] = useState(0);
  const [accTotal, setAccTotal] = useState(0);

  useEffect(() => {
    const apply = (snap: Awaited<ReturnType<typeof hydrateWorks>>) => {
      const s = findStory(snap, storyId);
      if (!s) return;
      setShortId(s.shortId);
      const acc = acceptanceFromMarkdown(s.bodyMd ?? "");
      setAccDone(acc.done);
      setAccTotal(acc.total);
    };
    void hydrateWorks(root).then(apply);
    return subscribeWorks(root, apply);
  }, [root, storyId]);

  const shellCls = [
    "story-drawer-shell",
    pinned ? "is-pinned" : "",
    peeking ? "is-peeking" : "",
    planning ? "is-planning" : "",
    showPanel ? "is-open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={shellCls}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
    >
      <button
        type="button"
        className="story-drawer-strip"
        title={pinned ? "Unpin story plan" : "Pin story plan"}
        aria-expanded={showPanel}
        onClick={() => toggleStoryPlanDrawer(wsId, chatId)}
      >
        <Icon name="check-square" size={14} />
        <span className="story-drawer-strip-meta">
          <span className="story-drawer-strip-label">
            <span className="story-drawer-strip-id">
              {(shortId || "Story").replace(/-/g, "\u2011")}
            </span>
          </span>
          {accTotal > 0 ? (
            <span className="story-drawer-strip-label">
              <span className="story-drawer-strip-acc">
                {accDone}/{accTotal}
              </span>
            </span>
          ) : null}
        </span>
      </button>
      <div className="story-drawer-panel" role="complementary">
        <div className="story-drawer-panel-head">
          <span className="story-drawer-panel-label">Story plan</span>
          <button
            type="button"
            className="story-drawer-panel-pin"
            title={pinned ? "Unpin" : "Pin open"}
            aria-pressed={pinned}
            onClick={() =>
              pinned
                ? unpinStoryPlanDrawer(wsId, chatId)
                : pinStoryPlanDrawer(wsId, chatId)
            }
          >
            <Icon name={pinned ? "chevron-right" : "chevron-left"} size={14} />
          </button>
        </div>
        <div className="story-drawer-panel-body">
          <StoryPlanPane tabKey={tabKey} visible embedded />
        </div>
      </div>
    </div>
  );
}

export function openStoryPlanDrawer(
  wsId: string,
  chatId: string | undefined,
): void {
  if (!chatId) return;
  pinStoryPlanDrawer(wsId, chatId);
}
