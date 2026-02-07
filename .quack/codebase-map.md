---
type: codebase-map
project: .
generated: 2026-02-07T17:15:06Z
files: 402
exports: 1175
---

# Codebase Map

## docs/06-proposals/semantic-watcher-example.tsx
- export fn `useSemanticWatcher()`
- export fn `SemanticSearchView({ projectPath }: { projectPath: string })`
- export fn `onProjectOpen(projectPath: string)`

## src/App.tsx
- export default `App`

## src/AppRefactored.tsx
- export default `AppRefactored`

## src/components/ActionIcons.tsx
- export default `memo(ActionIcons)`

## src/components/AddNativeTerminalModal.tsx
- export fn `AddNativeTerminalModal()`

## src/components/AddTerminalWindowModal.tsx
- export fn `AddTerminalWindowModal()`

## src/components/agent-bundle/AgentBundleEditor.tsx
- export fn `AgentBundleEditor()`

## src/components/agent-bundle/EquipmentPickerModal.tsx
- export type `EquipmentPickerModalProps { open, title, items, selectedItems, maxItems, color, onConfirm, onCancel }`
- export fn `EquipmentPickerModal()`

## src/components/agent-bundle/EquipmentSlot.tsx
- export fn `EquipmentSlot()`

## src/components/agent-bundle/index.ts
- re-export `AgentBundleEditor` from './AgentBundleEditor'
- re-export `EquipmentSlot` from './EquipmentSlot'
- re-export `PowerBadge` from './PowerBadge'
- re-export `EquipmentPickerModal` from './EquipmentPickerModal'

## src/components/agent-bundle/PowerBadge.tsx
- export fn `PowerBadge({ powerRating, compact = true, falloutStyle = false }: PowerBadgeProps)`

## src/components/AgentAvatar.tsx
- export fn `AgentAvatar()`

## src/components/AgentCardWithSessions.example.tsx
- export default fn `AgentCardWithSessions()`

## src/components/AgentContextPanel.tsx
- export default fn `AgentContextPanel()`

## src/components/AgentMentionChip.tsx
- export fn `AgentMentionChip({ agentName }: AgentMentionChipProps)`

## src/components/AgentPersonalityCard.tsx
- export default fn `AgentPersonalityCard()`

## src/components/AgentRulesBanner.tsx
- export default fn `AgentRulesBanner()`

## src/components/AgentSelector.tsx
- export default fn `AgentSelector({ onUseAgent, onEditAgent, onCreateNew }: AgentSelectorProps)`

## src/components/AgentSessionItem.tsx
- export default `memo(AgentSessionItem)`

## src/components/AgentSessionList.tsx
- export default `AgentSessionList`

## src/components/AgentsPanel.tsx
- export default fn `AgentsPanel()`

## src/components/AgentViewer.tsx
- export default fn `AgentViewer()`

## src/components/AIAssistant.tsx
- export default fn `AIAssistant()`

## src/components/AskUserQuestionWidget.tsx
- export default `AskUserQuestionWidget`

## src/components/AuthDebugPanel.tsx
- export default fn `AuthDebugPanel()`

## src/components/BackgroundsModal.tsx
- export default `memo(BackgroundsModal, (prev, next) => {`

## src/components/BackgroundTaskCard.tsx
- export default fn `BackgroundTaskCard()`

## src/components/BackgroundTaskLogs.tsx
- export default fn `BackgroundTaskLogs()`

## src/components/BackgroundTasksDrawer.tsx
- export default fn `BackgroundTasksDrawer()`

## src/components/BackgroundTasksPanel.tsx
- export default fn `BackgroundTasksPanel({ onClose }: BackgroundTasksPanelProps)`

## src/components/BackgroundTasksSidebarButton.tsx
- export default fn `BackgroundTasksSidebarButton()`

## src/components/BranchManager.tsx
- export default `BranchManager`

## src/components/BrowserManager.tsx
- export default fn `BrowserManager()`

## src/components/BrowserTab.tsx
- export default fn `BrowserTab()`

## src/components/BrowserWindow.tsx
- export default fn `BrowserWindow()`

## src/components/ChangelogViewer.tsx
- export default fn `ChangelogViewer({ maxReleases = 10 }: ChangelogViewerProps)`

## src/components/chat/EquipBar.example.tsx
- export fn `EquipBarExample()`

## src/components/chat/EquipBar.tsx
- export default fn `EquipBar()`

## src/components/ChatInput.tsx
- export default fn `ChatInput()`

## src/components/ChatMessage.tsx
- export default `memo(ChatMessage)`

## src/components/ChatSettingsMenu.tsx
- export default fn `ChatSettingsMenu()`

## src/components/ChatView.tsx
- export type `LineChange { line, type }`
- export type `FileEdit { filePath, editCount, lineNumbers, lineChanges, status }`
- export type `FileDeleted { filePath }`
- export default fn `ChatView()`

## src/components/claude-assets/AssetCard.tsx
- export default fn `AssetCard()`

## src/components/claude-assets/AssetPreviewModal.tsx
- export default fn `AssetPreviewModal()`

## src/components/claude-assets/AssetsBrowser.tsx
- export default fn `AssetsBrowser()`

## src/components/claude-assets/ClaudeAssetsPanel.tsx
- export default fn `ClaudeAssetsPanel({ projectPaths, onOpenFile, onSelectCommand, onSelectRule, onSelectDroid }: Cla...`

## src/components/claude-assets/index.ts
- re-export `ClaudeAssetsPanel` from './ClaudeAssetsPanel'
- re-export `ProjectsList` from './ProjectsList'
- re-export `AssetsBrowser` from './AssetsBrowser'
- re-export `AssetCard` from './AssetCard'
- re-export `AssetPreviewModal` from './AssetPreviewModal'

## src/components/claude-assets/ProjectsList.tsx
- export default fn `ProjectsList()`

## src/components/ClaudeAuthBanner.tsx
- export fn `ClaudeAuthBanner()`

## src/components/ClaudeAuthSettings.tsx
- export default fn `ClaudeAuthSettings()`

## src/components/CodeEditor.tsx
- export type `DiffInfo { additions, deletions, modifications }`
- export default fn `CodeEditor()`

## src/components/CodeEditorCodeMirror.tsx
- export type `DiffInfo { additions, deletions, modifications }`
- export type `SearchOptions { caseSensitive, wholeWord, regex }`
- export type `CodeEditorRef { search, nextMatch, previousMatch, clearSearch, replace, replaceAll }`
- export type `LineChange { line, type }`
- export default `CodeEditorCodeMirror`

## src/components/CodeEditorMonaco.tsx
- export type `SearchOptions { caseSensitive, wholeWord, regex }`
- export type `CodeEditorRef { search, nextMatch, previousMatch, clearSearch, replace, replaceAll, nextChange, previousChange }`
- export default `CodeEditorMonaco`

## src/components/CommandEditor.tsx
- export fn `CommandEditor({ isOpen, command, onClose, onSave }: CommandEditorProps)`

## src/components/CommandItem.tsx
- export fn `CommandItem({ command, onUse, onEdit, onDelete }: CommandItemProps)`

## src/components/CommandsList.tsx
- export fn `CommandsList()`

## src/components/CommandsPanel.tsx
- export fn `CommandsPanel({ basePath, onUseCommand, onSelectCommand }: CommandsPanelProps)`

## src/components/CommandViewer.tsx
- export default fn `CommandViewer()`

## src/components/CommitHistoryModal.tsx
- export default `CommitHistoryModal`

## src/components/ConflictResolver.tsx
- export default `ConflictResolver`

## src/components/ContextDrawer.tsx
- export default fn `ContextDrawer()`

## src/components/ContextMenu.tsx
- export default fn `ContextMenu()`

## src/components/ContextPanel.tsx
- export default fn `ContextPanel()`

## src/components/CustomPermissionSelect.tsx
- export default fn `CustomPermissionSelect({ value, onChange }: CustomPermissionSelectProps)`

## src/components/DebugPanel.tsx
- export default fn `DebugPanel()`

## src/components/DiffDrawer.tsx
- export default `DiffDrawer`

## src/components/DiffViewer.tsx
- export default `memo(DiffViewer)`

## src/components/docs/DocsComponents.tsx
- export default `DocsComponents`

## src/components/docs/DocsContent.tsx
- export default fn `DocsContent({ page, sections, onPageChange }: DocsContentProps)`

## src/components/docs/DocsSidebar.tsx
- export default fn `DocsSidebar()`

## src/components/docs/DocsViewer.tsx
- export type `DocsMeta { title, description, icon, order, sections, pages }`
- export type `DocsPage { path, title, content, section }`
- export type `DocsSection { slug, title, icon, order, pages }`
- export default fn `DocsViewer({ initialPath = 'guide/01-getting-started/introduction' }: DocsViewerProps)`

## src/components/DragHandle.tsx
- export default `DragHandle`

## src/components/droid-factory/AssemblyLine.tsx
- export fn `AssemblyLine()`

## src/components/droid-factory/DroidCollection.tsx
- export fn `DroidCollection({ userStats }: DroidCollectionProps)`

## src/components/droid-factory/DroidFactoryDrawer.tsx
- export fn `DroidFactoryDrawer()`

## src/components/droid-factory/DroidTemplateGallery.tsx
- export fn `DroidTemplateGallery({ onSelectTemplate }: DroidTemplateGalleryProps)`

## src/components/droid-factory/DroidWizard.tsx
- export fn `DroidWizard({ initialSpec, onCreateDroid, isCreating }: DroidWizardProps)`

## src/components/droid-factory/index.ts
- re-export `DroidFactoryDrawer` from './DroidFactoryDrawer'
- re-export `DroidTemplateGallery` from './DroidTemplateGallery'
- re-export `DroidWizard` from './DroidWizard'
- re-export `DroidCollection` from './DroidCollection'
- re-export `AssemblyLine` from './AssemblyLine'

## src/components/droid-factory/SkillTemplateGallery.tsx
- export fn `SkillTemplateGallery({ onSelectTemplate }: SkillTemplateGalleryProps)`

## src/components/droid-factory/SkillWizard.tsx
- export fn `SkillWizard({ initialSpec, onCreateSkill, isCreating }: SkillWizardProps)`

## src/components/droid-factory/types.ts
- export type `FactoryMode = 'droid' | 'skill'`
- export type `DroidSpec { name, displayName, description, personality, tools, model, specialization, icon }`
- export type `SkillSpec { name, displayName, description, category, hasScripts, hasReferences, hasAssets, icon }`
- export type `UserStats { droidsCreated, droidsUsed, achievements, favoriteTemplate, creationDates }`
- export type `Achievement { id, name, icon, description, unlockedAt }`
- export const `TOOL_LEVELS`
- export const `DROID_TEMPLATES: DroidSpec[]`
- export const `SKILL_TEMPLATES: SkillSpec[]`
- export const `ACHIEVEMENTS_CONFIG: Record<string, Omit<Achievement, 'id' | 'unlockedAt'>>`

## src/components/DuckAnimation.tsx
- export default fn `DuckAnimation()`

## src/components/EditSummary.tsx
- export type `FileEdit { filePath, editCount, lineNumbers }`
- export default `EditSummary`

## src/components/EditSummaryBar.tsx
- export type `LineChange { line, type }`
- export type `FileEdit { filePath, editCount, lineNumbers, lineChanges, status }`
- export type `FileDeleted { filePath }`
- export default fn `EditSummaryBar({ edits, deletes = [], onFileClick, onDiffClick, onOpenInQuack, onClear, onClearEd...`

## src/components/ErrorBoundary.tsx
- export default class `ErrorBoundary`

