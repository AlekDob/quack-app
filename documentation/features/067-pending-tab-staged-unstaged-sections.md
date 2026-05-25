---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-05-25
last_verified: 2026-05-25
tags: [changes-panel, pending-tab, git, staged, unstaged, ux]
---

## Pending Tab — Unstaged / Staged Sections
**Purpose:** Mostrare nel tab `Pend.` del `ChangesPanel` tutto il working tree non committato, raggruppato in due sezioni collassabili `Unstaged (N)` / `Staged (N)`, replicando il pattern del Git drawer integrato. Prima il tab mostrava solo i file modificati nella sessione (`modifiedFiles`), quindi appariva vuoto se l'utente non aveva ancora chiesto edit all'agente.
**Stack:** React 18, TypeScript strict, Tauri v2 invoke (`git_status_summary`, `git_stage`, `git_unstage`, `git_discard_file`, `git_diff`)

### Files
| Type | Path | Exports / Purpose |
|------|------|-------------------|
| Hook | src/hooks/useChangesPanelState.ts | `loadGitStatus`, `unstagedEntries`, `stagedEntries`, `toggleGitFile`, `loadGitDiff`, `handleStageRel`, `handleUnstageRel`, `handleDiscardGitEntry` |
| Component | src/components/PendingTab.tsx | Riscritto: due `<Section>` collassabili (Unstaged/Staged) con `FileRow` riusato |
| Component | src/components/FileRow.tsx | Aggiunto prop opzionale `onUnstage` + bottone `changes-btn-unstage` |
| Component | src/components/ChangesPanel.tsx | Conta badge Pend. = `unstaged + staged`; cablaggio nuove props |
| Styles | src/components/ChangesPanel.css | `.changes-panel-sections`, `.changes-panel-section`, `.changes-panel-section-header/-chevron/-title/-empty`, `.changes-btn-unstage` |

### Data Flow
```
mount / lastRefreshTs bump / window.focus
  → loadGitStatus → invoke('git_status_summary', { rootPath })
    → setGitEntries(summary.entries)
      → unstagedEntries = filter(is_untracked || unstaged_status != ' ')
      → stagedEntries   = filter(!is_untracked && staged_status != ' ')

User toggle file row
  → toggleGitFile(entry, staged)
    → expandedFiles.add(entry.path)
    → loadGitDiff(entry.path, staged, entry.is_untracked)
      → invoke('git_diff', { path, staged, untracked, rootPath })

User stage / unstage / discard
  → handleStageRel | handleUnstageRel | handleDiscardGitEntry
    → invoke + loadGitStatus() + onRefreshGitStatus()
```

### Key Design Decisions
- **Sorgente unica = git porcelain**: il tab Pend. non dipende più dalla mappa `modifiedFiles` di sessione. Vede TUTTO il working tree.
- **Tab Comm. invariato**: continua a mostrare i file della sessione già committati (alimentato da `committedEntries` derivati da `modifiedFiles` + `committedFiles`). Le due fonti coesistono senza collidere: chiavi assolute per i file di sessione, chiavi relative (entry.path) per i file git.
- **Riuso `FileRow`**: niente componente parallelo come `GitFilesColumn`. `FileRow` ha già diff inline, badge stato, OpenInIDE, ecc. Aggiunto solo `onUnstage` per il bottone unstage nella sezione Staged.
- **Bottone Stage all** visibile solo se ci sono unstaged. Bottone Commit sempre visibile quando `total > 0`.
- **Discard di untracked** passa ancora per `ConfirmModal` (no `window.confirm` in Tauri webview — Brain: `gotcha-window-confirm-tauri-webview`).
- **Refresh triggers**: `mount`, `lastRefreshTs` (auto-commit dell'agente), `window.focus` (commit esterni da Fork/terminale), dopo ogni stage/unstage/discard/commit/accept-all.

### Brain References
- `documentation/patterns/pattern-changes-panel.md` — architettura ChangesPanel
- `documentation/features/032-changes-panel-agent-commit-refresh.md` — meccanismo di refresh `lastRefreshTs`
- `documentation/bugs/fix-changes-panel-cpu-loop.md` — perché `reconcileWithGit` resta separato da `loadGitStatus`
