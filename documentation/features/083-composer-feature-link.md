---
type: feature
project: quack-desktop
created: 2026-07-17
last_verified: 2026-07-17
status: active
related: [054-works-layer.md, 072-composer-mention-chips.md, 022-chat-composer.md, 041-mention-file-preview.md, 009-agent-hub.md]
tags: [features, composer, mention, inline-highlight, fuzzy-search, monaco, drawer, cursor-style]
---

# 083 — Composer feature link (inline + pill popover)

**Purpose:** Link a chat to a `documentation/features/NNN-slug.md` from the composer — Cursor-style inline `@slug` in the textarea, a discrete icon pill for fuzzy search, and `@` mention rows in the chat popover. No duplicate chip row; hub shows a short **Feature** badge only.

**Perf:** Feature catalog loads only when the pill or `@` menu opens (`listFeatures`). No FS watch on the chat hot path. `featureId` / `featureLabel` live on `AIChatDescriptor` (zero hydrate for pill/hub).

## Surfaces

| Surface | Behaviour |
|---|---|
| `ComposerFeaturePill` | Icon-only (`file-text`); `--feature` mint green. Hidden while `featureId` is set. Opens fuzzy-search popover. |
| Popover list | Fuzzy on slug / title / path; ↑↓ + Enter; **infinite scroll** (24 rows/page, `IntersectionObserver` sentinel). |
| `@` mention menu | `MentionSuggestions` — compact file-style row (title + slug meta); pick inserts `@slug` + sets `featureId`. |
| Inline textarea | `ComposerInputHighlight` mirror — `@slug` green underline; `/skill` orange (`--skill`). Textarea is transparent (`ai-input--ghost`). |
| Unlink | Delete `@slug` from input → clears `featureId` (prev-input guard avoids false clear on session wipe). |
| Agent hub row | `WorkHubBadge` → label **Feature** only; full `featureLabel` in `title` tooltip (chat title stays readable). |

## Link fields

| Field | Meaning |
|---|---|
| `AIChatDescriptor.featureId` | Slug e.g. `054-works-layer` |
| `AIChatDescriptor.featureLabel` | Cached display label (hub tooltip, inject) |

Inject: `getFeatureInjectEnabled` (default **off**) → `buildFeatureTurnContext` (`featureTurnContext.ts`). Plan merge prefers linked feature (`planFeatureMerge.ts`, `068`).

## Popover actions (when linked)

Open linked drawer · Clear link · Inject on/off (`setFeatureInjectEnabled`).

## Key files

| Concern | File |
|---|---|
| Pill + popover + infinite scroll | `src/components/ComposerFeaturePill.tsx` |
| Inline highlight (skill + feature tokens) | `src/composerInputHighlight.ts`, `ComposerInputHighlight.tsx` |
| `@` rows | `src/components/MentionSuggestions.tsx` |
| Wire-up (accept, unlink, pill `onLinked`) | `src/components/AIChatPanel.tsx` |
| Hub badge | `src/components/works/WorkHubBadge.tsx` |
| Catalog | `src/featureCatalog.ts` |
| Tokens | `src/App.css` — `--feature`, `.ai-composer-feature-*`, `.ai-input-highlight-*` |

## Tests

| File | Covers |
|---|---|
| `src/composerInputHighlight.test.ts` | Token spans + HTML for skill/feature |

## Related

- `054-works-layer.md` — catalog, drawer, timeline, inject ladder
- `072-composer-mention-chips.md` — brain/file/agent chips (feature/skill are inline, not chips)
- `022-chat-composer.md` — composer shell layout
- `065-works-drawer-ux.md` — `FeatureDocDrawer` edit mode (Monaco full height)
