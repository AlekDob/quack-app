---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-12
last_verified: 2026-07-20
tags: [presets, agents, model-selection, effort, organigramma, avatar, backend-agnostic, prompt-injection, settings, chat-identity, companion, team-sync, user-instructions]
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
| 4 built-in presets: Milo, Nora, Vera, Lia (+ Jack as organigramma root) | `builtins.ts` |
| Append-style instruction blocks (with "Do not" sections) | `instructions.ts` |
| Per-backend capability + tier→model map, degradation | `capabilities.ts` |
| User override store (`lcp.presets.v1`) | `settings.ts` |
| Resolution (`resolvePresetConfig` / `resolvePresetConfigFor`) | `resolvePresetConfig.ts` |
| Custom preset discovery (`.codetta/presets/*.md`) | `loadCustomPresets.ts` |
| Custom preset write-path (create + update `.md` in place) | `createPreset.ts` |
| Avatar (duck pool default + durable upload) | `avatarStore.ts` |
| Shared Claude Code permission-mode options (Ask/Plan/Auto-edit/Auto/Agent) | `permModes.ts` |
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

### Shipped defaults (built-ins + Jack)

Jack is **not** in `PRESET_ORDER` (`presetId === null` in chat) but shares the same override
mechanism (`JACK_PRESET_ID = "jack"`). The four presets below are non-deletable built-ins; users
may override any field via Team → edit → Save, or **Reset to default** to revert.

**Default agent for new chats = Milo** (`DEFAULT_PRESET_ID = "builder"`), not Jack. Every fresh
chat / reset silently calls `applyDefaultPreset()` → `applyPreset("builder")` (3 sites in
`AIChatPanel.tsx`), forcing Milo's model/effort/mode. Legacy sessions with no saved `presetId`
still fall back to `null`/Jack on load (`?? null`), so old chats aren't retroactively rewritten.

| Identity | id | Model tier | Effort | Output | Mode (`permMode`) | Avatar |
|---|---|---|---|---|---|---|
| Jack (root) | `jack` | reasoning | high | structured | plan | `/jack.jpeg` |
| Milo · Builder (default) | `builder` | reasoning (Opus) | medium | concise | Agent (`bypassPermissions`) | `duck3` |
| Nora · Debugger | `debugger` | balanced | medium | structured | auto | `duck16` (pinned feminine) |
| Vera · Reviewer | `reviewer` | balanced | medium | terse-review | auto | `duck28` (pinned feminine) |
| Lia · Companion | `companion` | balanced | low | terse-review | auto | `duck22` |

**Lia** (`companion`) is the dialogue preset — brainstorm and clarify goals without shipping
code. Instruction block in `instructions.ts` (`PRESET: Companion`). Escalation hint: hand off to
Jack (plan) or Milo (build) once the path is clear.

**Avatars:** `BUILTIN_AVATARS` in `builtins.ts` pins duck numbers via `duckAvatarFor(id, "duckN")`
so Nora/Vera stay visibly feminine and Milo/Lia keep stable faces across releases (hash-derived
avatars are only a fallback for custom presets and subagents).

**Jack thinking:** shipped default `thinking: true` (pairs with reasoning/high for planning).

### User instructions (all agents, including Jack)

**Where users tune behavior:** per-agent free-form instructions live in the **Team** tab
(Whiteboard organigramma), not in Settings. Click any agent card — Jack at the root, or
Milo/Nora/Vera/Lia/custom presets — → **Edit** → **Instructions** textarea → **Save changes**.

| Concern | Path |
|---|---|
| Team UI | `WhiteboardOrganigramma.tsx` (Jack root) + `WhiteboardPresets.tsx` + `AgentCreateDrawer.tsx` |
| Built-in override store | `lcp.presets.v1` via `setPresetOverrides(id, { instructions })` (`settings.ts`) |
| Custom preset body | `.codetta/presets/<slug>.md` markdown body (`createPreset.ts` / `updatePreset`) |
| Prompt injection | `AIChatPanel.sendUserText` → `getPresetInstructionsFor(def)`; non-CC → `sysParts`, Claude Code → `ccTurnContext` (survives resume, see "Default agent + identity") |
| Merge | `effectivePresetDefinition` + `buildPresetInstructions` (`resolvePresetConfig.ts`, `instructions.ts`) |

