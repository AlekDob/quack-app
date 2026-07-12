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
  const [newOpen, setNewOpen] = useState(false);
  const [pickOpen, setPickOpen] = useState(false);
  const newRef = useRef<HTMLButtonElement>(null);
  const pickRef = useRef<HTMLButtonElement>(null);
  const setWork = useStore((s) => s.setAIChatWorkItem);

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
    setNewOpen(false);
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

  const cycleStatus = async () => {
    if (!work) return;
    const order: WorkItem["status"][] = [
      "backlog",
      "todo",
      "in_progress",
      "done",
    ];
    const i = order.indexOf(work.status);
    const next = order[(i + 1) % order.length] ?? "todo";
    try {
      await updateWorkItem(root, work.id, { status: next });
    } catch (e) {
      toastError(`Couldn't update status: ${errMsg(e)}`);
    }
  };

  return (
    <div className="ai-composer-work-bar">
      {work ? (
        <>
          <button
            type="button"
            className="ai-composer-work-pill"
            onClick={() => openWorksTab(wsId)}
            title="Open Works board"
          >
            <span className="ai-composer-work-id">{work.shortId}</span>
            <span className="ai-composer-work-title">{work.title}</span>
          </button>
          <button
            type="button"
            className="ai-composer-work-chip"
            onClick={() => void cycleStatus()}
            title="Cycle status"
          >
            {statusLabel(work.status)}
          </button>
          <button
            ref={pickRef}
            type="button"
            className="ai-composer-work-chip"
            onClick={() => setPickOpen((o) => !o)}
            title="Switch work"
            aria-expanded={pickOpen}
          >
            <Icon name="chevron-down" size={10} />
          </button>
          <button
            type="button"
            className="ai-composer-work-chip"
            onClick={() => setWork(wsId, chatId, null)}
            title="Unlink work"
          >
            Unlink
          </button>
        </>
      ) : (
        <button
          ref={newRef}
          type="button"
          className="ai-composer-work-pill ai-composer-work-pill--empty"
          onClick={() => setNewOpen((o) => !o)}
          aria-expanded={newOpen}
        >
          <Icon name="plus" size={12} /> Work
        </button>
      )}
      <ComposerCtxMenu
        open={newOpen}
        onClose={() => setNewOpen(false)}
        anchorRef={newRef}
      >
        <button type="button" className="menu-item" onClick={() => void createAndLink("plan")}>
          Plan work
        </button>
        <button type="button" className="menu-item" onClick={() => void createAndLink("hotfix")}>
          Hotfix
        </button>
        <button type="button" className="menu-item" onClick={() => void createAndLink("manual")}>
          Blank work
        </button>
        <button type="button" className="menu-item" onClick={() => openWorksTab(wsId)}>
          Open Works board
        </button>
      </ComposerCtxMenu>
      <ComposerCtxMenu
        open={pickOpen}
        onClose={() => setPickOpen(false)}
        anchorRef={pickRef}
        estimateHeight={280}
      >
        {(snap?.items ?? []).slice(0, 12).map((w) => (
          <button
            key={w.id}
            type="button"
            className="menu-item"
            onClick={() => {
              setPickOpen(false);
              void linkWork(w.id);
            }}
          >
            {w.shortId} · {w.title}
          </button>
        ))}
      </ComposerCtxMenu>
    </div>
  );
}