## src/components/FileActionButtons.tsx
- export default `memo(FileActionButtons)`

## src/components/FileContextMenu.tsx
- export default fn `FileContextMenu()`

## src/components/FileDiffButton.tsx
- export default fn `FileDiffButton({ filePath, onDiffClick, disabled = false }: FileDiffButtonProps)`

## src/components/FileExplorer.tsx
- export default `memo(FileExplorer, (prevProps, nextProps) => {`

## src/components/FileIcon.tsx
- export default fn `FileIcon({ name, isDirectory, isOpen = false, size = 16 }: FileIconProps)`

## src/components/FilePreviewDrawer.tsx
- export type `FilePreviewDrawerRef { triggerSave, isEditMode, toggleEditMode }`
- export default `memo(FilePreviewDrawer, (prev, next) => prev.open === next.open && !next.open)`

## src/components/FileStatusBadge.tsx
- export type `FileStatus = 'created' | 'modified' | 'deleted'`
- export default fn `FileStatusBadge({ status }: FileStatusBadgeProps)`

## src/components/GitFilesColumn.tsx
- export default `GitFilesColumn`

## src/components/GitOperationsDropdown.tsx
- export default fn `GitOperationsDropdown()`

## src/components/GitPanel.tsx
- export default `GitPanel`

## src/components/GitSidebar.tsx
- export default `GitSidebar`

## src/components/GroupHeader.tsx
- export default fn `GroupHeader()`

## src/components/HookBadge.tsx
- export fn `HookBadge({ event, compact = false }: HookBadgeProps)`
- export fn `HookExecutionList({ events, defaultExpanded = false }: HookExecutionListProps)`
- export default `HookBadge`

## src/components/HooksPanel.tsx
- export default fn `HooksPanel()`

## src/components/JsonViewer.tsx
- export fn `JsonViewer({ data, maxHeight = '400px' })`

## src/components/kanban/AddKanbanTaskModal.tsx
- export type `KanbanTaskInitialValues { projectPath, projectName, branch, agentId, agentName, agentAvatar, agentColor, targetStatus }`
- export type `KanbanTaskDraft { title, prompt, projectPath, branch, agentId, attachments }`
- export default fn `AddKanbanTaskModal()`

## src/components/kanban/index.ts
- re-export `KanbanView` from './KanbanView'
- re-export `KanbanColumn` from './KanbanColumn'
- re-export `KanbanCard` from './KanbanCard'
- re-export `KanbanCardOverlay` from './KanbanCard'
- re-export `AddKanbanTaskModal` from './AddKanbanTaskModal'

## src/components/kanban/KanbanCard.tsx
- export default fn `KanbanCard()`
- export fn `KanbanCardOverlay({ task }: { task: KanbanTask })`

## src/components/kanban/KanbanColumn.tsx
- export default fn `KanbanColumn()`

## src/components/kanban/KanbanMiniPanel.tsx
- export default fn `KanbanMiniPanel()`

## src/components/kanban/KanbanPopoutView.tsx
- export default fn `KanbanPopoutView()`

## src/components/kanban/KanbanView.tsx
- export default fn `KanbanView()`

## src/components/KanbanNotificationBar.tsx
- export default fn `KanbanNotificationBar()`

## src/components/KeyboardShortcutTooltip.tsx
- export default fn `KeyboardShortcutTooltip()`

## src/components/LicenseModal.tsx
- export fn `LicenseModal({ isOpen, onClose, onSuccess })`

## src/components/MarkdownText.tsx
- export default fn `MarkdownText({ children }: MarkdownTextProps)`

## src/components/MarketplaceCard.tsx
- export default fn `MarketplaceCard()`

## src/components/MarketplaceDrawer.tsx
- export default fn `MarketplaceDrawer()`

## src/components/MarketplaceInstallModal.tsx
- export default fn `MarketplaceInstallModal()`

## src/components/MaxPlanStatsModal.tsx
- export default fn `MaxPlanStatsModal()`

## src/components/MCPPanel.tsx
- export default fn `MCPPanel({ workingDir, onRefresh, onOpenMcpConfig }: MCPPanelProps)`

## src/components/MCPServerCard.tsx
- export default fn `MCPServerCard()`

## src/components/MCPServerModal.tsx
- export default fn `MCPServerModal()`

## src/components/MCPTemplateCard.tsx
- export default fn `MCPTemplateCard()`

## src/components/MermaidDiagram.tsx
- export default fn `MermaidDiagram({ children }: MermaidDiagramProps)`

## src/components/MessageList.tsx
- export default fn `MessageList({ messages, loading, onFilePathClick, onSessionIdClick, agentName, agentAvatar, proje...`

## src/components/MessageListVirtualized.tsx
- export default `memo(MessageListVirtualized, (prevProps, nextProps) => {`

## src/components/MessageSettingsBadges.tsx
- export default `memo(MessageSettingsBadges)`

## src/components/MetroLine.tsx
- export default fn `MetroLine()`

## src/components/modal-steps/CreateRuleModal.tsx
- export fn `CreateRuleModal()`

## src/components/modal-steps/index.ts
- re-export `StepProgress` from './StepProgress'
- re-export `StepProjectContext` from './StepProjectContext'
- re-export `StepProjectSelection` from './StepProjectSelection'
- re-export `StepAgentBasics` from './StepAgentBasics'
- re-export `StepRules` from './StepRules'

## src/components/modal-steps/StepAgentBasics.tsx
- export fn `StepAgentBasics()`

## src/components/modal-steps/StepProgress.tsx
- export fn `StepProgress({ currentStep, completedSteps, isEditing }: StepProgressProps)`

## src/components/modal-steps/StepProjectContext.tsx
- export fn `StepProjectContext()`

## src/components/modal-steps/StepProjectSelection.tsx
- export fn `StepProjectSelection()`

## src/components/modal-steps/StepRules.tsx
- export fn `StepRules()`

## src/components/modal-steps/StepStarterBundles.tsx
- export fn `StepStarterBundles()`

## src/components/modal-steps/types.ts
- export type `ModalStep = 'project' | 'starters' | 'agent' | 'basics' | 'rules' | '...`
- export type `ActiveProject { name, path, color, agentCount }`
- export type `StepProjectContextProps { path, branch, useWorktree, availableBranches, loadingBranches, isGitRepository, initializingGit, selectingDirectory, onBrowse, onBranchChange, onUseWorktreeChange, onGitInit, onNext, onCancel, isUsing, onUseConfirm }`
- export type `StepAgentBasicsProps { name, color, avatar, availableColors, customAvatars, customAvatarUrls, loadingAvatars, uploadingAvatar, uploadError, personality, onNameChange, onColorChange, onAvatarChange, onPersonalityChange, onAvatarUpload, onDeleteCustomAvatar, fileInputRef, onNext, onBack }`
- export type `StepRulesProps { availableRules, project, global }`
- export type `StepProgressProps { currentStep, completedSteps, isEditing }`
- export type `SkillMetadata { id, name, description, path, isGlobal }`
- export type `DroidMetadata { id, name, description, specialization, path, isGlobal }`

## src/components/NewAgentModal.tsx
- export fn `NewAgentModal({ isOpen, onClose, onSave, existingAgents }: NewAgentModalProps)`

## src/components/NewSessionModal.tsx
- export default fn `NewSessionModal()`

## src/components/NewTerminalModal.old.tsx
- export default `NewTerminalModal`

## src/components/NewTerminalModal.tsx
- export default `NewTerminalModal`

## src/components/OpenInIDEButton.tsx
- export default fn `OpenInIDEButton()`

## src/components/PerformanceMonitor.tsx
- export default fn `PerformanceMonitor()`

## src/components/PersonalityBuilder.tsx
- export default `PersonalityBuilder`

## src/components/PipAgentCard.tsx
- export default `PipAgentCard`

## src/components/PipWindow.tsx
- export default `PipWindow`

## src/components/PlanWidget.tsx
- export default `PlanWidget`

## src/components/PluginCard.tsx
- export default fn `PluginCard()`

## src/components/PluginsPanel.tsx
- export default fn `PluginsPanel()`

## src/components/PowerBadge.tsx
- export default fn `PowerBadge()`

## src/components/PreviewDrawer.tsx
- export default fn `PreviewDrawer()`

## src/components/PreviewPanel.tsx
- export default fn `PreviewPanel()`

## src/components/ProBanner.tsx
- export fn `ProBanner()`

## src/components/ProcessesDrawer.tsx
- export default fn `ProcessesDrawer()`

## src/components/project-dashboard/ProjectDashboard.tsx
- export default fn `ProjectDashboard()`

## src/components/ProjectTerminalItem.tsx
- export fn `ProjectTerminalItem()`

## src/components/ProjectToast.tsx
- export type `ProjectToastProps { projectName, projectColor, agentName, agentAvatar, message, type }`
- export fn `ProjectToast()`
- export fn `showProjectToast(props: ProjectToastProps, duration = 4000)`
- export const `projectToast`
- export default `ProjectToast`

## src/components/QuackAgencyDrawer.tsx
- export default fn `QuackAgencyDrawer()`

## src/components/QuackAgencySetupWizard.tsx
- export default fn `QuackAgencySetupWizard()`

## src/components/RepositoryGroup.tsx
- export default fn `RepositoryGroup()`

## src/components/RevealInFinderButton.tsx
- export default fn `RevealInFinderButton()`

## src/components/RuleEditor.tsx
- export fn `RuleEditor({ isOpen, rule, onClose, onSave }: RuleEditorProps)`

## src/components/RuleItem.tsx
- export fn `RuleItem({ rule, onEdit, onDelete }: RuleItemProps)`

## src/components/RulesList.tsx
- export fn `RulesList()`

## src/components/RulesPanel.tsx
- export fn `RulesPanel({ basePath, onSelectRule }: RulesPanelProps)`

## src/components/RuleViewer.tsx
- export default fn `RuleViewer()`

## src/components/SavedCommandModal.tsx
- export default fn `SavedCommandModal()`

## src/components/SavedCommands.tsx
- export default fn `SavedCommands()`

## src/components/SavedCommandsDrawer.tsx
- export default fn `SavedCommandsDrawer()`

## src/components/SearchToolbar.tsx
- export type `SearchOptions { caseSensitive, wholeWord, regex }`
- export default `memo(SearchToolbar)`

## src/components/SessionDetailsDrawer.tsx
- export default fn `SessionDetailsDrawer()`

## src/components/SessionEmptyState.tsx
- export default fn `SessionEmptyState()`

## src/components/SessionIdDisplay.tsx
- export default fn `SessionIdDisplay({ sessionId, className = '' }: SessionIdDisplayProps)`

## src/components/SessionsPanel.tsx
- export fn `SessionsPanel({ onSelectSession }: SessionsPanelProps)`

## src/components/settings/categories/AboutSettings.tsx
- export default fn `AboutSettings()`

## src/components/settings/categories/AgentModesSettings.tsx
- export default fn `AgentModesSettings()`

## src/components/settings/categories/AIAssistantSettings.tsx
- export default fn `AIAssistantSettings()`

## src/components/settings/categories/AppearanceSettings.tsx
- export default fn `AppearanceSettings()`

## src/components/settings/categories/ClaudeCodeSettings.tsx
- export default fn `ClaudeCodeSettings()`

## src/components/settings/categories/CodebaseMapSettings.tsx
- export default fn `CodebaseMapSettings()`

## src/components/settings/categories/DebugSettings.tsx
- export default fn `DebugSettings()`

## src/components/settings/categories/GeneralSettings.tsx
- export default fn `GeneralSettings()`

## src/components/settings/categories/IDESettings.tsx
- export default fn `IDESettings()`