**Jack specifically:** `presetId === null` in chat, but overrides use `JACK_PRESET_ID = "jack"`.
Editing Jack in Team persists the same way as Milo/Nora — one drawer, one store, one injection
path. New chats no longer default to Jack — see "Default agent + identity survives resume".

**Removed (2026-07-13):** Settings → "Jack — Your preferences" duplicated this surface.
Deleted `src/jackPrefs.ts`, `src/components/jackSettings.tsx`, `appendJackUserPreferences` in
`AIChatPanel`, JSON editor key `lcp.jack.customInstructions`, and `.jack-prefs-*` CSS. Legacy
`lcp.jack.customInstructions` in `localStorage` is **inert** — copy any text into Team → Jack →
Instructions.

**Precedence on each turn** (assistant system prompt assembly in `AIChatPanel`):

1. Active-agent persona line — `quackAgentCorePrompt(coreIdentity)` in `sysParts[0]`, where
   `coreIdentity` is the active preset's `{ label, role }` (Milo by default), Jack only when
   `presetId === null` (see `005-jack-duck-identity.md`)
2. Workspace rules / brain / Works context (when applicable)
3. **Active preset instructions** (`getPresetInstructionsFor` — includes Jack when no preset picked)
4. No separate global "user preferences" block anymore

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
- On pick (`applyPreset` in `AIChatPanel.tsx`): resolves the active `PresetDefinition` via
  `resolveActivePresetDef(id, customPresets)` — built-ins and Jack always re-read
  `effectivePresetDefinition` from `localStorage` overrides, not a stale `presetChoices` cache —
  then sets `ccEffort`/`ccThinking`/`selected` model from `resolvePresetConfigFor(def, provider)`
  — only for agentic backends (claude-code/cursor-cli/opencode-cli). Custom presets load
  independent of `selectedIsCC` (unlike the subagent catalog) since a preset's instructions apply
  to every backend, not just Claude Code.
- On every turn: `getPresetInstructionsFor(def)` is injected — but the channel depends on the
  backend, because Claude Code **resumes send only the latest user message**, so `sysParts` (the
  system message) vanishes after turn one:
  - **Non-CC** (Ollama/OpenAI/Anthropic/Cursor/OpenCode resend the full system each turn) →
    appended to `sysParts`.
  - **Claude Code** (`skipAllInlining`) → an `[Agent identity]` block (identity line + role
    instructions) is pushed into `ccTurnContext`, which is prepended to every user message
    (`ccPrefix`) and therefore survives resume. This is what keeps a preset changed mid-chat — and
    the agent's very identity — effective on turn 2+ (see "Default agent + identity survives resume").
  - When `def.source === "custom"` the block is wrapped with
    `[Preset "X" — from this workspace's .codetta/presets/, not verified by Quack]` — see Security
    note below.
- Instructions are backend-agnostic text (no `BackendId` needed); model/effort/thinking
  resolution does need one, so `applyPreset` only touches those knobs for the 3 known agentic
  providers.

### Composer keyboard shortcuts

In `AIChatPanel.tsx`'s textarea `onKeyDown`, placed AFTER the `@`-mention and slash-command
autocomplete blocks so those popovers keep first claim on Tab when open:

- **Tab** (no modifiers) cycles the active primary agent: Jack → Milo → Nora → Vera → Lia → back
  to Jack, calling the same `applyPreset` the composer picker uses.
- **Shift+Tab** cycles the Claude Code permission mode (Ask → Plan → Auto-edit → Auto → Agent),
  reading/writing `PERM_MODE_OPTIONS` (`src/presets/permModes.ts`) — the same list backing the
  mode menu and `AgentCreateDrawer`'s "Mode" segmented control, so there's one source of truth
  for the 5-value scale everywhere it appears.
- The composer's hint row advertises both ("Tab agent" / "Shift+Tab mode").

### Chat message identity (avatar + name per message)

