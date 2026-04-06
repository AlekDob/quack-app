---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-03
last_verified: 2026-04-06
tags: [edit-summary-bar, file-edits, per-turn, chat-view, feature-highlight, color-themes]
---

## Edit Summary Bar — Per-Turn Tracking
**Purpose:** Show only the files modified in the last assistant turn (not the entire session) in the inline EditSummaryBar, restoring the original UX that was lost when cumulative tracking was added for the ChangesPanel.
**Stack:** React 18, TypeScript strict

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | src/components/ChatView.tsx | `scanMessagesForEdits` helper, dual `useMemo` returning `allFileEdits` + `lastTurnFileEdits` |
| Component | src/components/EditSummaryBar.tsx | Inline bar rendering file changes with 4-category color theming |
| Styles | src/components/EditSummaryBar.css | Color themes: green (code), gold (features), purple (docs), red (deleted) |

### Data Flow

**Dual edit tracking:**
```
messages (all assistant) → scanMessagesForEdits(allMsgs) → allFileEdits
                         → scanMessagesForEdits([lastMsg]) → lastTurnFileEdits

allFileEdits       → onEditsChange → App.tsx → modifiedFiles → ChangesPanel (cumulative)
lastTurnFileEdits  → EditSummaryBar props (per-turn only)
```

**File categorization (in EditSummaryBar):**
```
edits[] → isFeatureFile()  → featureFiles  (gold #FFD700, star icon)
        → isMarkdownFile() → markdownFiles (purple, doc icon)
        → else             → codeEdits     (green, split into new/modified)
deletes[]                  → deletedFiles  (red, trash icon)
```

### Color Themes

| Category | Color | Trigger | CSS class |
|----------|-------|---------|-----------|
| Code (new/modified) | Green `rgba(34, 197, 94)` | Non-markdown files | default |
| Features | Gold `#FFD700` | Path matches `/features/*.md` | `edit-summary-bar-feature-priority` |
| Documentation | Purple `rgba(139, 92, 246)` | `.md` files NOT in `/features/` | `edit-summary-bar-markdown-only` |
| Deleted | Red `rgba(239, 68, 68)` | Files removed via `rm` | `edit-summary-bar-section-delete` |

**Priority rule:** If any feature file is present, the entire bar uses the gold theme (`hasFeaturePriority`). Feature files are detected by `isFeatureFile()` which matches paths ending in `/features/*.md`.

### Key Design Decisions
- **Helper extraction**: `scanMessagesForEdits()` avoids duplicating the 90-line scanning logic. Called twice with different message subsets.
- **No new state**: Both sets are derived from `messages` via `useMemo`. No stores, no side effects.
- **Backward compatible**: `onEditsChange` still receives cumulative data — ChangesPanel, FileExplorer indicators, and all downstream consumers are unaffected.
- **Feature color priority**: Gold bar when features present — consistent with `#FFD700` used in ChatInput autocomplete, SidePanelAccordion, and feature map.

### Brain References
- `documentation/bugs/fix-edit-summary-bar-cumulative-regression.md` — root cause and fix
- `documentation/bugs/fix-changes-panel-all-messages.md` — the original commit that caused the regression