## src/components/settings/categories/KeyboardShortcutsSettings.tsx
- export default fn `KeyboardShortcutsSettings()`

## src/components/settings/categories/LicenseSettings.tsx
- export default fn `LicenseSettings()`

## src/components/settings/categories/NotificationSettings.tsx
- export default fn `NotificationSettings()`

## src/components/settings/categories/SecondBrainSettings.tsx
- export default fn `SecondBrainSettings()`

## src/components/settings/categories/TerminalSettings.tsx
- export default fn `TerminalSettings()`

## src/components/settings/controls/IOSInput.tsx
- export default fn `IOSInput()`

## src/components/settings/controls/IOSSwitch.tsx
- export default fn `IOSSwitch({ checked, onChange, disabled = false }: IOSSwitchProps)`

## src/components/settings/controls/SectionHeader.tsx
- export default fn `SectionHeader({ title, description }: SectionHeaderProps)`

## src/components/settings/controls/SettingsRow.tsx
- export default fn `SettingsRow({ label, description, control }: SettingsRowProps)`

## src/components/settings/controls/ShortcutInput.tsx
- export default fn `ShortcutInput()`

## src/components/settings/IDEOnboarding.tsx
- export default fn `IDEOnboarding()`

## src/components/settings/SettingsContent.tsx
- export default fn `SettingsContent({ children }: SettingsContentProps)`

## src/components/settings/SettingsIcon.tsx
- export default fn `SettingsIcon({ category, className = '' }: SettingsIconProps)`

## src/components/settings/SettingsSidebar.tsx
- export type `SettingsCategory`
- export default fn `SettingsSidebar({ activeCategory, onSelectCategory }: SettingsSidebarProps)`

## src/components/settings/UnifiedSettings.tsx
- export default fn `UnifiedSettings()`

## src/components/SetupStepFeatures.tsx
- export default fn `SetupStepFeatures()`

## src/components/SetupStepOptions.tsx
- export default fn `SetupStepOptions()`

## src/components/SetupStepProject.tsx
- export default fn `SetupStepProject()`

## src/components/SetupStepReview.tsx
- export default fn `SetupStepReview()`

## src/components/SetupStepWelcome.tsx
- export default fn `SetupStepWelcome()`

## src/components/SidePanel.tsx
- export default fn `SidePanel()`

## src/components/SkeletonMessage.tsx
- export default fn `SkeletonMessage()`

## src/components/skeletons/CodeEditorSkeleton.tsx
- export default `CodeEditorSkeleton`

## src/components/skeletons/ModalSkeleton.tsx
- export default `ModalSkeleton`

## src/components/skeletons/SettingsSkeleton.tsx
- export default `SettingsSkeleton`

## src/components/SkillDrawer.tsx
- export default fn `SkillDrawer()`

## src/components/SkillsPanel.tsx
- export default fn `SkillsPanel()`

## src/components/SkillViewer.tsx
- export default fn `SkillViewer()`

## src/components/SlashCommandAutocomplete.tsx
- export fn `SlashCommandAutocomplete()`

## src/components/SnippetModal.tsx
- export fn `SnippetModal()`
- export default `SnippetModal`

## src/components/SnippetPopover.tsx
- export fn `SnippetPopover()`
- export default `SnippetPopover`

## src/components/SplashScreen.tsx
- export default fn `SplashScreen({ onComplete, version }: SplashScreenProps)`

## src/components/StandaloneTerminal.tsx
- export default fn `StandaloneTerminal()`

## src/components/StorageMetrics.tsx
- export default fn `StorageMetrics({ className }: StorageMetricsProps)`

## src/components/StreamMessage.tsx
- export default `memo(StreamMessage)`

## src/components/structured-outputs/BugReportWidget.tsx
- export default fn `BugReportWidget({ data, onFileClick }: BugReportWidgetProps)`

## src/components/structured-outputs/index.ts
- re-export `BugReportWidget` from './BugReportWidget'
- re-export `WebAnalysisCard` from './WebAnalysisCard'

## src/components/structured-outputs/WebAnalysisCard.tsx
- export default fn `WebAnalysisCard({ data, onLinkClick }: WebAnalysisCardProps)`

## src/components/TabBar.tsx
- export type `Tab { id, label, type, closable, filePath, color, terminalId, icon, agentName, agentScope, isNewAgent, url, skillName, skillScope, command, commandName, commandScope, isNewCommand, ruleName }`
- export type `PopoutPosition { x, y, screenX, screenY }`
- export default `memo(TabBar)`

## src/components/TabPopoutWindowApp.tsx
- export default `TabPopoutWindowApp`

## src/components/TaskAgentAvatar.tsx
- export fn `TaskAgentAvatar({ subagentType }: TaskAgentAvatarProps)`

## src/components/TaskContextMenu.tsx
- export default fn `TaskContextMenu()`

## src/components/TaskDetailsDrawer.tsx
- export default fn `TaskDetailsDrawer()`

## src/components/TaskOutputWidget.tsx
- export fn `TaskOutputWidget()`
- export default `TaskOutputWidget`

## src/components/TasksPanel.tsx
- export default fn `TasksPanel()`

## src/components/TaskWidget.tsx
- export fn `TaskWidget({ subagentType, description, isLoading, workingDirectory }: TaskWidgetProps)`

## src/components/TelegramSetup.tsx
- export default fn `TelegramSetup({ open, onClose }: TelegramSetupProps)`

## src/components/terminal/index.ts
- re-export `TerminalMain` from './TerminalMain'
- re-export `TerminalInstance` from './TerminalInstance'
- re-export `useTerminal` from './useTerminal'

## src/components/terminal/TerminalInstance.tsx
- export type `TerminalInstanceProps { terminalId, isActive, themeName, cursorColor, onData, onExit }`
- export const `TerminalInstance`

## src/components/terminal/TerminalMain.tsx
- export type `TerminalMainProps { terminals, activeTerminalId, themeName, onTerminalData, onTerminalExit }`
- export fn `TerminalMain()`

## src/components/terminal/TerminalThemes.ts
- export type `TerminalThemeName`
- export type `TerminalTheme { name, label, description, colors }`
- export const `TERMINAL_THEMES: Record<TerminalThemeName, TerminalTheme>`
- export fn `getTerminalTheme(name: TerminalThemeName): TerminalTheme`
- export fn `getThemeNames(): TerminalThemeName[]`
- export fn `getAllThemes(): TerminalTheme[]`

## src/components/terminal/useTerminal.ts
- export type `UseTerminalOptions { terminalId, theme, cursorColor, onData, onExit }`
- export type `UseTerminalReturn { containerRef, terminal, resize, write }`
- export fn `useTerminal(options: UseTerminalOptions): UseTerminalReturn`

## src/components/TerminalActivityBar.tsx
- export default `memo(TerminalActivityBar, (prevProps, nextProps) => {`

## src/components/TerminalDrawer.tsx
- export fn `TerminalDrawer()`
- export fn `disposeTerminal(terminalId: string)`

## src/components/TerminalGroup.tsx
- export default fn `TerminalGroup()`

## src/components/TerminalIcon.tsx
- export default `memo(TerminalIcon)`

## src/components/TerminalQuickActions.tsx
- export default fn `TerminalQuickActions()`

## src/components/TerminalSidebar.tsx
- export default fn `TerminalSidebar()`

## src/components/TerminalSidebarPanel.tsx
- export fn `TerminalSidebarPanel()`

## src/components/TerminalTabs.tsx
- export default fn `TerminalTabs()`

## src/components/TerminalToolBar.tsx
- export default fn `TerminalToolBar()`

## src/components/TerminalView.tsx
- export default `memo(TerminalView, (prevProps, nextProps) => {`

## src/components/TerminalWindow.tsx
- export fn `TerminalWindow({ visible }: TerminalWindowProps)`

## src/components/TerminalWindowApp.tsx
- export fn `TerminalWindowApp()`

## src/components/TerminalWindowButton.tsx
- export default fn `TerminalWindowButton()`

## src/components/TerminalWindowsPanel.tsx
- export fn `TerminalWindowsPanel()`

## src/components/ThinkingBlock.tsx
- export default `memo(ThinkingBlock)`

## src/components/TitleBar.tsx
- export fn `TitleBar({ title })`

## src/components/TodoProgressBar.tsx
- export type `TodoItem { content, status, activeForm }`
- export default fn `TodoProgressBar({ todos }: TodoProgressBarProps)`

## src/components/TodoWidget.tsx
- export type `TodoItem { content, status, activeForm }`
- export default `TodoWidget`

## src/components/TokenUsageIndicator.tsx
- export default `memo(TokenUsageIndicator, (prevProps, nextProps) => {`

## src/components/TokenUsageModal.tsx
- export default fn `TokenUsageModal()`

## src/components/TokenWarningBanner.tsx
- export default fn `TokenWarningBanner()`

## src/components/ToolBar.tsx
- export default fn `ToolBar()`

## src/components/ToolCallCard.tsx
- export default `memo(ToolCallCard)`

## src/components/ToolGifInline.tsx
- export fn `ToolGifInline({ toolName, toolId })`
- export default `ToolGifInline`

## src/components/ToolGifOverlay.tsx
- export fn `ToolGifOverlay({ events })`
- export default `ToolGifOverlay`

## src/components/ToolGifWidget.tsx
- export fn `ToolGifWidget()`
- export default `ToolGifWidget`

## src/components/Tooltip.tsx
- export default fn `Tooltip()`

## src/components/ToolWidgets.tsx
- export fn `getToolColor(toolName: string): string`
- export fn `ToolIcon({ name })`
- export const `SystemInitializedWidget`
- export const `EditWidget`
- export const `WriteWidget`
- export const `BashWidget`
- export const `ReadWidget`
- export const `GrepWidget`
- export const `TodoWriteWidget`
- export const `ExitPlanModeWidget`
- export const `EnterPlanModeWidget`
- export const `ImagePreviewWidget`

## src/components/UpgradeModal.tsx
- export fn `UpgradeModal()`

## src/components/UsagePanel.tsx
- export default fn `UsagePanel({ sessions, onClearUsage, onCreateTerminalWithCommand, isActive, currentCwd }: UsagePa...`

## src/components/VoiceRecordingModal.tsx
- export default fn `VoiceRecordingModal()`

## src/components/WizardStep.tsx
- export default fn `WizardStep()`

## src/components/XTermInstance.tsx
- export fn `XTermInstance({ terminalId, color, isActive }: XTermInstanceProps)`
- export fn `disposeXTermInstance(terminalId: string)`

## src/composables/usePreviewManager.tsx
- export type `PreviewProfile { id, label, port, url, command, cwd, isLive, terminalId }`
- export fn `PreviewManagerProvider()`
- export fn `usePreviewManager()`

## src/composables/usePreviewWebView.ts
- export fn `usePreviewWebView()`

## src/config/features.ts
- export const `FREE_LIMITS`
- export const `PRO_FEATURES`
- export type `LicenseData { key, email, deviceId, activatedAt, expiresAt, type, valid, lastValidatedAt }`
- export fn `isPro(): boolean`
- export fn `getLicenseData(): LicenseData | null`
- export fn `saveLicenseData(license: LicenseData): void`
- export fn `clearLicenseData(): void`
- export fn `hasFeature(feature: keyof typeof PRO_FEATURES): boolean`
- export fn `getLimit(resource: keyof typeof FREE_LIMITS): number | boolean`
- export fn `canCreateTerminal(currentCount: number): boolean`
- export fn `canCreateGroup(currentCount: number): boolean`
- export fn `getUpgradeMessage(limitType: string): string`
- export fn `formatLicenseType(type: 'lifetime' | 'subscription'): string`
- export fn `getDaysUntilExpiry(expiresAt?: number): number | null`
- export fn `isExpiringSoon(expiresAt?: number): boolean`
- export fn `needsRevalidation(lastValidatedAt?: number): boolean`
- export const `revalidateLicense: Promise<boolean>`