Every assistant message used to render a hardcoded `<img src="/jack.jpeg">` + "Jack", even after
switching to Milo/Nora/Vera — nothing snapshotted which agent was active when a message was
sent, so the header never reflected preset switches mid-conversation.

**Module:** `src/chatTurnAgent.ts` (+ `chatTurnAgent.test.ts`) — pure helpers shared by
hydrate, render, and stream commit so Jack/Milo cannot diverge between stamp and prompt.

| Helper | Role |
|---|---|
| `streamingBubbleAgentId(frozen, live)` | In-flight bubble keeps send-time agent |
| `resolveMessageAgentId(msg, session)` | `null` = Jack; `undefined` = fall back to session |
| `backfillAssistantAgentIds(msgs, session)` | Stamp missing ids on load |
| `sessionAgentFromStored(presetId?)` | Disk omit → Jack (`null`) |
| `displayAgentForAssistantRow(...)` | One path for streaming vs committed rows |

- `ChatMessage.agentId?: string | null` (`src/ai.ts`) — display-only field, the preset id that
  owned the turn when it **started** (`null` = Jack; omitted/`undefined` = legacy). Set at every
  commit site in `AIChatPanel.tsx`: the unified streaming-loop commit (works for every provider —
  Ollama, Claude Code, Cursor CLI all funnel through the same `assistantMsg` push), the
  process-replay finalize (reattaching to a running CC/Cursor subprocess after reload), and the
  in-progress streaming bubble / persist checkpoints.
- **Mid-turn freeze:** `turnAgentId` is captured at send (and at replay pin). A SubagentPill
  switch while tools/stream are still running updates the composer for the **next** message only
  — it must not reattribute the in-flight bubble (toast already says "from your next message").
- **Chat-session switch:** rows missing `agentId` fall back to **this session's** `presetId`
  (not hardcoded Jack). Remount seeds preset + messages from the RAM chat cache
  (`cachedSessionSeed`) so switching Jack↔Milo sessions doesn't flash the wrong face.
  Hydrate / `openSession` / provider recover also sync send-path refs (`presetIdRef`, model,
  effort, mode, thinking) so a fast send after switch cannot see the previous chat's agent.
- **Pass-the-ball race:** `applyPreset` validates the definition, then writes `presetIdRef`
  (+ model/effort/mode/thinking refs) **before** `setState`. `sendUserText` reads those refs for
  `[Agent identity]`, message `agentId`, and `chatStream` knobs — so a send in the same turn as
  handoff cannot stamp Jack while Milo speaks ("Sono Milo…" under a Jack header). See bug
  `003-agent-identity-mismatch.md` and `088`.
- `msgIdentityFor(agentId)` in `AIChatPanel.tsx` resolves an `agentId` to `{ name, role, avatar }`:
  `null`/`undefined` → `effectivePresetDefinition(getJackDefinition())`; otherwise looks it up in
  `presetChoices` (falls back to Jack if the preset was since deleted). Same resolution the
  composer picker already uses — one lookup, not a second copy.
- Old saved sessions have no `agentId` on their messages — they render via the session preset
  after backfill (Jack sessions stay Jack; Milo sessions show Milo). Rows already persisted with
  a wrong stamp are not rewritten.

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
  - **builtin** (Milo/Nora/Vera/Lia have no backing file) → `setPresetOverrides(id, {...})`
    persists an override layer in `lcp.presets.v1` instead (returns `boolean` — drawer toasts on
    storage failure). A "Reset to default" button (builtin edits only) calls
    `clearPresetOverrides(id)` to drop the layer and revert to the shipped values.
- `effectivePresetDefinition(def, overrides?)` (`resolvePresetConfig.ts`) is the single merge
  point both the UI and the resolver read through — it folds label/role/avatar/modelTier/
  effort/thinking/outputStyle/permMode/instructions overrides onto the base definition. Both
  `AIChatPanel`'s `presetChoices` and `WhiteboardPane`'s `data.presets` map built-ins through it.
  **Team → chat sync:** `subscribePresetSettings` in `AIChatPanel` bumps `presetOverridesTick`
  and silently re-runs `applyPreset` for the active `presetId` (including Jack when `null`) so
  effort/mode/model knobs update immediately after Save in the organigramma drawer. `WhiteboardOrganigramma`
  also subscribes so Jack's root card and preset chips re-render without waiting for a disk refresh.
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
- `applyPreset(id, opts?)` resolves via `resolveActivePresetDef` — Jack when `id` is `null`, or a
  built-in/custom preset by id — one code path for both, including the CC-only `permMode` apply
  (gated the same way as effort/thinking: only when the resolved provider is `claude-code`).
