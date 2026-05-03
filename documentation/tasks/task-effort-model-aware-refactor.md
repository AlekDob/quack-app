---
type: task
project: quack-app
created: 2026-04-21
status: todo
priority: medium
estimated_effort: 2-3h
suggested_agent: frontend-developer
related_feature: documentation/features/037-unified-settings-panel.md
tags: [effort, sdk, opus-4-7, settings, refactor]
---

# Refactor Effort parameter — model-aware defaults + consolidation

## Contesto

Feature 037 (Unified Settings Panel) espone l'Effort correttamente fino all'API
Anthropic, ma la gestione lato Quack è sciatta in 3 punti:

1. **5 fallback hardcoded `|| 'medium'`** in `src/App.tsx` (righe 2935, 3695,
   3885, 5180, 5193) sovrascrivono `defaultEffortForModel()`. Se `currentSettings.effort`
   è `undefined` (bug idratazione, nuovo preset, edge case), un utente su Opus 4.7
   riceve `medium` invece di `xhigh`. Anthropic raccomanda `xhigh` come default Opus 4.7.

2. **Nessun clamp model-aware nel daemon** — `src-tauri/node-sdk/stream-daemon.js`
   passa `xhigh` tal quale anche a modelli che non lo supportano (Sonnet 4.5, Haiku,
   Ollama). Il commento in `src/types.ts` dice *"xhigh falls back to high on those
   models"* ma il fallback NON esiste nel codice — lo fa (forse) silenziosamente
   l'API.

3. **Doppio canale effort/thinkingMode che si sovrappongono** —
   `stream-daemon.js:1009-1017` mappa `thinkingMode` → `effort` (think=medium,
   hard=high, harder/ultra=max). Poi a riga 1033 l'effort esplicito sovrascrive.
   Due UI diverse che toccano lo stesso parametro API → confusione utente.

## Acceptance Criteria

- [ ] Tutti i `effort: options?.effort || 'medium'` in `src/App.tsx` sostituiti
      con `|| defaultEffortForModel(model)` (import da `src/services/modelService.ts`)
- [ ] In `src-tauri/node-sdk/stream-daemon.js` aggiungere clamp:
      ```js
      if (options.effort === 'xhigh' && !model.includes('opus-4-7')) {
        console.warn(`[daemon] xhigh not supported on ${model}, degrading to high`);
        options.effort = 'high';
      }
      ```
- [ ] Aggiornare il commento in `src/types.ts:589` per riflettere che il clamp
      ora è reale (non una promessa vuota)
- [ ] Aggiornare `documentation/features/037-unified-settings-panel.md` sezione
      Config con la nuova logica default
- [ ] Aggiungere test in `src/services/__tests__/modelService.test.ts` per
      `defaultEffortForModel()` (se non esistono già)
- [ ] Diario in `documentation/diary/2026-04-21.md` (o data corrispondente)

## Out of Scope (follow-up task separato)

- Deprecazione `thinkingMode` come UI separata in favore di slider unico Effort
  → richiede discussione UX con Alek prima di procedere. Creare task separato
  se si decide di farlo.

## File coinvolti

| File | Azione |
|------|--------|
| `src/App.tsx` | Replace 5 fallback hardcoded |
| `src-tauri/node-sdk/stream-daemon.js` | Add clamp xhigh→high (righe ~1009-1033) |
| `src/services/modelService.ts` | Già presente `defaultEffortForModel()`, nessuna modifica |
| `src/types.ts` | Aggiorna commento riga 589 |
| `documentation/features/037-unified-settings-panel.md` | Sezione Config |
| `src/services/__tests__/modelService.test.ts` | Test defaultEffortForModel |

## Note tecniche

- Il flusso corretto è già: UI → `options.effort` → `claudeSDK.ts` → Rust
  `QueryCommand.effort` → daemon → SDK `options.effort` → `--effort <level>` CLI
- Brain breadcrumb da aggiungere sopra il clamp daemon:
  `// Brain: task-effort-model-aware-refactor`
- Verificare migration chain settings-storage v11 — la migrazione esiste già per
  `Opus 4.6 → 4.7 + effort medium → xhigh`, quindi utenti migrati sono OK. Il
  bug riguarda solo utenti nuovi o stati corrotti.

## Riferimenti

- Commit recente: `4f68b39 feat(settings): align Effort selector with Anthropic official levels`
- Doc ufficiale: https://platform.claude.com/docs/en/build-with-claude/effort
- Feature: `documentation/features/037-unified-settings-panel.md`
