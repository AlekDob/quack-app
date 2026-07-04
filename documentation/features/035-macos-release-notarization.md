# 035 — macOS release signing & notarization

Signed, notarized `.dmg` builds for distribution outside the Mac App Store.
Pipeline ported from `quack-app` and adapted for Quack desktop (lighter bundle —
no embedded `node-sdk` / ripgrep sidecars).

**Human guide:** [README-MAC.md](../../README-MAC.md)

## When to use

| Goal | Command |
|---|---|
| Dev / unsigned local build | `npm run tauri dev` or `npm run build:mac` |
| Signed but not notarized | `npm run build:mac` (Tauri signs main binary only) |
| **Shippable macOS release** | `npm run build:mac:release` or `build:mac:release:universal` |

CI (`.github/workflows/release.yml`) still builds **unsigned** macOS artifacts.
Local release builds with `.env` are the path to Gatekeeper-clean DMGs until CI
secrets are fixed.

## Architecture

```
npm run build:mac:release[:universal]
  │
  ├─ load-signing-env.sh     → exports ONLY APPLE_SIGNING_IDENTITY
  ├─ npm run build           → Vite frontend
  ├─ cargo tauri build --bundles app   → Quack.app (no DMG yet)
  └─ sign-and-notarize.sh
       ├─ xattr -cr Quack.app
       ├─ codesign all Mach-O (.dylib, .node, executables) in parallel
       ├─ codesign main binary (Quack) + bundle with Entitlements.plist
       ├─ notarytool submit Quack.zip → staple .app
       ├─ create DMG (create-dmg or hdiutil)
       └─ sign + notarize + staple DMG
```

Deliverable: `src-tauri/target/*/release/bundle/macos/Quack.dmg`

## Files

| File | Role |
|---|---|
| `.env` | Local secrets — **gitignored**. Copy from `.env.example`. |
| `.env.example` | Template for signing identity + notarization creds |
| `scripts/load-signing-env.sh` | Build-time: identity only (blocks Tauri auto-notarize) |
| `scripts/sign-and-notarize.sh` | Post-build: full sign → notarize → DMG pipeline |
| `src-tauri/Entitlements.plist` | Hardened runtime entitlements (network, files, JIT, no sandbox) |
| `src-tauri/tauri.conf.json` | `bundle.macOS`: entitlements path, `hardenedRuntime: true` |

Optional: `scripts/dmg-background.png` + `brew install create-dmg` for branded DMG
(copy background from `quack-app` if desired).

## Credentials

Two supported notarization modes (pick one in `.env`):

1. **Inline** — `APPLE_ID`, `APPLE_PASSWORD` (app-specific password), `APPLE_TEAM_ID`
2. **Keychain profile (recommended)** — `APPLE_KEYCHAIN_PROFILE=QuackNotarization` after
   `xcrun notarytool store-credentials …`

Always required: `APPLE_SIGNING_IDENTITY` — e.g.
`Developer ID Application: Name (TEAMID)`. List with
`security find-identity -v -p codesigning`.

Re-use: copy `.env` from `quack-app` if already configured there.

## Gotchas

1. **`--bundles app` not `dmg`** — Tauri deletes `.app` after creating a DMG. We create
   the DMG manually *after* notarization so the stapled `.app` is inside it.

2. **Do not export notarization env vars during Tauri build** — if `APPLE_ID` /
   `APPLE_PASSWORD` / `APPLE_TEAM_ID` are set, Tauri attempts auto-notarization before
   all embedded binaries are signed → Apple rejection. `load-signing-env.sh` prevents this.

3. **Parse `.env` with `source`, not `source <(grep …)`** — apostrophes in identity
   strings break process substitution.

4. **`xattr -cr` before codesign** — Finder metadata / quarantine attrs block signing.

5. **Main executable is `Quack`** — `Contents/MacOS/Quack` (Cargo `[[bin]]` name), not `app`.
   Script tries both for compatibility.

6. **No App Sandbox** — app spawns shells, external CLIs (Claude Code, cursor-agent).
   `Entitlements.plist` sets `com.apple.security.app-sandbox` false with hardened runtime.

7. **GitHub Actions PKCS12 issue** — release workflow comments document a broken
   `APPLE_CERTIFICATE` secret; macOS CI artifacts remain unsigned until regenerated.

## Verify

```bash
codesign --verify --deep --strict path/to/Quack.app
xcrun stapler validate path/to/Quack.app
spctl -a -vvv -t install path/to/Quack.dmg
```

## Related

- `quack-app/documentation/patterns/macos-release-signing-notarization.md` — original pattern
- `documentation/decisions/003-git-remote-quack-1.0.md` — push signed builds from local `main`
