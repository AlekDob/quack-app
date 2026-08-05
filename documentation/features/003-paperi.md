---
type: feature-doc
project: synara
stack: React / Vite / TypeScript / Node
created: 2026-08-04
startDate: 2026-08-04
endDate:
last_verified: 2026-08-05
status: active
tags: [paperi, composer, agents, jack, milo, instructions, keybindings, avatar, transcript, model-selection]
---

## Paperi (Composer Agents)

**Purpose:** Built-in composer agents (Jack / Milo / Nora / Vera / Lia) with per-provider model slots, editable instructions, server-side identity injection that never appears in the user bubble, and a per-turn avatar shown in the transcript.
**Stack:** React / TypeScript (apps/web) + Node orchestration (apps/server) + shared domain (`packages/shared`)

### Files

| Type        | Path                                                             | Exports/Purpose                                                                                                                                   |
| ----------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Model/Type  | `packages/shared/src/paperi.ts`                                  | Ids, builtins, house style, identity block, `resolveCycledPaperoId`                                                                               |
| Model/Type  | `packages/contracts/src/orchestration.ts`                        | Optional `paperoId` / `paperoInstructions` on turn message payloads                                                                               |
| Model/Type  | `packages/contracts/src/keybindings.ts`                          | `papero.next` command                                                                                                                             |
| Store/State | `apps/web/src/paperi/store.ts`                                   | `synara:paperi:v1` — active agent, overrides, model slots                                                                                         |
| Util        | `apps/web/src/paperi/resolve.ts`                                 | Fallback B: slot for current provider only (never switches provider)                                                                              |
| Util        | `apps/web/src/paperi/index.ts`                                   | Web barrel                                                                                                                                        |
| Util        | `apps/web/src/lib/duckAvatars.ts`                                | Codetta duck avatar URLs                                                                                                                          |
| Component   | `apps/web/src/components/chat/PaperoPill.tsx`                    | Agent picker + discreet chevron → instructions submenu; `PaperoAvatar` delegates to `ChatStreamIdentity`'s `RoundAvatarImage`                     |
| Component   | `apps/web/src/components/chat/ChatStreamIdentity.tsx`             | Shared transcript identity: `RoundAvatarImage`, `ChatStreamAvatarSlot`, `ChatStreamMetaRow` (label · model · effort flex row) — used by paperi and [005-subagent-avatars.md](005-subagent-avatars.md) |
| Component   | `apps/web/src/components/ChatView.tsx`                           | Pill wiring, select/save/reset, Tab cycle, send freeze, footer tier reset key; stamps `modelSelection` on the optimistic user message              |
| Hook        | `apps/web/src/hooks/useHandleNewThread.ts`                       | `applyPaperoModelSlot` — new draft threads pick up the active papero's saved model slot                                                           |
| Util        | `apps/web/src/components/composerFooterLayout.ts`                | `composerFooterPlanForTier` — measured demotion ladder incl. `showPaperoRole`                                                                     |
| Component   | `apps/web/src/components/chat/MessagesTimeline.tsx`              | Renders the turn's `ChatStreamAvatarSlot` + `ChatStreamMetaRow` once at the top of each assistant turn's block (`resolveStreamIdentity` picks papero vs subagent) |
| Logic       | `apps/web/src/components/chat/MessagesTimeline.logic.ts`         | `deriveMessagesTimelineRows` computes `showPaperoAvatar`/`avatarPaperoId`/`avatarModelSelection` per row; hoisted through settled-turn folding and row-stability diffing; `optionalModelSelectionsEqual` guards row-stability diffing against decode-identity churn |
| Type/Store  | `apps/web/src/types.ts`, `apps/web/src/storeNormalization.ts`    | `ChatMessage.paperoId` / `ChatMessage.modelSelection` threaded client-side from the read model                                                    |
| Config      | `apps/web/src/keybindings.ts`                                    | Client fallback: bare `Tab` → `papero.next`                                                                                                       |
| Config      | `apps/server/src/keybindings.ts`                                 | Default: `tab` → `papero.next` when `!terminalFocus`                                                                                              |
| Util        | `apps/web/src/shortcutsSheet.ts`                                 | Settings / Mod+/ sheet entry “Next agent”                                                                                                         |
| Service     | `apps/server/src/provider/paperoPromptInjection.ts`              | `buildInlinePaperoInstructions` for provider input                                                                                                |
| Service     | `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts` | Prepends identity to turn/steer input                                                                                                             |
| Service     | `apps/server/src/orchestration/decider.ts`                       | Persists `paperoId` / `paperoInstructions` on message events; stamps `modelSelection` (turn's actual model/effort) on the turn's user message event |
| Service     | `apps/server/src/orchestration/projector.ts`                     | In-memory message projection of papero + `modelSelection` fields                                                                                  |
| Migration   | `apps/server/src/persistence/Migrations/089_ProjectionThreadMessagesPaperoId.ts` | `projection_thread_messages.papero_id` — without this the papero avatar reverted to Milo once the optimistic message reconciled with the server row |
| Migration   | `apps/server/src/persistence/Migrations/090_ProjectionThreadMessagesModelSelection.ts` | `projection_thread_messages.model_selection_json` — per-turn model/effort survives reconciliation and reload                                |
| Service     | `apps/server/src/persistence/Services/ProjectionThreadMessages.ts`, `Layers/ProjectionThreadMessages.ts`, `projectionThreadMessageRow.ts`, `ProjectionSnapshotQuery.ts`, `ProjectionPipeline.ts` | `papero_id` / `model_selection_json` wired through row codec, INSERT/UPSERT/SELECT, and streaming-append COALESCE |
| Test        | `apps/web/src/paperi/store.test.ts`                              | Store defaults / instructions overrides                                                                                                           |
| Test        | `apps/web/src/paperi/resolve.test.ts`                            | Fallback B + cycle order                                                                                                                          |
| Test        | `apps/server/src/provider/paperoPromptInjection.test.ts`         | Injection bounds / override                                                                                                                       |
| Test        | `apps/web/src/keybindings.test.ts`                               | Tab → `papero.next` (+ Ctrl+Tab still recent-view)                                                                                                |
| Test        | `packages/contracts/src/keybindings.test.ts`                     | Schema accepts `papero.next`                                                                                                                      |

### Assets

| Path                                         | Role                  |
| -------------------------------------------- | --------------------- |
| `apps/web/public/images/ducks/duck1–35.jpeg` | Builtin agent avatars |
| `apps/web/public/images/ducks/jack.jpeg`     | Jack avatar           |

### Data Flow

`PaperoPill` / `Tab` → `onSelectPapero` → `usePaperoStore` (per-thread active id + optional model slot) → `thread.turn.start` (`paperoId`, optional `paperoInstructions`, `modelSelection`) → decider/projector (SQL projection: migrations 089/090) → `ProviderCommandReactor` → `buildInlinePaperoInstructions` prepended to provider input (not bubble text)

Render side: `ChatMessage.paperoId`/`modelSelection` → `deriveMessagesTimelineRows` tracks the "current turn owner" from the latest user message and stamps it on that turn's rows → `MessagesTimeline` resolves `resolveStreamIdentity` (papero, or the subagent identity inside a subagent thread — see [005-subagent-avatars.md](005-subagent-avatars.md)) → shared `ChatStreamAvatarSlot` + `ChatStreamMetaRow` (`ChatStreamIdentity.tsx`).

### Key Functions

- `listComposerPaperi() → PaperoDefinition[]` — Jack then Milo/Nora/Vera/Lia
- `resolveCycledPaperoId({ currentId, direction }) → PaperoId` — wrap-around cycle
- `resolvePaperoModelSelection({ map, currentProvider }) → ModelSelection \| null` — Fallback B
- `buildPaperoIdentityBlock({ definition, overrides }) → string` — `[Agent identity]…[/Agent identity]`
- `buildInlinePaperoInstructions({ paperoId, paperoInstructions?, maxChars }) → string` — server inject text
- `onSelectPapero(paperoId) → void` — activate; apply slot if present; toast
- `onComposerCommandKey("Tab") → true` — Lexical path cycles when no slash/mention menu
- `applyPaperoModelSlot(threadId) → void` — on fresh draft-thread creation, resolves the active papero's saved slot for the current provider and applies it, so a new thread's model matches its default papero instead of the last-used sticky model
- `composerFooterPlanForTier(tier, hasContextMeter) → { showContextMeter, showPaperoRole, ... }` — measured demotion ladder; `showPaperoRole` demotes at the same tier as the context meter

### State

- `activePaperoIdByThreadId`: `Record<threadId, PaperoId>` — per-thread active agent (localStorage `synara:paperi:v1`)
- `modelSelectionByProviderByPaperoId`: `Partial<Record<PaperoId, Partial<Record<ProviderKind, ModelSelection>>>>` — explicit saved slots
- `overridesByPaperoId`: `Partial<Record<PaperoId, overrides>>` — custom instructions / label / avatar
- `paperoIdForSendRef`: `PaperoId` — frozen at send so mid-stream pill flips do not relabel the turn
- Default active: `builder` (Milo)

### Behavior

- Builtins only (v1): `jack` · `builder`(Milo) · `debugger`(Nora) · `reviewer`(Vera) · `companion`/`assistant`(Lia)
- Picking an agent never switches provider; missing slot keeps current composer model/effort
- Model slots saved only via “Save current model for \<provider\>”
- Instructions: row click selects; small chevron opens right submenu (edit / Reset / Save)
- Narrow composer pill: avatar + name only (`hideRole`); role visibility now comes from the measured `composerFooterLayout` tier (`showPaperoRole`), not a compact-footer boolean — the role demotes at the same tier as the context meter, so it survives at normal pane widths
- Fresh draft threads apply the active papero's saved model slot for the current provider (`applyPaperoModelSlot`) so the composer model matches the papero shown in the pill, instead of falling back to the last-used sticky model
- Footer tier re-measures when Plan mode's Plan/Implement chips toggle `composerFooterHasWideActions` (included in `composerFooterPlanInputsKey`) — otherwise the footer stayed stuck on a demoted tier with model/effort/context meter hidden after the chips appeared
- **Tab** cycles agents in the Lexical composer (not when slash/mention/folder menu open)
- **Shift+Tab** remains plan-mode toggle; **Ctrl+Tab** remains recent-view switcher
- Identity injection is server-side only — user bubble stays clean
- **Transcript avatar persists across reconciliation:** `paperoId` travels on the `thread.message-sent` event and the optimistic client message, but until migration 089 the SQL projection (`projection_thread_messages`, the web read model's source) had no column for it — the optimistic bubble showed the right papero, then flipped back to Milo (`DEFAULT_PAPERO_ID`) the moment the server row replaced it. Fixed by adding `papero_id` to the projection and wiring it through the row codec, upsert, streaming-append, and both SELECT paths.
- While deriving timeline rows, the most recent user message's `paperoId` is tracked as the "turn owner" and stamped on the first assistant row of that turn (`showPaperoAvatar`/`avatarPaperoId`). Switching papero mid-conversation (Tab) does **not** retarget past turns — each turn keeps the avatar of whoever was active when it was written. Settled-turn folding (`collapseSettledTurns`) hoists the flag onto the surviving terminal row so it isn't lost when non-terminal assistant rows are spliced away. Avatar renders via `resolveEffectiveDefinition` (zustand store), so a later avatar _override_ for that papero id does update historical turns — only the _active papero selection_ is frozen per turn, not the papero's own definition.
- **Per-turn model/effort row:** next to the avatar, `ChatStreamMetaRow` renders `label · modelLabel · statusLabel` (via `resolveThreadModelSummary`) for the model/effort the turn actually ran with — not the thread's current selection, which a later turn can change. The decider stamps `modelSelection` on the turn's user message (mirroring `paperoId`'s pattern); it needed the same SQL-projection treatment (migration 090, `model_selection_json`) since the read model is what the web app actually renders from. `avatarModelSelection` is threaded and folded through `MessagesTimeline.logic.ts` the same way as `avatarPaperoId`, with `optionalModelSelectionsEqual` (identity-tolerant deep compare) in the row-stability diff so a fresh JSON decode of the same selection doesn't churn the row.

### Config

- `papero.next`: bare `Tab`, `when: !terminalFocus` (server default + client fallback)
- Storage key: `synara:paperi:v1`
- Shared export: `@synara/shared/paperi`
