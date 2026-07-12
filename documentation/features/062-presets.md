---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-12
last_verified: 2026-07-12
tags: [presets, agents, model-selection, effort, organigramma, avatar, backend-agnostic, prompt-injection, settings, chat-identity]
---

## Presets

**Purpose:** A preset is a reusable working mode (role, default model tier, default effort,
appended instructions, output style) that shapes the CURRENT chat session. **Not a subagent** —
it never opens an isolated context window or gets spawned as a Task; it just configures the
session you're already in. Goal: consistent behavior, task-fit model selection, and lower token
burn on long sessions.

**Stack:** Pure TypeScript domain module (`src/presets/`), no new dependency. Wired into the
existing chat send flow, composer, and the Whiteboard organigramma.

### Domain model (`src/presets/`)

| Concern | File |
|---|---|
| Types — `PresetId`, `BackendId`, `ModelTier`, `PresetDefinition`, `EffectivePresetConfig`, `BackendCapabilities` | `types.ts` |
| 3 built-in presets: Milo (Builder), Nora (Debugger), Vera (Reviewer) | `builtins.ts` |
| Append-style instruction blocks (with "Do not" sections) | `instructions.ts` |
| Per-backend capability + tier→model map, degradation | `capabilities.ts` |
| User override store (`lcp.presets.v1`) | `settings.ts` |
| Resolution (`resolvePresetConfig` / `resolvePresetConfigFor`) | `resolvePresetConfig.ts` |
| Custom preset discovery (`.codetta/presets/*.md`) | `loadCustomPresets.ts` |
| Custom preset write-path (create + update `.md` in place) | `createPreset.ts` |
| Avatar (duck pool default + durable upload) | `avatarStore.ts` |
| Shared Claude Code permission-mode options (Ask/Plan/Auto-edit/Auto/Bypass) | `permModes.ts` |
| User tier→model overrides for dynamic-catalog backends | `tierModelOverrides.ts` |
| Barrel | `index.ts` |

**Key separation:** shipped defaults (`PresetDefinition.defaults`) vs. user overrides
(`settings.ts`, keyed by preset id) vs. resolved `EffectivePresetConfig` — computed fresh each
turn by `resolvePresetConfig(presetId, backendId)`.

**Backend-agnostic model selection:** a preset's default is a `ModelTier`
(`reasoning | balanced | fast`), never a hardcoded model name. Each `BackendCapabilities` entry
maps tiers to its own concrete models (e.g. Claude Code: reasoning→opus, balanced→sonnet). A
user's concrete model override always wins over the tier.

**Capability matrix today** (`capabilities.ts`):

| Backend | available | model override | effort | thinking |
|---|---|---|---|---|
| claude-code | yes | yes | yes | yes |
| cursor-cli | yes | yes | no | no |
| opencode-cli | yes | yes | no | no |
| codex | no (no bridge yet) | — | — | — |

`resolvePresetConfig` degrades gracefully per-capability and returns `warnings: string[]`
describing what was skipped — nothing silently fails.

### User tier→model overrides (Settings)

**Problem it fixes:** switching preset never changed the model on Cursor CLI/OpenCode. Root
cause: `capabilities.ts`'s `modelForTier` mapped every tier for those two backends to the same
`:default` sentinel — their model catalogs are discovered LIVE (CLI/SDK probe), so Quack can't
ship fixed model names for them the way it does for Claude Code (opus/sonnet/haiku).

Rather than hardcode guesses, the user maps tiers to real models themselves:

| Concern | Path |
|---|---|
| Override store (`lcp.tierModelMap.v1`) | `src/presets/tierModelOverrides.ts` |
| Settings UI (3 cards: Claude Code, Cursor CLI, OpenCode) | `src/components/TierModelSettings.tsx` |
| Mounted in | `src/components/SettingsModal.tsx` → `Section title="Preset model tiers"` (right after "AI Providers (Bring Your Own Key)") |

- Same map/pub-sub pattern as `settings.ts`: `{ [backendId]: { reasoning?, balanced?, fast?: ModelId } }`,
  `getTierModelOverride`/`setTierModelOverride`/`subscribeTierModelOverrides`.
- **Resolution precedence** in `resolveModel` (`resolvePresetConfig.ts`): explicit per-preset
  model pin (`UserPresetOverrides.model`) > this tier override > the static capability default.
- Each `TierModelSettings` card calls `getProvider(backendId).listModels()` — the SAME live
  catalog discovery Quack already uses for the model picker, no new discovery code — and writes
  a qualified `"<backend>:<modelId>"` string via `makeQualifiedModel`.
- Claude Code is included too (even though its static defaults are already sensible) so all 3
  agentic backends get one consistent settings surface; overriding it is optional.
