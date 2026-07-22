import { useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { addNewAIChat, anchorFromElement } from "../addNewAIChat";
import { ComposerCtxMenu } from "../composerCtxMenu";
import { basename, displayTildePath } from "../pathUtils";
import { useStore } from "../store";
import { Icon } from "./Icon";

const RECENT_CAP = 10;

interface WorkspacePathPickerProps {
  wsId: string;
  root: string;
}

export function WorkspacePathPicker({ wsId, root }: WorkspacePathPickerProps) {
  const [open, setOpen] = useState(false);
  const [home, setHome] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const recent = useStore((s) => s.recent);
  const openIds = useStore((s) => s.openIds);
  const openWorkspace = useStore((s) => s.openWorkspace);
  const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);

  useEffect(() => {
    void homeDir()
      .then(setHome)
      .catch(() => setHome(null));
  }, []);

  const current = recent.find((w) => w.id === wsId);
  const label = current?.name || basename(root);
  const pathTip = displayTildePath(root, home);
  const recents = recent.slice(0, RECENT_CAP);
  const openIdSet = new Set(openIds);

  const newChatAnchor = () => anchorFromElement(btnRef.current);

  const openChatIn = async (id: string) => {
    const anchor = newChatAnchor();
    await setActiveWorkspace(id);
    addNewAIChat(id, "editor", anchor);
  };

  const openChatAtRoot = async (folder: string) => {
    const anchor = newChatAnchor();
    await openWorkspace(folder);
    const targetId = useStore.getState().activeId;
    if (targetId) addNewAIChat(targetId, "editor", anchor);
  };

  const pickWorkspace = async (id: string, folder: string) => {
    setOpen(false);
    if (id === wsId) return;
    if (openIdSet.has(id)) {
      await openChatIn(id);
      return;
    }
    await openChatAtRoot(folder);
  };

  const pickFolder = async () => {
    setOpen(false);
    const sel = await openDialog({ directory: true, multiple: false });
    if (typeof sel !== "string") return;
    await openChatAtRoot(sel);
  };

  return (
    <div className="ai-composer-ctx-seg-wrap">
      <button
        ref={btnRef}
        type="button"
        className="ai-composer-ctx-seg"
        title={pathTip}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ai-composer-ctx-label">{label}</span>
        <Icon name="chevron-down" size={10} className="ai-composer-ctx-caret" />
      </button>
      <ComposerCtxMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        estimateHeight={recents.length * 36 + 72}
      >
        {recents.length > 0 && (
          <div className="menu-section-title">Recents</div>
        )}
        {recents.map((w) => {
          const active = w.id === wsId;
          return (
            <button
              key={w.id}
              type="button"
              className={`menu-item${active ? " active" : ""}`}
              onClick={() => void pickWorkspace(w.id, w.root)}
              title={w.root}
            >
              <span className="menu-item-label">
                <Icon name="folder" size={11} />
                <span className="ai-composer-ctx-path">
                  {displayTildePath(w.root, home)}
                </span>
              </span>
              {active && (
                <span className="menu-item-accel ai-composer-ctx-check">
                  <Icon name="check" size={12} />
                </span>
              )}
            </button>
          );
        })}
        {recents.length > 0 && (
          <div className="menu-separator" role="separator" />
        )}
        <button
          type="button"
          className="menu-item ai-composer-ctx-open"
          onClick={() => void pickFolder()}
          role="menuitem"
        >
          <span className="menu-item-label">
            <Icon name="folder" size={11} />
            Open folder…
          </span>
        </button>
      </ComposerCtxMenu>
    </div>
  );
}
