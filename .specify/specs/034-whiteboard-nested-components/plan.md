# Implementation Plan: Whiteboard Nested Components

## Technology Stack

- **Frontend**: React 18 + TypeScript strict + SVG (existing stack, zero new deps)
- **State**: Zustand-like pattern via `useWhiteboardFile` hook (existing) + local React state for navigation/selection
- **Persistence**: `.whiteboard.json` file via Tauri `read_file_content`/`write_file_content` (existing)
- **Agent Bridge**: `.claude/commands/whiteboard.md` skill file update (existing)

## Architecture

### Overview

No new services, no new stores. The feature extends 3 existing layers:

```
Types (annotationTypes.ts)     — add optional fields
  ↓
Hook (useWhiteboardFile.ts)    — add filtering + CRUD methods
  ↓
Canvas (FeatureMapCanvas.tsx)  — add selection, navigation, rendering logic
  ↓
Components (CanvasGroupRect)   — add component appearance + double-click
```

### Design Principle: Filter, Don't Restructure

The data stays FLAT in `.whiteboard.json`. Nesting is achieved by FILTERING:
- Root view: show annotations where `parentComponentId === undefined`
- Inside component X: show annotations where `parentComponentId === X`

This avoids tree data structures, recursive rendering, and complex state management.

## Component Design

### 1. Type Extensions (`annotationTypes.ts`)

```typescript
// Add to PostIt interface
parentComponentId?: string;

// Add to GroupRect interface  
parentComponentId?: string;
isComponent?: boolean;

// Add to CanvasImage interface
parentComponentId?: string;

// New type (ephemeral, not persisted)
interface NavigationState {
  currentComponentId: string | null;
  breadcrumb: Array<{ id: string; label: string }>;
}

// New type (ephemeral)
type SelectionSet = Set<string>;
```

All new fields are optional — zero breaking changes to existing data.

### 2. Hook Extensions (`useWhiteboardFile.ts`)

New methods on the existing hook:

| Method | Purpose |
|--------|---------|
| `getVisibleAnnotations(componentId?)` | Filter annotations by parent. `null` = root level |
| `createComponent(childIds: string[], label: string)` | Create GroupRect with `isComponent: true`, set `parentComponentId` on children |
| `dissolveComponent(componentId: string)` | Remove component, clear `parentComponentId` on children (promote to parent) |
| `assignToComponent(annotationId: string, componentId: string)` | Set `parentComponentId` |
| `ejectFromComponent(annotationId: string)` | Clear `parentComponentId` (promote to parent's parent) |
| `fixOrphans()` | On load, clear invalid `parentComponentId` references |

### 3. Multi-Select System (`FeatureMapCanvas.tsx`)

New local state in canvas:

```typescript
const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
const [lassoRect, setLassoRect] = useState<LassoRect | null>(null);
```

Interaction flow:
- **Lasso**: mousedown on empty canvas (Select mode) → drag → draw dashed rect → mouseup → hit-test annotations → populate `selectedIds`
- **Shift+click**: toggle annotation in/out of `selectedIds`
- **Click empty**: clear selection
- **Escape**: clear selection

### 4. Navigation System (`FeatureMapView.tsx`)

New local state in view:

```typescript
const [navigation, setNavigation] = useState<NavigationState>({
  currentComponentId: null,
  breadcrumb: [],
});
```

Functions:
- `enterComponent(id, label)`: push to breadcrumb, set currentComponentId
- `exitToLevel(index)`: slice breadcrumb, set currentComponentId to target
- `exitUp()`: pop one level from breadcrumb

Navigation is SESSION-ONLY state. Not persisted. Each time you open the whiteboard, you start at root.

### 5. Canvas Rendering Changes (`FeatureMapCanvas.tsx`)

When `currentComponentId` is set:
- Filter all annotations through `getVisibleAnnotations(currentComponentId)`
- Hide feature nodes (the auto-layout layer)
- Hide layer headers
- Show only annotations belonging to current component
- Auto-fit zoom to children bounds

When at root (`currentComponentId === null`):
- Show annotations where `parentComponentId === undefined`
- Show feature nodes normally
- Components render as enhanced GroupRects (icon + badge + preview)

### 6. Breadcrumb Bar (new component)

Small horizontal bar above the canvas (inside FeatureMapView, outside SVG transform):

```
Root  >  Architecture Plan  >  Backend Services
```

- Fixed position (not affected by pan/zoom)
- Each segment is clickable
- Current level is bold/highlighted
- Max ~40px height

### 7. Component Rect Enhancements (`CanvasGroupRect.tsx`)

When `isComponent === true`:
- Show layers icon (top-left, next to label)
- Show child count badge (top-right)
- Solid border instead of dashed
- Double-click → `onEnterComponent(id, label)` callback
- Optional: mini-preview of children (P2, can defer)

### 8. Drag-Assign Visual Feedback

When dragging an annotation over a component rect:
- Component gets a glow/highlight border (CSS `filter: drop-shadow`)
- On drop: call `assignToComponent(draggedId, componentId)`

When inside a component, dragging to breadcrumb area:
- Breadcrumb bar highlights as drop target
- On drop: call `ejectFromComponent(annotationId)`

## Error Handling

| Scenario | Handling |
|----------|----------|
| Orphaned children (parent deleted externally) | `fixOrphans()` on file load — clear invalid refs |
| Nesting > 5 levels | Toolbar shows warning, blocks "Create Component" |
| Empty component entered | Show "Empty component" placeholder text |
| Component drag onto itself | No-op (ignored) |
| Circular nesting attempt | Prevented by checking ancestry chain before assign |

## Performance

- **Filtering is O(n)** where n = total annotations. Even with 1000 annotations, this is instant.
- **No recursive rendering** — flat array filter, not tree traversal.
- **Preview thumbnails** use the same SVG rendering at reduced scale (CSS transform, not re-render). Defer to P2.
- **Navigation state change** triggers a single re-render of the canvas.

## Migration

- **Version 1 format stays**: no version bump needed. New fields are all optional.
- **Load logic**: if `parentComponentId` is missing, treat as root-level (existing behavior).
- **Save logic**: only write `parentComponentId`/`isComponent` when they have values (don't pollute old data with `undefined` fields).

## Files Modified (Estimated)

| File | Changes | Lines Added |
|------|---------|-------------|
| `annotationTypes.ts` | +3 optional fields, +2 new types | ~15 |
| `useWhiteboardFile.ts` | +6 methods, orphan fix on load | ~80 |
| `FeatureMapCanvas.tsx` | Selection system, lasso, filtering, drag-assign | ~120 |
| `FeatureMapView.tsx` | Navigation state, breadcrumb, enter/exit handlers | ~60 |
| `CanvasGroupRect.tsx` | Component appearance, double-click, badge | ~40 |
| `AnnotationToolbar.tsx` | "Create Component" button | ~20 |
| `FeatureMapView.css` | Breadcrumb bar, selection highlight, lasso styles | ~40 |
| `.claude/commands/whiteboard.md` | Component operations in agent skill | ~30 |
| **Total** | | **~405** |

Note: Some existing files may need splitting if they exceed 300-line limit after changes. `FeatureMapCanvas.tsx` is already large — the selection system may need extracting to a `useCanvasSelection.ts` hook.
