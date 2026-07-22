import { useCallback, useState } from "react";
import { useStore } from "../store";
import { TerminalCore } from "./lazyHeavy";

interface Props {
  wsId: string;
  root: string;
  activeTermId: string | null;
  onCreate: () => void;
}

/** Project terminals in Agent Mode — xterm host only (tabs live above). */
export function AgentTerminalPanel({
  wsId,
  root,
  activeTermId,
  onCreate,
}: Props) {
  const terminalsMap = useStore((s) => s.loaded[wsId]?.terminals);
  const setTerminalPtyId = useStore((s) => s.setTerminalPtyId);
  const list = terminalsMap ? Object.values(terminalsMap) : [];
  const [hostEl, setHostEl] = useState<HTMLDivElement | null>(null);
  const hostRef = useCallback((node: HTMLDivElement | null) => {
    setHostEl(node);
  }, []);

  return (
    <div className="agent-term-panel">
      <div className="agent-term-main">
        <div ref={hostRef} className="agent-term-host" />
        {list.map((t) =>
          t.popped ? null : (
            <TerminalCore
              key={t.id}
              termId={t.id}
              cwd={root}
              container={hostEl}
              visible={t.id === activeTermId}
              shellPath={t.shell?.path}
              shellArgs={t.shell?.args}
              title={t.title}
              ptyId={t.ptyId}
              onPtyIdChange={(id) => setTerminalPtyId(wsId, t.id, id)}
            />
          ),
        )}
        {list.length === 0 && (
          <div className="agent-term-empty">
            <p>No terminals yet</p>
            <button
              type="button"
              className="agent-term-empty-btn"
              onClick={onCreate}
            >
              New Terminal
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
