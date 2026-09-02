---
type: feature-doc
project: quack
stack: TypeScript
created: 2026-09-02
startDate: 2026-09-02
endDate: 2026-09-02
last_verified: 2026-09-02
status: active
tags: [claude, model-picker, runtime-discovery, effort, fast-mode]
---

## Claude runtime model capabilities

**Purpose:** A Claude model unknown to Quack's static table (new release, e.g. a future Fable/Opus/Sonnet point release) still shows a working effort ladder, fast mode, and auto-compact/ultracode controls in the model picker, sourced live from the Claude Agent SDK instead of waiting on a Quack release.

**Stack:** TypeScript (`apps/server`, `apps/web`, `packages/shared`, `packages/contracts`)

### Background

Quack already asks the SDK for its model list (`ClaudeAdapter.listModels` → `supportedModels()`) and merges it ahead of the static table (`mergeDynamicModelOptions`), so a brand-new model slug already appeared in the picker. But `mapClaudeModelInfo` discarded the SDK's `description`, `supportedEffortLevels`, and `supportsFastMode`, and `claudeAgent` was excluded from the providers whose capabilities are read at runtime (`getRuntimeAwareModelCapabilities`). An unrecognized slug fell through to `EMPTY_MODEL_CAPABILITIES` — it appeared in the menu but had no effort options, no fast mode, no auto-compact window.

### Files

| Type   | Path                                                          | Exports/Purpose                                                                                          |
| ------ | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Adapter | `apps/server/src/provider/Layers/ClaudeAdapter.ts`            | `mapClaudeModelInfo` — now carries `description`, `supportedReasoningEfforts`, `supportsFastMode` through to `ProviderListModelsResult` |
| Logic  | `apps/web/src/components/chat/runtimeModelCapabilities.ts`     | `getRuntimeAwareModelCapabilities` — `claudeAgent` now reads effort/fast-mode from the runtime descriptor; re-appends the Quack-only modes (`ultrathink`, `ultracode`) the CLI never lists |
| Test   | `apps/web/src/components/chat/runtimeModelCapabilities.test.ts` | Covers an unknown Claude slug getting its ladder from runtime discovery while keeping `ultracode` and auto-compact |
| Shared | `packages/shared/src/model.ts`                                  | `getModelCapabilities` — an unrecognized `claude-*` slug falls back to Opus 5's static capabilities (auto-compact window options, ultracode) instead of `EMPTY_MODEL_CAPABILITIES` |
| Test   | `apps/server/src/provider/Layers/ClaudeAdapter.test.ts`         | `discovers Claude model capabilities before a session starts` — asserts the richer `ProviderListModelsResult` shape |

### Data Flow

`ClaudeAdapter.listModels` calls the SDK's `supportedModels()` → `mapClaudeModelInfo` maps each entry to `ProviderModelDescriptor` (slug, resolvedModel, name, description, supportedReasoningEfforts, supportsFastMode, supportsAutoMode) → RPC `providerListModels` → web `providerModelsQueryOptions` → `useProviderModelCatalog.runtimeModelsByProvider.claudeAgent` → `resolveRuntimeModelDescriptor` matches the selected slug → `getRuntimeAwareModelCapabilities({ provider: "claudeAgent", ... })` builds the effective `ModelCapabilities` for the composer's effort/fast-mode controls.

### Key Functions

- `mapClaudeModelInfo(model: ModelInfo) → ProviderListModelsResult["models"][number]` (`ClaudeAdapter.ts`) — SDK → wire shape, now lossless for effort/fast-mode/description.
- `getRuntimeAwareModelCapabilities({ provider, model, runtimeModel }) → ModelCapabilities` (`runtimeModelCapabilities.ts`) — for `claudeAgent`, `supportsFastMode` and `reasoningEffortLevels` come from `runtimeModel` when present; `quackOnlyModes` (entries with `controlSource: "prompt-prefix" | "provider-setting"`, i.e. ultrathink/ultracode) from the static table are always re-appended since the CLI doesn't report them.
- `getModelCapabilities(provider, model) → ModelCapabilities` (`packages/shared/src/model.ts`) — unknown `claude-*` slugs (but not slash-qualified custom slugs like `claude/my-model`) inherit Opus 5's static capabilities as a base, so auto-compact window options and ultracode survive even before runtime discovery resolves.

### Behavior

- A newly released first-party Claude model (`claude-*` slug) shows up in the picker with a working effort ladder and correct fast-mode support as soon as the installed Claude CLI/SDK knows about it — no Quack release required.
- User-defined custom slugs with a provider prefix (`claude/my-model`) deliberately keep `EMPTY_MODEL_CAPABILITIES` as the static fallback — nothing is forced onto an arbitrary runtime.
- Ultrathink (prompt-prefix mode) and Ultracode (provider-setting mode) are Quack-side conventions the CLI never lists; they're preserved by re-appending the static entries that declare `controlSource: "prompt-prefix"` or `"provider-setting"`.

### Verification

- `cd packages/shared && bunx vitest run src/model.test.ts` — 88 passed.
- `cd apps/web && bunx vitest run runtimeModelCapabilities providerModelOptions useProviderModelCatalog` — 29 passed.
- `cd apps/server && bunx vitest run src/provider/Layers/ClaudeAdapter.test.ts` — 135 passed, 1 pre-existing unrelated failure (`injects the canonical Quack browser MCP into an Opus 4.8 session`, reproduced on `main` before this change via `git stash`).
- `bun fmt`, `bun lint`, `bun typecheck` — clean (pre-existing errors in unrelated in-progress files only: `FunctionaryCityScene.tsx`, `LinearCreateIssueDialog.browser.tsx`).

### Related

- Diary: [2026-09-02](../diary/2026-09-02.md)
