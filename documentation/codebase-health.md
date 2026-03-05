---
type: codebase-health
project: quack-app
generated: 2026-03-05
language: TypeScript (React 18 + Tauri/Rust)
overall_score: D
---

# Codebase Health Report — Quack App

> Generated: 2026-03-05 | Language: TypeScript (React 18 + Tauri) | Score: **D**

## Summary

| Category | Issues | Severity |
|----------|--------|----------|
| Dead Code | 35 files, 27 exports, 8 assets | High |
| Performance | 29 large files, 9 mega-functions, 41 leaky useEffects | High |
| Code Smells | 874 console.logs, 122 `any`, 5 unused deps | High |
| Tech Debt | 4 stale TODOs, 1 placeholder URL in prod | Medium |

**Overall Score: D** — Il progetto ha accumulato debito tecnico significativo. Il problema principale e' `App.tsx` (12,993 righe, 40x il limite). La codebase funziona ma ha bisogno di un cleanup strutturale per scalare in modo sostenibile.

---

## 1. Dead Code

### Unreferenced Files (35)

> Entry points esclusi: `main.tsx`, `App.tsx`, `brain-main.tsx`, `browser-main.tsx`, `pip.tsx`, `preview.tsx`, `tab-popout-entry.tsx`, `terminal-entry.tsx`, `terminal-window-entry.tsx`

#### High Confidence (32 — safe to remove)

| File | Age | Suggested Action |
|------|-----|------------------|
| `src/components/NewTerminalModal.old.tsx` | 3 months | Backup `.old.` — rimuovere |
| `src/examples/StructuredOutputsExample.tsx` | 3 months | Esempio obsoleto — rimuovere |
| `src/examples/ZustandMigrationExample.tsx` | 4 months | Migrazione completata — rimuovere |
| `src/contexts/ZustandProvider.tsx` | 4 months | Context mai montato — rimuovere |
| `src/services/kanbanShellService.ts` | 7 weeks | Service senza consumer — verificare e rimuovere |
| `src/components/MetroLine.tsx` | 4 months | Rimuovere |
| `src/components/TerminalGroup.tsx` | 4 months | Rimuovere |
| `src/components/TerminalQuickActions.tsx` | 4 months | Rimuovere |
| `src/components/TaskAgentAvatar.tsx` | 4 months | Rimuovere |
| `src/components/MCPServerModal.tsx` | 4 months | Rimuovere o integrare |
| `src/components/GitOperationsDropdown.tsx` | 4 months | Rimuovere |
| `src/components/BranchManager.tsx` | 4 months | Rimuovere |
| `src/components/NewAgentModal.tsx` | 3 months | Rimuovere |
| `src/components/RuleEditor.tsx` | 3 months | Rimuovere (sostituito da `RuleViewer`) |
| `src/components/TokenWarningBanner.tsx` | 3 months | Rimuovere |
| `src/components/PluginsPanel.tsx` | 6 weeks | Feature sospesa — rimuovere |
| `src/components/StorageMetrics.tsx` | 6 weeks | Rimuovere |
| `src/components/BackgroundTaskLogs.tsx` | 3 months | Rimuovere |
| `src/components/BackgroundTasksSidebarButton.tsx` | 3 months | Rimuovere |
| `src/components/HookBadge.tsx` | 3 months | Rimuovere |
| `src/components/PowerBadge.tsx` | 8 weeks | Rimuovere |
| `src/components/SlashCommandAutocomplete.tsx` | 4 weeks | Rimuovere |
| `src/components/ToolGifInline.tsx` | 8 weeks | Rimuovere |
| `src/components/ToolGifOverlay.tsx` | 8 weeks | Rimuovere |
| `src/components/modal-steps/CreateRuleModal.tsx` | 3 months | Rimuovere |
| `src/components/modal-steps/StepStarterBundles.tsx` | 4 weeks | Rimuovere |
| `src/components/settings/categories/IntegrationsSettings.tsx` | 4 weeks | Rimuovere o reintegrare |
| `src/hooks/useClaudeEventListener.ts` | 3 months | Rimuovere |
| `src/hooks/useCurrentProject.ts` | 3 months | Rimuovere |
| `src/hooks/useSpeechRecognition.ts` | 4 months | Rimuovere |
| `src/hooks/useSupertagConfig.ts` | 3 months | Rimuovere |
| `src/hooks/useTerminalWindows.ts` | 4 months | Rimuovere |
| `src/hooks/useWhisperRecognition.ts` | 4 months | Rimuovere |

