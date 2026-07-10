import { GitBranchPicker } from "./GitBranchPicker";
import { WorkspacePathPicker } from "./WorkspacePathPicker";

interface ComposerContextBarProps {
  wsId: string;
  root: string;
}

/** Cursor-style path + branch selectors at the top of the composer pill. */
export function ComposerContextBar({ wsId, root }: ComposerContextBarProps) {
  return (
    <div className="ai-composer-context-bar">
      <WorkspacePathPicker wsId={wsId} root={root} />
      <GitBranchPicker wsId={wsId} root={root} variant="composer" />
    </div>
  );
}
