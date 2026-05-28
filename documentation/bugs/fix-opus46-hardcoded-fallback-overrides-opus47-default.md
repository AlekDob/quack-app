---
type: bug_fix
project: quack-app
created: 2026-05-28
last_verified: 2026-05-28
tags: [models, opus47, opus46, fallback, settings, hardcoded]
---
# Hardcoded `'opus46'` fallback ignora opus47 default

## Sintomo
Utente vede "Opus 4.6 (1M)" o "Opus 4.6" nel footer/badge anche quando il default settato (`defaultClaudeSettings.model`) e' `'opus47'`. Capita "senza volerlo" — non l'aveva selezionato manualmente.

Tipicamente succede quando:
- Un componente chiama `sendMessage(content, { ...options })` senza il campo `model`
- Telemetria PostHog logga il modello senza che sia stato risolto a monte
- `getActiveModelName()` viene invocato senza fallback esplicito
- Un nuovo background task `agent` viene creato programmaticamente

## Root Cause
Dopo l'introduzione di Opus 4.7 e la migrazione v11 del `settingsStore` che porta `'opus46'` -> `'opus47'`, sono rimasti 11 punti di codice con stringa hardcoded `'opus46'` come fallback runtime:

| File | Riga | Contesto |
|------|------|----------|
| `src/services/claudeSDK.ts` | 17 | `getActiveModelName()` fallback |
| `src/App.tsx` | 3073 | PostHog `ai_message_sent` |
| `src/App.tsx` | 3224 | `sendMessageForAgent` resolveModel |
| `src/App.tsx` | 3417 | PostHog `ai_response_received` |
| `src/App.tsx` | 3435 | PostHog `ai_error` |
| `src/App.tsx` | 3979 | Job provider model resolution |
| `src/components/ChatView.tsx` | 197 | Default prop `model` |
| `src/components/ChatView.tsx` | 475 | Hardcoded model nel BackgroundTask `agent` |
| `src/utils/modelUtils.ts` | 8 | `MODEL_LEGACY_MAP['opus']` |
| `src/utils/modelUtils.ts` | 21 | `normalizeModelName()` per full API IDs |
| `src/stores/settingsStore.ts` | 19 | `LEGACY_MODEL_MAP['opus']` |

Quando uno di questi path veniva attraversato con `options?.model === undefined`, il fallback override-ava il `'opus47'` salvato in `defaultClaudeSettings`. La sessione mostrava 4.6 anche se l'utente non l'aveva mai scelto.

## Fix
Sostituiti tutti gli 11 fallback hardcoded con `'opus47'`. NON toccati:
- `EMERGENCY_FALLBACK` in `modelService.ts` — opus46 e opus46-1m sono ancora modelli selezionabili
- `LEGACY_ID_MAP['opus46']: 'opus47'` in `modelService.ts` — mapping legacy, corretto
- `defaultEffortForModel(opus46)` — branching effort per il modello legittimamente selezionabile
- Le migrazioni `settingsStore.ts:506-516` (v11) che fanno gia' opus46 -> opus47
- Label `'Opus 4.6'` in `BTWDrawer.tsx` e `MessageSettingsBadges.tsx` — per rendere messaggi storici
- Mapping alias->API ID in `btw.rs` e `stream-daemon.js` — sono mappe di traduzione, non fallback

Inoltre aggiunta opzione `<option value="opus47">Opus 4.7</option>` nella select BTW Side-Chain in `ClaudeCodeSettings.tsx`.

## Prevenzione
1. **Mai hardcodare il model name come fallback** — usare `defaultClaudeSettings.model` o `getDefaultModel(remoteModels).id` da `modelService`.
2. Quando si aggiunge un nuovo modello flagship, fare grep globale di `|| 'opus<old>'`, `= 'opus<old>'`, `: 'opus<old>'`, `return 'opus<old>'` PRIMA di considerare il rollout completo.
3. Mantenere `modelService.EMERGENCY_FALLBACK[0].isDefault === true` sul modello flagship corrente.

## Files Fixed
- `src/services/claudeSDK.ts`
- `src/App.tsx`
- `src/components/ChatView.tsx`
- `src/utils/modelUtils.ts`
- `src/stores/settingsStore.ts` (LEGACY_MODEL_MAP)
- `src/components/settings/categories/ClaudeCodeSettings.tsx` (added opus47 option)

## Trigger Condition
Apparizione di un modello "vecchio" nel footer/badge anche dopo aver aggiornato `defaultClaudeSettings.model` al flagship corrente.
