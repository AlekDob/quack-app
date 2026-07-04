# Quack — macOS build & notarization

Complete guide for building and distributing Quack desktop on macOS.

**Deep reference:** `documentation/features/035-macos-release-notarization.md`  
**Source pattern:** ported from [quack-app](https://github.com/AlekDob/quack-app) (`scripts/sign-and-notarize.sh`).

## Quick start (release)

```bash
# One-time: copy credentials (reuse quack-app if you already ship from there)
cp /path/to/quack-app/.env .env
# or: cp .env.example .env && fill in values

npm run build:mac:release:universal
```

Deliverable:

```
src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.dmg
```

## Prerequisites

```bash
xcode-select --install
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
cargo install tauri-cli   # or use npx / project's @tauri-apps/cli
npm install
```

Universal builds (Apple Silicon + Intel):

```bash
rustup target add x86_64-apple-darwin aarch64-apple-darwin
```

Optional branded DMG layout:

```bash
brew install create-dmg
cp ../quack-app/scripts/dmg-background.png scripts/dmg-background.png   # optional
```

## One-time Apple setup

1. [Apple Developer Program](https://developer.apple.com/programs/) membership ($99/year).
2. **Developer ID Application** certificate in Xcode → Settings → Accounts → Manage Certificates.
3. Create `.env` from `.env.example` (or copy from `quack-app`).
4. Notarization credentials — **pick one**:

### Option A — Keychain profile (recommended)

```bash
xcrun notarytool store-credentials "QuackNotarization" \
  --apple-id "you@example.com" \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --team-id "XXXXXXXXXX"
```

In `.env`:

```bash
export APPLE_KEYCHAIN_PROFILE="QuackNotarization"
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (XXXXXXXXXX)"
```

### Option B — `.env` inline

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (XXXXXXXXXX)"
export APPLE_ID="you@example.com"
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # app-specific password, NOT your Apple ID password
export APPLE_TEAM_ID="XXXXXXXXXX"
```

App-specific password: [account.apple.com](https://account.apple.com) → Sign-In and Security → App-Specific Passwords.

Find signing identity:

```bash
security find-identity -v -p codesigning
```

## npm scripts

| Script | Description |
|---|---|
| `npm run build:mac` | Release build, current CPU arch |
| `npm run build:mac:universal` | Universal binary, unsigned |
| `npm run build:mac:release` | Sign + notarize + DMG (current arch) |
| `npm run build:mac:release:universal` | Sign + notarize + DMG (arm64 + x86_64) |

## Pipeline (why it's split)

Tauri 2 will auto-notarize if `APPLE_ID` / `APPLE_PASSWORD` / `APPLE_TEAM_ID` are in the
environment during build — but it only signs the main binary, so Apple rejects the submission.

Our fix:

1. **`load-signing-env.sh`** — exports **only** `APPLE_SIGNING_IDENTITY` for the Tauri build.
2. **`cargo tauri build --bundles app`** — produces `Quack.app` only (no DMG).
   Tauri deletes `.app` after DMG creation, so we must not let Tauri create the DMG yet.
3. **`sign-and-notarize.sh`** — signs every Mach-O in the bundle, notarizes `.app`, staples,
   creates DMG, notarizes DMG.

```
load-signing-env → vite build → tauri build --bundles app
                                        ↓
                              sign-and-notarize.sh
                                        ↓
                              Quack.dmg (stapled, Gatekeeper OK)
```

## Verify before shipping

```bash
APP=src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.app
DMG=src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.dmg

codesign --verify --deep --strict "$APP"
xcrun stapler validate "$APP"
spctl -a -vvv -t install "$DMG"
```

Expected: `accepted` / `source=Notarized Developer ID`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `codesign: resource fork, Finder information, or similar detritus not allowed` | `xattr -cr Quack.app` (script runs this automatically) |
| Keychain password prompt mid-build | `security unlock-keychain ~/Library/Keychains/login.keychain-db` |
| `No Quack.app found` | Run build step first; check `src-tauri/target/*/bundle/macos/` |
| `target not found` (universal) | `rustup target add x86_64-apple-darwin aarch64-apple-darwin` |
| Notarization `Invalid` / unsigned nested code | Ensure you used `build:mac:release`, not plain `tauri build` |
| DMG mounts but app still blocked | `xcrun stapler validate Quack.app` — staple must succeed |
| `create-dmg` fails with exit 2 | Often non-fatal (volume icon); check DMG exists anyway |

## CI vs local

`.github/workflows/release.yml` builds macOS artifacts **unsigned** (PKCS12 secret issue documented
in the workflow). For Gatekeeper-clean distribution, build locally with `.env` until CI secrets
are regenerated.

## Security

- `.env` is in `.gitignore` — never commit Apple credentials.
- Prefer Keychain profile over plaintext `APPLE_PASSWORD` in `.env`.
- Rotate app-specific passwords if `.env` is ever exposed.
