# Implementation Plan: Brain Hooks

## Technology Stack

- **Runtime**: Node.js (pure, zero dependencies)
- **I/O**: `fs` module only, atomic writes via tmp+rename
- **Communication**: stdin (JSON from Claude Code) → stderr (warnings to Claude) → exit(0)
- **Distribution**: Quack Marketplace plugin (quack-marketplace repo)
- **Tracking**: JSON session file in `.claude/`

## Architecture

### Hook Execution Flow

```
Claude Code SDK
    │
    ├─ SessionStart ──→ session-start.js ──→ Creates _brain-session.json
    │                                         Shows Brain stats on stderr
    │
    ├─ PreToolUse(Read) ──→ pre-read.js ──→ Reads AST.md for file entry
    │                                        Checks gotchas/bugs for file
    │                                        Warns if already read in session
    │                                        Updates _brain-session.json
    │
    ├─ PreToolUse(Write|Edit) ──→ pre-write.js ──→ Checks gotchas for file
    │                                               Resolves Brain breadcrumbs
    │                                               Warns on Do-Not-Repeat match
    │
    └─ Stop ──→ stop.js ──→ Reads _brain-session.json
                             Generates session summary
                             Appends to diary
                             Cleans up session file
```

### File Structure

```
~/.quack/hooks/brain/           # Installed by marketplace
    ├── session-start.js        # SessionStart hook
    ├── pre-read.js             # PreToolUse(Read) hook
    ├── pre-write.js            # PreToolUse(Write|Edit) hook
    ├── stop.js                 # Stop hook
    └── shared.js               # Shared utilities (parseAST, findGotchas, etc.)

quack-marketplace/plugins/brain-hooks/
    ├── .claude-plugin/
    │   └── plugin.json         # Marketplace metadata
    ├── hooks/                  # Source files (copied to ~/.quack/hooks/brain/)
    │   ├── session-start.js
    │   ├── pre-read.js
    │   ├── pre-write.js
    │   ├── stop.js
    │   └── shared.js
    └── README.md
```

## Component Design

### shared.js — Utility Module

**Exports:**
- `readStdin()` → Parse JSON from stdin (Claude hook input)
- `warn(msg)` → Write to stderr (visible to Claude as warning)
- `info(msg)` → Write to stderr (informational)
- `getProjectDir()` → `$CLAUDE_PROJECT_DIR` or CWD
- `getDocsDir()` → Find `documentation/` folder
- `parseAST(astContent)` → Extract file entries from AST.md
- `findGotchas(filePath, docsDir)` → Scan gotchas/ and bugs/ for file mentions
- `readSession()` → Read/create `_brain-session.json`
- `writeSession(data)` → Atomic write session file
- `estimateTokens(text, type)` → Character-ratio estimation (3.5 code, 4.0 prose)
- `resolveBreakcrumbs(fileContent)` → Find `// Brain: {slug}` comments → resolve to doc paths

### session-start.js

1. Create `_brain-session.json` with: `{ id, startTime, filesRead: {}, filesWritten: {} }`
2. Count entries in `documentation/` (gotchas, patterns, bugs, decisions)
3. Find last diary entry date
4. Check for stale entries (last_verified > 7 days)
5. Emit summary on stderr

### pre-read.js

1. Parse stdin → extract `file_path`
2. Skip if file is in `.claude/` or `node_modules/` or `documentation/`
3. Check session: already read? → warn with token estimate
4. Look up in AST.md → show description + token estimate
5. Search gotchas/bugs for file mentions → show warnings
6. Update session: mark file as read

### pre-write.js

1. Parse stdin → extract `file_path` + content (new_string or content)
2. Skip infrastructure files
3. Search gotchas/bugs for file path → show critical warnings
4. If editing existing file, scan for `// Brain:` breadcrumbs → resolve each slug
5. Check content against known Do-Not-Repeat patterns (from gotchas)
6. Update session: mark file as written

### stop.js

1. Read `_brain-session.json`
2. If no activity → clean up and exit
3. Build summary: files read (count + tokens), files written (count), repeated reads
4. Format as diary entry: `- [HH:MM] (Auto) Session summary: N files read, M written, ~X tokens`
5. Append to `documentation/diary/YYYY-MM-DD.md` (create if missing, with frontmatter)
6. Delete `_brain-session.json`

## Security Considerations

- No network access, all local filesystem
- No secrets read or stored
- Session file contains only file paths and timestamps (no content)
- Hooks never modify existing Brain entries (read + append-only)

## Error Handling

Every hook follows the same pattern:
```javascript
async function main() {
  try {
    // ... hook logic
  } catch (err) {
    // Log error but NEVER block
    process.stderr.write(`[brain-hooks] Error: ${err.message}\n`);
  }
  process.exit(0); // ALWAYS exit cleanly
}
main();
```

## Performance Strategy

- AST.md parsed once per hook call (typically <100ms for 1000-line file)
- Gotcha scanning uses filename-based heuristic (no full-text search)
- Session file is small JSON (<10KB even after 100+ reads)
- All I/O is synchronous (faster for small files, avoids async overhead)
