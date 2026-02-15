# 🦆 Quack App - Build Guide

Guida completa per compilare Quack App su diverse architetture Mac.

## 📋 Prerequisiti

### Setup Iniziale (una tantum)

Per compilare per Mac Intel da Mac Silicon (o viceversa), installa i target Rust:

```bash
# Per compilare binari Intel (x86_64)
rustup target add x86_64-apple-darwin

# Per compilare binari Universal (opzionale)
rustup target add universal-apple-darwin
```

### Dipendenze

Assicurati di avere installato:
- Node.js (v18+)
- Rust (latest stable)
- Cargo
- npm

---

## 🚀 Comandi di Build

### 1. Build Standard (architettura corrente)

Compila per l'architettura del Mac che stai usando:

```bash
npm run tauri:build
```

**Quando usarlo:**
- Sviluppo locale
- Testing sulla tua macchina
- Build veloce

**Output:**
- Su Mac M1/M2/M3: binario Apple Silicon (aarch64)
- Su Mac Intel: binario Intel (x86_64)
- Dimensione: ~98MB (.dmg), ~123MB (.app)
- **Ottimizzato automaticamente** dopo il build

**Percorso output:**
```
src-tauri/target/release/bundle/
```

---

### 2. Build Intel Only ⭐

Compila **solo per Mac Intel** (x86_64):

```bash
npm run tauri:build:intel
```

**Quando usarlo:**
- Per Mac Intel (2017-2020)
- Per iMac, MacBook Pro, Mac Mini pre-2020
- Build più piccola e veloce rispetto a Universal

**Requisiti:**
- `rustup target add x86_64-apple-darwin`

**Output:**
- Binario Intel puro
- Dimensione: ~98MB (.dmg), ~126MB (.app)
- **Ottimizzato automaticamente** dopo il build
- Compatibile con: macOS 10.13+ su Intel

**Percorso output:**
```
src-tauri/target/x86_64-apple-darwin/release/bundle/
```

---

### 3. Build Universal (Intel + Silicon)

Compila per **entrambe** le architetture:

```bash
npm run tauri:build:universal
```

**Quando usarlo:**
- Distribuzione pubblica
- Supporto completo per tutti i Mac
- Una sola build per tutti

**Requisiti:**
- `rustup target add x86_64-apple-darwin`
- `rustup target add universal-apple-darwin`

**Output:**
- Universal Binary (fat binary)
- Dimensione: ~180-200MB (.dmg), ~250MB (.app)
- **Ottimizzato automaticamente** dopo il build
- Compatibile con: Tutti i Mac (Intel + Silicon)

**Percorso output:**
```
src-tauri/target/universal-apple-darwin/release/bundle/
```

---

## 🛠️ Build per Sviluppo

### Build Debug (più veloce, file più grandi)

```bash
npm run tauri:build:debug
```

- Non ottimizzato
- Include simboli di debug
- Compila molto più velocemente
- File ~3x più grandi

---

## 📊 Analisi e Testing

### Build con Analisi Bundle

```bash
npm run build:analyze
```

Genera `dist/stats.html` con analisi del bundle JavaScript.

### Build Solo Frontend

```bash
npm run build:secure
```

Compila solo il frontend Vite (senza Tauri).

---

## 🐛 Troubleshooting

### Errore: "target not found"

Se ricevi errori tipo `target 'x86_64-apple-darwin' not found`:

```bash
rustup target add x86_64-apple-darwin
```

### Build Lento

Per velocizzare i build successivi:

```bash
# Usa build incrementali (già configurato in Cargo.toml)
# Oppure usa build debug per testing:
npm run tauri:build:debug
```

### Pulizia Cache

Se hai problemi strani, pulisci tutto:

```bash
# Pulisci solo dist e cache Vite
npm run clean

# Pulisci tutto (incluso target Rust)
npm run clean:all
```

---

## 📦 Distribuzione

