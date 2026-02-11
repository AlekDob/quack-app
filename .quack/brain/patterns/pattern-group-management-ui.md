---
type: pattern
project: quack-app
created: 2026-02-11
tags: [ui, groups, context-menu, hover, sidebar]
---

# Pattern: Group Management UI with Hover Actions and Context Menu

## Problem
Gli utenti avevano bisogno di un modo per gestire i gruppi di progetti nella sidebar: rimuovere singoli progetti dal gruppo o eliminare (disband) l'intero gruppo. Il gruppo doveva offrire azioni veloci senza clutterare l'interfaccia.

## Solution
Implementato un pattern dual-interaction per la gestione gruppi:

### 1. Hover Icon (Quick Action)
- Icona `X` (disband) appare in hover sull'header del gruppo
- Fade-in smooth (opacity 0 → 1, transition 0.15s)
- CSS: `.sidebar-group-header:hover .group-header-actions`
- Elimina l'intero gruppo con un click

### 2. Right-Click Context Menu
Menu contestuale con lista completa di azioni:

```
┌─────────────────────────┐
│  QUACK                  │  ← nome gruppo (label)
├─────────────────────────┤
│  ↗ Remove quack-app     │  ← per ogni progetto
│  ↗ Remove quackagency.. │
├─────────────────────────┤
│  🗑 Disband group       │  ← rosso, elimina gruppo
└─────────────────────────┘
```

## Implementation Details

### 1. State Management
```typescript
// TerminalSidebar.tsx
const [groupContextMenu, setGroupContextMenu] = useState<{
  position: { x: number; y: number };
  groupId: string;
  groupName: string;
} | null>(null);
```

### 2. Group Header Hover Icons
```tsx
<div className="sidebar-group-header" onContextMenu={(e) => handleGroupContextMenu(e, grp.id, grp.name)}>
  {/* ... group header content ... */}

  <span className="group-header-actions" style={{ opacity: 0 }}>
    <button onClick={(e) => { e.stopPropagation(); handleDisbandGroup(grp.id); }}>
      <svg>{/* X icon */}</svg>
    </button>
  </span>
</div>
```

### 3. CSS Hover Behavior
```css
/* MetroStyle.css */
.sidebar-group-header:hover .group-header-actions {
  opacity: 1 !important;
}

.sidebar-group-header:hover {
  background: rgba(255, 255, 255, 0.06) !important;
}

.group-header-actions button:hover {
  background: rgba(255, 255, 255, 0.12) !important;
}

.group-header-actions button:hover svg {
  stroke: rgba(255, 107, 53, 0.9) !important; /* Orange highlight */
}
```

### 4. Context Menu Actions

#### Remove Project from Group
```typescript
const handleRemoveFromGroup = useCallback(async (groupId: string, projectPath: string) => {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return;

  const remaining = group.projects.filter((p) => p.path !== projectPath);

  if (remaining.length < 2) {
    // Less than 2 projects — disband the group entirely
    await handleDisbandGroup(groupId);
  } else {
    await updateGroup(groupId, { projects: remaining });
  }
}, [groups, handleDisbandGroup, updateGroup]);
```

#### Disband Group
```typescript
const handleDisbandGroup = useCallback(async (groupId: string) => {
  await deleteGroup(groupId); // Calls backend + cleans CLAUDE.md
  setGroupContextMenu(null);
}, [deleteGroup]);
```

## Backend Lifecycle

Quando un gruppo viene eliminato (`delete_group`), il backend:
1. Legge `group.json` per ottenere la lista progetti
2. Rimuove la sezione `<!-- QUACK_GROUP_CONTEXT -->` dal CLAUDE.md di ogni progetto
3. Elimina la cartella `~/.quack/groups/{id}/`

```rust
// groups.rs
pub fn delete_group(group_id: String) -> Result<(), String> {
  // Read group data before deleting
  if let Ok(group) = serde_json::from_str::<ProjectGroup>(&content) {
    for project in &group.projects {
      remove_group_context_from_project(&project.path)?;
    }
  }

  fs::remove_dir_all(&group_dir)?;
  Ok(())
}
```

## UI/UX Details

### Context Menu Style
- Background: `rgba(30, 30, 30, 0.95)` con backdrop blur 12px
- Border: `1px solid rgba(255, 255, 255, 0.12)`
- Border radius: 8px
- Box shadow: `0 8px 32px rgba(0, 0, 0, 0.5)`
- Click fuori chiude il menu

### Button Hover States
- Normal: background none
- Hover: background `rgba(255, 255, 255, 0.08)`
- Disband button: colore rosso `#E74C3C`, hover background `rgba(231, 76, 60, 0.12)`

### Icone
- Remove project: icona "arrow out" (exit/unlink)
- Disband group: icona "trash" (delete)

## Key Learnings

1. **Dual-interaction pattern**: hover icon per azioni veloci (disband diretto) + context menu per azioni complesse (remove singolo progetto). Bilanciamento tra accessibilità e complessità.

2. **Auto-disband quando <2 progetti**: Se rimuovi un progetto e restano <2 membri, il gruppo viene automaticamente eliminato (un gruppo richiede almeno 2 progetti).

3. **Stopppropagation critico**: Il click sull'icona hover deve fare `e.stopPropagation()` per non far collassare il gruppo quando clicchi disband.

4. **Context menu fullscreen backdrop**: Il backdrop fullscreen con `zIndex: 9999` garantisce che il click fuori chiuda il menu indipendentemente da dove clicchi.

## Files Modified

- `src/components/TerminalSidebar.tsx` — state, handlers, group header, context menu render
- `src/components/MetroStyle.css` — hover styles per group actions
- `src/stores/groupStore.ts` — import `deleteGroup` e `updateGroup`
- `src-tauri/src/groups.rs` — backend cleanup già implementato (delete_group)

## Pattern Reusability

Questo pattern è riutilizzabile per altri elementi collapsibili che richiedono:
- Azioni quick access in hover
- Menu contestuale per azioni più complesse
- Gestione di relazioni parent-child con rimozione selettiva

Esempio: potrebbe essere applicato ai Team nella sidebar, con azioni come "Remove member" e "Disband team".
