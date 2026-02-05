---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Saved Commands System

## Sistema Comandi Salvati

Quack permette di **salvare comandi frequenti** per riutilizzarli rapidamente.

## Categorie Comandi

- `dev` - Development (npm run dev, etc.)
- `build` - Build (npm run build, etc.)
- `test` - Test (npm test, etc.)
- `custom` - Personalizzati

## Funzionalita

- Salva comando con nome e categoria
- Lancia comando immediatamente
- Invia comando al terminale attivo
- Modifica comandi esistenti
- Elimina con conferma
- Visualizzazione raggruppata per categoria

## Azioni Disponibili

| Icona | Azione |
|-------|--------|
| Play | Lancia comando |
| Send | Invia a terminale |
| Edit | Modifica comando |
| Trash | Elimina comando |

## File Principali

| File | Ruolo |
|------|-------|
| `SavedCommandsDrawer.tsx` | Drawer comandi (80+ righe) |