- **UI note:** native `<select>` elements size to their selected option's text by default, which
  made the 3 cards visually misaligned (each select a different width). Fixed with
  `.settings-tier-select-row .settings-select { flex: 0 0 260px }` — always verify a repeated-row
  UI like this with more than one populated option before calling it done; auto-sizing form
  controls are an easy miss.

### Live wiring (chat session)

- `ChatSession.presetId?: string` (`src/chatHistory.ts`) — persisted like `ccEffort`/`model`; a
  plain string (not the narrower `PresetId` union) so it can hold a custom preset's slug too.
- **One merged composer picker, not two.** `SubagentPill` (`src/components/SubagentPill.tsx`)
  now shows "primary agents" (Jack + built-in/custom presets) ABOVE a divider, with the real
  delegable Claude Code subagents below — so the technical subagent catalog doesn't bury the
  primary choice. Picking a preset row calls `onSelectPreset` (→ `applyPreset`); picking a
  subagent still delegates via Task as before (004). The two are mutually exclusive in this one
  pill — picking either clears the other. There is no separate preset-only chip anymore (the
  earlier `PresetPopover` component was deleted once this merged).
- No "Planner" preset — Jack (the PM, root of the organigramma) already covers planning;
  splitting that into a 4th preset would duplicate his job.
