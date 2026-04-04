# Feature Specification: Whiteboard Nested Components

**Feature Branch**: `034-whiteboard-nested-components`  
**Created**: 2026-04-04  
**Status**: Draft  
**Input**: User description: "Heptabase-style nested components — select multiple elements, group into a component, double-click to enter a clean whiteboard with those elements. Matryoshka navigation (back/forward levels)."

## User Scenarios & Testing

### User Story 1 - Multi-Select Annotations (Priority: P1)

User lasso-selects or Shift+clicks multiple annotations (post-its, images, group rects) on the canvas to build a selection set. Selected elements get a visual highlight. This is the prerequisite for all component operations.

**Why this priority**: Without multi-select, you can't create components. Every subsequent story depends on this.

**Independent Test**: Draw 3 post-its, lasso-select 2 of them, verify both have selection highlight. Shift+click to add/remove from selection.

**Acceptance Scenarios**:

1. **Given** canvas with 3+ annotations, **When** user click-drags a lasso rectangle, **Then** all annotations whose center falls inside the lasso get selected (blue highlight border)
2. **Given** 2 selected annotations, **When** user Shift+clicks a third, **Then** it gets added to selection
3. **Given** 3 selected annotations, **When** user Shift+clicks one already selected, **Then** it gets deselected
4. **Given** selection active, **When** user clicks empty canvas (no Shift), **Then** selection clears
5. **Given** selection active, **When** user presses Escape, **Then** selection clears and mode resets to Select

---

### User Story 2 - Create Component from Selection (Priority: P1)

User selects 2+ annotations, right-clicks or uses toolbar to "Create Component". A new GroupRect-like element replaces the selection in the parent view, containing references to the selected children.

**Why this priority**: This is the core value prop — turning loose annotations into a navigable nested structure.

**Independent Test**: Select 3 post-its, click "Create Component" in toolbar, verify a component rect appears and the 3 post-its disappear from the root view.

**Acceptance Scenarios**:

1. **Given** 2+ annotations selected, **When** user clicks "Create Component" in toolbar, **Then** a new component appears at the bounding box of the selected elements
2. **Given** component created, **When** viewing root level, **Then** the component shows a layers icon, label "Component", and child count badge
3. **Given** component created, **When** inspecting `.whiteboard.json`, **Then** child annotations have `parentComponentId` set to the component's ID
4. **Given** fewer than 2 annotations selected, **When** user clicks "Create Component", **Then** button is disabled/grayed out

---

### User Story 3 - Enter/Exit Component (Matryoshka Navigation) (Priority: P1)

User double-clicks a component to "enter" it — the canvas transitions to show only that component's children in a clean whiteboard. A breadcrumb trail at the top shows the navigation path. User clicks breadcrumb or presses Escape/Backspace to go back up.

**Why this priority**: This is the core UX differentiator — the matryoshka experience.

**Independent Test**: Create a component with 3 post-its, double-click it, verify only those 3 post-its are visible. Click breadcrumb "Root" to go back, verify component rect is visible again.

**Acceptance Scenarios**:

1. **Given** a component exists at root level, **When** user double-clicks it, **Then** canvas transitions to show only the component's children, breadcrumb shows `Root > Component Label`
2. **Given** user is inside a component, **When** user clicks "Root" in breadcrumb, **Then** canvas returns to root level showing all top-level elements
3. **Given** user is inside a nested component (level 2), **When** user clicks parent name in breadcrumb, **Then** canvas shows the parent component's children
4. **Given** user is inside a component, **When** user presses Escape or Backspace, **Then** navigates up one level
5. **Given** user enters a component, **When** canvas renders, **Then** auto-fit zoom adjusts to show all children within viewport
6. **Given** user is inside a component, **When** feature nodes (auto-layout layer) render, **Then** feature nodes are NOT shown (component view shows only annotations)

---

### User Story 4 - Drag Elements In/Out of Components (Priority: P2)

User can drag an annotation from the parent level onto a component to add it as a child. Inside a component, user can drag an element to the breadcrumb area to "eject" it to the parent level.

**Why this priority**: Enables iterative organization without destroy+recreate. Nice to have but not essential for MVP.

**Independent Test**: Drag a post-it onto a component at root level, double-click the component, verify the post-it is now inside.

**Acceptance Scenarios**:

1. **Given** a post-it and a component at root level, **When** user drags the post-it over the component, **Then** component highlights as drop target (glow border)
2. **Given** post-it dragged over component, **When** user releases mouse, **Then** post-it disappears from root, gets `parentComponentId` set, appears inside component
3. **Given** user is inside a component with 3 post-its, **When** user drags a post-it to the breadcrumb bar, **Then** post-it gets ejected to parent level (`parentComponentId` cleared)
4. **Given** a component with only 1 child, **When** user ejects that child, **Then** component becomes empty (valid state, shows "Empty" label)

