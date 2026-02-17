---
type: pattern
created: 2026-02-11
tags: [macos, build, release, signing, notarization, tauri, apple]
---

# macOS Release Signing & Notarization System

Sistema completo per build, firma e notarizzazione delle release macOS di Quack, con gestione sicura delle credenziali tramite Keychain.

## Architettura

```
npm run tauri:build:release
  -> 1. Build .app (solo target app, no DMG)
  -> 2. sign-and-notarize.sh
  -> 3. Firma tutti i binari (ripgrep, sharp, libvips, .dylib, .node)
  -> 4. Notarizza .app con Apple
  -> 5. Crea DMG con .app notarizzato
  -> 6. Firma e notarizza DMG
  -> 7. Deliverable finale: DMG notarizzato
```

## Script e Comandi

- **Dev build** (`npm run tauri:build`): Firma solo binario principale, non notarizza
- **Release build** (`npm run tauri:build:release`): Firma + notarizzazione completa via `sign-and-notarize.sh`
- **Universal** (`npm run tauri:build:release:universal`): arm64 + x86_64

## Configurazione

- `.env`: `APPLE_SIGNING_IDENTITY`, `APPLE_KEYCHAIN_PROFILE`
- Keychain setup (one-time): `xcrun notarytool store-credentials "QuackNotarization"`
- `load-signing-env.sh`: Loads only APPLE_SIGNING_IDENTITY (intentionally NOT notarization creds)

## Gotchas

1. **Process substitution breaks quote parsing** - Use `source` directly instead of `source <(grep)`
2. **Tauri deletes .app after DMG** - Build with `--bundles app`, create DMG manually after notarization
3. **Tauri signs only main binary** - `sign-and-notarize.sh` signs ALL embedded binaries in parallel
4. **JetBrains plugin contains unsigned JARs** - Remove before signing

## Principi di Sicurezza

1. Keychain > .env for Apple credentials
2. Separation of signing identity vs notarization profile
3. No secrets in Git
4. Least privilege: `load-signing-env.sh` exports only what Tauri needs

## File Coinvolti

| File | Scopo |
|------|-------|
| `.env` | Signing identity, keychain profile |
| `scripts/load-signing-env.sh` | Loads only signing identity |
| `scripts/sign-and-notarize.sh` | Full signing + notarization pipeline |
| `scripts/release-macos.sh` | Universal binary release |