#### Medium Confidence (3 — likely WIP, do not remove)

| File | Age | Note |
|------|-----|------|
| `src/AppRefactored.tsx` | 3 weeks | Import commentato in `main.tsx` — decidere se continuare il refactor |
| `src/components/MessageListVirtualized.tsx` | 2 weeks | Probabile WIP |
| `src/components/CustomPermissionSelect.tsx` | 3 days | WIP attivo |

### Unused Exports (27)

| File | Export | Type |
|------|--------|------|
| `src/utils/platform.ts` | `getPlatform`, `isWindows`, `getModifierKey` | function |
| `src/utils/agentAvatars.ts` | `getFallbackDuckUrl`, `getRandomAvatar`, `hasAgentAvatar`, `getAvailableAvatars` | function |
| `src/utils/version.ts` | `parseVersion`, `compareVersions`, `formatVersion` | function |
| `src/utils/projectUtils.ts` | `isValidProjectPath`, `formatProjectName` | function |
| `src/utils/testModeStorage.ts` | `getTestModeStoragePatterns`, `logTestModeStorage` | function |
| `src/utils/agentNames.ts` | `AGENT_NAMES`, `getAllAgentNames`, `searchAgentNames` | const/function |
| `src/utils/skillsAndDroidsLoader.ts` | `formatSkillsForClaudeMd`, `formatDroidsForClaudeMd` | function |
| `src/services/giphyService.ts` | `GiphySearchResponse`, `TOOL_GIF_KEYWORDS`, `getKeywordsForTool`, `clearGifCache`, `getGifCacheSize` | type/const/function |
| `src/services/modelService.ts` | `getModels`, `getDefaultModel` | function |
| `src/components/store/storeConstants.ts` | `TabConfig` | interface |

### Orphan Assets (8)

| Asset | Type | Action |
|-------|------|--------|
| `src/views/MemoryGraphTabView.css` | CSS | View TSX eliminata — rimuovere CSS |
| `src/views/SecondBrainTabView.css` | CSS | View TSX eliminata — rimuovere CSS |
| `images/cyberducks.png` | Image | Duplicato di `public/` — rimuovere |
| `images/quackapp-macos-transparent.png` | Image | Non referenziato — archiviare |
| `images/quackapp.png` | Image | Non referenziato — archiviare |
| `public/images/cyberduck.png` | Image | Possibilmente obsoleto |
| `public/images/rpg-equip.png` | Image | Non referenziato — rimuovere |

### Stale TODOs (4)

| File:Line | Comment | Age |
|-----------|---------|-----|
| `src/App.tsx:1951` | `TODO: Remove this old webhook-based telegram system` | 4 months |
| `src/App.tsx:1756` | `TODO: scroll to line/column in editor` | 4 months |
| `src/browser-main.tsx:16` | `TODO: Navigate the first tab to this URL` | 4 months |
| `src/App.tsx:11352` | `TODO: Re-enable when auth flow is properly implemented` | 4 weeks |

---

## 2. Performance Issues

### Large Files (29 over 300 lines)