## src/contexts/ChatContext.tsx
- export fn `ChatProvider({ children }: { children: React.ReactNode })`
- export fn `useChat()`

## src/contexts/FileSystemContext.tsx
- export fn `FileSystemProvider({ children }: { children: React.ReactNode })`
- export fn `useFileSystem()`

## src/contexts/GitContext.tsx
- export fn `GitProvider({ children }: { children: React.ReactNode })`
- export fn `useGit()`

## src/contexts/index.tsx
- export fn `AppProviders({ children }: { children: React.ReactNode })`
- re-export `useTerminals` from './TerminalContext'
- re-export `useChat` from './ChatContext'
- re-export `useFileSystem` from './FileSystemContext'
- re-export `useGit` from './GitContext'
- re-export `useUI` from './UIContext'
- re-export `useTestMode` from './TestModeContext'
- re-export `useClaudeCliAvailability` from './TestModeContext'
- re-export `useAnalytics` from './PostHogContext'

## src/contexts/MaxPlanContext.tsx
- export fn `MaxPlanProvider({ children }: { children: ReactNode })`
- export fn `useMaxPlan()`

## src/contexts/PostHogContext.tsx
- export type `AnalyticsEvents { app_opened, app_closed, terminal_created, terminal_closed, command_executed, ai_message_sent, ai_response_received, ai_error, file_opened, file_saved }`
- export type `UserProperties { plan, deviceId, appVersion, platform, terminalCount }`
- export fn `PostHogProvider({ children })`
- export fn `useAnalytics(): PostHogContextValue`

## src/contexts/TerminalContext.tsx
- export fn `TerminalProvider({ children }: { children: React.ReactNode })`
- export fn `useTerminals()`

## src/contexts/TestModeContext.tsx
- export fn `TestModeProvider({ children }: { children: React.ReactNode })`
- export fn `useTestMode()`
- export fn `useClaudeCliAvailability()`

## src/contexts/UIContext.tsx
- export fn `UIProvider({ children }: { children: React.ReactNode })`
- export fn `useUI()`

## src/contexts/ZustandProvider.tsx
- export fn `ZustandProvider({ children }: { children: ReactNode })`
- export fn `useStores()`
- export fn `useTerminal()`
- export fn `useUI()`
- export fn `useGit()`
- export fn `useFileSystem()`
- export fn `useChat()`

## src/examples/StructuredOutputsExample.tsx
- export default fn `StructuredOutputsExample()`

## src/examples/ZustandMigrationExample.tsx
- export fn `TerminalListExample()`
- export fn `OptimizedTerminalView()`
- export fn `AppStatusBar()`
- export fn `GitCommitButton()`
- export fn `SettingsPanel()`
- export fn `UIControls()`
- export default fn `ZustandExamples()`

## src/hooks/maxPlanTypes.ts
- export type `MaxPlanType = 'pro' | 'max5x' | 'max20x'`
- export type `MaxPlanConfig { planType, messageLimit, tokenLimit, windowHours }`
- export type `MaxPlanSession { startTime, messageCount, totalTokens }`
- export type `MaxPlanStats { messageCount, messageLimit, messagePercentage, sessionStartTime, sessionDuration, windowEndsAt, timeRemaining, burnRatePerHour, estimatedTimeUntilLimit, planType, isNearLimit, isCritical }`
- export type `DailyUsage { date, messageCount, totalTokens, planType }`
- export type `WeeklyUsage { week, messageCount, totalTokens, planType }`
- export type `MaxPlanHistoryData { dailyUsage, weeklyUsage, totalMessages, totalTokens, averageMessagesPerDay, averageTokensPerDay, peakDay, peakWeek }`

## src/hooks/useAgentAvatar.ts
- export fn `useAgentAvatar(agentName: string, avatarFilename?: string): string`

## src/hooks/useAgentInfo.ts
- export fn `useAgentInfo(agentId: string, workingDir?: string): AgentInfoResult`
- export fn `clearAgentInfoCache(): void`

## src/hooks/useAgentRules.ts
- export type `AgentRuleInfo { name, description, filePath, scope, alwaysApply, globs }`
- export fn `useAgentRules()`
- export fn `getRulesSummary(rules: AgentRuleInfo[]): string`

## src/hooks/useAITriggerGenerator.ts
- export type `AITriggerGeneratorOptions { name, description, specialization, category }`
- export type `AITriggerResult { trigger, isAIGenerated, model }`
- export type `UseAITriggerGeneratorReturn { generateTrigger, isGenerating, error, isAvailable }`
- export fn `useAITriggerGenerator(): UseAITriggerGeneratorReturn`
- export fn `generateTriggersInBatch()`

## src/hooks/useAppConfig.ts
- export fn `useAppConfig()`
- export fn `usePricingConfig()`
- export fn `useCheckoutConfig()`
- export fn `useFeaturesConfig()`
- export fn `useModelsConfig()`

## src/hooks/useBackgroundAgents.ts
- export fn `useBackgroundAgents(): UseBackgroundAgentsReturn`
- export fn `useBackgroundAgentInit(): void`
- export fn `useBackgroundTaskCompletion()`
- export fn `useBackgroundTaskChatResults()`
- export fn `useBackgroundTaskBadge()`
- export default `useBackgroundAgents`

## src/hooks/useBundleOperations.ts
- export fn `useBundleOperations(): BundleOperations`

## src/hooks/useClaudeAssets.ts
- export fn `useClaudeAssets(initialProjectPaths?: string[]): UseClaudeAssetsReturn`
- export default `useClaudeAssets`

## src/hooks/useClaudeAssetsTab.ts
- export fn `useClaudeAssetsTab()`
- export default `useClaudeAssetsTab`

## src/hooks/useClaudeChat.ts
- export type `ThinkingMode = 'auto' | 'think' | 'hard' | 'harder' | 'ultra'`
- export type `PermissionMode = 'plan' | 'bypass'`
- export fn `parseThinkingControl(prompt: string, currentMode: ThinkingMode): ThinkingMode`
- export type `ChatSendOptions { attachments, model, thinkingMode, permissionMode, workingDirectory, onComplete, outputFormat, effort, onTokenWarning, onTokenBlocked, bypassTokenCheck }`
- export type `UseClaudeChatOptions { initialSessionId, initialTokens, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens }`
- export fn `useClaudeChat(options?: UseClaudeChatOptions)`

## src/hooks/useClaudeEventListener.ts
- export type `UseClaudeEventListenerOptions { tauriAvailable, activeId, activeAgentIds, onEventReceived }`
- export type `UseClaudeEventListenerReturn { ensureListenerReady, cleanupListener, hasListener }`
- export fn `useClaudeEventListener()`

## src/hooks/useCurrentProject.ts
- export type `ProjectInfo { root_path, name, markers }`
- export type `MemoryScope = 'global' | 'project'`
- export const `PROJECT_CHANGED_EVENT`
- export fn `dispatchProjectChange(project: ProjectInfo | null): void`
- export fn `useCurrentProject(initialPath?: string): UseCurrentProjectReturn`
- export default `useCurrentProject`

## src/hooks/useDeepLinkHandler.ts
- export fn `useDeepLinkHandler(onOpenFile: (payload: OpenFilePayload)`
- export fn `testDeepLink(url: string): Promise<OpenFilePayload | null>`

## src/hooks/useDocsTab.tsx
- export fn `useDocsTab(): UseDocsTabReturn`

## src/hooks/useDrawerAnimation.ts
- export fn `useDrawerAnimation()`

## src/hooks/useDroidFactory.ts
- export fn `useDroidFactory()`

## src/hooks/useGlobalKeyboardShortcuts.ts
- export fn `useGlobalKeyboardShortcuts(actions: ShortcutActions): void`

## src/hooks/useKanbanChatStore.ts
- export fn `useKanbanChatStore(agentId: string | null): UseKanbanChatStoreReturn`

## src/hooks/useKanbanChatSync.ts
- export fn `useKanbanChatSync(options: UseKanbanChatSyncOptions = {}): UseKanbanChatSyncReturn`

## src/hooks/useKanbanTab.ts
- export fn `useKanbanTab(): UseKanbanTabReturn`

## src/hooks/useMarketplace.ts
- export fn `useMarketplace()`

## src/hooks/useMaxPlanHistory.ts
- export fn `useMaxPlanHistory()`

## src/hooks/useMaxPlanNotifications.ts
- export fn `useMaxPlanNotifications(stats: MaxPlanStats)`

## src/hooks/useMaxPlanTracking.ts
- export fn `useMaxPlanTracking()`
- export fn `formatTimeRemaining(ms: number): string`
- export fn `formatTime(timestamp: number): string`
- export fn `getPlanDisplayName(planType: MaxPlanType): string`

## src/hooks/useMCPServers.ts
- export type `UseMCPServersReturn { servers, templates, loading, error, refreshServers, addServer, updateServer, deleteServer, testConnection, stopServer, restartServer, getServerStatus }`
- export fn `useMCPServers(workingDir?: string): UseMCPServersReturn`

## src/hooks/useMicRecorder.ts
- export fn `useMicRecorder()`

## src/hooks/useMonacoDiff.ts
- export type `LineChange { line, type }`
- export type `DiffInfo { additions, deletions, modifications }`
- export fn `useMonacoDiff()`
- export default `useMonacoDiff`

## src/hooks/useMonacoTheme.ts
- export const `QUACK_THEME_NAME`
- export type `MonacoThemeColors { background, foreground, selectionBackground, lineHighlight, gutterBackground, gutterForeground, cursor }`
- export fn `defineQuackTheme(monaco: Monaco): void`
- export fn `useMonacoTheme(customColors?: Partial<MonacoThemeColors>)`
- export default `useMonacoTheme`

## src/hooks/usePipWindow.ts
- export fn `usePipWindow()`

## src/hooks/usePopoutKanbanChat.ts
- export fn `usePopoutKanbanChat(): UsePopoutKanbanChatReturn`

## src/hooks/useProjectColor.ts
- export fn `useProjectColor(projectPath: string, projectIndex: number = 0): string`
- export fn `invalidateProjectColorCache(): void`
- export fn `getProjectColorSync(projectPath: string, projectIndex: number = 0): string`

## src/hooks/useProjectDashboard.ts
- export type `GitStatusData { branch, ahead, behind, dirty, files, stagedCount, unstagedCount }`
- export type `GitCommit { hash, message, author, timestamp }`
- export type `GitWorktree { path, branch, isCurrent }`
- export type `ProjectDashboardData { gitStatus, commits, worktrees, todoCount, inProgressCount, doneCount, isLoading, error }`
- export fn `useProjectDashboard(projectPath: string): ProjectDashboardData`

## src/hooks/useProjectDashboardTab.ts
- export type `UseProjectDashboardTabReturn { openProjectDashboardTab, isProjectDashboardTab }`
- export fn `useProjectDashboardTab(): UseProjectDashboardTabReturn`

## src/hooks/useRules.ts
- export fn `useRules(basePath: string)`

## src/hooks/useSessionMessageSync.ts
- export fn `useSessionMessageSync()`

## src/hooks/useSessions.ts
- export fn `useSessions()`
- export fn `parseSessionHistory(historyContent: string)`

## src/hooks/useSlashCommands.ts
- export type `SlashCommand { name, description, content, isBuiltin, parameters, scope }`
- export type `SlashCommandsResponse { builtin, custom }`
- export fn `useSlashCommands(basePath: string)`

