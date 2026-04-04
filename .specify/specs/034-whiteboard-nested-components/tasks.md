# Implementation Tasks: Whiteboard Nested Components

## Phase 1: Data Model (Foundation)

- [x] 1.1 Extend annotation types with component fields
  - Add `parentComponentId?: string` to PostIt, GroupRect, CanvasImage interfaces
  - Add `isComponent?: boolean` to GroupRect
  - Add `NavigationState` type (ephemeral, not in WhiteboardFile)
  - Add `LassoRect` type for selection rectangle
  - **Depends on**: None
  - **Requirement**: FR-007, FR-008
  - **File**: `src/components/featureMap/annotationTypes.ts`

- [x] 1.2 Add orphan detection and filtering to useWhiteboardFile hook
  - Add `fixOrphans()` — clears invalid `parentComponentId` on load
  - Add `getVisibleAnnotations(componentId: string | null)` — filter by parent
  - Call `fixOrphans()` after file read + migration
  - **Depends on**: 1.1
  - **Requirement**: FR-014, FR-015
  - **File**: `src/hooks/useWhiteboardFile.ts`

## Phase 2: Multi-Select System

- [x] 2.1 Implement lasso selection in FeatureMapCanvas
  - Add `selectedIds: Set<string>` and `lassoRect` state
  - Mousedown on empty canvas (Select mode) starts lasso
  - Drag draws dashed rectangle overlay (SVG rect)
  - Mouseup hit-tests annotation centers against lasso bounds
  - Annotations inside lasso get added to `selectedIds`
  - **Depends on**: 1.1
  - **Requirement**: FR-001
  - **File**: `src/components/featureMap/FeatureMapCanvas.tsx`

- [x] 2.2 [P] Implement Shift+click additive selection
  - Shift+click on annotation toggles it in/out of `selectedIds`
  - Click without Shift on empty canvas clears selection
  - Escape clears selection
  - **Depends on**: 2.1
  - **Requirement**: FR-001
  - **File**: `src/components/featureMap/FeatureMapCanvas.tsx`

