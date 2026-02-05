---
type: pattern
project: quack-app
created: 2026-01-08
migrated: true
---

# Quack Brain Obsidian Sync System

Sistema di sincronizzazione bidirezionale tra Quack Brain (SQLite) e Obsidian Vault

Ogni nota ha UN SOLO TAG che determina il tipo: #component, #function, #api, #pattern, #bug, #decision, #task, #config, #idea, #todo, #human, #note, #glossary, #diary, #project

Il tag va nel BODY come #hashtag, NON nel frontmatter

Ogni nota project-scoped include **Project:** [[project-name]] per creare backlinks

La data è un WikiLink: date: "[[2026-01-08]]" per collegare al diary

Il diary viene auto-creato se non esiste e aggiornato con ogni nuova nota

Struttura vault: QuackBrain/diary/, QuackBrain/global/, QuackBrain/projects/{name}/

Tag-to-folder mapping: component→components/, function→functions/, api→api/, pattern→patterns/, etc.

WikiLinks [[NoteName]] sono estratti automaticamente e salvati nella tabella wikilinks

MCP tools disponibili: brain_search, brain_create_entity, brain_add_observation, brain_get_backlinks, brain_get_wikilinks

Frontmatter obbligatorio: id, date (WikiLink), author, status, confidence

Frontmatter opzionale: project, file (source path), aliases

NO H1 nel body - Obsidian mostra il filename come titolo
