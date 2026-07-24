---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-24
last_verified: 2026-07-24
tags: [semver, release, tags, ci, status-bar, versioning, rc, production, quack-v1]
---

## App versioning (dual-track SemVer)

**Purpose:** One SemVer across npm / Tauri / Cargo, cut as **RC** from `develop`
or **stable** from `production`, with the live version visible in the StatusBar.
**Stack:** Node bump script (zero deps), Git annotated tags `v*`, GitHub Actions
`tauri-action`, Vite `define` → `__APP_VERSION__`

### Channels

| Channel | Branch (hard gate) | Version / tag | GitHub Release |
|---|---|---|---|
| RC | `develop` | `X.Y.Z-rc.N` → `vX.Y.Z-rc.N` | draft **prerelease** |
| Prod | `production` | `X.Y.Z` → `vX.Y.Z` | draft stable |

Daily desktop push can still use `main` → `origin/quack-1.0` (`003`); release
script **only** accepts `develop` / `production`.

### Commands

| Command | Effect |
|---|---|
| `npm run release:rc` | On `develop`: next `…-rc.N` (or explicit `X.Y.Z-rc.N`) |
| `npm run release:prod -- patch\|minor\|major\|X.Y.Z` | On `production`: stable bump |
| `npm run release:dry -- rc\|prod …` | Print next version; no writes |
| `… -- --push` | After commit+tag, `git push` branch + tag |
| `… -- --no-tag` | Bump+commit only |

Default: **no push**. Dirty tree (files outside the five version sources) → abort.
Existing tag → abort.

### Version sources (kept in sync)

| File | Field |
|---|---|
| `package.json` | `version` (source of truth for UI) |
| `package-lock.json` | root + `packages[""].version` |
| `src-tauri/tauri.conf.json` | `version` |
| `src-tauri/Cargo.toml` | `[package].version` |
| `src-tauri/Cargo.lock` | `name = "codetta"` package entry |

### Files

| Type | Path | Role |
|---|---|---|
| Script | `scripts/bump-version.mjs` | Channel parse, branch gate, sync, DCO commit, annotated tag |
| Config | `package.json` | `release:rc` / `release:prod` / `release:dry` |
| CI | `.github/workflows/release.yml` | On `v*`: version guard, Quack draft release, `prerelease` iff `-rc.` |
| Config | `vite.config.ts` | `define.__APP_VERSION__` ← `package.json` |
| Component | `src/components/Splash.tsx` | Splash label `v${__APP_VERSION__}` |
| Component | `src/components/StatusBar.tsx` | Left chip `v…`; click → `help.about` |
| Command | `src/actions.ts` → `help.about` | About dialog text includes version |
| Style | `src/App.css` → `.sb-version` | Muted tabular chip |

### Data flow

```
npm run release:rc|prod
  → bump-version.mjs syncs 5 sources + commit + tag v$VER
  → (optional) git push tag
  → release.yml
       → assert tag == package.json == tauri.conf.json
       → tauri-action draft release (prerelease if *-rc.*)

package.json version
  → vite define __APP_VERSION__
  → Splash / StatusBar / About
```

### RC auto-increment

| Current on disk | `release:rc` (no arg) |
|---|---|
| `1.0.0` | `1.0.0-rc.1` |
| `1.0.0-rc.3` | `1.0.0-rc.4` |
| want next minor RC | pass explicit `1.1.0-rc.1` |

### StatusBar chip

| Surface | Behavior |
|---|---|
| Label | `v` + `__APP_VERSION__` (e.g. `v1.0.0`, `v1.0.0-rc.1`) |
| Placement | First item in `.sb-left` |
| Click | `runCommand("help.about")` |
| Style | `.sb-version` — `var(--fg-dim)`, hover `var(--bg-hover)` |

### Gotchas

- **Branch gate is local** — CI does not verify tag came from `develop`/`production`; wrong-branch tags are a process failure.
- **CI macOS stays unsigned** — Gatekeeper-clean DMG still via `035` local pipeline.
- **Installer filenames may still say Codetta** — `productName` / bundle ids; release *title* is Quack.
- **`origin/main` ≠ desktop** — do not push desktop release tags expecting GitHub default `main` history (`003`).
- **Create `develop` once** from `quack-1.0`/`main` if missing; align `production` before first stable cut.

### Related

- [`035-macos-release-notarization.md`](035-macos-release-notarization.md) — signed local DMG (not CI)
- [`046-process-cleanup.md`](046-process-cleanup.md) — other StatusBar chips (CPU/RAM)
- [`086-perf-audit-window.md`](086-perf-audit-window.md) — Audit chip on same bar
- [`003-git-remote-quack-1.0.md`](../decisions/003-git-remote-quack-1.0.md) — desktop push target
- `AGENTS.md` — command + branch cheat sheet
