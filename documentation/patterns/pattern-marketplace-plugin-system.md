---
type: pattern
created: 2026-01-08
deprecated: true
superseded_by: quack-store-system.md
---

# Marketplace and Plugin System

**DEPRECATED**: This document is outdated. The Addons system was renamed to **Quack Store** and completely redesigned with Apple App Store-style layout on 2026-02-08. See `quack-store-system.md` for current documentation.

## Tipi di Risorse

| Tipo | Descrizione |
|------|-------------|
| agents | Agenti AI con personalita |
| commands | Slash commands |
| hooks | Hook di automazione |
| settings | Preset configurazione |
| mcp | MCP servers |
| stacks | Stack completi |
| skills | Skill specializzate |

## File Principali

| File | Ruolo |
|------|-------|
| `MarketplaceCard.tsx` | Card risorsa |
| `MarketplaceDrawer.tsx` | Drawer marketplace |
| `PluginsPanel.tsx` | Pannello plugin |
| `plugins.rs` | Backend Rust |