- **New chats silently apply Jack's saved config** via `applyJackDefaultsIfConfigured()` — but
  ONLY when `getPresetOverrides("jack")` is non-empty, so a user who's never touched Jack in the
  organigramma sees zero behavior change (still falls back to the pre-existing
  `readEffort()`/`readDefaultPermMode()` localStorage defaults).

### Default agent + identity survives resume (2026-07-16)

Two coupled fixes so new chats start **and stay** on the right agent.

**1. Default agent = Milo (not Jack).** `DEFAULT_PRESET_ID = "builder"` (`builtins.ts`) is the
baseline for every fresh chat. The old `applyJackDefaultsIfConfigured()` is replaced by
`applyDefaultPreset()` / `applyPreset(...)` at fresh-chat sites. Milo's shipped `modelTier`
was bumped `balanced` → `reasoning`, so the default is **Opus** + **Agent**
(`bypassPermissions`).

**087 regression (2026-07-20):** `addAIChat` seeds an empty RAM body so hydrate always takes
the `found` branch. That path used to restore sparse knobs / `presetId ?? null` (Jack) and
**skip** `applyDefaultPreset` — new Agent Mode sessions showed Milo's pill (initial state)
with last-used Sonnet/Auto. Fix: empty hydrate without a persisted `model` calls
`applyPreset(presetIdForEmptyHydrate(found))` (`aiChatPresetApply.ts`); seeds include
`presetId: DEFAULT_PRESET_ID`; if discovery has not reported an agentic CLI yet,
`presetKnobsPendingRef` retries once availability lands.

Legacy sessions **with messages** and no saved `presetId` still fall back to `null`/Jack on
load — old chats are not retroactively rewritten.

**2. Identity survives CC resume ("Milo speaks as Jack" bug).** The active agent's identity
(`quackAgentCorePrompt(coreIdentity)`) and preset role-instructions used to live only in
`sysParts` (the system message). Claude Code resumes send **only the latest user message**, so
after turn 1 the system message — identity included — vanished; a resumed CC turn (or a preset
switched mid-chat) kept the turn-1 identity and answered as the wrong agent even though the
message header showed the new one. Fix: for CC (`skipAllInlining`), push an `[Agent identity]`
block into `ccTurnContext` (prepended to every user message via `ccPrefix`), the same channel
already used for the orchestrator contract + Works protocol. Non-CC providers keep the plain
`sysParts` append.

| Concern | Where |
|---|---|
| Default preset id | `DEFAULT_PRESET_ID = "builder"` (`src/presets/builtins.ts`, exported via barrel) |
| Fresh-chat apply | Empty hydrate → `shouldApplyPresetOnEmptyHydrate` + `applyPreset` (`aiChatPresetApply.ts`); also `/new`, delete-reset |
| Empty-seed preset | `store.addAIChat` → `putCachedSession({ …, presetId: DEFAULT_PRESET_ID })` |
| Provider race | `presetKnobsPendingRef` retries when CC/Cursor availability lands |
| Milo shipped tier | `builtins.ts` `builder.defaults.modelTier: "reasoning"` (→ `claude-code:opus`) |
| CC identity injection | `AIChatPanel.sendUserText` — `[Agent identity]` block in `ccTurnContext` when `skipAllInlining` |

**Prior root cause still relevant** (`applyPreset` + empty picker): `applyPreset` reads the
agentic backend from the composer's `selected` model; a brand-new tab mounts with `selected === ""`
until discovery hydrates, so `agenticProviderForPresetApply()` (`AIChatPanel.tsx`) falls back to
the first available agentic CLI (Claude Code → Cursor → OpenCode). Without it the model/effort
block was skipped and discovery pinned the balanced tier.

