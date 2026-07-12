import { useCallback, useEffect, useState } from "react";
import { openFeatureDocDrawer } from "../../featureDocDrawer";
import { openBrainDoc } from "../../brainInject";
import { joinPath } from "../../pathUtils";
import { useStore } from "../../store";
import {
  loadBrainRefsForStory,
  loadBrainRefsForWork,
  normalizeBrainDocPath,
  type BrainRef,
} from "../../worksBrainRefs";
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

function roleLabel(role: BrainRef["role"]): string {
  if (role === "primary") return "Feature";
  if (role === "story") return "Story";
  if (role === "related") return "Related";
  return "Extra";
}

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
      const w = { ...work, brainRefs: extraRefs };
      setRefs(await loadBrainRefsForWork(root, snap, w));
      return;
    }
    if (story) {
      const s = { ...story, brainRefs: extraRefs };
      setRefs(await loadBrainRefsForStory(root, snap, s));
    }
  }, [root, snap, work, story, extraRefs]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openRef = (ref: BrainRef) => {
    if (ref.role === "story") {
      void useStore.getState().openFile(wsId, joinPath(root, ref.path));
      return;
    }
    if (ref.role === "primary" || ref.path.includes("/features/")) {
      openFeatureDocDrawer({
        wsId,
        root,
        featurePath: ref.path,
        title: ref.title ?? ref.path.split("/").pop() ?? ref.path,
      });
      return;
    }
    void openBrainDoc(wsId, root, ref.path.replace(/^documentation\//, ""));
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
                {roleLabel(ref.role)}
              </span>
              <span className="work-drawer-docs-path">{ref.path}</span>
            </button>
            {ref.role === "extra" && !readOnly && (
              <button
                type="button"
                className="work-drawer-docs-remove"
                aria-label="Remove reference"
                onClick={() => removeExtra(ref.path)}
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
