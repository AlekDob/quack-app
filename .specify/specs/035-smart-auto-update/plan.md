# Implementation Plan: Smart Auto-Update

## Analisi dello stato attuale

### Flusso di release attuale (manuale)
1. Alek builda Mac localmente: `release-macos.sh` → sign + notarize + DMG
2. Antonio builda Windows, passa l'exe
3. Upload via `release.sh` o skill `quack-release` → `gh release create` su `AlekDob/quack-releases`
4. Il CI (`production-release.yml`) esiste ma e' un flusso alternativo, non il principale

### Cosa c'e' gia'
- `tauri-plugin-updater v2` in Cargo.toml e inizializzato in `lib.rs`
- `TAURI_PRIVATE_KEY` e `TAURI_KEY_PASSWORD` nei GitHub secrets (da verificare)
- Endpoint configurato: `https://github.com/AlekDob/quack-releases/releases/latest/download/latest.json`
- Frontend: `useUpdateChecker.ts` + `UpdateToast.tsx` + `AboutSettings.tsx` (notifica solo)

### Cosa manca
1. **Pubkey vuota** in `tauri.conf.json`
2. **Niente `.app.tar.gz`** — il release-macos.sh produce solo .dmg (il .dmg non e' usabile dall'updater Tauri)
3. **Niente `latest.json`** — il manifest non viene generato ne' uploadato
4. **Niente firma Tauri** — i bundle non sono firmati con la chiave Ed25519 dell'updater (diversa dalla firma Apple)
5. **Nessuna invocazione dell'updater** nel frontend
6. **Windows**: niente `.nsis.zip` firmato

## Cosa serve per il Tauri Updater

Il plugin Tauri updater richiede per ogni piattaforma:

| Piattaforma | Artefatto | Descrizione |
|-------------|-----------|-------------|
| macOS | `Quack.app.tar.gz` | L'app compressa (non il .dmg!) |
| macOS | `Quack.app.tar.gz.sig` | Firma Ed25519 dell'artefatto |
| Windows | `Quack_x.y.z_x64-setup.nsis.zip` | L'installer NSIS zippato |
| Windows | `Quack_x.y.z_x64-setup.nsis.zip.sig` | Firma Ed25519 |
| Entrambi | `latest.json` | Manifest con versione, URL, firma, note |

### Formato `latest.json`
```json
{
  "version": "0.9.3",
  "notes": "### New Features\n- ...\n### Bug Fixes\n- ...",
  "pub_date": "2026-04-10T12:00:00Z",
  "platforms": {
    "darwin-universal": {
      "signature": "base64-encoded-sig",
      "url": "https://github.com/AlekDob/quack-releases/releases/download/v0.9.3/Quack.app.tar.gz"
    },
    "windows-x86_64": {
      "signature": "base64-encoded-sig",
      "url": "https://github.com/AlekDob/quack-releases/releases/download/v0.9.3/Quack_0.9.3_x64-setup.nsis.zip"
    }
  }
}
```

## Architettura della soluzione

### Approccio: estendere il flusso manuale esistente

Non tocchiamo il CI. Estendiamo `release.sh` (e/o la skill `quack-release`) per generare gli artefatti extra necessari all'updater.

```
FLUSSO RELEASE AGGIORNATO
==========================

1. Alek: release-macos.sh (come oggi)
   └─► .app firmata Apple + DMG notarizzato

2. NUOVO: release-updater.sh
   ├─► tar.gz dell'app: tar czf Quack.app.tar.gz Quack.app
   ├─► firma Ed25519: tauri signer sign Quack.app.tar.gz
   └─► genera .sig file

3. Antonio: passa l'exe + .nsis.zip (o lo generiamo noi dalla build)
   └─► firma Ed25519: tauri signer sign *.nsis.zip

4. NUOVO: genera latest.json con URL, firme, note

5. release.sh (esteso)
   └─► gh release create con:
       - Quack.dmg (download manuale Mac)
       - Quack.app.tar.gz + .sig (auto-update Mac)
       - Quack_setup.nsis.zip + .sig (auto-update Windows)  
       - latest.json (manifest updater)

FRONTEND
========
App avvia → check latest.json (ogni ora) → confronta versione
→ toast con changelog + "Aggiorna"
→ download .tar.gz/.nsis.zip in background (progress bar)
→ verifica firma Ed25519
→ "Riavvia ora?" → installAndRelaunch()
```

## Piano d'azione — 4 fasi

### Fase 1: Chiavi e configurazione