## src/hooks/useSnippets.ts
- export const `SNIPPET_VARIABLES`
- export fn `useSnippets(): UseSnippetsReturn`
- export fn `getCursorPosition(content: string): number`
- export fn `removeCursorMarker(content: string): string`

## src/hooks/useSpeechRecognition.ts
- export fn `useSpeechRecognition()`

## src/hooks/useSupertagConfig.ts
- export type `UseSupertagConfigReturn { configs, isLoading, getConfig, getColor, getProperties, saveConfig }`
- export fn `useSupertagConfig(): UseSupertagConfigReturn`

## src/hooks/useSystemWakeHandler.ts
- export fn `useSystemWakeHandler(options: WakeHandlerOptions = {})`
- export default `useSystemWakeHandler`

## src/hooks/useTabPopoutWindow.ts
- export fn `useTabPopoutWindow(onTabReturn?: (tab: Tab)`

## src/hooks/useTelegramBot.ts
- export fn `useTelegramBot()`

## src/hooks/useTerminalWindowManager.ts
- export type `ProjectInfo { path, name }`
- export type `InitialCommand { projectPath, command, terminalLabel }`
- export fn `useTerminalWindowManager()`

## src/hooks/useTerminalWindows.ts
- export fn `useTerminalWindows()`

## src/hooks/useToolGifReaction.ts
- export type `ActiveToolGif { toolId, toolName, gif, startTime, isComplete }`
- export type `UseToolGifReactionOptions { enabled, maxConcurrentGifs, minDisplayTime }`
- export type `UseToolGifReactionReturn { activeGifs, onToolStart, onToolComplete, dismissGif, clearAllGifs, isEnabled }`
- export fn `useToolGifReaction()`
- export default `useToolGifReaction`

## src/hooks/useUpdateChecker.ts
- export fn `useUpdateChecker()`

## src/hooks/useWhisperRecognition.ts
- export fn `useWhisperRecognition()`

## src/lib/diffParser.ts
- export fn `parseDiff(diffContent: string): DiffInfo`
- export fn `emptyDiffInfo(): DiffInfo`

## src/lib/monacoSetup.ts
- export fn `setupMonacoEnvironment(): void`
- export fn `isMonacoSetup(): boolean`

## src/lib/triggerQuality.ts
- export const `QUALITY_WEIGHTS`
- export type `QualityLevel = 'weak' | 'moderate' | 'strong'`
- export type `TriggerQuality { level, score, message }`
- export fn `detectCategory(name: string, description: string): string`
- export fn `calculateTriggerQuality(trigger: string): TriggerQuality`
- export fn `generateSmartTrigger()`
- export const `TRIGGER_SUGGESTIONS: Record<string, string[]>`
- export const `EXAMPLE_TRIGGERS: Record<string, string>`

## src/polyfills/empty-module.ts
- export fn `readFileSync()`
- export fn `writeFileSync()`
- export fn `existsSync()`
- export fn `mkdirSync()`
- export fn `readdirSync()`
- export fn `statSync()`
- export fn `unlinkSync()`
- export fn `readFile()`
- export fn `writeFile()`
- export fn `mkdir()`
- export fn `readdir()`
- export fn `stat()`
- export fn `unlink()`
- export fn `access()`
- export const `constants`
- export fn `join(...args: string[])`
- export fn `resolve(...args: string[])`
- export fn `dirname(p: string)`
- export fn `basename(p: string)`
- export fn `extname(p: string)`
- export fn `sep()`
- export fn `delimiter()`
- export fn `isAbsolute()`
- export fn `relative()`
- export fn `normalize(p: string)`
- export fn `parse()`
- export fn `format()`
- export fn `homedir()`
- export fn `tmpdir()`
- export fn `platform()`
- export fn `arch()`
- export fn `cpus()`
- export fn `freemem()`
- export fn `totalmem()`
- export fn `hostname()`
- export fn `type()`
- export fn `release()`
- export fn `networkInterfaces()`
- export fn `userInfo()`
- export const `EOL`
- export fn `randomBytes(size: number)`
- export fn `createHash()`
- export fn `createHmac()`
- export fn `URL()`
- export fn `URLSearchParams()`
- export fn `fileURLToPath(url: string | URL)`
- export fn `pathToFileURL(path: string)`
- export fn `promisify(fn: Function)`
- export fn `inherits()`
- export fn `deprecate(fn: Function)`

## src/services/backgroundAgentService.ts
- export fn `initBackgroundAgentService(): Promise<void>`
- export fn `stopQueueProcessor(): void`
- export fn `createBackgroundTask(config: BackgroundTaskConfig): string`
- export fn `pauseTask(taskId: string): Promise<void>`
- export fn `resumeTask(taskId: string): Promise<void>`
- export fn `cancelTask(taskId: string): Promise<void>`
- export fn `retryTask(taskId: string): void`
- export fn `runDroidInBackground()`
- export fn `runCommandInBackground()`
- export fn `getActiveTasks(): BackgroundTask[]`
- export fn `getQueueStats()`
- export fn `cleanupBackgroundAgentService(): void`

## src/services/brainFileService.ts
- export type `BrainEntry { type, project, created, tags, title, content, filePath }`
- export fn `setBrainCustomPath(path: string | null): Promise<void>`
- export fn `getCustomBrainPath(): string | null`
- export fn `initBrainStructure(projectName?: string): Promise<void>`
- export fn `saveBrainEntry()`
- export fn `appendDiaryEntry()`
- export fn `listBrainEntries()`
- export fn `readBrainEntry(filePath: string): Promise<BrainEntry | null>`
- export fn `openBrainFolder(inObsidian?: boolean): Promise<void>`
- export fn `getBrainRootPath(): Promise<string>`

## src/services/bundleService.ts
- export fn `exportAgentBundle()`
- export fn `exportAgentBundleAsZip()`
- export fn `importAgentBundle(bundleData: Uint8Array): Promise<`
- export fn `calculateBundlePowerRating()`
- export fn `validateBundleManifest(manifest: unknown): manifest is AgentBundleManifest`

## src/services/claudeSDK.ts
- export type `ClaudeSDKOptions { model, thinkingMode, permissionMode, sessionId, workingDirectory, mcpServers, command, args, env }`
- export type `ClaudeSDKStreamEvent { type, event, error, result, text, usage, input_tokens, output_tokens }`
- export fn `abortSessionStream(sessionId: string): void`
- export fn `abortAllStreams(): void`
- export fn `getActiveStreamCount(): number`
- export fn `sendToolResult()`
- export fn `answerUserQuestionViaStdin()`
- export type `RewindFilesResult { success, type, sessionId, userMessageId, canRewind, message, error }`
- export fn `rewindFiles()`

## src/services/codebaseMapService.ts
- export type `CodebaseMapStats { generated, files, exports, project }`
- export fn `getScriptPath(): Promise<string>`
- export fn `ensureScriptInstalled(sourceProjectPath: string): Promise<string>`
- export fn `parseMapStats(content: string): CodebaseMapStats | null`
- export fn `readMapStats(projectPath: string): Promise<CodebaseMapStats | null>`
- export fn `generateMap(projectPath: string): Promise<boolean>`
- export fn `installHook(projectPath: string): Promise<boolean>`
- export fn `uninstallHook(projectPath: string): Promise<boolean>`
- export fn `getMapPath(projectPath: string): string`

## src/services/conversationRecovery.ts
- export const `TOKEN_LIMITS: Record<string, number>`
- export const `ESTIMATED_OVERHEAD`
- export const `FIXED_OVERHEAD`
- export const `TOTAL_OVERHEAD`
- export fn `calculateDynamicOverhead()`
- export const `TOKEN_THRESHOLDS`
- export type `TokenWarningLevel = 'ok' | 'info' | 'warning' | 'danger' | 'critical' | 'bloc...`
- export type `TokenBudgetStatus { level, percentage, usedTokens, remainingTokens, maxTokens, message, action, canSendMessage }`
- export fn `calculateTokenBudget()`
- export fn `createLocalSummary(messages: ChatMessage[]): string`
- export fn `performSoftReset()`
- export fn `exportConversationToMarkdown()`
- export fn `downloadConversationExport()`
- export fn `shouldBlockMessage()`
- export fn `getRecommendedAction()`
- export fn `estimateTokens(textOrLength: string | number): number`
- export fn `wouldExceedLimit()`
- export type `ProjectOverhead { baseSystem, globalClaudeMd, projectClaudeMd, mcpServers, memoryBase, total, mcpServerCount, source }`
- export fn `calculateProjectOverhead()`

## src/services/debugLogger.ts
- export type `DebugLogEntry { timestamp, level, category, message, data, stackTrace }`
- export const `debugLogger`
- export default `debugLogger`

## src/services/droidFactory.ts
- export type `ValidationResult { valid, errors }`
- export fn `validateDroidSpec(spec: DroidSpec): ValidationResult`
- export fn `generateDroidFile(spec: DroidSpec): string`

## src/services/droidStatsStorage.ts
- export fn `loadDroidStats(): UserStats`
- export fn `saveDroidStats(stats: UserStats): void`
- export fn `checkAchievements(stats: UserStats, spec: DroidSpec): Achievement[]`

## src/services/giphyService.ts
- export fn `setGiphyApiKey(key: string): void`
- export type `GiphyGif { id, url, previewUrl, title, width, height }`
- export type `GiphySearchResponse { data, id, title, images, fixed_height, url, width, height }`
- export const `TOOL_GIF_KEYWORDS: Record<string, string[]>`
- export fn `getKeywordsForTool(toolName: string): string[]`
- export fn `searchGif(keyword: string, cacheKey?: string): Promise<GiphyGif | null>`
- export fn `getGifForTool(toolName: string, toolId?: string): Promise<GiphyGif | null>`
- export fn `isGiphyConfigured(): boolean`
- export fn `clearGifCache(): void`
- export fn `getGifCacheSize(): number`

## src/services/githubReleases.ts
- export type `GitHubReleaseAsset { name, browser_download_url, size, content_type, download_count }`
- export type `GitHubRelease { tag_name, name, published_at, body, html_url, assets, prerelease, draft }`
- export fn `canCheckForUpdates(): boolean`
- export fn `fetchLatestRelease(force: boolean = false): Promise<GitHubRelease | null>`
- export fn `fetchAllReleases(limit: number = 10): Promise<GitHubRelease[] | null>`
- export fn `clearReleaseCache(): void`
- export fn `getTimeSinceLastCheck(): string`

## src/services/inspectorBridge.ts
- export type `ElementInfo { tagName, className, id, textContent, attributes, position, top, left, width, height }`
- export type `ComponentInfo { componentName, fileName, lineNumber, columnNumber, props, componentStack }`
- export type `InspectorData { element, component, hasReact }`
- export type `InspectorEventType = 'hover' | 'click' | 'ready' | 'loaded'`
- export type `InspectorEventHandler = (data: InspectorData | Record<string, unknown>) => void`
- export const `inspectorBridge`

## src/services/kanbanShellService.ts
- export fn `createKanbanShellTask(options: CreateShellTaskOptions): Promise<KanbanTask>`
- export fn `createKanbanWatchTask(options: CreateWatchTaskOptions): Promise<KanbanTask>`
- export fn `runShellCommandViaKanban()`
- export fn `getKanbanShellTasks(): KanbanTask[]`
- export fn `getRunningShellTasks(): KanbanTask[]`

