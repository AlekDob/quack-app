# Tasks: Anthropic-Compatible Custom Providers

**Feature**: 037-anthropic-compatible-providers
**Branch**: `037-anthropic-compatible-providers`
**Input**: spec.md, plan.md, research.md, data-model.md, contracts/, quickstart.md

---

## Phase 1: Setup

- [x] T001 Create directory `src/components/settings/categories/providers/` for new provider UI components
- [x] T002 Create directory `src/types/` entry if missing and add stub file `src/types/providers.ts`
- [x] T003 [P] Create empty service stubs: `src/services/providerService.ts`, `src/services/providerEnvBuilder.ts`
- [x] T004 [P] Create `src/constants/providerPresets.ts` empty export ready for presets

---

## Phase 2: Foundational (blocking)

These MUST complete before any user story phase — they define the type system, store schema, and migration that every story depends on.

- [x] T005 Define types in `src/types/providers.ts`: `ProviderKind`, `ProviderPreset`, `CustomProvider`, `ProviderEntry`, `ActiveProviderState`, `SessionProviderOverride`, `ClaudeSettingsV12` (per data-model.md)
- [x] T006 Populate `src/constants/providerPresets.ts` with the 6 built-in presets (Anthropic, Z.AI, MiniMax, Kimi, Qwen, DeepSeek) — URL + modelli + contextWindow + docsUrl da research.md R2
- [x] T007 Extend `ClaudeSettings` interface in `src/stores/settingsStore.ts` with `activeProvider: ActiveProviderState` and `customProviders: CustomProvider[]`
- [x] T008 Implement migration `v11 → v12` in `src/stores/settingsStore.ts` per data-model.md migration block. MUST preserve legacy `provider="Custom"` as `customProviders[0]` with id `legacy-custom`. MUST NOT touch OpenAI key storage.
- [ ] T009 [P] Unit test migration v11→v12 in `tests/unit/settingsStoreMigration.test.ts` — verify legacy Custom, legacy Anthropic, legacy Bedrock all map correctly
- [x] T010 Add Rust command `test_provider_connection` in `src-tauri/src/commands/providers.rs` per contracts/tauri-commands.md (reqwest POST /v1/messages, Authorization: Bearer, 5s timeout, returns TestConnectionResult)
- [x] T011 Register `test_provider_connection` in `src-tauri/src/main.rs` invoke_handler

**Checkpoint**: types + store + migration + Tauri test command compile e store apre senza errori. Le sessioni esistenti funzionano identiche a prima (default `activeProvider.kind="anthropic"`).

---

## Phase 3: User Story 1 — Usare GLM-4.6 via Z.AI Coding Plan (P1)

**Goal**: Utente con API key z.ai seleziona preset Z.AI in Settings, mette la key, e una sessione gira su GLM-4.6.

**Independent test**: vedi quickstart.md "User flow — usare GLM-4.6 via z.ai" + smoke test checkbox "Token usage modal mostra glm-4.6".

- [x] T012 [P] [US1] Implement `providerService.ts`: `listAllProviders()`, `getProviderById(id)`, `saveProviderToken(providerId, token)`, `getProviderToken(providerId)`, `testConnection(providerId)` — usa Tauri `save_api_key("provider:<id>", token)` namespaced
- [x] T013 [P] [US1] Implement `providerEnvBuilder.ts`: `buildProviderConfig(activeProvider, sessionOverride?) -> QuackProviderConfig | null` — risolve preset/custom in JSON env-ready (vedi contracts/sdk-env-contract.md)
- [x] T014 [US1] Create `src/components/settings/categories/providers/ProviderCard.tsx` — row con icona, nome, key field (password input), pulsante test, pulsante "Set as default"
- [x] T015 [US1] Create `src/components/settings/categories/providers/ProviderTestButton.tsx` — wrapper che chiama `providerService.testConnection`, spinner, mostra OK + latency + modelEcho oppure errore con status code
- [x] T016 [US1] Create `src/components/settings/categories/providers/ProviderManager.tsx` — radio "Anthropic / Bedrock / Anthropic-compatible", lista preset + custom, selettore default
- [x] T017 [US1] Modify `src/components/settings/categories/ClaudeCodeSettings.tsx` — sostituire la dropdown `LLMProviderType` con `<ProviderManager />`. Mantenere comportamento Ollama esistente intoccato.
- [x] T018 [US1] Modify Rust spawn logic (cerca dove si lancia `stream-claude.js` / `stream-daemon.js`, probabilmente `src-tauri/src/commands/claude_cli.rs` o simile): leggere `activeProvider` dal frontend state passato come arg, costruire `QUACK_PROVIDER_CONFIG` JSON, setarlo come env del child process SOLO se `kind="custom"`
- [~] T019 [US1] Modify `node-sdk-bridge/stream-claude.js`: aggiungere blocco di parsing `QUACK_PROVIDER_CONFIG` (vedi contracts/sdk-env-contract.md) prima del require SDK
- [x] T020 [P] [US1] Modify `node-sdk-bridge/stream-daemon.js`: stesso blocco di T019
- [ ] T021 [P] [US1] Unit test `providerEnvBuilder.test.ts`: anthropic → null, custom → JSON corretto, bedrock → null, session override vince su default
- [ ] T022 [US1] Verificare Token Usage modal e StaminaBar mostrino il modello reale (`response.model` dal SDK, già esposto in `chatTokensMap`). Aggiustare display se mostra ancora il nome canonico Anthropic.

