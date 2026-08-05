---
type: feature-doc
project: synara
stack: Node / electron-builder / Tauri-less macOS packaging
created: 2026-08-05
startDate: 2026-08-05
endDate: 2026-08-05
last_verified: 2026-08-05
status: active
tags: [macos, signing, notarization, release, electron-builder, distribution]
---

# 014 — Local signed & notarized macOS build

One command produces a Gatekeeper-clean, notarized `Quack.dmg` on the developer's
own Mac, without touching CI secrets. Complements the existing CI signing path in
`docs/release.md` (§2 Apple signing + notarization setup), which uses an App Store
Connect API key and is required for public releases.

## When to use

| Goal                             | Command                                                       |
| -------------------------------- | ------------------------------------------------------------- |
| Local unsigned dev build         | `bun run dist:desktop:dmg:arm64` / `make mac-app`             |
| **Local signed + notarized DMG** | `bun run dist:desktop:dmg:arm64:signed` / `make mac-app-dist` |
| Public release (CI)              | tag push `vX.Y.Z`, see `docs/release.md`                      |

Deliverable: `release/Synara-<version>-arm64.dmg` (stapled, `spctl` accepts it).
Takes ~15-20 min — Apple's notarization service is the bottleneck.

## Architecture

```
make mac-app-dist
  │
  ├─ bun install
  └─ bun run dist:desktop:dmg:arm64:signed
       └─ scripts/notarize-local-mac.sh
            ├─ source quack-app/.env → APPLE_SIGNING_IDENTITY, APPLE_ID, APPLE_PASSWORD, APPLE_TEAM_ID
            ├─ export CSC_NAME (identity with "Developer ID Application: " prefix stripped)
            ├─ export APPLE_APP_SPECIFIC_PASSWORD (alias of APPLE_PASSWORD)
            └─ node scripts/build-desktop-artifact.ts --platform mac --target dmg --arch arm64 --signed
                 ├─ electron-builder signs every Mach-O with CSC_NAME, then notarizes .app (electron-builder's
                 │  own afterSign notarize step, driven by `mac.notarize: true` when --signed)
                 └─ scripts/lib/mac-dmg-finalize.ts: codesign --verify → notarytool submit (--wait) →
                    stapler staple → codesign --verify → spctl assess → stapler validate
```

## Credentials — two accepted notarytool auth modes

`scripts/lib/mac-dmg-finalize.ts` (`resolveNotaryAuthArgs`) picks whichever is present,
API key first:

1. **App Store Connect API key** (used by CI, `.github/workflows/release.yml`):
   `APPLE_API_KEY` (raw `.p8` contents), `APPLE_API_KEY_ID`, `APPLE_API_ISSUER`.
2. **Apple ID + app-specific password** (used locally, no Issuer ID needed):
   `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`, `APPLE_TEAM_ID`.

Locally we only have mode 2 available — the App Store Connect Issuer ID was never
generated/recorded on this machine, only a loose `.p8` file with no matching Key ID
context. Mode 2 reuses the exact same Apple ID / app-specific password already
configured for `quack-app` (`~/Desktop/Dev/Personal/quack-app/.env`), so nothing new
had to be provisioned.

## Gotchas

1. **`SYNARA_DESKTOP_SIGNED=1` env var alone did not flip `signed`** on this run —
   `resolveBooleanEnv` should read it from `process.env` via Effect `Config`, but the
   build silently produced `mac.notarize: false` (electron-builder logged
   `skipped macOS notarization reason='notarize' options were set explicitly 'false'`).
   Root cause not fully isolated. **Workaround: always pass the `--signed` CLI flag**
   explicitly (`build-desktop-artifact.ts --signed`) instead of relying on the env var.
   `scripts/notarize-local-mac.sh` does this for you.
2. **`CSC_NAME` must NOT include the `Developer ID Application: ` prefix.**
   electron-builder auto-matches the certificate; passing the full
   `security find-identity` label makes it fail with
   `⨯ Please remove prefix "Developer ID Application:" from the specified name`.
3. **Two separate notarization steps run**, both real Apple round-trips:
   electron-builder's own `afterSign` notarize (on `Quack.app`, ~10 min) and then
   `mac-dmg-finalize.ts`'s explicit `notarytool submit` (on the `.dmg`, ~5 min).
   Total wall time is additive, not one call.
4. **No GUI interaction happens** for this path (unlike codetta's older
   `sign-and-notarize.sh`, which can trigger a `security unlock-keychain` prompt) as
   long as the login keychain is already unlocked and the identity was previously
   granted "Always Allow" for codesign — true on this machine already.

## Verify

```bash
DMG=release/Synara-0.6.5-arm64.dmg
spctl -a -vvv -t open --context context:primary-signature "$DMG"   # expect: accepted / Notarized Developer ID
xcrun stapler validate "$DMG"                                       # expect: The validate action worked!
```

## Files

| File                                   | Role                                                                                                               |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `scripts/notarize-local-mac.sh`        | New. Loads `quack-app/.env`, maps to the vars `build-desktop-artifact.ts` expects, forces `--signed`.              |
| `scripts/build-desktop-artifact.ts`    | Orchestrates staged build; `--signed` toggles `mac.notarize`/`mac.hardenedRuntime` and feeds finalize credentials. |
| `scripts/lib/mac-dmg-finalize.ts`      | Post-build DMG notarize/staple/validate; now accepts either credential mode.                                       |
| `scripts/lib/mac-dmg-finalize.test.ts` | Covers both auth modes + fail-closed cases.                                                                        |
| `package.json`                         | `dist:desktop:dmg:arm64:signed` script.                                                                            |
| `Makefile`                             | `mac-app-dist` target.                                                                                             |

## Related

- `docs/release.md` §2 — CI signing/notarization setup (API key mode), required secrets.
- `codetta/documentation/features/035-macos-release-notarization.md` — sibling Tauri
  project's own sign-and-notarize pipeline (different toolchain, same Apple credentials).
