import { useCallback, useEffect, useState } from "react";
import type { WorkBlock } from "../../works";
import {
  applySlashCommand,
  filterSlashCommands,
  insertBlockAfter,
  mergeBlockUp,
  patchBlock,
  trimBlocks,
  withTrailingEmpty,
} from "../../workBlockEditor";
import { WorkBlockRow } from "./WorkBlockRow";
import { WorkBlockSlashMenu } from "./WorkBlockSlashMenu";

type Props = {
  blocks: WorkBlock[];
  onChange: (blocks: WorkBlock[]) => void;
};

export function WorkBlockEditor({ blocks, onChange }: Props) {
  const [local, setLocal] = useState(() => withTrailingEmpty(blocks));
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [slash, setSlash] = useState<{ idx: number; query: string } | null>(
    null,
  );
  const [slashActive, setSlashActive] = useState(0);

  useEffect(() => {
    setLocal(withTrailingEmpty(blocks));
  }, [blocks]);

  const commit = useCallback(
    (next: WorkBlock[]) => {
      setLocal(withTrailingEmpty(next));
      onChange(trimBlocks(next));
    },
    [onChange],
  );

  const cmds = slash ? filterSlashCommands(slash.query) : [];

  const pickSlash = useCallback(
    (cmdId: string) => {
      if (!slash) return;
      const next = applySlashCommand(local, slash.idx, cmdId);
      setSlash(null);
      commit(next);
      setFocusIdx(slash.idx);
    },
    [slash, local, commit],
  );

  useEffect(() => {
    if (!slash || cmds.length === 0) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSlashActive((i) => Math.min(i + 1, cmds.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSlashActive((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const hit = cmds[slashActive];
        if (hit) pickSlash(hit.id);
      }
      if (e.key === "Escape") setSlash(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [slash, cmds, slashActive, pickSlash]);

  useEffect(() => {
    setSlashActive(0);
  }, [slash?.query]);

  useEffect(() => {
    if (!slash) return;
    const b = local[slash.idx];
    const t =
      b?.type === "paragraph" || b?.type === "heading" ? b.text : "";
    if (!t.startsWith("/")) setSlash(null);
  }, [local, slash]);

  return (
    <div className="work-block-editor">
      {slash && cmds.length > 0 && (
        <WorkBlockSlashMenu
          commands={cmds}
          active={slashActive}
          onPick={pickSlash}
          onHover={setSlashActive}
        />
      )}
      {local.map((block, idx) => (
        <WorkBlockRow
          key={idx}
          index={idx}
          block={block}
          focus={focusIdx === idx}
          onChange={(b) => commit(patchBlock(local, idx, b))}
          onEnter={() => {
            commit(insertBlockAfter(local, idx));
            setFocusIdx(idx + 1);
            setSlash(null);
          }}
          onBackspaceEmpty={() => {
            if (slash) {
              setSlash(null);
              return;
            }
            commit(mergeBlockUp(local, idx));
            setFocusIdx(Math.max(0, idx - 1));
          }}
          onSlash={(q) => setSlash({ idx, query: q })}
          onFocus={() => setFocusIdx(idx)}
          onBlur={() => setFocusIdx(null)}
        />
      ))}
    </div>
  );
}
