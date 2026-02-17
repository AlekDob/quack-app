---
type: pattern
created: 2026-01-08
---

# Claude Assets Panel

## Sidebar Destra: Claude Assets

La sidebar destra di Quack mostra i **Claude Assets** - tutti gli elementi che estendono le capacita di Claude nel progetto corrente.

## Le 5 Sezioni

### 1. Skills (skill/)
Le **skills** sono istruzioni specializzate che Claude puo invocare:
- Definite in `.claude/skills/*.md`
- Attivate con il tool `Skill`

### 2. Commands (commands/)
I **slash commands** sono shortcut per prompt complessi:
- Definiti in `.claude/commands/*.md`
- Invocati con `/nome-comando`

### 3. Droids (agents/)
I **droids** sono agenti specializzati con personalita:
- Definiti in `.claude/agents/*.md`
- Hanno avatar, ruolo, istruzioni custom

### 4. MCPs (mcps/)
I **MCP servers** espongono tools a Claude:
- Configurati in `mcp_servers.json`
- Possono essere locali o remoti

### 5. Rules (rules/)
Le **rules** sono istruzioni sempre attive:
- Definite in `.claude/rules/*.md`
- Iniettate automaticamente in ogni conversazione

## File Explorer Integration

La sidebar mostra anche il **File Explorer** con la struttura `.claude/`.

## Componenti UI

| Componente | Ruolo |
|------------|-------|
| `ContextPanel.tsx` | Container sidebar destra |
| `SkillsPanel.tsx` | Lista skills disponibili |
| `CommandsPanel.tsx` | Lista slash commands |
| `AgentsPanel.tsx` | Lista droids/agenti |
| `MCPPanel.tsx` | Lista MCP servers |
| `RulesPanel.tsx` | Lista rules attive |