## src/services/modelService.ts
- export type `ModelConfig { id, modelId, label, isDefault, isActive, sortOrder }`
- export fn `getModels(remoteModels?: ModelConfig[]): ModelConfig[]`
- export fn `getModelId()`
- export fn `getDefaultModel()`
- export fn `getModelOptions()`
- export fn `getModelLabel()`

## src/services/shortcutsStorage.ts
- export const `DEFAULT_SHORTCUTS: Record<ShortcutActionId, ShortcutConfig>`
- export const `saveShortcuts`
- export const `loadShortcuts: Promise<Record<ShortcutActionId, ShortcutConfig>>`
- export const `resetAllShortcuts: Promise<Record<ShortcutActionId, ShortcutConfig>>`
- export const `resetShortcut`

## src/services/supertagConfigService.ts
- export type `SupertagPropertyType = 'text' | 'date' | 'select' | 'entity' | 'image'`
- export type `SupertagPropertyOption { value, label }`
- export type `SupertagProperty { id, name, type, options }`
- export type `SupertagConfig { name, color, properties, createdAt, updatedAt }`
- export const `DEFAULT_SUPERTAG_COLORS: Record<string, string>`
- export const `COLOR_PALETTE`
- export fn `loadSupertagConfigs(): Promise<Map<string, SupertagConfig>>`
- export fn `getSupertagConfig(tagName: string): SupertagConfig`
- export fn `getSupertagColor(tagName: string): string`
- export fn `saveSupertagConfig(config: SupertagConfig): Promise<boolean>`
- export fn `deleteSupertagConfig(tagName: string): Promise<boolean>`
- export fn `isConfigCacheInitialized(): boolean`
- export fn `getAllCachedConfigs(): Map<string, SupertagConfig>`
- export fn `generatePropertyId(): string`

## src/services/taskDocGenerator.ts
- export type `TaskSummary { objective, summary, keyDecisions, filesModified, toolsUsed }`
- export fn `generateTaskSummary(messages: ChatMessage[]): TaskSummary`
- export fn `generateDocMarkdown(task: KanbanTask, summary: TaskSummary): string`
- export fn `slugify(title: string): string`
- export fn `getDocFilePath(task: KanbanTask): string`

## src/services/terminalStorage.ts
- export type `TerminalMetadata { id, label, color, cwd, workingOn, avatar, branch, personality }`
- export const `STORAGE_KEY`
- export const `TABS_BY_TERMINAL_KEY`
- export const `NATIVE_TERMINALS_STORAGE_KEY`
- export const `saveTerminalsToStorage: TerminalInfo[]): Promise<void>`
- export const `loadTerminalsFromStorage: Promise<TerminalMetadata[]>`
- export const `saveTabsByTerminalToStorage: Map<string, Tab[]>): Promise<void>`
- export const `loadTabsByTerminalFromStorage: Promise<Map<string, Tab[]>>`
- export const `saveNativeTerminalsToStorage: NativeTerminal[]): Promise<void>`
- export const `loadNativeTerminalsFromStorage: Promise<NativeTerminal[]>`

## src/services/unifiedAgentStorage.ts
- export type `UnifiedAgent { id, name, projectPath, projectName, color, avatar, personality, sdkSessionId, createdAt, lastActiveAt }`
- export type `UnifiedAgentStore { agents, sessions, version }`
- export fn `loadAgents(): Promise<UnifiedAgent[]>`
- export fn `saveAgents(agents: UnifiedAgent[]): Promise<void>`
- export fn `getAgent(id: string): Promise<UnifiedAgent | null>`
- export fn `createAgent()`
- export fn `updateAgent()`
- export fn `deleteAgent(id: string): Promise<void>`
- export fn `getAgentsByProject(projectPath: string): Promise<UnifiedAgent[]>`
- export fn `getRecentAgents(limit?: number): Promise<UnifiedAgent[]>`
- export fn `updateAgentSdkSession()`
- export fn `loadAgentSessions(): Promise<AgentSession[]>`
- export fn `saveAgentSessions(sessions: AgentSession[]): Promise<void>`
- export fn `migrateFromLegacy(): Promise<number>`
- export fn `clearAllAgents(): Promise<void>`
- export fn `getStorageStats(): Promise<`
- export fn `exportAgents(): Promise<string>`
- export fn `importAgents()`

## src/services/worktreeService.ts
- export type `GitWorktree { path, branch, commitHash, isBare, isDetached }`
- export type `MergeResult { success, strategy, hasConflicts, conflictedFiles, error }`
- export type `WorktreeConfig { maxWorktrees, defaultTargetBranch, cleanupOnMerge, deleteBranchOnMerge }`
- export fn `generateBranchName(task: KanbanTask): string`
- export fn `generateWorktreePath(task: KanbanTask): string`
- export fn `listWorktrees(projectPath: string): Promise<GitWorktree[]>`
- export fn `worktreeExists(task: KanbanTask): Promise<boolean>`
- export fn `ensureWorktree()`
- export fn `cleanupWorktree()`
- export fn `hasUncommittedChanges(worktreePath: string): Promise<boolean>`
- export fn `autoCommitWorktreeChanges()`
- export fn `hasUncommittedChangesInMain(projectPath: string): Promise<boolean>`
- export fn `mergeAndCleanup()`
- export fn `abortMerge(projectPath: string): Promise<void>`
- export fn `resolveConflicts()`
- export const `worktreeService`
- export default `worktreeService`

## src/stores/backgroundAgentStore.ts
- export const `useBackgroundAgentStore`

## src/stores/chatStore.ts
- export const `useChatStore`

## src/stores/fileSystemStore.ts
- export const `useFileSystemStore`

## src/stores/gitStore.ts
- export const `useGitStore`

## src/stores/ideStore.ts
- export type `IDEInfo { id, name, appPath, cli, cliAvailable, appExists, supportsDiff }`
- export type `IDEConfig { preferredIDE, autoLaunch, syncFocus, installedIDEs, hasCompletedOnboarding }`
- export const `IDE_REGISTRY: Record<string, { name: string; icon: string }>`
- export const `useIDEStore`
- export fn `selectPreferredIDEName(state: IDEState): string | null`
- export fn `selectHasPreferredIDE(state: IDEState): boolean`
- export fn `selectShouldShowOnboarding(state: IDEState): boolean`

## src/stores/index.ts
- re-export `useTerminalStore` from './terminalStore'
- re-export `useChatStore` from './chatStore'
- re-export `useUIStore` from './uiStore'
- re-export `useFileSystemStore` from './fileSystemStore'
- re-export `useGitStore` from './gitStore'
- re-export `useSettingsStore` from './settingsStore'
- re-export `useBackgroundAgentStore` from './backgroundAgentStore'

## src/stores/kanbanStore.ts
- export const `kanbanWriteLock`
- export type `KanbanNotification { taskId, taskTitle, taskType }`
- export const `useKanbanStore`

## src/stores/popoutWindowStore.ts
- export type `PopoutWindowInfo { windowLabel, tab, position, size, createdAt }`
- export const `usePopoutWindowStore`
- export fn `generateWindowLabel(tab: Tab): string`
- export fn `canPopoutTab(tab: Tab): boolean`

## src/stores/sessionStore.ts
- export fn `shouldArchiveSession(session: AgentSession): boolean`
- export const `sessionWriteLock`
- export const `useSessionStore`

## src/stores/settingsStore.ts
- export const `useSettingsStore`

## src/stores/shortcutsStore.ts
- export const `useShortcutsStore`

## src/stores/terminalStore.ts
- export type `ManualProject { path, name }`
- export const `useTerminalStore`

## src/stores/uiStore.ts
- export const `useUIStore`

## src/stores/useStore.ts
- export fn `useStore()`
- export fn `useMultiStore()`
- export fn `useStoreValue()`
- export fn `useStoreActions()`

## src/tests/monacoSyntaxHighlighting.test.ts
- export const `MONACO_WORKER_LABELS`

