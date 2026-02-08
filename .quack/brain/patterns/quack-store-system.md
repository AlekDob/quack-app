---
type: pattern
project: quack-app
created: 2026-02-08
tags: [quack-store, marketplace, ui, drawer]
---

# Quack Store System (formerly Addons)

## Overview

The **Quack Store** is a drawer-based UI for browsing, installing, and managing Claude Agent SDK resources (skills, agents, droids, rules, hooks, MCP servers, snippets). Renamed from "Addons" to "Quack Store" on 2026-02-08.

## Key Files

| File | Purpose |
|------|---------|
| `src/components/QuackStoreDrawer.tsx` | Main drawer component |
| `src/components/QuackStoreDrawer.css` | Drawer styles (`.quack-store-*`, `.store-item-*`) |
| `src/components/MarketplaceInstallModal.tsx` | Detail modal for install/uninstall (uses `.store-detail-*` classes) |
| `src/hooks/useMarketplace.ts` | Data hook: loading, filtering, install/uninstall logic |
| `src/types.ts` | Types: MarketplaceResource, MarketplaceCategory, MarketplaceLibrary |

## UI Architecture

- **Trigger**: Action bar icon (layers/stack SVG) with tooltip "Quack Store"
- **Drawer**: Slides from right using `.git-drawer` + `.quack-store-drawer-panel` classes
- **State**: `showStoreDrawer` / `setShowStoreDrawer` in App.tsx
- **Props**: `onStoreClick` / `isStoreOpen` on ActionIcons component

## Category Tabs

8 tabs: All, Skills, Agents, Droids, Rules, MCP, Hooks, Snippets

## Color Gradients by Category

- **Skills**: Orange (#f28c52 → #e67339)
- **Agents**: Orange/Yellow (#f28c52 → #fbbf24)
- **Droids**: Teal (#4ecdc4 → #26a69a)
- **Rules**: Blue (#60a5fa → #3b82f6)
- **Hooks**: Purple (#a78bfa → #8b5cf6)
- **MCP**: Green (#34d399 → #10b981)
- **Commands/Snippets**: Pink (#f472b6 → #ec4899)

## CSS Naming Convention

- Drawer-level: `.quack-store-*` (header, tabs, content, sections)
- Item-level: `.store-item-*` (row, icon, name, description, action)
- Detail modal: `.store-detail-*` (overlay, panel, header, tags, actions)
- Scope buttons: `.store-scope-btn`

## Rename History

| Old Name | New Name |
|----------|----------|
| AddonsDrawer | QuackStoreDrawer |
| AddonsDrawer.css | QuackStoreDrawer.css |
| `.addons-*` classes | `.quack-store-*` classes |
| `.addon-*` classes | `.store-item-*` / `.store-detail-*` classes |
| `onAddonsClick` / `isAddonsOpen` | `onStoreClick` / `isStoreOpen` |
| `onPluginsClick` | removed (was duplicate) |
| `showPluginsDrawer` | `showStoreDrawer` |
