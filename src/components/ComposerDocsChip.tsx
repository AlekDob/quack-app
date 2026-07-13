import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { fileIconName } from "../fileIcons";
import { errMsg, error as toastError } from "../notify";
import { basename, dirname } from "../pathUtils";
import { openWorkDrawer } from "../workDrawer";
import { updateStory, updateWorkItem } from "../worksCache";
import type { WorkItem, WorkStory } from "../works";
import {
  brainRefPathKey,
  normalizeBrainDocPath,
  type BrainRef,
  type BrainRefRole,
} from "../worksBrainRefs";
import {
  brainRefGroupLabel,
  brainRefIcon,
  brainRefSourceHint,
  brainRefVisualKind,
} from "../worksBrainRefUi";
import { openBrainRef } from "../workspaceDocOpen";
import { Icon } from "./Icon";

const POP_MARGIN = 8;
const LEAVE_MS = 280;

type Props = {
  wsId: string;
  root: string;
  refs: BrainRef[];
  work?: WorkItem;
  story?: WorkStory;
};

const GROUP_ORDER: BrainRefRole[] = [
  "primary",
  "story",
  "related",
  "extra",
];

function clampPopPos(btn: DOMRect, popW: number, popH: number) {
  let left = btn.left;
  left = Math.max(
    POP_MARGIN,
    Math.min(left, window.innerWidth - popW - POP_MARGIN),
  );
  let top = btn.top - popH + 6;
  if (top < POP_MARGIN) top = btn.bottom - 6;
  return { left, top: Math.max(POP_MARGIN, top) };
}

function refMeta(path: string): string {
  const parent = dirname(path);
  return parent.length < path.length ? parent : path;
}