| # | File | Lines | Suggested Split |
|---|------|-------|-----------------|
| 1 | `src/App.tsx` | **12,993** | **CRITICO**: estrarre `AppBootstrap`, `AppEventListeners`, `AppSessionHandlers`, `AppTabRenderers` |
| 2 | `src/components/RepositoryGroup.tsx` | 3,363 | Separare `SortableAgent`, drag-drop, worktree section |
| 3 | `src/components/ChatInput.tsx` | 2,618 | Estrarre `handleKeyDown`, slash commands in hooks |
| 4 | `src/types.ts` | 1,909 | Split per dominio: `types/session.ts`, `types/terminal.ts`, `types/kanban.ts` |
| 5 | `src/components/TerminalSidebar.tsx` | 1,614 | Estrarre rename, sort, drag in sub-componenti |
| 6 | `src/components/kanban/AddKanbanTaskModal.tsx` | 1,240 | Separare wizard steps |
| 7 | `src/components/StreamMessage.tsx` | 1,098 | Estrarre `TeamModeBadge`, diff builder, tool widgets |
| 8 | `src/AppRefactored.tsx` | 1,086 | File inattivo in bundle — decidere o rimuovere |
| 9 | `src/components/TerminalWindowApp.tsx` | 1,042 | Estrarre toolbar, event handlers |
| 10 | `src/hooks/useClaudeChat.ts` | 986 | Estrarre stream, abort, token parsing |
| 11 | `src/components/SidePanel.tsx` | 935 | Separare per sezione |
| 12 | `src/hooks/useMarketplace.ts` | 921 | Estrarre API calls, install logic |
| 13 | `src/components/ChatView.tsx` | 898 | Estrarre scroll, diff, message grouping |
| 14 | `src/components/AgentSelector.tsx` | 892 | Estrarre filtri, avatar, keyboard nav |
| 15 | `src/components/FileExplorer.tsx` | 853 | Estrarre tree node, context menu |
| 16 | `src/services/claudeSDK.ts` | 827 | Estrarre event conversion, MCP loading |
| 17 | `src/components/TerminalView.tsx` | 810 | Estrarre xterm integration, toolbar |
| 18 | `src/components/ToolWidgets.tsx` | 786 | Separare per tipo widget |
| 19 | `src/components/NewTerminalModal.tsx` | 779 | Estrarre form steps |
| 20 | `src/components/CodeEditorCodeMirror.tsx` | 727 | Estrarre toolbar, extensions |
| 21 | `src/components/TaskDetailsDrawer.tsx` | 717 | Separare form, history, assignee |
| 22 | `src/services/unifiedAgentStorage.ts` | 712 | Estrarre migration, serialization, CRUD |
| 23 | `src/components/GitSidebar.tsx` | 701 | Separare staging, commit, diff views |
| 24 | `src/components/kanban/KanbanView.tsx` | 693 | Estrarre drag-drop, column header, filter |
| 25 | `src/components/SidePanelAccordion.tsx` | 678 | Lazy-load sezioni accordion |
| 26 | `src/components/ChatMessage.tsx` | 665 | Estrarre tool renderer, thinking block |
| 27 | `src/stores/backgroundAgentStore.ts` | 660 | Separare reducers e selectors |
| 28 | `src/components/SessionDetailsDrawer.tsx` | 654 | Estrarre metrics, log, header |
| 29 | `src/services/backgroundAgentService.ts` | 649 | Separare scheduling, execution, status |

### Complex Functions (9 mega-functions)

| File | Function | Lines | Suggestion |
|------|----------|-------|------------|
| `src/App.tsx` | `AppContent()` | **12,648** | Destrutturare in sotto-hook e componenti per dominio |
| `src/components/ChatInput.tsx` | `ChatInput()` | 2,518 | Estrarre `handleKeyDown` (~882 righe) |
| `src/components/RepositoryGroup.tsx` | `RepositoryGroup()` | 2,259 | Estrarre worktree, drag, session state |
| `src/components/kanban/AddKanbanTaskModal.tsx` | `AddKanbanTaskModal()` | 1,133 | Step-wizard con componenti separati |
| `src/components/TerminalSidebar.tsx` | `TerminalSidebar()` | 1,335 | Estrarre list, drag-drop, rename |
| `src/hooks/useClaudeChat.ts` | `useClaudeChat()` | 875 | Estrarre stream parsing, abort, token update |
| `src/components/ChatView.tsx` | `ChatView()` | 756 | Estrarre scroll, diff, grouping |
| `src/services/claudeSDK.ts` | `convertSDKEventToClaudeEvent()` | 173 | Separare per event type |
| `src/services/claudeSDK.ts` | `parseThinkingControl()` | 53 | Estrarre in utility |

### React-Specific Issues

