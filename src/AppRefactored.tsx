import { useCallback, useEffect, useRef, useState, lazy, Suspense } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { Toaster } from "sonner";
import "sonner/dist/styles.css";
import "./sonner-custom.css";

// Import Context hooks
import {
  useTerminals,
  useChat,
  useFileSystem,
  useGit,
  useUI,
} from "./contexts";

// Import Components (Core components loaded immediately)
import TerminalSidebar from "./components/TerminalSidebar";
import SidePanel from "./components/SidePanel";
import NewTerminalModal from "./components/NewTerminalModal";
import FilePreviewDrawer from "./components/FilePreviewDrawer";
import GitPanel from "./components/GitPanel";
import { TitleBar } from "./components/TitleBar";
import PerformanceMonitor from "./components/PerformanceMonitor";

// Lazy load heavy components (loaded on demand)
const UnifiedSettings = lazy(() => import("./components/settings/UnifiedSettings"));
const AIAssistant = lazy(() => import("./components/AIAssistant"));
const BackgroundsModal = lazy(() => import("./components/BackgroundsModal"));
const QuackAgencyDrawer = lazy(() => import("./components/QuackAgencyDrawer"));
const MarketplaceDrawer = lazy(() => import("./components/MarketplaceDrawer"));
const SavedCommandsDrawer = lazy(() => import("./components/SavedCommandsDrawer"));
const SessionDetailsDrawer = lazy(() => import("./components/SessionDetailsDrawer"));
const ContextDrawer = lazy(() => import("./components/ContextDrawer"));
const SkillDrawer = lazy(() => import("./components/SkillDrawer"));
const TelegramSetup = lazy(() => import("./components/TelegramSetup"));
const DiffDrawer = lazy(() => import("./components/DiffDrawer"));
const SavedCommandModal = lazy(() => import("./components/SavedCommandModal"));
const AgentViewer = lazy(() => import("./components/AgentViewer"));

// Import skeleton loaders
import SettingsSkeleton from "./components/skeletons/SettingsSkeleton";
import ModalSkeleton from "./components/skeletons/ModalSkeleton";
import ChatView from "./components/ChatView";
import TabBar, { type Tab } from "./components/TabBar";
import ActionIcons from "./components/ActionIcons";
import { LicenseModal } from "./components/LicenseModal";
import { UpgradeModal } from "./components/UpgradeModal";

import type {
  AgentInfo,
  AgentDetails,
  SkillInfo,
  AgentChat,
} from "./types";

import { useDeepLinkHandler } from "./hooks/useDeepLinkHandler";
import { usePipWindow } from "./hooks/usePipWindow";

import "./App.css";
import "./components/MetroStyle.css";

