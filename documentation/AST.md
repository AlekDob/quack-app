---
type: map
project: quack-app
created: 2026-03-13
last_verified: 2026-03-13
tags: [ast, codebase, architecture]
---

# AST - Quack App

Exported symbols per file. Generated 2026-03-13.

## Summary

| Section | Files | Exports |
|---------|-------|---------|
| Entry Points | 10 | ~15 |
| Types | 1 | ~189 |
| Stores | 18 | ~35 |
| Services | 22 | ~150 |
| Hooks | 55 | ~75 |
| Components | 202 | ~180 |
| Views | 7 | ~3 |
| Utils | 18 | ~90 |
| Schemas | 3 | ~7 |
| Backend (Rust) | 55 | ~175 cmds, ~95 structs |

---

## 1. Entry Points

### src/main.tsx
- Mounts `<App />`, sets up context menu protection

### src/App.tsx
- `AppContent()` -- main app component with all logic (~12k lines)
- `App()` -- top-level wrapper
- `getEffectiveWorkingDir()`, `checkStorageVersion()`, `terminalToUnifiedAgent()`, `unifiedAgentToTerminalMetadata()`

### src/AppRefactored.tsx
- `AppRefactored()` -- refactored version of App with lazy-loaded drawers/modals

### src/brain-main.tsx
- `BrainRoot()` -- entry point for Brain knowledge UI window

### src/browser-main.tsx
- `BrowserApp()` -- entry point for integrated browser window

### src/tab-popout-entry.tsx
- Mounts `<TabPopoutWindowApp />` for tab popout windows

### src/pip.tsx
- Mounts `<PipWindow />` for Picture-in-Picture

### src/preview.tsx
- Mounts preview webview window

### src/terminal-entry.tsx
- Entry point for embedded terminal window

### src/terminal-window-entry.tsx
- Entry point for popout terminal window

---

## 2. Types (src/types.ts)

~189 exported interfaces/types organized by domain:

- **Terminal/Agent**: `NativeTerminal`, `TerminalInfo`, `ProjectTerminal`, `AgentChat`, `AgentInfo`, `AgentDetails`, `AgentPersonality`, `SavedAgent`
- **Chat/Session**: `ChatMessage`, `ChatSession`, `AgentSession`, `ClaudeSession`, `ClaudeSettings`
- **Claude SDK Events**: `ClaudeEvent` (union), `ClaudeSystemEvent`, `ClaudeAssistantEvent`, `ClaudeUserEvent`, `ClaudeResultEvent`, `ClaudeAgentEvent`, `ClaudeErrorEvent`, `ClaudeMessageStartEvent`, `ClaudeContentBlock*`
- **Git**: `GitStatusEntry`, `GitStatusSummary`, `GitCommitEntry`, `GitBranch`, `GitWorktree`
- **MCP**: `MCPServer`, `MCPServerConfig`, `MCPConfigFile`, `MCPTemplate`
- **Automation**: `AutomationJob`, `AutomationRunHistory`
- **Background Tasks**: `BackgroundTask`, `BackgroundTaskConfig`, `BackgroundTaskManager`
- **Marketplace**: `MarketplaceResource`, `MarketplaceStack`, `AgentTemplate`
- **Teams**: `TeamMember`, `TeamConfig`, `TeamContext`, `TeammateStatus`
- **Kanban**: `KanbanTask`, `KanbanStatus`, `KanbanAssignedAgent`
- **Plugins/Hooks/Rules/Skills/Snippets**: `Plugin`, `HookConfig`, `Rule`, `SkillInfo`, `Snippet`
- **Remote API**: `RemoteApiConfig`
- **BTW/QuickLoop**: `BTWConversation`, `QuickLoop`, `QuickLoopStatus`
- **Structured Outputs**: `StructuredOutputSchema`, `StructuredSchemaEntry`

---

## 3. Stores (src/stores/)

### stores/settingsStore.ts
- `useSettingsStore` (store)
- Typography actions: `setCustomFontSize`

### stores/sessionStore.ts
- `useSessionStore` (store)
- `shouldArchiveSession()` -> boolean

### stores/chatStore.ts
- `useChatStore` (store)

### stores/terminalStore.ts
- `useTerminalStore` (store)
- `ManualProject` (interface)

### stores/uiStore.ts
- `useUIStore` (store)

### stores/gitStore.ts
- `useGitStore` (store)

### stores/automationStore.ts
- `useAutomationStore` (store)

### stores/kanbanStore.ts
- `useKanbanStore` (store), `kanbanWriteLock`, `KanbanNotification` (interface)

### stores/backgroundAgentStore.ts
- `useBackgroundAgentStore` (store)

### stores/fileSystemStore.ts
- `useFileSystemStore` (store)

### stores/groupStore.ts
- `useGroupStore` (store)

### stores/teamStore.ts
- `useTeamStore` (store), `RemoteTeamData` (interface)

### stores/ideStore.ts
- `useIDEStore` (store), `IDE_REGISTRY`, `IDEInfo`, `InstalledApp`, `CustomIDE`, `IDEConfig`
- `selectPreferredIDEName()`, `selectHasPreferredIDE()`, `selectShouldShowOnboarding()`, `selectInstalledIDEApps()`

### stores/editorStore.ts
- `useEditorStore` (store): `openFile()`, `updateContent()`, `save()`, `openDiff()`, `resolveEdit()`, `setCursorPosition()`, `reset()`
- State: `filePath`, `content`, `originalContent`, `mode`, `isDirty`, `isLoading`, `pendingEdit`, `cursorPosition`