export function ComposerDocsChip({ wsId, root, refs, work, story }: Props) {
  const [open, setOpen] = useState(false);
  const [placed, setPlaced] = useState(false);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popPos, setPopPos] = useState({ left: 0, top: 0 });

  const groups = useMemo(() => {
    return GROUP_ORDER.map((role) => ({
      role,
      label: brainRefGroupLabel(role),
      refs: refs.filter((r) => r.role === role),
    })).filter((g) => g.refs.length > 0);
  }, [refs]);

  const cancelClose = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    leaveTimer.current = null;
  };
  const scheduleClose = () => {
    leaveTimer.current = setTimeout(() => {
      setOpen(false);
      setPlaced(false);
      setAdding(false);
    }, LEAVE_MS);
  };
  const showPopover = () => {
    cancelClose();
    setOpen(true);
  };

  useLayoutEffect(() => {
    if (!open || !btnRef.current || !popRef.current) {
      setPlaced(false);
      return;
    }
    const btn = btnRef.current.getBoundingClientRect();
    const pop = popRef.current.getBoundingClientRect();
    setPopPos(clampPopPos(btn, pop.width, pop.height));
    setPlaced(true);
  }, [open, refs.length, adding]);

  useEffect(() => () => cancelClose(), []);

  const excludeRef = async (ref: BrainRef) => {
    const path = normalizeBrainDocPath(ref.path);
    const key = brainRefPathKey(path);
    try {
      if (work) {
        if (ref.role === "extra") {
          const brainRefs = (work.brainRefs ?? []).filter(
            (r) => brainRefPathKey(r) !== key,
          );
          await updateWorkItem(root, work.id, { brainRefs });
          return;
        }
        const contextExcludedRefs = [
          ...new Set([...(work.contextExcludedRefs ?? []), path]),
        ];
        await updateWorkItem(root, work.id, { contextExcludedRefs });
        return;
      }
      if (story) {
        if (ref.role === "extra") {
          const brainRefs = (story.brainRefs ?? []).filter(
            (r) => brainRefPathKey(r) !== key,
          );
          await updateStory(root, story.id, { brainRefs });
          return;
        }
        const contextExcludedRefs = [
          ...new Set([...(story.contextExcludedRefs ?? []), path]),
        ];
        await updateStory(root, story.id, { contextExcludedRefs });
      }
    } catch (e) {
      toastError(`Couldn't update docs: ${errMsg(e)}`);
    }
  };

  const addRef = async () => {
    const path = normalizeBrainDocPath(draft);
    if (!path) return;
    const key = brainRefPathKey(path);
    try {
      if (work) {
        const brainRefs = work.brainRefs ?? [];
        if (brainRefs.some((r) => brainRefPathKey(r) === key)) return;
        const contextExcludedRefs = (work.contextExcludedRefs ?? []).filter(
          (r) => brainRefPathKey(r) !== key,
        );
        await updateWorkItem(root, work.id, {
          brainRefs: [...brainRefs, path],
          contextExcludedRefs,
        });
      } else if (story) {
        const brainRefs = story.brainRefs ?? [];
        if (brainRefs.some((r) => brainRefPathKey(r) === key)) return;
        const contextExcludedRefs = (story.contextExcludedRefs ?? []).filter(
          (r) => brainRefPathKey(r) !== key,
        );
        await updateStory(root, story.id, {
          brainRefs: [...brainRefs, path],
          contextExcludedRefs,
        });
      }
      setDraft("");
      setAdding(false);
    } catch (e) {
      toastError(`Couldn't add doc: ${errMsg(e)}`);
    }
  };

  if (refs.length === 0 && !work && !story) return null;

  const popover =
    open &&
    createPortal(
      <div
        ref={popRef}
        className={`ai-composer-docs-popover liquid-glass${placed ? " is-placed" : ""}`}
        style={{ left: popPos.left, top: popPos.top }}
        onMouseEnter={showPopover}
        onMouseLeave={scheduleClose}
        role="dialog"
        aria-label="Linked documentation"
      >
        <div className="ai-composer-docs-popover-head">
          <Icon name="file-text" size={12} />
          <span>Context docs</span>
          <span className="ai-composer-docs-popover-count">{refs.length}</span>
        </div>
        <p className="ai-composer-docs-popover-hint">
          Injected on each message — paths and outlines, not full files. Module
          docs follow the work item&apos;s <strong>Module</strong> field.
        </p>
        {groups.map((group) => (
          <div key={group.role} className="ai-composer-docs-group">
            <div className="ai-composer-docs-group-label">{group.label}</div>
            <ul className="ai-composer-docs-list">
              {group.refs.map((ref) => {
                const name = ref.title ?? basename(ref.path);
                const kind = brainRefVisualKind(ref);
                const icon = brainRefIcon(ref, fileIconName(name));
                return (
                  <li key={`${ref.role}:${ref.path}`} className="ai-composer-docs-item">
                    <button
                      type="button"
                      className={`ai-composer-docs-row ai-composer-docs-row--${kind}`}
                      onClick={() => {
                        setOpen(false);
                        setPlaced(false);
                        openBrainRef(wsId, root, ref);
                      }}
                      title={ref.path}
                    >
                      <span
                        className={`ai-composer-docs-row-icon ai-composer-docs-row-icon--${kind}`}
                      >
                        <Icon name={icon} size={14} />
                      </span>
                      <span className="ai-composer-docs-row-text">
                        <span className="ai-composer-docs-row-name">
                          {name}
                        </span>
                        <span className="ai-composer-docs-row-meta">
                          {brainRefSourceHint(ref)} · {refMeta(ref.path)}
                        </span>
                      </span>
                      <Icon
                        name="chevron-right"
                        size={12}
                        className="ai-composer-docs-row-chevron"
                      />
                    </button>
                    {(work || story) && (
                      <button
                        type="button"
                        className="ai-composer-docs-remove"
                        aria-label="Remove from context"
                        title="Remove from context"
                        onClick={() => void excludeRef(ref)}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
        {(work || story) && (
          <div className="ai-composer-docs-footer">
            {work && (
              <button
                type="button"
                className="ai-composer-docs-footer-btn"
                onClick={() => {
                  setOpen(false);
                  setPlaced(false);
                  openWorkDrawer({ wsId, root, workId: work.id });
                }}
              >
                Change module…
              </button>
            )}
            <button
              type="button"
              className="ai-composer-docs-footer-btn"
              onClick={() => setAdding((v) => !v)}
            >
              {adding ? "Cancel" : "Add doc…"}
            </button>
          </div>
        )}
        {adding && (
          <div className="ai-composer-docs-compose">
            <input
              className="ai-composer-docs-input"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="documentation/decisions/…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void addRef();
                }
              }}
            />
            <button
              type="button"
              className="ai-composer-docs-save"
              onClick={() => void addRef()}
            >
              Add
            </button>
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="ai-composer-docs-chip"
        aria-expanded={open}
        title="Documentation linked to this work"
        onMouseEnter={showPopover}
        onMouseLeave={scheduleClose}
        onClick={() => {
          cancelClose();
          setOpen((v) => {
            const next = !v;
            if (!next) setPlaced(false);
            return next;
          });
        }}
      >
        <Icon name="file-text" size={12} />
        <span>{refs.length} docs</span>
      </button>
      {popover}
    </>
  );
}