function AppRefactored() {
  // Load assets
  const notificationAudio = new URL("../sounds/quack.mp3", import.meta.url).href;

  // Get context hooks
  const {
    terminals,
    activeId,
    setActiveId,
    createTerminal,
    removeTerminal,
    updateTerminal,
    reloadTerminal,
    loadSavedTerminals,
  } = useTerminals();

  const {
    chatSessions,
    chatLoadingMap,
    activeAgent,
    agentChats,
    activeAgentChatId,
    agentChatSettings,
    setActiveAgent,
    setActiveAgentChatId,
    addAgentChat,
    removeAgentChat,
    updateAgentChat,
    addMessage,
    updateMessage,
    clearMessages,
    setChatLoading,
    updateChatTokens,
    setSessionId,
    updateAgentChatSettings,
    getAgentChatSettings,
    saveChatHistory,
    loadChatHistory,
  } = useChat();

  const {
    explorerPath,
    explorerTree,
    explorerRoot,
    loadingExplorer,
    explorerError,
    previewFile,
    previewContent,
    previewImageData,
    previewError,
    loadingPreview,
    previewHasUnsavedChanges,
    setExplorerPath,
    setExplorerRoot,
    loadDirectory,
    refreshExplorer,
    loadFilePreview,
    clearPreview,
    setPreviewContent,
    setPreviewHasUnsavedChanges,
    saveFile,
    selectDirectory,
  } = useFileSystem();

  const {
    gitSummary,
    loadingGit,
    gitError,
    selectedGitPath,
    diffContent,
    diffLoading,
    diffError,
    diffView,
    commitMessage,
    committing,
    commitHistory,
    historyError,
    loadGitStatus,
    loadDiff,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    commit,
    loadCommitHistory,
    refreshGit,
    setSelectedGitPath,
    setDiffView,
    setCommitMessage,
  } = useGit();

  const {
    showNewTerminalModal,
    showAddNativeTerminalModal,
    showBackgroundsModal,
    showLicenseModal,
    showUpgradeModal,
    upgradeLimitType,
    savedCommandModalOpen,
    editingCommand,
    showGitDrawer,
    showDiffDrawer,
    showPluginsDrawer,
    showSettings,
    savedCommandsDrawerOpen,
    sessionDetailsDrawerOpen,
    showQuackAgencyDrawer,
    showContextDrawer,
    showSkillDrawer,
    showTelegramSetup,
    sidePanelCollapsed,
    showPerformanceMonitor,
    showAIAssistant,
    proBannerExpanded,
    tabs,
    activeTabId,
    tabsByTerminal,
    selectedSession,
    selectedAgent,
    selectedSkill,
    contextScope,
    editingTerminal,
    newTerminalName,
    newTerminalPath,
    newTerminalColor,
    newTerminalWorkingOn,
    newTerminalAvatar,
    newTerminalBranch,
    newTerminalUseWorktree,
    newTerminalPersonality,
    newTerminalError,
    quackSoundEnabled,
    currentBackground,
    collapsedGroups,
    savedCommands,
    setShowNewTerminalModal,
    setShowAddNativeTerminalModal,
    setShowBackgroundsModal,
    setShowLicenseModal,
    setShowUpgradeModal,
    setSavedCommandModalOpen,
    setEditingCommand,
    setShowGitDrawer,
    setShowDiffDrawer,
    setShowPluginsDrawer,
    setShowSettings,
    setSavedCommandsDrawerOpen,
    setSessionDetailsDrawerOpen,
    setShowQuackAgencyDrawer,
    setShowContextDrawer,
    setShowSkillDrawer,
    setShowTelegramSetup,
    setSidePanelCollapsed,
    setShowPerformanceMonitor,
    setShowAIAssistant,
    setProBannerExpanded,
    setTabs,
    setActiveTabId,
    addTab,
    removeTab,
    updateTab,
    setTabsByTerminal,
    getTabsByTerminal,
    setSelectedSession,
    setSelectedAgent,
    setSelectedSkill,
    setContextScope,
    setEditingTerminal,
    setNewTerminalName,
    setNewTerminalPath,
    setNewTerminalColor,
    setNewTerminalWorkingOn,
    setNewTerminalAvatar,
    setNewTerminalBranch,
    setNewTerminalUseWorktree,
    setNewTerminalPersonality,
    setNewTerminalError,
    resetNewTerminalForm,
    setQuackSoundEnabled,
    setCurrentBackground,
    toggleGroupCollapse,
    setSavedCommands,
    addSavedCommand,
    updateSavedCommand,
    deleteSavedCommand,
  } = useUI();

  // Local state that doesn't fit in contexts
  const [tauriAvailable] = useState(
    () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );

  const [isPreviewWebview] = useState(() => {
    if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
      return false;
    }
    try {
      const current = getCurrentWindow();
      return current.label === "preview-webview";
    } catch {
      return false;
    }
  });

  const [projectName, setProjectName] = useState<string>('');
  const [gitBranch, setGitBranch] = useState<string>('');
  const [openaiApiKey, setOpenaiApiKey] = useState<string | null>(null);
  const [selectingDirectory, setSelectingDirectory] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [booting, setBooting] = useState(true);
  const [videoEnded, setVideoEnded] = useState(false);
  const [splashFadingOut, setSplashFadingOut] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [creatingTerminal, setCreatingTerminal] = useState(false);
  const [formattingPreview, setFormattingPreview] = useState(false);
  const [previewDiffInfo, setPreviewDiffInfo] = useState<any | null>(null);
  const [introReplayActive, setIntroReplayActive] = useState(false);
  const [aiIntent, setAiIntent] = useState('');
  const [aiInitialMode, setAiInitialMode] = useState<'terminal-helper' | 'prompt-engineer' | undefined>(undefined);
  const [aiContext, setAiContext] = useState<any>({
    os: 'macOS',
    shell: 'zsh',
    cwd: '~',
    recentCommands: [],
  });
  const [isChatConfigured, setIsChatConfigured] = useState(false);
  const [agentRefreshKey, setAgentRefreshKey] = useState(0);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [isProUser, setIsProUser] = useState(false);

  // Agent management
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [pendingAgentMention, setPendingAgentMention] = useState<AgentInfo | null>(null);
  const [pendingFileMention, setPendingFileMention] = useState<{ name: string; path: string; relativePath: string } | null>(null);
  const [pendingSlashCommand, setPendingSlashCommand] = useState<{ name: string; description: string } | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentsDirectoryExists, setAgentsDirectoryExists] = useState<boolean>(true);

  // Skills management
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsDirectoryExists, setSkillsDirectoryExists] = useState<boolean>(true);

  // Refs
  const filePreviewRef = useRef<any>(null);
  const terminalRefs = useRef<Map<string, any>>(new Map());
  const debouncedSaveTerminalsRef = useRef<any>(null);
  const debouncedSaveTabsRef = useRef<any>(null);
  const notificationAudioRef = useRef<HTMLAudioElement | null>(null);
  const terminalIdleTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const previousStatus = useRef<Map<string, 'idle' | 'busy'>>(new Map());
  const pipWindowRef = useRef<any>(null);

  // Hooks
  useDeepLinkHandler((payload) => {
    // Handle deep link file opening
    console.log('Deep link open file:', payload);
  });
  const pipWindow = usePipWindow();

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      // Request notification permissions
      if (tauriAvailable && !isPreviewWebview) {
        let permissionGranted = await isPermissionGranted();
        if (!permissionGranted) {
          const permission = await requestPermission();
          permissionGranted = permission === 'granted';
        }
        setNotificationGranted(permissionGranted);

        // Load saved terminals
        await loadSavedTerminals();
      }

      // Initialize audio
      notificationAudioRef.current = new Audio(notificationAudio);
      notificationAudioRef.current.volume = 0.3;

      // Boot sequence
      setTimeout(() => {
        setVideoEnded(true);
        setSplashFadingOut(true);
        setTimeout(() => {
          setBooting(false);
          setHasBootstrapped(true);
        }, 500);
      }, 3000);
    };

    initialize();
  }, [tauriAvailable, isPreviewWebview, loadSavedTerminals, notificationAudio]);

  // Handle terminal creation
  const handleCreateTerminal = useCallback(async () => {
    if (!newTerminalName || !newTerminalPath) {
      setNewTerminalError('Please provide a name and directory');
      return;
    }

    setCreatingTerminal(true);
    try {
      await createTerminal({
        name: newTerminalName,
        path: newTerminalPath,
        color: newTerminalColor,
        workingOn: newTerminalWorkingOn,
        avatar: newTerminalAvatar,
        branch: newTerminalBranch,
        useWorktree: newTerminalUseWorktree,
        personality: newTerminalPersonality,
      });

      setShowNewTerminalModal(false);
      resetNewTerminalForm();
    } catch (error) {
      console.error('Failed to create terminal:', error);
      setNewTerminalError(String(error));
    } finally {
      setCreatingTerminal(false);
    }
  }, [
    newTerminalName,
    newTerminalPath,
    newTerminalColor,
    newTerminalWorkingOn,
    newTerminalAvatar,
    newTerminalBranch,
    newTerminalUseWorktree,
    newTerminalPersonality,
    createTerminal,
    setShowNewTerminalModal,
    resetNewTerminalForm,
    setNewTerminalError,
  ]);

  // Handle directory selection
  const handleSelectDirectory = useCallback(async () => {
    setSelectingDirectory(true);
    const path = await selectDirectory();
    if (path) {
      setNewTerminalPath(path);
      setExplorerPath(path);
    }
    setSelectingDirectory(false);
  }, [selectDirectory, setNewTerminalPath, setExplorerPath]);

  // Play quack sound
  const playQuackSound = useCallback(() => {
    if (quackSoundEnabled && notificationAudioRef.current) {
      notificationAudioRef.current.currentTime = 0;
      notificationAudioRef.current.play().catch(console.error);
    }
  }, [quackSoundEnabled]);

  // Show desktop notification
  const showDesktopNotification = useCallback(async (title: string, body: string) => {
    if (notificationGranted) {
      try {
        await sendNotification({
          title,
          body,
        });
      } catch (error) {
        console.error('Failed to send notification:', error);
      }
    }
  }, [notificationGranted]);

  // Handle terminal status changes
  useEffect(() => {
    terminals.forEach(terminal => {
      const prevStatus = previousStatus.current.get(terminal.id);

      if (prevStatus === 'busy' && terminal.status === 'idle') {
        // Terminal became idle
        if (terminal.id !== activeId) {
          // Background terminal
          playQuackSound();
          showDesktopNotification(
            `Terminal "${terminal.label}" is ready`,
            'Your command has finished executing'
          );
        }
      }

      previousStatus.current.set(terminal.id, terminal.status || 'idle');
    });
  }, [terminals, activeId, playQuackSound, showDesktopNotification]);

  // Render preview webview (minimal UI)
  if (isPreviewWebview) {
    return (
      <div className="flex flex-col h-screen bg-gray-900 text-white">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-2">Preview Window</h1>
            <p className="text-gray-400">This is a preview webview</p>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="app-container">
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#1a1a1a',
            color: '#fff',
            border: '1px solid #333',
          },
        }}
      />

      {/* Title Bar */}
      <TitleBar />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Side Panel with File Explorer */}
        <SidePanel
          // FileExplorer props
          rootPath={explorerRoot}
          tree={Object.fromEntries(explorerTree)}
          loading={loadingExplorer}
          error={explorerError}
          activePath={explorerPath}
          activeFilePath={previewFile?.path || null}
          onOpenFile={(entry) => loadFilePreview(entry.path, entry.name)}
          onLoadChildren={async (path) => {
            await loadDirectory(path);
            return explorerTree.get(path) || [];
          }}
          onMentionFile={(filePath, fileName) => {
            setPendingFileMention({ path: filePath, name: fileName, relativePath: fileName });
          }}

          // Agents props
          agents={agents}
          selectedAgent={selectedAgent}
          loadingAgents={loadingAgents}
          agentsError={agentsError}
          agentsDirectoryExists={agentsDirectoryExists}
          workingDir={explorerPath}
          onSelectAgent={(agent: AgentInfo) => {
            // Create or select agent tab instead of setting selectedAgent
            const agentTabId = `agent-${agent.name}-${agent.scope}`;

            // Check if tab already exists
            const existingTab = tabs.find(t => t.id === agentTabId);

            if (existingTab) {
              // Tab already exists, just activate it
              setActiveTabId(agentTabId);
            } else {
              // Create new agent tab
              const newTab: Tab = {
                id: agentTabId,
                label: agent.name.replace(/-/g, ' '),
                type: 'agent' as const,
                closable: true,
                agentName: agent.name,
                agentScope: agent.scope as 'global' | 'project',
              };

              setTabs((prevTabs: Tab[]) => [...prevTabs, newTab]);
              setActiveTabId(agentTabId);
            }
          }}
          onUseAgent={(agent) => {
            setPendingAgentMention(agent);
          }}
          onRefreshAgents={() => {
            // Refresh agents logic
            setLoadingAgents(true);
            // TODO: Load agents
            setLoadingAgents(false);
          }}
          onCreateAgent={async (name, description, model, color, content, scope) => {
            // Create agent logic
            console.log('Create agent:', { name, description, model, color, content, scope });
          }}
          onTogglePip={() => {
            pipWindow.togglePipWindow();
          }}
          isPipOpen={pipWindow.isPipOpen}

          // Skills props
          skills={skills}
          loadingSkills={loadingSkills}
          skillsError={skillsError}
          skillsDirectoryExists={skillsDirectoryExists}
          onSelectSkill={setSelectedSkill}
          onRefreshSkills={() => {
            // Refresh skills logic
            setLoadingSkills(true);
            // TODO: Load skills
            setLoadingSkills(false);
          }}

          // Commands props
          onUseCommand={(command) => {
            setPendingSlashCommand(command);
          }}
          onViewCommand={() => {
            // TODO: Implement command viewing in refactored app
            console.log('Command view not implemented in refactored app');
          }}

          // Context props
          tauriAvailable={tauriAvailable}
          onOpenContextDrawer={(scope) => {
            setContextScope(scope);
            setShowContextDrawer(true);
          }}

          // Agent Context props
          activeAgentId={activeAgent?.name || null}
          activeAgentName={activeAgent?.name || null}
          activeAgentAvatar={activeAgent?.avatar || null}
          activeAgentWorkingOn={null}
          activeAgentCwd={explorerPath}
          activeAgentPersonality={null}
          projectName={projectName}
          gitBranch={gitBranch}
          agentRefreshKey={agentRefreshKey}

          // Terminal props
          activeTerminalId={activeId}
          terminals={terminals}
          onTerminalInput={(id, data) => {
            const ref = terminalRefs.current.get(id);
            if (ref) {
              ref.write(data);
            }
          }}
          onTerminalOutput={(id, data) => {
            // Handle terminal output
            console.log('Terminal output:', id, data);
          }}
          onUpdateRecentCommands={(commands) => {
            setAiContext((prev: any) => ({ ...prev, recentCommands: commands }));
          }}
          onSelectTerminal={setActiveId}

          // TerminalToolBar props
          onExecuteCommand={(command, label, terminalId) => {
            const id = terminalId || activeId;
            if (id) {
              const ref = terminalRefs.current.get(id);
              if (ref) {
                ref.write(command + '\n');
              }
            }
          }}
          onToggleSavedCommands={() => setSavedCommandsDrawerOpen(!savedCommandsDrawerOpen)}
          savedCommandsOpen={savedCommandsDrawerOpen}
          onCreateTerminal={() => setShowNewTerminalModal(true)}

          // Usage props
          usageSessions={[]}
          onClearUsage={() => {
            // Clear usage logic
          }}
          onCreateTerminalWithCommand={(label, command, cwd) => {
            // Create terminal with command logic
            console.log('Create terminal with command:', { label, command, cwd });
          }}

          // Sessions props
          onSelectSession={setSelectedSession}
          sessionsRefreshKey={sessionsRefreshKey}

          // Collapse props
          isCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => setSidePanelCollapsed(!sidePanelCollapsed)}
        />

        {/* Terminal Area */}
        <div className="flex-1 flex flex-col">
          {/* Tab Bar */}
          <TabBar
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={setActiveTabId}
            onTabClose={removeTab}
            onTabReorder={setTabs}
          />

          {/* Active Tab Content */}
          {activeTabId === 'chat' ? (
            <ChatView
              messages={chatSessions.get(activeAgent?.name || 'default') || []}
              isLoading={chatLoadingMap.get(activeAgent?.name || 'default') || false}
              onSendMessage={async (content) => {
                // Handle send message
                console.log('Send message:', content);
              }}
              // Agent display info
              agentName={activeAgent?.name || 'Jack'}
              agentAvatar={activeAgent?.avatar}
              // Project context
              projectName={projectName}
              gitBranch={gitBranch}
            />
          ) : activeTabId.startsWith('agent-') ? (
            /* Agent Viewer - shown when agent tab is active */
            (() => {
              const activeTab = tabs.find(t => t.id === activeTabId);
              if (activeTab?.type === 'agent' && activeTab.agentName && activeTab.agentScope) {
                return (
                  <Suspense fallback={<ModalSkeleton />}>
                    <AgentViewer
                      agentName={activeTab.agentName}
                      agentScope={activeTab.agentScope}
                      workingDir={explorerPath}
                      onRefresh={() => {
                        setLoadingAgents(true);
                        // TODO: Refresh agents
                        setLoadingAgents(false);
                        setAgentRefreshKey(prev => prev + 1);
                      }}
                    />
                  </Suspense>
                );
              }
              return null;
            })()
          ) : (
            <TerminalSidebar
              terminals={terminals}
              activeId={activeId}
              creating={creatingTerminal}
              collapsedGroups={collapsedGroups}
              agentChats={agentChats}
              activeAgentChatId={activeAgentChatId}
              onSelectAgentChat={setActiveAgentChatId}
              onDeleteAgentChat={removeAgentChat}
              onUpdateAgentChat={(id, updates) => updateAgentChat(id, updates)}
              onCreateAgent={() => {
                // Create new agent chat
                const newAgent: AgentChat = {
                  id: Date.now().toString(),
                  name: 'New Agent',
                  color: '#f28c52',
                  cwd: explorerPath,
                  avatar: '',
                  personality: {},
                  createdAt: Date.now(),
                };
                addAgentChat(newAgent);
                setActiveAgentChatId(newAgent.id);
              }}
              onTogglePip={() => {
                pipWindow.togglePipWindow();
              }}
              isPipOpen={pipWindow.isPipOpen}
              onToggleQuackSound={() => setQuackSoundEnabled(!quackSoundEnabled)}
              quackSoundEnabled={quackSoundEnabled}
              chatSessions={chatSessions}
              onAdd={() => setShowNewTerminalModal(true)}
              onSelect={setActiveId}
              onClose={removeTerminal}
              onColorChange={(id, color) => updateTerminal(id, { color })}
              onEdit={setEditingTerminal}
              onDuplicate={(terminal) => {
                // Duplicate terminal logic
                createTerminal({
                  name: `${terminal.label} (copy)`,
                  path: terminal.cwd,
                  color: terminal.color,
                  workingOn: terminal.workingOn,
                  avatar: terminal.avatar,
                  branch: terminal.branch,
                  useWorktree: terminal.useWorktree,
                  personality: terminal.personality,
                });
              }}
              onReset={(terminal) => {
                // Reset terminal logic
                reloadTerminal(terminal.id);
              }}
              onToggleGroup={toggleGroupCollapse}
              onReorder={(reorderedIds) => {
                // Reorder terminals logic
                console.log('Reorder terminals:', reorderedIds);
              }}
              onOpenSettings={() => setShowSettings(true)}
              onOpenGitPanel={() => setShowGitDrawer(true)}
            />
          )}
        </div>

        {/* Action Icons */}
        <ActionIcons
          onGitClick={() => setShowGitDrawer(true)}
          onPluginsClick={() => setShowPluginsDrawer(true)}
          onUsageClick={() => {}}
          onTelegramClick={() => setShowTelegramSetup(true)}
          onTerminalClick={() => setShowNewTerminalModal(true)}
          onBrowserClick={() => {}}
          onDroidFactoryClick={() => {}}
          onGuideClick={() => {
            // TODO: Implement docs tab in AppRefactored
            console.log('Guide clicked - docs tab not yet implemented in AppRefactored');
          }}
          onToggleSidePanel={() => setSidePanelCollapsed(!sidePanelCollapsed)}
          sidePanelCollapsed={sidePanelCollapsed}
        />
      </div>

      {/* Modals */}
      {showNewTerminalModal && (
        <NewTerminalModal
          open={true}
          isEditing={!!editingTerminal}
          name={newTerminalName}
          path={newTerminalPath}
          color={newTerminalColor}
          workingOn={newTerminalWorkingOn}
          avatar={newTerminalAvatar}
          personality={newTerminalPersonality}
          branch={newTerminalBranch}
          useWorktree={newTerminalUseWorktree}
          availableColors={['#f28c52', '#ffb26f', '#ffd166', '#f77aa6', '#4dd4b3', '#8fa6ff', '#f2a57b']}
          selectingDirectory={selectingDirectory}
          creating={creatingTerminal}
          error={newTerminalError}
          onNameChange={setNewTerminalName}
          onColorChange={setNewTerminalColor}
          onWorkingOnChange={setNewTerminalWorkingOn}
          onAvatarChange={setNewTerminalAvatar}
          onPersonalityChange={setNewTerminalPersonality}
          onBranchChange={setNewTerminalBranch}
          onUseWorktreeChange={setNewTerminalUseWorktree}
          onBrowse={handleSelectDirectory}
          onConfirm={handleCreateTerminal}
          onCancel={() => {
            setShowNewTerminalModal(false);
            resetNewTerminalForm();
          }}
        />
      )}

      {showBackgroundsModal && (
        <Suspense fallback={<ModalSkeleton />}>
          <BackgroundsModal
            open={showBackgroundsModal}
            onClose={() => setShowBackgroundsModal(false)}
            currentBackground={currentBackground}
            onSelect={setCurrentBackground}
          />
        </Suspense>
      )}

      {showLicenseModal && (
        <LicenseModal
          isOpen={showLicenseModal}
          onClose={() => setShowLicenseModal(false)}
        />
      )}

      {showUpgradeModal && (
        <UpgradeModal
          isOpen={showUpgradeModal}
          onClose={() => setShowUpgradeModal(false)}
          onActivateLicense={() => setShowLicenseModal(true)}
          limitType={upgradeLimitType}
        />
      )}

      {savedCommandModalOpen && (
        <Suspense fallback={<ModalSkeleton />}>
          <SavedCommandModal
            open={savedCommandModalOpen}
            onClose={() => setSavedCommandModalOpen(false)}
            command={editingCommand}
            onSaved={(cmd) => {
              if (editingCommand) {
                updateSavedCommand(editingCommand.id, cmd);
              } else {
                addSavedCommand({ ...cmd, id: Date.now().toString() });
              }
              setSavedCommandModalOpen(false);
              setEditingCommand(null);
            }}
          />
        </Suspense>
      )}

      {/* Drawers */}
      {showGitDrawer && (
        <GitPanel
          summary={gitSummary}
          loading={loadingGit}
          error={gitError}
          history={commitHistory}
          historyLoading={false}
          historyError={historyError}
          selected={null}
          onRefresh={refreshGit}
          onSelect={(entry) => setSelectedGitPath(entry.path)}
          onStageAll={stageAll}
          onOpenFile={(path) => loadFilePreview(path, path)}
          commitMessage={commitMessage}
          onCommitMessageChange={setCommitMessage}
          onCommit={() => commit(commitMessage)}
          committing={committing}
          onGenerateCommitMessage={async () => {
            // Generate commit message
            console.log('Generate commit message');
          }}
          rootPath={explorerRoot}
          terminals={terminals}
        />
      )}

      {showDiffDrawer && (
        <Suspense fallback={<ModalSkeleton />}>
          <DiffDrawer
            selected={null}
            diffContent={diffContent}
            diffLoading={diffLoading}
            diffError={diffError}
            diffView={diffView}
            onDiffViewChange={setDiffView}
            onStage={(entry) => stageFile(entry.path)}
            onUnstage={(entry) => unstageFile(entry.path)}
            onClose={() => setShowDiffDrawer(false)}
          />
        </Suspense>
      )}

      {showPluginsDrawer && (
        <Suspense fallback={<ModalSkeleton />}>
          <MarketplaceDrawer
            workingDir={explorerPath}
            onRefresh={() => {
              // Refresh marketplace
            }}
          />
        </Suspense>
      )}

      {showSettings && (
        <Suspense fallback={<SettingsSkeleton />}>
          <UnifiedSettings
            onClose={() => setShowSettings(false)}
            currentBackground={currentBackground}
            onSelectBackground={setCurrentBackground}
          />
        </Suspense>
      )}

      {savedCommandsDrawerOpen && (
        <Suspense fallback={<ModalSkeleton />}>
          <SavedCommandsDrawer
            open={savedCommandsDrawerOpen}
            onClose={() => setSavedCommandsDrawerOpen(false)}
            commands={savedCommands}
            onLaunch={(cmd, immediate) => {
              // Launch command
              console.log('Launch command:', cmd, immediate);
            }}
            onEdit={(cmd) => {
              setEditingCommand(cmd);
              setSavedCommandModalOpen(true);
            }}
            onCreate={() => {
              setEditingCommand(null);
              setSavedCommandModalOpen(true);
            }}
            onDelete={async (cmd) => {
              await deleteSavedCommand(cmd.id);
            }}
          />
        </Suspense>
      )}

      {sessionDetailsDrawerOpen && selectedSession && (
        <Suspense fallback={<ModalSkeleton />}>
          <SessionDetailsDrawer
            isOpen={true}
            sessionId={selectedSession.id}
            onClose={() => setSessionDetailsDrawerOpen(false)}
            onResumeSession={(sessionId) => {
              console.log('Resume session:', sessionId);
            }}
          />
        </Suspense>
      )}

      {showQuackAgencyDrawer && (
        <Suspense fallback={<ModalSkeleton />}>
          <QuackAgencyDrawer
            open={showQuackAgencyDrawer}
            agents={agents}
            selectedAgent={selectedAgent}
            loading={loadingAgents}
            error={agentsError}
            workingDir={explorerPath}
            directoryExists={agentsDirectoryExists}
            onClose={() => setShowQuackAgencyDrawer(false)}
            onSelectAgent={(agent: AgentInfo) => {
              // Create or select agent tab instead of setting selectedAgent
              const agentTabId = `agent-${agent.name}-${agent.scope}`;

              // Check if tab already exists
              const existingTab = tabs.find(t => t.id === agentTabId);

              if (existingTab) {
                // Tab already exists, just activate it
                setActiveTabId(agentTabId);
              } else {
                // Create new agent tab
                const newTab: Tab = {
                  id: agentTabId,
                  label: agent.name.replace(/-/g, ' '),
                  type: 'agent' as const,
                  closable: true,
                  agentName: agent.name,
                  agentScope: agent.scope as 'global' | 'project',
                };

                setTabs((prevTabs: Tab[]) => [...prevTabs, newTab]);
                setActiveTabId(agentTabId);
              }

              // Close the drawer after selecting
              setShowQuackAgencyDrawer(false);
            }}
            onRefresh={() => {
              // Refresh agents
              setAgentRefreshKey(prev => prev + 1);
            }}
          />
        </Suspense>
      )}

      {showContextDrawer && contextScope && (
        <Suspense fallback={<ModalSkeleton />}>
          <ContextDrawer
            open={showContextDrawer}
            onClose={() => setShowContextDrawer(false)}
            scope={contextScope}
          />
        </Suspense>
      )}

      {showSkillDrawer && selectedSkill && (
        <Suspense fallback={<ModalSkeleton />}>
          <SkillDrawer
            open={showSkillDrawer}
            onClose={() => setShowSkillDrawer(false)}
            selectedSkill={selectedSkill}
            workingDir={explorerPath}
          />
        </Suspense>
      )}

      {showTelegramSetup && (
        <Suspense fallback={<ModalSkeleton />}>
          <TelegramSetup
            open={showTelegramSetup}
            onClose={() => setShowTelegramSetup(false)}
          />
        </Suspense>
      )}

      {/* AI Assistant */}
      {showAIAssistant && (
        <Suspense fallback={<ModalSkeleton />}>
          <AIAssistant
            onClose={() => setShowAIAssistant(false)}
            intent={aiIntent}
            initialMode={aiInitialMode}
            context={aiContext}
            onSelectCommand={(command) => {
              // Handle command selection
              console.log('Selected command:', command);
            }}
          />
        </Suspense>
      )}

      {/* Performance Monitor */}
      {showPerformanceMonitor && (
        <PerformanceMonitor />
      )}

      {/* File Preview Drawer */}
      {previewFile && (
        <FilePreviewDrawer
          ref={filePreviewRef}
          open={!!previewFile}
          onClose={clearPreview}
          filename={previewFile.name}
          path={previewFile.path}
          content={previewContent}
          imageData={previewImageData}
          error={previewError}
          loading={loadingPreview}
          formatting={formattingPreview}
          diffInfo={previewDiffInfo}
          onHasUnsavedChanges={setPreviewHasUnsavedChanges}
          onRefresh={() => loadFilePreview(previewFile.path, previewFile.name)}
          onFormat={() => setFormattingPreview(true)}
          onSave={(content) => saveFile(previewFile.path, content)}
        />
      )}
    </div>
  );
}

export default AppRefactored;