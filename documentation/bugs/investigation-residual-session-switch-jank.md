---
type: investigation
project: quack-app
created: 2026-05-06
last_verified: 2026-05-06
tags: [performance, session-switch, sidebar, todo, follow-up]
---
# Residual jank on cross-project session switch (post-`82cf9e2`)

## Status
**Open.** Two perf fixes shipped in `82cf9e2` (Token Stats panel gate + double `loadAgents`) reduced the freeze, but the user still reports the switch as "scattoso, non smooth". Three outstanding signals from the console logs need root-causing.

## Evidence (from a real cross-project switch)
Picking a session of `Agent Jack` on project `spaceship` while the previous active agent was on `studio-futuro`:

| Signal | Count | Where |
|--------|-------|-------|
| `[loadAvailableSkills] Loading skills for path` | **3×** (studio-futuro, studio-futuro, spaceship) | `src/utils/skillsAndDroidsLoader.ts:39` |
| `[unifiedAgentStorage] Saved 47 agents` | **3×** | `src/services/unifiedAgentStorage.ts:99` |
| `[Tab Update] Setting tab to: Agent Jack` | **4×** | `App.tsx:8107` |
| `[Agent X] 🎯 isActive changed to: false` | many, for many agents | `src/components/TerminalActivityBar.tsx:30` |
| `[loadAgents] 🦆 Loading agents` | 1× *(was 2× before fix)* | `App.tsx:6640` |
| `Loaded CLAUDE.md files` | 2× | `AgentContextPanel.tsx:95` |

The first three are the loud ones. The activity-bar cascade is symptomatic of upstream re-renders.

## Hypotheses (ranked by suspected impact)

### H1 — `unifiedAgentStorage Saved 47 agents` × 3 (likely highest I/O cost)
Three writes of 47 agents each = 141 disk persists per click. Even if the store debounces, the fact that the `Saved` log fires 3× means a subscriber is firing the persist 3×.

**Likely cause:** a Zustand subscription on `terminals` (or `agents`) that triggers `saveAgents()` on every state change. During a session switch, `terminals` mutates multiple times:
1. `setActiveId` flips `alive` flags / activates a different terminal
2. The session-list reload may write `lastActiveSessionId` per terminal
3. A third write from the personality injection or from the `Tab Update` cascade

**Where to look:**
- `src/services/unifiedAgentStorage.ts` — find the call site of the `console.log('[unifiedAgentStorage] Saved 47 agents')` (line 99). Trace which subscriber invokes it.
- Look for `useTerminalStore.subscribe(...)` or `useEffect([terminals])` patterns calling `saveAgents` / `saveTabs`.
- Adjacent log: `[terminalStorage] Saved tabs for 74 terminals` (line 74) — fired 1× in this run but worth verifying it's debounced too.

**Likely fix:** debounce the persist (e.g. 300ms trailing) so a burst of state changes coalesces into one disk write. Or persist only on meaningful field changes (not every render).

### H2 — `loadAvailableSkills` × 3 (highest CPU cost: 108 + 108 + 95 deserializations)
Three calls in this order:
- studio-futuro (108 raw)
- studio-futuro again (108 raw) ← duplicate, same path
- spaceship (95 raw)

The duplicate same-path call is the smoking gun: it means **two different callers** load skills for the same path independently.

**Callers** (from grep): `src/components/ChatInput.tsx:316` (effect on `[basePath]`), `src/components/SkillSelector.tsx:78` (effect on `[projectPath]`), `src/components/kanban/AddKanbanTaskModal.tsx:244` (on submit, irrelevant here). The kanban one only fires on form submit, so the duplicates are between **ChatInput** and **SkillSelector** — or multiple **ChatInput** instances each with its own effect.

**Where to look:**
- How many `<ChatInput>` instances exist in the DOM during a switch? If ChatView remounts via `key`, only one should be present. But `SkillSelector` may be mounted parallel (e.g. inside a portal/popup) and have its own `[projectPath]` effect.
- `ChatInput.tsx:313-328` — single `useEffect([basePath])` calling `loadAvailableSkills`.
- `SkillSelector.tsx:59-78` — duplicate effect on `[projectPath]`.

**Likely fix:** centralize skills loading in a Zustand store with key=path, so multiple consumers share one in-flight request and one cached result. Or memoize `loadAvailableSkills` per-path with a small TTL.

### H3 — `[Tab Update] Setting tab to: Agent Jack` × 4 + activity-bar cascade
Indicates the `tabs` state is being recomputed multiple times during the switch. Each recomputation cascades into every `TerminalActivityBar` re-rendering and logging `isActive changed to: false` (the fact that it logs `false` for the *new* active agent multiple times suggests temporary state where `activeId` is briefly cleared/reset).

**Where to look:**
- `App.tsx:8100-8107` — the "Tab Update" effect that sets the tab. Find its deps.
- `setActiveTabId('chat')` in `handleSessionClick:8211` — this may trigger an unrelated tab-state update before `setActiveId`.
- `TerminalActivityBar.tsx:30` — the `isActive` log; check the prop chain to find what makes it briefly flip to `false`.

**Likely fix:** batch the state updates in `handleSessionClick` (`setActiveTabId` + `setActiveSessionIdExclusive` + `selectSession` + `setActiveId` + `loadDirectory`) inside `unstable_batchedUpdates` (React 18 should batch automatically inside event handlers, but async work like the personality fetch and `loadDirectory` resets that) — or restructure so terminal-state changes happen once.

## Quick wins to try first
1. **H1** — debounce `unifiedAgentStorage.saveAgents` with 300ms trailing. Single-line change, immediate I/O reduction. Verify the `Saved 47 agents` log drops to 1×.
2. **H2** — add a per-path module-level cache (with 2s TTL) inside `loadAvailableSkills`; cheap, reversible, immediately collapses the 3× into 1×.
3. **H3** — measure first. Add `performance.mark` around `handleSessionClick` and watch with React DevTools Profiler before refactoring batching.

## Out-of-scope (not part of this jank, noted for context)
- `Loaded CLAUDE.md files` × 2 from `AgentContextPanel.tsx:95` — likely two consumers (panel + injection check); minor, not a perf concern.
- `📦 Using cached app config` × 2 — cache hits, OK.

## Reference logs
Full console capture from the user's reproduction is in the conversation that produced this entry (2026-05-06, ~17:00). If lost, repro is: open Quack with sessions across multiple projects, click a session in a different project than the currently active one, watch DevTools console.

## Related
- `documentation/bugs/fix-double-loadagents-cross-project-session.md` — the loadAgents fix shipped in `82cf9e2`
- `documentation/bugs/fix-token-stats-panel-blocks-project-switch.md` — the token-stats fix shipped in `82cf9e2`
- `documentation/bugs/bug-delayed-agent-message-stale-closure.md` — same "stale closure / cascading deps" family