## src/types.ts
- export type `NativeTerminal { id, name, app, color, directory, isOpen, pid, createdAt }`
- export type `NativeTerminalApp = "Terminal" | "iTerm" | "iTerm2" | "Warp" | "WezTerm" | "H...`
- export type `TerminalAppInfo { name, displayName, path }`
- export type `AgentChat { id, name, color, cwd, createdAt, avatar, personality, sessionId, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, totalCost }`
- export type `TerminalInfo { id, label, color, cwd, alive, status, needsAttention, hasResponded, responseStartTime, waitingForResponse, workingOn, avatar, branch, useWorktree, worktreePath, personality }`
- export type `ProjectTerminal { id, name, projectPath, color, cwd, alive, status, createdAt }`
- export type `AgentTerminal = ProjectTerminal`
- export type `SavedCommandCategory = "dev" | "build" | "test" | "custom"`
- export type `SavedCommand { id, name, command, cwd, color, category }`
- export type `ProcessInfo { terminalId, terminalLabel, command, pid, port, uptimeSeconds, status }`
- export type `DirectoryEntry { name, path, is_dir, is_symlink }`
- export type `DirectoryListing { path, entries }`
- export type `SearchResult { name, path, relative_path, is_dir, is_symlink, score, depth }`
- export type `GitStatusEntry { path, original_path, staged_status, unstaged_status, is_untracked, additions, deletions }`
- export type `GitStatusSummary { branch, upstream, ahead, behind, entries, clean }`
- export type `GitCommitEntry { hash, summary, author, relativeTime, timestamp }`
- export type `GitBranch { name, isCurrent, hasRemote, upstream, behind }`
- export type `GitMergeResult { success, hasConflicts, conflictedFiles, message }`
- export type `GitPullResult { success, hasConflicts, conflictedFiles, message, isFastForward }`
- export type `GitConflictFile { path, status }`
- export type `GitWorktree { path, branch, commitHash, isBare, isDetached }`
- export type `TerminalDataEvent { id, data }`
- export type `TerminalExitEvent { id, code, success, message }`
- export type `AISuggestion { command, explanation, confidence, alternative }`
- export type `AISettings { apiKey, model, enableCommandAssistant, enableErrorAnalyzer }`
- export type `TokenStats { totalTokensUsed, estimatedCost, requestCount }`
- export type `TerminalContext { os, shell, cwd, recentCommands, errorOutput }`
- export type `AIRequest { intent, context, requestType }`
- export type `AIQuestion { question, questionNumber, totalQuestions }`
- export type `AIAnswer { questionNumber, answer }`
- export type `AIPromptImprovement { originalPrompt, improvedPrompt, improvements, confidence }`
- export type `AIPromptEngineerResponse { type, questions, improvement }`
- export type `AgentInfo { name, description, model, color, file_path, scope, workingOn, avatar }`
- export type `AgentDetails { content }`
- export type `AgentPersonality { id, name, role, technicalContext, rules, communicationStyle, customNotes, selectedRules, toolkit, personality, quirks, specialties, skills }`
- export type `AgentToolkit { skills, droids, commands }`
- export type `SavedAgent { id, name, avatar, color, workingOn, personality, createdAt, lastUsed, usageCount }`
- export type `SkillInfo { name, description, file_path, scope }`
- export type `SkillDetails { content }`
- export type `SetupWizardData { userName, userLanguage, description, techStack, features, initGit, createAgents }`
- export type `SetupResult { success, message, agentsCreated, filesCreated }`
- export type `ChatRole = "user" | "assistant" | "system"`
- export type `ChatMessageStatus = "sending" | "streaming" | "complete" | "error"`
- export type `DiffLine { type, content, lineNumber }`
- export type `ToolDiff { fileName, lines }`
- export type `ChatToolCall { id, name, input, status, result, diff, timestamp }`
- export type `ChatToolResult { toolCallId, output, error }`
- export type `ChatAttachment { id, name, path, size, mimeType, previewUrl }`
- export type `MessageSettingsMetadata { model, effort, thinkingMode, hasThinkingBlocks }`
- export type `ChatMessage { id, role, content, timestamp, status, toolCalls, toolResults, error, attachments, events, metadata, settings, thinkingContent }`
- export type `ChatSession { id, title, messages, createdAt, updatedAt, systemPrompt, workingDirectory, claudeSessionId }`
- export type `AgentSession { id, claudeSessionId, title, agentId, projectPath, projectName, status, createdAt, updatedAt, completedAt, messageCount, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens, totalCost }`
- export type `AgentSessionStatus = 'todo' | 'in_progress' | 'done'`
- export type `ClaudeSession { id, name, isStreaming }`
- export type `ClaudeSettings { apiKey, model, temperature, maxTokens, enableTools, enableStreaming }`
- export type `StreamChunk { type, content, toolCall }`
- export type `StructuredOutputSchema { type, properties, items, required, description, enum, minimum, maximum, minItems, maxItems }`
- export type `StructuredOutputFormat { type, schema }`
- export type `EffortLevel = 'low' | 'medium' | 'high'`
- export type `ThinkingMode = 'auto' | 'think' | 'hard' | 'harder' | 'ultra'`
- export type `ModePreset { model, thinkingMode, effort }`
- export type `AgentModePresets { bypass, plan }`
- export type `ClaudeEventBase { type }`
- export type `ClaudeSystemEvent { type, subtype, session_id, model, cwd, tools }`
- export type `ClaudeContentBlock { type, text, thinking, id, name, input }`
- export type `ClaudeAssistantMessage { id, content, uuid }`
- export type `ClaudeAssistantEvent { type, message, session_id }`
- export type `ClaudeUserEvent { type, message, content, type, text, tool_use_id, content, is_error }`
- export type `ClaudeResultEvent { type, result, error, is_error, session_id, total_cost_usd, cost_usd, duration_ms, usage, stop_reason }`
- export type `ClaudeAgentEvent { type, action, agent_name, agent_type, session_id }`
- export type `ClaudeErrorEvent { type, error, code, session_id }`
- export type `ClaudeMessageStartEvent { type, session_id }`
- export type `ClaudeMessageDeltaEvent { type, delta, stop_reason, stop_sequence }`
- export type `ClaudeMessageStopEvent { type, session_id }`
- export type `ClaudeContentBlockStartEvent { type, index, content_block, type, id, name }`
- export type `ClaudeContentBlockDeltaEvent { type, index, delta, type, text, partial_json }`
- export type `ClaudeContentBlockStopEvent { type, index, session_id }`
- export type `ClaudeEvent`
- export type `AskUserQuestionOption { label, description }`
- export type `AskUserQuestion { question, header, options, multiSelect }`
- export type `AskUserQuestionInput { questions }`
- export type `AskUserQuestionAnswers`
- export type `PendingUserQuestion { toolUseId, input, timestamp, answered }`
- export type `SlashCommandScope = 'built-in' | 'project' | 'user' | 'plugin' | 'mcp'`
- export type `SlashCommandFrontmatter { description, model }`
- export type `SlashCommand { name, description, scope, filePath, frontmatter, content, argumentHint, namespace, serverName }`
- export type `SlashCommandsResponse { builtIn, custom }`
- export type `CreateSlashCommandParams { name, description, content, argumentHint, frontmatter }`
- export type `TodoItem { content, status, activeForm }`
- export type `AgentChatSettings { inputDraft, model, thinkingMode, permissionMode, effort }`
- export type `MCPServerType`
- export type `MCPServerStatus`
- export type `MCPTransportType = 'stdio' | 'http' | 'sse'`
- export type `MCPServer { id, name, type, transport, command, args, url, headers, method, env, enabled, status, error }`
- export type `MCPServerConfig`
- export type `MCPConfigFile { mcpServers }`
- export type `MCPTemplate { id, name, description, type, icon, config }`
- export type `PluginCategory = 'agent' | 'command' | 'hook' | 'setting' | 'mcp' | 'stack...`
- export type `PluginSource = 'davila7' | 'aitmpl' | 'custom'`
- export type `PluginScope = 'global' | 'project'`
- export type `PluginMetadata { icon, tags, dependencies }`
- export type `Plugin { id, name, description, category, version, author, repository, installed, source, metadata, scope }`
- export type `UsageStats { input_tokens, output_tokens, cache_creation_input_tokens, cache_read_input_tokens }`
- export type `SessionUsage { session_id, agent_name, started_at, last_updated, total_cost_usd, step_count, usage }`
- export type `AgentUsageSummary { agent_name, total_sessions, total_cost_usd, total_steps, usage, last_used }`
- export type `DailyUsageSummary { date, total_cost_usd, total_steps, session_count, usage, agents }`
- export type `PlanUsageData { current_session, current_week, reset_time, last_updated }`
- export type `SessionPlanUsage { percentage, model }`
- export type `WeeklyPlanUsage { all_models, opus, sonnet }`
- export type `PipAgentStatus = 'idle' | 'thinking' | 'streaming' | 'executing' | 'comple...`
- export type `PipAgentState { agentId, agentName, color, sessionId, status, lastMessage, lastActivity, toolsExecuted, currentTool, progress, error }`
- export type `PipWindowState { agents, position, size }`
- export type `SessionHistoryMessage { role, content, timestamp, tool_calls, name, input }`
- export type `SessionInfo { id, title, createdAt, updatedAt, messageCount, totalTokens, totalCost, status, workingDirectory, model, agentName }`
- export type `SessionDetails { messages, usage, events }`
- export type `MarketplaceCategory = 'agents' | 'commands' | 'hooks' | 'settings' | 'mcp' | 's...`
- export type `AgentTemplate { suggestedName, role, communicationStyle, customNotes, suggestedColor, suggestedAvatar, suggestedGender, bundledPlugins }`
- export type `MarketplaceResource { id, name, description, category, author, authorAvatar, installCount, rating, tags, version, installCommand, repository, icon, featured, verified, createdAt, updatedAt, dependencies, screenshots }`
- export type `MarketplaceStack { id, name, description, resources, author, public, createdAt, updatedAt }`
- export type `MarketplaceLibrary { installedResources, customStacks, favorites, lastSync }`
- export type `MarketplaceFilters { category, searchQuery, tags, verified, featured, sortBy, showFavoritesOnly }`
- export type `HookType = 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop' | ...`
- export type `HookScope = 'project' | 'global'`
- export type `HookConfig { id, name, type, matcher, command, enabled, scope, description }`
- export type `HookTemplate { id, name, type, matcher, commandTemplate, description, icon, variables }`
- export type `HookTemplateVariable { name, label, placeholder, required, type }`
- export type `HookExecutionEvent { hookId, hookName, hookType, toolName, timestamp, success, output, error }`
- export type `Snippet { id, name, content, tag, createdAt, updatedAt }`
- export type `SnippetVariable`
- export type `SnippetFormData { name, content, tag }`
- export type `BackgroundTaskPriority = 'high' | 'medium' | 'low'`
- export type `BackgroundTaskStatus`
- export type `BackgroundTaskType`
- export type `BackgroundTaskLogEntry { id, timestamp, level, message, source }`
- export type `BackgroundTaskProgress { current, total, percentage, stage }`
- export type `BackgroundTaskResult { success, output, error, artifacts, duration_ms, usage, cost_usd }`
- export type `BackgroundTaskConfig { type, priority, name, description, agentId, prompt, model, workingDirectory, command, args, env, watchPatterns, debounceMs }`
- export type `BackgroundTask { id, config, status, createdAt, startedAt, completedAt, pausedAt, progress, logs, logsVisible, sessionId }`
- export type `BackgroundTaskQueueStats { totalTasks, queued, running, paused, completed, failed, cancelled }`
- export type `BackgroundAgentState { tasks, queueStats, maxConcurrent, isPaused, lastUpdated }`
- export type `BackgroundTaskEvent { type, taskId, timestamp, data, progress, log, result, error }`
- export type `BackgroundTaskFilters { status, type, priority, searchQuery, showCompleted, sortBy, sortOrder }`
- export type `WatchTrigger { id, name, patterns, excludePatterns, action, debounceMs, enabled, lastTriggered }`
- export type `DroidAutoTrigger { droidId, triggerOn, patterns, enabled, priority }`
- export type `RuleScope = 'project' | 'global'`
- export type `RuleFrontmatter { description, globs, alwaysApply }`
- export type `Rule { id, name, content, filePath, scope, frontmatter, createdAt, updatedAt }`
- export type `RulesResponse { project, global }`
- export type `CreateRuleParams { name, content, scope, description, globs, alwaysApply }`
- export type `KanbanStatus = 'todo' | 'in_progress' | 'done'`
- export type `KanbanTaskType = 'agent' | 'shell' | 'watch'`
- export type `KanbanAssignedAgent { id, name, color, avatar, projectPath, projectName, branch, useWorktree, worktreePath, workingOn, personality }`
- export type `KanbanTask { id, title, prompt, status, assignedAgent, type, projectPath, projectName, branch, useWorktree, worktreePath, targetBranch, sessionId }`
- export type `ShortcutActionId`
- export type `ShortcutConfig { id, label, description, defaultKeys, currentKeys }`
- export type `KanbanTaskInitialValues { projectPath, projectName, branch, agentId, agentName, agentAvatar, agentColor, targetStatus, type, command, watchPatterns, watchDebounceMs }`
- export type `TaskCompletionContext { task, chatMessages, options }`
- export type `TaskCompletionOptions { skipDocumentation, source, completionNote }`
- export type `TaskCompletionResult { memoryEntityId, docFilePath, summary, skipped, error }`
- export type `TaskSummary { objective, summary, keyDecisions, filesModified, toolsUsed, durationMs }`
- export type `BundleEquipment { id, required }`
- export type `BundleAuthor { name, github, email }`
- export type `BundlePersonality { role, class, communicationStyle, quirks, avatar, color }`
- export type `BundleEquipmentConfig { skills, droids, rules, commands }`
- export type `BundleCompatibility { quackVersion, claudeCodeVersion }`
- export type `BundleMarketplaceMetadata { category, tags, featured, verified, downloads }`
- export type `AgentBundleManifest { id, version, name, displayName, description, author, license, repository, personality, equipment, compatibility, marketplace }`
- export type `AgentBundle { manifest, skillsFiles, droidsFiles, rulesFiles, commandsFiles, assetsFiles }`
- export type `PowerRatingBreakdown { total, base, skills, droids, rules, commands, skillCount, droidCount, ruleCount, commandCount }`

## src/types/claudeAssets.ts
- export type `ClaudeAssetType`
- export type `ClaudeAssetMetadata { name, description, model, tools, alwaysApply, globs }`
- export type `ClaudeAsset { id, name, type, path, relativePath, projectPath, projectName, metadata, isDirectory, size, modifiedAt }`
- export type `ProjectAssets { droids, commands, rules, skills, mcps, hooks }`
- export type `ClaudeProject { name, path, branch, hasClaudeFolder, assets, assetCounts, droids, commands, rules, skills, mcps, hooks, total }`
- export type `AssetOperation = 'copy' | 'move' | 'clone' | 'delete'`
- export type `AssetOperationResult { success, operation, sourceAsset, targetProject, newPath, error }`
- export type `AssetDragPayload { asset, sourceProject }`
- export type `AssetDropTarget { projectPath, projectName, assetType }`
- export type `AssetFilters { type, searchQuery, sortBy, sortOrder }`
- export type `ClaudeAssetsState { projects, selectedProject, selectedAsset, filters, loading, error, draggedAsset }`
- export type `AssetCardProps { asset, isSelected, isDragging, onSelect, onCopy, onDelete, onPreview, onEdit }`
- export type `ProjectItemProps { project, isSelected, isDropTarget, onSelect, onDrop }`
- export type `ClaudeAssetsTab { id, type, label, closable, selectedProject }`
- export type `GroupedSearchResults { projectName, projectPath, assets, totalCount }`

