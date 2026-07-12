import { useCallback, useState } from "react";
import { confirm, prompt } from "../../dialog";
import { errMsg, error as toastError } from "../../notify";
import { deleteStory, updateStory } from "../../worksCache";
import { findStory, type WorksSnapshot } from "../../works";
import { ContextMenu } from "../ContextMenu";

export function useStoryContextMenu(
  root: string,
  snap: WorksSnapshot | null,
  onOpen: (id: string) => void,
) {
  const [menu, setMenu] = useState<{
    storyId: string;
    x: number;
    y: number;
  } | null>(null);

  const onStoryContextMenu = useCallback(
    (storyId: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setMenu({ storyId, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const runRename = async (storyId: string) => {
    const s = snap ? findStory(snap, storyId) : undefined;
    if (!s) return;
    const title = await prompt("New title", s.title, { title: "Rename story" });
    if (!title?.trim() || title.trim() === s.title) return;
    try {
      await updateStory(root, storyId, { title: title.trim() });
    } catch (e) {
      toastError(`Couldn't rename story: ${errMsg(e)}`);
    }
  };

  const runDelete = async (storyId: string) => {
    const s = snap ? findStory(snap, storyId) : undefined;
    if (!s) return;
    const ok = await confirm(
      `Delete ${s.shortId} "${s.title}"? Linked work items keep their data but lose the parent story.`,
      { title: "Delete story", okLabel: "Delete", danger: true },
    );
    if (!ok) return;
    try {
      await deleteStory(root, storyId);
    } catch (e) {
      toastError(`Couldn't delete story: ${errMsg(e)}`);
    }
  };

  const menuNode =
    menu && snap ? (
      <ContextMenu
        x={menu.x}
        y={menu.y}
        onClose={() => setMenu(null)}
        items={[
          { label: "Open", onClick: () => onOpen(menu.storyId) },
          { label: "Rename", onClick: () => void runRename(menu.storyId) },
          "separator",
          {
            label: "Delete",
            danger: true,
            onClick: () => void runDelete(menu.storyId),
          },
        ]}
      />
    ) : null;

  return { onStoryContextMenu, menuNode };
}
