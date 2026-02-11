---
type: pattern
project: quack-app
created: 2026-02-11
tags: [macos, build, release, signing, notarization, tauri, apple]
---

# macOS Release Signing & Notarization System

Sistema completo per build, firma e notarizzazione delle release macOS di Quack, con gestione sicura delle credenziali tramite Keychain.

## Architettura

```
npm run tauri:build:release
  ↓
1. Build .app (solo target app, no DMG)
  ↓
2. sign-and-notarize.sh
  ↓
3. Firma tutti i binari (ripgrep, sharp, libvips, .dylib, .node)
  ↓
4. Notarizza .app con Apple
  ↓
5. Crea DMG con .app notarizzato
  ↓
6. Firma e notarizza DMG
  ↓
7. Deliverable finale: DMG notarizzato
```

## Script e Comandi

### Build di Sviluppo (Solo Firma)

```bash
npm run tauri:build
```

- Builda con `--bundles dmg` (crea sia .app che DMG)
- Firma solo il binario principale (non embedded binaries)
- **Non notarizza** (Tauri skippa perché `APPLE_ID`/`APPLE_PASSWORD` non sono nel env)
- Risultato: DMG firmato ma non notarizzato (`source=Unnotarized Developer ID`)

### Build di Release (Firma + Notarizzazione Completa)

```bash
npm run tauri:build:release
```

- Builda con `--bundles app` (solo .app, DMG creato dopo)
- Script `sign-and-notarize.sh` esegue 7 step:
  1. Rimuove JetBrains plugin (JAR non firmabili)
  2. Firma tutti i binari in parallelo (ripgrep, sharp, libvips, .dylib, .node, Mach-O)
  3. Verifica firma
  4. Notarizza .app + staple ticket
  5. Crea DMG con .app notarizzato (usa `create-dmg` se disponibile)
  6. Firma DMG + notarizza DMG + staple ticket
  7. Verifica finale (`source=Notarized Developer ID`)

### Build Universal (arm64 + x86_64)

```bash
npm run tauri:build:release:universal
```

Come sopra ma con `--target universal-apple-darwin`.

## Configurazione `.env`

```bash
# Apple Code Signing & Notarization
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
APPLE_KEYCHAIN_PROFILE="QuackNotarization"
```

### Keychain Setup (One-Time)

Le credenziali sensibili (`APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`) **non vanno nel `.env`** - vivono nel macOS Keychain:

```bash
xcrun notarytool store-credentials "QuackNotarization" \
  --apple-id "your@email.com" \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --team-id "XXXXXXXXXX"
```

Questo crea un profilo nel Keychain accessibile a `notarytool` senza esporre password in plaintext.

## Script Helper: `load-signing-env.sh`

Carica **solo** `APPLE_SIGNING_IDENTITY` dal `.env` (per Tauri build), **non** le credenziali di notarizzazione.

```bash
#!/bin/bash
# Load only APPLE_SIGNING_IDENTITY from .env for Tauri build.
# We intentionally DO NOT export APPLE_ID/APPLE_PASSWORD/APPLE_TEAM_ID
# because Tauri would attempt automatic notarization, which fails.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"

if [ -f "$ENV_FILE" ]; then
    IDENTITY=$(grep 'APPLE_SIGNING_IDENTITY=' "$ENV_FILE" | sed 's/^export //' | cut -d= -f2- | sed 's/^"//;s/"$//')
    if [ -n "$IDENTITY" ]; then
        export APPLE_SIGNING_IDENTITY="$IDENTITY"
    fi
fi
```

**Perché separare**: se Tauri vedesse `APPLE_ID`/`APPLE_PASSWORD` tenta la notarizzazione automatica prima di firmare i binari embedded → fallisce.

## Gotchas e Soluzioni

### 1. Process Substitution Rompe Parsing Quote

**Problema**: `source <(grep | sed)` non gestisce correttamente apostrofi nelle stringhe del `.env`.

```bash
# Questo fallisce se la variabile contiene apostrofi
source <(grep -v '^\s*#' .env | sed 's/^export //')
```

**Soluzione**: `source` diretto del file.

```bash
# Questo gestisce correttamente le quote
set -a
source "$PROJECT_ROOT/.env"
set +a
```

### 2. Tauri Cancella il .app Dopo Aver Creato il DMG

**Problema**: il comando `cargo tauri build` con target `dmg` crea il DMG e poi **cancella** il `.app` → `sign-and-notarize.sh` non trova nulla.

**Soluzione**: per le release, buildare con `--bundles app` (solo .app, no DMG). Il DMG lo crea `sign-and-notarize.sh` dopo la notarizzazione.

