---
type: component
project: quack-app
created: 2026-01-08
migrated: true
deprecated: true
superseded_by: quack-store-system.md
---

# Marketplace and Plugin System

**⚠️ DEPRECATED**: This document is outdated. The Addons system was renamed to **Quack Store** and completely redesigned with Apple App Store-style layout on 2026-02-08. See `quack-store-system.md` for current documentation.

## Marketplace e Sistema Plugin

Quack ha un **marketplace integrato** per scoprire e installare estensioni: agenti, comandi, skill, MCP servers, e altro.

## Tipi di Risorse

| Tipo | Icona | Colore | Descrizione |
|------|-------|--------|-------------|
| agents | Duck | Orange | Agenti AI con personalita |
| commands | Cmd | Blue | Slash commands |
| hooks | Hook | Purple | Hook di automazione |
| settings | Gear | Gray | Preset configurazione |
| mcp | Plug | Green | MCP servers |
| stacks | Books | Amber | Stack completi |
| skills | Star | Pink | Skill specializzate |

## Funzionalita Marketplace

- Browse risorse per categoria
- Card con hover effects e animazioni
- Badge Verified e Featured
- Sistema preferiti (heart)
- Status Install/Pre-installed
- Vista dettagli risorse
- Ricerca full-text
- Display tag (max 3 + overflow)

## Sistema Plugin

- Lista plugin per categoria
- Ricerca plugin
- Installazione con scope (local/global)
- Disinstallazione con conferma
- Refresh automatico post-install

## File Principali

| File | Ruolo |
|------|-------|
| `MarketplaceCard.tsx` | Card risorsa (326 righe) |
| `MarketplaceDrawer.tsx` | Drawer marketplace |
| `PluginsPanel.tsx` | Pannello plugin (200+ righe) |
| `PluginCard.tsx` | Card singolo plugin |
| `plugins.rs` | Backend Rust (31K LOC) |
