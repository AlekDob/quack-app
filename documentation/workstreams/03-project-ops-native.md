---
ws: 03
title: "Project-ops as Quack's native spec system"
status: "FE + BE + HOOK SHIPPED — SMOKE TEST PENDING"
focus: current
opened: 2026-05-26
updated: 2026-05-26
feature: documentation/features/072-project-ops-native-integration.md
warning: |
  Smoke test richiede restart Quack (PostToolUse hook viene letto solo a session start). Verificare: (a) workstreams + status tab visibili nell'accordion, (b) bootstrap_project_ops silenzioso al cambio progetto, (c) Plan Mode che invoca project-ops skill, (d) banner rosso HooksPanel se settings.json corrotto.
---

# WS03 — Project-ops as Quack's native spec system

## Goal

Elevare la skill `project-ops` da opt-in (bootstrap manuale via `setup-pm-docs.sh`) a layer nativo di Quack. Ogni progetto aperto deve avere:
- workstreams + status surface nel side panel
- PostToolUse hook installato per autogenerare `INDEX.md`
- Plan Mode che produce workstream invece di prose ad-hoc
- validazione `.claude/settings.json` per intercettare il silent-drop di Claude Code

Il principio: la skill resta la source of truth (templates + script), Quack è il delivery layer che la attiva automaticamente.

## Scope

- **UI Side Panel** — rimuovere slot `project-context`, aggiungere `workstreams` (amber) + `status` (lime) con relativi panel + hook `useWorkstreams`.
- **Plan Mode injection** — system prompt append in `stream-daemon.js` che obbliga uso skill `project-ops` quando `permissionMode === 'plan'`.
- **Bootstrap nativo** — Tauri command `bootstrap_project_ops` chiamato in `loadDirectory`. Idempotente. No-op se skill non installata.
- **Hook validation** — Tauri command `validate_claude_settings_json` + banner rosso in HooksPanel se JSON corrotto.
- **Hook PostToolUse** — installato su questo repo con escape JSON corretto (`jq` validato).
- **Feature doc 072** — riferimento canonico per l'integrazione.

## Status detail

- 2026-05-26: Eseguito `setup-pm-docs.sh` su quack-app → `scripts/build-workstream-index.py` + `scripts/git-hooks/pre-commit` symlink installati.
- 2026-05-26: PostToolUse aggiunto manualmente a `.claude/settings.json` (lo script non lo aggiunge se il blocco hooks esiste già).
- 2026-05-26: Creati `useWorkstreams`, `WorkstreamsPanel`, `WorkstreamStatusPanel`. Rimosso `project-context` da `sectionIds`, `CATEGORY_COLORS`, icons map. Compila pulito (tsc + cargo).
- 2026-05-26: Aggiunto Plan Mode injection in `stream-daemon.js:539`.
- 2026-05-26: Aggiunti `bootstrap_project_ops` + `validate_claude_settings_json` in `src-tauri/src/hooks.rs`, registrati in `lib.rs:1364`. Frontend wiring in `App.tsx:6550`.

## Next action

Smoke test post-restart:
1. Aprire Quack, verificare tab Workstreams + Status nel side panel (sotto Changes).
2. Cambiare progetto → verificare che `bootstrap_project_ops` scriva `scripts/build-workstream-index.py` nel nuovo progetto (se la skill è installata).
3. Entrare in Plan Mode → verificare che Claude proponga un workstream invece di un piano prose.
4. Corrompere temporaneamente `.claude/settings.json` (es. rimuovere una virgola) → verificare banner rosso nel HooksPanel.

Se uno dei 4 fallisce: registrare regression e creare gotcha entry.

## Risks / open questions

- **Bootstrap rumoroso**: ogni `loadDirectory` chiama `setup-pm-docs.sh`. Lo script è idempotente ma fa I/O. Se diventa problema, gating su `documentation/workstreams/` già esistente.
- **JSON merge non chirurgico**: il setup-pm-docs.sh non aggiunge PostToolUse se `.claude/settings.json` esiste già. Soluzione attuale: hook scritto manualmente. Considerare un merge JSON dedicato nel comando Rust.
- **Skill non installata**: comando ritorna `installed: false` silenziosamente. Possibile follow-up: toast "Install project-ops skill from Quack Store" nel HooksPanel.
