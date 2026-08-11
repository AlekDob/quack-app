---
type: feature-doc
project: synara
stack: React / TypeScript
created: 2026-08-11
last_verified: 2026-08-11
status: active
tags: [sidebar, help-menu, changelog, whats-new, release-history]
---

## Sidebar Help Menu

**Purpose:** The `?` button in the sidebar footer. Lists the three most recent releases inline, opens the full changelog in a dialog, and holds the shortcuts / feedback / docs links.
**Stack:** React / TypeScript (apps/web)

### Files

| Type      | Path                                                   | Exports/Purpose                                                          |
| --------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| Component | `apps/web/src/components/SidebarHelpMenu.tsx`          | `SidebarHelpMenu` — the menu itself plus the release-history dialog host |
| Component | `apps/web/src/components/ReleaseHistoryDialog.tsx`     | The dialog; renders `ChangelogAccordion` over the curated entries        |
| Component | `apps/web/src/whatsNew/ChangelogAccordion.tsx`         | Per-version accordion rows                                               |
| Data      | `apps/web/src/whatsNew/entries.ts`                     | `WHATS_NEW_ENTRIES` — the curated release list, hand-authored            |
| Logic     | `apps/web/src/whatsNew/logic.ts`                       | `sortEntriesByVersionDesc`, `compareVersions`, `parseVersion`            |
| Consumer  | `apps/web/src/components/Sidebar.tsx`                  | Renders it in `SidebarFooter`                                            |
| Test      | `apps/web/src/components/chatHotPath.compiler.test.ts` | Line-budget ratchet for `Sidebar.tsx` (6947)                             |

### Data Flow

- `WHATS_NEW_ENTRIES` is a hand-written list in `entries.ts`. No fetch, no version endpoint — shipping a release means editing that file.
- `HELP_MENU_RELEASE_ENTRIES` sorts it newest-first and takes the top 3. Computed at module scope, not per render, because the data is static.
- Each row shows `entry.features[0].title` (falling back to `Version {n}`) plus the date, and opens `ReleaseHistoryDialog` expanded on that version.
- "Full changelog" opens the same dialog with `defaultExpandedVersion: null`, so every row starts collapsed and the user scans by date.

### State

- `releaseHistory: { open, version, openCount }` — local to `SidebarHelpMenu`, no store.
- `openCount` is used as the dialog's React `key`. The accordion rows read `defaultOpen` once at mount, so without remounting, picking a different version from the menu would be ignored by a still-mounted dialog.

### Behavior

- Replaced an external link to `trysynara.com/changelog`. Release notes are now in-app; nothing opens a browser except "Docs".
- `ReleaseHistoryDialog` is also reachable from Settings > About; it takes `entries` as an optional prop so callers can pass a fixture instead of the module list.
- The whole menu is swapped out for the desktop-update pill while an update is pending — see `SidebarFooter`.

### Why it is its own file

`Sidebar.tsx` is ~6900 lines and is fed to React Compiler, whose memory use grows faster than file size. `chatHotPath.compiler.test.ts` ratchets its line count; this menu is self-contained (one piece of local state, no sidebar context), so it lives outside rather than eating budget.

### Out of scope (deliberately not built)

- Fetching release notes from a server or from GitHub releases.
- Marking releases as read / an unread badge on the `?` button (the post-update dialog covers "you just updated").
- Search or filtering inside the release history.