### stores/shortcutsStore.ts
- `useShortcutsStore` (store)

### stores/popoutWindowStore.ts
- `usePopoutWindowStore` (store), `PopoutWindowInfo`, `generateWindowLabel()`, `canPopoutTab()`

### stores/prerequisitesStore.ts
- `usePrerequisitesStore` (store), `PrerequisiteStatus`, `PrerequisitesCheck`, `PrerequisitesState`
- `selectShouldShowPrerequisites()`, `selectAllPrerequisitesInstalled()`

### stores/gitConfigStore.ts
- `useGitConfigStore` (store), `GitUserConfig`, `GitConfigState`
- `selectShouldShowGitOnboarding()`, `selectIsGitConfigured()`

### stores/sessionWriteLock.ts
- `sessionWriteLock` (const)

### stores/useStore.ts
- `useStore()`, `useMultiStore()`, `useStoreValue()`, `useStoreActions()`

---

## 4. Services (src/services/)

### services/claudeSDK.ts
- `getActiveModelName()`, `getProviderRequestFields()`, `ClaudeSDKOptions`, `ClaudeSDKStreamEvent`
- `abortSessionStream()`, `abortAllStreams()`, `getActiveStreamCount()`
- `answerUserQuestionViaStdin()`, `rewindFiles()`, `RewindFilesResult`

### services/conversationRecovery.ts
- `TOKEN_LIMITS`, `ESTIMATED_OVERHEAD`, `TOKEN_THRESHOLDS`, `TokenWarningLevel`, `TokenBudgetStatus`
- `calculateTokenBudget()`, `createLocalSummary()`, `performSoftReset()`, `exportConversationToMarkdown()`
- `shouldBlockMessage()`, `estimateTokens()`, `calculateProjectOverhead()`, `ProjectOverhead`

### services/unifiedAgentStorage.ts
- `UnifiedAgent`, `UnifiedAgentStore`
- `loadAgents()`, `saveAgents()`, `createAgent()`, `updateAgent()`, `deleteAgent()`
- `migrateFromLegacy()`, `exportAgents()`, `importAgents()`, `getStorageStats()`

### services/terminalStorage.ts
- `TerminalMetadata`, `STORAGE_KEY`, `TABS_BY_TERMINAL_KEY`, `NATIVE_TERMINALS_STORAGE_KEY`
- `saveTerminalsToStorage()`, `loadTerminalsFromStorage()`, `loadActiveAgentsWithData()`, `migrateToActiveAgentsIndex()`

### services/featureMapService.ts
- `parseFeatureDoc()`, `buildFeatureGraph()`, `calculateLinks()`, `parseFilesTable()`
- `FeatureNode`, `FeatureFile`, `FeatureLink`, `FeatureGraph` (types in `featureMapTypes.ts`)

### services/brainFileService.ts
- `BrainEntry`, `getProjectDocPath()`, `initBrainStructure()`, `saveBrainEntry()`, `appendDiaryEntry()`
- `listBrainEntries()`, `readBrainEntry()`, `openBrainFolder()`, `getBrainRootPath()`

### services/backgroundAgentService.ts
- `initBackgroundAgentService()`, `stopQueueProcessor()`, `createBackgroundTask()`
- `pauseTask()`, `resumeTask()`, `cancelTask()`, `retryTask()`
- `runDroidInBackground()`, `runCommandInBackground()`, `getActiveTasks()`, `getQueueStats()`

### services/worktreeService.ts
- `GitWorktree`, `MergeResult`, `WorktreeConfig`, `worktreeService`
- `ensureWorktree()`, `cleanupWorktree()`, `mergeAndCleanup()`, `abortMerge()`

### services/bundleService.ts
- `exportAgentBundle()`, `exportAgentBundleAsZip()`, `importAgentBundle()`, `calculateBundlePowerRating()`

### services/modelService.ts
- `ModelConfig`, `getModels()`, `getModelId()`, `getDefaultModel()`, `getModelOptions()`, `getModelLabel()`

### services/marketplaceRegistryService.ts
- `InstalledEntry`, `InstalledRegistry`, `loadRegistry()`, `markInstalled()`, `markUninstalled()`, `compareVersions()`

### services/cronUtils.ts
- `CronPreset`, `CRON_PRESETS`, `isValidCron()`, `getNextFireTime()`, `cronToHumanReadable()`

### services/debugLogger.ts
- `DebugLogEntry`, `debugLogger` (singleton)

### services/droidFactory.ts
- `ValidationResult`, `validateDroidSpec()`, `generateDroidFile()`

### services/giphyService.ts
- `GiphyGif`, `GiphySearchResponse`, `TOOL_GIF_KEYWORDS`, `searchGif()`, `getGifForTool()`, `isGiphyConfigured()`

### services/githubReleases.ts
- `GitHubRelease`, `GitHubReleaseAsset`, `fetchLatestRelease()`, `fetchAllReleases()`, `canCheckForUpdates()`

### services/inspectorBridge.ts
- `ElementInfo`, `ComponentInfo`, `InspectorData`, `inspectorBridge` (singleton)

### services/kanbanShellService.ts
- `createKanbanShellTask()`, `createKanbanWatchTask()`, `runShellCommandViaKanban()`

### services/ollamaService.ts
- `checkOllamaRunning()`, `fetchOllamaModels()`, `getOllamaModelOptions()`