**Checkpoint US1**: l'utente può settare Z.AI come default, fare un prompt, e il modello effettivo è `glm-4.6`. Smoke test E2E "Token usage modal mostra glm-4.6" passa.

---

## Phase 4: User Story 2 — Aggiungere provider custom (P1)

**Goal**: Power user crea un provider custom completo (non solo preset built-in).

**Independent test**: form "Aggiungi provider" → save → appare in lista → selezionabile come default → env iniettate correttamente.

- [x] T023 [US2] Create `src/components/settings/categories/providers/ProviderAddModal.tsx` — form con campi name, baseUrl, sonnetModel, haikuModel, defaultModel (optional), contextWindow (default 200000), notes. Validation: baseUrl regex `^https?://`, modelli non vuoti, contextWindow ≥ 4096.
- [x] T024 [US2] Extend `providerService.ts`: `addCustomProvider(provider)`, `updateCustomProvider(id, patch)`, `deleteCustomProvider(id)` — wired allo Zustand store
- [x] T025 [US2] Wire "+ Add provider" button in `ProviderManager.tsx` per aprire `ProviderAddModal`; gestire submit/cancel
- [x] T026 [US2] Implement "Duplica come custom" action su preset built-in: menu 3 puntini in `ProviderCard` (solo se `isBuiltIn`), clona campi in nuovo CustomProvider con suffisso "(Copy)"
- [x] T027 [US2] Edge case: deleting custom provider currently active → fallback `activeProvider.kind = "anthropic"`. Aggiungere in `deleteCustomProvider`.
- [ ] T028 [P] [US2] Unit test `providerService.test.ts`: add/update/delete custom, namespaced storage keys, fallback su delete-active

**Checkpoint US2**: l'utente aggiunge un provider custom (es. proxy aziendale), lo testa, lo seleziona, e funziona end-to-end.

---

## Phase 5: User Story 3 — Switch per-sessione (P2)

**Goal**: Selettore provider al momento dello spawn di una nuova sessione, override del default globale.

**Independent test**: due sessioni attive con provider diversi simultaneamente, ognuna mostra il suo badge e usa il suo modello.

