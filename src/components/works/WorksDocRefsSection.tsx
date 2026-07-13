import { useCallback, useEffect, useState } from "react";
import { updateStory, updateWorkItem } from "../../worksCache";
import {
  loadBrainRefsForStory,
  loadBrainRefsForWork,
  normalizeBrainDocPath,
  type BrainRef,
} from "../../worksBrainRefs";
import { brainRefGroupLabel } from "../../worksBrainRefUi";
import { openBrainRef } from "../../workspaceDocOpen";
import type { WorkItem, WorkStory, WorksSnapshot } from "../../works";
import { Icon } from "../Icon";

type Props = {
  wsId: string;
  root: string;
  snap: WorksSnapshot;
  work?: WorkItem;
  story?: WorkStory;
  extraRefs: string[];
  onExtraRefsChange: (refs: string[]) => void;
  readOnly?: boolean;
};

export function WorksDocRefsSection({
  wsId,
  root,
  snap,
  work,
  story,
  extraRefs,
  onExtraRefsChange,
  readOnly = false,
}: Props) {
  const [refs, setRefs] = useState<BrainRef[]>([]);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const reload = useCallback(async () => {
    if (work) {
      const w = {
        ...work,
        brainRefs: extraRefs,
        contextExcludedRefs: work.contextExcludedRefs,
      };
      setRefs(await loadBrainRefsForWork(root, snap, w));
      return;
    }
    if (story) {
      const s = {
        ...story,
        brainRefs: extraRefs,
        contextExcludedRefs: story.contextExcludedRefs,
      };
      setRefs(await loadBrainRefsForStory(root, snap, s));
    }
  }, [root, snap, work, story, extraRefs]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openRef = (ref: BrainRef) => {
    openBrainRef(wsId, root, ref);
  };

  const addRef = () => {
    const path = normalizeBrainDocPath(draft);
    if (!path || extraRefs.includes(path)) return;
    onExtraRefsChange([...extraRefs, path]);
    setDraft("");
    setAdding(false);
  };

  const removeExtra = (path: string) => {
    onExtraRefsChange(extraRefs.filter((r) => r !== path));
  };

  const removeRef = async (ref: BrainRef) => {
    const path = normalizeBrainDocPath(ref.path);
    if (ref.role === "extra") {
      removeExtra(path);
      return;
    }
    try {
      if (work) {
        const contextExcludedRefs = [
          ...new Set([...(work.contextExcludedRefs ?? []), path]),
        ];
        await updateWorkItem(root, work.id, { contextExcludedRefs });
      } else if (story) {
        const contextExcludedRefs = [
          ...new Set([...(story.contextExcludedRefs ?? []), path]),
        ];
        await updateStory(root, story.id, { contextExcludedRefs });
      }
    } catch {
      /* toast from cache */
    }
  };

  if (refs.length === 0 && readOnly) return null;

  return (
    <section className="work-drawer-docs" aria-label="Documentation">
      <div className="work-drawer-docs-head">
        <span className="work-drawer-field-label">Documentation</span>
        {!readOnly && (
          <button
            type="button"
            className="work-drawer-docs-add"
            onClick={() => setAdding((v) => !v)}
          >
            Add ref
          </button>
        )}
      </div>
      <ul className="work-drawer-docs-list">
        {refs.map((ref) => (
          <li key={`${ref.role}:${ref.path}`}>
            <button
              type="button"
              className="work-drawer-docs-row"
              onClick={() => openRef(ref)}
            >
              <span className={`work-drawer-docs-role work-drawer-docs-role--${ref.role}`}>
                {brainRefGroupLabel(ref.role)}
              </span>
              <span className="work-drawer-docs-path">{ref.path}</span>
            </button>
            {!readOnly && (
              <button
                type="button"
                className="work-drawer-docs-remove"
                aria-label="Remove from context"
                onClick={() => void removeRef(ref)}
              >
                <Icon name="x" size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {adding && !readOnly && (
        <div className="work-drawer-docs-compose">
          <input
            className="work-drawer-docs-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="documentation/decisions/…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addRef();
              }
            }}
          />
          <button type="button" className="work-drawer-docs-save" onClick={addRef}>
            Add
          </button>
        </div>
      )}
    </section>
  );
}

export function useWorkBrainRefs(
  root: string,
  snap: WorksSnapshot | null,
  workId?: string,
): BrainRef[] {
  const [refs, setRefs] = useState<BrainRef[]>([]);
  useEffect(() => {
    if (!snap || !workId) {
      setRefs([]);
      return;
    }
    const work = snap.items.find((w) => w.id === workId);
    if (!work) {
      setRefs([]);
      return;
    }
    void loadBrainRefsForWork(root, snap, work).then(setRefs);
  }, [root, snap, workId]);
  return refs;
}

export function useComposerBrainRefs(
  root: string,
  snap: WorksSnapshot | null,
  workId?: string,
  storyId?: string,
): BrainRef[] {
  const [refs, setRefs] = useState<BrainRef[]>([]);
  useEffect(() => {
    if (!snap) {
      setRefs([]);
      return;
    }
    if (workId) {
      const work = snap.items.find((w) => w.id === workId);
      if (!work) {
        setRefs([]);
        return;
      }
      void loadBrainRefsForWork(root, snap, work).then(setRefs);
      return;
    }
    if (storyId) {
      const story = snap.stories.find((s) => s.id === storyId);
      if (!story) {
        setRefs([]);
        return;
      }
      void loadBrainRefsForStory(root, snap, story).then(setRefs);
      return;
    }
    setRefs([]);
  }, [root, snap, workId, storyId]);
  return refs;
}