### services/shortcutsStorage.ts
- `DEFAULT_SHORTCUTS`, `saveShortcuts()`, `loadShortcuts()`, `resetAllShortcuts()`

### services/supertagConfigService.ts
- `SupertagPropertyType`, `SupertagProperty`, `SupertagConfig`, `DEFAULT_SUPERTAG_COLORS`, `COLOR_PALETTE`
- `loadSupertagConfigs()`, `saveSupertagConfig()`, `deleteSupertagConfig()`, `generatePropertyId()`

### services/structuredOutputService.ts
- `StructuredOutputResult`, `buildOutputFormat()`, `parseStructuredResponse()`, `extractJsonFromText()`, `processStructuredOutput()`

### services/activityLogService.ts
- `appendActivity()`, `readActivities()`

### services/automationStorage.ts
- `loadAutomationJobs()`, `saveAutomationJobs()`, `loadAutomationHistory()`, `saveAutomationHistory()`

### services/droidStatsStorage.ts
- `loadDroidStats()`, `saveDroidStats()`, `checkAchievements()`

### services/taskDocGenerator.ts
- `TaskSummary`, `generateTaskSummary()`, `generateDocMarkdown()`, `slugify()`, `getDocFilePath()`

---

## 5. Hooks (src/hooks/)

### Core Chat & Session
- `useClaudeChat()` -- main chat hook (`ThinkingMode`, `PermissionMode`, `ChatSendOptions`, `parseThinkingControl()`)
- `useClaudeEventListener()` -- Claude SDK event listener
- `useSessions()` -- session CRUD, `parseSessionHistory()`
- `useSessionMessageSync()` -- sync messages across components

### Agent & Project
- `useAgentAvatar()`, `preloadAvatars()`, `clearAvatarCache()`
- `useAgentInfo()`, `clearAgentInfoCache()`
- `useAgentRules()` -- `AgentRuleInfo`, `getRulesSummary()`
- `useCurrentProject()` -- `ProjectInfo`, `MemoryScope`, `PROJECT_CHANGED_EVENT`, `dispatchProjectChange()`
- `useProjectContext()` -- `Bookmark`
- `useProjectColor()`, `invalidateProjectColorCache()`, `getProjectColorSync()`
- `useProjectDashboard()` -- `GitStatusData`, `GitCommit`, `ProjectDashboardData`

### Tab & UI Hooks
- `useAutomationTab()`, `useKanbanTab()`, `useOfficeTab()`, `useFeatureMapTab()`, `useCodeEditorTab()`, `useDocsTab()`, `useClaudeAssetsTab()`
- `useFeatureMapData()` — fetches feature docs via Tauri, builds FeatureGraph
- `useWhiteboardFile()` — annotation + position + nodeAssignment CRUD, undo/redo, component ops, file persistence + 2s polling
- `useCanvasSelection()` — multi-selection (lasso rect, selectedIds Set, toggle/clear)
- `useProjectDashboardTab()`, `useTabPopoutWindow()`, `useDrawerAnimation()`
- `usePipWindow()`, `useWindowFocus()`, `useGlobalKeyboardShortcuts()`

### Feature Hooks
- `useBackgroundAgents()`, `useBackgroundAgentInit()`, `useBackgroundTaskCompletion()`
- `useBTW()` -- BTW side-chain query
- `useBundleOperations()` -- agent bundle import/export
- `useClaudeAssets()` -- .claude/ directory assets
- `useDeepLinkHandler()`, `testDeepLink()`
- `useDroidFactory()` -- droid/skill creation wizard
- `useExternalIdeContext()` -- external IDE integration
- `useKanbanChatStore()`, `useKanbanChatSync()`
- `useMarketplace()` -- marketplace resources
- `useMaxPlanTracking()`, `useMaxPlanHistory()`, `useMaxPlanNotifications()`, `formatTimeRemaining()`, `getPlanDisplayName()`
- `useMCPServers()` -- MCP server management
- `useMicRecorder()`, `useSpeechRecognition()`, `useWhisperRecognition()`
- `usePopoutKanbanChat()`, `useQuickLoop()` (`QuickLoopStatus`)
- `useRules()`, `useSlashCommands()` (`SlashCommand`, `SlashCommandsResponse`)
- `useSnippets()` (`SNIPPET_VARIABLES`, `getCursorPosition()`, `removeCursorMarker()`)
- `useSupertagConfig()` (`UseSupertagConfigReturn`)
- `useSystemWakeHandler()`, `useTelegramBot()`, `useTerminalWindowManager()`, `useTerminalWindows()`
- `useToolGifReaction()` (`ActiveToolGif`), `useUpdateChecker()`
- `useAITriggerGenerator()`, `generateTriggersInBatch()`
- `useAppConfig()`, `usePricingConfig()`, `useCheckoutConfig()`, `useFeaturesConfig()`, `useModelsConfig()`
- **Types**: `maxPlanTypes.ts` -- `MaxPlanType`, `MaxPlanConfig`, `MaxPlanSession`, `MaxPlanStats`, `DailyUsage`, `WeeklyUsage`

---

## 6. Components (src/components/)

