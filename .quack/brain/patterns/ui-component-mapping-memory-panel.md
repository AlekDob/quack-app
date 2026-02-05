---
type: pattern
project: quack-app
created: 2026-01-11
migrated: true
---

# ui-component-mapping-memory-panel

[2026-01-11] MAPPATURA UI → COMPONENTI per sezione Memory/Brain:

- **Pannello laterale destro 'Memory'** (con stats, search, filters, lista) → `src/components/memory/MemoryPanel.tsx`

- **Tab 'Memory' full-screen** (Knowledge Graph con nodi) → `src/views/MemoryGraphTabView.tsx`

- **Tab 'Second Brain' full-screen** (Outliner editor) → `src/views/SecondBrainTabView.tsx`

- **Settings → Second Brain** → `src/components/settings/categories/SecondBrainSettings.tsx`

GOTCHA: Il pannello laterale NON è un tab view! È `MemoryPanel.tsx` importato in `SidePanel.tsx`

GOTCHA: Ci sono 3 componenti diversi che mostrano 'Memory' - controllare sempre quale è visibile nello screenshot

[2026-01-11] REFACTOR COMPLETATO: Solo `MemoryPanel.tsx` modificato. SecondBrainTabView e MemoryGraphTabView ripristinati allo stato originale.

[2026-01-11] REFACTOR COMPLETATO: Solo `MemoryPanel.tsx` modificato. SecondBrainTabView e MemoryGraphTabView ripristinati allo stato originale.
