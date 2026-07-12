import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { openFeatureDocDrawer } from "../featureDocDrawer";
import { openBrainDoc } from "../brainInject";
import { fileIconName } from "../fileIcons";
import { basename, dirname, joinPath } from "../pathUtils";
import { useStore } from "../store";
import type { BrainRef, BrainRefRole } from "../worksBrainRefs";
import { Icon } from "./Icon";

const POP_MARGIN = 8;
const LEAVE_MS = 280;

type Props = {
  wsId: string;
  root: string;
  refs: BrainRef[];
};

const GROUP_ORDER: BrainRefRole[] = [
  "primary",
  "story",
  "related",
  "extra",
];

function groupLabel(role: BrainRefRole): string {
  if (role === "primary") return "Feature";
  if (role === "story") return "Story";
  if (role === "related") return "Related";
  return "Added";
}

function clampPopPos(btn: DOMRect, popW: number, popH: number) {
  let left = btn.left;
  left = Math.max(
    POP_MARGIN,
    Math.min(left, window.innerWidth - popW - POP_MARGIN),
  );
  // Overlap the anchor slightly so the pointer never crosses a dead zone.
  let top = btn.top - popH + 6;
  if (top < POP_MARGIN) top = btn.bottom - 6;
  return { left, top: Math.max(POP_MARGIN, top) };
}

function openRef(wsId: string, root: string, ref: BrainRef): void {
  if (ref.role === "story") {
    void useStore.getState().openFile(wsId, joinPath(root, ref.path));
    return;
  }
  if (ref.role === "primary" || ref.path.includes("/features/")) {
    openFeatureDocDrawer({
      wsId,
      root,
      featurePath: ref.path,
      title: ref.title ?? basename(ref.path),
    });
    return;
  }
  void openBrainDoc(wsId, root, ref.path.replace(/^documentation\//, ""));
}

function refMeta(path: string): string {
  const parent = dirname(path);
  return parent.length < path.length ? parent : path;
}

export function ComposerDocsChip({ wsId, root, refs }: Props) {
  const [open, setOpen] = useState(false);
  const [placed, setPlaced] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [popPos, setPopPos] = useState({ left: 0, top: 0 });

  const groups = useMemo(() => {
    return GROUP_ORDER.map((role) => ({
      role,
      label: groupLabel(role),
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
  }, [open, refs.length]);

  useEffect(() => () => cancelClose(), []);

  if (refs.length === 0) return null;

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
          Injected on each message — paths and outlines, not full files.
        </p>
        {groups.map((group) => (
          <div key={group.role} className="ai-composer-docs-group">
            <div className="ai-composer-docs-group-label">{group.label}</div>
            <ul className="ai-composer-docs-list">
              {group.refs.map((ref) => {
                const name = ref.title ?? basename(ref.path);
                return (
                  <li key={`${ref.role}:${ref.path}`}>
                    <button
                      type="button"
                      className="ai-composer-docs-row"
                      onClick={() => {
                        setOpen(false);
                        setPlaced(false);
                        openRef(wsId, root, ref);
                      }}
                      title={ref.path}
                    >
                      <span className="ai-composer-docs-row-icon">
                        <Icon name={fileIconName(name)} size={14} />
                      </span>
                      <span className="ai-composer-docs-row-text">
                        <span className="ai-composer-docs-row-name">
                          {name}
                        </span>
                        <span className="ai-composer-docs-row-meta">
                          {refMeta(ref.path)}
                        </span>
                      </span>
                      <Icon
                        name="chevron-right"
                        size={12}
                        className="ai-composer-docs-row-chevron"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
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