### Root-level (113 files) -- exported components only
`AgentAvatar`, `AgentContextPanel`, `AgentMentionChip`, `AgentRulesBanner`, `AgentSelector` (`SortMode`), `AgentsPanel`, `AgentViewer`, `AIAssistant`, `AuthDebugPanel`, `BackgroundTaskCard`, `BackgroundTaskLogs`, `BackgroundTasksDrawer`, `BackgroundTasksPanel`, `BackgroundTasksSidebarButton`, `BrowserManager`, `BrowserTab`, `BrowserWindow`, `ChangelogViewer`, `ChatInput`, `ChatSettingsMenu`, `ChatView` (`LineChange`, `FileEdit`, `FileDeleted`), `ClaudeAuthBanner`, `ClaudeAuthSettings`, `CommandEditor`, `CommandItem`, `CommandsList`, `CommandsPanel`, `CommandViewer`, `CompactingIndicator`, `ConfirmModal`, `ContextDrawer`, `ContextMenu`, `ContextPanel`, `CustomPermissionSelect`, `DebugPanel`, `DuckAnimation`, `EditSummaryBar`, `ErrorBoundary`, `FileContextMenu`, `FileDiffButton`, `FileIcon`, `FilePreviewDrawer` (`FilePreviewDrawerRef`), `FileStatusBadge` (`FileStatus`), `GitOperationsDropdown`, `GroupCreationModal`, `GroupHeader`, `HookBadge`, `HookExecutionList`, `HooksPanel`, `JsonViewer`, `KanbanNotificationBar`, `KeyboardShortcutTooltip`, `LicenseModal`, `MarkdownText`, `MarketplaceCard`, `MarketplaceDrawer`, `MarketplaceInstallModal`, `MaxPlanStatsModal`, `MCPPanel`, `MCPServerCard`, `MCPServerModal`, `MCPTemplateCard`, `MermaidDiagram`, `MessageList`, `MetroLine`, `NewAgentModal`, `NewSessionModal`, `OpenInIDEButton`, `PerformanceMonitor`, `PluginCard`, `PluginsPanel`, `PowerBadge`, `PreviewDrawer`, `PreviewPanel`, `ProBanner`, `ProcessesDrawer`, `ProjectContextPanel`, `ProjectTerminalItem`, `ProjectToast` (`showProjectToast`, `projectToast`), `QuackAgencyDrawer`, `QuackAgencySetupWizard`, `QuackStoreDrawer` (`AgentBundleInstallData`), `RemoteTeamWidget`, `RepositoryGroup`, `RevealInFinderButton`, `RuleEditor`, `RuleItem`, `RulesList`, `RulesPanel`, `RuleViewer`, `SavedCommandModal`, `SavedCommands`, `SavedCommandsDrawer`, `ScopePickerModal`, `SessionDetailsDrawer`, `SessionEmptyState`, `SessionIdDisplay`, `SessionsPanel`, `SidePanel`, `SidePanelAccordion`, `SkeletonMessage`, `SkillDrawer`, `SkillSelector`, `SkillsPanel`, `SkillViewer`, `SlashCommandAutocomplete`, `SnippetModal`, `SnippetPopover`, `SplashScreen`, `StandaloneTerminal`, `StorageMetrics`, `StreamMessage` (`SPECIAL_WIDGET_TOOLS`, `SOLO_ROW_TOOLS`, `isImageRead`), `TabBar` (`Tab`, `PopoutPosition`), `TaskAgentAvatar`, `TaskContextMenu`, `TaskDetailsDrawer`, `TaskHubView`, `TaskOutputWidget`, `TasksPanel`, `TaskWidget`, `TeamCreationModal`, `TeammateStreamTab`, `TeammateWidget`, `TeamStatusBadge`, `TelegramSetup`, `TerminalDrawer` (`disposeTerminal`), `TerminalGroup`, `TerminalQuickActions`, `TerminalSidebar`, `TerminalSidebarPanel`, `TerminalTabs`, `TerminalToolBar`, `TerminalWindow`, `TerminalWindowApp`, `TerminalWindowButton`, `TerminalWindowsPanel`, `TitleBar`, `TodoProgressBar` (`TodoItem`), `TokenUsageModal`, `TokenWarningBanner`, `ToolBar`, `ToolGifInline`, `ToolGifOverlay`, `ToolGifWidget`, `ToolWidgets` (`getToolColor`, `ToolIcon`, `EditWidget`, `WriteWidget`, `BashWidget`, `ReadWidget`, `GrepWidget`, `TodoWriteWidget`, `ExitPlanModeWidget`, `EnterPlanModeWidget`, `ImagePreviewWidget`, `SystemInitializedWidget`), `Tooltip`, `UpdateToast`, `UpgradeModal`, `UsagePanel`, `VoiceRecordingModal`, `WizardStep`, `XTermInstance` (`disposeXTermInstance`)

### components/automation/ (5 files)
- `AutomationJobForm`, `AutomationView`, `CronPresetInput`

### components/brain/ (8 files)
- `BrainApp`, `BrainEditor`, `BrainEntryCard`, `BrainGraph`, `BrainGuide`, `BrainKnowledge`, `BrainSidebar` (`GuidePage`, `GuideFeature`), `BrainTimeline`

### components/btw/ (1 file)
- `BTWDrawer` (`BTWDrawerProps`)

### components/chat/ (5 files)
- `EquipBar`, `EquipBarExample`

### src/components/chat/HtmlVisualizer.tsx
- `HtmlVisualizer` -- Sandboxed inline HTML renderer for interactive visualizations

### src/components/chat/htmlVisualizerUtils.ts
- `wrapHtmlForSandbox()` -- Wrap HTML with auto-resize script and dark base styles
- `isCompleteHtmlDocument()` -- Detect if HTML string is a complete document

### src/components/chat/CopyButton.tsx
- `CopyButton` -- Reusable copy-to-clipboard button with visual feedback

