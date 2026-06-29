---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-06-29
tags: [editor, preview, images, pdf, binary, tabs, file-tree]
---

## In-tab media preview (images + PDF)

**Purpose:** Opening a PNG/JPG/GIF/WebP/BMP/ICO/AVIF or a PDF from the file tree (or palette) used to toast `Can't open …: File appears to be binary.` and do nothing. Now those files open as a read-only **preview tab** — image rendered inline (click to toggle fit ↔ actual size), PDF in the webview's native viewer.

**Scope:** Raster images + PDF only. **SVG stays a text buffer** on purpose (it's editable XML). Any other binary still toasts the original error.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Classifier | `src/mediaPreview.ts` | `mediaKindOf(path)` → `"image" \| "pdf" \| null`; `IMAGE_EXTS` set |
| Preview pane | `src/components/MediaPreviewPane.tsx` | reads bytes as a `data:` URL via `fs.readImageDataUrl`, renders `<img>` (fit/actual toggle) or `<iframe>` (PDF); loading + error states |
| Open flow | `src/store.ts` | `openFile` — media branch skips `readFile`, seeds an empty sentinel buffer; hydration restore seeds the same so media tabs survive reload |
| Portal | `src/components/WorkspaceShell.tsx` | file-tab portal picks `MediaPreviewPane` vs `EditorPane` by `mediaKindOf(path)` |
| IPC | `src/ipc.ts` | `fs.readImageDataUrl(path)` (now serves PDF too) |
| Backend | `src-tauri/src/fs_ops.rs` | `read_image_data_url` — added `bmp`/`ico`/`avif`/`pdf` mime arms |
| Styles | `src/App.css` | `.media-preview`, `.media-preview-image` (+ `.actual-size`), `.media-preview-pdf`, loading/error |

### Data flow
- **Open:** file-tree click → `openFile`. If `mediaKindOf(path)` is non-null, it **never** calls `readFile` (the backend rejects binary) — it stores `{ contents: "", original: "" }` and adds the tab. Sentinel = `contents === original`, so the file reads as not-dirty everywhere.
- **Render:** the file-tab portal in `WorkspaceShell` mounts `MediaPreviewPane` instead of `EditorPane` for media paths. The pane pulls the bytes from disk itself (`read_image_data_url` → base64 `data:` URL), independent of the empty store buffer.
- **Persist:** on workspace reload, the hydration loop seeds the same empty sentinel for media keys so the tab survives the restore filter (which drops `file:` tabs with no buffer) without a text read.

### Notes / gotchas
- **Empty sentinel is safe:** `saveFile` early-returns when `contents === original`, so Ctrl+S on a media tab is a no-op — it can't blank the file on disk.
- **Idle sweeper:** `MediaPreviewPane` calls `touchFile` on mount (like `EditorPane`) so the idle-buffer sweeper leaves an active media tab alone. The pane reads from disk regardless of the store buffer, so an unloaded background buffer still re-renders fine on reactivation.
- **PDF via `data:` URL, not the asset protocol:** CSP is `null` so `data:` frames load. Reused `read_image_data_url` (renamed in spirit to "media") rather than enabling the Tauri asset protocol + scope — fewer config moving parts. Trade-off: a large PDF is base64-inflated (~1.33×) into memory for the preview.
- **No breadcrumb bar:** preview panes mount directly into `pane-content`, not inside `editor-host`, so they fill the pane without the editor chrome.
- **Room to grow:** SVG-as-image toggle, image zoom/pan beyond fit↔1:1, PDF page controls (native viewer handles this today).
