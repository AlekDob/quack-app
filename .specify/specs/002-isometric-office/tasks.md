# Implementation Tasks: Isometric Office View

## Phase 1: Tab System Wiring

- [x] 1.1 Install pixi.js@^8 and @pixi/react
  - **Depends on**: None
  - **Requirement**: FR-008

- [x] 1.2 Create useOfficeTab.ts hook (singleton pattern)
  - **Depends on**: None
  - **Requirement**: FR-008

- [x] 1.3 [P] Add 'office' to Tab.type union in TabBar.tsx + icon
  - **Depends on**: None
  - **Requirement**: FR-008

- [x] 1.4 Create OfficeTabView.tsx wrapper
  - **Depends on**: 1.2
  - **Requirement**: FR-008

- [x] 1.5 Wire into App.tsx (import, hook, handler, render, sidebar collapse)
  - **Depends on**: 1.2, 1.3, 1.4
  - **Requirement**: FR-008

- [x] 1.6 [P] Add Office button to ActionIcons.tsx
  - **Depends on**: 1.5
  - **Requirement**: FR-008

## Phase 2: PixiJS Scene Core

- [x] 2.1 Create officeLayout.ts (gridToIso, computeRoomPositions)
  - **Depends on**: None
  - **Requirement**: FR-001

- [x] 2.2 Create officeTypes.ts (TooltipData, ActionMenuData)
  - **Depends on**: None
  - **Requirement**: FR-005, FR-007

- [x] 2.3 Create OfficeView.tsx (Application + viewport zoom/pan)
  - **Depends on**: 2.1, 2.2
  - **Requirement**: FR-001, FR-004

- [x] 2.4 Create OfficeScene.tsx (root pixi container)
  - **Depends on**: 2.1
  - **Requirement**: FR-001

- [x] 2.5 Create OfficeRoom.tsx (isometric floor + walls + desk + label)
  - **Depends on**: 2.1, 2.4
  - **Requirement**: FR-001

- [x] 2.6 Create OfficeDuck.tsx (animated agent with status bobbing)
  - **Depends on**: 2.5
  - **Requirement**: FR-002, FR-003

## Phase 3: Interactivity

- [x] 3.1 Create OfficeTooltip.tsx (HTML overlay on duck hover)
  - **Depends on**: 2.3
  - **Requirement**: FR-005

- [x] 3.2 Create OfficeActionMenu.tsx (click menu on duck)
  - **Depends on**: 2.3
  - **Requirement**: FR-007

- [x] 3.3 Create OfficeView.css (all styles)
  - **Depends on**: 2.3, 3.1, 3.2
  - **Requirement**: All

- [x] 3.4 Wire onRoomClick → navigate to project
  - **Depends on**: 1.5, 2.5
  - **Requirement**: FR-006

- [x] 3.5 Wire onDuckClick → action menu → navigate to chat
  - **Depends on**: 1.5, 3.2
  - **Requirement**: FR-007

## Phase 4: Verification

- [x] 4.1 TypeScript check (tsc --noEmit)
  - **Depends on**: All above
  - **Requirement**: SC-001

- [x] 4.2 Vite build
  - **Depends on**: All above
  - **Requirement**: SC-001

## Phase 5: Documentation

- [x] 5.1 Create spec-kit artifacts (spec.md, plan.md, tasks.md)
  - **Depends on**: All above

- [x] 5.2 Write diary entry
  - **Depends on**: 5.1
