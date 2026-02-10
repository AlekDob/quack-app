---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Documentation Center

## Centro Documentazione In-App

Quack include un **docs viewer integrato** per consultare guide e documentazione senza uscire dall'app.

## Sistema Dual-Source

Caricamento intelligente con fallback:

**In Development** (localhost/tauri):
1. Prova filesystem locale
2. Fallback a GitHub raw content
3. Errore se entrambi falliscono

**In Production**:
1. Prova GitHub raw content
2. Fallback a docs bundled
3. Errore se entrambi falliscono

## Struttura Guide

```
guide/
├── 01-getting-started/
│   ├── introduction.md
│   └── _meta.json
├── 02-features/
│   └── ...
└── _meta.json (root)
```

## Funzionalita

- Gerarchia docs da `_meta.json`
- Sidebar navigazione con sezioni collapsabili
- Estrazione automatica titolo da heading #
- Integrazione tab per viewing in-app
- Navigazione Previous/Next
- Table of Contents generato
- Indicatore sorgente (GitHub vs Local)
- Cache session-based

## GitHub Integration

- Base URL: `https://raw.githubusercontent.com/AlekDob/quack-docs/main`
- Repository separato per documentazione

## File Principali

| File | Ruolo |
|------|-------|
| `DocsViewer.tsx` | Container principale (299 righe) |
| `DocsSidebar.tsx` | Navigazione laterale |
| `DocsContent.tsx` | Renderer markdown |
| `DocsComponents.tsx` | Componenti custom (Callout, Tabs, Steps) |