### Per Mac Silicon (M1/M2/M3)

```bash
npm run tauri:build
# Output: src-tauri/target/release/bundle/macos/Quack.app
```

### Per Mac Intel (2017-2020)

```bash
npm run tauri:build:intel
# Output: src-tauri/target/x86_64-apple-darwin/release/bundle/macos/Quack.app
```

### Per Tutti i Mac (Universal)

```bash
npm run tauri:build:universal
# Output: src-tauri/target/universal-apple-darwin/release/bundle/macos/Quack.app
```

---

## ⚡ Comparazione Velocità e Dimensioni

| Build Type | Tempo | Dimensione .dmg | Dimensione .app | Compatibilità |
|-----------|-------|----------------|----------------|---------------|
| Standard | ~5-8 min | ~98 MB | ~123 MB | Solo architettura corrente |
| Intel | ~5-8 min | ~98 MB | ~126 MB | Solo Intel |
| Universal | ~10-15 min | ~180-200 MB | ~250 MB | Intel + Silicon |
| Debug | ~2-3 min | N/A | ~300 MB | Solo per testing |

**Note:**
- Tutte le dimensioni sono **dopo l'ottimizzazione automatica**
- Senza ottimizzazione, i file sarebbero ~2.5x più grandi
- L'ottimizzazione rimuove automaticamente file non necessari (ripgrep per altre piattaforme, immagini duplicate, source maps)

---

## 🦆 Ottimizzazione Automatica del Bundle

**Tutti i comandi di build eseguono automaticamente l'ottimizzazione del bundle!**

Lo script `scripts/optimize-bundle.sh` viene eseguito dopo ogni build per ridurre drasticamente la dimensione dell'app rimuovendo:

1. **Ripgrep binaries per altre piattaforme** (~43MB):
   - Rimuove Windows, Linux, altre architetture
   - Mantiene solo la versione per la piattaforma target

2. **Plugin JetBrains** (~12MB):
   - Non necessario per un'app desktop Tauri

3. **Immagini duplicate** (~22MB):
   - Rimuove duplicati nelle cartelle di risorse

4. **Source maps** (~10MB):
   - File .map non necessari in produzione

**Risparmio totale: ~97MB per build!**

### Disabilitare l'ottimizzazione

Se vuoi compilare senza ottimizzazione (per debug):

```bash
# Build senza ottimizzazione automatica
npm run build:secure && cargo tauri build --target x86_64-apple-darwin
# (senza eseguire ./scripts/optimize-bundle.sh)
```

### Ottimizzare manualmente

Puoi eseguire lo script manualmente su build esistenti:

```bash
npm run optimize-bundle
```

---

## 🔐 Build Sicuri (Produzione)

Tutte le build usano `build:secure` che include:
- Minificazione con esbuild
- Tree shaking
- Ottimizzazione Rust (`opt-level = "z"`)
- LTO (Link Time Optimization)
- Strip symbols
- Compressione Brotli
- **Ottimizzazione automatica del bundle** (nuovo!)

---

## 📝 Note

1. **Prima build**: La prima compilazione sarà lenta (~15-20 minuti) perché Rust compila tutte le dipendenze. Le successive saranno molto più veloci.

2. **Notarizzazione**: Per distribuire l'app pubblicamente su macOS, dovrai notarizzarla con Apple Developer Account.

3. **Firma Code**: L'app viene già firmata automaticamente durante il build se hai certificati Developer nel Keychain.

4. **Target Rust**: I target installati rimangono per sempre, non serve reinstallarli.

---

## 🦆 Quick Reference

```bash
# Setup iniziale (una tantum)
rustup target add x86_64-apple-darwin

# Build per tua macchina (veloce)
npm run tauri:build

# Build per Mac Intel (per iMac 2017)
npm run tauri:build:intel

# Build per tutti i Mac (distribuzione)
npm run tauri:build:universal
```

---

**Documentazione generata da Quack Agency 🦆**
