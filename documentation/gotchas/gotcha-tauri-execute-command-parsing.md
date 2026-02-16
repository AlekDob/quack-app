---
type: gotcha
created: 2026-02-02
last_verified: 2026-02-14
tags: [tauri, rust, execute-command, shell]
---

# Gotcha: Tauri execute_command Uses split_whitespace (No Shell Parsing)

## Problem

The Rust `execute_command` handler splits arguments with `split_whitespace()`, which:
1. **Does NOT respect quotes** — `"path with spaces"` becomes `["\"path", "with", "spaces\""]`
2. **Does NOT support shell operators** — `&&`, `|`, `;` are passed as literal args
3. **Does NOT expand `~`** — must use full paths

## Impact

Commands like:
```
node "/Users/user/.quack/scripts/foo.mjs"
mkdir -p ~/.quack/scripts && cp script.mjs ~/.quack/scripts/
```
...will FAIL.

## Workarounds

1. **No quotes needed** if paths have no spaces (e.g. `/Users/user/.quack/` is safe)
2. **Split compound commands** into separate `execute_command` calls:
   ```typescript
   // WRONG: execute_command("mkdir -p /path && cp file /path")
   // RIGHT:
   await invoke('execute_command', { command: 'mkdir', args: ['-p', '/path'] });
   await invoke('execute_command', { command: 'cp', args: ['file', '/path/'] });
   ```
3. **Use `cwd` parameter** for relative paths instead of absolute paths with spaces

## Also Remember

- `homeDir()` from Tauri may not have trailing `/` → always check: `const sep = home.endsWith('/') ? '' : '/';`
- Tauri sandbox blocks `create_directory`/`write_file_content` for paths outside app dir → use `execute_command` instead