### components/claude-assets/ (5 files)
- `AssetCard`, `AssetPreviewModal`, `AssetsBrowser`, `ClaudeAssetsPanel`, `ProjectsList`

### components/docs/ (4 files)
- `DocsContent`, `DocsSidebar`, `DocsViewer` (`DocsMeta`, `DocsPage`, `DocsSection`)

### components/droid-factory/ (8 files)
- `AssemblyLine`, `DroidCollection`, `DroidFactoryDrawer`, `DroidTemplateGallery`, `DroidWizard`, `SkillTemplateGallery`, `SkillWizard`
- `types.ts`: `FactoryMode`, `DroidSpec`, `SkillSpec`, `UserStats`, `Achievement`, `TOOL_LEVELS`, `DROID_TEMPLATES`, `SKILL_TEMPLATES`, `ACHIEVEMENTS_CONFIG`

### components/editor/ (10 files)
- `CodeEditorEngine` (component): refactored CM6 editor with imperative ref (search/replace)
- `CodeEditorView` (component): main orchestrator (header + content + status bar)
- `CodeMirrorMergeView` (component): side-by-side diff via @codemirror/merge
- `EditorContent` (component): mode switch between edit (Engine) and diff (MergeView)
- `EditorEmptyState` (component): "Nessun file aperto" placeholder
- `EditorHeader` (component): breadcrumb, mode badge, Outline/Save buttons, IDE dropdown
- `EditorIDEDropdown` (component): split button to open file in IDE + reveal in Finder/Explorer
- `EditorStatusBar` (component): Ln/Col, language, encoding, save status
- `editorTheme.ts`: `customTheme`, `customHighlightStyle`, `highlightExtension`
- `editorSearch.ts`: `setSearchMatches`, `searchMatchesField`, `findAllMatches()`, `buildSearchDecorations()`
- `editorDiff.ts`: `setDiffDecorations`, `diffDecorationsField`, `applyDiffDecorations()`
- `editorTypes.ts`: `CodeEditorRef`, `CodeEditorProps`, `DiffInfo`, `LineChange`, `SearchOptions`, `EditorMode`, `PendingEdit`, `DiffRequest`, `EditFileRequest`, `EditFileResponse`, `CursorPosition`

### components/kanban/ (6 files)
- `AddKanbanTaskModal` (`KanbanTaskInitialValues`, `KanbanTaskDraft`), `KanbanCard`, `KanbanCardOverlay`, `KanbanColumn`, `KanbanMiniPanel`, `KanbanPopoutView`, `KanbanView`

### components/loop/ (2 files)
- `QuickLoopIndicator`, `QuickLoopPopover`

### components/modal-steps/ (6 files)
- `CreateRuleModal`, `StepProjectContext`, `StepProjectSelection`, `StepProgress`, `StepStarterBundles`
- `types.ts`: `ModalStep`, `ActiveProject`, `StepProjectContextProps`, `SkillMetadata`, `DroidMetadata`

### components/featureMap/ (10 files)
- `FeatureMapCanvas`: SVG canvas with architecture layers, nodes, links, annotations (post-its, groups, images), pan/zoom, hover highlighting, click selection, image drop zone
- `FeatureMapView`: Main container composing data hook + canvas + popover + toolbar + image file saving/picking
- `FeatureMapPopover`: Portal-based popover near clicked node with feature image preview, collapsible file list, connected features
- `CanvasPostIt`: SVG post-it note — draggable, editable text, color cycling, delete on hover
- `CanvasGroupRect`: SVG group rectangle — draggable, resizable (4 corner handles), editable label, component mode (mini-preview, drop target)
- `CanvasImage`: SVG canvas image — draggable, aspect-ratio resize, blob URL loading from filesystem, delete on hover
- `AnnotationToolbar`: Floating toolbar for Select/Lasso/Post-it/Group/Image mode toggle + selection badge + Create Component
- `WhiteboardBreadcrumb`: Navigation breadcrumb for nested components — Root > Parent > Current, clickable segments
- `FeatureMapMinimap`: Minimap overview panel — node dots + viewport rect + click-to-navigate
- `featureMapLayout.ts`: `LAYERS`, `classifyNode()`, `groupByLayer()`, `calculateLayeredLayout()` — architecture layers positioning
- `featureMapTypes.ts`: `FeatureNode` (incl. `image?`), `FeatureFile`, `FeatureLink`, `FeatureGraph`, `NodePosition`
- `annotationTypes.ts`: `PostIt`, `GroupRect`, `CanvasImage`, `CanvasAnnotations`, `WhiteboardFile` (incl. `nodeAssignments`), `AnnotationMode`, `ComponentNavigation`, `LassoRect` types + constants
- `FeatureMapView.css`: Dark theme styles (canvas, popover, toolbar, breadcrumb, eject zone, image preview)

### components/office/ (10 files)
- `OfficeActionMenu`, `OfficeTooltip`, `OfficeView`
- `officeLayout.ts`: `TILE_W`, `TILE_H`, `WorkstationPos`, `RoomPosition`, `gridToIso()`, `computeRoomPositions()`, `getWorkstationPositions()`, `computeBreakRoomPosition()`
- `officeTypes.ts`: `TooltipData`, `ActionMenuData`
- `useAvatarTexture()` (hook)

### components/project-dashboard/ (1 file)
- `ProjectDashboard`

