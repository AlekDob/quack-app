---
type: pattern
project: quack-app
created: 2026-02-08
updated: 2026-02-08
tags: [quack-store, marketplace, ui, drawer, apple-design, avatars, markdown]
---

# Quack Store System (formerly Addons)

## Overview

The **Quack Store** is a full-width drawer UI (85vw) for browsing, installing, and managing Claude Agent SDK resources. Redesigned with Apple App Store-style layout: sidebar navigation (200px) + main content area with hero banner + grid cards. Renamed from "Addons" to "Quack Store" on 2026-02-08.

## Key Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/components/QuackStoreDrawer.tsx` | Main orchestrator (sidebar + main content) | 136 |
| `src/components/QuackStoreDrawer.css` | All store styles | 634 |
| `src/components/store/StoreSidebar.tsx` | 200px sidebar: search + nav | 88 |
| `src/components/store/StoreMainContent.tsx` | Scrollable main area: hero + grid | 105 |
| `src/components/store/StoreHeroBanner.tsx` | Full-width featured banner (180px) | 63 |
| `src/components/store/StoreFeaturedCard.tsx` | Featured grid cards | 62 |
| `src/components/store/StoreItemCard.tsx` | Regular grid item cards | 88 |
| `src/components/store/StoreEmptyState.tsx` | Loading/empty/error states | 70 |
| `src/components/store/StoreIcons.tsx` | Category icons + duck avatar helpers | 127 |
| `src/components/store/storeConstants.ts` | Tab config + category mappings | 32 |
| `src/components/MarketplaceInstallModal.tsx` | Detail modal with markdown rendering | 176 |
| `src/hooks/useMarketplace.ts` | Data hook + install/uninstall | 657 |
| `src/types.ts` | Types: MarketplaceResource, AgentTemplate | - |

## UI Architecture

### Layout (Apple App Store Style)

- **Width**: `clamp(900px, 85vw, 1600px)` (was 45vw)
- **Structure**: Two-column flex row
  - **Sidebar** (200px fixed): "Quack Store" title, search input, vertical nav (Discover + 7 categories)
  - **Main content** (flex 1): page title (28px), hero banner (180px), featured grid (300px min), item grid (320px min)

### Sidebar Navigation

- **Discover** (compass icon): Shows all resources, featured first
- **7 Categories**: Skills, Agents, Droids, Rules, MCP, Hooks, Snippets
- **Active state**: Cyan left border (`#00D9FF`), brighter text
- **Search**: Real-time filter across name/description/tags

### Content Grids

- **Hero banner**: First featured item, full-width, 80px icon or duck avatar, gradient bg
- **Featured grid**: `repeat(auto-fill, minmax(300px, 1fr))` — ~2-4 columns
- **Item grid**: `repeat(auto-fill, minmax(320px, 1fr))` — ~3-5 columns
- **Cards**: 40px icons/avatars, name, meta, description (2-line clamp), signals row

## Color Gradients by Category

