---
name: quack-release
description: Build, sign, notarize and publish a Quack desktop release (macOS DMG + updater feed) to the AlekDob/quack-releases repo. Use whenever the user asks to cut a release, publish a version, ship a build, upload a DMG, or says /release. Also use when they ask why a published build has no telemetry or why the auto-updater does not see a new version — both are release-step mistakes this skill prevents.
activationKeywords:
  - release
  - publish release
  - create release
  - upload dmg
  - github release
  - pubblica release
invocations:
  - /release
  - /publish-release
---

# Quack Release

Quack is an **Electron** app in a Turborepo monorepo. The code lives in
`AlekDob/quack-app` (public). The built binaries live in a separate public repo,
`AlekDob/quack-releases`, because the app's auto-updater points there.

macOS builds are made **locally** on Alek's Mac (the Developer ID cert is in his
login keychain). The `.github/workflows/release.yml` CI path exists but most of
its signing secrets are not set on the repo, so do not assume a tag push will
produce artifacts. Ask before relying on CI.

## Before you build

**Version.** Both `apps/web/package.json` and `apps/desktop/package.json` carry
it and they must match. If the user wants a version bump, use the
`bump-version` skill first — it also writes the "What's new" entry that the app
shows after an update. Skipping it means users update and see nothing changed.

**PostHog key.** The analytics key is baked into the bundle at build time by
`apps/desktop/tsdown.config.mts`. Nothing reads it at runtime, because a
shipped desktop app has no env vars. So:

```bash
export SYNARA_POSTHOG_KEY="phc_..."   # from the SYNARA_POSTHOG_KEY repo secret
```

Forget this and the build still succeeds — telemetry is just silently dead, with
no log line saying so. That is the single easiest way to ship a blind release.
A fork building from source gets `""` and stays silent on purpose, so the flag
is deliberately quiet; you have to remember it.

**Checks.** `bun fmt`, `bun lint`, `bun typecheck` must pass. Run them once, as
one pass, not repeatedly.

## Build

```bash
export SYNARA_POSTHOG_KEY="phc_..."
bun run dist:desktop:dmg:arm64:signed
```

That wraps `scripts/notarize-local-mac.sh arm64`, which sources Apple
credentials from `~/Desktop/Dev/Personal/quack-app/.env` and runs
electron-builder signed + notarized. It takes several minutes; notarization is
a round trip to Apple.

Artifacts land in `<repo>/release/`:

| File                        | What it is                      |
| --------------------------- | ------------------------------- |
| `Quack-{version}-arm64.dmg` | the installer                   |
| `Quack-{version}-arm64.zip` | what the auto-updater downloads |
| `*-mac.yml`                 | the updater feed manifest       |

Verify the key actually made it in before uploading:

```bash
grep -c 'phc_' apps/desktop/dist-electron/main.js
```

Zero means you forgot the export. Rebuild.

## Release notes

Ask the user for the highlights unless they already gave them. Then get the
commits for the rest:

```bash
git log "$(git describe --tags --abbrev=0)"..HEAD --pretty=format:"- %s"
```

Group them into New / Fixed / Improved by conventional-commit prefix. Drop the
noise (chore, docs-only, formatting) — the changelog is read by users, not by
you. The repo is public now, so write it for a stranger.

Structure:

```markdown
## What's new in Quack {version}

{highlights, one `###` section each}

### Changes

{grouped commits}

## Download

| Platform              | File                      | SHA256  |
| --------------------- | ------------------------- | ------- |
| macOS (Apple Silicon) | Quack-{version}-arm64.dmg | `{sha}` |

Windows and Linux: build from source — https://github.com/AlekDob/quack-app

## Install

1. Download the DMG, open it, drag **Quack** into Applications.
2. First launch: right-click > Open (macOS quarantines downloaded apps).
```

Checksum: `shasum -a 256 release/Quack-{version}-arm64.dmg | cut -d' ' -f1`

Show the whole thing to the user and wait for a yes before publishing. A
published release is public and the updater picks it up within minutes.

## Publish

`gh` has multiple accounts on this machine and `gh auth switch` does not survive
between shell calls, so pass the token explicitly every time:

```bash
export GH_TOKEN=$(/opt/homebrew/bin/gh auth token -u AlekDob)
/opt/homebrew/bin/gh release create "v{version}" \
  release/Quack-{version}-arm64.dmg \
  release/Quack-{version}-arm64.zip \
  release/*-mac.yml \
  --repo AlekDob/quack-releases \
  --title "Quack {version}" \
  --notes-file /tmp/release-notes.md
```

The `.zip` and the `.yml` are not optional. The DMG is what humans click; the
zip plus manifest are what the auto-updater reads. Upload only the DMG and
existing users never get the update.

## After

- Release page: `https://github.com/AlekDob/quack-releases/releases/tag/v{version}`
- The landing page reads the latest release from the GitHub API
  (`src/hooks/useLatestRelease.ts` in the `quackagency-website` repo), so the
  download button follows automatically. It has a hardcoded fallback URL — if
  the filename pattern ever changes, update it there too.
- Write the diary entry in `documentation/diary/YYYY-MM-DD.md`.

## Known gaps

- **Apple Silicon only.** No x64 mac, no Windows, no Linux binaries are being
  published today, even though build scripts exist (`dist:desktop:dmg:x64`,
  `dist:desktop:win`, `dist:desktop:linux`). Windows needs Azure Trusted
  Signing secrets that are not configured. Say this plainly in the notes rather
  than letting people download a broken thing.
- **CI release is untested.** `release.yml` covers all three platforms and
  handles signing, checksums, npm and the update feed properly. Making it work
  is a matter of adding the missing repo secrets, not writing code.
