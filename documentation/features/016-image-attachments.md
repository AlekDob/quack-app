---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-06-29
tags: [claude-code, chat, images, attachments, paste, drag-drop, compression, modal]
---

## Chat image attachments (Cmd+V / Finder drop)

**Purpose:** Let the user attach up to 10 images to a Claude Code chat message — by pasting (Cmd/Ctrl+V) or dragging from Finder/Explorer. Images are compressed client-side, persisted to a temp dir, and their on-disk paths inlined into the prompt so Claude Code views them with its **Read** tool ("Strada A": no CLI multimodal protocol, no `ChatMessage.content` refactor).

**Scope:** Claude Code only. Other providers (Anthropic/OpenAI/Ollama) no-op with a hint — wiring images into their multimodal APIs is "Strada B", deliberately out of scope here.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Logic + bus | `src/imageAttach.ts` | `compressAndSave`, `attachFromBlob`, `attachFromPath`, `isImagePath`, `MAX_ATTACHED_IMAGES`; drop-routing bus `registerChatDropZone` / `tryRouteDropToChat` |
| Composer | `src/components/AIChatPanel.tsx` | `attachedImages`/`zoomImage` state, `appendImages`, `removeImage`, `openZoom`; image `onPaste`, attach strip, in-message thumbnails, zoom modal, Esc-to-clear |
| Drop router | `src/App.tsx` | window `onDragDropEvent` calls `tryRouteDropToChat(paths, position)` BEFORE open-as-tab |
| IPC | `src/ipc.ts` | `fs.saveImageAttachment(filename, dataB64)`, `fs.readImageDataUrl(path)` |
| Backend | `src-tauri/src/fs_ops.rs` | `save_image_attachment` (decode b64 → temp dir → path), `read_image_data_url` (bytes → `data:` URL) |
| Type | `src/ai.ts` | `ChatMessage.images?: {path, name, thumb}[]` (additive, optional) |
| Tool chip + drawer | `src/components/chatToolRender.tsx` | a Read of an image → `image` icon + teal `ai-tcall-image` pill; drawer call passes `imagePath` |
| Drawer | `src/components/ToolResultDrawer.tsx` + `src/toolDrawer.ts` | `ToolDrawerData.imagePath` → body renders `<img>` (loaded via `read_image_data_url`) instead of `[image]` |
| Styles | `src/App.css` | `.ai-attach-strip`, `.ai-attach-thumb`, `.ai-msg-images`, `.ai-image-modal`, `.ai-tcall-image` (+ `--img`/`--img-bg` tokens), `.tool-drawer-image` |

### Data flow
- **Paste:** `onPaste` pulls `image/*` items from the clipboard before the code-fence logic, `getAsFile()` → `appendImages([{kind:"blob"}])`.
- **Drop:** the window-level Tauri listener in `App.tsx` hit-tests the drop `position` (physical px ÷ devicePixelRatio) against the chat panel's rect via `tryRouteDropToChat`. If it lands over the chat AND carries images → routed to `appendImages([{kind:"path"}])` and open-as-tab is skipped; otherwise falls through to the existing open-as-tab behaviour.
- **Compress:** `compressAndSave` decodes the image, scales the long edge to ≤1568px (WebP q0.82, JPEG fallback) for the on-disk full version, plus a ≤320px thumb data: URL for preview. `save_image_attachment` writes the bytes to `<temp>/quack-attachments/` and returns the absolute path.
- **Send:** for `claude-code`, paths go into `ccTurnContext` ("View them with your Read tool: …"), same pattern as `attachedFiles`. The display message stores `images: {path, name, thumb}` and the strip clears.
- **Render:** sent user messages show thumbnails (`m.images` → `.ai-msg-image`); click → `openZoom` re-reads full quality from disk (`read_image_data_url`) into a full-screen modal (click-outside / Esc to close).
- **Agent-side Read:** when Claude Code reads one of these images, `chatToolRender` detects the image path (`READ_NAMES` + `isImagePath`), shows the pill with the `image` icon + teal tint (`ai-tcall-image`), and passes `imagePath` to the drawer so clicking the pill shows the picture (not the `[image]` placeholder CC returns).

### Limits & defaults
| Knob | Value | Where |
|---|---|---|
| Max images / message | 10 | `MAX_ATTACHED_IMAGES` |
| Full long-edge cap | 1568px @ q0.82 | `imageAttach.ts` (Anthropic vision sweet-spot) |
| Thumb long-edge | 320px @ q0.7 | `imageAttach.ts` |
| Format | WebP, JPEG fallback | `encode()` |
| On-disk location | `<system temp>/quack-attachments/` | `save_image_attachment` |

### Notes / gotchas
- **Why temp dir, not the workspace:** keeps the user's repo clean. Trade-off: in **Ask** permission mode Claude Code's Read of an out-of-workspace path may surface a permission card (once per image). In Auto/Bypass it's silent. See [015-claude-permission-mode.md](015-claude-permission-mode.md).
- **Why drop is routed in `App.tsx`, not the panel:** Tauri intercepts HTML drop events on the webview, so the only drop signal is the single window-level `onDragDropEvent`. It already opens dropped files as tabs; the chat registers a drop-zone (rect + handler) so image drops over it are consumed first. Pattern is a tiny module-level bus, like `aiTaskStore.ts`.
- **localStorage stays lean:** only `path` + `name` + a tiny `thumb` persist on `ChatMessage.images`; full bytes live on disk and are fetched on demand for the zoom modal. Temp cleanup → modal falls back to the thumb.
- **Additive type:** `ChatMessage.images` is optional, so providers that read only `content` and old saved sessions are unaffected.
- **Bytes travel base64, not `Vec<u8>`:** `invoke` serializes a byte array as a JSON number list (3–4× bloat); base64 over IPC is ~1.33×. Rust uses the `base64` crate.
- **Not built (room to grow):** a paperclip/file-picker button (only Cmd+V + drag today), and "Strada B" multimodal for the direct Anthropic/OpenAI APIs.