- On pick (`applyPreset` in `AIChatPanel.tsx`): looks up the `PresetDefinition` from
  `presetChoices` (built-ins + workspace's custom ones, loaded via `loadCustomPresets`), then sets
  `ccEffort`/`ccThinking`/`selected` model from `resolvePresetConfigFor(def, provider)` — only for
  agentic backends (claude-code/cursor-cli/opencode-cli). Custom presets load independent of
  `selectedIsCC` (unlike the subagent catalog) since a preset's instructions apply to every
  backend, not just Claude Code.
- On every turn: `getPresetInstructionsFor(def)` is appended to `sysParts` — **every turn, not
  just the first**, because Claude Code only flattens the system message into the prompt on the
  first turn (`src/providers/claudeCode.ts`); re-appending keeps a preset changed mid-chat
  effective on the next message. When `def.source === "custom"` the block is wrapped with
  `[Preset "X" — from this workspace's .codetta/presets/, not verified by Quack]` — see Security
  note below.
- Instructions are backend-agnostic text (no `BackendId` needed); model/effort/thinking
  resolution does need one, so `applyPreset` only touches those knobs for the 3 known agentic
  providers.

### Composer keyboard shortcuts

In `AIChatPanel.tsx`'s textarea `onKeyDown`, placed AFTER the `@`-mention and slash-command
autocomplete blocks so those popovers keep first claim on Tab when open:

- **Tab** (no modifiers) cycles the active primary agent: Jack → Milo → Nora → Vera → back to
  Jack, calling the same `applyPreset` the composer picker uses.
- **Shift+Tab** cycles the Claude Code permission mode (Ask → Plan → Auto-edit → Auto → Bypass),
  reading/writing `PERM_MODE_OPTIONS` (`src/presets/permModes.ts`) — the same list backing the
  mode menu and `AgentCreateDrawer`'s "Mode" segmented control, so there's one source of truth
  for the 5-value scale everywhere it appears.
- The composer's hint row advertises both ("Tab agent" / "Shift+Tab mode").

### Chat message identity (avatar + name per message)

Every assistant message used to render a hardcoded `<img src="/jack.jpeg">` + "Jack", even after
switching to Milo/Nora/Vera — nothing snapshotted which agent was active when a message was
sent, so the header never reflected preset switches mid-conversation.

- `ChatMessage.agentId?: string | null` (`src/ai.ts`) — display-only field, the live `presetId`
  at the moment an assistant message is committed (`null`/`undefined` = Jack). Set at every
  commit site in `AIChatPanel.tsx`: the unified streaming-loop commit (works for every provider —
  Ollama, Claude Code, Cursor CLI, OpenCode all funnel through the same `assistantMsg` push),
  the process-replay finalize (reattaching to a running CC/Cursor/OpenCode subprocess after
  reload), and the in-progress streaming bubble (so it's correct even before the turn commits).
- `msgIdentityFor(agentId)` in `AIChatPanel.tsx` resolves an `agentId` to `{ name, role, avatar }`:
  `null`/`undefined` → `effectivePresetDefinition(getJackDefinition())`; otherwise looks it up in
  `presetChoices` (falls back to Jack if the preset was since deleted). Same resolution the
  composer picker already uses — one lookup, not a second copy.
- Old saved sessions have no `agentId` on their messages — they render as Jack, which is
  correct (presets didn't exist yet when those messages were sent).

### Configurable + creatable agents (organigramma)

Presets are surfaced as configurable **agents** — each with a proper first name (e.g. "Milo") and
a role subtitle (e.g. "Builder"), mirroring Jack's own identity card — in the Whiteboard's
Organigramma tab (`018-whiteboard-organigramma.md`), alongside the existing delegable-subagent
tree, but stored separately so they never leak into the `@`-mention menu or Task delegation:

| Concern | Path |
|---|---|
| Custom preset files | `<root>/.codetta/presets/*.md` (NOT `.claude/agents/`) |
| Organigramma "Presets" group | `src/components/WhiteboardPresets.tsx` |
| "New agent" drawer (Cursor-style slide-over) | `src/components/AgentCreateDrawer.tsx` |
| Avatar picker popover (duck grid + upload) | `src/components/AvatarPicker.tsx` |
| Mounted from | `src/components/WhiteboardOrganigramma.tsx` (`WhiteboardPresetGroup`) |
| Data merge (built-in + custom) | `src/components/WhiteboardPane.tsx` → `WhiteboardData.presets` |

Each preset node shows avatar + name + role + model-tier/effort chips. **Both built-in and custom
presets are fully editable** from the same drawer:

- **"+ New agent"** opens `AgentCreateDrawer` — a right slide-over (clones `SessionUsageDrawer`'s
  mount/animation, reuses the shared `.tool-drawer` shell) with name, role, avatar picker,
  one-line purpose, model tier / effort / output style segmented controls, and an instructions
  textarea → `createPreset()` writes `.codetta/presets/<slug>.md`.
- **Click any preset's card** to open the SAME drawer in edit mode (`editing={preset}` prop),
  pre-filled with its CURRENT effective values (shipped default + any saved override, via
  `effectivePresetDefinition` — never blank). Where it saves depends on `preset.source`:
  - **custom** → `updatePreset(path, input)` rewrites the `.md` in place (the slug/filename never
    changes even if the display name does, so `lcp.presets.v1` overrides keyed on that id and any
    `ChatSession.presetId` referencing it stay valid).
  - **builtin** (Milo/Nora/Vera have no backing file) → `setPresetOverrides(id, {...})` persists
    an override layer in `lcp.presets.v1` instead. A "Reset to default" button (builtin edits
    only) calls `clearPresetOverrides(id)` to drop the layer and revert to the shipped values.
- `effectivePresetDefinition(def, overrides?)` (`resolvePresetConfig.ts`) is the single merge
  point both the UI and the resolver read through — it folds label/role/avatar/modelTier/
  effort/thinking/outputStyle/instructions overrides onto the base definition. Both
  `AIChatPanel`'s `presetChoices` and `WhiteboardPane`'s `data.presets` map built-ins through it,
  and `AIChatPanel` subscribes to `subscribePresetSettings` so an edit made from the organigramma
  shows up in the composer picker without a remount.
- **Avatar** — defaults to the same deterministic duck pool subagents use (`duckAvatarFor`,
  `src/subagents.ts`, `DUCK_COUNT` exported for reuse); click any custom preset's avatar (or the
  one being drafted in the drawer) to open `AvatarPicker` — a grid of the 35 shipped ducks plus an
  "Upload image" button via the native file dialog. The popover's `z-index` (1101) is deliberately
  above `.tool-drawer` (1000) — it opens both from the organigramma AND from inside the drawer
  itself, and a lower value left it rendering invisibly behind the drawer panel.
- Custom preset frontmatter schema: `name`, `role`, `description`, `avatar`, `model` (a
  `ModelTier` keyword), `effort`, `outputStyle`; the markdown **body** is the appended
  instructions.

**Skill linking was removed from the organigramma** (the old "drag a skill chip onto an agent" /
free "unassigned skills" pool) — it buried the actual org chart under dozens of skill chips.
Agent/preset nodes are now just avatar + name + role/description; skills still exist as a concept
elsewhere (Overview counters, Workflows `.md` export) but no longer render in the tree.

### Avatar persistence (Rust)

The chat image-attachment pipeline (`016-image-attachments.md`) writes to the OS temp dir —
fine for a prompt attachment, not for something that must survive restarts. Presets get a
**separate, durable** command:

- `save_persistent_image(dir, filename, dataB64)` (`src-tauri/src/fs_ops.rs`) — same
  decode + filename-sanitize logic as `save_image_attachment`, but writes to a caller-chosen
  directory (`.codetta/avatars/`) instead of `std::env::temp_dir()`.
- Frontend: `src/ipc.ts` → `fs.savePersistentImage`; `src/presets/avatarStore.ts` wraps it with
  the same compress/encode helpers `imageAttach.ts` uses for chat attachments (exported for
  reuse: `loadImage`, `scaleToCanvas`, `encode`, `stripDataUrl`).

### Security note — custom presets are workspace files

A custom preset's instructions are appended to the system prompt on every turn it's active,
exactly like `loadWorkspaceRules` already does for `.codetta/rules.md`/`.cursorrules` — same
trust tier, not a new hole. Two things keep the exposure bounded:

1. **Never auto-applied.** Opening a workspace does not select a preset; the user must
   deliberately pick one from the composer picker or the organigramma. A malicious repo can ship
   a `.codetta/presets/*.md` file, but it only takes effect if someone clicks it.
2. **Labeled as unverified in the prompt itself.** When the active preset's `source === "custom"`,
   its instructions are wrapped with `[Preset "X" — from this workspace's .codetta/presets/, not
   verified by Quack]` before being appended — so the model sees it as workspace-provided context,
   not an authoritative Quack directive it must obey unconditionally.

This does NOT fully close the risk (a convincingly-named preset in an untrusted repo could still
mislead a user into clicking it) — it's the same residual risk workspace rules and `.claude/agents/*.md`
already carry. Treat it accordingly: review a new custom preset's instructions before selecting it
in a workspace you don't fully trust.

### Permission mode + Jack is an agent too

- `PresetDefaults.permMode` / `UserPresetOverrides.permMode` (`string | null`, `null` = "Ask")
  force the Claude Code permission mode whenever the preset is active — same 5-value scale as the
  composer's mode menu, sourced from one shared constant: `src/presets/permModes.ts`
  (`PERM_MODE_OPTIONS`), imported by both `AgentCreateDrawer` (the "Mode" segmented control) and
  `AIChatPanel`'s mode menu/Shift+Tab cycle.
- **Jack is not a `PresetDefinition` in `PRESET_ORDER`** (he's the organigramma root,
  `presetId === null`), but he's editable through the exact same drawer:
  `getJackDefinition()` / `JACK_PRESET_ID = "jack"` (`builtins.ts`) synthesize a definition with no
  backing file; editing him persists to the override store precisely like Milo/Nora/Vera
  (`setPresetOverrides("jack", {...})`). His root card in `WhiteboardOrganigramma.tsx` opens the
  same `AgentCreateDrawer` (state now lives in that component, shared with `WhiteboardPresetGroup`
  via `onEdit`/`onCreate` callbacks rather than each owning its own drawer).
- `applyPreset(id, opts?)` resolves either a real preset (`presetChoices.find`) or Jack's
  definition when `id` is `null` — one code path for both, including the CC-only `permMode` apply
  (gated the same way as effort/thinking: only when the resolved provider is `claude-code`).
- **New chats silently apply Jack's saved config** via `applyJackDefaultsIfConfigured()` — but
  ONLY when `getPresetOverrides("jack")` is non-empty, so a user who's never touched Jack in the
  organigramma sees zero behavior change (still falls back to the pre-existing
  `readEffort()`/`readDefaultPermMode()` localStorage defaults).

### Gotchas

- **Storage split is load-bearing.** `.codetta/presets/` vs `.claude/agents/` is not
  incidental — it's what keeps "preset" (session-shaping) and "subagent" (delegable, isolated
  Task) from merging into one runtime concept. Don't point the preset loader at
  `.claude/agents/`.
- **First-turn flattening (Claude Code).** Preset instructions are re-appended every turn
  specifically to survive this; don't move the injection to a "first message only" branch.
- **Built-ins have no `.path`.** `PresetDefinition.path` is `null`/absent for built-ins — the
  organigramma and any edit UI must gate on `preset.source === "custom"` before writing
  frontmatter.
- **Avatar upload before a slug exists.** `AgentCreateDrawer` uploads to a random per-session
  `draft-<id>` filename (not the final agent slug) since the preset doesn't have one until
  `createPreset()` runs — avoids two open drawers colliding on the same temp file.
- **`ModelTier`, not model name**, is the only thing a preset's shipped default may specify —
  keeps the whole system usable on any future backend without touching `types.ts`.

### Related docs

- `018-whiteboard-organigramma.md` — the tree/frontmatter-write pattern presets extend (skill
  linking was removed from this tab, see Gotchas).
- `004-subagent-mentions.md` — the delegable-subagent runtime presets are deliberately NOT part
  of; `SubagentPill` now hosts both concerns in one merged picker.
- `016-image-attachments.md` — the compress/encode pipeline `avatarStore.ts` reuses.
- `022-chat-composer.md` — composer row hosting the merged `SubagentPill`.
- `031-model-discovery-cache.md` — the live model catalog `TierModelSettings` reads via
  `getProvider(id).listModels()` for Cursor CLI/OpenCode/Claude Code.
