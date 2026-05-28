---
ws: 02
title: "ChangesPanel — Sub-repos section (nested git status)"
status: "COMPLETED — SMOKE TEST PASSED"
focus: completed
opened: 2026-05-26
updated: 2026-05-27
feature: documentation/features/071-changes-panel-subrepos.md
---

# WS02 — ChangesPanel Sub-repos section

## Goal

Permettere all'utente che apre in Quack un progetto "contenitore" (es. `~/Desktop/Dev/Personal/Kyron` con `cms/`, `ecommerce/`, `studio-server/` come sub-repo) di vedere a colpo d'occhio lo stato git di ogni sub-repo direttamente nel ChangesPanel, senza dover passare da terminale o aprire un secondo progetto. Read-only, in-place context switch.

## Scope

- **Backend Rust**: comando `git_scan_subrepos(root)` in `src-tauri/src/git.rs` con cache 30s. Depth 1, usa `git2`. Restituisce branch, counts (added/modified/untracked), ahead/behind vs upstream, last commit subject + relative ts.
- **Tipi TS**: `SubRepoStatus` in `src/types/`.
- **Componente React**: `SubReposSection.tsx` accordion autohide sopra "Pending" dentro `ChangesPanel.tsx`. Layout come da mockup A approvato.
- **Context switch in-place**: stato `subRepoOverride` nel ChangesPanel. Quando attivo, tutte le query git del pannello usano `subRepoPath` invece di `rootPath`. Breadcrumb `<parent> › <subrepo> ←` in cima con back button. **Solo il ChangesPanel cambia contesto** — FileExplorer, terminale, ChatView restano sul parent.
- **Diary entry** in `documentation/diary/2026-05-26.md`.

## Status detail

**Mockup approvato (mockup A)** dopo conversazione del 2026-05-26:
- Visibilità: autohide se count=0
- Posizione: sopra "Pending"
- Click action: switch in-place con breadcrumb

**Decisioni aperte**: nessuna azione git (commit/push/pull) sui sub-repo in questa iterazione — solo lettura. Eventuali azioni vanno scopate in WS futuro.

**Pattern di riferimento**: `pattern-brain-accordion-section.md` per il layout accordion, `pattern-changes-panel.md` per il pannello host.

## Next action

1. Creare feature doc `071-changes-panel-subrepos.md` via `feature-creator` (o manualmente seguendo `032-changes-panel-agent-commit-refresh.md` come modello).
2. Implementare backend `git_scan_subrepos` + tipi.
3. Componente UI + integrazione.
4. Smoke test su `~/Desktop/Dev/Personal/Kyron`.