- **Skills**: Orange (#f28c52 → #e67339)
- **Agents**: Orange/Yellow (#f28c52 → #fbbf24)
- **Droids**: Teal (#4ecdc4 → #26a69a)
- **Rules**: Blue (#60a5fa → #3b82f6)
- **Hooks**: Purple (#a78bfa → #8b5cf6)
- **MCP**: Green (#34d399 → #10b981)
- **Commands/Snippets**: Pink (#f472b6 → #ec4899)

## Duck Avatars for Agent Bundles

**NEW (2026-02-08)**: Agent-bundles now show duck avatars instead of generic category icons.

### How it works

1. Marketplace `plugin.json` includes `agentTemplate.suggestedAvatar` (e.g., `duck5.jpeg`)
2. `useMarketplace.ts` passes this as `icon` field on `MarketplaceResource`
3. Store components check `hasDuckAvatar(resource.icon)` — if true, render `<img>` with duck avatar; else, SVG icon
4. Duck avatars used in: `StoreItemCard` (40px), `StoreFeaturedCard` (48px), `StoreHeroBanner` (80px), `MarketplaceInstallModal` (52px)
5. Avatars resolve from `public/images/ducks/new-avatars/` via `getAvatarUrl()` (handles dev/Tauri paths)

### Helper functions (StoreIcons.tsx)

```typescript
hasDuckAvatar(icon?: string): boolean
getDuckAvatarUrl(icon: string): string
```

### CSS classes

```css
.store-item-avatar { width: 40px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.1); }
.store-featured-avatar { width: 48px; border-radius: 12px; }
.store-hero-avatar { width: 80px; border-radius: 18px; }
.store-detail-avatar { width: 52px; border-radius: 12px; }
```

## Markdown Rendering in Detail Modal

**NEW (2026-02-08)**: The detail modal now renders `longDescription` as rich markdown using the existing `MarkdownText` component.

### Implementation

- `MarketplaceInstallModal.tsx` imports `MarkdownText` and renders `<MarkdownText>{resource.longDescription || resource.description}</MarkdownText>`
- Override CSS in `.store-detail-body` increases font sizes from default 12px to 13px for better readability
- Supports: headings (##, ###), code blocks with copy button, inline code, bold/italic, lists, tables

### Marketplace longDescription

- Skills: Extracted from full SKILL.md body (max 2000 chars) in `useMarketplace.ts`
- Agent-bundles: Stored in `plugin.json` as `longDescription` field (150-300 words, written with rich markdown)
- Example: Flutter State skill has headings, code blocks, bullet lists explaining Riverpod/BLoC/Provider patterns

## Installed Badge Position

**Changed (2026-02-08)**: "Installed" badge moved from name row to signals row for better layout.

- **Before**: `<span className="store-item-name">{name}</span> {installed && <badge>}`
- **After**: Badge in `.store-item-signals` row, aligned right with `margin-left: auto`, opposite "Verified" on left
- **Reason**: Gives title full width without compression

## CSS Naming Convention

- Drawer-level: `.quack-store-*` (header, search, nav, content)
- Sidebar: `.store-sidebar-*` (nav, search, item, label)
- Hero: `.store-hero-*` (banner, icon, avatar, info, action)
- Featured: `.store-featured-*` (card, icon, avatar, label, content)
- Item-level: `.store-item-*` (card, icon, avatar, name, description, signals, action)
- Detail modal: `.store-detail-*` (overlay, panel, header, icon, avatar, body, tags, actions)
- Scope buttons: `.store-scope-btn`
- Empty states: `.store-empty-*`, `.store-skeleton-*`

## Development History (2026-02-08)

### Phase 1: Rename Addons → Quack Store
- Renamed `AddonsDrawer` → `QuackStoreDrawer` (component + CSS)
- Updated all class names: `.addons-*` → `.quack-store-*`
- Updated props: `onAddonsClick` → `onStoreClick`
- Cleaned up duplicate plugin drawer references

### Phase 2: Apple App Store Redesign
- Changed from 45vw vertical list to 85vw two-column layout
- Created 5 new components: `StoreSidebar`, `StoreMainContent`, `StoreHeroBanner`, `StoreFeaturedCard`, `StoreEmptyState` (+ extracted `storeConstants`)
- Replaced horizontal tabs with vertical sidebar navigation
- Added hero banner for first featured item (180px, gradient bg, 80px icon)
- CSS Grid layout for featured (300px cards) + items (320px cards)
- Reduced `QuackStoreDrawer.tsx` from 222 to 136 lines (-39%)

### Phase 3: Duck Avatars for Agent-Bundles
- Added `icon` field to agent-bundle `MarketplaceResource` (from `agentTemplate.suggestedAvatar`)
- Created `hasDuckAvatar()` and `getDuckAvatarUrl()` helpers in `StoreIcons.tsx`
- Updated 4 components to conditionally render `<img>` duck avatar or SVG icon
- Added 4 CSS avatar classes (40px, 48px, 52px, 80px with borders)

### Phase 4: Markdown Rendering in Detail Modal
- Integrated existing `MarkdownText` component into `MarketplaceInstallModal`
- Added CSS overrides in `.store-detail-body` for larger font sizes (13px vs 12px)
- Marketplace skills auto-extract `longDescription` from full SKILL.md body
- Agent-bundles use hand-written `longDescription` in `plugin.json` (150-300 words with markdown)

### Phase 5: Installed Badge Repositioning
- Moved "Installed" badge from name row to signals row (bottom-right, opposite Verified)
- Added `margin-left: auto` for right alignment
- Removed `.store-item-name-row` wrapper (no longer needed)
- Freed full width for item title

## Rename Mapping

| Old | New |
|-----|-----|
| AddonsDrawer.tsx | QuackStoreDrawer.tsx |
| AddonsDrawer.css | QuackStoreDrawer.css |
| `.addons-*` | `.quack-store-*` |
| `.addon-item-*` | `.store-item-*` |
| `onAddonsClick` | `onStoreClick` |
| `showPluginsDrawer` | `showStoreDrawer` |
