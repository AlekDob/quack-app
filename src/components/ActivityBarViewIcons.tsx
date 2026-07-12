import { useCallback, useRef, useState } from "react";
import type { SidebarView } from "../store";
import {
  barIconSegments,
  getActivityBarView,
  type ActivityBarIconId,
} from "../activityBarViews";
import {
  computeBarIconLayout,
  maxFitIcons,
  useActivityBarPrefs,
} from "../activityBarPrefs";
import { ActivityBarCustomizePopover } from "./ActivityBarCustomizePopover";
import { ActivityBarIconButton } from "./ActivityBarIconButton";
import { ActivityBarMorePopover } from "./ActivityBarMorePopover";
import { Icon } from "./Icon";

interface Props {
  activeId: string | null;
  activeTabKey: string | null;
  availableHeight: number;
  gitChangeCount: number;
  sectionActive: (v: SidebarView) => boolean;
  onSwitchView: (v: SidebarView) => void;
  onStoreOpen: () => void;
  onUsageOpen: () => void;
  onBrainOpen: () => void;
  onWhiteboardOpen: () => void;
  onWorksOpen: () => void;
  customizeOpen: boolean;
  onCustomizeOpenChange: (open: boolean) => void;
  sectionRef: React.RefObject<HTMLDivElement | null>;
}

function isIconActive(
  id: ActivityBarIconId,
  ctx: {
    sectionActive: (v: SidebarView) => boolean;
    activeTabKey: string | null;
  },
): boolean {
  const def = getActivityBarView(id);
  if (def.kind === "sidebar" && def.sidebarView) {
    return ctx.sectionActive(def.sidebarView);
  }
  if (def.kind === "tab" && def.tabPrefix) {
    return !!ctx.activeTabKey?.startsWith(def.tabPrefix);
  }
  return false;
}

export function ActivityBarViewIcons({
  activeId,
  activeTabKey,
  availableHeight,
  gitChangeCount,
  sectionActive,
  onSwitchView,
  onStoreOpen,
  onUsageOpen,
  onBrainOpen,
  onWhiteboardOpen,
  onWorksOpen,
  customizeOpen,
  onCustomizeOpenChange,
  sectionRef,
}: Props) {
  const { order } = useActivityBarPrefs();
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const customizeBtnRef = useRef<HTMLButtonElement>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [popoverAnchor, setPopoverAnchor] = useState<DOMRect | null>(null);

  const { visible: effectiveVisible, showMore } = computeBarIconLayout(
    availableHeight,
    order.length,
  );
  const barIds = order.slice(0, effectiveVisible);
  const overflowIds = order.slice(effectiveVisible);

  const activeCtx = { sectionActive, activeTabKey };
  const iconActive = useCallback(
    (id: ActivityBarIconId) => isIconActive(id, activeCtx),
    [sectionActive, activeTabKey],
  );

  const overflowHasActive = overflowIds.some((id) => iconActive(id));
  const overflowGit =
    overflowIds.includes("git") && gitChangeCount > 0;

  const activate = (id: ActivityBarIconId) => {
    if (!activeId) return;
    const def = getActivityBarView(id);
    if (def.kind === "sidebar" && def.sidebarView) {
      onSwitchView(def.sidebarView);
      return;
    }
    if (def.id === "store") onStoreOpen();
    else if (def.id === "usage") onUsageOpen();
    else if (def.id === "brain") onBrainOpen();
    else if (def.id === "whiteboard") onWhiteboardOpen();
    else if (def.id === "works") onWorksOpen();
  };

  const openCustomize = (from: HTMLElement | null) => {
    const el =
      from ?? customizeBtnRef.current ?? moreBtnRef.current ?? sectionRef.current;
    if (el) setPopoverAnchor(el.getBoundingClientRect());
    onCustomizeOpenChange(true);
  };

  const closeCustomize = () => {
    onCustomizeOpenChange(false);
    setPopoverAnchor(null);
  };

  const moreAnchor = moreBtnRef.current?.getBoundingClientRect();

  return (
    <div
      ref={sectionRef}
      className="activity-section view-icons"
      role="toolbar"
      aria-label="Sidebar sections"
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openCustomize(customizeBtnRef.current);
      }}
    >
      <div className="view-icons-list">
        {barIconSegments(barIds).map((seg, i) =>
          seg.kind === "sep" ? (
            <div
              key={`sep-${i}`}
              className="view-icons-kind-sep"
              role="separator"
              aria-hidden="true"
            />
          ) : (
            <ActivityBarIconButton
              key={seg.id}
              id={seg.id}
              active={iconActive(seg.id)}
              disabled={!activeId}
              gitChangeCount={gitChangeCount}
              onClick={() => activate(seg.id)}
            />
          ),
        )}
      </div>
      <div className="view-icons-footer">
        {showMore && (
          <button
            ref={moreBtnRef}
            type="button"
            className={`activity-icon activity-icon--more${
              overflowHasActive ? " has-active" : ""
            }${overflowGit ? " has-changes" : ""}`}
            title="More activity bar items"
            aria-label="More activity bar items"
            aria-haspopup="menu"
            aria-expanded={moreOpen}
            onClick={() => setMoreOpen((v) => !v)}
            disabled={!activeId}
          >
            <Icon name="more-horizontal" size={20} />
            {overflowGit && (
              <span className="activity-badge" aria-hidden="true">
                {gitChangeCount > 99 ? "99+" : gitChangeCount}
              </span>
            )}
          </button>
        )}
        <button
          ref={customizeBtnRef}
          type="button"
          className="activity-icon activity-icon--customize"
          title="Customize activity bar — drag to reorder"
          aria-label="Customize activity bar"
          aria-haspopup="dialog"
          aria-expanded={customizeOpen}
          onClick={() => openCustomize(customizeBtnRef.current)}
          disabled={!activeId}
        >
          <Icon name="grip-vertical" size={18} />
        </button>
      </div>
      {moreOpen && moreAnchor && (
        <ActivityBarMorePopover
          anchor={moreAnchor}
          open={moreOpen}
          ids={overflowIds}
          gitChangeCount={gitChangeCount}
          isActive={iconActive}
          onPick={activate}
          onCustomize={() => openCustomize(moreBtnRef.current)}
          onClose={() => setMoreOpen(false)}
        />
      )}
      {customizeOpen && popoverAnchor && (
        <ActivityBarCustomizePopover
          anchor={popoverAnchor}
          open={customizeOpen}
          maxFit={maxFitIcons(availableHeight)}
          onClose={closeCustomize}
        />
      )}
    </div>
  );
}
