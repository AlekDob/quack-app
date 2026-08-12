// FILE: SidebarHelpMenu.tsx
// Purpose: Footer help menu in the sidebar — recent releases, full changelog, shortcuts, feedback, docs.
// Exports: SidebarHelpMenu

import { useState } from "react";
import { BookIcon, ChatBubbleIcon, CircleQuestionIcon, GiftIcon, KeyboardIcon } from "~/lib/icons";
import { Menu, MenuGroup, MenuItem, MenuSeparator, MenuTrigger } from "./ui/menu";
import { ComposerPickerMenuPopup } from "./chat/ComposerPickerMenuPopup";
import { SidebarIconButton } from "./SidebarIconButton";
import {
  SIDEBAR_CONTEXT_MENU_ITEM_CLASS_NAME,
  SidebarContextMenuIcon,
} from "./sidebarContextMenuStyles";
import ReleaseHistoryDialog from "./ReleaseHistoryDialog";
import { WHATS_NEW_ENTRIES } from "../whatsNew/entries";
import { sortEntriesByVersionDesc } from "../whatsNew/logic";
import { openExternalLink } from "~/lib/linkChips";

const SYNARA_DOCS_URL = "https://trysynara.com/docs";

// Latest curated releases surfaced directly in the help menu. Static data, so
// computed once at module scope rather than per render.
const HELP_MENU_RELEASE_ENTRIES = sortEntriesByVersionDesc(WHATS_NEW_ENTRIES).slice(0, 3);

// Footer help menu; swapped out for the desktop-update pill while an update is
// available (see SidebarFooter).
export function SidebarHelpMenu({
  onOpenShortcuts,
  onOpenFeedback,
}: {
  onOpenShortcuts: () => void;
  onOpenFeedback: () => void;
}) {
  // `openCount` keys the dialog so each open remounts the accordion — its rows
  // capture `defaultOpen` in mount state, so a stale mount would ignore a
  // newly selected version.
  const [releaseHistory, setReleaseHistory] = useState<{
    readonly open: boolean;
    readonly version: string | null;
    readonly openCount: number;
  }>({ open: false, version: null, openCount: 0 });

  const openReleaseHistory = (version: string | null) => {
    setReleaseHistory((prev) => ({ open: true, version, openCount: prev.openCount + 1 }));
  };

  return (
    <>
      <Menu>
        <SidebarIconButton
          render={<MenuTrigger />}
          icon={CircleQuestionIcon}
          label="Help"
          tooltip="Help"
        />
        <ComposerPickerMenuPopup align="end" side="top" className="w-64 min-w-64">
          <MenuGroup>
            <div className="px-2 py-1 sm:text-xs font-medium text-muted-foreground">What’s new</div>
            {HELP_MENU_RELEASE_ENTRIES.map((entry) => (
              <MenuItem
                key={entry.version}
                className={SIDEBAR_CONTEXT_MENU_ITEM_CLASS_NAME}
                onClick={() => openReleaseHistory(entry.version)}
              >
                <span className="min-w-0 flex-1 truncate">
                  {entry.features[0]?.title ?? `Version ${entry.version}`}
                </span>
                <span className="shrink-0 text-[var(--color-text-foreground-secondary)] tabular-nums">
                  {entry.date}
                </span>
              </MenuItem>
            ))}
            <MenuItem
              className={SIDEBAR_CONTEXT_MENU_ITEM_CLASS_NAME}
              onClick={() => openReleaseHistory(null)}
            >
              <SidebarContextMenuIcon icon={GiftIcon} />
              <span>Full changelog</span>
            </MenuItem>
          </MenuGroup>
          <MenuSeparator />
          <MenuGroup>
            <MenuItem className={SIDEBAR_CONTEXT_MENU_ITEM_CLASS_NAME} onClick={onOpenShortcuts}>
              <SidebarContextMenuIcon icon={KeyboardIcon} />
              <span>Keyboard shortcuts</span>
            </MenuItem>
            <MenuItem className={SIDEBAR_CONTEXT_MENU_ITEM_CLASS_NAME} onClick={onOpenFeedback}>
              <SidebarContextMenuIcon icon={ChatBubbleIcon} />
              <span>Send feedback</span>
            </MenuItem>
            <MenuItem
              className={SIDEBAR_CONTEXT_MENU_ITEM_CLASS_NAME}
              onClick={() => openExternalLink(SYNARA_DOCS_URL)}
            >
              <SidebarContextMenuIcon icon={BookIcon} />
              <span>Docs</span>
            </MenuItem>
          </MenuGroup>
        </ComposerPickerMenuPopup>
      </Menu>
      <ReleaseHistoryDialog
        key={releaseHistory.openCount}
        open={releaseHistory.open}
        onOpenChange={(open) => {
          setReleaseHistory((prev) => ({ ...prev, open }));
        }}
        defaultExpandedVersion={releaseHistory.version}
      />
    </>
  );
}