| File | Issue | Impact | Fix |
|------|-------|--------|-----|
| `src/App.tsx` | 66 `useEffect`, solo 25 con cleanup (41 senza) | Memory leak, listener accumulation | Audit e aggiungere cleanup |
| `src/App.tsx` | 35 Tauri `listen()` calls — molti senza `unlisten` | Listener duplication in StrictMode | Aggiungere `return unlisten` in useEffect |
| `src/components/` | 276 componenti, solo 31 usano `React.memo` (11%) | Re-render a cascata | Aggiungere `memo()` a list items, cards, badges |
| `src/App.tsx` | 23 `style={{` inline | Oggetto ricreato ogni render | Estrarre in `useMemo` o classi CSS |
| `src/components/RepositoryGroup.tsx` | 69 `style={{` inline | Alto overhead re-render | Usare Tailwind o `useMemo` |
| `src/App.tsx` | 13 `JSON.parse`/`JSON.stringify` | Serializzazione sincrona su dati grandi | Spostare in web worker o `useMemo` |
| `src/components/StreamMessage.tsx` | 5 `JSON.parse`/`JSON.stringify` durante streaming | UI jank | Parsing incrementale |

### Memory Leak Risks

| File | Pattern | Risk |
|------|---------|------|
| `src/App.tsx` | 35 Tauri `listen()` vs 41 useEffect senza cleanup | **High** |
| `src/components/AIAssistant.tsx` | 5 `setTimeout` senza `clearTimeout` | Medium |
| `src/components/QuackAgencyDrawer.tsx` | 3 `setTimeout` senza cleanup | Medium |
| `src/components/SessionDetailsDrawer.tsx` | `setTimeout` multipli senza cleanup | Medium |
| Zustand stores | `.push()` senza bounds — sessioni/messaggi crescono illimitatamente | Medium (doc: `fix-memory-leak-14gb-ram`) |

---

## 3. Code Smells

### Debug Leftovers (874 occurrences, 98 files)

#### Critical — Active Debug Sessions in Production

| File:Line | Statement | Severity |
|-----------|-----------|----------|
| `src/services/claudeSDK.ts:60` | `console.log('🔍 [MCP DEBUG] loadMCPServers...')` | High (55 debug logs in this file) |
| `src/services/claudeSDK.ts:529-538` | `[DORMANT DEBUG]` block with stack traces | High — fires on every session init |
| `src/App.tsx:653-655` | `handlePersonalityChange` with `JSON.stringify` of full state | High |
| `src/App.tsx:2103-2165` | `[Memory Observer DEBUG]` block (8 nested console.logs) | High — fires per message |

#### Verbose Logging (should use debugLogger)

| File | Count | Action |
|------|:-----:|--------|
| `src/App.tsx` | 258 | Route through `debugLogger.ts` |
| `src/services/claudeSDK.ts` | 55 | Remove `[DORMANT DEBUG]`, gate `[MCP DEBUG]` |
| `src/hooks/useClaudeChat.ts` | 31 | Route through `debugLogger.ts` |
| `src/hooks/useTabPopoutWindow.ts` | 25 | Route through `debugLogger.ts` |
| `src/services/worktreeService.ts` | 22 | Move to `debugLogger` |

### Type Safety (122 occurrences, 31 files)

#### @ts-ignore (6)

| File:Line | Issue |
|-----------|-------|
| `src/App.tsx:4711,4733,4765` | `@ts-ignore - TS6133: Keeping for future` — unused vars |
| `src/components/MessageListVirtualized.tsx:3` | react-window types |
| `src/components/TerminalDrawer.tsx:298` | clipboardData readonly |
| `src/utils/performance.ts:109` | spread args |

#### `any` in Production Code

| File | Count | Worst Offenders |
|------|:-----:|-----------------|
| `src/components/StreamMessage.tsx` | 15 | `contentItem: any`, `result?: any` |
| `src/components/ChatMessage.tsx` | 14 | Event handlers, content filters |
| `src/services/claudeSDK.ts` | 8 | `event: any`, `sdkOptions: any` |
| `src/components/ToolWidgets.tsx` | 5 | `result?: any` on 5 interfaces |
| `src/contexts/UIContext.tsx` | 4 | `editingTerminal: any` |
| **`src/types.ts`** | **1** | **`personality?: any` — propagates to 193 importers** |