### components/settings/ (18 files)
- `GitConfigOnboarding`, `IDEOnboarding`, `PrerequisitesCheck`, `SettingsContent`, `SettingsIcon`, `SettingsSidebar` (`SettingsCategory`), `UnifiedSettings`
- Controls: `IOSInput`, `IOSSwitch`, `SectionHeader`, `SettingsRow`, `ShortcutInput`
- Categories: `AboutSettings`, `AgentModesSettings`, `AIAssistantSettings`, `AppearanceSettings`, `ClaudeCodeSettings`, `DebugSettings`, `GeneralSettings`, `IDESettings`, `IntegrationsSettings`, `KeyboardShortcutsSettings`, `LicenseSettings`, `NotificationSettings`, `RemoteApiSettings`, `SecondBrainSettings`, `TerminalSettings`, `TypographySettings` (5 presets S/M/L/XL/Custom, custom font size stepper)

### components/store/ (8 files)
- `StoreEmptyState`, `StoreFeaturedCard`, `StoreHeroBanner`, `StoreIcons` (`CATEGORY_GRADIENTS`, `getCategoryGradient`, `VerifiedIcon`, `formatInstallCount`), `StoreItemCard`, `StoreMainContent`, `StoreProjectPickerModal`, `StoreSidebar`
- `storeConstants.ts`: `StoreTab`, `TabConfig`, `TAB_CONFIG`, `CATEGORY_MAP`

### components/structured-outputs/ (7 files)
- `BugReportWidget`, `ComponentRegistry` (`StructuredOutputAction`, `StructuredOutputRendererProps`, `structuredOutputRegistry`), `JsonRenderAdapter` (`JsonRenderSpec`, `isJsonRenderSpec`), `TranscriptViewer` (`TranscriptEntry`, `TranscriptChapter`, `TranscriptOutput`, `isTranscriptOutput`), `WebAnalysisCard`
- `quackCatalog.ts`: `quackCatalog`, `QuackCatalog`

### components/terminal/ (7 files)
- `TerminalFilterBar`, `TerminalInstance` (`TerminalInstanceHandle`, `TerminalInstanceProps`), `TerminalMain` (`TerminalMainHandle`, `TerminalMainProps`), `TerminalSearchBar`
- `TerminalThemes.ts`: `TerminalThemeName`, `TerminalTheme`, `TERMINAL_THEMES`, `getTerminalTheme()`, `getThemeNames()`
- `useTerminal()` (`UseTerminalOptions`, `UseTerminalReturn`)

---

## 7. Views (src/views/)

- `ClaudeAssetsTabView`, `DocsTabView`, `ProjectDashboardTabView` (exported)
- `AutomationTabView`, `CodeEditorTabView`, `ImageTabView`, `KanbanTabView`, `OfficeTabView` (default/not exported)

---

## 8. Utils (src/utils/)

### utils/performance.ts
- `debounce()`, `throttle()`, `rafThrottle()`, `memoize()`, `batchUpdates()`, `shallowEqual()`, `deepEqual()`

### utils/sessionScrollMemory.ts
- `SessionAnchorState`, `setSessionAnchor()`, `getSessionAnchor()`, `clearSessionAnchor()` — Map singleton for per-session anchor `messageId` (see `pattern-session-scroll-memory.md`)

### utils/platform.ts
- `getPlatform()`, `isMacOS()`, `isWindows()`, `isLinux()`, `getModifierKey()`, `formatShortcut()`, `cleanPath()`, `normalizePath()`, `normalizeToForwardSlash()`

### utils/terminalUtils.ts
- `TERMINAL_COLORS`, `ANSI_REGEX`, `normalizeKey()`, `slugify()`, `stripAnsi()`, `debounce()`, `getRandomTerminalColor()`

### utils/ansiParser.ts
- `parseAnsi()`, `stripAnsi()`, `ansiToHtml()`

### utils/agentAvatars.ts
- `AVAILABLE_AVATARS`, `getAvatarUrl()`, `getDuckdroidUrl()`, `getRandomAvatar()`, `getAgentAvatar()`

### utils/agentMentions.ts
- `AgentMention`, `parseAgentMentions()`, `extractAgentNames()`, `matchMentionsToAgents()`, `stripMentions()`

### utils/agentNames.ts
- `AGENT_NAMES`, `getRandomAgentName()`, `getRandomGenderedName()`, `getAllAgentNames()`, `searchAgentNames()`

### utils/agentStorage.ts
- `SavedAgent`, `getSavedAgents()`, `saveAgent()`, `deleteAgent()`, `searchAgents()`, `exportAgents()`, `importAgents()`

### utils/analytics.ts
- `getCommonProperties()`, `withTiming()`, `createPerformanceMetric()`, `createErrorEvent()`, `FeatureCategories`, `createFeatureEvent()`, `SessionTracker`, `sessionTracker`, `BatchedEventTracker`

### utils/customAvatarStorage.ts
- `CustomAvatarInfo`, `uploadCustomAvatar()`, `listCustomAvatars()`, `deleteCustomAvatar()`, `validateAvatarFile()`

### utils/ideContextBuilder.ts
- `IdeContext`, `ExternalIdeContext`, `gatherInternalContext()`, `formatContextPrefix()`, `buildContextPrefix()`

### utils/imageCompression.ts
- `MAX_FILE_SIZE`, `MAX_IMAGE_DIMENSION`, `CompressionResult`, `compressImage()`, `blobToBase64()`

### utils/invokeWithTimeout.ts
- `TimeoutError`, `invokeWithTimeout()`, `fireAndForget()`

