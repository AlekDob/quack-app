---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-07-13
tags: [claude-code, cursor-cli, opencode-cli, chat, images, attachments, paste, drag-drop, compression, modal, vision]
---

## Chat image attachments (Cmd+V / Finder drop)

**Purpose:** Let the user attach up to 10 images to an **agentic** chat message — by pasting (Cmd/Ctrl+V) or dragging from Finder/Explorer. Images are compressed client-side, persisted to a temp dir, then delivered to the provider by the cheapest path per bridge ("Strada A": no direct multimodal API in Quack).

**Scope:** `claude-code`, `cursor-cli`, `opencode-cli`. Cloud APIs (Anthropic/OpenAI/Ollama) show a hint and no-op.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Logic + bus | `src/imageAttach.ts` | `compressAndSave`, `attachFromBlob`, `rehydrateMessageImages`, `userMessageDisplayText`, `providerAcceptsImages` |
| Queue | `src/composerQueue.ts` | `QueuedComposerMessage`, `queueItemFromSend`, `queueImagesAsAttachments`, persist strip |
| Composer | `src/components/AIChatPanel.tsx` | `attachedImages`, `appendImages`, queue drain with images |
| User bubble | `src/components/UserMessageBar.tsx` | `UserMessageImageStrip` above the sticky bar |
| Provider types | `src/providers/types.ts` | `supportsVision?` on `ProviderModel`; `imageAttachments?` on `chat()` |
| Router | `src/ai.ts` | `chatStream(..., imageAttachments?)` passthrough |
| OpenCode | `src/providers/openCode.ts` | `FilePartInput` in `promptAsync` body |
| Cursor | `src/providers/cursorCode.ts` | paths inlined via turn context (same as CC) |
| Drop router | `src/App.tsx` | `tryRouteDropToChat` before open-as-tab |
| IPC | `src/ipc.ts` | `save_image_attachment`, `read_image_data_url` |
| Backend | `src-tauri/src/fs_ops.rs` | temp dir `quack-attachments/` |
| Type | `src/ai.ts` | `ChatMessage.images?: {path, name, thumb}[]` |
| Tool chip | `src/components/chatToolRender.tsx` | Read of image path → teal pill + drawer preview |

### Provider delivery matrix
| Provider | Mechanism | Vision requirement |
|---|---|---|
| **Claude Code** | Turn context: "View with Read tool: `/path`" | CC Read tool (always) |
| **Cursor CLI** | Turn context: "Analyze using your tools: `/path`" | Agent reads file via CLI tools ([headless docs](https://cursor.com/docs/cli/headless)) |
| **OpenCode** | SDK `parts: [{ type:"file", mime, url: file://… }]` | Model `modalities.input` must include `"image"` or OpenCode strips parts |

### Data flow
- **Paste / drop:** → `appendImages` → `providerAcceptsImages(providerId)` guard → compress → `save_image_attachment`.
- **Send (idle):** paths/provider-specific delivery (table above); `ChatMessage.images` keeps `{ path, name, thumb }`; composer strip clears.
- **Send (busy):** same attachments enqueue via `pushQueue(text, images)` — see **`039-composer-queue.md`**.
- **Reload:** `rehydrateMessageImages` rebuilds thumbs from disk paths on saved user messages.
- **OpenCode gate:** if model catalog says `supportsVision === false`, toast + abort before spawn.
- **Render:** 52px thumbs in `.ai-user-msg-images` above the user bar (`030`); agent Read → image tool chip (unchanged).

### Limits & defaults
| Knob | Value | Where |
|---|---|---|
| Max images / message | 10 | `MAX_ATTACHED_IMAGES` |
| Full long-edge cap | 1568px @ q0.82 | `imageAttach.ts` |
| Thumb long-edge | 320px | `imageAttach.ts` |
| On-disk location | `<temp>/quack-attachments/` | `fs_ops.rs` |
| Allowed providers | CC, Cursor CLI, OpenCode | `IMAGE_ATTACH_PROVIDER_IDS` |

### Notes / gotchas
- **Why temp dir:** keeps repo clean; CC Ask mode may permission-prompt on out-of-workspace Read (015).
- **Cursor ≠ native vision:** no `--image` CLI flag; path-in-prompt only.
- **OpenCode custom models:** add `modalities.input: ["text","image"]` in `opencode.json` or images never reach the model.
- **localStorage lean:** only path + thumb on `ChatMessage.images`; full bytes on disk.
- **Not built:** multimodal for direct Anthropic/OpenAI API chats ("Strada B").
