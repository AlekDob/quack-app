---
type: decision
project: quack-app
created: 2026-01-10
migrated: true
---

# Quack Agent Bundle Architecture

## Vision: Paperi come Plugin Esportabili

I 'Paperi' (Quack Agents) diventano bundle completi che includono:
- Personality (nome, avatar, ruolo, stile comunicativo)
- Skills (Claude Code skills .md)
- Droids (subagents .md)
- Rules (regole .md)
- Slash Commands (comandi personalizzati)
- Assets (avatar, icone)

## Differenziazione da Claude Code Vanilla

1. **Container unificato** - Claude Code ha agents/droids/skills separati, Quack li raggruppa
2. **Marketplace condiviso** - Git-based, community-driven
3. **Esperienza RPG** - Creazione gamificata con drag-and-drop
4. **Installazione globale** - Import installa tutto in ~/.claude/

## Bundle Structure

```
QuackAgent/
├── manifest.json          # Metadata + versioning
├── personality/
│   └── agent.json         # Nome, avatar, ruolo, stile
├── skills/                # Skills da installare
│   ├── my-skill.md
│   └── another-skill.md
├── droids/                # Subagents da installare
│   ├── code-reviewer.md
│   └── test-runner.md
├── rules/                 # Rules da installare
│   └── coding-standards.md
├── commands/              # Slash commands
│   └── my-command.md
└── assets/                # Avatar, icons
    └── avatar.png
```

## Scope Decision

**GLOBAL INSTALL** - Tutti i bundle vengono installati in ~/.claude/ così sono disponibili ovunque. Rationale: i paperi sono 'compagni' del developer, non specifici di un progetto.

[2026-01-10] Architectural decision made with Alek - Quack Agent Bundles will be the core differentiator for Quack vs vanilla Claude Code

[2026-01-10] Tag: #quack-bundles - Sistema di bundle per agenti esportabili

[2026-01-10] Moved to quack-bundles/ folder for better organization
