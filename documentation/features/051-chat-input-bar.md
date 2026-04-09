---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-07
last_verified: 2026-04-09
tags: [chat-input-bar, chat, ui, compose, session, popover, drag-drop, file-mention, mention-autocomplete, icons]
---

## Chat Input Bar
**Purpose:** Single merged toolbar below the chat textarea that consolidates settings, compose tools, session tools, and send/stop into one row.
**Stack:** React 18, TypeScript, CSS

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/chat/UnifiedActionBar.tsx` | `UnifiedActionBar` -- main bar with left (settings, attach, compose, session, loop) and right (send/stop) sections |
| Component | `src/components/chat/ComposePopover.tsx` | `ComposePopover` -- dropdown with Prompt Engineer, Voice, Snippets, New Line, XML Tag, IDE Context, Fullscreen |
| Component | `src/components/chat/SessionPopover.tsx` | `SessionPopover` -- dropdown with Brain Update, BTW Side-chain, Quick Loop, Compact, Terminal, Clear |
| Component | `src/components/loop/QuickLoopPopover.tsx` | `QuickLoopPopover` -- configure and start/stop recurring prompt loops |
| Component | `src/components/loop/QuickLoopIndicator.tsx` | `QuickLoopIndicator` -- shows loop status/run count inline in the bar |
| Component | `src/components/ChatSettingsMenu.tsx` | `ChatSettingsMenu` -- model, thinking mode, permission mode, effort popover |
| Component | `src/components/KeyboardShortcutTooltip.tsx` | `KeyboardShortcutTooltip` -- wraps buttons with keyboard shortcut tooltips |
| Config | `src/components/chat/UnifiedActionBar.css` | Shared styles for bar, buttons, popovers, popover items, responsive breakpoints |
| Component | `src/components/ChatInput.tsx` | Integrates `UnifiedActionBar` at the bottom of the chat input area |
| Component | `src/components/ChatView.tsx` | Passes session-level props (`unifiedBarProps`) down to ChatInput |

### Data Flow
```
[ChatView] → settingsProps + sessionProps → [ChatInput.unifiedBarProps] → [UnifiedActionBar]
[UnifiedActionBar] → compose trigger → [ComposePopover] → action callbacks → [ChatInput handlers]
[UnifiedActionBar] → session trigger → [SessionPopover] → action callbacks → [ChatView handlers]
[UnifiedActionBar] → loop trigger → [QuickLoopPopover] → startLoop/stopLoop → [useQuickLoop hook]
```

### Key Functions
- `UnifiedActionBar(props: UnifiedActionBarProps) → JSX` -- renders left group (settings, attach, compose, session, loop) + spacer + right group (send/stop)
- `ComposePopover({ isOpen, onClose, ... }) → JSX` -- popover with compose actions (prompt engineer, voice, snippets, newline, xml, IDE context, fullscreen)
- `SessionPopover({ isOpen, onClose, ... }) → JSX` -- popover with session actions (brain, BTW, loop, compact, terminal, clear)
- `handleItemClick(action) → void` -- fires action callback then closes popover (used in both popovers)

### State
- `composeOpen`: boolean -- compose popover visibility (component)
- `sessionOpen`: boolean -- session popover visibility (component)
- `loopPopoverOpen`: boolean -- quick loop popover visibility (component)
- `loopBtnRef`: RefObject -- anchor reference for loop popover positioning (component)

### External Dependencies
- `lucide-react`: `Brain` icon used in SessionPopover

### Key Interfaces

#### UnifiedActionBarProps
| Prop group | Props |
|------------|-------|
| Settings | `settingsProps` (model, thinkingMode, permissionMode, effort + change handlers) |
| Attach | `onAttach`, `attachShortcut` |
| Compose | `onOpenPromptEngineer`, `onVoiceClick`, `isSpeechSupported`, `onToggleSnippets`, `onInsertNewLine`, `onInsertXmlTag`, `hasIdeContext`, `ideContextEnabled`, `onToggleIdeContext`, `isFullscreen`, `onToggleFullscreen` |
| Session | `hasMessages`, `isLoading`, `onBrainUpdate`, `onToggleBTW`, `btwIsOpen`, `quickLoop`, `onCompact`, `onOpenTerminal`, `onClear` |
| Send/Stop | `isStreaming`, `onSend`, `onStop`, `canSend`, `sendShortcut` |

### Popover Button Labels
The Compose and Session triggers display text labels ("Compose", "Session") via `.uab-btn-label` spans so users understand what each popover contains. Styled at 11px/500 weight.

### /brain Slash Command
The "Update Brain" action in SessionPopover sends `/brain` — a **Quack built-in** slash command defined in `src-tauri/src/slash_commands.rs` (`QUACK_BUILTIN_COMMANDS`). Unlike SDK builtins (passed raw to CLI), Quack builtins have their own content that gets expanded by `expand_slash_command`. Users can also type `/brain` directly in the textarea autocomplete.

### mouseDown Prevention
The `.unified-action-bar` uses `onMouseDown={(e) => { ... e.preventDefault() }}` to keep textarea focus, but **skips** `preventDefault` when the click target is inside `.uab-popover` or `.chat-settings-menu` — otherwise native `<select>` dropdowns in ChatSettingsMenu would be blocked.

### CSS Architecture
- `.unified-action-bar` -- flex row container with left/spacer/right layout
- `.uab-btn` -- 28px icon buttons, transparent bg, hover/active states
- `.uab-btn--with-chevron` -- wider buttons with dropdown chevron indicator
- `.uab-popover` -- shared popover panel (glassmorphic, slides up from button)
- `.uab-popover-item` -- popover row with icon + label, supports `--active`, `--danger` variants
- `.uab-popover-badge` -- "ON" badge for toggleable items
- `.uab-popover-shortcut` -- keyboard shortcut hint (right-aligned)
- Responsive: buttons shrink to 26px below 768px

### @ Mention Autocomplete Icons

The autocomplete dropdown (`div.agent-autocomplete.mention-autocomplete`) renders five sections in order: Team > Skills > Droids > Features > Files.

#### Section Header Icons
| Section | Icon | Source/Match |
|---------|------|-------------|
| Skills | Star outline (stroke only, `var(--accent-color)` gradient fill) | Matches `icons.skills` in `SidePanelAccordion.tsx` |
| Features | Connected-circles graph (stroke `#FFD700`, 4 outer circles + 1 center + connecting lines) | Matches `icons.features` in `SidePanelAccordion.tsx` |

#### Per-Item Badge Icons
| Section | Badge class | Icon | Description |
|---------|-------------|------|-------------|
| Skills | `.skill-badge` | Star outline SVG (20x20 viewBox, stroke `var(--accent-color)`, `strokeWidth="1.5"`, no fill) | Matches `icons.skills` star-outline path from `SidePanelAccordion.tsx` |
| Features | `.feature-badge` | Connected-circles graph SVG (20x20 viewBox, stroke `#FFD700`, 5 circles + 4 connecting lines) | Matches `icons.features` graph from `SidePanelAccordion.tsx` |

#### Badge CSS
- `.skill-badge` -- `background: rgba(var(--accent-rgb), 0.15)`, `border-radius: var(--radius-sm)`, flex-centered, `color: var(--accent-color)`
- `.feature-badge` -- `background: rgba(255, 215, 0, 0.15)`, `border-radius: var(--radius-sm)`, flex-centered (gold tint)

#### Icon Consistency Rule
Both skill and feature icons in the @ mention autocomplete use the **same SVG paths** as the SidePanelAccordion sidebar icons (`icons.skills` = star outline, `icons.features` = connected-circles graph). This ensures visual consistency between sidebar navigation and inline mentions.
