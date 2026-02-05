---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Obsidian Integration

## Integrazione Obsidian Vault

Quack si integra nativamente con **Obsidian** per il knowledge management. La sezione 'Obsidian Vault' nella sidebar sinistra mostra il vault collegato.

## Sync Bidirezionale

Le modifiche fluiscono in entrambe le direzioni:

```
Quack Second Brain <---> SQLite DB <---> Obsidian Vault
        │                                      │
        └──────── File Watcher ────────────────┘
```

- **Quack → Obsidian**: Crei entity nel Brain, appare come .md nel vault
- **Obsidian → Quack**: Modifichi .md in Obsidian, si aggiorna nel Brain

## Struttura Vault: QuackBrain/

Il sync crea una cartella `QuackBrain/` nel vault:

```
QuackBrain/
├── diary/                    # Note giornaliere
│   └── 2026-01-08.md
├── global/                   # Note globali
│   ├── patterns/
│   ├── humans/
│   └── glossary.md
└── projects/                 # Note per progetto
    └── quack-app/
        ├── components/
        ├── patterns/
        ├── bugs/
        └── *.canvas
```

## Canvas Support

Quack puo creare e modificare **Obsidian Canvas** (.canvas):
- Diagrammi architetturali
- Mind maps
- Task boards visuali
- GIF e immagini embedded

## Daily Diary

Ogni nota temporale (bug fix, task, decision) viene linkata al diario del giorno via `[[YYYY-MM-DD]]`. Questo crea un log automatico delle attivita.

## File Principali

| File | Ruolo |
|------|-------|
| `obsidianSyncService.ts` | Sync bidirezionale (19K LOC) |
| `brain/watcher.rs` | File watcher Rust |
| `SecondBrainTabView.tsx` | UI outliner |
| `MemoryGraphTabView.tsx` | Graph visualization |
