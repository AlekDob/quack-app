---
type: guide
project: quack-app
created: 2026-04-04
tags: [whiteboard, nested-components, matryoshka, drag-assign, drag-eject]
---

# Whiteboard Nested Components (Matryoshka)

## What are Components?

Components are nestable sub-whiteboards within the Whiteboard. Think of them as folders — you can group related annotations together and double-click to enter and see only that group's contents.

## What Goes Inside Components?

Both **feature nodes** (the architecture cards from .md files) and **annotations** (post-its, groups, images) can be placed inside components.

When you create a component with feature nodes selected:
- The nodes **disappear from the main canvas**
- They're only visible when you **enter the component** (double-click)
- Deleting or dissolving the component **puts them back** on the main canvas
- Internally, node assignments are stored in `.whiteboard.json` as `nodeAssignments: { nodeId: componentId }`

## How to Create a Component

1. Switch to **Lasso** mode (toolbar) or use **Shift+click** to select 2+ elements (nodes and/or annotations)
2. A blue badge shows the selection count in the toolbar
3. Click the **Create Component** button (grid icon, appears when 2+ selected)
4. A component rect wraps the selected elements — nodes disappear from the main view
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

## Deleting vs Dissolving a Component

- **Delete** (X button on hover): removes the component rect, promotes ALL children (nodes + annotations) back to the parent level
- **Dissolve** (via agent skill): same behavior — children are promoted, component is removed
- Both are safe — children are never lost

If a component is deleted while you're inside it, `fixOrphans()` cleans up orphaned references on next load.

## Architecture Notes

- **Flat data model**: annotations use `parentComponentId` field, nodes use `nodeAssignments` record in WhiteboardFile
- **Filtering**: `filterByParent()` for annotations, `visibleNodeIds` Set for nodes — both driven by current navigation level
- **Ephemeral navigation**: `ComponentNavigation` state is NOT persisted — always starts at root on reload
- **Orphan detection**: `fixOrphans()` clears invalid `parentComponentId` refs AND orphaned `nodeAssignments` on file load
- **Links filtering**: links between hidden nodes are also hidden (Canvas filters by `visibleNodeIds`)
- See `nested-components-flow.mmd` in this directory for the full flow diagram
