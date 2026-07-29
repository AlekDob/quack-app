import { useRef, useState } from "react";
import { anchorFromElement } from "../addNewAIChat";
import { ComposerCtxMenu } from "../composerCtxMenu";
import { basename, displayTildePath } from "../pathUtils";
import { useStore } from "../store";
import { Icon } from "./Icon";
import {
  createChatFromFolderDialog,
  createChatInProject,
  useHomeDir,
  useRecentWorkspaces,
  WorkspaceProjectMenuBody,
} from "./WorkspaceProjectMenu";

interface WorkspacePathPickerProps {
  wsId: string;
  root: string;
}

export function WorkspacePathPicker({ wsId, root }: WorkspacePathPickerProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const recent = useStore((s) => s.recent);
  const home = useHomeDir();
  const recents = useRecentWorkspaces();

  const current = recent.find((w) => w.id === wsId);
  const label = current?.name || basename(root);
  const pathTip = displayTildePath(root, home);

  const pickWorkspace = async (id: string, folder: string) => {
    setOpen(false);
    if (id === wsId) return;
    await createChatInProject(id, folder, anchorFromElement(btnRef.current));
  };

  const pickFolder = async () => {
    setOpen(false);
    await createChatFromFolderDialog(anchorFromElement(btnRef.current));
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
        estimateHeight={Math.min(360, recents.length * 36 + 112)}
        className="ai-composer-ctx-menu--project"
      >
        <WorkspaceProjectMenuBody
          currentWsId={wsId}
          home={home}
          recents={recents}
          onPick={(id, folder) => void pickWorkspace(id, folder)}
          onOpenFolder={() => void pickFolder()}
          onClose={() => setOpen(false)}
        />
      </ComposerCtxMenu>
    </div>
  );
}
