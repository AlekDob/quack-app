# Quickstart

## User flow — usare GLM-4.6 via z.ai

1. Apri Settings (gear icon) → categoria **Claude Code**.
2. Sezione **LLM Provider** → seleziona radio **"Anthropic-compatible"** (al posto di Anthropic/Bedrock).
3. Lista provider mostra i 6 preset built-in + custom. Click su **Z.AI (GLM-4.6)**.
4. Incolla la API key z.ai → pulsante **"Test connection"** → spinner → green check + latenza ms + modello echo `glm-4.6`.
5. Click **"Set as default"** → chiudi settings.
6. Apri una nuova sessione: chat input mostra il selettore provider in basso. Default è Z.AI. Per quella sessione si può overridare.
7. Manda un prompt → la sessione spawna con `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`. Session header mostra badge "Z.AI · glm-4.6".

## User flow — aggiungere provider custom

1. Settings → Claude Code → **"+ Add provider"**.
2. Modal: `name`, `baseUrl` (`https://...`), `sonnetModel`, `haikuModel`, `contextWindow`, `notes`.
3. Submit → entry aggiunta alla lista. Inserisci key → test → set as default se vuoi.

## User flow — duplicare un built-in

1. Click sui 3 puntini su un preset built-in → **"Duplica come custom"**.
2. Nuovo provider custom pre-popolato con tutti i campi del built-in, nome `"Z.AI (Copy)"`.
3. Edita liberamente.

## Dev setup

```bash
git checkout 037-anthropic-compatible-providers
npm install
npm run tauri dev
```

Per testare la migration v11→v12:
1. Avvia Quack su una build pre-feature, configura un provider Custom legacy.
2. Quit, sostituisci binario con build feature, riavvia.
3. Verifica che `claude.activeProvider.kind === "custom"` e `customProviders[0].id === "legacy-custom"` nel devtools (`useSettingsStore.getState()`).

## Smoke test E2E (manuale)

- [ ] Switch tra Anthropic / Z.AI / Bedrock funziona (radio mutex)
- [ ] OAuth Anthropic Pro NON viene perso dopo switch a Z.AI
- [ ] Test connection con key invalida → mostra status code 401 e error body
- [ ] Override per-sessione: sessione A su Z.AI, sessione B (nuova, default Z.AI) override a Anthropic → ognuna usa il suo
- [ ] Delete custom provider attivo → fallback `anthropic`, nessun crash
- [ ] Session badge mostra il provider corretto per ogni sessione attiva
- [ ] Token usage modal mostra `glm-4.6` quando sessione gira su Z.AI

## Rollback

In caso di problemi:
- Settings store v12 NON cancella i campi legacy (`provider`, `customBaseUrl`) finché non confermato stabile. Per rollback a v11: revert build, lo store legge ancora i campi vecchi.
- Per disabilitare la feature lato utente senza revert: Settings → Claude Code → seleziona Anthropic come default e nessuna sessione attiva con custom.