1. **Verificare/generare coppia di chiavi Ed25519**
   - `npx tauri signer generate -w ~/.tauri/quack.key`
   - Mettere la pubkey in `tauri.conf.json` → `plugins.updater.pubkey`
   - Salvare la private key in un posto sicuro (e nei GitHub secrets se servira')
   - Rimuovere `"dialog": true` dal config (gestiamo noi la UI)

2. **Dare la private key anche ad Antonio** per firmare i bundle Windows

### Fase 2: Script di release (estensione)

1. **Creare `scripts/release-updater.sh`** (nuovo):
   - Input: path al `.app` (Mac) e/o `.nsis.zip` (Windows)
   - Genera `Quack.app.tar.gz` dal `.app` bundle
   - Firma con `tauri signer sign` → produce `.sig`
   - Genera `latest.json` con versione, note, URL e firme per ogni piattaforma
   - Opzione `--mac-only` / `--windows-only` per build parziale
   - Opzione `--add-windows` per aggiungere Windows a un latest.json esistente

2. **Estendere `release.sh`**:
   - Dopo la creazione della release, uploadare anche `.tar.gz`, `.sig`, `latest.json`
   - O integrare la logica direttamente
   - Aggiungere upload dell'exe Windows se presente

3. **Aggiornare la skill `quack-release`**:
   - Integrare la generazione di `.tar.gz` + `.sig` + `latest.json` nel flusso

### Fase 3: Frontend — Tauri Updater

1. **`src/hooks/useAutoUpdater.ts`** (nuovo):
   - Wrappa `@tauri-apps/plugin-updater`
   - `checkForUpdate()` → fetch `latest.json`, confronta versione
   - `downloadUpdate(onProgress)` → scarica con callback progress (0-100%)
   - `installAndRelaunch()` → chiude e installa
   - Gestione errori con retry (max 2, backoff)

2. **`src/hooks/useUpdateChecker.ts`** (modifica):
   - Usa `useAutoUpdater` invece del fetch diretto a GitHub API
   - Mantiene cache/rate-limit

3. **`src/components/UpdateToast.tsx`** (modifica):
   - Stati: `idle` → `downloading` → `ready` → `error`
   - Progress bar durante download
   - "Riavvia ora" / "Piu' tardi" al completamento
   - Fallback "Scarica manualmente"

4. **`src/components/settings/categories/AboutSettings.tsx`** (modifica):
   - Download in-app con stessa UX del toast

### Fase 4: Test e validazione

1. Release di prova su quack-releases
2. Test Mac: check → download → install → restart
3. Test Windows: idem
4. Test fallback: rete che cade, firma invalida
5. Documentazione

## Flusso per Antonio (Windows)

Antonio deve:
1. Buildare con `npm run tauri build`
2. Il bundle NSIS e' in `src-tauri/target/release/bundle/nsis/`
3. Passare ad Alek il file `.nsis.zip` (o l'exe + noi zippiamo)
4. Alek firma con `tauri signer sign` e genera il `latest.json` con entrambe le piattaforme

Alternativa: dare ad Antonio la private key e uno script per firmare + generare la sua parte del `latest.json`.

## File impattati

### Nuovi
- `scripts/release-updater.sh` — genera tar.gz + sig + latest.json
- `src/hooks/useAutoUpdater.ts` — hook React per Tauri updater

### Modificati
- `src-tauri/tauri.conf.json` — pubkey, rimuovere dialog
- `scripts/release.sh` — upload artefatti aggiuntivi
- `src/hooks/useUpdateChecker.ts` — usa Tauri updater
- `src/components/UpdateToast.tsx` + `.css` — stati, progress bar
- `src/components/settings/categories/AboutSettings.tsx` — download in-app

### Non toccati
- `.github/workflows/` — nessuna modifica al CI
- `scripts/release-macos.sh` — resta com'e'

## Rischi e mitigazioni

| Rischio | Mitigazione |
|---------|-------------|
| Private key persa | Backup sicuro, rigenerabile |
| Antonio non firma | Alek firma tutto, Antonio passa solo il bundle raw |
| .app.tar.gz non notarizzato | L'updater Tauri estrae e sovrascrive, la notarizzazione Apple e' sulla .app originale, non serve sul tar.gz |
| latest.json con URL sbagliato | Lo script lo genera dai parametri della release |
| Windows .nsis.zip non disponibile | latest.json supporta anche singola piattaforma, Windows si aggiunge dopo |
