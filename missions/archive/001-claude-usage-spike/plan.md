---
type: mission
slug: claude-usage-spike
status: completed
updated: 2026-06-30T15:39:52.431Z
---

# Missione: claude-usage-spike

## Obiettivo

Validare in un colpo solo se (a) Quack consuma oggettivamente più della GUI desktop di Claude Code, (b) `npx ccusage@latest` è invocabile da Tauri senza frizioni, (c) ha senso investire in una dashboard integrata. Output: verdetto GO/NO-GO con numeri.

## Contesto

L'utente percepisce che Quack raggiunge i limiti Claude più velocemente della GUI desktop ufficiale. Esiste già in Quack un'infrastruttura usage (`claude_usage.rs`, `aiUsageLog.ts`, event `usage` da ogni provider, dashboard in Settings). Quello che manca è: (1) misurare oggettivamente il gap, (2) capire il perché a livello di codice, (3) validare che ccusage (16.7k stars, MIT, supporta 14+ fonti CLI tra cui Claude Code) sia integrabile senza frizioni in Tauri. Se lo spike è positivo, si apre un piano di integrazione più ampio.

## Fasi

### 1. Piano
- [x] (w1) Piano definito

### 2. Spike tecnico (timeboxed 2-3 ore)
- [ ] (w2) Misura reale del gap Quack vs Claude Desktop raccolta
- [ ] (w3) Root cause identificata nel codice Quack
- [ ] (w4) Fattibilità npx ccusage@latest da Tauri verificata
- [ ] (w5) Verdetto GO/NO-GO scritto con raccomandazioni
