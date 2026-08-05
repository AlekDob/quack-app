// FILE: ComposerActivityStrip.tsx
// Purpose: One compact "what is running right now" strip stacked above the composer:
// subagent rows (avatar, nickname, role/model, live status — clicking switches to that
// thread) and background activity rows (browser automation, running agent commands).
// Wraps the shared stacked-header frame like the active task list.
// Layer: Chat composer UI
// Exports: ComposerActivityStrip

import type { ThreadId } from "@synara/contracts";

import {
  BackgroundTrayIcon,
  BackToParentIcon,
  BotIcon,
  GlobeIcon,
  LoaderIcon,
  PanelCollapseIcon,
  PanelExpandIcon,
  StopIcon,
  TerminalIcon,
} from "~/lib/icons";
import {
  subagentStatusDotClassName,
  subagentStatusTextToneClassName,
} from "~/lib/subagentPresentation";
import { cn } from "~/lib/utils";
import { Button } from "../ui/button";
import { DisclosureRegion } from "../ui/DisclosureRegion";
import {
  activityStripHeaderLabel,
  type ComposerActivityStripBackgroundItem,
  type ComposerActivityStripSubagentItem,
  type ComposerActivityStripRow,
} from "./ComposerActivityStrip.logic";
import {
  ComposerStackedPanelHeaderRow,
  ComposerStackedPanelRowLabel,
  ComposerStackedPanelRowMain,
} from "./ComposerStackedPanelContent";
import { ComposerStackedPanel } from "./ComposerStackedPanel";
import { SubagentAvatar } from "./SubagentAvatar";
import {
  COMPOSER_STACKED_PANEL_BODY_PADDING_CLASS_NAME,
  COMPOSER_STACKED_PANEL_ICON_BUTTON_CLASS_NAME,
  COMPOSER_STACKED_PANEL_ICON_CLASS_NAME,
  COMPOSER_STACKED_PANEL_SCROLL_REGION_CLASS_NAME,
} from "./composerStackedPanelStyles";

// Every row kind shares one shell so the strip reads as a single list.
const STRIP_ROW_CLASS_NAME =
  "-mx-1 flex w-[calc(100%+0.5rem)] min-w-0 items-center gap-1 rounded-md px-1 py-1 transition-colors hover:bg-[var(--color-background-button-secondary-hover)]";
const STRIP_ROW_LABEL_CLASS_NAME =
  "min-w-0 flex-1 truncate text-[12px] font-medium text-foreground/85";

interface ComposerActivityStripProps {
  items: ReadonlyArray<ComposerActivityStripRow>;
  compact: boolean;
  onCompactChange: (compact: boolean) => void;
  onOpenThread: (threadId: ThreadId) => void;
  onBackgroundItem?: (item: ComposerActivityStripSubagentItem) => void;
  onStopItem?: (item: ComposerActivityStripSubagentItem) => void;
  onStopAll?: () => void;
  /** Opens the thread's browser surface from the browser automation row. */
  onOpenBrowser?: () => void;
  attachedToPrevious?: boolean;
}

