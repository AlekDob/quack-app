---
type: pattern
project: quack-app
created: 2026-02-02
tags: [codebase-map, hooks, code-search, context-optimization]
---

# Pattern: Codebase Map Auto-Generation

## Problem

AI agents waste tokens doing exploratory Glob/Grep/Read calls to understand the codebase structure before making changes. A pre-built index of all exports reduces this overhead.

## Solution

A PostToolUse hook that auto-generates a codebase map (markdown index of all TypeScript/Swift exports) whenever Claude writes or edits a `.ts/.tsx/.swift` file.

### Architecture

```
Claude Write/Edit .ts/.tsx/.swift → PostToolUse hook → node generate-codebase-map.mjs (incremental)
                                                              ↓
                                              {project}/.quack/codebase-map.md updated
                                                              ↓
                                    Agent reads map → knows exactly where to go (1 Read)
```

### Key Files

| File | Role |
|------|------|
| `scripts/generate-codebase-map.mjs` | Pure Node.js generator, zero deps. Multi-language (TS + Swift). Supports full scan + incremental |
| `scripts/codebase-map-hook.sh` | Bash wrapper for PostToolUse, filters by extension (`.ts/.tsx/.swift`) |
| `src/services/codebaseMapService.ts` | Service: install script, manage hooks, generate map via Tauri |
| `src/components/settings/categories/CodebaseMapSettings.tsx` | Settings UI with Generate Now, View Map, Auto-generate toggle |

### Output Format

**TypeScript:**
```markdown
## src/services/modelService.ts
- export interface ModelConfig
- export fn getModels(remoteModels?) -> ModelConfig[]
- export fn getModelId(friendlyName, remoteModels?) -> string
```

**Swift:**
```markdown
## MeowApp/Sources/Core/Design/ChatBubble.swift
- struct `ChatBubble { content, isUser, stats }`

## MeowApp/Sources/Core/Auth/AuthManager.swift
- class `AuthManager`
- func `authenticateWithBiometrics()`
- func `setBiometricEnabled(_ enabled: Bool)`
```

### Per-Project

Each project has its own map at `{projectDir}/.quack/codebase-map.md`. The hook is registered in `{projectDir}/.claude/settings.json`. Nothing is global except the script at `~/.quack/scripts/generate-codebase-map.mjs`.

### Performance

- Full scan: ~120ms for 478 files
- Incremental: ~2ms per file
- Zero external dependencies

## Gotchas

- **PostToolUse matcher syntax**: use `Write|Edit` (pipe for OR), not `Write,Edit` or `Write Edit`
- **Hook must trigger on Edit**: initial implementation had only `Write` matcher — agents using `Edit` tool would not trigger map update (fixed 2026-02-02)
- **Language detection**: script dispatches by file extension (`.swift` → Swift extractor, `.ts/.tsx` → TS extractor)
- **Swift limitations**: extractor doesn't handle extension methods or nested declarations, only top-level
- **Tauri sandbox**: `create_directory`/`write_file_content` are blocked for paths outside app dir. Use `execute_command` with shell commands instead.
- **`execute_command` parsing**: Rust backend uses `split_whitespace()` — doesn't respect quotes, doesn't support `&&`. Pass paths without quotes, split compound commands into separate calls.
- **`homeDir()` trailing slash**: Tauri's `homeDir()` may or may not include trailing `/`. Always add separator check: `const sep = home.endsWith('/') ? '' : '/';`
- **Script installation**: Script is bundled in `scripts/` and copied to `~/.quack/scripts/` on first use via `execute_command` running `mkdir -p` then `cp`.

## How to Activate for a New Project

Add to the project's CLAUDE.md:
```
## Codebase Navigation
Before searching the codebase, read `.quack/codebase-map.md` for a complete index of all exports.
```

Then enable auto-generate in Settings → Codebase Map.