**Precedence reminder** (`resolveModel` in `resolvePresetConfig.ts`): per-preset `model` pin >
Settings tier map (`lcp.tierModelMap.v1`) > `capabilities.modelForTier` (Milo/Jack shipped =
`reasoning` → `claude-code:opus`).

### Gotchas

- **Storage split is load-bearing.** `.codetta/presets/` vs `.claude/agents/` is not
  incidental — it's what keeps "preset" (session-shaping) and "subagent" (delegable, isolated
  Task) from merging into one runtime concept. Don't point the preset loader at
  `.claude/agents/`.
- **CC resume drops `sysParts` — identity too.** Claude Code resumes send only the latest user
  message, so anything in the system message (`sysParts`) — including the `You are {label}`
  identity line — is gone from turn 2 on. Anything that must persist across a CC session
  (identity, preset role-instructions, orchestrator contract, Works protocol) belongs in
  `ccTurnContext` (the `ccPrefix` on every user message), **never** in a "first message only"
  branch. This is the "Milo speaks as Jack" bug — see "Default agent + identity survives resume".
- **Built-ins have no `.path`.** `PresetDefinition.path` is `null`/absent for built-ins — the
  organigramma and any edit UI must gate on `preset.source === "custom"` before writing
  frontmatter.
- **Avatar upload before a slug exists.** `AgentCreateDrawer` uploads to a random per-session
  `draft-<id>` filename (not the final agent slug) since the preset doesn't have one until
  `createPreset()` runs — avoids two open drawers colliding on the same temp file.
- **`ModelTier`, not model name**, is the only thing a preset's shipped default may specify —
  keeps the whole system usable on any future backend without touching `types.ts`.
- **Stale user overrides.** Shipped defaults can change between releases; users who edited a
  built-in before the update still have their `lcp.presets.v1` layer until they hit **Reset to
  default** in the Team drawer.
- **Team save without Save.** Clicking the drawer scrim or Cancel discards edits — only **Save
  changes** writes overrides / `.md` files.
- **No Settings instructions pane.** Per-agent instructions are Team-only (`062` — User
  instructions). Do not reintroduce a parallel `lcp.jack.*` store; Jack uses `lcp.presets.v1`
  like every other built-in.
- **Empty picker on new tab.** If Jack's model still shows Sonnet after a new chat, confirm Jack
  was saved in Team (`lcp.presets.v1` key `jack` non-empty) and that Claude Code is available —
  `applyPreset` only sets model knobs for agentic CLIs.
- **Apply-then-send must use refs.** Never read React `presetId` / `selected` / mode from the
  render closure for a send that follows `applyPreset` in the same turn (Pass the ball, Tab
  cycle + Enter). Sync refs inside `applyPreset` first — see bug `003` and
  `chatTurnAgent.test.ts` ("pass-ball apply-then-send contract").
- **Identity stamp vs prompt must share one id.** `agentAtSend = presetIdRef.current` drives
  both `[Agent identity]` and `ChatMessage.agentId` — splitting them recreates "Sono Milo under
  Jack".

### Related docs

- `018-whiteboard-organigramma.md` — the tree/frontmatter-write pattern presets extend (skill
  linking was removed from this tab, see Gotchas).
- `004-subagent-mentions.md` — the delegable-subagent runtime presets are deliberately NOT part
  of; `SubagentPill` now hosts both concerns in one merged picker.
- `016-image-attachments.md` — the compress/encode pipeline `avatarStore.ts` reuses.
- `022-chat-composer.md` — composer row hosting the merged `SubagentPill`.
- `005-jack-duck-identity.md` — Jack persona line vs per-user instruction overrides (Team).
- `088-plan-milo-handoff.md` — Pass the ball must share the apply-then-send ref contract.
- `documentation/bugs/003-agent-identity-mismatch.md` — Jack header / Milo voice write-up.
- `031-model-discovery-cache.md` — the live model catalog `TierModelSettings` reads via
  `getProvider(id).listModels()` for Cursor CLI/OpenCode/Claude Code.
