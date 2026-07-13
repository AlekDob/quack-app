import { useCallback, useEffect, useRef, useState } from "react";
import { ComposerCtxMenu } from "../composerCtxMenu";
import { errMsg, error as toastError } from "../notify";
import {
  enterPlanning,
  exitPlanning,
  linkStoryToChat,
  linkWorkToChat,
  unlinkWorkFromChat,
} from "../quackPlanHarness";
import {
  getWorksInjectDepth,
  setWorksInjectDepth,
  type WorksInjectDepth,
} from "../workContextInject";
import {
  createWorkFromStory,
  createWorkItem,
  hydrateWorks,
  subscribeWorks,
  updateWorkItem,
} from "../worksCache";
import {
  findStory,
  findWork,
  statusLabel,
  type WorkItem,
  type WorksSnapshot,
} from "../works";
import { acceptanceFromMarkdown } from "../worksBlocks";
import { getWorkspaceColor } from "../workspaceColors";
import { ComposerDocsChip } from "./ComposerDocsChip";
import { ComposerWorkLinkPanel } from "./ComposerWorkLinkPanel";
import { openStoryPlanTab } from "./StoryPlanPane";
import { Icon } from "./Icon";
import { openWorksTab } from "./works/WorksPane";
import { useComposerBrainRefs } from "./works/WorksDocRefsSection";
import { openWorkDrawer } from "../workDrawer";

type Props = {
  wsId: string;
  root: string;
  chatId: string;
  workItemId?: string;
  storyId?: string;
  planning?: boolean;
  ccPermMode: string | null;
  onPickJack: () => void;
  onSetPlanMode?: () => void;
};

const DEPTH_LABEL: Record<WorksInjectDepth, string> = {
  pointers: "Pointers only",
  outline: "Paths + outline",
  pinky: "Paths + outline + Pinky",
};

function chipText(
  storyShortId: string | undefined,
  workShortId: string | undefined,
  planning: boolean,
): string {
  if (workShortId && storyShortId) return `${storyShortId} › ${workShortId}`;
  if (storyShortId && (planning || !workShortId)) return storyShortId;
  if (workShortId) return workShortId;
  return "Work";
}

