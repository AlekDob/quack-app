import { useEffect, useRef, useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { homeDir } from "@tauri-apps/api/path";
import { addNewAIChat, anchorFromElement } from "../addNewAIChat";
import { ComposerCtxMenu } from "../composerCtxMenu";
import { displayTildePath } from "../pathUtils";
import { useStore } from "../store";
import { Icon } from "./Icon";

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

  const label = displayTildePath(root, home);
  const openWorkspaces = openIds
    .map((id) => recent.find((w) => w.id === id))
    .filter((w): w is NonNullable<typeof w> => !!w);

  const newChatAnchor = () => anchorFromElement(btnRef.current);

  const pickWorkspace = async (id: string) => {
    setOpen(false);
    if (id === wsId) return;
    const anchor = newChatAnchor();
    await setActiveWorkspace(id);
    addNewAIChat(id, "editor", anchor);
  };

  const pickFolder = async () => {
    setOpen(false);
    const sel = await openDialog({ directory: true, multiple: false });
    if (typeof sel !== "string") return;
    const anchor = newChatAnchor();
    await openWorkspace(sel);
    const targetId = useStore.getState().activeId;
    if (targetId) addNewAIChat(targetId, "editor", anchor);
  };

  return (
    <div className="ai-composer-ctx-seg-wrap">
      <button
        ref={btnRef}
        type="button"
        className="ai-composer-ctx-seg"
        title={root}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="ai-composer-ctx-label">{label}</span>
        <Icon name="chevron-down" size={10} className="ai-composer-ctx-caret" />
      </button>
      <ComposerCtxMenu
        open={open}
        onClose={() => setOpen(false)}
        anchorRef={btnRef}
        estimateHeight={openWorkspaces.length * 36 + 48}
      >
        {openWorkspaces.map((w) => (
          <button
            key={w.id}
            type="button"
            className={`menu-item ${w.id === wsId ? "active" : ""}`}
            onClick={() => void pickWorkspace(w.id)}
          >
            <span className="menu-item-label">{w.name}</span>
            <span className="menu-item-accel">
              {displayTildePath(w.root, home)}
            </span>
          </button>
        ))}
        {openWorkspaces.length > 0 && (
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
