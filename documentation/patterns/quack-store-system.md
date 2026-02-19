---
type: pattern
created: 2026-02-08
tags: [quack-store, marketplace, ui, drawer, apple-design, avatars, markdown]
---

# Quack Store System (formerly Addons)

## Overview

The **Quack Store** is a full-width drawer UI (85vw) for browsing, installing, and managing Claude Agent SDK resources. Redesigned with Apple App Store-style layout: sidebar navigation (200px) + main content area with hero banner + grid cards.

## Key Files

| File | Purpose |
|------|---------|
| `QuackStoreDrawer.tsx` | Main orchestrator (sidebar + main content) |
| `QuackStoreDrawer.css` | All store styles |
| `store/StoreSidebar.tsx` | 200px sidebar: search + nav |
| `store/StoreMainContent.tsx` | Scrollable main area: hero + grid |
| `store/StoreHeroBanner.tsx` | Full-width featured banner |
| `store/StoreFeaturedCard.tsx` | Featured grid cards |
| `store/StoreItemCard.tsx` | Regular grid item cards |
| `store/StoreIcons.tsx` | Category icons + duck avatar helpers |
| `MarketplaceInstallModal.tsx` | Detail modal with markdown rendering |
| `useMarketplace.ts` | Data hook + install/uninstall |

## UI Architecture

- **Width**: `clamp(900px, 85vw, 1600px)`
- **Sidebar** (200px fixed): "Quack Store" title, search input, vertical nav (Discover + 7 categories)
- **Main content** (flex 1): page title, hero banner (180px), featured grid, item grid

## Categories

Discover, Skills, Agents, Droids, Rules, MCP, Hooks, Snippets

## Duck Avatars for Agent Bundles

Agent-bundles show duck avatars instead of generic category icons. Resolved from `public/images/ducks/new-avatars/` via `getAvatarUrl()`.

## Markdown Rendering in Detail Modal

Detail modal renders `longDescription` as rich markdown using `MarkdownText` component.

## Item Card Descriptions (2026-02-19)

Store item cards now show a **description subtitle** (2-line clamp) parsed from the resource's YAML frontmatter `description:` field. A "More info" pill opens the `MarketplaceInstallModal` detail overlay.

- **StoreItemCard**: description shown if > 5 chars and not generic. "More info" span in signals row.
- **AgentSelector**: marketplace template cards also show description (2-line clamp, 10px) + "More info" pill that opens `MarketplaceInstallModal` inline (no drawer needed).
- **Regex gotcha**: See `documentation/bugs/bug-marketplace-description-lazy-regex.md` — lazy `.+?` in frontmatter parsing captured only 1 char.

## Category Grouping in Discover View (2026-02-19)

When the "Discover" tab is active with no search query, items are grouped by category with section headers:

- `GroupedItems` component in `StoreMainContent.tsx`
- `CATEGORY_GROUP_ORDER` constant defines display order: Skills > Agents > Droids > Rules > Commands > MCP Servers > Hooks
- Each group has: icon + label + count header, divider line between groups
- CSS classes: `.store-grouped-items`, `.store-category-group`, `.store-category-header`, `.store-category-divider`
- When searching or filtering by specific tab, falls back to flat sorted list.

## "More info" → Detail Modal (2026-02-19)

"More info" on store cards and AgentSelector marketplace cards opens `MarketplaceInstallModal` as an overlay:
- **StoreItemCard**: click on card opens detail (existing behavior), "More info" is an additional visual cue
- **AgentSelector**: `detailResource` state + inline `<MarketplaceInstallModal>` render — works standalone without the store drawer

## CSS Naming Convention

`.quack-store-*` (drawer-level), `.store-sidebar-*`, `.store-hero-*`, `.store-featured-*`, `.store-item-*`, `.store-detail-*`