```json
// package.json
"tauri:build:release": "source ./scripts/load-signing-env.sh && npm run build:secure && cargo tauri build --bundles app && ./scripts/sign-and-notarize.sh"
```

### 3. Tauri Firma Solo il Binario Principale

**Problema**: Tauri firma `Quack.app/Contents/MacOS/app` ma ignora i binari third-party embedded:
- `ripgrep` (rg, ripgrep.node)
- `sharp` (sharp-darwin-arm64.node, libvips-cpp.42.dylib)
- Altri .dylib e .node nel bundle

**Soluzione**: `sign-and-notarize.sh` firma **tutti** i binari in parallelo con `find` + `codesign`:

```bash
# Firma tutti i binari embedded
find "$APP_PATH" -type f -name "*.dylib" >> "$BINARIES_LIST"
find "$APP_PATH" -type f -name "*.node" >> "$BINARIES_LIST"
find "$APP_PATH" -path "*ripgrep*" -type f -name "rg" >> "$BINARIES_LIST"

# Firma in parallelo (8 job)
while IFS= read -r file; do
    codesign --force --options runtime --timestamp --sign "$SIGNING_IDENTITY" "$file" &
done < "$BINARIES_LIST"
wait
```

### 4. JetBrains Plugin Contiene JAR Non Firmabili

**Problema**: il plugin `claude-code-jetbrains-plugin` nel vendor dell'SDK contiene JAR con native libraries (jansi) che causano rejection da Apple.

**Soluzione**: rimuovere l'intero plugin prima della firma.

```bash
JETBRAINS_PATH="$APP_PATH/Contents/Resources/node-sdk/node_modules/@anthropic-ai/claude-agent-sdk/vendor/claude-code-jetbrains-plugin"
rm -rf "$JETBRAINS_PATH"
```

## Workflow Completo

```
Developer
   ↓
1. Modifica .env (setup identità + keychain profile)
   ↓
2. Setup keychain (one-time)
   ↓
3. npm run tauri:build:release
   ↓
4. Tauri builda .app (firma solo main binary)
   ↓
5. sign-and-notarize.sh
   ├─ Rimuove JetBrains plugin
   ├─ Firma tutti i binari (parallelo)
   ├─ Notarizza .app
   ├─ Crea DMG
   ├─ Firma DMG
   ├─ Notarizza DMG
   └─ Verifica: source=Notarized Developer ID
   ↓
Deliverable: Quack.dmg (notarizzato, pronto per distribuzione)
```

## File Coinvolti

| File | Scopo |
|------|-------|
| `.env` | `APPLE_SIGNING_IDENTITY`, `APPLE_KEYCHAIN_PROFILE` |
| `.env.example` | Template con istruzioni per setup keychain |
| `package.json` | Comandi `tauri:build:release`, `tauri:build:release:universal` |
| `scripts/load-signing-env.sh` | Carica solo signing identity (non notarization) |
| `scripts/sign-and-notarize.sh` | Pipeline completa firma + notarizzazione .app e DMG |
| `scripts/release-macos.sh` | Release completa universal binary con DMG branded |
| `src-tauri/tauri.conf.json` | `"signingIdentity": null` (usa env var) |

## Verifiche

### Verifica Firma

```bash
codesign --verify --deep --strict Quack.app
spctl -a -vvv -t install Quack.app
```

Output atteso: `source=Notarized Developer ID`

### Verifica DMG

```bash
spctl -a -vvv -t install Quack.dmg
```

Output atteso: `source=Notarized Developer ID`

### Verifica Binari Embedded

```bash
codesign --verify --deep --strict Quack.app/Contents/Resources/node-sdk/node_modules/@anthropic-ai/claude-agent-sdk/vendor/ripgrep/arm64-darwin/rg
```

Deve passare senza errori (firmato con hardened runtime).

## Principi di Sicurezza

1. **Keychain > .env**: credenziali Apple vivono nel Keychain, non in plaintext
2. **Separation of Concerns**: signing identity per build, keychain profile per notarizzazione
3. **No Secrets in Git**: `.env` in `.gitignore`, `.env.example` contiene solo template
4. **Least Privilege**: `load-signing-env.sh` esporta solo la variabile necessaria per Tauri

## Discovery

**Data**: 2026-02-11

**Problema originale**: script di release avevano paths e identità hardcoded (path assoluti e signing identity del developer originale), rendendo impossibile la build per altri developer.

**Soluzione**: refactoring completo per usare `.env` + Keychain, con auto-detection dinamica dei path e separazione chiara tra build-time e notarization-time credentials.

**Trigger**: refactor richiesto per supportare cambio developer certificate.
