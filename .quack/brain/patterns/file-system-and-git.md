---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# File System and Git

File Explorer: FileExplorer.tsx, FilePreviewDrawer.tsx (5MB limit)

Git Panel: GitPanel.tsx, BranchManager.tsx, CommitHistory.tsx, DiffViewer.tsx

Backend: fs.rs (50.5K LOC), git.rs (39.1K LOC)

Hooks: useFileSystem.ts

Stores: fileSystemStore.ts, gitStore.ts

Features: Directory tree, diff viewer, stage/unstage, branch management, timeline, worktree support

## File Explorer

Il File Explorer di Quack e integrato con il terminale - quando cambi directory nel terminal, l'explorer si aggiorna automaticamente.

### Componenti Principali

- `FileExplorer.tsx` - Tree view navigabile
- `FilePreviewDrawer.tsx` - Anteprima file (max 5MB)
- `CodeEditor.tsx` - Monaco editor per editing

### Backend

`fs.rs` (50K LOC) gestisce tutte le operazioni file:
- `read_file` - Lettura con limite 5MB
- `write_file` - Scrittura sicura
- `list_directory` - Listing con metadata
- `watch_directory` - File watcher per auto-refresh

## Git Integration

Git e integrato nativamente, non tramite libreria ma wrappando il CLI.

### Features

- **Status Panel**: Mostra modified, staged, untracked
- **Diff Viewer**: Side-by-side diff
- **Stage/Unstage**: Click per staged changes
- **Commit**: Dialog con messaggio multiline
- **Branch Manager**: Switch e crea branch
- **Timeline**: Visualizza commit history

### Backend

`git.rs` (39K LOC) wrappa i comandi git:
- `git_status` - Parsed status
- `git_diff` - Diff per file
- `git_stage/unstage` - Staging
- `git_commit` - Commit con messaggio
- `git_log` - History con pagination

### Worktree Support

Per task isolati, Quack supporta git worktree. Ogni task Kanban puo avere il suo worktree dedicato.
