---
type: decision
project: quack-app
created: 2026-04-08
last_verified: 2026-04-08
tags: [windows, build, ci, github-actions, release, tauri]
---

# Decision: Windows Build & Release Strategy

## Context

Quack ships as a Tauri desktop app. macOS builds are done manually by Alek on his machine (with Apple signing/notarization). Windows builds require a Windows environment, so we use GitHub Actions with `windows-latest`.

## Key Problem

The `beforeBundleCommand` in `tauri.conf.json` calls `bash scripts/sign-all-binaries.sh` which is macOS-only (Apple codesigning). The Windows workflow must strip this command before building.

## Workflow

- File: `.github/workflows/windows-build.yml`
- Trigger: `workflow_dispatch` (manual, from GitHub Actions UI)
- Runner: `windows-latest`
- Outputs: NSIS `.exe` installer (with Git/Node.js dependency installer via `hooks.nsh`)
- Target repo: `AlekDob/quack-releases`

## Inputs

| Input | Default | Purpose |
|-------|---------|---------|
| `bump_version` | false | Bump patch version before building |
| `create_release` | true | Publish release (false = draft) |

## Open Decision: Release Organization

Two options under evaluation:

### Option 1: Single release per version (recommended)
- One release `v0.9.0` with both `.dmg` and `.exe`
- Alek uploads macOS artifacts manually, then triggers Windows workflow to append `.exe` to same release
- Tauri updater `latest.json` can serve both platforms from one release
- Requires modifying workflow to "upload to existing release" instead of creating new one

### Option 2: Separate releases per platform
- `v0.9.0` for macOS, `v0.9.0-windows` for Windows
- Simpler workflow, no coordination needed
- Tauri updater needs platform-specific endpoint logic
- Current workflow implements this approach (tag: `v{version}-windows`)

**Status**: Awaiting Alek's decision. Workflow currently uses Option 2.

## Required Secrets

Same as macOS workflow:
- `RELEASES_GITHUB_TOKEN`
- `TAURI_PRIVATE_KEY` + `TAURI_KEY_PASSWORD`
- `DISCORD_WEBHOOK` (for notification)

## Gotcha: macOS beforeBundleCommand

The workflow includes a step that removes `beforeBundleCommand` from `tauri.conf.json` at build time. This is a runtime-only modification (not committed). If `tauri.conf.json` changes the signing script path, the workflow step must be updated accordingly.

## First Build Warning

First Windows build may surface Rust compilation issues — dependencies like `portable-pty`, `keyring`, `notify` have different behavior on Windows. Debug from CI logs if it fails.
