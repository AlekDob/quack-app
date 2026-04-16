# Implementation Tasks: Smart Auto-Update

## Phase 1: Chiavi e configurazione

- [ ] 1.1 Verificare/generare coppia chiavi Ed25519
  - Verificare se la private key nei GitHub secrets corrisponde a una pubkey valida
  - Se non esiste: `npx tauri signer generate -w ~/.tauri/quack.key`
  - Inserire la pubkey in `src-tauri/tauri.conf.json` → `plugins.updater.pubkey`
  - Rimuovere `"dialog": true` dal config updater
  - Backup sicuro della private key
  - **Depends on**: None
  - **Requirement**: R5.5

- [ ] 1.2 [P] Verificare i bundle generati dalla build attuale
  - Controllare se `npm run tauri build` produce gia' `.app.tar.gz` nella directory bundle
  - Controllare se produce gia' `.nsis.zip` su Windows
  - Se si': basta firmarli. Se no: aggiungere step di compressione
  - **Depends on**: None
  - **Requirement**: R5.1, R5.2

## Phase 2: Script di release

- [ ] 2.1 Creare `scripts/release-updater.sh`
  - Parametri: `--version`, `--app-path` (Mac), `--nsis-path` (Windows, opzionale)
  - Genera `Quack.app.tar.gz` dal bundle .app se non esiste gia'
  - Firma con `tauri signer sign` usando la private key locale
  - Genera `latest.json` nel formato Tauri updater (version, notes, pub_date, platforms)
  - Changelog: prende dal git log (riusa logica di `release.sh`)
  - Se `--nsis-path` fornito: firma anche il bundle Windows e aggiunge al latest.json
  - Output: directory con tutti gli artefatti pronti per l'upload
  - **Depends on**: 1.1, 1.2
  - **Requirement**: R5.3, R5.4, R5.5

- [ ] 2.2 Estendere `scripts/release.sh`
  - Dopo la conferma utente, chiamare `release-updater.sh` per generare artefatti
  - Aggiungere upload di: `.app.tar.gz`, `.sig`, `latest.json` alla release GitHub
  - Se presente l'exe Windows: aggiungere anche `.nsis.zip` + `.sig`
  - Mantenere retrocompatibilita' (DMG resta l'artefatto principale per download manuale)
  - **Depends on**: 2.1
  - **Requirement**: R5.3, R5.4

- [ ] 2.3 [P] Aggiornare skill `quack-release`
  - Integrare la generazione artefatti updater nel flusso della skill
  - Opzione per aggiungere Windows alla release esistente (Antonio passa l'exe dopo)
  - **Depends on**: 2.1
  - **Requirement**: R5.3

## Phase 3: Frontend — Tauri Updater + UX

- [ ] 3.1 Creare `src/hooks/useAutoUpdater.ts`
  - Import `check` da `@tauri-apps/plugin-updater`
  - `checkForUpdate()`: ritorna `{ available, version, notes, date }` o null
  - `downloadUpdate(onProgress)`: scarica con callback progress (0-100%)
  - `installAndRelaunch()`: chiude e installa
  - `scheduleInstallOnRestart()`: flag per install al prossimo restart
  - Gestione errori: timeout, rete, firma invalida — messaggi user-friendly
  - Retry: max 2 tentativi con backoff (2s, 5s)
  - **Depends on**: 1.1 (pubkey nel config)
  - **Requirement**: R1, R4

- [ ] 3.2 Aggiornare `src/hooks/useUpdateChecker.ts`
  - Sostituire fetch GitHub API con `useAutoUpdater.checkForUpdate()`
  - Mantenere logica cache/rate-limit (1 check/ora)
  - Esporre `notes` per il changelog
  - Mantenere `checkForUpdates(force)` per check manuale (bypass cache)
  - **Depends on**: 3.1
  - **Requirement**: R2

- [ ] 3.3 Aggiornare `src/components/UpdateToast.tsx`
  - Aggiungere stati: `idle` | `downloading` | `ready` | `error`
  - `idle`: versione + changelog preview (3 righe) + "Aggiorna" / "Piu' tardi"
  - `downloading`: progress bar animata con percentuale
  - `ready`: "Riavvia ora" / "Piu' tardi"
  - `error`: messaggio + "Riprova" + "Scarica manualmente" (fallback GitHub)
  - "Piu' tardi" dopo download completato → `scheduleInstallOnRestart()`
  - **Depends on**: 3.1, 3.2
  - **Requirement**: R1, R3, R4

- [ ] 3.4 [P] Aggiornare `src/components/settings/categories/AboutSettings.tsx`
  - "Cerca aggiornamenti" usa `useAutoUpdater.checkForUpdate()`
  - Se disponibile: versione + changelog + "Aggiorna" con progress bar
  - Se aggiornato: "Sei aggiornato alla versione X.Y.Z"
  - **Depends on**: 3.1, 3.2
  - **Requirement**: R2

- [ ] 3.5 Aggiornare `src/components/UpdateToast.css`
  - Stili per progress bar (animazione, colore accent)
  - Stili per stato errore
  - Stili per stato ready (success)
  - Mantenere glassmorphism
  - **Depends on**: 3.3
  - **Requirement**: R1

## Phase 4: Cleanup e validazione

- [ ] 4.1 Deprecare parti non necessarie di `githubReleases.ts`
  - Mantenere solo `getLatestReleaseUrl()` per fallback "Scarica manualmente"
  - Rimuovere logica di check versione (ora in useAutoUpdater)
  - **Depends on**: 3.3, 3.4
  - **Requirement**: R4

- [ ] 4.2 Test end-to-end
  - Generare artefatti di test con `release-updater.sh`
  - Pubblicare release di test su quack-releases
  - Mac: check → toast → download → verifica firma → install → restart
  - Windows: stesso flusso (coordinare con Antonio)
  - Test errori: rete down, firma invalida, latest.json malformato
  - **Depends on**: 2.2, 3.3, 3.4
  - **Requirement**: All

- [ ] 4.3 Documentazione
  - Diary entry
  - Feature doc (creare o aggiornare)
  - Istruzioni per Antonio sul flusso Windows
  - **Depends on**: 4.2
  - **Requirement**: N/A

## Notes

- `[P]` indica task parallelizzabili
- Phase 1 e' bloccante — senza chiavi valide niente funziona
- Windows puo' essere aggiunto incrementalmente (prima solo Mac, poi Windows)
- Il fallback "Scarica manualmente" (link GitHub) resta SEMPRE disponibile
- La firma Ed25519 Tauri e' DIVERSA dalla firma Apple — servono entrambe