- [x] 2.3 [P] Add selection visual feedback
  - Selected annotations get a blue highlight border (2px solid #3b82f6)
  - Pass `isSelected` prop to CanvasPostIt, CanvasGroupRect, CanvasImage
  - **Depends on**: 2.1
  - **Requirement**: FR-001
  - **Files**: `CanvasPostIt.tsx`, `CanvasGroupRect.tsx`, `CanvasImage.tsx`

- [x] 2.4 Extract selection logic to useCanvasSelection hook (if Canvas exceeds 300 lines)
  - Move selectedIds, lassoRect, lasso handlers to dedicated hook
  - Keep Canvas clean and under 300 lines
  - **Depends on**: 2.1, 2.2, 2.3
  - **Requirement**: Code quality (300-line rule)
  - **File**: `src/hooks/useCanvasSelection.ts` (new)

## Phase 3: Component CRUD

- [x] 3.1 Add createComponent method to useWhiteboardFile
  - Creates new GroupRect with `isComponent: true` at bounding box of selected children
  - Sets `parentComponentId` on all selected annotations
  - Label defaults to "Component" (editable after creation)
  - **Depends on**: 1.2
  - **Requirement**: FR-002, FR-007
  - **File**: `src/hooks/useWhiteboardFile.ts`

- [x] 3.2 Add dissolveComponent method to useWhiteboardFile
  - Removes the component GroupRect
  - Clears `parentComponentId` on all children (promotes them to parent level)
  - **Depends on**: 3.1
  - **Requirement**: FR-013
  - **File**: `src/hooks/useWhiteboardFile.ts`

- [x] 3.3 Add "Create Component" button to AnnotationToolbar
  - Visible only when 2+ annotations are selected
  - Calls `createComponent()` with selected IDs
  - Clears selection after creation
  - **Depends on**: 2.1, 3.1
  - **Requirement**: FR-002
  - **File**: `src/components/featureMap/AnnotationToolbar.tsx`

## Phase 4: Navigation (Matryoshka)

- [x] 4.1 Add navigation state to FeatureMapView
  - Add `navigation: NavigationState` state (currentComponentId, breadcrumb)
  - Add `enterComponent(id, label)` — push to breadcrumb
  - Add `exitToLevel(index)` — slice breadcrumb to index
  - Add `exitUp()` — pop one level
  - Pass currentComponentId to Canvas for filtering
  - **Depends on**: 1.1
  - **Requirement**: FR-003, FR-004, FR-005, FR-015
  - **File**: `src/components/featureMap/FeatureMapView.tsx`

- [x] 4.2 Create WhiteboardBreadcrumb component
  - Horizontal bar above canvas (fixed position, not SVG)
  - Shows `Root > Parent > Current` with clickable segments
  - Current level is bold
  - Hidden when at root level
  - **Depends on**: 4.1
  - **Requirement**: FR-004, FR-005
  - **File**: `src/components/featureMap/WhiteboardBreadcrumb.tsx` (new)

- [x] 4.3 Implement canvas filtering based on navigation
  - When `currentComponentId !== null`: show only annotations with matching `parentComponentId`
  - When `currentComponentId !== null`: hide feature nodes and layer headers
  - When at root: show annotations with `parentComponentId === undefined`
  - Auto-fit zoom on navigation change
  - **Depends on**: 1.2, 4.1
  - **Requirement**: FR-003, FR-006, FR-016
  - **File**: `src/components/featureMap/FeatureMapCanvas.tsx`

- [x] 4.4 Add Escape/Backspace navigation handlers
  - Escape inside component: go up one level (exitUp)
  - Backspace inside component: go up one level
  - At root: Escape clears selection (existing behavior)
  - **Depends on**: 4.1
  - **Requirement**: FR-005
  - **File**: `src/components/featureMap/FeatureMapView.tsx`

## Phase 5: Component Appearance

- [x] 5.1 Enhance CanvasGroupRect for component mode
  - When `isComponent: true`: solid border (not dashed), layers icon, child count badge
  - Double-click → `onEnterComponent(id, label)` callback
  - Single click → existing edit behavior (backward compat)
  - **Depends on**: 4.1
  - **Requirement**: FR-003, FR-012
  - **File**: `src/components/featureMap/CanvasGroupRect.tsx`

- [x] 5.2 Add nesting depth check
  - Calculate depth by walking `parentComponentId` chain
  - Block "Create Component" if current depth >= 5
  - Show subtle warning in toolbar
  - **Depends on**: 3.3, 4.1
  - **Requirement**: FR-012
  - **Files**: `useWhiteboardFile.ts`, `AnnotationToolbar.tsx`

## Phase 6: Drag In/Out

- [ ] 6.1 Implement drag-assign (drop annotation onto component)
  - During annotation drag, hit-test against component rects
  - Highlight component as drop target (glow border)
  - On drop over component: call `assignToComponent()`
  - Prevent dropping component onto itself or its own children
  - **Depends on**: 3.1, 5.1
  - **Requirement**: FR-009
  - **File**: `src/components/featureMap/FeatureMapCanvas.tsx`

- [x] 6.2 [P] Add assignToComponent / ejectFromComponent to hook
  - `assignToComponent(annotationId, componentId)` — set parentComponentId
  - `ejectFromComponent(annotationId)` — clear parentComponentId (promote to component's parent)
  - **Depends on**: 1.2
  - **Requirement**: FR-009, FR-010
  - **File**: `src/hooks/useWhiteboardFile.ts`

- [ ] 6.3 Implement drag-eject (drop annotation onto breadcrumb)
  - Inside a component, dragging annotation to breadcrumb bar highlights it as drop zone
  - On drop: call `ejectFromComponent()`
  - **Depends on**: 4.2, 6.2
  - **Requirement**: FR-010
  - **Files**: `WhiteboardBreadcrumb.tsx`, `FeatureMapCanvas.tsx`

## Phase 7: Component Preview (P2)

- [ ] 7.1 Render mini-preview inside component rects
  - At parent level, component rects show a scaled SVG of their children
  - Scale factor: fit children bounds into component rect with padding
  - Reduce opacity to 50% for preview
  - Show "+N more" if too many items
  - **Depends on**: 5.1
  - **Requirement**: FR-011
  - **File**: `src/components/featureMap/CanvasGroupRect.tsx`

## Phase 8: Agent Skill Update (P3)

- [ ] 8.1 Update /whiteboard skill with component operations
  - Add `create-component --around [id1, id2] --label "Name"` action
  - Add `--inside component-id` flag to `add-postit` and existing actions
  - Add `list --inside component-id` to show component children
  - Update JSON schema examples in skill file
  - **Depends on**: 3.1, 6.2
  - **Requirement**: FR-017
  - **File**: `.claude/commands/whiteboard.md`

## Phase 9: Styles + Polish

- [x] 9.1 Add CSS for breadcrumb, selection, lasso, component
  - Breadcrumb bar: glass-morphism, fixed top position
  - Lasso: dashed blue border, semi-transparent fill
  - Selection highlight: blue glow on selected annotations
  - Component drop target: orange glow when dragging over
  - **Depends on**: 2.3, 4.2, 6.1
  - **Requirement**: All visual
  - **File**: `src/components/featureMap/FeatureMapView.css`

## Notes

- `[P]` indicates tasks that can be parallelized with siblings
- Phase 1-4 are MVP (P1 stories). Phase 5-6 are P1/P2. Phase 7-8 are P2/P3.
- `FeatureMapCanvas.tsx` is the highest-risk file — extraction to hooks (2.4) is critical to stay under 300 lines
- Navigation state is NEVER persisted — this is intentional (avoids stale state bugs)
- All new type fields are optional — zero migration needed
