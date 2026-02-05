---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Claude Assets Panel

## Sidebar Destra: Claude Assets

La sidebar destra di Quack mostra i **Claude Assets** - tutti gli elementi che estendono le capacita di Claude nel progetto corrente.

## Le 5 Sezioni

### 1. Skills (skill/)
Le **skills** sono istruzioni specializzate che Claude puo invocare:
- Definite in `.claude/skills/*.md`
- Attivate con il tool `Skill`
- Esempio: `frontend-design`, `swift-expert`, `seo-audit`

### 2. Commands (commands/)
I **slash commands** sono shortcut per prompt complessi:
- Definiti in `.claude/commands/*.md`
- Invocati con `/nome-comando`
- Esempio: `/commit`, `/code-review`, `/feature`

### 3. Droids (agents/)
I **droids** sono agenti specializzati con personalita:
- Definiti in `.claude/agents/*.md`
- Hanno avatar, ruolo, istruzioni custom
- Esempio: Agent Magnus (Coder), Agent Laura (Marketing)

### 4. MCPs (mcps/)
I **MCP servers** espongono tools a Claude:
- Configurati in `mcp_servers.json`
- Possono essere locali o remoti
- Esempio: brain, kanban, semantic-search, ide-tools

### 5. Rules (rules/)
Le **rules** sono istruzioni sempre attive:
- Definite in `.claude/rules/*.md`
- Iniettate automaticamente in ogni conversazione
- Esempio: coding standards, language preferences

## File Explorer Integration

La sidebar mostra anche il **File Explorer** con la struttura `.claude/`:

```
.claude/
├── agents/       # 9 droids
├── commands/     # 30 slash commands
├── docs/         # 31 documenti
├── mcps/         # 4 MCP configs
├── plugins/      # 1 plugin
├── rules/        # 2 rules
└── skills/       # 4 skills
```

## Componenti UI

| Componente | Ruolo |
|------------|-------|
| `ContextPanel.tsx` | Container sidebar destra |
| `SkillsPanel.tsx` | Lista skills disponibili |
| `CommandsPanel.tsx` | Lista slash commands |
| `AgentsPanel.tsx` | Lista droids/agenti |
| `MCPPanel.tsx` | Lista MCP servers |
| `RulesPanel.tsx` | Lista rules attive |