export const ComposerActivityStrip = function ComposerActivityStrip({
  items,
  compact,
  onCompactChange,
  onOpenThread,
  onBackgroundItem,
  onStopItem,
  onStopAll,
  onOpenBrowser,
  attachedToPrevious: attachedToPreviousProp,
}: ComposerActivityStripProps) {
  const attachedToPrevious = attachedToPreviousProp ?? false;
  const subagentItems = items.filter(
    (item): item is ComposerActivityStripSubagentItem => item.kind === "subagent",
  );
  // Stop-all only ever targeted subagents; the header spinner covers every kind.
  const runningSubagentCount = subagentItems.filter((item) => item.isActive).length;
  const runningCount = items.filter(
    (item) => (item.kind === "subagent" || item.kind === "activity") && item.isActive,
  ).length;

  return (
    <ComposerStackedPanel
      passthroughSideMargins
      attachedToPrevious={attachedToPrevious}
      data-testid="composer-activity-strip"
    >
      <ComposerStackedPanelHeaderRow>
        <ComposerStackedPanelRowMain>
          {compact && runningCount > 0 ? (
            <LoaderIcon className={cn(COMPOSER_STACKED_PANEL_ICON_CLASS_NAME, "animate-spin")} />
          ) : (
            <BotIcon className={COMPOSER_STACKED_PANEL_ICON_CLASS_NAME} />
          )}
          <ComposerStackedPanelRowLabel tone="meta">
            {activityStripHeaderLabel(items)}
          </ComposerStackedPanelRowLabel>
        </ComposerStackedPanelRowMain>
        {onStopAll && runningSubagentCount > 1 ? (
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className={cn("shrink-0", COMPOSER_STACKED_PANEL_ICON_BUTTON_CLASS_NAME)}
            onClick={onStopAll}
            aria-label="Stop all subagents"
            title="Stop all running subagents"
          >
            <StopIcon className="size-3" />
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className={cn("shrink-0", COMPOSER_STACKED_PANEL_ICON_BUTTON_CLASS_NAME)}
          onClick={() => onCompactChange(!compact)}
          aria-label={compact ? "Expand activity strip" : "Collapse activity strip"}
          title={compact ? "Expand activity strip" : "Collapse activity strip"}
        >
          {compact ? (
            <PanelExpandIcon className="size-3" />
          ) : (
            <PanelCollapseIcon className="size-3" />
          )}
        </Button>
      </ComposerStackedPanelHeaderRow>

      <DisclosureRegion open={!compact}>
        <div
          className={cn(
            "space-y-0",
            COMPOSER_STACKED_PANEL_BODY_PADDING_CLASS_NAME,
            COMPOSER_STACKED_PANEL_SCROLL_REGION_CLASS_NAME,
          )}
        >
          {items.map((item) => {
            if (item.kind === "parent") {
              return (
                <div
                  key={item.key}
                  data-testid="composer-subagent-parent-row"
                  className={STRIP_ROW_CLASS_NAME}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    title={item.label}
                    onClick={() => onOpenThread(item.threadId)}
                  >
                    <BackToParentIcon className="size-3 shrink-0 text-muted-foreground/55" />
                    <span className={STRIP_ROW_LABEL_CLASS_NAME}>{item.label}</span>
                  </button>
                </div>
              );
            }
            if (item.kind === "activity") {
              return (
                <BackgroundActivityRow
                  key={item.key}
                  item={item}
                  {...(item.activityKind === "browser" && onOpenBrowser
                    ? { onOpen: onOpenBrowser }
                    : {})}
                />
              );
            }
            return (
              <div
                key={item.key}
                data-testid="composer-subagent-row"
                data-viewed={item.isViewed || undefined}
                className={cn(
                  "group",
                  STRIP_ROW_CLASS_NAME,
                  item.isViewed && "bg-[var(--color-background-button-secondary)]",
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  title={item.fullLabel}
                  onClick={() => onOpenThread(item.threadId)}
                >
                  {/* Avatar carries identity, the dot right next to it carries status. */}
                  <span className="flex shrink-0 items-center gap-1">
                    <SubagentAvatar seed={item.avatarSeed} />
                    <span
                      className={cn(
                        "size-1.5 shrink-0 rounded-full",
                        subagentStatusDotClassName(item.statusKind),
                      )}
                    />
                  </span>
                  <span className={STRIP_ROW_LABEL_CLASS_NAME}>
                    <span>{item.primaryLabel}</span>
                    {item.role ? (
                      <span className="ml-1 text-[11px] font-normal text-muted-foreground/55">
                        ({item.role})
                      </span>
                    ) : null}
                    {item.modelLabel ? (
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground/45">
                        {item.modelLabel}
                      </span>
                    ) : null}
                    {item.isBackground ? (
                      <span className="ml-1.5 text-[11px] font-normal text-muted-foreground/45">
                        background
                      </span>
                    ) : null}
                  </span>
                  {item.statusLabel ? (
                    <span
                      className={cn(
                        "shrink-0 text-[11px]",
                        subagentStatusTextToneClassName(item.statusKind),
                      )}
                    >
                      {item.statusLabel}
                    </span>
                  ) : null}
                </button>
                {item.isActive && !item.isBackground && onBackgroundItem ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className={cn(
                      "shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
                      COMPOSER_STACKED_PANEL_ICON_BUTTON_CLASS_NAME,
                    )}
                    onClick={() => onBackgroundItem(item)}
                    aria-label="Run in background (ctrl+b)"
                    title="Run in background (ctrl+b)"
                  >
                    <BackgroundTrayIcon className="size-3" />
                  </Button>
                ) : null}
                {item.isActive && onStopItem ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className={cn(
                      "shrink-0 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100",
                      COMPOSER_STACKED_PANEL_ICON_BUTTON_CLASS_NAME,
                    )}
                    onClick={() => onStopItem(item)}
                    aria-label="Stop subagent"
                    title="Stop subagent"
                  >
                    <StopIcon className="size-3" />
                  </Button>
                ) : null}
              </div>
            );
          })}
        </div>
      </DisclosureRegion>
    </ComposerStackedPanel>
  );
};

// Background rows carry no identity (there is only one browser, commands are
// one-shot), so a kind icon replaces the subagent avatar next to the status dot.
function BackgroundActivityRow({
  item,
  onOpen,
}: {
  item: ComposerActivityStripBackgroundItem;
  onOpen?: () => void;
}) {
  const KindIcon = item.activityKind === "browser" ? GlobeIcon : TerminalIcon;
  const content = (
    <>
      <span className="flex shrink-0 items-center gap-1">
        <KindIcon className="size-3 text-muted-foreground/55" />
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            subagentStatusDotClassName(item.statusKind),
          )}
        />
      </span>
      <span className={STRIP_ROW_LABEL_CLASS_NAME}>
        <span>{item.label}</span>
        {item.secondary ? (
          <span className="ml-1.5 text-[11px] font-normal text-muted-foreground/45">
            {item.secondary}
          </span>
        ) : null}
      </span>
      <span
        className={cn("shrink-0 text-[11px]", subagentStatusTextToneClassName(item.statusKind))}
      >
        {item.statusLabel}
      </span>
    </>
  );

  return (
    <div className={STRIP_ROW_CLASS_NAME} data-testid="composer-activity-row">
      {onOpen ? (
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
          title={item.label}
          onClick={onOpen}
        >
          {content}
        </button>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-2" title={item.label}>
          {content}
        </span>
      )}
    </div>
  );
}