- [x] T029 [US3] Estendere `sessionStore.ts` (o equivalente) con `session.providerOverride?: string` — NON persisted, vive in memory per la lifetime sessione
- [x] T030 [US3] Create `src/components/chat/NewSessionProviderPicker.tsx` — dropdown compatta sotto chat input nella vista "new session" mostra default + lista provider disponibili
- [x] T031 [US3] Wire `NewSessionProviderPicker` in la new-session flow (cerca componente che renderizza l'input quando una sessione viene creata)
- [x] T032 [US3] Update spawn logic (T018): leggere `session.providerOverride` PRIMA del default globale; passare a `buildProviderConfig`
- [x] T033 [US3] Create `src/components/chat/SessionProviderBadge.tsx` — badge piccolo nel session header con `<icon> <provider name> · <model>`, click per dettagli
- [x] T034 [US3] Wire `SessionProviderBadge` nel session header component (cerca componente attuale dell'header sessione)
- [ ] T035 [P] [US3] Verificare che switching provider PER-SESSIONE non altera il default globale (toggle test: 2 sessioni, una override, default invariato in store)

**Checkpoint US3**: due sessioni con provider diversi attive simultaneamente, badge corretti, env vars isolate per processo.

---

## Phase 6: User Story 4 — Token usage / context window accurati (P3)

**Goal**: StaminaBar e Token Usage modal usano il `contextWindow` dichiarato dal provider.

**Independent test**: provider con contextWindow 1M (MiniMax) → StaminaBar usa 1M come max, non 200k.

- [x] T036 [US4] Modify `StaminaBarBorder` o equivalent (cerca `chatTokensMap` consumer): risolvere il `contextWindow` dal provider attivo della sessione invece di hardcoded 200000
- [x] T037 [US4] Modify Token Usage modal per mostrare provider name + contextWindow nel detail panel
- [ ] T038 [P] [US4] Unit test: con MiniMax provider (contextWindow=1M), 500k tokens → stamina ~50%, non 0%

**Checkpoint US4**: ogni provider ha la sua scala corretta in UI.

---

## Phase 7: Polish & Cross-Cutting

- [x] T039 [P] Mascherare `authToken` nei log del Node bridge (`stream-claude.js`, `stream-daemon.js`) — sostituire con `***` quando si logga `QUACK_PROVIDER_CONFIG`
- [x] T040 [P] Aggiungere brain breadcrumb `// Brain: 037-anthropic-compatible-providers` sopra il blocco di parsing `QUACK_PROVIDER_CONFIG` in entrambi i Node bridge files
- [x] T041 [P] Aggiungere brain breadcrumb sopra `buildProviderConfig` in `providerEnvBuilder.ts`
- [x] T042 Creare feature-doc `documentation/features/068-anthropic-compatible-providers.md` (auto-numbered) con tabelle file/exports — usare la skill `feature-creator`
- [x] T043 Aggiungere knowledge entry in `documentation/patterns/pattern-anthropic-compatible-providers.md` con frontmatter, decisioni chiave (namespacing API keys, per-sessione, QUACK_PROVIDER_CONFIG JSON)
- [x] T044 [P] Aggiungere link nel CLAUDE.md Knowledge Base section a `pattern-anthropic-compatible-providers.md`
- [x] T045 Diary entry in `documentation/diary/2026-05-12.md` con bullet (Alek): cosa è stato fatto + insight
- [x] T046 [P] Aggiungere edge case test: provider con baseUrl non-HTTPS → reject in validation (ProviderAddModal)
- [x] T047 [P] Aggiungere edge case test: API key vuota → "Set as default" disabilitato finché non valorizzata
- [ ] T048 Manual smoke test E2E completo da quickstart.md (tutti i checkbox)
- [ ] T049 Verifica non-regressione: provare flow OpenAI key in `AIAssistantSettings` (deve funzionare identico), flow Bedrock toggle, flow Ollama (intoccato)

---

## Dependencies

```
Setup (T001-T004)
  └─> Foundational (T005-T011)
        ├─> US1 (T012-T022)  [P1, MVP]
        │     └─> US2 (T023-T028)  [P1, depends on US1 manager UI]
        │           └─> US3 (T029-T035)  [P2, depends on spawn logic + manager]
        │                 └─> US4 (T036-T038)  [P3, depends on provider contextWindow plumbing]
        └─> Polish (T039-T049)  [after all stories]
```

**Story independence**:
- US1 è il MVP — completarlo solo basta a usare z.ai/MiniMax/Kimi via preset
- US2 può saltare se built-in presets bastano
- US3 è additive — senza, il default globale funziona già
- US4 è cosmetico

## Parallel Execution Opportunities

**Within Foundational**:
- T009 in parallel con T010-T011 (test file isolato vs Rust files)

**Within US1**:
- T012, T013 in parallel (service files diversi)
- T019, T020 in parallel (file Node diversi)
- T021 in parallel con T014-T017 (test file isolato vs UI)

**Within Polish**:
- T039, T040, T041, T044, T046, T047 tutti [P]

## MVP Scope

**Suggested MVP = Phase 1 + Phase 2 + Phase 3 (US1)**
= T001-T022 (22 tasks)

Sufficiente a:
- Settings panel mostra preset Z.AI / MiniMax / Kimi / Qwen / DeepSeek
- Utente mette API key, test, set as default
- Tutte le sessioni successive usano il provider
- Migrazione legacy sicura
- Zero regressioni OpenAI / OAuth Anthropic

Phase 4-7 sono iterazioni successive per power users.

## Total

- **49 tasks**
- US1: 11 tasks (MVP)
- US2: 6 tasks
- US3: 7 tasks
- US4: 3 tasks
- Setup + Foundational + Polish: 22 tasks

## Next

`/speckit.analyze` per cross-artifact consistency check, oppure `/speckit.implement` per partire dal MVP.
