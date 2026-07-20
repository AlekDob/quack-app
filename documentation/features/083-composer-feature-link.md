---
type: feature
project: quack-desktop
created: 2026-07-17
last_verified: 2026-07-20
status: active
related: [054-works-layer.md, 072-composer-mention-chips.md, 022-chat-composer.md, 041-mention-file-preview.md, 009-agent-hub.md]
tags: [features, composer, mention, inline-highlight, fuzzy-search, monaco, drawer, cursor-style, pin, auto-link]
---

# 083 — Composer feature link (inline + pin chip)

**Purpose:** Link a chat to a `documentation/features/NNN-slug.md` — dual UX: Cursor-style inline `@slug` from the textarea, or a **persistent pin chip** next to the mint icon (icon pick / agent auto). Hub shows a short **Feature** badge.

**Perf:** Feature catalog loads only when the pill or `@` menu opens (`listFeatures`). No FS watch on the chat hot path. `featureId` / `featureLabel` / `featurePinned` live on `AIChatDescriptor` (zero hydrate for pill/hub).

## Cite paths

| Path | UI | Persist |
|---|---|---|
| `@` mention in input | Green `@slug` underline in textarea | Draft token; `featureId` **unpinned** (no chip) |
| Icon fuzzy pick | Mint **chip** next to icon (`104 · …`); no `@` insert | `featureId` + `featurePinned` on chat |
| Agent Write/Edit feature `.md` | Same pin chip as icon | Auto when `featureId` empty (`featureChatAutoLink`) |

## Surfaces

| Surface | Behaviour |
|---|---|
| `ComposerFeaturePill` | Always mounted. Icon-only when unpinned; icon + chip when `featurePinned`. Opens fuzzy popover. |
| Chip | Label from `featureLabel`; ellipsis; × clears pin. Click opens popover. |
| Popover list | Fuzzy on slug / title / path; ↑↓ + Enter; **infinite scroll** (24 rows/page). |
| `@` mention menu | Inserts `@slug` + sets `featureId` **without** pin. |
| Unlink inline | Delete `@slug` → clears `featureId` only if `!featurePinned`. |
| Unlink pin | Chip × or popover Clear link → `setAIChatFeature(null)`. |
| Agent hub row | `WorkHubBadge` → **Feature**; tooltip = `featureLabel`. |

## Link fields

| Field | Meaning |
|---|---|
| `AIChatDescriptor.featureId` | Slug e.g. `054-works-layer` |
| `AIChatDescriptor.featureLabel` | Cached display label (chip, hub tooltip, inject) |
| `AIChatDescriptor.featurePinned` | `true` from icon/auto — shows chip; survives session switch |

Inject: `getFeatureInjectEnabled` (default **off**) → `buildFeatureTurnContext`. Plan merge prefers linked feature (`068` / `088`).

## Auto-pin

During a turn, successful Write/Edit/MultiEdit of `documentation/features/NNN-*.md` are tracked; after the stream, the **last** such slug is pinned if the chat still has no `featureId`. See `featureChatAutoLink.ts` (`featureSlugFromSuccessfulEdit` + `pinFeatureOnChat`).

## Popover actions (when pinned)

Open linked drawer · Clear link · Inject on/off (`setFeatureInjectEnabled`).

## Key files

| Concern | File |
|---|---|
| Pill + chip + popover | `src/components/ComposerFeaturePill.tsx` |
| Auto-pin from tool edits | `src/featureChatAutoLink.ts` |
| Inline highlight | `src/composerInputHighlight.ts`, `ComposerInputHighlight.tsx` |
| `@` rows | `src/components/MentionSuggestions.tsx` |
| Wire-up (accept, unlink, tool_result) | `src/components/AIChatPanel.tsx` |
| Hub badge | `src/components/works/WorkHubBadge.tsx` |
| Catalog | `src/featureCatalog.ts` |
| Tokens | `src/App.css` — `--feature`, `.ai-composer-feature-*` |

## Tests

| File | Covers |
|---|---|
| `src/composerInputHighlight.test.ts` | Token spans + HTML for skill/feature |
| `src/featureChatAutoLink.test.ts` | Path → slug gates for feature docs |

## Related

- `054-works-layer.md` — catalog, drawer, timeline, inject ladder
- `072-composer-mention-chips.md` — brain/file/agent chips (inline `@` features stay non-chip)
- `022-chat-composer.md` — composer shell layout
- `065-works-drawer-ux.md` — `FeatureDocDrawer` edit mode