---

### User Story 5 - Component Thumbnail Preview (Priority: P2)

When viewing the parent level, components show a scaled-down mini-preview of their contents instead of just an icon. This gives immediate visual context without entering.

**Why this priority**: Improves information density and discoverability. Polish feature.

**Independent Test**: Create a component with colored post-its, verify the component rect at parent level shows a small preview of those post-its.

**Acceptance Scenarios**:

1. **Given** a component with 3 post-its (different colors), **When** viewing parent level, **Then** component rect shows a scaled miniature of the post-its inside (fit-to-content, ~50% opacity)
2. **Given** a component with many children (>10), **When** viewing parent level, **Then** preview shows first N items and a "+X more" indicator
3. **Given** a component with images, **When** viewing parent level, **Then** images appear as small thumbnails in the preview

---

### User Story 6 - Agent Skill Support (Priority: P3)

The `/whiteboard` agent skill supports component operations: creating components, adding elements inside, entering/listing component contents.

**Why this priority**: Extends the agent bridge for AI-driven organization. Lower priority than manual UX.

**Independent Test**: Run agent command `add-postit --inside component-id "Note text"`, verify post-it appears inside the component in UI.

**Acceptance Scenarios**:

1. **Given** agent writes `.whiteboard.json` with `parentComponentId` on a post-it, **When** UI polls (2s), **Then** post-it appears inside the correct component
2. **Given** agent skill `create-component --around [id1, id2]`, **When** executed, **Then** new component created wrapping those elements
3. **Given** agent skill `list --inside component-id`, **When** executed, **Then** shows only children of that component

---

### Edge Cases

- What happens when a component is deleted? All children get promoted to the parent level (`parentComponentId` cleared), not deleted.
- What happens when user drags a component inside another component? It becomes a sub-component (nesting level increases). Max nesting: 5 levels (arbitrary limit, prevents infinite depth confusion).
- What happens to `.whiteboard.json` backward compatibility? Old files without `parentComponentId` or `isComponent` load fine — all new fields are optional with sensible defaults.
- What happens when an element's `parentComponentId` references a deleted component? Orphan detection on load — clear invalid `parentComponentId`, promote to root.
- What happens during multi-user editing (agent + human)? The 2s polling with write-lock pattern already handles this. Component navigation state is NOT persisted (it's view-only state per session).

## Requirements

### Functional Requirements

- **FR-001**: System MUST support lasso selection (click-drag rectangle) and Shift+click additive selection on annotations
- **FR-002**: System MUST allow creating a component from 2+ selected annotations via toolbar button
- **FR-003**: System MUST support double-click on component to enter it, showing only its children
- **FR-004**: System MUST render a clickable breadcrumb trail showing navigation path (Root > Parent > Current)
- **FR-005**: System MUST support navigating back via breadcrumb click, Escape key, or Backspace key
- **FR-006**: System MUST auto-fit zoom when entering a component
- **FR-007**: System MUST persist component relationships in `.whiteboard.json` via `parentComponentId` field
- **FR-008**: System MUST maintain backward compatibility — old `.whiteboard.json` files load without errors
- **FR-009**: System MUST support drag-assign (drag annotation onto component to add as child)
- **FR-010**: System MUST support drag-eject (drag annotation to breadcrumb to remove from component)
- **FR-011**: System MUST show component preview thumbnail at parent level
- **FR-012**: System MUST support nested components (component inside component) up to 5 levels
- **FR-013**: System MUST promote children to parent on component deletion (not cascade-delete)
- **FR-014**: System MUST detect and fix orphaned children (invalid `parentComponentId`) on load
- **FR-015**: Navigation state (current component, breadcrumb) MUST NOT be persisted — it's session-only view state
- **FR-016**: Feature nodes (auto-layout layer) MUST remain at root level only — not assignable to components
- **FR-017**: Agent skill `/whiteboard` MUST support `create-component`, `add-postit --inside`, `list --inside` operations

### Key Entities

- **Component**: A GroupRect with `isComponent: true`. Has a label, position, size. Its children are annotations with matching `parentComponentId`.
- **NavigationState**: `{ currentComponentId: string | null, breadcrumb: Array<{id: string, label: string}> }` — ephemeral, per-session.
- **Selection Set**: `Set<string>` of annotation IDs currently selected — ephemeral, per-interaction.

## Success Criteria

### Measurable Outcomes

- **SC-001**: User can create a component from selected annotations in under 3 seconds (select + click button)
- **SC-002**: Component enter/exit navigation completes in under 200ms (no loading spinner needed)
- **SC-003**: Nested navigation up to 5 levels works without performance degradation
- **SC-004**: Existing `.whiteboard.json` files load without errors or data loss after upgrade
- **SC-005**: Agent skill can create and populate components programmatically, visible in UI within 2s polling cycle