## src/types/structuredOutputs.ts
- export type `JSONSchema { type, properties, items, required, enum, const, minimum, maximum, format, additionalProperties, definitions }`
- export type `OutputFormat { type, json_schema }`
- export type `WebAnalysisOutput { title, summary, key_points, links, url, description }`
- export const `webAnalysisSchema: JSONSchema`
- export type `BugSeverity = 'critical' | 'high' | 'medium' | 'low'`
- export type `BugIssue { severity, file, line, description, suggested_fix, category, impact }`
- export type `BugReportOutput { bugs_found, total_issues, summary, risk_score }`
- export const `bugReportSchema: JSONSchema`
- export type `FunctionInfo { name, lines, parameters, complexity, start_line, end_line }`
- export type `FileAnalysisOutput { language, complexity_score, functions, dependencies, total_lines, code_quality_score, suggestions }`
- export const `fileAnalysisSchema: JSONSchema`
- export type `StructuredOutputResult<T = unknown> { success, data, error, raw_output }`
- export fn `isWebAnalysisOutput(data: unknown): data is WebAnalysisOutput`
- export fn `isBugReportOutput(data: unknown): data is BugReportOutput`
- export fn `isFileAnalysisOutput(data: unknown): data is FileAnalysisOutput`

## src/utils/agentAvatars.ts
- export const `AVAILABLE_AVATARS`
- export fn `getAvatarUrl(avatarName: string): string`
- export fn `getDuckdroidUrl(): string`
- export fn `getFallbackDuckUrl(): string`
- export fn `getRandomAvatar(): string`
- export fn `getAgentAvatar(_agentName: string, avatarFilename?: string): string | Promise<string>`
- export fn `hasAgentAvatar(avatarFilename?: string): boolean`
- export fn `getAvailableAvatars(): Record<string, string>`

## src/utils/agentMentions.ts
- export type `AgentMention { agentName, startIndex, endIndex, fullMatch }`
- export fn `parseAgentMentions(text: string): AgentMention[]`
- export fn `extractAgentNames(text: string): string[]`
- export fn `matchMentionsToAgents()`
- export fn `stripMentions(text: string): string`
- export fn `hasMentions(text: string): boolean`

## src/utils/agentNames.ts
- export const `AGENT_NAMES`
- export fn `getRandomAgentName()`
- export fn `getRandomName(): string`
- export fn `getRandomGenderedName()`
- export fn `getAllAgentNames(): string[]`
- export fn `searchAgentNames(query: string): string[]`

## src/utils/agentStorage.ts
- export type `SavedAgent { id, name, avatar, color, workingOn, personality, createdAt, lastUsed, usageCount }`
- export fn `getSavedAgents(): SavedAgent[]`
- export fn `saveAgent()`
- export fn `updateAgent(id: string, updates: Partial<Omit<SavedAgent, 'id' | 'createdAt'>>): SavedAgent | null`
- export fn `deleteAgent(id: string): boolean`
- export fn `getRecentAgents(limit: number = 5): SavedAgent[]`
- export fn `getFrequentAgents(limit: number = 5): SavedAgent[]`
- export fn `searchAgents(query: string): SavedAgent[]`
- export fn `markAgentAsUsed(id: string): SavedAgent | null`
- export fn `clearAllAgents(): void`
- export fn `exportAgents(): string`
- export fn `importAgents(json: string): number`

## src/utils/analytics.ts
- export fn `getCommonProperties(): Record<string, unknown>`
- export fn `getFileType(filePath: string): string`
- export fn `withTiming()`
- export fn `createPerformanceMetric()`
- export fn `createErrorEvent()`
- export const `FeatureCategories`
- export type `FeatureCategory = (typeof FeatureCategories)[keyof typeof FeatureCategories]`
- export fn `createFeatureEvent()`
- export class `SessionTracker`
- export const `sessionTracker`
- export fn `createDebouncedTracker()`
- export class `BatchedEventTracker`

## src/utils/ansiParser.ts
- export fn `parseAnsi(text: string): ParsedSegment[]`
- export fn `stripAnsi(text: string): string`
- export fn `ansiToHtml(text: string): string`

## src/utils/customAvatarStorage.ts
- export type `CustomAvatarInfo { id, filename, originalName, createdAt, size }`
- export fn `uploadCustomAvatar(file: File): Promise<CustomAvatarInfo>`
- export fn `listCustomAvatars(): Promise<CustomAvatarInfo[]>`
- export fn `deleteCustomAvatar(avatarId: string): Promise<void>`
- export fn `getCustomAvatarPath(avatarId: string): Promise<string>`
- export fn `getCustomAvatarUrl(avatarId: string): Promise<string>`
- export fn `isCustomAvatar(avatarId: string): boolean`
- export fn `revokeAvatarUrl(blobUrl: string): void`
- export fn `validateAvatarFile(file: File): string | null`

## src/utils/imageCompression.ts
- export const `MAX_FILE_SIZE`
- export const `MAX_IMAGE_DIMENSION`
- export const `RECOMMENDED_IMAGE_DIMENSION`
- export type `CompressionResult { blob, wasCompressed, originalSize, compressedSize, originalDimensions, compressedDimensions }`
- export fn `compressImage()`
- export fn `getCompressionMessage(result: CompressionResult): string | null`
- export fn `blobToBase64(blob: Blob): Promise<string>`

## src/utils/invokeWithTimeout.ts
- export class `TimeoutError`
- export fn `invokeWithTimeout()`
- export fn `fireAndForget()`

## src/utils/kanbanDateGrouping.ts
- export type `DateBucket = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'older'`
- export type `DateGroup { bucket, label, tasks }`
- export fn `getDateBucket(timestamp: number, now: Date = new Date(): DateBucket`
- export fn `getDateBucketLabel(bucket: DateBucket): string`
- export fn `formatCompletionDate(timestamp: number): string`
- export fn `groupTasksByCompletionDate(tasks: KanbanTask[], now: Date = new Date(): DateGroup[]`
- export fn `getTotalTaskCount(groups: DateGroup[]): number`

## src/utils/performance.ts
- export fn `debounce()`
- export fn `throttle()`
- export fn `rafThrottle()`
- export fn `memoize()`
- export fn `batchUpdates()`
- export fn `shallowEqual(obj1: any, obj2: any): boolean`
- export fn `deepEqual(obj1: any, obj2: any): boolean`

## src/utils/powerRating.ts
- export fn `calculatePowerRating()`
- export fn `getPowerRatingColor(power: number): string`
- export fn `getPowerRatingTier(power: number): string`
- export fn `formatPowerRating(power: number): string`
- export fn `getPowerRatingPercentage(power: number): number`

## src/utils/projectColors.ts
- export type `ProjectStorageData { order, colors }`
- export const `DEFAULT_PROJECT_COLORS`
- export fn `loadProjectColors(): Promise<Record<string, string>>`
- export fn `getProjectColor()`

## src/utils/projectUtils.ts
- export fn `extractProjectId(path: string | undefined | null): string`
- export fn `isValidProjectPath(path: string | undefined | null): boolean`
- export fn `formatProjectName(projectId: string): string`

## src/utils/rulePathUtils.ts
- export fn `isGlobalRulePath(rulePath: string): boolean`
- export fn `isProjectRulePath(rulePath: string): boolean`
- export fn `normalizeRulePath(rulePath: string, projectPath?: string): string`
- export fn `normalizeRulePaths(rulePaths: string[], projectPath?: string): string[]`
- export fn `resolveRulePath()`
- export fn `resolveRulePaths()`
- export fn `migrateRulePaths(selectedRules: string[]): string[]`
- export fn `getDisplayPath(rulePath: string): string`
- export fn `areRulePathsEqual(path1: string, path2: string): boolean`
- export fn `findRuleByPath(rulePaths: string[], targetPath: string): string | undefined`

## src/utils/sessionCleanup.ts
- export type `SessionStorageStats { totalSessions, oldSessions, estimatedSize }`
- export fn `getSessionStorageStats()`
- export fn `cleanupOldSessions()`

## src/utils/sessionKanbanAdapter.ts
- export fn `sessionToKanbanTask()`
- export fn `sessionsToKanbanTasks()`
- export fn `isSessionTask(task: KanbanTask): boolean`

## src/utils/sessionRecovery.ts
- export fn `validatePrompt(prompt: string)`
- export fn `saveSessionBackup(sessionId: string, messages: any[]): void`
- export fn `loadSessionBackup(sessionId: string)`
- export fn `clearSessionBackup(sessionId: string): void`
- export fn `showRecoveryDialog()`
- export fn `cleanupOldBackups(): void`

## src/utils/skillsAndDroidsLoader.ts
- export fn `loadAvailableSkills(projectPath: string): Promise<SkillMetadata[]>`
- export fn `loadAvailableDroids(projectPath: string): Promise<DroidMetadata[]>`
- export fn `formatSkillsForClaudeMd(skills: SkillMetadata[], selectedIds: string[]): string`
- export fn `formatDroidsForClaudeMd(droids: DroidMetadata[], selectedIds: string[]): string`
- export fn `loadAvailableCommands(projectPath: string): Promise<string[]>`

## src/utils/tauriInvokeWrapper.ts
- export const `invoke: string, args?: Record<string, unknown>): Promise<T>`
- export fn `initTestModeInterception()`

## src/utils/terminalUtils.ts
- export const `TERMINAL_COLORS`
- export const `ANSI_REGEX`
- export const `OSC_REGEX`
- export const `PROMPT_REGEX`
- export fn `normalizeKey(value: string): string`
- export fn `slugify(value: string): string`
- export fn `stripAnsi(text: string): string`
- export fn `chunkContainsPrompt(text: string): boolean`
- export fn `debounce()`
- export fn `getRandomTerminalColor(): string`
- export fn `getTerminalColorByIndex(index: number): string`

## src/utils/testModeStorage.ts
- export fn `getTestModeStoreName(baseName: string): string`
- export fn `isTestMode(): boolean`
- export fn `getTestModeStoragePatterns(): string[]`
- export fn `logTestModeStorage(operation: string, storeName: string): void`

## src/utils/timeFormat.ts
- export fn `formatRelativeTime(timestamp: number): string`
- export fn `formatAbsoluteTime(timestamp: number): string`

## src/utils/version.ts
- export fn `getCurrentVersion(): Promise<string>`
- export fn `parseVersion(version: string)`
- export fn `compareVersions(version1: string, version2: string): number | null`
- export fn `isNewerVersion(currentVersion: string, newVersion: string): boolean`
- export fn `formatVersion(version: string, withPrefix: boolean = true): string`
- export fn `getBaseVersion(version: string): string`

## src/views/ClaudeAssetsTabView.tsx
- export default fn `ClaudeAssetsTabView()`

## src/views/DocsTabView.tsx
- export default fn `DocsTabView({ tab, isActive }: DocsTabViewProps)`

## src/views/ImageTabView.tsx
- export default `memo(ImageTabView)`

## src/views/KanbanTabView.tsx
- export default `memo(KanbanTabView)`

## src/views/ProjectDashboardTabView.tsx
- export default fn `ProjectDashboardTabView()`

## src\App.tsx
- export default `App`

## vite.config.ts
- export default `defineConfig(({ mode }) => {`

## vitest.config.ts
- export default `defineConfig({`
