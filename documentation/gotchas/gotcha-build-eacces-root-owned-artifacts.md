---
type: gotcha
project: quack-app
created: 2026-05-12
last_verified: 2026-05-12
tags: [build, permissions, tauri, vite, cargo, sudo, eacces, macos]
---

# Gotcha: Build EACCES su `dist/` o `src-tauri/target/` (file owned da root)

## Symptom

`npm run build` o `npm run tauri build` fallisce con `Permission denied (os error 13)` / `EACCES: permission denied` su file dentro:

- `dist/assets/*.js.gz` (errore Vite, fase `beforeBuildCommand`)
- `src-tauri/target/release/build/<crate>/build-script-build` (errore Cargo)
- altri file generati da build precedenti

Esempi di errore:
```
Error: EACCES: permission denied, open '/.../dist/assets/KanbanPopoutView-...js.gz'
```
```
error: failed to remove file `/.../src-tauri/target/release/build/libsqlite3-sys-.../build-script-build`
Caused by: Permission denied (os error 13)
```

## Root Cause

Una build precedente è stata lanciata con **`sudo`** (es. `sudo npm run tauri build`), e ha lasciato gli artefatti in `dist/` e `src-tauri/target/` con ownership `root:staff` invece di `<user>:staff`. Le build successive lanciate senza sudo non riescono a sovrascriverli.

Verifica:
```bash
ls -la dist/
# se vedi righe tipo:  drwxr-xr-x  ... root staff ...  assets
# l'ownership è il problema

ls -la src-tauri/target/release/build/<crate>/
# stesso check
```

## Fix (consigliato: conservativo — preserva la cache di build)

Cambia ownership di tutto l'albero ai file generati:

```bash
sudo chown -R $USER:staff dist/ src-tauri/target/
npm run tauri build
```

Vantaggi:
- **Veloce**: nessuna ricompilazione, cache Cargo intatta.
- **Sicuro**: tocca solo i metadata dei file, non i contenuti.
- **Build successive normali**: 1-2 min invece di 10-20.

## Fix (drastico — solo se chown non basta)

Se anche dopo `chown` qualcosa va storto (raro, ma possibile se la cache è corrotta o ci sono altri attributi estesi):

```bash
sudo rm -rf dist/ src-tauri/target/
npm run tauri build
```

Costo: **prima build successiva 10-20 min** perché Rust ricompila tutte le deps da zero.

## Pulizia preventiva — cerca altri residui root

Per essere sicuri di non avere altri residui di vecchie build con sudo:

```bash
find . -user root 2>/dev/null
```

Se trova file in `node_modules/`, `src-tauri/gen/` o altrove, ripeti il `chown -R` su quelle directory specifiche.

## Prevention

**Non lanciare MAI con sudo:**
- `sudo npm run build`
- `sudo npm run tauri build`
- `sudo cargo build`
- `sudo npm install`

Su macOS non servono mai. Se Tauri/Cargo si lamentano di qualcosa che sembra richiedere root (firma codice, notarization, permessi keychain), il problema è diverso e si risolve in altro modo (config, entitlement, password keychain), non con sudo.

## Decision tree veloce (per il prossimo che incontra l'errore)

1. Errore `EACCES` / `Permission denied` durante build?
2. → `ls -la dist/` e `ls -la src-tauri/target/release/build/<crate>/`
3. → Se vedi `root staff` → `sudo chown -R $USER:staff dist/ src-tauri/target/`
4. → Rilancia `npm run tauri build`
5. → Se ancora fallisce, allora `sudo rm -rf dist/ src-tauri/target/` + rebuild

Tempo totale fix corretto: ~10 secondi. Fix drastico: ~15 min di ricompilazione.
