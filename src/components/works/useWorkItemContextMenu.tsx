import { useCallback, useState } from "react";
import { confirm, prompt } from "../../dialog";
import { errMsg, error as toastError } from "../../notify";
import {
  deleteWorkItem,
  duplicateWorkItem,
  updateWorkItem,
} from "../../worksCache";
import { findWork, type WorksSnapshot } from "../../works";
import { ContextMenu } from "../ContextMenu";

export function useWorkItemContextMenu(
  root: string,
  snap: WorksSnapshot | null,
  onOpen: (id: string) => void,
) {
  const [menu, setMenu] = useState<{
    workId: string;
    x: number;
    y: number;
  } | null>(null);

  const onItemContextMenu = useCallback(
    (workId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu({ workId, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const runRename = async (workId: string) => {
    const w = snap ? findWork(snap, workId) : undefined;
    if (!w) return;
    const title = await prompt("New title", w.title, { title: "Rename work item" });
    if (!title?.trim() || title.trim() === w.title) return;
    try {
      await updateWorkItem(root, workId, { title: title.trim() });
    } catch (e) {
      toastError(`Couldn't rename work: ${errMsg(e)}`);
    }
  };

  const runDuplicate = async (workId: string) => {
    try {
      const copy = await duplicateWorkItem(root, workId);
      if (copy) onOpen(copy.id);
    } catch (e) {
      toastError(`Couldn't duplicate work: ${errMsg(e)}`);
    }
  };

  const runDelete = async (workId: string) => {
    const w = snap ? findWork(snap, workId) : undefined;
    if (!w) return;
    const ok = await confirm(
      `Delete ${w.shortId} "${w.title}"? This cannot be undone.`,
      { title: "Delete work item", okLabel: "Delete", danger: true },
    );
    if (!ok) return;
    try {
      await deleteWorkItem(root, workId);
    } catch (e) {
      toastError(`Couldn't delete work: ${errMsg(e)}`);
    }
  };

  const menuNode =
    menu && snap ? (
      <ContextMenu
        x={menu.x}
        y={menu.y}
        onClose={() => setMenu(null)}
        items={[
          { label: "Rename", onClick: () => void runRename(menu.workId) },
          { label: "Duplicate", onClick: () => void runDuplicate(menu.workId) },
          "separator",
          {
            label: "Delete",
            danger: true,
            onClick: () => void runDelete(menu.workId),
          },
        ]}
      />
    ) : null;

  return { onItemContextMenu, menuNode };
}
