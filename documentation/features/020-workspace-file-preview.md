---
type: feature-doc
project: synara
stack: React / TypeScript / Node
created: 2026-08-11
last_verified: 2026-08-11
status: active
tags: [explorer, workspace, file-preview, editing, atomic-write]
---

## Workspace File Preview

**Purpose:** The Explorer's file pane — view a file from the project tree, and (where safe) edit and save it in place with Cmd/Ctrl+S.
**Stack:** React / TypeScript (apps/web) + Node (apps/server)

### Files

| Type       | Path                                                               | Exports/Purpose                                                                       |
| ---------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Component  | `apps/web/src/components/WorkspaceFilePreview.tsx`                 | The pane: read, edit buffer, dirty tracking, save, conflict handling                  |
| Component  | `apps/web/src/components/chat/WorkspaceFilePreviewHeader.tsx`      | Breadcrumb header; `dirty` dot and `readOnlyReason` "Read-only" badge                 |
| Consumer   | `apps/web/src/components/EditorWorkspaceView.tsx`                  | Passes `editable`                                                                     |
| Consumer   | `apps/web/src/components/chat/DockExplorerPane.tsx`                | Passes `editable`                                                                     |
| Service    | `apps/server/src/workspace/Services/WorkspaceFileSystem.ts`        | `WorkspaceFileSystemShape`, `WorkspaceFileConflictError`, `WorkspaceFileDeletedError` |
| Layer      | `apps/server/src/workspace/Layers/WorkspaceFileSystem.ts`          | `readFile`/`writeFile`, atomic write, version hashing, encoding/EOL preservation      |
| Middleware | `apps/server/src/wsRpc.ts`                                         | Maps conflict/deleted errors to `WORKSPACE_FILE_CONFLICT` / `WORKSPACE_FILE_DELETED`  |
| Model/Type | `packages/contracts/src/project.ts`                                | `ProjectFileEncoding`, `ProjectFileLineEnding`, read/write input+result schemas       |
| Test       | `apps/server/src/workspace/Layers/WorkspaceFileSystem.test.ts`     | 25 tests: containment, conflict, deletion, encoding, EOL                              |
| Test       | `apps/web/src/components/WorkspaceFilePreview.editing.browser.tsx` | 4 browser tests: edit, save, dirty state, read-only                                   |

### Data Flow

- Read: `projectsReadFile` → `ProjectReadFileResult` now also carries `version` (a `sha256:` hash of the bytes on disk), `encoding` (`utf8` | `utf8-bom`) and `lineEnding` (`lf` | `crlf` | `cr` | `mixed`).
- Edit: typing fills a local `editBuffer`; `editBufferDirty` compares it against `savedContents` and drives the dot in the header.
- Save (Cmd/Ctrl+S): `projectsWriteFile` with `expectedVersion` + the file's original `encoding`/`lineEnding`, so a save round-trips the exact on-disk format instead of normalizing it.
- Server re-reads and re-hashes the file just before the atomic rename; a mismatch aborts with `WorkspaceFileConflictError` rather than overwriting.

### Key Functions

- `readCurrentFileVersion(workspaceRoot, filePath) → { version, stat }` — reads via one open handle and cross-checks `dev`/`ino`/`size`/`mtimeNs`/`ctimeNs` before and after, so a file swapped mid-read is a conflict, not a silent success.
- `writeFileAtomically(workspaceRoot, filePath, contents, expectedVersion?)` — writes a temp file in the same directory, re-verifies containment and version, then `rename()`s over the target. Preserves the original mode bits.
- `encodeWorkspaceText(contents, encoding, lineEnding) → Buffer` — normalizes to `\n` internally, then re-applies the file's original line ending and re-attaches the UTF-8 BOM if it had one.
- `detectLineEnding(contents)` — returns `mixed` when a file uses more than one style.

### State

- `editBuffer`: `{ contents, savedContents, error }` — component scope, one per open file.
- No new store; the saved version is tracked through the React Query cache for `projectsReadFile`.

### Behavior

- Read-only cases (shown as a "Read-only" badge with the reason in the tooltip): file outside the project root, file truncated by the 1 MB read cap, mixed line endings, or a format with no version/encoding (binary-like).
- Concurrency: if the file changed on disk after it was opened, the save is refused with "This file changed on disk after it was opened. Reload it before saving…" — no last-write-wins.
- If the file was deleted after opening, the save is refused separately (`WORKSPACE_FILE_DELETED`), rather than silently recreating it.
- Path containment (realpath checks against the workspace root, on both the target and the temp file's parent) predates this change and still applies to every write.
- Markdown preview mode is read-only; editing applies to the source view.

### Out of scope (deliberately not built)

- Creating, renaming, or deleting files from the Explorer — this is edit-in-place only.
- Multi-file / tabbed editing, undo history across reopens.
- Auto-reload when the file changes on disk while open (the conflict error is the backstop instead).
