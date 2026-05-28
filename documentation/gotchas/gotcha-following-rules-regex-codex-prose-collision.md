---
type: gotcha
project: quack-app
created: 2026-05-27
last_verified: 2026-05-27
tags: [codex, agent-message, render, regex, personality, following-rules, rule-pills, streammessage]
---

# Codex agent_message reso come "rule pills" giganti invece che bolla

## Sintomo

Su sessioni Codex (`gpt-5-codex`), la risposta dell'agente NON appare nella bolla di chat. Al suo posto si vedono N "pillole viola" (`<span class="rule-pill">`) che contengono frasi intere di prosa italiana, mentre la bolla `assistant-message-text` è vuota.

Screenshot e repro 2026-05-27: Agent Elena risponde "Following rules: use-mcp-memory-second-brain. Spiego prima di agire: …, oppure …, ti posso …, togliamo …, e solo dopo …" → in UI compaiono 5 mega-pillole, zero testo nella bolla.

## Causa root (catena completa)

1. `src-tauri/src/personality.rs:492` istruisce ogni agente con regole selezionate:
   > "*IMPORTANT: Follow these rules strictly. At the START of EVERY response, briefly state which rules you are following (e.g., 'Following rules: X, Y, Z').*"

2. `src/components/StreamMessage.tsx` aveva un regex permissivo:
   ```ts
   /^(?:Following rules?:\s*)(.+)$/m
   ```
   - `.+` è greedy ma `.` di default NON matcha `\n`, quindi cattura "fino al primo newline".
   - Il match veniva poi splittato per `,` e ogni pezzo diventava `<span class="rule-pill">`.
   - Il testo della riga matchata veniva rimosso da `combinedText` (la stringa che alimenta `<MarkdownText>`).

3. **Claude** rispetta il template alla lettera → produce *una* riga `Following rules: foo, bar.` seguita da `\n\n` e poi il messaggio. Il regex cattura solo la lista pulita e nessuno se ne accorge.

4. **Codex (gpt-5-codex)** interpreta l'istruzione liberamente in italiano e mescola "Following rules:" con la prosa, su una singola linea senza newline intermedi:
   ```
   Following rules: use-mcp-memory-second-brain. Spiego prima di agire: non posso eseguire direttamente un commit "di tutto" perché non so cosa includa la tua area di lavoro né posso correre il rischio…, oppure escludere…, ti posso guidare…, togliamo…, e solo dopo…
   ```
   Il `.+` greedy ingoia TUTTO il messaggio fino a `$`, lo splitta per virgola → 5 paragrafi-pillola, e `combinedText` resta vuoto.

## Fix

Regex stretto in `StreamMessage.tsx` (intorno a riga 763): accetta solo identificatori `[\w-]+` (kebab / snake / alfanumerici) separati da virgole e terminati a EOL.

```ts
const RULES_PATTERN = /^Following rules?:\s*([\w-]+(?:\s*,\s*[\w-]+)*)\s*\.?\s*$/m;
```

- Match su `Following rules: foo, bar-baz.` → pillole pulite (path Claude invariato).
- No-match su `Following rules: skill-x. Spiego prima…, oppure…` → la riga passa intatta a `<MarkdownText>` e la bolla rende il messaggio normalmente.

## Perché non altrove

- NON è in `codexEventAdapter.ts` (`mapTextDelta` produce un assistant content `text` regolare).
- NON è in `events.rs` (`codex_stream_to_quack` traduce `agent_message.text` letterale).
- NON è in `MarkdownText.tsx` (`md-inline-code` ha CSS simile ma usa `--accent-rgb`, le pillole nel bug erano `#8b5cf6` hardcoded di `.rule-pill`).

## Considerato e scartato

- Rimuovere l'istruzione "Following rules:" da `personality.rs` per sessioni Codex: invasivo, richiede gate per backend nel prompt Rust + rebuild.
- Passare `isCodexSession` a `StreamMessage` e disattivare il regex: aggiunge prop-drilling per un fix che si risolve a livello regex.

## Riferimenti

- Fix: `src/components/StreamMessage.tsx:763` (commit 2026-05-27)
- Istruzione sorgente: `src-tauri/src/personality.rs:492`
- Feature Codex: `documentation/features/066-codex-backend-multi-agent.md`
- Adapter Codex (innocente, NON tocca): `src/utils/codexEventAdapter.ts`
