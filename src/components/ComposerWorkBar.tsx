import { useCallback, useEffect, useRef, useState } from "react";
import { ComposerCtxMenu } from "../composerCtxMenu";
import { errMsg, error as toastError } from "../notify";
import {
  createWorkItem,
  ensurePlanDraft,
  hydrateWorks,
  linkChatToWork,
  subscribeWorks,
  updateWorkItem,
} from "../worksCache";
import { findWork, statusLabel, type WorkItem, type WorksSnapshot } from "../works";
import { getWorkspaceColor } from "../workspaceColors";
import { useStore } from "../store";
import { Icon } from "./Icon";
import { openWorksTab } from "./works/WorksPane";

type Props = {
  wsId: string;
  root: string;
  chatId: string;
  workItemId?: string;
  ccPermMode: string | null;
};

export function ComposerWorkBar({
  wsId,
  root,
  chatId,
  workItemId,
  ccPermMode,
}: Props) {
  const [snap, setSnap] = useState<WorksSnapshot | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const chipRef = useRef<HTMLButtonElement>(null);
  const setWork = useStore((s) => s.setAIChatWorkItem);
  const wsColor = getWorkspaceColor(wsId);

  useEffect(() => {
    void hydrateWorks(root).then(setSnap);
    return subscribeWorks(root, setSnap);
  }, [root]);

  useEffect(() => {
    if (ccPermMode !== "plan" || workItemId) return;
    void ensurePlanDraft(root, chatId)
      .then((draft) => setWork(wsId, chatId, draft.id))
      .catch((e) => console.warn("plan draft work failed", e));
  }, [ccPermMode, workItemId, root, chatId, wsId, setWork]);

  const work = workItemId && snap ? findWork(snap, workItemId) : undefined;

  const linkWork = useCallback(
    async (id: string) => {
      try {
        await linkChatToWork(root, id, chatId);
        setWork(wsId, chatId, id);
      } catch (e) {
        toastError(`Couldn't link work: ${errMsg(e)}`);
      }
    },
    [root, chatId, wsId, setWork],
  );

  const createAndLink = async (origin: "hotfix" | "manual" | "plan") => {
    setMenuOpen(false);
    try {
      const item = await createWorkItem(root, {
        title: origin === "hotfix" ? "Hotfix" : "New work",
        origin,
      });
      await linkChatToWork(root, item.id, chatId);
      setWork(wsId, chatId, item.id);
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

  const chipLabel = work ? work.shortId : "Work";
  const chipTitle = work
    ? `${work.shortId} · ${work.title} · ${statusLabel(work.status)}`
    : "Link or create work";

  return (
    <div className="ai-composer-work-wrap">
      <button
        ref={chipRef}
        type="button"
        className="ai-agent-pill ai-composer-work-chip"
        onClick={() => setMenuOpen((o) => !o)}
        aria-expanded={menuOpen}
        title={chipTitle}
      >
        <span className="ai-agent-avatar ai-agent-avatar-jack">
          {work && wsColor ? (
            <span
              className="ai-composer-work-dot"
              style={{ background: wsColor.hex }}
              aria-hidden
            />
          ) : (
            <Icon name="columns-2" size={14} />
          )}
        </span>
        <span className="ai-agent-name">{chipLabel}</span>
        <Icon name="chevron-down" size={13} />
      </button>
      <ComposerCtxMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        anchorRef={chipRef}
        estimateHeight={work ? 320 : 180}
      >
        {work ? (
          <>
            <button
              type="button"
              className="menu-item"
              onClick={() => void cycleStatus(work)}
            >
              Status: {statusLabel(work.status)}
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
            <button
              type="button"
              className="menu-item"
              onClick={() => {
                setMenuOpen(false);
                setWork(wsId, chatId, null);
              }}
            >
              Unlink work
            </button>
            {(snap?.items ?? [])
              .filter((w) => w.id !== work.id)
              .slice(0, 8)
              .map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    void linkWork(w.id);
                  }}
                >
                  Switch to {w.shortId}
                </button>
              ))}
          </>
        ) : (
          <>
            <button type="button" className="menu-item" onClick={() => void createAndLink("plan")}>
              Plan work
            </button>
            <button type="button" className="menu-item" onClick={() => void createAndLink("hotfix")}>
              Hotfix
            </button>
            <button type="button" className="menu-item" onClick={() => void createAndLink("manual")}>
              Blank work
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