### utils/kanbanDateGrouping.ts
- `DateBucket`, `DateGroup`, `getDateBucket()`, `groupTasksByCompletionDate()`, `getTotalTaskCount()`

### utils/powerRating.ts
- `calculatePowerRating()`, `getPowerRatingColor()`, `getPowerRatingTier()`, `formatPowerRating()`

### utils/projectUtils.ts
- `extractProjectId()`, `isValidProjectPath()`, `formatProjectName()`

### utils/projectColors.ts
- `ProjectStorageData`, `DEFAULT_PROJECT_COLORS`, `loadProjectColors()`, `getProjectColor()`

### utils/rulePathUtils.ts
- `isGlobalRulePath()`, `isProjectRulePath()`, `normalizeRulePath()`, `resolveRulePath()`, `migrateRulePaths()`, `getDisplayPath()`

### utils/brainPathDetection.ts
- `BRAIN_COLOR`, `isBrainPath()`, `isBrainRead()`

### utils/languageDetection.ts
- `getLanguageFromFilename()`

### utils/sessionStatus.ts
- `getActivityDotColor()`, `getTimeColor()`, `getDotClassName()`

### utils/sessionCleanup.ts
- `SessionStorageStats`, `getSessionStorageStats()`, `cleanupOldSessions()`

### utils/sessionKanbanAdapter.ts
- `sessionToKanbanTask()`, `sessionsToKanbanTasks()`, `isSessionTask()`

### utils/sessionRecovery.ts
- `validatePrompt()`

---

## 9. Constants (src/constants/)

### constants/typography.ts
- `FixedPreset` (type), `FONT_SIZE_PRESETS`, `DEFAULT_CUSTOM_FONT_SIZE`, `MIN_CUSTOM_FONT_SIZE`, `MAX_CUSTOM_FONT_SIZE`
- `buildCustomScale()`, `resolveScale()`, `safeCustomSize()`

---

## 10. Schemas (src/schemas/)

### schemas/kanbanTask.schema.ts
- `KanbanTaskOutput` (interface), `kanbanTaskSchema` (const)

### schemas/brainEntry.schema.ts
- `BrainEntryOutput` (interface), `brainEntrySchema` (const)

### schemas/index.ts
- `getSchema()`, `listSchemas()`, `registerSchema()`

---

## 11. Backend -- Rust (src-tauri/src/)

### Core

#### lib.rs
- `AgentStatusMap` (type), `AGENT_STATUS` (static), `SessionState` (struct), `run()` (app entry)
- **55 modules** declared, **~175 Tauri commands**, **8 managed states**

#### main.rs
- `main()` -- calls `app_lib::run()`

#### shell_env.rs
- `get_login_env()`, `get_login_path()`, `get_extended_path()`

### Agent & Session

#### agency.rs -- 8 commands
- `AgentInfo`, `AgentDetails`
- `list_agents`, `get_agent_details`, `check_agents_directory`, `create_agents_directory`, `save_agent`, `save_agent_content`, `delete_agent`, `create_agent`

#### agency_setup.rs -- 1 command
- `SetupWizardData`, `SetupResult`, `setup_quack_agency_full`

#### personality.rs -- 7 commands
- `AgentPersonality`
- `save_agent_personality`, `load_agent_personality`, `inject_personality_to_claude_md`, `load_active_agents`, `save_active_agents`, `add_active_agent`, `remove_active_agent`, `load_active_agents_with_data`

#### sessions.rs -- 6 commands
- `SessionInfo`, `SessionDetails`, `SessionHistoryMessage`, `UsageStats`
- `list_sessions`, `get_session_info`, `get_all_sessions_info`, `get_session_details`, `delete_session`, `reset_agent_session`, `resume_session`

#### teams.rs -- 3 commands
- `TeamMember`, `TeamConfig`
- `create_team`, `disband_team`, `get_active_team`

#### groups.rs -- 7 commands
- `ProjectGroupMember`, `ProjectGroup`
- `create_group`, `list_groups`, `get_group`, `update_group`, `delete_group`, `sync_group_contexts`, `get_group_for_project`

### Claude SDK & Auth

#### claude_cli.rs -- 8 commands
- `ClaudeCliResponse`, `ClaudeEvent`, `ContentBlock`, `Usage`, `ClaudeCliRequest`, `AgentConfig`, `TeamContext`
- `check_claude_cli_available`, `send_message_via_cli`, `send_message_via_cli_streaming`, `send_message_via_sdk_streaming`, `send_tool_result_to_sdk`, `answer_user_question`, `abort_sdk_stream`, `restart_daemon`, `reload_mcp_servers`, `rewind_files`

#### claude_auth.rs -- 4 commands
- `ClaudeCredentials`, `AuthType`, `AuthDebugInfo`
- `get_claude_cli_credentials`, `check_claude_cli_auth`, `get_credentials_path`, `get_auth_debug_info`

#### claude_oauth.rs -- 1 command
- `OAuthConfig`, `OAuthTokenResponse`, `start_claude_oauth`

#### claude_usage.rs -- 2 commands
- `PlanUsageData`, `SessionUsage`, `WeeklyUsage`
- `get_claude_plan_usage`, `open_claude_usage_in_terminal`

#### keychain.rs -- 7 commands
- `set_claude_api_key_secure`, `get_claude_api_key_secure`, `delete_claude_api_key_secure`, `set_openai_api_key_secure`, `get_openai_api_key_secure`, `delete_openai_api_key_secure`, `check_api_keys_in_keychain`

### File System & Git