### Hardcoded Values

#### URLs in Production Code

| File | Value | Action |
|------|-------|--------|
| `src/components/LicenseModal.tsx:210` | `quack-app.com/buy` + comment `// Replace with actual URL` | **Placeholder in prod — fix immediately** |
| `src/hooks/useMicRecorder.ts:120` | `api.openai.com/v1/audio/transcriptions` | Extract to config |
| `src/components/FileIcon.tsx:24` | `cdn.jsdelivr.net` with `@latest` tag | Unstable — pin version |
| `src/components/BrowserWindow.tsx` | `quack.build` hardcoded 4x | Use constant |
| Multiple files | Gumroad URLs duplicated 3+ times | Consolidate in `src/config/urls.ts` |

#### Colors Outside Theme (15+ occurrences of `#f28c52`)

| File | Count |
|------|:-----:|
| `src/components/ErrorBoundary.tsx` | 7 |
| `src/components/RepositoryGroup.tsx` | 6 |
| `src/components/SkillsPanel.tsx` | 5 |
| `src/components/AgentsPanel.tsx` | 4 |
| `src/components/AgentPersonalityCard.tsx` | 3 |

> Brand primary `#f28c52` scattered in inline styles — centralize in CSS custom property `--color-primary`.

### Unused Dependencies (5)

| Package | Notes |
|---------|-------|
| `@xenova/transformers` | ~50MB, zero imports in `src/` — **remove immediately** |
| `hterm-umdjs` | Superseded by `@xterm/xterm` — remove |
| `ai` (Vercel AI SDK) | Zero imports — remove |
| `sqlite3` | May be used by `src-tauri/node-sdk/` — verify first |
| `prettier` | Listed as dep, should be devDep at minimum |

#### Duplicate Functionality

| Package A | Package B | Overlap |
|-----------|-----------|---------|
| `openai` | `@anthropic-ai/sdk` + `ai` | `openai` used only for Whisper transcription |
| `@xterm/xterm` | `hterm-umdjs` | `hterm` appears unused |

---

## Recommended Actions

### Priority 1 — Quick Wins (effort: small, impact: high)

1. **Remove `[DORMANT DEBUG]` block from `claudeSDK.ts`** — 30+ debug lines with stack traces on every session
2. **Fix placeholder URL in `LicenseModal.tsx:210`** — `quack-app.com/buy // Replace with actual URL` live in prod
3. **Uninstall `@xenova/transformers`** — 50MB unused package
4. **Remove 3 `@ts-ignore - TS6133` in `App.tsx`** — unused variable suppressions
5. **Delete 2 orphan CSS**: `MemoryGraphTabView.css`, `SecondBrainTabView.css`
6. **Delete `.old.` file**: `NewTerminalModal.old.tsx`
7. **Move `prettier` to devDependencies**

### Priority 2 — Should Do (effort: medium, impact: high)

1. **Type `personality?: any` in `types.ts`** — single `any` propagates to 193 importers
2. **Gate `App.tsx` console.logs behind debugLogger** — 258 occurrences, service already exists
3. **Batch-delete 32 dead files** — ~8,000-12,000 lines of unmaintained code
4. **Audit useEffect cleanup in `App.tsx`** — 41 without cleanup, 35 Tauri listeners at risk
5. **Remove `hterm-umdjs` and `ai`** — confirmed unused
6. **Consolidate Gumroad/brand URLs in `src/config/urls.ts`**

### Priority 3 — Strategic (effort: large, impact: transformative)

1. **Split `App.tsx` (12,993 lines)** — the #1 architectural issue; extract into domain modules
2. **Add `React.memo` to pure components** — only 11% coverage, significant re-render savings
3. **Replace 1,234 inline `style={{` with Tailwind/CSS** — breaks memoization across 184 files
4. **Centralize brand colors in CSS custom properties** — `#f28c52` hardcoded 15+ times
5. **Decide fate of `AppRefactored.tsx`** — either complete the refactor or remove the 1,086-line dead file

---

*Report generato da 3 codebase-doctor agents in parallelo (dead-code, performance, smells).*
*Prossimo scan consigliato: dopo il completamento delle Priority 1 actions.*
