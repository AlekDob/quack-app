import { openWorkspaceDocPath } from "../workspaceDocOpen";
import { basename, relPath } from "../pathUtils";
import type { ChatDoc } from "../chatDocsStore";
import { Icon } from "./Icon";

interface Props {
  wsId: string;
  root: string;
  docs: ChatDoc[];
}

/** Docs (.md/.mmd) touched in this chat — click opens the existing md drawer. */
export function AgentDocsPanel({ wsId, root, docs }: Props) {
  if (docs.length === 0) {
    return (
      <div className="agent-docs-empty">
        No documentation touched in this chat yet.
      </div>
    );
  }
  return (
    <div className="agent-docs-list">
      {docs.map((doc) => {
        const rel = relPath(doc.path, root) || doc.path;
        return (
          <button
            key={doc.path}
            type="button"
            className="agent-docs-row"
            title={rel}
            onClick={() => void openWorkspaceDocPath(wsId, root, doc.path)}
          >
            <Icon
              name={/\.mmd$/i.test(doc.path) ? "git-branch" : "file-text"}
              size={13}
            />
            <span className="agent-docs-name">{basename(doc.path)}</span>
            {doc.edited && <span className="agent-docs-badge">edited</span>}
            <span className="agent-docs-dir">{rel}</span>
          </button>
        );
      })}
    </div>
  );
}
