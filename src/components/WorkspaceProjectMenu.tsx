import { homeDir } from "@tauri-apps/api/path";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useEffect, useState } from "react";
import { addNewAIChat } from "../addNewAIChat";
import { displayTildePath } from "../pathUtils";
import type { WorkspaceMeta } from "../ipc";
import { useStore } from "../store";
import { Icon } from "./Icon";

const RECENT_CAP = 20;

export type ChatAnchor = { x: number; y: number };

/** Open/switch to a workspace and start a new chat there. */
export async function createChatInProject(
  id: string,
  root: string,
  anchor: ChatAnchor,
  onNewChat?: (wsId: string, anchor: ChatAnchor) => void,
): Promise<void> {
  const { openIds, setActiveWorkspace, openWorkspace } = useStore.getState();
  if (openIds.includes(id)) {
    if (onNewChat) {
      onNewChat(id, anchor);
      return;
    }
    await setActiveWorkspace(id);
    addNewAIChat(id, "editor", anchor);
    return;
  }
  await openWorkspace(root);
  const targetId = useStore.getState().activeId;
  if (!targetId) return;
  if (onNewChat) onNewChat(targetId, anchor);
  else addNewAIChat(targetId, "editor", anchor);
}

export async function createChatFromFolderDialog(
  anchor: ChatAnchor,
  onNewChat?: (wsId: string, anchor: ChatAnchor) => void,
): Promise<void> {
  const sel = await openDialog({ directory: true, multiple: false });
  if (typeof sel !== "string") return;
  await useStore.getState().openWorkspace(sel);
  const targetId = useStore.getState().activeId;
  if (!targetId) return;
  if (onNewChat) onNewChat(targetId, anchor);
  else addNewAIChat(targetId, "editor", anchor);
}

export function useHomeDir(): string | null {
  const [home, setHome] = useState<string | null>(null);
  useEffect(() => {
    void homeDir()
      .then(setHome)
      .catch(() => setHome(null));
  }, []);
  return home;
}

export function useRecentWorkspaces(cap = RECENT_CAP): WorkspaceMeta[] {
  const recent = useStore((s) => s.recent);
  return recent.slice(0, cap);
}

interface MenuBodyProps {
  currentWsId: string;
  home: string | null;
  recents: WorkspaceMeta[];
  onPick: (id: string, root: string) => void;
  onOpenFolder: () => void;
  /** Show check on current project (composer). Hub new-chat may hide it. */
  showActiveCheck?: boolean;
}

/** Recents list (scroll) + Open folder… fixed at the bottom. */
export function WorkspaceProjectMenuBody({
  currentWsId,
  home,
  recents,
  onPick,
  onOpenFolder,
  showActiveCheck = true,
}: MenuBodyProps) {
  return (
    <>
      <div className="ai-composer-ctx-menu-scroll">
        {recents.length > 0 && (
          <div className="menu-section-title">Recents</div>
        )}
        {recents.map((w) => {
          const active = w.id === currentWsId;
          return (
            <button
              key={w.id}
              type="button"
              className={`menu-item${active ? " active" : ""}`}
              onClick={() => onPick(w.id, w.root)}
              title={w.root}
            >
              <span className="menu-item-label">
                <Icon name="folder" size={11} />
                <span className="ai-composer-ctx-path">
                  {displayTildePath(w.root, home)}
                </span>
              </span>
              {showActiveCheck && active && (
                <span className="menu-item-accel ai-composer-ctx-check">
                  <Icon name="check" size={12} />
                </span>
              )}
            </button>
          );
        })}
        {recents.length === 0 && (
          <div className="ai-composer-ctx-menu-empty">No recent projects</div>
        )}
      </div>
      <div className="ai-composer-ctx-menu-foot">
        <button
          type="button"
          className="menu-item ai-composer-ctx-open"
          onClick={onOpenFolder}
          role="menuitem"
        >
          <span className="menu-item-label">
            <Icon name="folder" size={11} />
            Open folder…
          </span>
        </button>
      </div>
    </>
  );
}
