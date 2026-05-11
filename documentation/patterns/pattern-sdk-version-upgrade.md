---
type: pattern
project: quack-app
created: 2026-05-11
last_verified: 2026-05-11
tags: [sdk, claude-agent-sdk, upgrade, regression, deprecation, stream-daemon]
---
# Claude Agent SDK Version Upgrade Workflow

## Overview

Process and checks to safely bump `@anthropic-ai/claude-agent-sdk` in `src-tauri/node-sdk/package.json`. Followed for the 0.2.111 → 0.2.138 jump (May 2026). Reuse for every subsequent bump.

## Checklist (in order)

1. **Diff the CHANGELOG** between current and target version on [anthropics/claude-agent-sdk-typescript](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md). Flag every "Breaking" and "Deprecated" entry — list them in the diary before touching code.
2. **Map breaking changes to our code**:
   - `env` semantics (v0.2.113): we do NOT pass `env` to `query()` — `stream-daemon.js` mutates `process.env` directly around lines 349–375. No action needed unless that pattern changes.
   - `'Skill'` in `allowedTools` (deprecated v0.2.133): migrate to `skills: 'all'` option (or specific skill names array). See "Skill migration" below.
   - `TodoWrite` (deprecated v0.2.136): future-compat by adding `TaskCreate/TaskGet/TaskUpdate/TaskList` to `defaultAllowedTools` *alongside* `TodoWrite` until FE renderers (`TodoWidget.tsx`, `ToolCallCard.tsx`) and `types.ts` are migrated.
3. **Capture test baseline** before bump:
   ```bash
   npm test 2>&1 | grep "FAIL " > /tmp/quack-baseline-fails.txt
   wc -l /tmp/quack-baseline-fails.txt
   ```
   Current expected baseline: **1179 pass / 86 fail** (15 pre-existing failing test files — Tooltip, useMaxPlanTracking, EquipBar, app.characterization, thinkingModeControl, etc.). Anything different = potential regression.
4. **Bump in `src-tauri/node-sdk/`** (NOT root):
   ```bash
   cd src-tauri/node-sdk
   npm install @anthropic-ai/claude-agent-sdk@latest
   ```
5. **Smoke-load the daemon** (catches syntax/import breaks instantly):
   ```bash
   cd src-tauri/node-sdk
   node --input-type=module -e "import('./stream-daemon.js').then(()=>console.log('OK'))"
   ```
   Expected: `{"type":"daemon_ready"}` then `OK`.
6. **Run full check matrix** — all must be exit 0:
   - `npm test` (compare counts to baseline file)
   - `npx tsc -b` (frontend types)
   - `cd src-tauri && cargo check` (backend, since SDK module is loaded by Rust IPC layer)
7. **`npm audit fix`** (non-breaking only) on `src-tauri/node-sdk/` — never `--force` without explicit consent (would jump `vitest@4` major).
8. **Diary** in `documentation/diary/YYYY-MM-DD.md` with: version before/after, regression delta (must be zero), audit count delta, list of deprecations migrated.

## Skill migration (v0.2.133+ deprecation)

`'Skill'` in `allowedTools` is deprecated. Replacement: `skills` option on the same options object.

**Before:**
```js
const options = {
  allowedTools: ['Skill', 'Task', 'Read', /* ... */],
  // ...
};
```

**After (current code, stream-daemon.js):**
```js
const options = {
  allowedTools: ['Task', 'Read', /* ... */],
  skills: 'all',  // string[] | 'all'
};
```

`skills: 'all'` preserves prior behavior. To restrict, pass `['skill-name-1', 'skill-name-2']`.

Same migration applied to all 8 `cache-test-*.mjs` benchmark scripts for parity with prod daemon.

## TodoWrite deferred migration (v0.2.136+)

`TodoWrite` is deprecated in favor of `TaskCreate/TaskGet/TaskUpdate/TaskList`. Current strategy:

- Keep `TodoWrite` in `defaultAllowedTools` (the renderer side still expects it — see `src/components/TodoWidget.tsx`, `src/components/ToolCallCard.tsx`, `src/types.ts`).
- Add the 4 Task tools alongside in `defaultAllowedTools` and `askModeAllowedTools` (forward-compat: if model upgrade starts emitting Task tools, they'll be allowed).
- Full migration is a separate task: rename `Todo` types, update widget rendering, then drop `TodoWrite` after a release where Task tools are emitted in practice.

## Anti-patterns

- **Don't `npm audit fix --force`** without explicit consent — it pulls breaking-major deps (e.g. `vitest@4`).
- **Don't bump SDK at the root `package.json`** — the SDK lives only in `src-tauri/node-sdk/`. Root `npm install` won't touch the daemon.
- **Don't skip `cargo check`** — even if no Rust code changed, the Rust side spawns `stream-daemon.js` and can panic on unexpected daemon JSON shapes.
- **Don't migrate `TodoWrite` from the daemon without also migrating the renderers** — `TodoWidget.tsx` parses the tool's specific input shape.

## Links

- SDK CHANGELOG: https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md
- Daemon: `src-tauri/node-sdk/stream-daemon.js` (look for `defaultAllowedTools`, `skills:`, `process.env.ANTHROPIC_BASE_URL`)
- Related gotcha: `documentation/gotchas/gotcha-sdk-bundled-cli-200k-context-window.md` (resolved, useful version-history reference)
- Related gotcha: `documentation/gotchas/gotcha-sdk-allowedtools-bypasses-canuse.md` (interaction with `canUseTool`)