#### fs.rs -- 28 commands
- `DirectoryEntry`, `DirectoryListing`, `FileMetadata`, `SearchResult`, `ProjectInfo`, `CustomAvatarInfo`, `MCPMemoryEntity`, `MCPKnowledgeGraph`
- File ops, avatar management, MCP memory CRUD, project detection

#### git.rs -- 27 commands
- `GitStatusEntry`, `GitStatusSummary`, `GitCommitEntry`, `GitBranch`, `GitMergeResult`, `GitConflictFile`, `GitPullResult`, `GitWorktree`, `GitUserConfig`
- Status, diff, stage, commit, branch, merge, stash, push, pull, worktree ops

#### git_watcher.rs -- 3 commands
- `GitBranchChangedEvent`, `GitBranchWatcherManager`

### Configuration & Preferences

#### preferences.rs -- 20+ commands
- `AppPreferences`, `ShellInfo`
- AI model, background, Telegram, ntfy, shell config

#### context.rs -- 5 commands
- `ContextFile`, `ContextDetails`, `ContextFileStats`

#### rules.rs -- 6 commands
- `Rule`, `RulesResponse`, `RuleDetails`, `install_bundled_rules()`

#### hooks.rs -- 8 commands
- `HookType`, `HookScope`, `HookAction`, `HookMatcher`, `HookConfig`
- Hook CRUD, Claude env vars, settings flags

### MCP & Plugins

#### mcp.rs -- 8 commands
- `MCPProcessManager`, `MCPServerConfig`, `MCPConfigFile`, `MCPServer`, `MCPTemplate`

#### plugins.rs -- 5 commands
- `Plugin`, `PluginScope`, `PluginManifest`, `PluginCategory`, `PluginSource`

### Automation & Background

#### automation.rs -- 8 commands
- `AutomationJobRust`, `AutomationFireEvent`, `AutomationScheduler`

#### background_tasks.rs -- 6 commands
- `BackgroundTaskResult`, `BackgroundTaskManager`, `BackgroundTaskEvent`

### AI & Search

#### ai.rs -- 6 commands
- `AIRequest`, `AISuggestion`, `AIQuestion`, `AIAnswer`, `AIPromptImprovement`, `AIPromptEngineerResponse`, `TokenStats`

#### semantic_search.rs -- 9 commands
- `FileOperation`, `SemanticFileEvent`, `WatcherConfig`, `SemanticWatcherManager`

#### btw.rs -- 1 command
- `btw_query`

### Remote API

#### remote_api.rs
- `ApiState`, `create_api_router()`, `init_uptime()`
- REST handlers: status, agents, sessions, messages, jobs, execute, ordering, groups, avatar

#### remote_api_teams.rs
- `RemoteTeam`, `RemoteTeamMember`, `create_team_routes()`

#### remote_auth.rs
- `RemoteAuthState`, `generate_token()`

#### remote_config.rs -- 5 commands
- `RemoteConfig`, `load_config()`, `save_config()`, `get_local_ip_address()`

#### remote_ws.rs
- `WsBroadcast`, `WsEvent`, `WsState`, `handle_ws_upgrade()`

#### remote_dashboard.rs
- `DashboardQuery`, `create_dashboard_router()`

### Other Modules

#### browser.rs -- 5 commands
- Browser window, OAuth window, inspector

#### terminal.rs -- 10 commands
- `TerminalInfo`, `TerminalDataPayload`, `TerminalExitPayload`, `ProcessInfo`, `CommandResult`

#### native_terminal.rs -- 4 commands
- `NativeTerminalResult`, `TerminalApp`

#### notifications.rs -- 3 commands
- AI completion, Telegram test, ntfy test

#### telegram_bot.rs -- 3 commands + router
- `TelegramBotState`, `BotCommand`, `create_telegram_router()`

#### telegram_central.rs -- 4 commands
- `TelegramPollingState`, `start_polling()`, `stop_polling()`, `send_message()`

#### telegram_obfuscation.rs
- `get_telegram_token()`, `validate_token_format()`

#### commands.rs -- 4 commands
- `SavedCommand`, `ProcessInfo`

#### skills.rs -- 3 commands
- `SkillInfo`, `SkillDetails`

#### slash_commands.rs -- 6 commands
- `SlashCommand`, `SlashCommandsResponse`, `CommandDetails`, `install_bundled_commands()`

#### snippets.rs -- 9 commands
- `Snippet`, `SnippetsFile`

#### claude_assets.rs -- 5 commands
- `ClaudeAssetType`, `AssetMetadata`, `ClaudeAsset`, `ProjectAssets`, `ClaudeProject`

#### ide_integration.rs -- 14 commands
- `IDEInfo`, `InstalledApp`, `IdeLockFile`, `ExternalIdeContext`, `CustomIDE`

#### license.rs -- 4 commands
- `LicenseData`, `LicenseValidationResponse`, `LicenseState`

#### preview.rs -- 6 commands
- `WebviewInfo`

#### deep_link.rs + deep_link_commands.rs -- 2 commands
- `OpenFilePayload`, `parse_deep_link()`, `handle_deep_link()`

#### reveal.rs -- 2 commands
- `open_external_url`, `reveal_in_finder`

#### prerequisites.rs -- 6 commands
- `PrerequisiteStatus`, `PrerequisitesCheck`

#### teammate_watcher.rs -- 3 commands
- `TeammateSessionWatcher`

#### proxy.rs
- `ProxyParams`, `proxy_handler()`

#### brain_window.rs -- 1 command
- `open_brain_window`
