---
type: bug-report
project: quack-desktop
created: 2026-07-31
status: fixed
related:
  - 026-cursor-cli-bridge.md
  - 031-model-discovery-cache.md
tags: [cursor-cli, path, gui, model-browser, resolve_cursor_bin]
---

## Cursor CLI false "not installed" after GUI / rebuild launch

**Symptom:** Model Browser → Cursor CLI tab showed
"Install cursor-agent and run `cursor-agent login`" after rebuilding or launching
Quack from Dock / IDE Run — even though `cursor-agent` was on disk at
`~/.local/bin/cursor-agent` and `cursor-agent status` reported logged in.
Same machine worked when Quack was started from a terminal that already had
`~/.local/bin` on `PATH`.

**Root cause:** `resolve_cursor_bin` order was:

1. bare `cursor-agent` on process PATH
2. **login-shell** `cursor-agent --version` → cache `Standalone("cursor-agent")`
3. `~/.local/bin/cursor-agent` (never reached when step 2 succeeded)

macOS GUI launches often omit `~/.local/bin` from the process env. The shell
probe succeeded (login profile restores PATH), but later `Command::new("cursor-agent")`
in `cursor_code_check` / spawn used the process PATH → not found →
`isAvailable() === false` → UI install empty state.

Frontend amplified it: soft discovery fire-and-forget left
`cursorCliAvailable: false` on disk; Model Browser `refreshLiveCliModels`
early-returned on that flag without re-probing.

**Fix (2026-07-31):**
| Change | Detail |
|---|---|
| Resolve order | PATH → `~/.local/bin` → login-shell `command -v` absolute path → `cursor agent` |
| Never cache bare name from shell | `shell_which` stores absolute path only |
| Force refresh | `invalidateCursorCliCache` + await `probeCliAvailability` |
| Browser open | `ensureLiveCliCatalogs` awaits probe (no stale-flag skip) |

**Files:** `src-tauri/src/cursor_code.rs`, `src/modelDiscoveryStore.ts`,
`src/components/AIChatPanel.tsx`, features `026` / `031`.
