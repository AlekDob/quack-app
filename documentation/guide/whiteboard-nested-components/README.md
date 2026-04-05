---
type: guide
project: quack-app
created: 2026-04-04
tags: [whiteboard, nested-components, matryoshka, drag-assign, drag-eject]
---

# Whiteboard Nested Components (Matryoshka)

## What are Components?

Components are nestable sub-whiteboards within the Whiteboard. Think of them as folders — you can group related annotations together and double-click to enter and see only that group's contents.

## How to Create a Component

1. Switch to **Lasso** mode (toolbar) or use **Shift+click** to select 2+ annotations
2. A blue badge shows the selection count in the toolbar
3. Click the **Create Component** button (grid icon, appears when 2+ selected)
4. A component rect wraps the selected annotations
5. Click the component label to rename it

## Navigating Components

- **Enter**: Double-click a component rect to enter it (see its children)
- **Exit**: Press **Escape** or **Backspace** to go up one level
- **Jump**: Click any breadcrumb segment (Root > Parent > Current) to jump to that level
- **Root**: Click "Root" in breadcrumb to return to top level

When inside a component:
- Only that component's children are visible
- Feature nodes and layer headers are hidden
- The breadcrumb bar appears above the canvas

## Component Appearance

At the parent level, components look different from regular groups:
- **Solid border** (not dashed)
- **Layers icon** (stacked rectangles, top-left)
- **Child count badge** (top-right)
- **Mini-preview**: scaled thumbnails of children rendered inside the rect (45% opacity)

## Drag-Assign (Drop onto Component)

Drag any annotation onto a component rect to add it as a child:

1. Start dragging an annotation (post-it, group, image)
2. Hover over a component rect — it highlights with an **amber glow**
3. Release to assign the annotation to that component
4. The annotation disappears from the current view (now a child of the component)

Safety: you cannot drop a component onto itself or any of its own descendants (prevents circular nesting).

## Drag-Eject (Remove from Component)

When inside a component, drag an annotation to the top of the canvas to eject it:

1. Start dragging an annotation inside a component
2. Move it toward the **top edge** of the canvas (top 40px)
3. An **orange eject zone** appears with an arrow icon
4. Release to promote the annotation to the parent level

## Nesting Limits

- Maximum nesting depth: **5 levels**
- When at max depth, the Create Component button is disabled with a tooltip warning
- The toolbar shows a dimmed button when the limit is reached

## Agent / Skill Integration

The `/whiteboard` command supports component operations:

```
# Create component from existing annotations
create-component --around [id1, id2] --label "Auth Module"

# Add annotation inside a component
add-postit --text "Login flow" --x 100 --y 200 --inside component-id

# List component children
list --inside component-id

# Dissolve a component (promote children)
dissolve-component --id component-id
```

Changes appear in the UI within 2 seconds (polling).

## Architecture Notes

- **Flat data model**: annotations have optional `parentComponentId` field, not a tree structure
- **Filtering**: `filterByParent()` shows only annotations matching the current navigation level
- **Ephemeral navigation**: `ComponentNavigation` state is NOT persisted — always starts at root on reload
- **Orphan detection**: `fixOrphans()` clears invalid `parentComponentId` refs on file load
- See `documentation/guide/whiteboard-nested-components/nested-components-flow.mmd` for the flow diagram
