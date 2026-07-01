---
type: mission
slug: session-usage-panel
status: completed
updated: 2026-07-01T12:35:14.415Z
---

# Missione: session-usage-panel

## Obiettivo

Aggiungere a Quack un indicatore live della sessione Claude Code (ProgressCircle nel composer) + pannello dettaglio (slide-over drawer) con limiti sessione 5hr, costo, token e metriche reali.

## Contesto

Alek raggiunge spesso il limite 5hr di Claude Code e vuole vedere in tempo reale quanto ha consumato, cosa sta guidando i costi, e avere un pannello veloce di dettaglio — simile a Astronave ma per Quack.

## Fasi

### 1. Piano
- [x] (w1) Piano definito

### 2. Fase 1 — ProgressCircle nel composer
- [x] (w2) Componente SessionUsageCircle creato
- [x] (w3) Polling claude_usage_limits ogni 30s integrato
- [ ] (w4) ProgressCircle visibile nel composer accanto a EffortPopover
- [x] (w5) Colori: verde/giallo/rosso in base a %

### 3. Fase 2 — Slide-over drawer dettaglio
- [ ] (w6) Drawer di dettaglio creato (riusa pattern slide-over esistente)
- [ ] (w7) Cards: Session 5hr, Weekly, Extra usage con barre
- [ ] (w8) Sezione 'Questa sessione': costo, turni, token, cache hit, modello, durata
- [ ] (w9) Link a Usage Dashboard

### 4. Fase 3 — Integrazione dati
- [ ] (w10) Polling continua in background mentre la chat è attiva
- [ ] (w11) Dati aggiornati live nel drawer
- [ ] (w12) Stato persistente tra aperture/chiusure drawer

### 5. Review e rifiniture
- [ ] (w13) Test con sessione reale
- [ ] (w14) Verifica polling non blocca UI
- [ ] (w15) Breadcrumb salvato nel Brain
