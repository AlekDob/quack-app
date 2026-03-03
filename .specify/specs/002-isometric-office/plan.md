# Implementation Plan: Isometric Office View

**Branch**: `002-isometric-office` | **Date**: 2026-03-03 | **Spec**: `spec.md`

## Summary

Vista isometrica dell'ufficio Quack dove ogni progetto e' una stanza e ogni agente e' un duck animato. Rendering via PixiJS 8 + @pixi/react con interattivita' completa (zoom/pan/tooltip/click).

## Technical Context

**Language/Version**: TypeScript 5.x strict
**Primary Dependencies**: pixi.js@^8, @pixi/react, React 19
**Storage**: N/A (derivazione real-time da terminali esistenti)
**Testing**: `tsc --noEmit` + `vite build`
**Target Platform**: Tauri v2 (macOS/Windows desktop)
**Performance Goals**: 60fps con <=20 agenti, <500ms apertura
**Constraints**: Files <300 righe, funzioni <20 righe

## Constitution Check

- [x] AI-First Architecture (visualizza agenti AI)
- [x] Tauri + React (componenti React + PixiJS)
- [x] Domain-Driven (tutto in `src/components/office/`)
- [x] Code Quality (TypeScript strict, file <300 righe)
- [x] Simplicity (zero nuovi store, MVP con Graphics programmatiche)

## Project Structure

```text
src/
  hooks/
    useOfficeTab.ts              # Singleton tab hook
  views/
    OfficeTabView.tsx            # Memo'd wrapper
  components/
    office/
      officeTypes.ts             # Shared type definitions
      officeLayout.ts            # Pure functions: grid, positions
      OfficeView.tsx             # Main container + viewport
      OfficeScene.tsx            # Isometric scene root
      OfficeRoom.tsx             # Room: floor + walls + desk
      OfficeDuck.tsx             # Animated duck agent
      OfficeTooltip.tsx          # HTML overlay tooltip
      OfficeActionMenu.tsx       # Click action menu
      OfficeView.css             # All styles
```

## Data Flow

```
useTerminalStore.terminals → App.tsx → OfficeTabView (prop)
  → OfficeView → computeRoomPositions(terminals)
    → OfficeScene → OfficeRoom[] → OfficeDuck[]
```

Zero nuovi store. Viewport state locale con useState.
