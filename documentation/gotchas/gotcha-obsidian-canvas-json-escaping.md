---
type: gotcha
created: 2026-01-23
last_verified: 2026-02-14
tags: [obsidian, canvas, json, escaping]
---

# Gotcha: Obsidian Canvas JSON Quote Escaping

## Trigger

Quando generi un file `.canvas` per Obsidian e il canvas non si apre o mostra errore di parsing.

## Problema

Le virgolette dentro il testo dei nodi devono essere escaped correttamente nel JSON. Obsidian e' particolarmente sensibile a:
- Quote non escaped nel campo `text`
- Newline non escaped (`\n` richiesto)
- Caratteri unicode che rompono il parser JSON

## Soluzione

1. Usa sempre `\"` per le virgolette nel contenuto dei nodi
2. Sostituisci newline con `\\n` nel JSON
3. Valida il JSON con `JSON.parse()` prima di scrivere il file
4. Per citazioni complesse, usa backtick markdown invece di virgolette

## Prevenzione

La skill `obsidian-canvas-creator` include una checklist di validazione. Seguila sempre prima dell'output finale.