export function ComposerWorkBar({
  wsId,
  root,
  chatId,
  workItemId,
  storyId,
  planning,
  ccPermMode,
  onPickJack,
  onSetPlanMode,
}: Props) {
  const [snap, setSnap] = useState<WorksSnapshot | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [injectDepth, setInjectDepth] = useState<WorksInjectDepth>(() =>
    getWorksInjectDepth(wsId),
  );
  const chipRef = useRef<HTMLButtonElement>(null);
  const wsColor = getWorkspaceColor(wsId);
  const docRefs = useComposerBrainRefs(root, snap, workItemId, storyId);

  useEffect(() => {
    void hydrateWorks(root).then(setSnap);
    return subscribeWorks(root, setSnap);
  }, [root]);

  useEffect(() => {
    if (ccPermMode !== "plan" || workItemId || storyId) return;
    onPickJack();
    onSetPlanMode?.();
    void enterPlanning(wsId, chatId, root).catch((e) =>
      console.warn("plan story failed", e),
    );
  }, [
    ccPermMode,
    workItemId,
    storyId,
    root,
    chatId,
    wsId,
    onPickJack,
    onSetPlanMode,
  ]);

  const work = workItemId && snap ? findWork(snap, workItemId) : undefined;
  const story =
    storyId && snap
      ? findStory(snap, storyId)
      : work?.parentId && snap
        ? findStory(snap, work.parentId)
        : undefined;

  const linkWork = useCallback(
    async (id: string) => {
      try {
        await linkWorkToChat(wsId, chatId, root, id);
      } catch (e) {
        toastError(`Couldn't link work: ${errMsg(e)}`);
      }
    },
    [root, chatId, wsId],
  );

  const linkStory = useCallback(
    async (id: string) => {
      try {
        await linkStoryToChat(wsId, chatId, root, id);
      } catch (e) {
        toastError(`Couldn't link story: ${errMsg(e)}`);
      }
    },
    [root, chatId, wsId],
  );

  const pickWork = (id: string) => {
    setMenuOpen(false);
    void linkWork(id);
  };

  const pickStory = (id: string) => {
    setMenuOpen(false);
    void linkStory(id);
  };

  const startPlanning = async () => {
    setMenuOpen(false);
    onPickJack();
    onSetPlanMode?.();
    try {
      await enterPlanning(wsId, chatId, root);
    } catch (e) {
      toastError(`Couldn't start planning: ${errMsg(e)}`);
    }
  };

  const startImplementation = async () => {
    if (!story) return;
    setMenuOpen(false);
    try {
      const item = await createWorkFromStory(root, story.id, {
        title: story.title,
      });
      if (!item) return;
      await linkWorkToChat(wsId, chatId, root, item.id);
    } catch (e) {
      toastError(`Couldn't spawn work: ${errMsg(e)}`);
    }
  };

  const createAndLink = async (origin: "hotfix" | "manual") => {
    setMenuOpen(false);
    try {
      const item = await createWorkItem(root, {
        title: origin === "hotfix" ? "Hotfix" : "New work",
        origin,
      });
      await linkWorkToChat(wsId, chatId, root, item.id);
    } catch (e) {
      toastError(`Couldn't create work: ${errMsg(e)}`);
    }
  };

  const cycleStatus = async (item: WorkItem) => {
    const order: WorkItem["status"][] = [
      "backlog",
      "todo",
      "in_progress",
      "done",
    ];
    const i = order.indexOf(item.status);
    const next = order[(i + 1) % order.length] ?? "todo";
    try {
      await updateWorkItem(root, item.id, { status: next });
    } catch (e) {
      toastError(`Couldn't update status: ${errMsg(e)}`);
    }
  };

  const cycleInjectDepth = () => {
    const order: WorksInjectDepth[] = ["pointers", "outline", "pinky"];
    const i = order.indexOf(injectDepth);
    const next = order[(i + 1) % order.length] ?? "outline";
    setWorksInjectDepth(wsId, next);
    setInjectDepth(next);
  };

  const accMd = work?.bodyMd ?? story?.bodyMd ?? "";
  const acc = acceptanceFromMarkdown(accMd);
  const chipLabel = chipText(story?.shortId, work?.shortId, !!planning);
  const chipTitle = work
    ? `${work.shortId} · ${work.title} · ${statusLabel(work.status)}`
    : story
      ? `${story.shortId} · ${story.title} · ${story.status}`
      : "Link or create work";

  const planningOnly = !!planning && story && !work;

  return (
    <div className="ai-composer-work-wrap">
      <div
        className={`ai-composer-work-cluster${docRefs.length > 0 || work || story ? " has-docs" : ""}${acc.total > 0 ? " has-acc" : ""}`}
      >
      <button
        ref={chipRef}
        type="button"
        className={`ai-composer-work-chip${planningOnly ? " ai-composer-work-chip--planning" : ""}`}
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        title={chipTitle}
      >
        <span className="ai-agent-avatar ai-agent-avatar-jack">
          {(work || story) && wsColor ? (
            <span
              className="ai-composer-work-dot"
              style={{
                background: planningOnly ? "var(--warn)" : wsColor.hex,
              }}
              aria-hidden
            />
          ) : (
            <Icon name="columns-2" size={14} />
          )}
        </span>
        <span className="ai-agent-name">{chipLabel}</span>
        <Icon name="chevron-down" size={13} />
      </button>
      <ComposerDocsChip
        wsId={wsId}
        root={root}
        refs={docRefs}
        work={work}
        story={story}
      />
      {acc.total > 0 ? (
        <span className="ai-composer-work-acc-chip" title="Acceptance progress">
          {acc.done}/{acc.total}
        </span>
      ) : null}
      </div>
      <ComposerCtxMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={chipRef}
        estimateHeight={planningOnly ? 320 : work ? 400 : 380}
        className={!work && !planningOnly ? "ai-composer-ctx-menu--work-link" : undefined}
      >
        {planningOnly ? (
          <>
            <ComposerWorkLinkPanel
              snap={snap}
              excludeStoryId={story?.id}
              storiesOnly
              onPickWork={pickWork}
              onPickStory={pickStory}
            />
            <div className="menu-separator" role="separator" />
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                openStoryPlanTab(wsId, chatId, story.id);
              }}
            >
              Open story panel
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => void startImplementation()}
            >
              Start implementation
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                void exitPlanning(wsId, chatId, root);
              }}
            >
              Exit planning
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                openWorksTab(wsId);
              }}
            >
              Open Works board
            </button>
          </>
        ) : work ? (
          <>
            <button
              type="button"
              className="menu-item"
              onClick={() => cycleInjectDepth()}
            >
              Context inject: {DEPTH_LABEL[injectDepth]}
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => void cycleStatus(work)}
            >
              Status: {statusLabel(work.status)}
            </button>
            <button
              type="button"
              className="menu-item ai-composer-ctx-open"
              onClick={() => {
                setMenuOpen(false);
                openWorkDrawer({ wsId, root, workId: work.id });
              }}
            >
              <span className="menu-item-label">
                <Icon name="file-text" size={11} />
                Open work item
              </span>
            </button>
            {story ? (
              <button
                type="button"
                className="menu-item"
                onClick={() => {
                  setMenuOpen(false);
                  openStoryPlanTab(wsId, chatId, story.id);
                }}
              >
                View parent story
              </button>
            ) : null}
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                openWorksTab(wsId);
              }}
            >
              Open Works board
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                void unlinkWorkFromChat(wsId, chatId, root, work.id);
              }}
            >
              Unlink work
            </button>
            <div className="menu-separator" role="separator" />
            <ComposerWorkLinkPanel
              snap={snap}
              excludeWorkId={work.id}
              onPickWork={pickWork}
              onPickStory={pickStory}
            />
          </>
        ) : (
          <>
            <ComposerWorkLinkPanel
              snap={snap}
              onPickWork={pickWork}
              onPickStory={pickStory}
            />
            <div className="menu-separator" role="separator" />
            <button type="button" className="menu-item" onClick={() => void startPlanning()}>
              Plan a feature
            </button>
            <button type="button" className="menu-item" onClick={() => void createAndLink("hotfix")}>
              Hotfix
            </button>
            <button type="button" className="menu-item" onClick={() => void createAndLink("manual")}>
              Blank task
            </button>
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                openWorksTab(wsId);
              }}
            >
              Open Works board
            </button>
          </>
        )}
      </ComposerCtxMenu>
    </div>
  );
}
