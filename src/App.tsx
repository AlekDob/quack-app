import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, startTransition } from "react";
import { flushSync } from "react-dom";
import { invoke } from "@tauri-apps/api/core";
import posthog from "posthog-js";
import { invokeWithTimeout, fireAndForget } from "./utils/invokeWithTimeout";
import { normalizeModelName } from "./utils/modelUtils";
import { useClaudeCliAvailability } from "./contexts/TestModeContext";
import { getTestModeStoreName } from "./utils/testModeStorage";
import { getCurrentVersion } from "./utils/version";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog, confirm } from "@tauri-apps/plugin-dialog";
import { open as openExternal } from "@tauri-apps/plugin-shell";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { Store } from "@tauri-apps/plugin-store";
import { Toaster, toast } from "sonner";
import "sonner/dist/styles.css";
import "./sonner-custom.css";
import { saveSessionBackup, cleanupOldBackups } from "./utils/sessionRecovery";

import TerminalSidebar from "./components/TerminalSidebar";
import SidePanel from "./components/SidePanel";
import SidePanelAccordion from "./components/SidePanelAccordion";
import { SplitPaneDivider, SplitDropZone, SplitCodeEditor, type SidebarDropData } from "./components/SplitView";
import "./components/SplitView/SplitView.css";
import NewTerminalModal from "./components/NewTerminalModal";
import FilePreviewDrawer, { type FilePreviewDrawerRef } from "./components/FilePreviewDrawer";
// Editor selection type for IDE context injection
interface EditorSelection {
  selectedText: string;
  startLine: number;
  endLine: number;
}
import { useFileSystemStore } from "./stores/fileSystemStore";
import { getLanguageFromFilename } from "./utils/languageDetection";
import FileActionButtons from "./components/FileActionButtons";
import GitPanel from "./components/GitPanel";
import DiffDrawer from "./components/DiffDrawer";
import QuackStoreDrawer, { type AgentBundleInstallData } from "./components/QuackStoreDrawer";
import SavedCommandsDrawer from "./components/SavedCommandsDrawer";
import SavedCommandModal from "./components/SavedCommandModal";
import SessionDetailsDrawer from "./components/SessionDetailsDrawer";
// import { NativeTerminalPanel } from "./components/NativeTerminalPanel"; // Unused - commented out
import { AddTerminalWindowModal } from "./components/AddTerminalWindowModal";
// TitleBar removed - using native macOS decorations
// import { TitleBar } from "./components/TitleBar";
import UnifiedSettings from "./components/settings/UnifiedSettings";
import { TeammateStreamTab } from "./components/TeammateStreamTab";
import PerformanceMonitor from "./components/PerformanceMonitor";
import AIAssistant from "./components/AIAssistant";
import QuackAgencyDrawer from "./components/QuackAgencyDrawer";
import ContextDrawer from "./components/ContextDrawer";
import SkillDrawer from "./components/SkillDrawer";
import BackgroundsModal from "./components/BackgroundsModal";
import TelegramSetup from "./components/TelegramSetup";
// Old Background Tasks system - replaced by Kanban shell tasks
// import BackgroundTasksDrawer from "./components/BackgroundTasksDrawer";
// import { runDroidInBackground } from "./services/backgroundAgentService";
// Background agent service for /background @agent commands
import { useBackgroundAgentInit } from "./hooks/useBackgroundAgents";
import ChatView, { type LineChange, type FileEdit, type FileDeleted } from "./components/ChatView";
import SessionEmptyState from "./components/SessionEmptyState";
import SplashScreen from "./components/SplashScreen";
import TabBar, { type Tab, type PopoutPosition } from "./components/TabBar";
import { useTabPopoutWindow } from "./hooks/useTabPopoutWindow";
import ActionIcons from "./components/ActionIcons";
import { XTermInstance } from "./components/XTermInstance";
import { useTerminalWindowManager } from "./hooks/useTerminalWindowManager";
import { TerminalIcon } from "./components/TerminalIcon";
import AgentViewer from "./components/AgentViewer";
import SkillViewer from "./components/SkillViewer";
import CommandViewer from "./components/CommandViewer";
import RuleViewer from "./components/RuleViewer";
import BrowserManager from "./components/BrowserManager";
import { useDocsTab } from "./hooks/useDocsTab";
import { useGlobalKeyboardShortcuts } from "./hooks/useGlobalKeyboardShortcuts";
import { useKanbanTab } from "./hooks/useKanbanTab";
import { useAutomationTab } from "./hooks/useAutomationTab";
import { useKanbanChatSync } from "./hooks/useKanbanChatSync";
import { useSessionMessageSync } from "./hooks/useSessionMessageSync";
import { useProjectDashboardTab } from "./hooks/useProjectDashboardTab";
import DocsTabView from "./views/DocsTabView";
import ClaudeAssetsTabView from "./views/ClaudeAssetsTabView";
import KanbanTabView from "./views/KanbanTabView";
import AutomationTabView from "./views/AutomationTabView";
import OfficeTabView from "./views/OfficeTabView";
import FeatureMapTabView from "./views/FeatureMapTabView";
import CodeEditorTabView from "./views/CodeEditorTabView";
import { useOfficeTab } from "./hooks/useOfficeTab";
import { useFeatureMapTab } from "./hooks/useFeatureMapTab";
import { useCodeEditorTab, codeEditorTabId } from "./hooks/useCodeEditorTab";
import ProjectDashboardTabView from "./views/ProjectDashboardTabView";
import ImageTabView from "./views/ImageTabView";
import { useClaudeAssetsTab } from "./hooks/useClaudeAssetsTab";
import { useMarketplace } from "./hooks/useMarketplace";
import { useUIStore } from "./stores/uiStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useProjectStatsStore } from "./stores/projectStatsStore";
import { applyTypography } from "./constants/typography";
import { applyAccentColor } from "./utils/accentColor";
import { useKanbanStore } from "./stores/kanbanStore";
import { useAutomationStore } from "./stores/automationStore";
import { useSessionStore } from "./stores/sessionStore";
import { useTeamStore } from "./stores/teamStore";
import { useTerminalStore } from "./stores/terminalStore";
import { useChatStore } from "./stores/chatStore";
import { useIDEStore } from "./stores/ideStore";
import KanbanNotificationBar from "./components/KanbanNotificationBar";
import { LicenseModal } from "./components/LicenseModal";
import { UpgradeModal } from "./components/UpgradeModal";
// ProBanner removed — Quack is free forever, no upgrade banner needed
import { ClaudeAuthBanner } from "./components/ClaudeAuthBanner";
import { DroidFactoryDrawer } from "./components/droid-factory";
import { useDroidFactory } from "./hooks/useDroidFactory";
import PrerequisitesCheck from "./components/settings/PrerequisitesCheck";
import GitConfigOnboarding from "./components/settings/GitConfigOnboarding";
import IDEOnboarding from "./components/settings/IDEOnboarding";
import UpdateToast from "./components/UpdateToast";
import { isPro } from "./config/features";
import type { DiffInfo } from "./components/CodeEditorCodeMirror";
import { parseDiff } from "./lib/diffParser";
import { buildContextPrefix } from "./utils/ideContextBuilder";
import { useExternalIdeContext } from "./hooks/useExternalIdeContext";
import type { ChatSendOptions, PermissionMode } from "./hooks/useClaudeChat";
import type { SlashCommand } from "./hooks/useSlashCommands";
import { useModelsConfig } from "./hooks/useAppConfig";
import { getModelId, defaultEffortForModel } from "./services/modelService";
import { findDefinition } from "./services/codeIntelService";
import { getProviderRequestFields, getActiveModelName, getActiveModelDisplayName, getActiveProviderConfig } from "./services/claudeSDK";
import { useDeepLinkHandler } from "./hooks/useDeepLinkHandler";
import { usePipWindow } from "./hooks/usePipWindow";
import { useSystemWakeHandler } from "./hooks/useSystemWakeHandler";
import { useWindowFocus } from "./hooks/useWindowFocus";
// import { useTelegramBot } from "./hooks/useTelegramBot"; // DEPRECATED - using Telegram Central Bot now
import {
  saveTabsByTerminalToStorage,
  loadTabsByTerminalFromStorage,
  saveNativeTerminalsToStorage,
  loadNativeTerminalsFromStorage,
  addActiveAgent,
  removeActiveAgent,
  migrateToActiveAgentsIndex,
  loadActiveAgentsWithData,
  STORAGE_KEY,
  TABS_BY_TERMINAL_KEY,
  NATIVE_TERMINALS_STORAGE_KEY,
} from "./services/terminalStorage";
import { extractProjectId } from "./utils/projectUtils";
import { getNextFireTime } from "./services/cronUtils";
import {
  loadAgents as loadUnifiedAgents,
  saveAgents as saveUnifiedAgents,
  deleteAgent,
  migrateFromLegacy,
  type UnifiedAgent,
} from "./services/unifiedAgentStorage";
import { calculateProjectOverhead } from "./services/conversationRecovery";
import { getDuckdroidUrl, getAgentAvatar, getAvatarUrl } from "./utils/agentAvatars";
import { showProjectToast } from "./components/ProjectToast";
import { loadAvailableDroids } from "./utils/skillsAndDroidsLoader";
import { loadProjectColors, getProjectColor, DEFAULT_PROJECT_COLORS } from "./utils/projectColors";
import { cleanupOldSessions } from "./utils/sessionCleanup";
import { injectAgentPersonality, injectAgentPersonalityAgentsMd } from "./utils/agentPersonality";
import { composeCodexPrompt } from "./utils/codexPromptComposer";
import { notifyLeadAgent } from "./services/remoteApi";
import { quackEventToClaudeEvents } from "./utils/codexEventAdapter";
import type { QuackAgentEvent } from "./types/agentBackend";
import type { DroidMetadata, ActiveProject } from "./components/modal-steps/types";
// TEMPORARILY DISABLED: MaxPlanProvider causing TDZ error - will fix separately
// import { MaxPlanProvider, useMaxPlan } from "./contexts/MaxPlanContext";
import {
  TERMINAL_COLORS,
  stripAnsi,
  normalizeKey,
  slugify,
  chunkContainsPrompt,
  debounce,
  getRandomTerminalColor,
} from "./utils/terminalUtils";

import type {
  AgentChat,
  DirectoryEntry,
  DirectoryListing,
  GitCommitEntry,
  GitStatusEntry,
  GitStatusSummary,
  NativeTerminal,
  TerminalExitEvent,
  TerminalInfo,
  AgentTerminal,
  SavedCommand,
  PipAgentState,
  PipAgentStatus,
  TerminalContext,
  AgentInfo,
  AgentDetails,
  SkillInfo,
  ChatMessage,
  ClaudeEvent,
  AgentChatSettings,
  SessionUsage,
  UsageStats,
  AgentPersonality,
  SessionInfo,
  SessionDetails,
  SavedAgent,
  HookConfig,
  KanbanTask,
  KanbanTaskInitialValues,
  AskUserQuestionAnswers,
  PendingToolPermission,
  AutomationJob,
  ContextUsageCategory,
} from "./types";
import { getRandomName } from "./utils/agentNames";
import {
  appendMessagesToSession,
  createChatTurnId,
  findAssistantMessageIndexForTurn,
  routeClaudeEventToSession,
  shouldRejectClaudeEvent,
  type BufferedClaudeEvent,
} from "./utils/chatTurnIsolation";

import "./App.css";
import "./components/MetroStyle.css";
import "./components/DrawerAnimations.css";
// Old Background Tasks CSS - no longer needed, Kanban has its own styles
// import "./components/BackgroundTasks.css";

// Notification settings
const NOTIFY_ACTIVE_TERMINAL = true; // Send notifications even for active terminal

// Helper to get working directory for Tauri commands
// Converts empty strings to undefined so Rust uses std::env::current_dir()
const getEffectiveWorkingDir = (cwd: string | undefined, fallback: string | undefined): string | undefined => {
  const dir = cwd ?? fallback;
  return dir && dir.trim() !== '' ? dir : undefined;
};

// ============================================
// Storage Version System
// ============================================
// Track storage format version to detect incompatible changes
// Increment this when storage structure changes between app versions
const STORAGE_VERSION = 1;
const STORAGE_VERSION_KEY = "storageVersion";

// Check storage version and reset if incompatible
const checkStorageVersion = async (): Promise<boolean> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-terminals.json"));
    const storedVersion = await store.get<number>(STORAGE_VERSION_KEY);

    if (storedVersion === undefined) {
      // First time - set version
      console.log("🦆 First launch - initializing storage version:", STORAGE_VERSION);
      await store.set(STORAGE_VERSION_KEY, STORAGE_VERSION);
      await store.save();
      return true;
    }

    if (storedVersion !== STORAGE_VERSION) {
      console.warn(`🦆 Storage version mismatch! Stored: ${storedVersion}, Current: ${STORAGE_VERSION}`);
      console.warn("🦆 Clearing incompatible storage data to prevent corruption");
      toast.error(`Storage format updated - resetting to clean state`);

      // Clear all storage keys
      await store.clear();

      // Set new version
      await store.set(STORAGE_VERSION_KEY, STORAGE_VERSION);
      await store.save();

      return false; // Version mismatch - data was cleared
    }

    console.log("🦆 Storage version check passed:", STORAGE_VERSION);
    return true; // Version matches
  } catch (error) {
    console.error("🦆 Error checking storage version:", error);
    return true; // Continue anyway - defensive approach
  }
};

// AgentChat Storage moved to src/services/agentChatStorage.ts
// Import the functions below

// ============================================
// Random Agent Names
// ============================================
// Agent names now managed in src/utils/agentNames.ts
// This module provides 140+ international names from various countries

// ============================================
// Migration System (Phase 2)
// ============================================
// NO migration needed! Terminals are independent entities, grouped only by cwd in the UI

// ============================================
// Store Cache
// ============================================
// Cache Store instances to avoid repeated disk reads
const storeCache = new Map<string, Awaited<ReturnType<typeof Store.load>>>();

async function getCachedStore(filename: string) {
  if (!storeCache.has(filename)) {
    storeCache.set(filename, await Store.load(filename));
  }
  return storeCache.get(filename)!;
}

// ============================================
// Session Message Hydration
// ============================================
// Restore chat messages from Claude SDK sessions on app startup

// 🚀 LAZY HYDRATION: hydrateSessionMessages removed - chat messages are now loaded
// on-demand when a session is selected (see setActiveSessionIdExclusive)
// This significantly improves app startup time by avoiding N resume_session calls at boot

// ============================================
// Terminal <-> UnifiedAgent Conversion Helpers
// ============================================

/**
 * Convert TerminalInfo to UnifiedAgent for storage
 */
function terminalToUnifiedAgent(terminal: TerminalInfo): UnifiedAgent {
  // Extract project name from cwd (last segment of path)
  const projectName = extractProjectId(terminal.cwd) || "Unknown";

  return {
    id: terminal.id,
    name: terminal.label,
    projectPath: terminal.cwd || "",
    projectName,
    color: terminal.color || "#6366f1",
    avatar: terminal.avatar,
    personality: terminal.personality as AgentPersonality | undefined,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };
}

/**
 * Convert UnifiedAgent back to TerminalInfo metadata for restoration
 * Note: workingOn and branch are runtime state and will be re-detected on startup
 */
function unifiedAgentToTerminalMetadata(agent: UnifiedAgent) {
  return {
    id: agent.id,
    label: agent.name,
    color: agent.color,
    cwd: agent.projectPath,
    avatar: agent.avatar,
    personality: agent.personality,
    workingOn: undefined, // Runtime state - will be re-detected
    branch: undefined, // Runtime state - will be re-detected
  };
}

// Stable empty collections — avoids creating new references on every render
const EMPTY_SET = new Set<string>();
const EMPTY_MAP = new Map<string, AskUserQuestionAnswers>();

function AppContent() {
  // Load assets INSIDE the component, not at module level
  const introAudio = new URL("../sounds/quack-intro.mp3", import.meta.url).href;
  const notificationAudio = new URL("../sounds/quack.mp3", import.meta.url).href;
  const duckBackgroundImage = new URL("../images/backgrounds/duck.png", import.meta.url).href;
  const ducksPatternBackgroundImage = new URL("../images/backgrounds/ducks-pattern.png", import.meta.url).href;
  const duckPattern3BackgroundImage = new URL("../images/backgrounds/duck-pattern3.png", import.meta.url).href;
  const hackerBackgroundImage = new URL("../images/backgrounds/hacker.png", import.meta.url).href;
  const duckBusinessBackgroundImage = new URL("../images/backgrounds/duckbusiness.png", import.meta.url).href;
  const duckMotoBackgroundImage = new URL("../images/backgrounds/duckmoto.png", import.meta.url).href;
  const duckPoolBackgroundImage = new URL("../images/backgrounds/duckpool.png", import.meta.url).href;
  const duckReadBackgroundImage = new URL("../images/backgrounds/duckread.png", import.meta.url).href;
  const gtaDuckBackgroundImage = new URL("../images/backgrounds/gtaduck.png", import.meta.url).href;
  const jazzDuckBackgroundImage = new URL("../images/backgrounds/jazzduck.png", import.meta.url).href;
  const cyberpunkDuckBackgroundImage = new URL("../images/backgrounds/e00b8faae79c45741ad8ff0060614a1ddd03bcea.png", import.meta.url).href;

  const [tauriAvailable] = useState(
    () => typeof window !== "undefined" && "__TAURI_INTERNALS__" in window
  );

  // Check if we're running inside the preview-webview window
  // If so, don't initialize the app to avoid permission errors
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

  // Droid Factory hook
  const {
    droidFactoryOpen,
    setDroidFactoryOpen,
    userStats,
  } = useDroidFactory();

  // Model configuration from Supabase - needed for model ID mapping
  const { models: remoteModels } = useModelsConfig();

  // System wake handler - prevents blank screen after macOS standby
  useSystemWakeHandler({ debug: true });

  // Window focus handler - pauses animations when window is blurred for battery saving
  useWindowFocus();

  // Background Agents initialization - needed for /background @agent commands
  useBackgroundAgentInit();

  // TEMPORARILY DISABLED: Max Plan tracking
  // const { incrementMessageCount } = useMaxPlan();

  // AgentChat state (workspace containers for terminal tabs)
  // AgentChats kept for UI grouping only - NOT linked to terminals!
  const [agentChats, setAgentChats] = useState<AgentChat[]>([]);
  const [activeAgentChatId, setActiveAgentChatId] = useState<string | null>(null);

  // Documentation tab management
  const { openDocsTab } = useDocsTab();

  // Marketplace for onboarding starter bundles
  const { installAgentBundle } = useMarketplace();

  // Kanban state from store (no longer using isKanbanTabActive overlay)
  // 🦆 SESSIONS-FIRST: Use getters instead of direct tasks array
  const { loadTasks: loadKanbanTasks, getTasksByStatus, pendingNotification, dismissNotification, requestNewTaskModal } = useKanbanStore();

  // Session state from store (sessions-first architecture)
  const { sessions: agentSessions, selectSession, createSession, updateSession } = useSessionStore();

  // 🦆 SESSION-FIRST: Helper to get agentId from sessionId
  // Used when we need to route Claude SDK calls (which use agentId) from session-based UI
  const getAgentIdFromSession = useCallback((sessionId: string | null): string | null => {
    if (!sessionId) return null;
    const session = agentSessions.find(s => s.id === sessionId);
    return session?.agentId ?? null;
  }, [agentSessions]);

  // 🦆 SESSIONS-FIRST: Count tasks in progress for badge (reads from sessions)
  const inProgressTasks = getTasksByStatus('in_progress');
  const inProgressTaskCount = inProgressTasks.length;



  // Kanban tab management
  const { openKanbanTab } = useKanbanTab();

  // Automation tab management
  const { openAutomationTab } = useAutomationTab();

  // Office tab management
  const { openOfficeTab } = useOfficeTab();

  // Whiteboard tab management
  const { openFeatureMapTab } = useFeatureMapTab();

  // Code Editor tab management
  // Brain: pattern-code-editor-tab
  const { openCodeEditorTab } = useCodeEditorTab();

  // Project Dashboard tab management
  const { openProjectDashboardTab } = useProjectDashboardTab();

  // Kanban sync - emit loading state and task changes to popout windows
  const { emitLoadingState, emitTasksChanged } = useKanbanChatSync();


  // Claude Assets Manager tab - hook is called later after tabs state is defined

  // Terminal Window manager - opens separate Tauri window for terminals
  const { openTerminalWindow, updateProjects: updateTerminalWindowProjects, isOpen: terminalWindowOpen } = useTerminalWindowManager();

  // Brain window open state - tracks whether the Brain window is open
  const [brainWindowOpen, setBrainWindowOpen] = useState(false);

  // Tab Popout Window manager - drag tabs out to separate windows
  const handleTabReturn = useCallback((tab: Tab) => {
    console.log('[App] Tab returned from popout:', tab.id);
    setTabs(prev => {
      // Don't add if already exists
      if (prev.some(t => t.id === tab.id)) return prev;
      return [...prev, tab];
    });
    setActiveTabId(tab.id);
  }, []);
  const { popoutTab, closePopoutWindow, isTabPoppedOut } = useTabPopoutWindow(handleTabReturn);

  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // 🦆 Active Task ID: Tasks are now first-class citizens, completely independent from agents
  // When a task is selected, it opens in its own tab - NOT tied to any agent
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  // 🦆 Active Session ID: Track which AgentSession is currently active for chat
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // 🦆 FIX SESSION MIXING: Wrapper functions that ensure mutual exclusivity
  // When one is set, the other MUST be cleared to prevent mixing
  const setActiveTaskIdExclusive = useCallback((taskId: string | null) => {
    console.log(`[SESSION-FIX] setActiveTaskIdExclusive: ${taskId}`);
    setActiveTaskId(taskId);
    if (taskId !== null) {
      // When setting a task, clear the session to prevent mixing
      setActiveSessionId(null);
      console.log(`[SESSION-FIX] Cleared activeSessionId because activeTaskId is now: ${taskId}`);
    }
  }, []);

  const setActiveSessionIdExclusive = useCallback((newSessionId: string | null) => {
    console.log(`[SESSION-FIX] setActiveSessionIdExclusive: ${newSessionId}`);

    // 🦆 FIX: Do NOT abort streams when switching sessions!
    // Each session is independent and can continue running in background.
    // The user must explicitly click "Stop" to abort a stream.
    // Previous "BUG #3 FIX" was WRONG - it aborted streams involuntarily when user
    // simply wanted to switch between sessions to check on them.
    // Session isolation is handled by sessionKey in events, not by aborting streams.
    setActiveSessionId(newSessionId);

    if (newSessionId !== null) {
      // When setting a session, clear the task to prevent mixing
      setActiveTaskId(null);
      console.log(`[SESSION-FIX] Cleared activeTaskId because activeSessionId is now: ${newSessionId}`);

      // 🚀 LAZY HYDRATION: Load chat messages from .jsonl on first visit after restart.
      // Boot-time code (loadKanbanChatSessions) may pre-populate chatSessions with stale
      // data from quack-chats.json, so we use hydratedSessionsRef to track which sessions
      // have been freshly loaded from .jsonl in this app session.
      // After the first .jsonl load, subsequent switches preserve the in-memory cache
      // (rich ChatMessage objects with tool events, subagent data, etc.).
      if (hydratedSessionsRef.current.has(newSessionId)) {
        // Already hydrated from .jsonl in this app session — keep in-memory data
        return;
      }

      // Optimistic lock: claim the slot synchronously to prevent duplicate IIFEs
      // if the user switches to the same session twice before the first resolves.
      hydratedSessionsRef.current.add(newSessionId);

      // First visit after restart — load from .jsonl via Tauri backend
      (async () => {
        const session = useSessionStore.getState().sessions.find(s => s.id === newSessionId);
        if (!session?.claudeSessionId) {
          console.warn(`[LAZY HYDRATE] No claudeSessionId for session ${newSessionId}`);
          return;
        }

        try {
          const details = await invoke<SessionDetails>('resume_session', {
            sessionId: session.claudeSessionId
          });

          if (details.messages && details.messages.length > 0) {
            const chatMessages: ChatMessage[] = details.messages.map((m) => ({
              id: crypto.randomUUID(),
              role: m.role as 'user' | 'assistant',
              content: m.content,
              timestamp: m.timestamp || Date.now(),
              status: 'complete' as const,
            }));

            setChatSessions(p => new Map(p).set(newSessionId, chatMessages));
            console.log(`[LAZY HYDRATE] Loaded ${chatMessages.length} messages for session ${newSessionId}`);
          }
        } catch (e) {
          // Release the lock so a retry is possible on next switch
          hydratedSessionsRef.current.delete(newSessionId);
          console.debug(`[LAZY HYDRATE] Could not restore session ${newSessionId}:`, e);
        }
      })();
    }
  }, []);

  // 🗣️ AskUserQuestion: Track pending requests from canUseTool callback
  // Maps requestId -> { agentId, sessionKey, questions } for responding via stdin
  // 🦆 FIX: Added sessionKey to track which specific session has the pending question
  const [pendingUserQuestions, setPendingUserQuestions] = useState<Map<string, { agentId: string; sessionKey?: string; questions: unknown[] }>>(new Map());

  // 🛡️ ToolPermission: Track pending tool permission requests (Ask mode)
  // Brain: pattern-permission-modes (Ask mode)
  const [pendingToolPermissions, setPendingToolPermissions] = useState<Map<string, PendingToolPermission>>(new Map());
  // 🛡️ "Allow always for [ToolName]" — per-session auto-approved tools
  // Ref (not state) because it's only read inside event handlers, no re-render needed
  const autoApprovedToolsRef = useRef<Map<string, Set<string>>>(new Map());

  // 📋 PlanApproval: Track pending plan approval requests from ExitPlanMode
  // Maps requestId -> { agentId, sessionKey, plan } for responding via stdin
  const [pendingPlanApprovals, setPendingPlanApprovals] = useState<Map<string, { agentId: string; sessionKey?: string; plan: unknown }>>(new Map());

  // 🔵 Read-once notification badge system: Track last read timestamp for each agent
  // When user clicks an agent, we mark it as "read" by storing current timestamp
  // Badge shows only if lastAssistantMessage > lastRead (new message after last read)
  const [lastReadTimestamps, setLastReadTimestamps] = useState<Map<string, number>>(new Map());

  // NEW: Agent Terminals - Terminali integrati XTerm associati agli agenti (separati da terminals)
  const [agentTerminals, setAgentTerminals] = useState<AgentTerminal[]>([]);

  // Native Terminals state (Mac Terminal.app integration)
  const [nativeTerminals, setNativeTerminals] = useState<NativeTerminal[]>([]);
  const [showAddNativeTerminalModal, setShowAddNativeTerminalModal] = useState(false);

  // Derived state - moved here to fix TypeScript hoisting errors
  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null); // Agent currently used in chat (Quack Agency)

  // Project colors for project-first modal flow (must be before useMemo that uses it)
  const [projectColors, setProjectColors] = useState<Record<string, string>>({});

  const activeTerminal = useMemo(
    () => terminals.find((terminal) => terminal.id === activeId) ?? null,
    [activeId, terminals]
  );

  // Derive active projects from terminals for project-first modal
  const activeProjects: ActiveProject[] = useMemo(() => {
    const projectMap = new Map<string, { name: string; path: string; agentCount: number }>();

    terminals.forEach(terminal => {
      const path = terminal.cwd;
      const name = extractProjectId(path) || path;

      if (!projectMap.has(path)) {
        projectMap.set(path, { name, path, agentCount: 0 });
      }
      const project = projectMap.get(path)!;
      project.agentCount++;
    });

    // Convert to array with colors
    return Array.from(projectMap.values()).map((project, index) => {
      const repoKey = `repo-${project.name}`;
      return {
        ...project,
        color: getProjectColor(repoKey, projectColors, index),
      };
    });
  }, [terminals, projectColors]);

  // Project context for chat header
  const [projectName, setProjectName] = useState<string>('');
  const [gitBranch, setGitBranch] = useState<string>('');

  const [explorerPath, setExplorerPath] = useState("");

  // 🦆 BRANCH-PER-SESSION: Effective git root path considers session's worktreePath
  const effectiveGitRootPath = useMemo(() => {
    if (activeSessionId) {
      const session = agentSessions.find(s => s.id === activeSessionId);
      if (session?.worktreePath) return session.worktreePath;
    }
    return explorerPath;
  }, [activeSessionId, agentSessions, explorerPath]);
  const [explorerTree, setExplorerTree] = useState<
    Record<string, DirectoryEntry[]>
  >({});
  const [explorerRoot, setExplorerRoot] = useState<string | null>(null);


  // Available droids for @mention invocation (loaded from .claude/agents directories)
  const [availableDroids, setAvailableDroids] = useState<DroidMetadata[]>([]);
  const [loadingExplorer, setLoadingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [refreshExplorerTrigger, setRefreshExplorerTrigger] = useState(0);
  const [creatingTerminal, setCreatingTerminal] = useState(false);

  // OpenAI API Key for Whisper
  const [openaiApiKey, setOpenaiApiKey] = useState<string | null>(null);
  const [showNewTerminalModal, setShowNewTerminalModal] = useState(false);
  const [initialModalStep, setInitialModalStep] = useState<'project' | 'agent'>('project'); // Step to start modal at
  const [newTerminalName, setNewTerminalName] = useState("");
  const [newTerminalPath, setNewTerminalPath] = useState("");
  const [newTerminalColor, setNewTerminalColor] = useState<string>(TERMINAL_COLORS[0]);
  const [newTerminalWorkingOn, setNewTerminalWorkingOn] = useState("");
  const [newTerminalAvatar, setNewTerminalAvatar] = useState(""); // Empty to allow auto-selection
  const [newTerminalBranch, setNewTerminalBranch] = useState("");
  const [newTerminalUseWorktree, setNewTerminalUseWorktree] = useState(false);
  const [newTerminalPersonality, setNewTerminalPersonality] = useState<Partial<AgentPersonality>>({
    role: 'Feature Coordinator',
    intro: 'Experienced PM specializing in feature delivery and team coordination',
    technicalContext: '',
    rules: [],
    communicationStyle: 'friendly',
    customNotes: '',
    specialties: ['feature-planning', 'team-alignment'],
    personality: 'Organized. Proactive',
    skills: [],
    expressions: [],
  });

  // Debug wrapper for setNewTerminalPersonality
  const handlePersonalityChange = useCallback((newPersonality: Partial<AgentPersonality>) => {
    setNewTerminalPersonality((prev) => {
      console.log('🔍 handlePersonalityChange called');
      console.log('🔍 Previous state:', JSON.stringify(prev, null, 2));
      console.log('🔍 New personality:', JSON.stringify(newPersonality, null, 2));
      const merged = { ...prev, ...newPersonality };
      console.log('🔍 Merged state:', JSON.stringify(merged, null, 2));
      return merged;
    });
  }, []);
  const [newTerminalError, setNewTerminalError] = useState<string | null>(null);
  const [selectingDirectory, setSelectingDirectory] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [quackSoundEnabled, setQuackSoundEnabled] = useState(() => {
    // Default to true (sound ON by default)
    const stored = localStorage.getItem('quackSoundEnabled');
    return stored !== 'false';
  });
  const [booting, setBooting] = useState(true);
  // Splash is now handled by native HTML splash in index.html only
  // React SplashScreen is only used for "Watch Intro" replay feature
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [hasSavedAgents, setHasSavedAgents] = useState(true); // Assume true until bootstrap confirms
  const [persistedProjects, setPersistedProjects] = useState<Map<string, string>>(new Map()); // path -> name
  const [introVersion, setIntroVersion] = useState('');

  // Apply typography CSS variables before first paint + on every change
  const typography = useSettingsStore((s) => s.typography);
  useLayoutEffect(() => {
    applyTypography(typography);
  }, [typography]);

  // Apply accent color before first paint + on every change
  const accentColor = useSettingsStore((s) => s.appearance.accentColor);
  useLayoutEffect(() => {
    applyAccentColor(accentColor);
  }, [accentColor]);

  // Fetch app version for intro screen
  useEffect(() => {
    getCurrentVersion().then(version => setIntroVersion(`v${version}`));
  }, []);

  // Load quack sound setting from Tauri Store and listen for changes
  useEffect(() => {
    const loadSoundSetting = async () => {
      try {
        const store = await Store.load('.quack-ui-prefs.dat');
        const sound = await store.get<boolean>('quack-sound-enabled');
        // Only enable if explicitly set to true (opt-in)
        const enabled = sound === true;
        setQuackSoundEnabled(enabled);
        // Sync localStorage with Tauri Store
        localStorage.setItem('quackSoundEnabled', String(enabled));
      } catch (err) {
        console.warn('Failed to load quack sound setting:', err);
      }
    };
    loadSoundSetting();

    const handleSoundSettingChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ enabled: boolean }>;
      setQuackSoundEnabled(customEvent.detail.enabled);
      // Sync localStorage with custom event
      localStorage.setItem('quackSoundEnabled', String(customEvent.detail.enabled));
    };

    window.addEventListener('quack-sound-setting-changed', handleSoundSettingChange);
    return () => {
      window.removeEventListener('quack-sound-setting-changed', handleSoundSettingChange);
    };
  }, []);

  const [previewFile, setPreviewFile] = useState<{
    name: string;
    path: string;
  } | null>(null);
  const [previewContent, setPreviewContent] = useState("");

  // Sync local previewFile to fileSystemStore so IDE context utilities can read it
  useEffect(() => {
    useFileSystemStore.getState().setPreviewFile(previewFile?.path ?? null);
  }, [previewFile]);

  // Poll external IDE (VS Code, Cursor) for context so the ChatInput chip can show it
  useExternalIdeContext(explorerPath || null);

  const [previewImageData, setPreviewImageData] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [formattingPreview, setFormattingPreview] = useState(false);
  const [previewDiffInfo, setPreviewDiffInfo] = useState<DiffInfo | null>(null);
  const [previewLineChanges, setPreviewLineChanges] = useState<LineChange[] | null>(null);
  const [previewHasUnsavedChanges, setPreviewHasUnsavedChanges] = useState(false);
  const previewDrawerRef = useRef<FilePreviewDrawerRef>(null);

  // IDE context: track editor selection for agent chat context injection
  const handleEditorSelectionChange = useCallback((sel: EditorSelection | null) => {
    if (!sel || !previewFile) {
      useFileSystemStore.getState().clearEditorSelection();
      return;
    }
    useFileSystemStore.getState().setEditorSelection({
      filePath: previewFile.path,
      language: getLanguageFromFilename(previewFile.name),
      selectedText: sel.selectedText,
      startLine: sel.startLine,
      endLine: sel.endLine,
    });
  }, [previewFile]);

  const [showGitDrawer, setShowGitDrawer] = useState(false);
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);
  const [showStoreDrawer, setShowStoreDrawer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsInitialCategory, setSettingsInitialCategory] = useState<'general' | 'about' | undefined>(undefined);
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(() => {
    try {
      const stored = localStorage.getItem('ui-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed?.state?.sidePanelCollapsed ?? false;
      }
    } catch { /* ignore */ }
    return false;
  });
  // Sync sidePanelCollapsed to Zustand store for persistence
  const setSidePanelCollapsedStore = useUIStore((s) => s.setSidePanelCollapsed);
  useEffect(() => {
    setSidePanelCollapsedStore(sidePanelCollapsed);
  }, [sidePanelCollapsed, setSidePanelCollapsedStore]);

  // Force expand a specific section in the side panel accordion
  const [forceExpandSection, setForceExpandSection] = useState<string | null>(null);
  // Cross-project switch loader — covers the freeze window when changing projects via Task Hub / sidebar
  const [projectSwitchTarget, setProjectSwitchTarget] = useState<{ projectName: string; projectPath: string } | null>(null);
  const projectSwitchSafetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup any pending safety timeout on unmount
  useEffect(() => {
    return () => {
      if (projectSwitchSafetyRef.current) clearTimeout(projectSwitchSafetyRef.current);
    };
  }, []);
  // Chat fullscreen mode - hides side panel and expands chat
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  // Track sidebar state before Kanban view to restore it on exit
  const sidePanelCollapsedBeforeKanbanRef = useRef<boolean | null>(null);
  // Track if user wants side panel expanded while in Kanban mode (e.g., clicked on project name)
  const [kanbanSidePanelExpanded, setKanbanSidePanelExpanded] = useState(false);
  // Show Kanban Mini Panel in sidebar (toggled via button in Kanban tab header)
  const [showKanbanMiniPanel, setShowKanbanMiniPanel] = useState(false);
  const [emptyStateShowGuide, setEmptyStateShowGuide] = useState(false);

  // Tab system state - restore from localStorage for wake-from-standby resilience
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const stored = localStorage.getItem('ui-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        const savedTabs = parsed?.state?.tabs;
        if (Array.isArray(savedTabs) && savedTabs.length > 0) {
          // Only restore simple tab types that survive reload (chat, kanban)
          // Filter out tabs that need runtime context (file editors, terminals, etc.)
          const safeTypes = new Set(['chat', 'kanban-board', 'docs', 'office']);
          const restored = savedTabs.filter(
            (t: Tab) => safeTypes.has(t.type) || t.id === 'chat'
          );
          // Ensure chat tab is always present
          if (!restored.find((t: Tab) => t.id === 'chat')) {
            restored.unshift({ id: 'chat', label: 'Chat', type: 'chat', closable: false });
          }
          return restored;
        }
      }
    } catch { /* ignore parse errors */ }
    return [{ id: 'chat', label: 'Chat', type: 'chat', closable: false }];
  });
  const [activeTabId, setActiveTabId] = useState(() => {
    try {
      const stored = localStorage.getItem('ui-storage');
      if (stored) {
        const parsed = JSON.parse(stored);
        const savedId = parsed?.state?.activeTabId;
        if (typeof savedId === 'string' && savedId.length > 0) {
          // Only restore safe tab IDs (not file/terminal/task tabs that need runtime state)
          const safeIds = ['chat', 'kanban-board'];
          const isSafe = safeIds.includes(savedId) || savedId.startsWith('docs-');
          return isSafe ? savedId : 'chat';
        }
      }
    } catch { /* ignore parse errors */ }
    return 'chat';
  });

  // Current project path — single source of truth for the sidebar highlight.
  // Priority chain: active tab's project (if tab is project-scoped) > active terminal's cwd > null.
  // Drives the "Active" pill, rail, background fill, glow flash, and autoscroll
  // inside the sidebar (see RepositoryGroup `isCurrentProject` prop).
  const currentProjectPath = useMemo<string | null>(() => {
    const activeTab = tabs.find(t => t.id === activeTabId);
    if (activeTab) {
      if (activeTab.type === 'feature-map') {
        return activeTab.initialProjectPath ?? activeTerminal?.cwd ?? null;
      }
      if (activeTab.type === 'project-dashboard') {
        return activeTab.filePath ?? null;
      }
      if (activeTab.type === 'claude-assets') {
        return activeTab.initialProjectPath ?? null;
      }
      if (activeTab.type === 'code-editor' && activeTab.editorFilePath) {
        const file = activeTab.editorFilePath;
        const match = terminals
          .map(t => t.cwd)
          .filter((cwd): cwd is string => Boolean(cwd) && file.startsWith(cwd))
          .sort((a, b) => b.length - a.length)[0];
        if (match) return match;
      }
    }
    return activeTerminal?.cwd ?? null;
  }, [tabs, activeTabId, activeTerminal?.cwd, terminals]);

  // Clear the cross-project switch loader once currentProjectPath has caught up
  // with the target (or if the target was reset externally).
  useEffect(() => {
    if (!projectSwitchTarget) return;
    if (currentProjectPath === projectSwitchTarget.projectPath) {
      if (projectSwitchSafetyRef.current) {
        clearTimeout(projectSwitchSafetyRef.current);
        projectSwitchSafetyRef.current = null;
      }
      setProjectSwitchTarget(null);
    }
  }, [currentProjectPath, projectSwitchTarget]);

  // Split View state
  const [splitTabId, setSplitTabId] = useState<string | null>(null);
  const [splitRatio, setSplitRatio] = useState(0.5);
  const [isDraggingTab, setIsDraggingTab] = useState(false);
  const [isDraggingSidebar, setIsDraggingSidebar] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);


  // Save/restore split view per agent (persisted in ref, no re-renders)
  const splitByAgentRef = useRef<Map<string, string>>(new Map());

  // Clear editor selection when navigating away from file tab
  useEffect(() => {
    if (!activeTabId.startsWith('file-')) {
      useFileSystemStore.getState().clearEditorSelection();
    }
  }, [activeTabId]);

  // Persist tab state to localStorage for wake-from-standby resilience
  useEffect(() => {
    try {
      const stored = localStorage.getItem('ui-storage');
      const current = stored ? JSON.parse(stored) : { state: {} };
      current.state = { ...current.state, tabs, activeTabId };
      localStorage.setItem('ui-storage', JSON.stringify(current));
    } catch { /* ignore write errors */ }
  }, [tabs, activeTabId]);

  // Derived state: is Kanban tab currently active?
  // This replaces the old isKanbanTabActive overlay approach
  const isKanbanTabActive = activeTabId === 'kanban-board';
  const isOfficeTabActive = activeTabId === 'office-view';
  const isFeatureMapTabActive = activeTabId === 'feature-map';
  const isCodeEditorTabActive = activeTabId.startsWith('code-editor');
  // Brain: fix-office-webgl-shader-remount
  // Track if office was ever opened so we keep OfficeView mounted (hidden)
  // even after tab close, preventing WebGL context loss → stale shader errors
  const officeEverOpened = useRef(false);

  // 🦆 Display tabs: Task tabs are now real tabs in the tabs array (type: 'task')
  // No need to transform 'chat' tab anymore - tasks have their own dedicated tabs
  const displayTabs = useMemo(() => {
    return tabs;
  }, [tabs]);

  // Track last active tab per terminal/agent
  const lastActiveTabPerTerminal = useRef<Map<string, string>>(new Map());

  // Wrapper to update activeTabId and save it for current terminal
  const updateActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    if (activeId) {
      lastActiveTabPerTerminal.current.set(activeId, tabId);
    }
  }, [activeId]);

  // Claude Assets Manager tab - must be after tabs state is defined
  const { openClaudeAssetsTab } = useClaudeAssetsTab({
    tabs,
    setTabs,
    setActiveTabId: updateActiveTab,
  });

  // Tabs per terminal/agent - each agent has its own set of file tabs
  const [tabsByTerminal, setTabsByTerminal] = useState<Map<string, Tab[]>>(new Map());

  // Track previous activeId to save tabs correctly when switching terminals
  const previousActiveIdRef = useRef<string | null>(null);

  const [gitSummary, setGitSummary] = useState<GitStatusSummary | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardRefreshKey, setDashboardRefreshKey] = useState(0);
  const [gitError, setGitError] = useState<string | null>(null);
  const [selectedGitPath, setSelectedGitPath] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffView, setDiffView] = useState<"worktree" | "staged">("worktree");
  // Synthetic entry for diffs opened from EditSummaryBar (not from git panel)
  const [editSummaryDiffEntry, setEditSummaryDiffEntry] = useState<GitStatusEntry | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [commitHistory, setCommitHistory] = useState<GitCommitEntry[]>([]);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [gitRefreshTrigger, setGitRefreshTrigger] = useState<number>(0);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem("sidebar.collapsed.groups");
      return stored ? new Set(JSON.parse(stored)) : new Set();
    } catch {
      return new Set();
    }
  });
  // NEW: Track modified files for FileExplorer indicators
  const [modifiedFiles, setModifiedFiles] = useState<Map<string, 'created' | 'modified' | 'deleted'>>(new Map());
  // Agent commit detection — bumped when any ChatView detects an agent `git commit`
  const [agentCommitTs, setAgentCommitTs] = useState(0);
  // NEW: Track complete file edits for line highlighting
  const [fileEditsMap, setFileEditsMap] = useState<Map<string, FileEdit>>(new Map());
  const [editingTerminal, setEditingTerminal] = useState<TerminalInfo | null>(
    null
  );
  const appShellRef = useRef<HTMLDivElement | null>(null);
  const idleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  // Separate timers for notifications (longer delay)
  const notificationTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  // Anti-flickering: debounce visual transitions from busy→idle
  const visualIdleTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );
  const terminalsRef = useRef<TerminalInfo[]>([]);
  const handleSessionClickRef = useRef<((sessionId: string) => void) | null>(null);
  const IDLE_TIMEOUT_MS = 5000; // 5s - for activity bar (fast response)
  const NOTIFICATION_TIMEOUT_MS = 60000; // 1 minute - for notifications only
  const VISUAL_IDLE_DELAY_MS = 400; // Delay before showing idle status (prevents flickering)
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);
  const [savedCommandsDrawerOpen, setSavedCommandsDrawerOpen] = useState(false);
  const [savedCommandsFilterProject, setSavedCommandsFilterProject] = useState<string | null>(null);
  const [savedCommandModalOpen, setSavedCommandModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<SavedCommand | null>(
    null
  );
  const [sessionDetailsDrawerOpen, setSessionDetailsDrawerOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionInfo | null>(null);
  const [sessionsRefreshKey, setSessionsRefreshKey] = useState(0);
  const [agentRefreshKey, setAgentRefreshKey] = useState(0); // Forces context panel refresh when agent is edited
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiIntent, setAiIntent] = useState('');
  const [aiInitialMode, setAiInitialMode] = useState<'terminal-helper' | 'prompt-engineer' | undefined>(undefined);
  const [aiContext, setAiContext] = useState<TerminalContext>({
    os: 'macos',
    shell: 'zsh',
    cwd: '',
    recentCommands: [],
  });
  const recentCommandsRef = useRef<string[]>([]);
  const [introReplayActive, setIntroReplayActive] = useState(false);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);

  // Background state
  const [showBackgroundsModal, setShowBackgroundsModal] = useState(false);
  // Old Background Tasks drawer - replaced by Kanban
  // const [showBackgroundTasksDrawer, setShowBackgroundTasksDrawer] = useState(false);

  // 💰 License and upgrade modals state
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeLimitType, setUpgradeLimitType] = useState<'terminals' | 'groups' | 'backgrounds' | 'agency' | 'sync'>('terminals');
  const [isProUser, setIsProUser] = useState(isPro());
  const [claudeCliAvailable, setClaudeCliAvailable] = useState<boolean | null>(null);
  const [claudeAuthBannerExpanded, setClaudeAuthBannerExpanded] = useState(true);
  const [claudeAuthBannerDismissed, setClaudeAuthBannerDismissed] = useState(false);
  const [currentBackground, setCurrentBackground] = useState("duckmoto.png");

  // Check Claude CLI availability on mount (with test mode support)
  const claudeCliAvailabilityHook = useClaudeCliAvailability();

  useEffect(() => {
    if (claudeCliAvailabilityHook !== null) {
      setClaudeCliAvailable(claudeCliAvailabilityHook);
    }
  }, [claudeCliAvailabilityHook]);


  // Listen for license modal open event from settings
  useEffect(() => {
    const handleOpenLicenseModal = () => {
      console.log('[App.tsx] open-license-modal event received - opening LicenseModal');
      // Close Settings panel
      setShowSettings(false);
      // Close UpgradeModal if it was open
      setShowUpgradeModal(false);
      // Open LicenseModal
      setShowLicenseModal(true);
    };

    window.addEventListener('open-license-modal', handleOpenLicenseModal);
    return () => window.removeEventListener('open-license-modal', handleOpenLicenseModal);
  }, []);

  // Telegram Central Bot state
  const [showTelegramSetup, setShowTelegramSetup] = useState(false);

  // Multi-Chat state - one chat session per agent
  const [chatSessions, setChatSessions] = useState<Map<string, ChatMessage[]>>(new Map());
  const [chatLoadingMap, setChatLoadingMap] = useState<Map<string, boolean>>(new Map());
  // Agent metadata (name, cwd) for Telegram notifications
  const agentMetadataRef = useRef<Map<string, { name: string; cwd: string }>>(new Map());
  // Last response text per agent for Telegram notifications
  const lastAgentResponseRef = useRef<Map<string, string>>(new Map());
  const [isChatConfigured, setIsChatConfigured] = useState(false);

  // Abort controllers and last prompts for each agent
  // Key format: `${activeId}-${messageId}` to prevent race conditions between concurrent streams
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const lastPromptsRef = useRef<Map<string, string>>(new Map());
  // Track which sessions are resuming (have an existing claudeSessionId) to hide redundant init widgets
  const resumingSessionsRef = useRef<Set<string>>(new Set());
  // Track active streams per SESSION (not per agent) to prevent concurrency issues
  // Key is sessionKey (activeSessionId || activeId), Value is Set of streamKeys
  // This allows different sessions of the same agent to be stopped independently
  const activeStreamsRef = useRef<Map<string, Set<string>>>(new Map());
  // Track stream count for UI display (Map of agentId -> count)
  // const [activeStreamCounts, setActiveStreamCounts] = useState<Map<string, number>>(new Map());

  // 🦆 SESSION PERSISTENCE: REMOVED - No longer showing resume messages
  // Users can resume via Sessions panel instead

  // Ref mirror of chatSessions for synchronous access in beforeunload and result-event handlers
  const chatSessionsRef = useRef<Map<string, ChatMessage[]>>(new Map());
  // Ref mirror of activeSessionId for synchronous access in beforeunload handler
  const activeSessionIdRef = useRef<string | null>(null);
  // Track which sessions have been freshly hydrated from .jsonl in THIS app session.
  // Boot-time code (loadKanbanChatSessions) may pre-populate chatSessions with stale data
  // from quack-chats.json. This ref ensures the first visit to each session after restart
  // always refreshes from .jsonl, while subsequent switches preserve the in-memory cache.
  const hydratedSessionsRef = useRef<Set<string>>(new Set());

  // 🦆 RACE CONDITION FIX: Track active event listeners to ensure they're ready before invoke()
  // This prevents the bug where events are emitted before the listener is set up
  const activeListenersRef = useRef<Map<string, () => void>>(new Map());

  // 🦆 FIX: Track in-flight listener registrations to prevent duplicate listen() calls
  // Without this, Multi-Listener and Pre-warm can both call listen() for the same agentId
  // before either resolves, causing Tauri's "listeners[eventId].handlerId" crash
  const pendingListenersRef = useRef<Set<string>>(new Set());

  // Codex parallel listener tracking — SEPARATE from Claude refs (do not share)
  const activeCodexListenersRef = useRef<Map<string, () => void>>(new Map());
  const pendingCodexListenersRef = useRef<Set<string>>(new Set());
  // Per-session monotonic counter for text_delta seq numbers (distinct message ids)
  const codexSeqCountersRef = useRef<Map<string, number>>(new Map());
  // Latest usage snapshot per in-flight Codex turn (keyed by sessionKey); self-clears on terminal events
  const codexLastUsageRef = useRef<Map<string, { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number; cost: number | null }>>(new Map());

  // 🦆 EVENT BUFFER FIX: Buffer events that arrive before the streaming message is ready
  // This fixes the intermittent bug where Task/droid widgets don't appear because
  // the event arrives before React's setState has created the streaming message
  const eventBufferRef = useRef<Map<string, BufferedClaudeEvent[]>>(new Map());
  // Brain: fix-late-render-abort-stale-buffer
  // Track the active turnId per session so handleClaudeEvent can reject stale events
  // from aborted/completed queries that arrive after a new turn starts.
  const activeQueryIdRef = useRef<Map<string, string>>(new Map());
  const abortedTurnIdsRef = useRef<Map<string, Set<string>>>(new Map());

  // 🦆 DIAGNOSTIC: Ring buffer to capture event flow for intermittent late-render bug.
  // Near-zero overhead: just pushes small objects to a capped array.
  // Dumped to console only when anomaly is detected at send time.
  const eventDiagnosticsRef = useRef<Array<{
    t: number; key: string; type: string; evtCount: number; lastStatus: string;
  }>>([]);


  // 🦆 SESSION-FIRST: Map agentId → active sessionId/messageKey
  // When streaming, events come with agentId but we need to write to the correct sessionId
  // This ref tracks which messageKey (sessionId or agentId) is currently active for each agent
  const activeMessageKeyRef = useRef<Map<string, string>>(new Map());

  // Agent Chat Settings - persistent configuration per agent
  const [agentChatSettings, setAgentChatSettings] = useState<Map<string, AgentChatSettings>>(new Map());

  // Task Input Drafts - isolated input state per task ID (fixes input bleeding between tasks)
  const [taskInputDrafts, setTaskInputDrafts] = useState<Map<string, string>>(new Map());

  // Usage tracking - cost and token usage from Claude Agent SDK
  const [usageSessions, setUsageSessions] = useState<SessionUsage[]>([]);

  // Token tracking per agent - cumulative session tokens for UI display
  const [chatTokensMap, setChatTokensMap] = useState<Map<string, {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalCost: number; // total_cost_usd from Claude SDK result message
    overhead?: number; // Dynamic overhead calculated from project files
    // Brain: gotcha-stamina-overhead-static-estimate
    promptTokens?: number; // Precise prompt token count from countTokens API
    measuredOverhead?: number; // Precise overhead = contextWindowFill - promptTokens (first turn only)
    contextWindow?: number; // Context window size from SDK modelUsage (200k or 1M, e.g., 1M for Opus)
    // Brain: sdk-get-context-usage-breakdown
    contextUsageBreakdown?: ContextUsageCategory[]; // Per-category breakdown from getContextUsage()
  }>>(new Map());

  // Project overhead cache - maps cwd to calculated overhead
  // Calculated once per project when agent is activated
  const [projectOverheadCache, setProjectOverheadCache] = useState<Map<string, number>>(new Map());

  // Session ID tracking per agent - for resuming sessions in terminal
  const [chatSessionIds, setChatSessionIds] = useState<Map<string, string>>(new Map());

  // 🗣️ AskUserQuestion state - track pending and answered questions per agent
  const [pendingQuestionIdsMap, setPendingQuestionIdsMap] = useState<Map<string, Set<string>>>(new Map());
  const [answeredQuestionsMap, setAnsweredQuestionsMap] = useState<Map<string, Map<string, AskUserQuestionAnswers>>>(new Map());

  // Brain: fix-memory-leak-14gb-ram — cap messages per session to prevent unbounded growth
  const MAX_MESSAGES_PER_SESSION = 500;
  // Auto-trim: cap messages per session to prevent unbounded memory growth
  // Runs after any setChatSessions update — catches ALL code paths with zero refactoring risk
  useEffect(() => {
    let needsTrim = false;
    for (const [, messages] of chatSessions) {
      if (messages.length > MAX_MESSAGES_PER_SESSION) { needsTrim = true; break; }
    }
    if (!needsTrim) return;
    setChatSessions(prev => {
      const trimmed = new Map(prev);
      for (const [key, messages] of trimmed) {
        if (messages.length > MAX_MESSAGES_PER_SESSION) {
          trimmed.set(key, messages.slice(-MAX_MESSAGES_PER_SESSION));
        }
      }
      return trimmed;
    });
  }, [chatSessions]);

  // Keep chatSessionsRef in sync for synchronous access in beforeunload and result-event handlers
  useEffect(() => {
    chatSessionsRef.current = chatSessions;
  }, [chatSessions]);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  // 🦆 SESSION BACKUP: Flush active session messages to localStorage on app close.
  // Only the active session is flushed here — other sessions are covered by the
  // per-turn saveSessionBackup call in the result-event handler.
  useEffect(() => {
    const flush = () => {
      const sid = activeSessionIdRef.current;
      if (!sid) return;
      const messages = chatSessionsRef.current.get(sid);
      if (messages && messages.length > 0) {
        saveSessionBackup(sid, messages);
      }
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
    };
  }, []);

  // Clean up stale localStorage backups on startup (older than 7 days)
  useEffect(() => {
    cleanupOldBackups();
  }, []);

  // Brain: fix-memory-leak-14gb-ram
  // Centralized cleanup: remove ALL data associated with an agent from every Map/Ref
  const cleanupAgentData = useCallback((agentId: string) => {
    // Abort active streams first
    abortControllersRef.current.forEach((ctrl, key) => {
      if (key.startsWith(agentId)) { ctrl.abort(); abortControllersRef.current.delete(key); }
    });
    // Unlisten Tauri events
    const unlisten = activeListenersRef.current.get(agentId);
    if (unlisten) { try { unlisten(); } catch { /* ignore */ } activeListenersRef.current.delete(agentId); }
    const unlistenCodex = activeCodexListenersRef.current.get(agentId);
    if (unlistenCodex) { try { unlistenCodex(); } catch { /* ignore */ } activeCodexListenersRef.current.delete(agentId); }
    // Clear timers
    for (const timerMap of [idleTimersRef.current, notificationTimersRef.current, visualIdleTimersRef.current]) {
      const timer = timerMap.get(agentId);
      if (timer) { clearTimeout(timer); timerMap.delete(agentId); }
    }
    // Clear refs
    pendingListenersRef.current.delete(agentId);
    pendingCodexListenersRef.current.delete(agentId);
    codexSeqCountersRef.current.delete(agentId);
    eventBufferRef.current.delete(agentId);
    activeQueryIdRef.current.delete(agentId);
    abortedTurnIdsRef.current.delete(agentId);
    activeMessageKeyRef.current.delete(agentId);
    lastPromptsRef.current.delete(agentId);
    agentMetadataRef.current.delete(agentId);
    lastAgentResponseRef.current.delete(agentId);
    activeStreamsRef.current.delete(agentId);
    outputBuffersRef.current.delete(agentId);
    resumingSessionsRef.current.delete(agentId);
    // Clear state Maps
    setChatSessions(prev => { const m = new Map(prev); m.delete(agentId); return m; });
    setChatLoadingMap(prev => { const m = new Map(prev); m.delete(agentId); return m; });
    setChatTokensMap(prev => { const m = new Map(prev); m.delete(agentId); return m; });
    setChatSessionIds(prev => { const m = new Map(prev); m.delete(agentId); return m; });
    setPendingQuestionIdsMap(prev => { const m = new Map(prev); m.delete(agentId); return m; });
    setAnsweredQuestionsMap(prev => { const m = new Map(prev); m.delete(agentId); return m; });
    setAgentChatSettings(prev => { const m = new Map(prev); m.delete(agentId); return m; });
    setTaskInputDrafts(prev => { const m = new Map(prev); m.delete(agentId); return m; });
    setProjectOverheadCache(prev => { const m = new Map(prev); m.delete(agentId); return m; });
    setModifiedFiles(prev => { const m = new Map(prev); m.delete(agentId); return m; });
    setFileEditsMap(prev => { const m = new Map(prev); m.delete(agentId); return m; });
  }, []);

  // 🦆 Session message sync - sync messageCount from chatSessions to sessionStore
  useSessionMessageSync({
    chatSessions,
    activeSessionId,
  });

  // 🦆 KANBAN SYNC: Emit loading state to popout windows for real-time sync
  // LIGHTWEIGHT: Only triggers when chatLoadingMap changes (not during streaming)
  // This enables the Kanban popout to show "Working"/"Ready" status
  useEffect(() => {
    emitLoadingState(chatLoadingMap);
  }, [chatLoadingMap, emitLoadingState]);

  // 🦆 SESSIONS-FIRST: Sync chatLoadingMap with chatStore for activity indicators
  // AgentSessionList reads from chatStore, so we need to keep it in sync
  const chatStoreSetLoading = useChatStore((state) => state.setLoading);
  useEffect(() => {
    chatLoadingMap.forEach((isLoading, sessionId) => {
      chatStoreSetLoading(sessionId, isLoading);
    });
  }, [chatLoadingMap, chatStoreSetLoading]);

  // 🦆 SESSIONS-FIRST: Sync pendingQuestionsMap with chatStore for "awaiting response" indicator
  // AgentSessionList reads from chatStore to show purple dot with "?" when session needs user input
  // 🦆 FIX: Now uses sessionId as the key (not agentId) to show "?" only on the specific session
  const chatStoreSetPendingQuestion = useChatStore((state) => state.setPendingQuestion);
  const chatStoreClearPendingQuestions = useChatStore((state) => state.clearPendingQuestions);
  useEffect(() => {
    // Build a set of keys (sessionIds) that have pending questions
    const keysWithPending = new Set<string>();

    // For each session with pending questions, sync to chatStore using sessionId as key
    pendingQuestionIdsMap.forEach((pendingSet, key) => {
      if (pendingSet.size > 0) {
        keysWithPending.add(key);
        // Sync each pending question to the store (using sessionId/key)
        pendingSet.forEach((toolUseId) => {
          chatStoreSetPendingQuestion(key, toolUseId, true);
        });
      }
    });

    // Clear pending questions for sessions that no longer have any
    // Get all known session IDs from agentSessions
    const allSessionIds = new Set(agentSessions.map((s) => s.id));
    // Also include agentIds for backwards compatibility with older events
    agentChats.forEach((a) => allSessionIds.add(a.id));

    allSessionIds.forEach((id) => {
      if (!keysWithPending.has(id)) {
        chatStoreClearPendingQuestions(id);
      }
    });
  }, [pendingQuestionIdsMap, agentChats, agentSessions, chatStoreSetPendingQuestion, chatStoreClearPendingQuestions]);

  // Brain: 005-performance-critical-refactor
  // Sync chatSessions with chatStore using single setSession() instead of clearSession+addMessage*N
  const chatStoreSetSession = useChatStore((state) => state.setSession);
  const chatStoreGetSession = useChatStore((state) => state.getSession);
  useEffect(() => {
    chatSessions.forEach((messages, sessionId) => {
      const storeMessages = chatStoreGetSession(sessionId);
      const lastMsg = messages[messages.length - 1];
      const lastStoreMsg = storeMessages[storeMessages.length - 1];
      const needsSync =
        messages.length !== storeMessages.length ||
        (lastMsg && lastStoreMsg && lastMsg.status !== lastStoreMsg.status);

      if (needsSync) {
        // Single set() — was clearSession + addMessage*N (hundreds of Zustand set() calls/sec)
        chatStoreSetSession(sessionId, messages);
      }
    });
  }, [chatSessions, chatStoreSetSession, chatStoreGetSession]);

  // 🦆 KANBAN SYNC: Emit task changes to popout windows
  // Track previous tasks to detect actual changes (not just re-renders)
  // 🦆 SESSIONS-FIRST: Use agentSessions as source of truth
  const prevKanbanTasksRef = useRef<string>('');
  useEffect(() => {
    const currentFingerprint = agentSessions
      .map(s => `${s.id}:${s.status}`)
      .sort()
      .join(',');
    if (currentFingerprint !== prevKanbanTasksRef.current) {
      prevKanbanTasksRef.current = currentFingerprint;
      if (agentSessions.length > 0 || prevKanbanTasksRef.current !== '') {
        emitTasksChanged('update');
      }
    }
  }, [agentSessions, emitTasksChanged]);

  // 🦆 STAMINA FIX: Centralized token tracking helper to avoid code duplication
  // This function is called from all event listeners (Multi-Listener, Pre-warm, ensureListenerReady)
  const handleTokenUpdate = useCallback((
    agentId: string,
    usage: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number },
    totalCostUsd?: number // total_cost_usd from result message (authoritative)
  ) => {
    setChatTokensMap((prev) => {
      const newMap = new Map(prev);
      const currentTokens = newMap.get(agentId) || {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
        totalCost: 0,
      };

      // IMPORTANT: With prompt caching, usage.input_tokens only contains NON-CACHED tokens.
      // The real context window fill = input_tokens + cache_read + cache_creation.
      // See: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
      // "input_tokens: Number of input tokens which were not read from or used to create a cache"
      const cacheRead = usage.cache_read_input_tokens || 0;
      const cacheCreation = usage.cache_creation_input_tokens || 0;
      const contextWindowFill = usage.input_tokens + cacheRead + cacheCreation;

      // Brain: gotcha-stamina-overhead-static-estimate
      // Calculate measuredOverhead from countTokens API data (precise, not estimated).
      // On the first turn of a new session: overhead = contextWindowFill - promptTokens
      // Once measured, cache it for all subsequent turns in this session.
      let measuredOverhead = currentTokens.measuredOverhead;
      if (!measuredOverhead && currentTokens.promptTokens && contextWindowFill > 0) {
        measuredOverhead = Math.max(0, contextWindowFill - currentTokens.promptTokens);
        console.log(`[Token Tracking] 🎯 PRECISE overhead measured: ${measuredOverhead} (contextFill=${contextWindowFill} - promptTokens=${currentTokens.promptTokens})`);
      }

      const updatedTokens = {
        inputTokens: contextWindowFill,
        outputTokens: usage.output_tokens,
        cacheCreationTokens: cacheCreation,
        cacheReadTokens: cacheRead,
        // total_cost_usd is cumulative from SDK, so we just set it (not add)
        totalCost: totalCostUsd ?? currentTokens.totalCost,
        // Preserve countTokens data
        promptTokens: currentTokens.promptTokens,
        measuredOverhead,
        // Preserve contextWindow from previous result event so stamina bar stays visible between turns
        contextWindow: currentTokens.contextWindow,
      };

      newMap.set(agentId, updatedTokens);

      const total = updatedTokens.inputTokens + updatedTokens.outputTokens +
                   updatedTokens.cacheCreationTokens + updatedTokens.cacheReadTokens;
      console.log(`[Token Tracking] 🦆 Accumulated tokens for agent ${agentId}: ${total} total, cost: $${updatedTokens.totalCost.toFixed(4)}`, updatedTokens);

      // 🦆 STAMINA PRESERVATION: Update agentChats with new token counts
      setAgentChats((prevChats) => {
        return prevChats.map((agent) => {
          if (agent.id === agentId) {
            return {
              ...agent,
              inputTokens: updatedTokens.inputTokens,
              outputTokens: updatedTokens.outputTokens,
              cacheCreationTokens: updatedTokens.cacheCreationTokens,
              cacheReadTokens: updatedTokens.cacheReadTokens,
            };
          }
          return agent;
        });
      });

      return newMap;
    });
  }, []);

  // 🦆 EVENT BUFFER FIX: Centralized event handler with buffering support
  // This function handles all incoming Claude events and manages buffering
  // when events arrive before the streaming message is ready
  // 🦆 SESSION-FIRST: Events now arrive WITH sessionKey from Rust backend
  const handleClaudeEvent = useCallback((
    agentId: string,
    claudeEvent: ClaudeEvent,
    source: string, // For debugging: 'Multi-Listener', 'Pre-warm', 'ensureListenerReady'
    sessionKey?: string, // 🦆 SESSION-FIRST: sessionKey from Rust event wrapper
    turnId?: string, // Frontend-generated turn ID echoed back from Rust for per-turn isolation
  ) => {
    const evt = claudeEvent as any;

    // 🦆 SESSION-FIRST FIX: STRICT session isolation - NEVER fallback to agentId
    // If sessionKey is missing, log error and reject the event to prevent mixing
    if (!sessionKey) {
      console.error(`🚨 [${source}] REJECTED event without sessionKey! agentId=${agentId}, type=${claudeEvent.type}. This would cause session mixing.`);
      return; // REJECT event - do not write to any session
    }
    const messageKey = sessionKey;
    const abortedTurnIds = abortedTurnIdsRef.current.get(messageKey);

    // Brain: fix-late-render-abort-stale-buffer
    // Reject events from stale queries. When a new turn starts, sendMessageForAgent
    // sets activeQueryIdRef to a new turnId and passes it to Rust. Rust echoes it back
    // in every event. Events carrying a different turnId are from old/aborted queries
    // and must be discarded — otherwise they get applied to the new streaming placeholder.
    const activeTurnId = activeQueryIdRef.current.get(messageKey);
    if (shouldRejectClaudeEvent(activeTurnId, turnId, abortedTurnIds)) {
      if (turnId && abortedTurnIds?.has(turnId)) {
        console.log(`🦆 [${source}] REJECTED aborted-turn event for messageKey=${messageKey}: turnId=${turnId.slice(0, 20)}`);
      } else {
        console.log(`🦆 [${source}] REJECTED stale event for messageKey=${messageKey}: event turnId=${turnId!.slice(0, 20)} !== active ${activeTurnId!.slice(0, 20)}`);
      }
      return;
    }

    // Tag system/init events as resumed to hide redundant header + init widget
    if (evt.type === 'system' && evt.subtype === 'init' && resumingSessionsRef.current.has(messageKey)) {
      evt.isResumed = true;
      resumingSessionsRef.current.delete(messageKey);
    }

    // Brain: fix-session-reset-after-stop
    // Save claudeSessionId to session store IMMEDIATELY on system/init event.
    // Without this, if the user clicks Stop before the response completes,
    // the session store never gets the claudeSessionId (only saved on completion)
    // and the next message creates a brand new session instead of resuming.
    if (evt.type === 'system' && evt.subtype === 'init' && evt.session_id) {
      const { updateSession: updateSessionNow } = useSessionStore.getState();
      updateSessionNow(messageKey, { claudeSessionId: evt.session_id }).catch((err: Error) => {
        console.warn(`[handleClaudeEvent] Failed to save early claudeSessionId:`, err);
      });
      console.log(`[handleClaudeEvent] 🦆 Early save claudeSessionId ${evt.session_id.slice(0, 8)}... to session ${messageKey}`);
    }

    // Brain: fix-compact-not-triggering-sdk-native
    // When SDK compaction completes, reset token tracking so the stamina bar reflects
    // the post-compact context. The next message's usage data will provide accurate numbers.
    if (evt.type === 'system' && evt.subtype === 'compact_boundary') {
      const preTokens = evt.compact_metadata?.pre_tokens;
      console.log(`[handleClaudeEvent] 🗜️ Compact boundary for ${messageKey}: pre_tokens=${preTokens}`);
      setChatTokensMap((prev) => {
        const newMap = new Map(prev);
        const currentTokens = newMap.get(messageKey);
        if (currentTokens) {
          newMap.set(messageKey, {
            ...currentTokens,
            inputTokens: 0,
            outputTokens: 0,
            cacheCreationTokens: 0,
            cacheReadTokens: 0,
            // Preserve cumulative cost and context window
            totalCost: currentTokens.totalCost,
            contextWindow: currentTokens.contextWindow,
          });
        }
        return newMap;
      });
    }

    console.log(`🎯 [${source}] Event received for agentId=${agentId}, writing to messageKey=${messageKey}:`, {
      type: claudeEvent.type,
      hasMessage: !!evt.message,
      sessionKeyFromEvent: sessionKey,
      contentTypes: Array.isArray(evt.message?.content) ? evt.message.content.map((c: any) => ({ type: c.type, name: c.name })) : undefined,
    });

    // Intercept Agent events for Team teammate tracking
    if (claudeEvent.type === 'agent') {
      const agentEvt = claudeEvent as any;
      const teamState = useTeamStore.getState();
      if (teamState.activeTeam && agentEvt.agent_name) {
        if (agentEvt.action === 'start') {
          teamState.updateTeammateStatus(agentEvt.agent_name, 'active', agentEvt.session_id);
        } else if (agentEvt.action === 'stop') {
          teamState.updateTeammateStatus(agentEvt.agent_name, 'stopped', agentEvt.session_id);
        }
      }
    }

    // 🦆 DIAGNOSTIC: Record event arrival for late-render bug investigation
    {
      const diag = eventDiagnosticsRef.current;
      diag.push({ t: Date.now(), key: messageKey, type: claudeEvent.type, evtCount: -1, lastStatus: '' });
      if (diag.length > 50) diag.splice(0, diag.length - 50);
    }

    // Update chat session with incoming events using messageKey
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      const sessionMessages = newSessions.get(messageKey) ?? [];
      const lastMsg = sessionMessages[sessionMessages.length - 1];
      const bufferedEvents = eventBufferRef.current.get(messageKey) || [];

      // 🦆 DIAGNOSTIC: Enrich the last ring buffer entry with actual state
      {
        const diag = eventDiagnosticsRef.current;
        const last = diag[diag.length - 1];
        if (last) {
          last.evtCount = lastMsg?.events?.length ?? 0;
          last.lastStatus = lastMsg?.status ?? 'none';
        }
      }

      const routedEvent = routeClaudeEventToSession({
        sessionMessages,
        bufferedEvents,
        claudeEvent,
        turnId,
      });

      if (routedEvent.bufferedEvents.length > 0) {
        eventBufferRef.current.set(messageKey, routedEvent.bufferedEvents);
      } else {
        eventBufferRef.current.delete(messageKey);
      }

      if (routedEvent.action === 'applied') {
        if (routedEvent.flushedBufferedCount > 0) {
          console.log(`🦆 [${source}] Flushing ${routedEvent.flushedBufferedCount} buffered events for messageKey=${messageKey}`);
        }
        if (routedEvent.discardedBufferedCount > 0) {
          console.log(`🦆 [${source}] Discarded ${routedEvent.discardedBufferedCount} stale buffered events for messageKey=${messageKey}`);
        }

        newSessions.set(messageKey, routedEvent.sessionMessages);

        // Extract text content for Telegram notifications
        if (claudeEvent.type === 'assistant' && claudeEvent.message?.content) {
          let textContent = '';
          claudeEvent.message.content.forEach((content) => {
            if (content.type === 'text' && content.text) {
              textContent += content.text;
            }
          });

          if (textContent) {
            // 🦆 SESSION-FIRST: Use messageKey for response tracking per-session
            const existingText = lastAgentResponseRef.current.get(messageKey) || '';
            lastAgentResponseRef.current.set(messageKey, existingText + textContent);
          }
        }
      } else {
        // 🦆 BUFFER: No streaming message yet - buffer the event for later
        // 🦆 SESSION-FIRST: Use messageKey for buffer (parallel sessions need separate buffers)
        console.log(`🦆 [${source}] Buffering event for messageKey=${messageKey} (no streaming message ready yet)`);
      }

      return newSessions;
    });


    // 🦆 CONTEXT FILL FIX: Track usage from ASSISTANT events (per-step, real context fill)
    // Assistant message usage is per-API-call, so input_tokens + cache_read + cache_creation
    // = actual context window fill for that call. This is what `/context` shows.
    // Result event usage is CUMULATIVE across all steps — not suitable for context fill display.
    if (claudeEvent.type === 'assistant') {
      const assistantEvt = claudeEvent as any;
      const msgUsage = assistantEvt.message?.usage;
      if (msgUsage && (msgUsage.input_tokens > 0 || msgUsage.cache_read_input_tokens > 0)) {
        console.log(`[${source}] 🦆 Assistant message usage (per-step) for messageKey=${messageKey}:`, msgUsage);
        handleTokenUpdate(messageKey, {
          input_tokens: msgUsage.input_tokens || 0,
          output_tokens: msgUsage.output_tokens || 0,
          cache_creation_input_tokens: msgUsage.cache_creation_input_tokens || 0,
          cache_read_input_tokens: msgUsage.cache_read_input_tokens || 0,
        });

        // 📊 Project stats: record per-step usage with full agent attribution.
        // Idempotent on (sessionId, messageId) — Anthropic message ids are unique.
        // IMPORTANT: handleClaudeEvent is memoized with `[handleTokenUpdate]` deps,
        // so we can't read `terminals` / `agentSessions` from closure (stale).
        // Use `terminalsRef.current` and `useSessionStore.getState()` for fresh state.
        // Brain: decision-project-token-stats-sqlite
        // Brain: gotcha-delayed-agent-message-stale-closure
        const messageId = assistantEvt.message?.id;
        const session = useSessionStore.getState().sessions.find((s) => s.id === messageKey);
        const terminal = terminalsRef.current.find((t) => t.id === agentId);
        const projectPath = session?.projectPath || terminal?.cwd || '';
        if (projectPath && messageId) {
          const sessionId =
            session?.claudeSessionId || assistantEvt.session_id || messageKey;
          const projectName =
            session?.projectName ||
            projectPath.replace(/\\/g, '/').replace(/\/+$/, '').split('/').filter(Boolean).pop() ||
            'Unknown';
          const agentName = terminal?.label || session?.title || 'Unknown agent';
          const agentRole = (terminal?.personality as { role?: string } | undefined)?.role || null;
          const provider = useSettingsStore.getState().claude.provider || 'anthropic';
          void useProjectStatsStore.getState().recordUsage({
            sessionId,
            messageId,
            projectPath,
            projectName,
            provider,
            model: assistantEvt.message?.model || 'unknown',
            inputTokens: msgUsage.input_tokens || 0,
            outputTokens: msgUsage.output_tokens || 0,
            cacheCreationTokens: msgUsage.cache_creation_input_tokens || 0,
            cacheReadTokens: msgUsage.cache_read_input_tokens || 0,
            agentId: agentId || null,
            agentName,
            agentRole,
          });
        }
      }
    }

    // Brain: gotcha-stamina-overhead-static-estimate
    // Handle prompt_token_count events: store precise prompt token count from countTokens API.
    // On the first assistant event with usage, we calculate:
    //   measuredOverhead = contextWindowFill - promptTokens
    // This gives a PRECISE overhead measurement, replacing the static estimate.
    if (claudeEvent.type === 'prompt_token_count') {
      const promptTokens = claudeEvent.promptTokens;
      if (promptTokens && promptTokens > 0) {
        console.log(`[${source}] 🎯 Precise prompt token count for messageKey=${messageKey}: ${promptTokens}`);
        setChatTokensMap((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(messageKey) || {
            inputTokens: 0, outputTokens: 0,
            cacheCreationTokens: 0, cacheReadTokens: 0, totalCost: 0,
          };
          newMap.set(messageKey, { ...current, promptTokens });
          return newMap;
        });
      }
      return; // Don't process further — this is a custom Quack event, not an SDK event
    }

    // Brain: sdk-get-context-usage-breakdown
    // Handle context_usage_breakdown events: per-category token breakdown from getContextUsage()
    // Provides precise overhead measurement replacing static estimate.
    if (claudeEvent.type === 'context_usage_breakdown') {
      const breakdownEvt = claudeEvent as any;
      if (breakdownEvt.categories && breakdownEvt.categories.length > 0) {
        console.log(`[${source}] 📊 Context usage breakdown for messageKey=${messageKey}: ${breakdownEvt.totalTokens}/${breakdownEvt.maxTokens} (${breakdownEvt.percentage?.toFixed(1)}%)`, breakdownEvt.categories);
        setChatTokensMap((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(messageKey) || {
            inputTokens: 0, outputTokens: 0,
            cacheCreationTokens: 0, cacheReadTokens: 0, totalCost: 0,
          };
          // Store breakdown categories for display in TokenUsageModal
          newMap.set(messageKey, {
            ...current,
            contextUsageBreakdown: breakdownEvt.categories,
            // Use SDK-reported values as authoritative context window and total
            ...(breakdownEvt.maxTokens > 0 ? { contextWindow: breakdownEvt.maxTokens } : {}),
          });
          return newMap;
        });
      }
      return; // Custom Quack event, don't process further
    }

    // Handle result events: update total_cost_usd and PERSIST tokens to disk
    // DO NOT overwrite inputTokens from result event — result usage is CUMULATIVE across all
    // agentic steps, while assistant message usage (above) is per-step and accurate for context fill.
    if (claudeEvent.type === 'result') {
      const resultEvt = claudeEvent as any;

      // 📊 Project stats: turn ended → refresh per-agent breakdown so the
      // accordion panel reflects the usage just recorded during this turn.
      // Use refs / zustand getState to avoid stale closure (see deps at L1895).
      // Brain: decision-project-token-stats-sqlite
      {
        const session = useSessionStore.getState().sessions.find((s) => s.id === messageKey);
        const terminal = terminalsRef.current.find((t) => t.id === agentId);
        const projectPath = session?.projectPath || terminal?.cwd || '';
        if (projectPath) {
          void useProjectStatsStore
            .getState()
            .refreshProjectAgents(projectPath)
            .catch(() => {
              /* non-fatal: UI stays on previous cache until next turn */
            });
        }
      }

      // Extract context window size from modelUsage in result event.
      // Note: Rust serde serializes as "modelUsage" (camelCase) due to #[serde(rename = "modelUsage")]
      // modelUsage is a Record<modelId, { contextWindow, costUSD, ... }>
      //
      // Brain: sdk-context-window-native-cli
      // The context window value comes from the CLI binary the SDK spawns.
      // When using the native CLI (~/.local/bin/claude), it correctly reports 1M for Opus 4.6 / Sonnet 4.6.
      // When using the SDK's bundled cli.js, it reports 200k. We trust the SDK's reported value
      // because it reflects the actual compaction threshold — showing a higher value would be misleading.
      let contextWindow: number | undefined;
      const modelUsage = resultEvt.modelUsage || resultEvt.model_usage;
      if (modelUsage) {
        for (const entry of Object.values(modelUsage) as any[]) {
          if (entry.contextWindow > 0) {
            contextWindow = Math.max(contextWindow ?? 0, entry.contextWindow);
          }
        }
        if (contextWindow) {
          console.log(`[${source}] 🦆 Context window from SDK modelUsage: ${contextWindow}`);
        }
      }

      if (resultEvt.total_cost_usd != null || contextWindow) {
        if (resultEvt.total_cost_usd != null) {
          console.log(`[${source}] 🦆 Result event cost update for messageKey=${messageKey}: $${resultEvt.total_cost_usd}`);
        }
        if (contextWindow) {
          const modelNames = modelUsage ? Object.keys(modelUsage).join(', ') : 'unknown';
          console.log(`[${source}] 🦆 Context window from SDK: ${contextWindow} tokens (models: ${modelNames})`, modelUsage);
        }
        setChatTokensMap((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(messageKey);
          if (current) {
            const updated = {
              ...current,
              ...(resultEvt.total_cost_usd != null && { totalCost: resultEvt.total_cost_usd }),
              ...(contextWindow ? { contextWindow } : {}),
            };
            newMap.set(messageKey, updated);

            // 🦆 STAMINA PERSISTENCE: Save tokens to sessionStore for survival across app restarts
            // We persist here (result event = end of turn) to avoid excessive disk writes
            useSessionStore.getState().updateSession(messageKey, {
              inputTokens: updated.inputTokens,
              outputTokens: updated.outputTokens,
              cacheCreationTokens: updated.cacheCreationTokens,
              cacheReadTokens: updated.cacheReadTokens,
              totalCost: updated.totalCost,
              ...(updated.contextWindow ? { contextWindow: updated.contextWindow } : {}),
            });
          }
          return newMap;
        });
      }

      // 🦆 SESSION BACKUP: Persist messages to localStorage at end of turn
      // Same frequency as token persistence above — once per turn, no excessive writes.
      // Read from ref (synced at line ~1197) — avoids a no-op setChatSessions updater
      // that was causing spurious React state update cycles and QuotaExceededError spam.
      const backupMsgs = chatSessionsRef.current.get(messageKey);
      if (backupMsgs && backupMsgs.length > 0) {
        saveSessionBackup(messageKey, backupMsgs);
      }

      // Brain: fix-memory-leak-14gb-ram
      // Session-end cleanup: free temporary buffers that are no longer needed.
      // NOTE: name is `bufferKey` (not `agentId`) — a const named `agentId` here
      // would shadow the outer parameter and TDZ-throw at the `.find` ~L1728.
      const bufferKey = activeMessageKeyRef.current.get(messageKey) || messageKey;
      outputBuffersRef.current.delete(bufferKey);
      outputBuffersRef.current.delete(messageKey);
      activeMessageKeyRef.current.delete(bufferKey);
    }
  }, [handleTokenUpdate]);

  // Track usage from Claude Agent SDK response
  const trackUsage = useCallback((
    agentId: string,
    agentName: string,
    sessionId: string,
    totalCostUsd: number,
    usage?: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }
  ) => {
    const now = Date.now();

    // Save session ID for this agent (for terminal resume)
    setChatSessionIds((prev) => {
      const newMap = new Map(prev);
      newMap.set(agentId, sessionId);
      return newMap;
    });

    // 🦆 SESSION PERSISTENCE: Save session ID in AgentChat for persistence across app restarts
    setAgentChats((prev) => {
      return prev.map((agent) => {
        if (agent.id === agentId) {
          return {
            ...agent,
            sessionId: sessionId,
          };
        }
        return agent;
      });
    });

    setUsageSessions((prev) => {
      const existingSession = prev.find((s) => s.session_id === sessionId);

      if (existingSession) {
        // Update existing session
        return prev.map((s) =>
          s.session_id === sessionId
            ? {
                ...s,
                last_updated: now,
                total_cost_usd: totalCostUsd,
                step_count: s.step_count + 1,
                usage: usage || s.usage,
              }
            : s
        );
      } else {
        // Create new session
        const newSession: SessionUsage = {
          session_id: sessionId,
          agent_name: agentName,
          started_at: now,
          last_updated: now,
          total_cost_usd: totalCostUsd,
          step_count: 1,
          usage: usage || {
            input_tokens: 0,
            output_tokens: 0,
            cache_creation_input_tokens: 0,
            cache_read_input_tokens: 0,
          },
        };
        // Brain: fix-memory-leak-14gb-ram — cap usage sessions to prevent unbounded growth
        const updated = [...prev, newSession];
        return updated.length > 100 ? updated.slice(-100) : updated;
      }
    });

    // NOTE: chatTokensMap is now updated via claude-event listener with message ID de-duplication
    // No need to update it here to avoid incorrect behavior
  }, []);

  // Clear all usage data
  const handleClearUsage = useCallback(() => {
    setUsageSessions([]);
  }, []);

  // Initialize chat on mount
  useEffect(() => {
    if (tauriAvailable) {
      // Since we now use Claude Agent SDK (Node.js) instead of CLI,
      // we can assume chat is always configured. Errors will be handled
      // at runtime if Node.js SDK is not available.
      setIsChatConfigured(true);

      // Load OpenAI API key for Whisper
      invoke<string | null>('get_ai_api_key')
        .then((savedKey) => {
          if (savedKey) {
            const decoded = atob(savedKey);
            setOpenaiApiKey(decoded);
            console.log('[OpenAI] API key loaded successfully');
          } else {
            console.log('[OpenAI] No API key found');
          }
        })
        .catch((err) => {
          console.error('[OpenAI] Failed to load API key:', err);
        });
    }
  }, [tauriAvailable]);

  // Load available droids for @mention invocation when working directory changes
  useEffect(() => {
    const workingDir = activeTerminal?.cwd || explorerPath;
    if (!workingDir) {
      setAvailableDroids([]);
      return;
    }

    console.log('[Droids] Loading available droids for:', workingDir);
    loadAvailableDroids(workingDir)
      .then((droids) => {
        console.log('[Droids] Loaded', droids.length, 'droids:', droids.map(d => d.name));
        setAvailableDroids(droids);
      })
      .catch((err) => {
        console.error('[Droids] Failed to load droids:', err);
        setAvailableDroids([]);
      });
  }, [activeTerminal?.cwd, explorerPath]);

  // Calculate project overhead when working directory changes
  // This is a lightweight operation (~5-10ms) that reads CLAUDE.md files and .mcp.json
  useEffect(() => {
    const workingDir = activeTerminal?.cwd || explorerPath;
    if (!workingDir || !tauriAvailable) {
      return;
    }

    // Skip if already calculated for this directory
    if (projectOverheadCache.has(workingDir)) {
      return;
    }

    console.log('[Overhead] Calculating project overhead for:', workingDir);

    // Helper to read file content via Tauri
    const readFileContent = async (path: string): Promise<string> => {
      try {
        return await invoke<string>('read_file_content', { path });
      } catch {
        return '';
      }
    };

    // Get home directory and calculate overhead
    (async () => {
      try {
        const homePath = await invoke<string>('get_home_directory');
        const overhead = await calculateProjectOverhead(workingDir, homePath, readFileContent);

        console.log('[Overhead] Calculated overhead for', workingDir, ':', overhead);

        setProjectOverheadCache(prev => {
          const newMap = new Map(prev);
          newMap.set(workingDir, overhead.total);
          return newMap;
        });
      } catch (err) {
        console.error('[Overhead] Failed to calculate overhead:', err);
        // Keep default overhead (38k) if calculation fails
      }
    })();
  }, [activeTerminal?.cwd, explorerPath, tauriAvailable, projectOverheadCache]);

  // Update project context when active terminal changes
  useEffect(() => {
    if (!activeTerminal || !tauriAvailable) {
      setProjectName('');
      setGitBranch('');
      return;
    }

    // Extract project name from cwd (last folder in path)
    const cwd = activeTerminal.cwd || '';
    const project = extractProjectId(cwd) || '';
    setProjectName(project);

    // 🦆 BRANCH-PER-SESSION: If session has explicit branch, use that instead of agent's
    const activeSession = activeSessionId
      ? useSessionStore.getState().sessions.find(s => s.id === activeSessionId)
      : null;

    if (activeSession?.branch) {
      setGitBranch(activeSession.branch);
    } else if (activeTerminal.branch) {
      // Use the branch associated with this terminal (agent workspace)
      setGitBranch(activeTerminal.branch);
    } else {
      // Fallback: Get current git branch from disk if no branch is assigned
      invoke<string>('git_current_branch', { rootPath: cwd })
        .then((branch) => {
          // Re-check session branch to avoid race condition with async resolution
          const currentSession = activeSessionId
            ? useSessionStore.getState().sessions.find(s => s.id === activeSessionId)
            : null;
          if (!currentSession?.branch) {
            setGitBranch(branch.trim());
          }
        })
        .catch(() => {
          setGitBranch(''); // Not a git repository or error
        });
    }

    // Start git branch watcher for this project (idempotent — safe to call repeatedly)
    if (cwd) {
      invoke('start_git_branch_watcher', { projectPath: cwd }).catch(() => {
        // Not a git repo or watcher failed — silent
      });
    }
  }, [activeTerminal, tauriAvailable, activeSessionId]);

  // 🦆 BRANCH-PER-SESSION: Override gitBranch when active session has explicit branch
  // Brain: bug-stale-branch-indicator-after-checkout
  // Also propagate session branch to the terminal so the sidebar groups agents correctly.
  useEffect(() => {
    if (!activeSessionId) return;
    const session = useSessionStore.getState().sessions.find(s => s.id === activeSessionId);
    if (session?.branch) {
      setGitBranch(session.branch);
      // Update the terminal's branch so RepositoryGroup sidebar shows it correctly
      setTerminals((prev) =>
        prev.map((t) =>
          t.id === session.agentId ? { ...t, branch: session.branch } : t
        )
      );
    }
  }, [activeSessionId]);

  // Listen for real-time git branch changes from file watcher
  useEffect(() => {
    if (!tauriAvailable) return;

    const unlistenPromise = listen<{ projectPath: string; branch: string }>(
      'git:branch-changed',
      (event) => {
        const { projectPath, branch } = event.payload;
        const activeCwd = activeTerminal?.cwd || '';

        // Update displayed branch if event matches the active terminal's project
        // But NOT if the active session has an explicit branch (session branch takes priority)
        if (activeCwd && projectPath === activeCwd) {
          const currentSession = activeSessionId
            ? useSessionStore.getState().sessions.find(s => s.id === activeSessionId)
            : null;
          if (!currentSession?.branch) {
            setGitBranch(branch);
          }
        }

        // Update branch on ALL terminals that share this project path (persistence)
        setTerminals((prev) =>
          prev.map((t) =>
            t.cwd === projectPath ? { ...t, branch } : t
          )
        );
      }
    );

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [tauriAvailable, activeTerminal?.cwd]);

  // Handle deep link file opening from Quack Inspector
  useDeepLinkHandler(
    useCallback(
      (payload) => {
        console.log('🦆 Opening file from deep link:', payload);
        // Open file preview with the provided path
        const fileName = payload.path.split('/').pop() || payload.path;
        setPreviewFile({ name: fileName, path: payload.path });
        setPreviewContent('');
        setPreviewError(null);
        // TODO: If line/column are provided, scroll to that position in the editor
        if (payload.line) {
          console.log(`🦆 TODO: Scroll to line ${payload.line}${payload.column ? `, column ${payload.column}` : ''}`);
        }
      },
      []
    )
  );

  // 🔵 Mark agent as "read" when it becomes active
  useEffect(() => {
    if (activeId) {
      setLastReadTimestamps((prev) => {
        const updated = new Map(prev);
        updated.set(activeId, Date.now());
        return updated;
      });
    }
  }, [activeId]);

  // Brain: fix-changes-panel-race-condition
  // Removed: useEffect reset on activeId was racing with ChatView's onEditsChange.
  // Parent effects fire AFTER child effects in React, so the reset was overwriting
  // the edits that ChatView had just populated. Now handleEditsChange does a full
  // REPLACE (not merge), so stale data is cleared automatically on session switch.

  // Brain: fix-office-status-dot-chatloadingmap-key-mismatch
  // Sync terminal status with chatLoadingMap and check if waiting for response.
  // chatLoadingMap is keyed by sessionId (not agentId), so we must look up
  // this agent's sessions to find the correct loading state.
  useEffect(() => {
    const allSessions = useSessionStore.getState().sessions;

    setTerminals((prev) => {
      return prev.map((terminal) => {
        // Find all session IDs belonging to this agent
        const agentSessionIds = allSessions
          .filter(s => s.agentId === terminal.id)
          .map(s => s.id);

        // Check loading by agentId (legacy) OR any of the agent's sessionIds
        const isLoading = chatLoadingMap.get(terminal.id) === true ||
          agentSessionIds.some(sid => chatLoadingMap.get(sid) === true);
        const newStatus = isLoading ? 'busy' : 'idle';

        // Check if chat is waiting for user response
        // Collect messages from all sessions for this agent
        let chatMessages: ChatMessage[] = [];
        for (const sid of agentSessionIds) {
          const msgs = chatSessions.get(sid);
          if (msgs && msgs.length > 0) {
            chatMessages = msgs; // Use the session with messages (prefer last)
          }
        }
        // Fallback: try by agentId (legacy keys)
        if (chatMessages.length === 0) {
          chatMessages = chatSessions.get(terminal.id) ?? [];
        }
        const lastMessage = chatMessages[chatMessages.length - 1];

        // Check if agent is dormant (no user interaction yet)
        const hasUserMessage = chatMessages.some(msg => msg.role === 'user');
        const isDormant = chatMessages.length === 0 || !hasUserMessage;

        const isWaitingForResponse =
          !isLoading && // Not currently loading
          chatMessages.length > 0 && // Has messages
          !isDormant && // 🚨 NOT dormant (don't show 💬 for agents without user interaction)
          lastMessage?.role === 'assistant' && // Last message is from assistant
          lastMessage?.status === 'complete'; // Message is complete

        // Only update if something actually changed to avoid unnecessary re-renders
        if (
          terminal.status === newStatus &&
          terminal.waitingForResponse === isWaitingForResponse
        ) {
          return terminal;
        }

        return {
          ...terminal,
          status: newStatus as 'busy' | 'idle',
          waitingForResponse: isWaitingForResponse,
        };
      });
    });
  }, [chatLoadingMap, chatSessions]);

  // Effect to save/restore tabs when switching between agents
  useEffect(() => {
    const previousId = previousActiveIdRef.current;

    // Save current tabs + split state for previous agent (if any)
    if (previousId && previousId !== activeId) {
      // Save split state
      if (splitTabId) {
        splitByAgentRef.current.set(previousId, splitTabId);
      } else {
        splitByAgentRef.current.delete(previousId);
      }

      setTabsByTerminal((prev) => {
        const updated = new Map(prev);
        // Filter out chat tab (always present) and special tabs - save only file tabs
        // Special tabs persist across agents and shouldn't be stored per-agent
        // Brain: fix-office-view-snaps-back-to-chat
        const specialTabTypes = [
          'kanban', 'docs', 'second-brain', 'memory-graph', 'claude-assets',
          'agent', 'skill', 'command', 'browser-manager', 'agent-terminal', 'chat',
          'office', 'automation'
        ];
        const agentTabs = tabs.filter(t => !specialTabTypes.includes(t.type));
        updated.set(previousId, agentTabs);
        return updated;
      });
    }

    // Restore tabs for new active agent
    if (activeId) {
      const restoredTabs = tabsByTerminal.get(activeId) || [];
      // console.log(`🦆 [Tab Management] Restoring tabs for agent: ${activeId}`, restoredTabs); // Performance: Disabled logging

      // 🦆 FIX: Preserve special tabs (kanban, docs, second-brain, memory-graph, etc.)
      // These tabs should persist across agent switches - they are not agent-specific
      // Brain: fix-office-view-snaps-back-to-chat
      const specialTabTypes = [
        'kanban', 'docs', 'second-brain', 'memory-graph', 'claude-assets',
        'agent', 'skill', 'command', 'browser-manager', 'agent-terminal',
        'office', 'automation'
      ];

      // Always include chat tab + restored agent tabs + preserve special tabs
      setTabs(prevTabs => {
        const specialTabs = prevTabs.filter(t => specialTabTypes.includes(t.type));
        const merged = [
          { id: 'chat', label: 'Chat', type: 'chat' as const, closable: false },
          ...restoredTabs,
          ...specialTabs,
        ];
        // Deduplicate by id (keep first occurrence)
        const seen = new Set<string>();
        const deduped = merged.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
        return deduped;
      });

      // 🦆 FIX: Don't change activeTabId if user is viewing a special tab
      // This prevents the "tab closes immediately" bug when opening Kanban
      const isSpecialTabActive = specialTabTypes.some(type =>
        activeTabId.includes(type) || activeTabId === 'kanban-board'
      );

      if (!isSpecialTabActive) {
        // Always activate chat tab when switching agents for consistent UX
        // Users expect to see the agent chat first, not the last visited tab
        setActiveTabId('chat');
      }

      // Restore split state for this agent
      const savedSplit = splitByAgentRef.current.get(activeId);
      setSplitTabId(savedSplit ?? null);
      setIsDraggingTab(false);
      setIsDraggingSidebar(false);
    }

    // Update previous activeId ref
    previousActiveIdRef.current = activeId;
  }, [activeId]); // Only depend on activeId change

  // 🎯 Load personality from Rust when activeId changes (for AgentPersonalityCard)
  // This ensures selectedSkills and other fields are loaded from filesystem
  useEffect(() => {
    if (!activeId) return;

    const activeTerminal = terminals.find(t => t.id === activeId);
    if (!activeTerminal?.cwd) return;

    // Load personality from Rust in background
    const loadPersonality = async () => {
      try {
        const personality = await invoke<AgentPersonality>('load_agent_personality', {
          projectPath: activeTerminal.cwd,
          personalityId: activeTerminal.id,
        });

        // Update terminal state with loaded personality (merging with existing)
        setTerminals(prev => prev.map(t =>
          t.id === activeId
            ? { ...t, personality: { ...t.personality, ...personality } }
            : t
        ));
        console.log('✅ Loaded personality for active agent:', activeTerminal.label, 'skills:', personality.selectedSkills);
      } catch (error) {
        // No personality found - that's fine, use existing state
        console.log('No personality found for:', activeTerminal.label);
      }
    };

    loadPersonality();
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 🦆 Ref to sendMessageForAgent function (to avoid circular dependency)
  const sendMessageForAgentRef = useRef<((content: string, options?: ChatSendOptions) => Promise<void>) | null>(null);

  // 📱 Pending auto-start: When WhatsApp triggers a session, store the prompt here
  // A useEffect will pick it up when activeId/activeSessionId are updated by React
  const pendingAutoStartRef = useRef<{ prompt: string; sessionId: string; model?: string } | null>(null);
  const handledRemoteSessionIds = useRef(new Set<string>());

  // 🦆 Telegram Bot integration hook (DEPRECATED - using Telegram Central Bot now)
  // TODO: Remove this old webhook-based telegram system
  /*
  const { sendStatusToTelegram, sendAgentNotification } = useTelegramBot({
    sessions: Array.from(chatSessions.values()).map((session) => ({
      id: session.id,
      name: session.title,
      isStreaming: activeStreamCounts.get(session.id) ? activeStreamCounts.get(session.id)! > 0 : false,
    })),
    onNewAgent: useCallback(async (prompt: string, telegramChatId?: number) => {
      // Create new agent chat
      const newAgentId = `agent-${Date.now()}`;
      const newAgent: AgentChat = {
        id: newAgentId,
        name: `Agent ${agentChats.length + 1}`,
        color: TERMINAL_COLORS[agentChats.length % TERMINAL_COLORS.length],
        cwd: explorerPath,
        createdAt: Date.now(),
      };

      setAgentChats((prev) => [...prev, newAgent]);
      setActiveId(newAgentId);

      // Store agent metadata for Telegram notifications
      agentMetadataRef.current.set(newAgentId, {
        name: newAgent.name,
        cwd: explorerPath,
      });

      // Initialize chat session
      const newSession: ChatSession = {
        id: newAgentId,
        title: newAgent.name,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        workingDirectory: explorerPath,
      };

      setChatSessions((prev) => new Map(prev).set(newAgentId, newSession));

      // Send the initial prompt using the ref
      if (sendMessageForAgentRef.current) {
        await sendMessageForAgentRef.current(prompt);
      }

      return newAgentId;
    }, [agentChats, explorerPath]),

    onStopAgent: useCallback(async (sessionId: string) => {
      // Find and abort the agent's streams
      const streamKeys = Array.from(abortControllersRef.current.keys()).filter(key => key.startsWith(`${sessionId}-`));
      streamKeys.forEach(key => {
        const controller = abortControllersRef.current.get(key);
        if (controller) {
          controller.abort();
          abortControllersRef.current.delete(key);
        }
      });

      // Clean up active streams tracking
      activeStreamsRef.current.delete(sessionId);

      // Update stream count
      // setActiveStreamCounts((prev) => {
      //   const newMap = new Map(prev);
      //   newMap.delete(sessionId);
      //   return newMap;
      // });
    }, []),

    onSendMessage: useCallback(async (sessionId: string, message: string) => {
      // Set the agent as active and send message using the ref
      setActiveId(sessionId);
      if (sendMessageForAgentRef.current) {
        await sendMessageForAgentRef.current(message);
      }
    }, []),
  });
  */

  // 🦆 FIX: Listen for Claude SDK streaming events from backend
  // CRITICAL: Maintain persistent listeners for ALL active agents, not just the active one
  // This prevents stream interruption when switching between agents during streaming

  // 🦆 FIX: Use terminal IDs (real agents) instead of chatSessions keys
  // chatSessions keys include session IDs (session-xxx) which don't correspond to
  // Tauri event channels (claude-event:{agentId}). The backend emits on agent IDs only.
  // This was causing hundreds of useless listeners and "Listener already exists" warnings.
  const activeAgentIdsKey = terminals.map(t => t.id).sort().join(',');

  useEffect(() => {
    if (!tauriAvailable) return;

    // Get all agent IDs that have chat sessions
    const activeAgentIds = activeAgentIdsKey.split(',').filter(Boolean);

    // Track which listeners we're setting up in THIS effect run
    const newlyCreatedListeners = new Set<string>();

    // Setup listener for each active agent (only if not already active or pending)
    const setupPromises = activeAgentIds.map(async (agentId) => {
      // Skip if listener already exists or is being registered
      if (activeListenersRef.current.has(agentId) || pendingListenersRef.current.has(agentId)) {
        return;
      }

      pendingListenersRef.current.add(agentId);
      const eventName = `claude-event:${agentId}`;

      try {
        // 🦆 SESSION-FIRST: Events now come wrapped with sessionKey + turnId
        // Payload structure: { sessionKey: string, turnId: string, event: ClaudeEvent }
        const unlisten = await listen<{ sessionKey: string; turnId?: string; event: ClaudeEvent }>(eventName, (event) => {
          const { sessionKey, turnId, event: claudeEvent } = event.payload;

          // 🦆 EVENT BUFFER FIX: Use centralized event handler with buffering support
          // 🦆 SESSION-FIRST: Pass sessionKey so events go to the correct chat session
          handleClaudeEvent(agentId, claudeEvent, 'Multi-Listener', sessionKey, turnId);

          // Auto-refresh FileExplorer when files are created/modified
          if (claudeEvent.type === 'result') {
            // Send Telegram notification when agent completes
            let agentMetadata = agentMetadataRef.current.get(agentId);

            // FALLBACK: If metadata not found in ref, try to get from agentChats
            if (!agentMetadata) {
              const agentChat = agentChats.find(a => a.id === agentId);
              if (agentChat) {
                agentMetadata = {
                  name: agentChat.name,
                  cwd: agentChat.cwd,
                };
                // Save it for next time
                agentMetadataRef.current.set(agentId, agentMetadata);
              }
            }

            // 🧠 QUACK MEMORY: Use setChatSessions callback to access CURRENT state
            // This avoids stale closure issue where chatSessions.get() returns old data
            setChatSessions((currentSessions) => {
              const agentMessages = currentSessions.get(agentId) ?? [];
              const lastMsg = agentMessages[agentMessages.length - 1];

              console.log('🦆 [Telegram] Agent completed:', {
                agentId,
                agentName: agentMetadata?.name,
                workingDir: agentMetadata?.cwd,
                hasSession: agentMessages.length > 0,
                isError: claudeEvent.is_error,
                hasMetadata: !!agentMetadata,
              });

              console.log('[Memory Observer DEBUG] Processing messages for agent:', agentId,
                lastMsg ? { eventsCount: lastMsg.events?.length, role: lastMsg.role } : 'no lastMsg');

              if (lastMsg && lastMsg.events) {
                let hasFileModifications = false;
                const toolExecutions: Array<{ name: string; input: unknown }> = [];

                console.log('[Memory Observer DEBUG] Events to process:', lastMsg.events.length);

                // Check assistant events for Write/Edit tool uses
                // Also check for MCP Memory read_graph results
                lastMsg.events.forEach((evt, idx) => {
                  console.log(`[Memory Observer DEBUG] Event ${idx}:`, evt.type,
                    evt.type === 'assistant' ? `content blocks: ${(evt as any).message?.content?.length}` : '');

                  if (evt.type === 'assistant' && (evt as any).message?.content) {
                    ((evt as any).message.content as any[]).forEach((content) => {
                      console.log('[Memory Observer DEBUG] Content block:', content.type,
                        content.type === 'tool_use' ? `name: ${content.name}` : '');

                      if (content.type === 'tool_use') {
                        const toolName = content.name?.toLowerCase();
                        const input = content.input;

                        console.log('[Memory Observer] Found tool_use:', toolName);

                        // Check if Write or Edit tools were used
                        if ((toolName === 'write' && input?.file_path) ||
                            (toolName === 'edit' && input?.file_path)) {
                          hasFileModifications = true;
                        }

                        // Collect tool executions for memory observer
                        if (toolName && ['write', 'edit', 'bash'].includes(toolName)) {
                          console.log('[Memory Observer] Adding to toolExecutions:', toolName);
                          toolExecutions.push({ name: toolName, input });
                        }
                      }
                    });
                  }

                  // 🧠 MCP MEMORY: Intercept mcp__memory__ tool calls and results
                  // When AI uses MCP Memory tools, capture the data for Memory Panel

                  // First, check for tool_use calls to mcp__memory__ tools
                  if (evt.type === 'assistant' && (evt as any).message?.content) {
                    ((evt as any).message.content as any[]).forEach((content) => {
                      if (content.type === 'tool_use' && content.name?.startsWith('mcp__memory__')) {
                        console.log('[MCP Memory] 🔧 Detected MCP Memory tool call:', content.name, content.input);
                      }
                    });
                  }

                  // Then check for tool_result responses
                  if (evt.type === 'user' && (evt as any).message?.content) {
                    const contentArray = (evt as any).message.content as any[];
                    console.log('[MCP Memory DEBUG] User event content types:', contentArray.map((c: any) => c.type));

                    contentArray.forEach((content) => {
                      if (content.type === 'tool_result') {
                        console.log('[MCP Memory DEBUG] tool_result found:', {
                          tool_use_id: content.tool_use_id,
                          contentType: typeof content.content,
                          contentPreview: typeof content.content === 'string'
                            ? content.content.substring(0, 200)
                            : JSON.stringify(content.content).substring(0, 200)
                        });


                      }
                    });
                  }
                });

                // Trigger FileExplorer refresh if files were modified
                if (hasFileModifications) {
                  setRefreshExplorerTrigger(prev => prev + 1);
                }

              }

              // Return unchanged - we're just reading, not modifying
              return currentSessions;
            });
          }
        });

        activeListenersRef.current.set(agentId, unlisten);
        pendingListenersRef.current.delete(agentId);
        newlyCreatedListeners.add(agentId);
      } catch (error) {
        pendingListenersRef.current.delete(agentId);
        console.error(`[Multi-Listener] Failed to setup listener for ${agentId}:`, error);
      }
    });

    // Wait for all listeners to be setup
    Promise.all(setupPromises).catch((error) => {
      console.error('[Multi-Listener] Error setting up listeners:', error);
    });

    // 🦆 RACE CONDITION FIX: Do NOT remove listeners in cleanup!
    // The old logic removed listeners based on the CAPTURED activeAgentIdsKey,
    // which caused a race condition when ensureListenerReady created a listener
    // for a new agent BEFORE this useEffect re-ran.
    //
    // Listeners should persist for the lifetime of the app.
    // They will be cleaned up only when:
    // 1. The app unmounts (window closes)
    // 2. The agent is explicitly removed via removeAgentChat()
    return () => {
      // Only log, don't remove - let listeners persist
      console.log('[Multi-Listener] Effect cleanup - listeners preserved:',
        Array.from(activeListenersRef.current.keys())
      );
    };
  }, [tauriAvailable, activeAgentIdsKey]); // 🦆 RACE FIX: Only re-setup when agent IDs change, not on every message update!

  // Brain: decision-quack-abstraction-agent-level-not-model-level
  // Codex Multi-Listener: parallel to the Claude Multi-Listener above.
  // Listens on codex-event:{agentId} (emitted by the Rust Codex backend) and routes
  // each QuackAgentEvent through the pure adapter into handleClaudeEvent.
  // PURELY ADDITIVE: the Claude listener path above is byte-identical after this addition.
  useEffect(() => {
    if (!tauriAvailable) return;

    const activeAgentIds = activeAgentIdsKey.split(',').filter(Boolean);

    const setupPromises = activeAgentIds.map(async (agentId) => {
      if (activeCodexListenersRef.current.has(agentId) || pendingCodexListenersRef.current.has(agentId)) {
        return;
      }

      pendingCodexListenersRef.current.add(agentId);
      const eventName = `codex-event:${agentId}`;

      try {
        const unlisten = await listen<{ sessionKey: string; turnId: string | null; event: QuackAgentEvent }>(
          eventName,
          (tauri) => {
            const { sessionKey, turnId, event } = tauri.payload;

            // Persist Codex backend session id so resume path can use it (Task 2b+)
            if (event.kind === 'session_started') {
              useSessionStore.getState().updateSession(sessionKey, {
                backendSessionId: event.backend_session_id,
              }).catch((err: Error) => {
                console.warn('[Codex-Listener] Failed to save backendSessionId:', err);
              });
            }

            // Capture latest usage for this turn so we can finalize the placeholder with token stats
            if (event.kind === 'usage') {
              codexLastUsageRef.current.set(sessionKey, {
                input_tokens: event.input_tokens,
                output_tokens: event.output_tokens,
                cache_read_input_tokens: event.cached_tokens,
                cache_creation_input_tokens: 0,
                cost: event.cost_usd,
              });
            }

            // Increment per-agent seq counter for text_delta id uniqueness (keyed by agentId for uniform teardown)
            const seq = (codexSeqCountersRef.current.get(agentId) ?? 0) + 1;
            codexSeqCountersRef.current.set(agentId, seq);

            const claudeEvents = quackEventToClaudeEvents(event, seq);
            for (const ce of claudeEvents) {
              handleClaudeEvent(agentId, ce, 'Codex-Listener', sessionKey, turnId ?? undefined);
            }

            // Finalize the assistant placeholder on terminal events so status transitions
            // from 'streaming' to 'complete'/'error' and per-turn token stats render correctly.
            // This block runs ONLY inside the codex-event handler — the Claude path is unaffected.
            if (event.kind === 'session_ended' || event.kind === 'error') {
              const isError = event.kind === 'error';
              // Capture here where TS narrows the discriminated union (avoids a cast inside the closure)
              const errorMessage = event.kind === 'error' ? event.message : undefined;
              const lastUsage = codexLastUsageRef.current.get(sessionKey);
              setChatSessions((prev) => {
                const msgs = prev.get(sessionKey);
                if (!msgs) return prev;
                const idx = findAssistantMessageIndexForTurn(msgs, turnId ?? undefined);
                if (idx < 0) return prev;
                const next = new Map(prev);
                next.set(sessionKey, msgs.map((msg, i) => i === idx ? {
                  ...msg,
                  status: (isError ? 'error' : 'complete') as 'error' | 'complete',
                  ...(isError ? { error: errorMessage } : {}),
                  metadata: {
                    ...msg.metadata,
                    ...(lastUsage ? {
                      turnUsage: {
                        input_tokens: lastUsage.input_tokens,
                        output_tokens: lastUsage.output_tokens,
                        cache_read_input_tokens: lastUsage.cache_read_input_tokens,
                        cache_creation_input_tokens: lastUsage.cache_creation_input_tokens,
                      },
                      ...(lastUsage.cost != null ? { turnCost: lastUsage.cost } : {}),
                    } : {}),
                  },
                } : msg));
                return next;
              });
              codexLastUsageRef.current.delete(sessionKey);
            }
          },
        );

        activeCodexListenersRef.current.set(agentId, unlisten);
        pendingCodexListenersRef.current.delete(agentId);
      } catch (error) {
        pendingCodexListenersRef.current.delete(agentId);
        console.error(`[Codex-Listener] Failed to setup listener for ${agentId}:`, error);
      }
    });

    Promise.all(setupPromises).catch((error) => {
      console.error('[Codex-Listener] Error setting up listeners:', error);
    });

    // Persist listeners for app lifetime — same discipline as Claude Multi-Listener above
    return () => {
      console.log('[Codex-Listener] Effect cleanup - listeners preserved:',
        Array.from(activeCodexListenersRef.current.keys())
      );
    };
  }, [tauriAvailable, activeAgentIdsKey, handleClaudeEvent]);

  // 🦆 PRE-WARM LISTENER: REMOVED — was a third listener registration point
  // alongside Multi-Listener and ensureListenerReady, causing duplicate event
  // delivery. The Multi-Listener effect covers all active terminals, and
  // ensureListenerReady (called from sendMessageForAgent) covers the gap
  // before the first message. Two registration points are sufficient.

  // 🦆 SESSION PERSISTENCE: REMOVED - Agents always start fresh
  // Users can resume sessions via Sessions panel -> "Resume Session" button
  // This simplifies UX and avoids confusion about session continuity

  // 🦆 RACE CONDITION FIX: Helper function to ensure listener is ready for an agent
  // This prevents events being emitted before the listener is set up
  const ensureListenerReady = useCallback(async (agentId: string) => {
    // Skip if listener already exists or is being registered
    if (activeListenersRef.current.has(agentId) || pendingListenersRef.current.has(agentId)) {
      return;
    }

    pendingListenersRef.current.add(agentId);
    const eventName = `claude-event:${agentId}`;

    try {
      // 🦆 SESSION-FIRST: Events now come wrapped with sessionKey + turnId
      const unlisten = await listen<{ sessionKey: string; turnId?: string; event: ClaudeEvent }>(eventName, (event) => {
        const { sessionKey, turnId, event: claudeEvent } = event.payload;

        // 🦆 EVENT BUFFER FIX: Use centralized event handler with buffering support
        // 🦆 SESSION-FIRST: Pass sessionKey so events go to the correct chat session
        handleClaudeEvent(agentId, claudeEvent, 'ensureListenerReady', sessionKey, turnId);

        // Handle completion event - FileExplorer refresh
        if (claudeEvent.type === 'result') {
          // Trigger FileExplorer refresh if files were modified
          // 🦆 SESSION-FIRST: Use sessionKey for correct session lookup
          setChatSessions((prev) => {
            const agentMessages = prev.get(sessionKey || agentId) ?? [];
            const lastMsg = agentMessages[agentMessages.length - 1];

            if (lastMsg && lastMsg.events) {
              let hasFileModifications = false;

              lastMsg.events.forEach((evt) => {
                if (evt.type === 'assistant' && evt.message?.content) {
                  evt.message.content.forEach((content) => {
                    if (content.type === 'tool_use') {
                      const toolName = content.name?.toLowerCase();
                      const input = content.input as any;

                      if ((toolName === 'write' && input?.file_path) ||
                          (toolName === 'edit' && input?.file_path)) {
                        hasFileModifications = true;
                      }
                    }
                  });
                }
              });

              if (hasFileModifications) {
                setRefreshExplorerTrigger(prev => prev + 1);
              }
            }

            return prev;
          });
        }
      });

      activeListenersRef.current.set(agentId, unlisten);
      pendingListenersRef.current.delete(agentId);
    } catch (error) {
      pendingListenersRef.current.delete(agentId);
      console.error(`[Listener] Failed to setup for ${agentId}:`, error);
    }
  }, [handleClaudeEvent]);

  // Send message for specific agent
  // 🦆 SESSION-FIRST: Use chatKey (sessionId when available) for message storage
  // but keep using activeId (agentId) for Claude SDK routing and event listeners
  const sendMessageForAgent = useCallback(async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || !activeId) return;

    // 🦆 SESSION-FIRST: Require an active session to send messages
    // The empty state UI prevents users from typing without a session selected
    // If we reach this point without a session, something is wrong - bail out
    if (!activeSessionId) {
      console.error(`🦆 [SESSION-FIRST] No active session selected - cannot send message`);
      toast.error('Please select a session first');
      return;
    }

    // Brain: 025-team-delegation-footer — enrich @team with quack-remote instructions
    let resolvedContent = content;
    if (content.includes('@team')) {
      const teamHint = [
        '[TEAM DELEGATION MODE — MANDATORY INSTRUCTIONS]',
        'You MUST use the quack-remote skill to delegate this task to other agents.',
        '',
        'CRITICAL: You MUST include "leadSessionId" in the POST body. This is what makes it a TEAM session (not a Remote session).',
        `Your leadSessionId is: "${activeSessionId}"`,
        '',
        'Exact curl template (ALWAYS use this format):',
        '```',
        'curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \\',
        `  -d '{"agentId":"AGENT_ID_HERE","prompt":"TASK_HERE","leadSessionId":"${activeSessionId}"}' \\`,
        '  http://127.0.0.1:$PORT/api/execute',
        '```',
        '',
        'Steps: 1) Read quack-remote config from ~/Library/Application\\ Support/com.quack.terminal/quack-remote.json',
        '2) GET /api/agents to find the right agent(s)',
        `3) POST /api/execute with leadSessionId="${activeSessionId}" — DO NOT OMIT THIS FIELD`,
        '',
      ].join('\n');
      resolvedContent = teamHint + content.replace(/@team\s*/g, '').trim();
    }

    // 🦆 DIAGNOSTIC: Check if previous assistant message is incomplete (late-render bug)
    {
      const sessionMsgs = chatSessions.get(activeSessionId) ?? [];
      const lastMsg = sessionMsgs[sessionMsgs.length - 1];
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.status !== 'complete') {
        console.warn(
          `[BUG:LATE_RENDER] Previous assistant message still "${lastMsg.status}" at send time!`,
          `\n  session=${activeSessionId}`,
          `\n  msgId=${lastMsg.id}`,
          `\n  events=${lastMsg.events?.length ?? 0}`,
          `\n  content=${lastMsg.content ? 'yes' : 'no'}`,
          `\n  messageCount=${sessionMsgs.length}`,
        );
        console.warn('[BUG:LATE_RENDER] Event ring buffer:', JSON.parse(JSON.stringify(eventDiagnosticsRef.current)));
      }
    }

    // 🦆 RACE CONDITION FIX: Capture ALL state at the START of the function
    // User may switch sessions while this async function runs - we must use captured values
    const messageKey = activeSessionId;
    const capturedAgentId = activeId;
    const capturedSession = agentSessions.find(s => s.id === messageKey);
    const capturedClaudeSessionId = capturedSession?.claudeSessionId;
    const capturedAgentLabel = activeTerminal?.label || activeAgent?.name || 'AI Assistant';
    const capturedAgentCwd = activeTerminal?.cwd || explorerPath || '';

    console.log(`🦆 [SESSION-FIRST] Sending message to session: ${messageKey}, agentId: ${capturedAgentId}, claudeSessionId: ${capturedClaudeSessionId?.slice(0, 8) || 'NEW'}`);

    // Track resuming sessions so handleClaudeEvent can tag system/init as isResumed
    if (capturedClaudeSessionId) {
      resumingSessionsRef.current.add(messageKey);
    }

    // 🦆 AUTO-PROGRESS: Move session to 'in_progress' when first message is sent
    // This automatically transitions TODO tasks to In Progress in Kanban
    const currentSession = useSessionStore.getState().sessions.find(s => s.id === activeSessionId);
    console.log(`🦆 [AUTO-PROGRESS] Checking session ${activeSessionId}: found=${!!currentSession}, status=${currentSession?.status}`);
    if (currentSession && currentSession.status === 'todo') {
      console.log(`🦆 [AUTO-PROGRESS] Transitioning session ${activeSessionId} from 'todo' to 'in_progress'`);
      await updateSession(activeSessionId, { status: 'in_progress' });
    } else if (!currentSession) {
      // Session might be in agentSessions (React state) but not yet in store
      // Try to find it in the local React state
      const localSession = agentSessions.find(s => s.id === activeSessionId);
      console.log(`🦆 [AUTO-PROGRESS] Session not in store, checking local state: found=${!!localSession}, status=${localSession?.status}`);
      if (localSession && localSession.status === 'todo') {
        console.log(`🦆 [AUTO-PROGRESS] Transitioning local session ${activeSessionId} from 'todo' to 'in_progress'`);
        await updateSession(activeSessionId, { status: 'in_progress' });
      }
    }

    // 🦆 SESSIONS-FIRST: Set loading IMMEDIATELY when user presses Enter/Send
    // This ensures the yellow dot and progress bar appear instantly
    setChatLoadingMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(messageKey, true);
      return newMap;
    });
    useChatStore.getState().setLoading(messageKey, true);


    // 🦆 RACE CONDITION FIX: Ensure listener is ready BEFORE calling invoke
    // Note: The real fix was removing the cleanup logic that was removing listeners
    // prematurely. Now listeners persist until the agent is explicitly deleted.
    await ensureListenerReady(capturedAgentId);

    // 🦆 CRITICAL: Wait for Tauri to fully register the listener internally
    // The listen() promise resolves immediately, but Tauri's internal event routing
    // may not be ready yet. This delay ensures events don't get lost.
    // Without this, the first Task event can be emitted before the listener catches it.
    console.log(`[sendMessage] Listener ready for ${capturedAgentId}, waiting for Tauri registration...`);
    await new Promise(resolve => setTimeout(resolve, 150));
    console.log(`[sendMessage] Tauri registration delay complete for ${capturedAgentId}`);

    // Generate unique message ID for this stream
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const streamKey = `${capturedAgentId}-${messageId}`;

    // 🦆 SESSION-FIRST: No need to check for active streams or block - events now contain sessionKey
    // Each stream sends its sessionKey to Rust, which includes it in emitted events
    // The event handler uses the sessionKey from the event to route to the correct chat session
    console.log(`[sendMessage] Starting stream ${streamKey} for session ${messageKey}`);

    // Save the prompt for restoration on abort
    // 🦆 RACE CONDITION FIX: Use captured agentId
    lastPromptsRef.current.set(capturedAgentId, content);

    // Create abort controller with composite key to prevent race conditions
    const abortController = new AbortController();
    abortControllersRef.current.set(streamKey, abortController);

    // 🦆 SESSION ISOLATION FIX: Track this stream as active for this SESSION (not agent!)
    // This allows different sessions of the same agent to be stopped independently
    if (!activeStreamsRef.current.has(messageKey)) {
      activeStreamsRef.current.set(messageKey, new Set());
    }
    activeStreamsRef.current.get(messageKey)!.add(streamKey);

    console.log(`[sendMessage] Active streams for session ${messageKey}:`, activeStreamsRef.current.get(messageKey)?.size || 0);

    // Check if chat is configured
    if (!isChatConfigured) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: 'Quack quack! 🦆 Claude CLI is not available. Please make sure Claude Code CLI is installed and you are logged in.',
        timestamp: Date.now(),
        status: 'error',
        error: 'Not configured',
      };
      setChatSessions((prev) => {
        const newSessions = new Map(prev);
        const agentMessages = newSessions.get(messageKey) ?? [];
        newSessions.set(messageKey, [...agentMessages, errorMessage]);
        return newSessions;
      });
      return;
    }

    // 🦆 Create AgentChat automatically if it doesn't exist (for UI-created agents)
    // 🦆 RACE CONDITION FIX: Use capturedAgentId
    if (!agentChats.find(a => a.id === capturedAgentId)) {
      // Get terminal info for this capturedAgentId
      const terminal = terminals.find(t => t.id === capturedAgentId);
      if (terminal) {
        const newAgentChat: AgentChat = {
          id: capturedAgentId,
          name: terminal.label,
          color: terminal.color,
          cwd: terminal.cwd,
          createdAt: Date.now(),
        };

        setAgentChats((prev) => [...prev, newAgentChat]);

        // Save metadata for Telegram notifications
        agentMetadataRef.current.set(capturedAgentId, {
          name: terminal.label,
          cwd: terminal.cwd,
        });

        console.log('🦆 Auto-created AgentChat for UI-created agent:', newAgentChat);
      }
    }

    // Create user message
    const attachments = options?.attachments ?? [];
    const attachmentLines = attachments.map((item, index) => `Attachment ${index + 1}: ${item.path}`);
    // Brain: 025-team-delegation-footer — use enriched content for SDK prompt
    const sdkContent = resolvedContent;
    const contentWithAttachments =
      attachmentLines.length > 0
        ? `${sdkContent}\n\nAttachments:\n${attachmentLines.join('\n')}`
        : sdkContent;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
      attachments,
    };

    // Add user message to agent's chat session
    const messagesToAdd: ChatMessage[] = [userMessage];

    // If agent is selected, add system message showing agent invocation
    // 🦆 RACE CONDITION FIX: Use capturedAgentId
    if (activeAgent) {
      const agentSystemMessage: ChatMessage = {
        id: `msg-${Date.now()}-agent-system-${capturedAgentId}`, // Include capturedAgentId for uniqueness
        role: 'system',
        content: `🦆 Invoking droid: **${activeAgent.name}**`,
        timestamp: Date.now() + 1, // Slightly after user message
        status: 'complete',
        metadata: {
          sessionId: capturedAgentId, // Track which session this message belongs to
        },
      };
      messagesToAdd.push(agentSystemMessage);
    }

    // 🦆 SESSION-FIRST: Add messages to session using messageKey
    setChatSessions((prev) => {
      return appendMessagesToSession(prev, messageKey, messagesToAdd);
    });

    // Track chat message sent to PostHog
    // 🦆 RACE CONDITION FIX: Use capturedAgentId and capturedAgentLabel
    const messageStartTime = performance.now();
    posthog.capture('ai_message_sent', {
      agent_id: capturedAgentId,
      agent_name: capturedAgentLabel,
      has_attachments: attachments.length > 0,
      attachments_count: attachments.length,
      model: options?.model || 'opus46',
      thinking_mode: options?.thinkingMode || 'auto',
      message_length: content.length,
    });

    // Create assistant message placeholder with settings metadata (SDK 0.1.54+)
    const turnId = createChatTurnId();
    const assistantMessageId = `msg-${Date.now()}-assistant-${Math.random().toString(36).substr(2, 9)}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      // 🦆 FIX: Start with timestamp = 0 so it doesn't affect sorting until assistant responds
      // Timestamp will be updated to Date.now() when first response arrives (see event listener)
      timestamp: 0,
      status: 'streaming',
      // Store settings used for this message (for UI display).
      // Codex sessions run Codex's own model — label the message accordingly
      // instead of the Claude active model (which does not apply to Codex).
      settings: {
        model: currentSession?.backend === 'codex' ? 'gpt-5-codex' : getActiveModelName(options?.model),
        // Brain: task-effort-model-aware-refactor — use model-aware default instead of hardcoded 'medium'
        effort: options?.effort || defaultEffortForModel(options?.model || ''),
        thinkingMode: options?.thinkingMode || 'auto',
        modelDisplayName: currentSession?.backend === 'codex' ? 'gpt-5-codex' : (getActiveModelDisplayName(options?.model) || undefined),
      },
      // Hide header + init widget on resumed sessions (known at message creation time)
      metadata: {
        ...(capturedClaudeSessionId ? { isResumed: true } : {}),
        turnId,
      },
    };

    // 🦆 SESSION-FIRST: Clear previous response text for this session (new conversation turn)
    lastAgentResponseRef.current.delete(messageKey);
    // Old aborted turns no longer need explicit same-turn filtering once a new turn starts.
    abortedTurnIdsRef.current.delete(messageKey);

    // Set the active turn ID before the placeholder/invoke so late events from the
    // previous turn can be rejected immediately instead of buffering into the next turn.
    activeQueryIdRef.current.set(messageKey, turnId);

    // 🦆 SESSION-FIRST: Add assistant message placeholder using messageKey
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      const sessionMessages = newSessions.get(messageKey) ?? [];

      // Brain: fix-late-render-abort-stale-buffer
      // Discard any buffered events — they are always stale (from a previous turn
      // or aborted stream). The invoke hasn't been called yet at this point, so no
      // events for the NEW turn can exist in the buffer. New-turn events will arrive
      // via handleClaudeEvent after the placeholder is created and status is 'streaming'.
      if (eventBufferRef.current.has(messageKey)) {
        const staleCount = eventBufferRef.current.get(messageKey)!.length;
        console.log(`🦆 [sendMessageForAgent] Discarding ${staleCount} stale buffered events for messageKey=${messageKey}`);
        eventBufferRef.current.delete(messageKey);
      }

      newSessions.set(messageKey, [...sessionMessages, assistantMessage]);

      return newSessions;
    });

    try {
      let prompt = contentWithAttachments;

      // Call Rust backend for SDK streaming
      // Events are received via the claude-event listener above
      // 🦆 BRANCH-PER-SESSION: Use session's worktreePath if available, then agent's cwd
      const sessionWorktreePath = currentSession?.worktreePath;
      const workingDir = sessionWorktreePath
        ? sessionWorktreePath
        : getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);

      // Build IDE context (open file, selection) as a separate field
      // Injected into system prompt by Node.js — not concatenated into user message
      const ideContext = await buildContextPrefix(workingDir ?? null);

      // Create abort promise that rejects when signal is aborted
      const abortPromise = new Promise<never>((_, reject) => {
        if (abortController.signal.aborted) {
          reject(new Error('Aborted'));
        }
        abortController.signal.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
      });

      // Brain: decision-quack-abstraction-agent-level-not-model-level
      // Codex backend: send via the Codex agent harness. Completion, assistant
      // text, tool calls and token usage all arrive asynchronously through the
      // codex-event channel (consumed alongside the Claude listener) and render
      // via the existing reducer. M1 uses Codex's own default model (agent-level
      // abstraction — no Quack model override). Resume uses the persisted
      // backendSessionId. The shared finally{} below still runs cleanup.
      if (currentSession?.backend === 'codex') {
        // Codex UX parity (M1.5). Claude gets these from the Agent SDK CLI
        // natively; Codex `exec` does not, so Quack supplies the equivalent
        // via pure prompt/file composition (agent-level abstraction — no
        // harness reimplementation). 1) persona → AGENTS.md (Codex reads it
        // natively from --cd); 2) slash-command expansion + selected-skill
        // index composed into the prompt (#3641 / no native skill discovery,
        // both verified 2026-05-17). Best-effort: failures degrade to the
        // raw prompt, never block the turn.
        // Brain: pattern-backend-capability-gated-ui
        await injectAgentPersonalityAgentsMd(activeTerminal ?? undefined, workingDir);
        prompt = await composeCodexPrompt({
          message: prompt,
          basePath: workingDir ?? '',
          selectedSkills: activeTerminal?.personality?.selectedSkills,
        });
        const codexPromise = invoke<{ backend_session_id?: string }>('send_message_via_codex', {
          agentId: capturedAgentId,
          sessionKey: messageKey,
          workingDir,
          prompt,
          // Codex-backend model picker (settingsStore). Empty → null → Rust
          // omits `-c model=` and Codex uses its own default. This is a Codex
          // knob (like --sandbox), not Claude model selection.
          model: useSettingsStore.getState().codexModel || null,
          turnId,
          resumeSessionId: currentSession?.backendSessionId ?? null,
        });
        codexPromise.catch(() => {}); // suppress unhandled rejection if abort wins the race
        await Promise.race([codexPromise, abortPromise]);
        return;
      }

      // 🦆 SIMPLIFIED: Always start fresh conversation
      // Users can resume sessions via Sessions panel -> "Resume Session" button
      // Race between invoke and abort
      // Note: sdkInvokePromise is captured separately so we can suppress the
      // unhandled rejection that occurs when abort fires before the backend returns.
      const sdkInvokePromise = invoke<{
        result: string;
        session_id: string;
        total_cost_usd: number;
        usage: UsageStats;
      }>('send_message_via_sdk_streaming', {
          // 🦆 RACE CONDITION FIX: Use capturedAgentId
          agentId: capturedAgentId,
          // Brain: 037-anthropic-compatible-providers
          // Resolve active Anthropic-compatible provider (z.ai, MiniMax, etc.) before invoke.
          // null when default Anthropic / Bedrock — daemon uses OAuth / standard env.
          request: await (async () => {
            const prf = getProviderRequestFields(remoteModels);
            const providerConfig = await getActiveProviderConfig(capturedAgentId);
          return {
            prompt,
            // 🦆 MODEL FIX: Map friendly name (opus46) to API model ID (claude-opus-4-6)
            model: (() => {
              const friendlyName = options?.model || 'opus46';
              const resolvedId = prf.resolveModel(friendlyName);
              console.log(`🦆 [MODEL DEBUG sendMessageForAgent] friendlyName=${friendlyName}, resolvedId=${resolvedId}`);
              return resolvedId;
            })(),
            thinkingMode: options?.thinkingMode,
            permissionMode: options?.permissionMode,
            attachments: attachments.map(a => a.path),
            // Pass all available droids for @mention invocation
            // The SDK will recognize @droid-name syntax and delegate to the appropriate agent
            agents: availableDroids.length > 0 ? availableDroids.map(droid => ({
              name: droid.id.replace('global-', ''), // Use ID as name for @mention matching
              description: droid.description,
              model: getModelId('opus', remoteModels), // Default model for droids
              filePath: droid.path,
            })) : undefined,
            cwd: workingDir,
            // 🦆 RACE CONDITION FIX: Use CAPTURED claudeSessionId (from start of function)
            // Don't read agentSessions.find() here - user may have switched sessions!
            sessionId: capturedClaudeSessionId,
            // 🦆 SESSION-FIRST: Pass sessionKey so Rust can include it in emitted events
            // This enables parallel conversations - each stream knows where to route events
            sessionKey: messageKey,
            turnId,
            // ✅ New SDK 0.1.54+ features
            outputFormat: options?.outputFormat, // Structured outputs (beta)
            effort: options?.effort, // Effort parameter for quality vs speed/cost tradeoff
            // 🗣️ Enable interactive tools like AskUserQuestion (SDK v0.1.71+)
            // NOTE: Must use camelCase because Rust struct uses #[serde(rename_all = "camelCase")]
            allowedTools: [
              'Skill', 'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
              'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
              'AskUserQuestion',
            ],
            // Agent Teams: pass teamContext when active agent is the Team Lead
            teamContext: (() => {
              const team = useTeamStore.getState().activeTeam;
              if (!team || team.leadAgentId !== capturedAgentId) return undefined;
              return {
                teamName: team.name,
                members: team.members.map(m => ({
                  name: m.name,
                  role: m.role,
                  communicationStyle: m.communicationStyle,
                  isLead: m.isLead,
                })),
              };
            })(),
            // 🦆 LLM Provider fields (Ollama/custom support)
            provider: prf.provider,
            providerBaseUrl: prf.providerBaseUrl,
            providerApiKey: prf.providerApiKey,
            // Brain: 037-anthropic-compatible-providers
            providerConfig,
            toolSearchMode: useSettingsStore.getState().claude.toolSearchMode,
            // IDE context: injected into system prompt by Node.js, not into user message
            ideContext: ideContext || undefined,
          };
          })(),
        });
      sdkInvokePromise.catch(() => {}); // Suppress unhandled rejection when abort fires first
      const response = await Promise.race([sdkInvokePromise, abortPromise]);

      // 🦆 DIAGNOSTIC: Log completion timing for late-render investigation
      {
        const diag = eventDiagnosticsRef.current;
        diag.push({ t: Date.now(), key: messageKey, type: '_invoke_complete', evtCount: -1, lastStatus: response.result ? 'has_result' : 'no_result' });
        if (diag.length > 50) diag.splice(0, diag.length - 50);
      }

      // 🦆 DIAGNOSTIC: Log response.result to determine if SDK returns old or new content on resume
      console.log(`[COMPLETION] messageKey=${messageKey}, msgId=${assistantMessageId}, response.result (first 200 chars):`, response.result?.substring(0, 200));

      // 🦆 SESSION-FIRST: Update message with final result using messageKey
      setChatSessions((prev) => {
        const newSessions = new Map(prev);
        const sessionMessages = newSessions.get(messageKey) ?? [];
        newSessions.set(
          messageKey,
          sessionMessages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: response.result,
                  status: 'complete' as const,
                  metadata: {
                    ...msg.metadata,
                    ...(response.usage ? {
                      turnUsage: {
                        input_tokens: response.usage.input_tokens || 0,
                        output_tokens: response.usage.output_tokens || 0,
                        cache_read_input_tokens: response.usage.cache_read_input_tokens || 0,
                        cache_creation_input_tokens: response.usage.cache_creation_input_tokens || 0,
                      },
                    } : {}),
                    turnCost: response.total_cost_usd,
                  },
                }
              : msg
          )
        );
        return newSessions;
      });

      // 🦆 SESSION-FIRST FIX: Save Claude session ID to the SPECIFIC session (not agent!)
      // Each session has its own claudeSessionId for independent conversations
      // The messageKey is the session ID, which is what we need to use
      // Brain: fix-remote-team-session-tracking
      // Save messageCount so Remote API polling can detect progress.
      // Brain: 025-team-delegation-footer
      // Team sessions stay in_progress — no auto-done on first response.
      // The user (or a future explicit signal) marks them done manually.
      try {
        // Brain: bug-delayed-agent-message-stale-closure
        // Neither the closure `chatSessions` nor `chatSessionsRef` are reliable here:
        // both depend on React's render cycle which may not have flushed yet.
        // useSessionMessageSync may have already written the correct count to the store.
        // Strategy: read BOTH sources and take the max — never regress messageCount.
        const storeSession = useSessionStore.getState().sessions.find(s => s.id === messageKey);
        const storeCount = storeSession?.messageCount ?? 0;
        const refCount = (chatSessionsRef.current.get(messageKey) ?? []).length;
        const messageCount = Math.max(storeCount, refCount);
        await updateSession(messageKey, {
          claudeSessionId: response.session_id,
          messageCount,
          updatedAt: Date.now(),
        });
        console.log(`[SESSION-FIX] Saved claudeSessionId ${response.session_id.slice(0, 8)}... to session ${messageKey}, messageCount=${messageCount} (store=${storeCount}, ref=${refCount})`);
      } catch (err) {
        console.warn(`[SESSION-FIX] Failed to save claudeSessionId:`, err);
      }

      // 🦆 LEGACY COMPATIBILITY: Keep chatSessionIds Map updated for any old code paths
      // But now keyed by messageKey (session ID), not activeId (agent ID)
      setChatSessionIds((prev) => {
        const updated = new Map(prev);
        updated.set(messageKey, response.session_id); // ✅ FIX: Use messageKey not activeId!
        return updated;
      });

      // Track usage from Claude Agent SDK (with full token details!)
      // 🦆 RACE CONDITION FIX: Use CAPTURED values, not current state
      trackUsage(
        capturedAgentId,
        capturedAgentLabel,
        response.session_id,
        response.total_cost_usd,
        response.usage  // ✅ Now passing full usage stats from Rust backend!
      );

      // 🦆 STAMINA FIX: Update cost from invoke response (authoritative)
      // NOTE: Don't overwrite inputTokens here — response.usage is CUMULATIVE (from result event)
      // while assistant event usage (already applied via streaming) is per-step and correct
      // for context window fill. Only update cost as a safety net.
      if (response.total_cost_usd != null) {
        setChatTokensMap((prev) => {
          const newMap = new Map(prev);
          const current = newMap.get(messageKey);
          if (current) {
            const updated = { ...current, totalCost: response.total_cost_usd };
            newMap.set(messageKey, updated);

            // 🦆 STAMINA PERSISTENCE: Persist to disk (backup, in case result event didn't fire)
            useSessionStore.getState().updateSession(messageKey, {
              inputTokens: updated.inputTokens,
              outputTokens: updated.outputTokens,
              cacheCreationTokens: updated.cacheCreationTokens,
              cacheReadTokens: updated.cacheReadTokens,
              totalCost: updated.totalCost,
            });
          } else {
            // Fallback: if no assistant event set tokens yet, use invoke response
            // (cumulative, but better than showing 0)
            if (response.usage) {
              handleTokenUpdate(messageKey, response.usage, response.total_cost_usd);
            }
          }
          return newMap;
        });
      }

      // Notify that agent response is complete
      // 🦆 RACE CONDITION FIX: Use CAPTURED values
      notifyAgentReadyRef.current({ id: capturedAgentId, label: capturedAgentLabel, cwd: capturedAgentCwd });

      // Track successful AI response to PostHog
      // 🦆 RACE CONDITION FIX: Use captured values
      const responseTime = Math.round(performance.now() - messageStartTime);
      posthog.capture('ai_response_received', {
        agent_id: capturedAgentId,
        agent_name: capturedAgentLabel,
        response_time_ms: responseTime,
        response_length: response.result?.length || 0,
        model: options?.model || 'opus46',
        session_id: response.session_id,
        total_cost_usd: response.total_cost_usd,
      });

      // Keep active agent persistent - don't reset after sending
      // The agent stays active until explicitly cleared by the user
    } catch (err) {
      console.error('Error calling Claude SDK:', err);

      // Track error to PostHog
      // 🦆 RACE CONDITION FIX: Use captured values
      const errorMsg = err instanceof Error ? err.message : String(err);
      const wasAborted = abortController.signal.aborted;
      posthog.capture('ai_error', {
        agent_id: capturedAgentId,
        error_type: wasAborted ? 'user_aborted' : 'stream_error',
        error_message: errorMsg.substring(0, 200),
        model: options?.model || 'opus46',
      });

      // Check if this was an abort
      if (wasAborted) {
        console.log('[sendMessageForAgent] Stream was aborted by user');

        // 🦆 SESSION-FIRST: Update message with aborted status using messageKey
        setChatSessions((prev) => {
          const newSessions = new Map(prev);
          const sessionMessages = newSessions.get(messageKey) ?? [];
          newSessions.set(
            messageKey,
            sessionMessages.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    // Preserve already-streamed content instead of replacing it
                    content: msg.content && msg.content.length > 0
                      ? msg.content
                      : 'Stream stopped by user',
                    status: 'error' as const,
                    error: 'Aborted',
                  }
                : msg
            )
          );
          // Brain: fix-late-render-abort-stale-buffer
          // Clear event buffer on abort: the daemon may still emit trailing events
          // after the frontend aborts. Without this, those events buffer and get
          // incorrectly flushed into the NEXT turn's assistant placeholder.
          const abortedTurnIds = abortedTurnIdsRef.current.get(messageKey) ?? new Set<string>();
          abortedTurnIds.add(turnId);
          abortedTurnIdsRef.current.set(messageKey, abortedTurnIds);
          eventBufferRef.current.delete(messageKey);
          // Clear active turnId so trailing events from the aborted query are rejected
          activeQueryIdRef.current.delete(messageKey);
          return newSessions;
        });
      } else {
        const errorMessage =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Unknown error';

        // Brain: fix-session-limit-prompt-cache
        // Detect rate limit / session limit errors and show user-friendly message
        const isRateLimit = errorMessage.includes('rate_limit') ||
          errorMessage.includes('rate limit') ||
          errorMessage.includes('usage cap') ||
          errorMessage.includes('overloaded') ||
          errorMessage.includes('Too many requests') ||
          errorMessage.includes('429');

        const displayMessage = isRateLimit
          ? `Il session limit di Claude è stato raggiunto. Il limite si ripristina automaticamente — controlla le impostazioni di Claude per vedere il countdown. Nel frattempo puoi:\n\n- Attendere il ripristino del limite\n- Usare un modello diverso (es. Haiku consuma meno)\n- Attivare "Utilizzo aggiuntivo" nelle impostazioni di Claude`
          : `Quack! 🦆 I encountered an error: ${errorMessage}`;

        // 🦆 SESSION-FIRST: Update message with error using messageKey
        setChatSessions((prev) => {
          const newSessions = new Map(prev);
          const sessionMessages = newSessions.get(messageKey) ?? [];
          newSessions.set(
            messageKey,
            sessionMessages.map((msg) =>
              msg.id === assistantMessageId
                ? {
                    ...msg,
                    // Preserve already-streamed content; error details are in .error field
                    content: msg.content && msg.content.length > 0
                      ? msg.content
                      : displayMessage,
                    status: 'error' as const,
                    error: errorMessage,
                  }
                : msg
            )
          );
          return newSessions;
        });

        if (isRateLimit) {
          toast.error('Session limit raggiunto — controlla le impostazioni di Claude');
        }
      }
    } finally {
      // 🦆 SESSION-FIRST: Clear loading using messageKey
      setChatLoadingMap((prev) => {
        const newMap = new Map(prev);
        newMap.delete(messageKey); // Delete instead of set(false) for consistency
        return newMap;
      });
      // 🦆 SESSIONS-FIRST: Also update chatStore directly for AgentSessionItem activity indicators
      // Use getState() to avoid stale closure issues
      useChatStore.getState().setLoading(messageKey, false);

      // Clean up abort controller with composite key
      abortControllersRef.current.delete(streamKey);

      // 🦆 SESSION ISOLATION FIX: Remove from active streams using messageKey (not activeId!)
      const activeStreams = activeStreamsRef.current.get(messageKey);
      if (activeStreams) {
        activeStreams.delete(streamKey);
        if (activeStreams.size === 0) {
          activeStreamsRef.current.delete(messageKey);
        }
      }

      console.log(`[sendMessage] Stream ${streamKey} ended. Remaining streams for session ${messageKey}:`, activeStreamsRef.current.get(messageKey)?.size || 0);
    }
  }, [activeId, activeSessionId, agentSessions, terminals, isChatConfigured, chatSessions, activeAgent, activeTerminal?.cwd, explorerPath, availableDroids, ensureListenerReady, updateSession, remoteModels]);

  // 📱 Keep ref always up-to-date for external integrations (WhatsApp auto-start, Telegram)
  sendMessageForAgentRef.current = sendMessageForAgent;

  // 📱 WhatsApp Auto-Start: Send pending prompt when activeId/activeSessionId update
  useEffect(() => {
    const pending = pendingAutoStartRef.current;
    if (pending && activeSessionId === pending.sessionId && sendMessageForAgentRef.current) {
      console.log(`📱 Auto-start: activeSessionId matched ${pending.sessionId}, sending prompt`);
      pendingAutoStartRef.current = null; // Clear to prevent double-send

      // Small delay for Claude SDK listener and chat UI to be fully ready
      const timer = setTimeout(async () => {
        if (sendMessageForAgentRef.current) {
          console.log(`📱 Auto-sending prompt:`, pending.prompt.substring(0, 100), `model:`, pending.model);
          await sendMessageForAgentRef.current(pending.prompt, pending.model ? { model: pending.model } : undefined);
        } else {
          console.error(`📱 sendMessageForAgentRef still null after delay`);
        }
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [activeSessionId, activeId]);


  // 🦆 SESSION ISOLATION FIX: Abort streaming for CURRENT SESSION only (not all agent sessions!)
  // Uses messageKey (sessionId || agentId) to target only the active session
  const abortStreamForAgent = useCallback(() => {
    // Determine the current session key (same logic as sendMessage)
    const messageKey = activeSessionId || activeId;
    if (!messageKey) return;

    const activeStreams = activeStreamsRef.current.get(messageKey);
    if (!activeStreams || activeStreams.size === 0) {
      console.log('[abortStreamForSession] No active streams for session:', messageKey);
      return;
    }

    console.log(`[abortStreamForSession] Aborting ${activeStreams.size} stream(s) for session: ${messageKey}`);

    // Abort all active streams for this SESSION (not all sessions of the agent!)
    activeStreams.forEach((streamKey) => {
      const abortController = abortControllersRef.current.get(streamKey);
      if (abortController && !abortController.signal.aborted) {
        console.log(`[abortStreamForSession] Aborting stream: ${streamKey}`);
        abortController.abort();
      }
    });

    // Kill the backend Node.js process so it stops immediately
    invoke('abort_sdk_stream', { sessionKey: messageKey }).catch((err) => {
      console.warn('[abortStreamForSession] Failed to kill backend process:', err);
    });
  }, [activeId, activeSessionId]);

  // Get last prompt for specific agent
  const getLastPromptForAgent = useCallback(() => {
    if (!activeId) return '';
    return lastPromptsRef.current.get(activeId) || '';
  }, [activeId]);

  // ============================================
  // KANBAN CHAT INTEGRATION FUNCTIONS
  // These versions accept a targetAgentId parameter for Kanban tasks
  // ============================================

  // 🦆 Load Kanban task chat sessions from Quack storage first (preserves events for tool widgets)
  // Falls back to Rust backend if not found in storage
  const loadKanbanChatSessions = useCallback(async () => {
    const tasks = useKanbanStore.getState().getAllTasks();
    const tasksWithSessions = tasks.filter((t: KanbanTask) => t.sessionId);

    if (tasksWithSessions.length === 0) {
      return;
    }

    let loadedFromStore = 0;
    let loadedFromRust = 0;
    let skipped = 0;

    // Load Quack storage first (contains full ChatMessage[] with events for tool widgets)
    let store: Awaited<ReturnType<typeof Store.load>> | null = null;
    try {
      store = await Store.load('quack-chats.json');
    } catch (error) {
      console.warn('[loadKanbanChatSessions] Could not load store:', error);
    }

    for (const task of tasksWithSessions) {
      if (!task.sessionId) continue;

      try {
        // 🦆 FIX: First try to load from Quack storage (preserves events for tool widgets)
        if (store) {
          const savedChat = await store.get<{
            messages: ChatMessage[];
            tokens?: { inputTokens: number; outputTokens: number };
            sessionId?: string;
            timestamp?: number;
          }>(`chat-${task.id}`);

          if (savedChat?.messages && savedChat.messages.length > 0) {
            // 🦆 FIX: Only load from disk if we don't have messages in memory
            // NEVER overwrite in-memory messages that have events - they are SACRED
            // The "more messages on disk" condition was REMOVED because it caused formatting loss:
            // disk messages from Rust backend don't have events, so loading them destroys formatting
            setChatSessions(prev => {
              const newSessions = new Map(prev);
              const existingMessages = prev.get(task.id);

              // Check if existing messages have events (richer data)
              const existingHasEvents = existingMessages?.some(m => m.events && m.events.length > 0);
              const savedHasEvents = savedChat.messages.some(m => m.events && m.events.length > 0);

              // Only overwrite if:
              // 1. No existing messages in memory, OR
              // 2. Saved has events and existing doesn't (upgrade quality)
              // REMOVED: "savedChat.messages.length > existingMessages.length" - this caused formatting loss!
              const shouldOverwrite =
                !existingMessages ||
                existingMessages.length === 0 ||
                (savedHasEvents && !existingHasEvents);

              if (shouldOverwrite) {
                newSessions.set(task.id, savedChat.messages);
              }

              return newSessions;
            });

            // Also restore tokens if available
            if (savedChat.tokens) {
              setChatTokensMap(prev => {
                const newMap = new Map(prev);
                // Provide defaults for missing fields (older saves may not have all fields)
                newMap.set(task.id, {
                  inputTokens: savedChat.tokens!.inputTokens || 0,
                  outputTokens: savedChat.tokens!.outputTokens || 0,
                  cacheCreationTokens: (savedChat.tokens as { cacheCreationTokens?: number }).cacheCreationTokens || 0,
                  cacheReadTokens: (savedChat.tokens as { cacheReadTokens?: number }).cacheReadTokens || 0,
                  totalCost: (savedChat.tokens as { totalCost?: number }).totalCost || 0,
                });
                return newMap;
              });
            }

            loadedFromStore++;
            continue; // Successfully loaded, skip Rust backend fallback
          }
        }

        // Fallback: Load from Rust backend (loses events, shows raw text only)
        const details = await invoke<{
          id: string;
          messages: Array<{ role: string; content: string; timestamp?: number }>;
        }>('get_session_details', { sessionId: task.sessionId });

        if (details?.messages && details.messages.length > 0) {
          // Convert SessionHistoryMessage to ChatMessage (without events - raw text display)
          const chatMessages: ChatMessage[] = details.messages.map((msg, index) => ({
            id: `kanban-${task.id}-restored-${index}`,
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
            timestamp: msg.timestamp || Date.now(),
            status: 'complete' as const,
          }));

          // 🦆 CRITICAL FIX: Don't overwrite in-memory messages that have events
          // Rust backend fallback loses events, so only use if no better data exists
          // This protects session integrity in-memory (same principle as store protection below)
          setChatSessions(prev => {
            const newSessions = new Map(prev);
            const existingMessages = prev.get(task.id);

            // Check if existing messages have events (richer data)
            const existingHasEvents = existingMessages?.some(m => m.events && m.events.length > 0);
            const newHasEvents = chatMessages.some(m => m.events && m.events.length > 0);

            // Only load from Rust if:
            // 1. We have NO messages in memory OR
            // 2. Existing messages don't have events AND new messages do (upgrade) OR
            // 3. Neither has events (both poor quality, so refresh)
            if (!existingMessages || existingMessages.length === 0 || (!existingHasEvents && newHasEvents) || (!existingHasEvents && !newHasEvents)) {
              newSessions.set(task.id, chatMessages);
            } else {
              return prev; // Don't modify - session is SACRED
            }
            return newSessions;
          });

          // 🦆 CRITICAL FIX: NEVER save event-less messages - they corrupt session data
          // Sessions are SACRED - don't overwrite rich messages with poor fallback data
          // The Rust backend fallback creates messages WITHOUT events field, which causes:
          // 1. Loss of formatting (no tool_use/tool_result events)
          // 2. Potential message mixing between sessions
          // We ONLY save if messages have events OR if there's no existing data in store
          if (store) {
            const hasEvents = chatMessages.some(m => m.events && m.events.length > 0);
            const existingStoreData = await store.get<{
              messages: ChatMessage[];
              tokens?: { inputTokens: number; outputTokens: number };
              sessionId?: string;
              timestamp?: number;
            }>(`chat-${task.id}`);
            const existingHasEvents = existingStoreData?.messages?.some((m: ChatMessage) => m.events && m.events.length > 0);

            // Only save if:
            // 1. Messages have events (rich data from streaming) OR
            // 2. No existing data in store (first time) OR
            // 3. Existing data also lacks events (both are poor quality, so update timestamp)
            if (hasEvents || !existingStoreData || !existingHasEvents) {
              await store.set(`chat-${task.id}`, {
                messages: chatMessages,
                sessionId: task.sessionId,
                timestamp: Date.now(),
              });
              await store.save();
            }
          }

          loadedFromRust++;
        } else {
          skipped++;
        }
      } catch (error) {
        console.warn(`[loadKanbanChatSessions] Failed to load task ${task.id}:`, error);
      }
    }

    console.log(`[loadKanbanChatSessions] Done: ${loadedFromStore} from store, ${loadedFromRust} from Rust, ${skipped} skipped (total: ${tasksWithSessions.length})`);
  }, []);

  // 🦆 Save Kanban chat session to persistent storage
  const saveKanbanChatSession = useCallback(async (taskId: string, messages: ChatMessage[], sessionId?: string) => {
    try {
      const store = await Store.load('quack-chats.json');
      const tokens = chatTokensMap.get(taskId);

      await store.set(`chat-${taskId}`, {
        messages,
        tokens,
        sessionId,
        timestamp: Date.now(),
      });
      await store.save();

      console.log(`[saveKanbanChatSession] Saved ${messages.length} messages for task ${taskId}`);
    } catch (error) {
      console.warn('[saveKanbanChatSession] Failed to save chat:', error);
    }
  }, [chatTokensMap]);

  // Send message for a specific agent (used by Kanban)
  const sendMessageForTargetAgent = useCallback(async (targetAgentId: string, content: string, options?: ChatSendOptions) => {
    if (!content.trim() || !targetAgentId) return;

    // Store the original activeId to restore later
    const originalActiveId = activeId;

    // Temporarily set activeId to the target for the sendMessageForAgent function
    // Note: This is a workaround since sendMessageForAgent uses activeId internally
    // A cleaner solution would refactor sendMessageForAgent to accept targetAgentId

    // For now, we'll duplicate the core logic here for Kanban tasks
    // This ensures Kanban chat sessions are isolated from main agent sessions

    // Check if chat is configured
    if (!isChatConfigured) {
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now()}-error-${Math.random().toString(36).substr(2, 9)}`,
        role: 'assistant',
        content: 'Quack quack! Claude CLI is not available. Please make sure Claude Code CLI is installed and you are logged in.',
        timestamp: Date.now(),
        status: 'error',
        error: 'Not configured',
      };
      setChatSessions((prev) => {
        const newSessions = new Map(prev);
        const agentMessages = newSessions.get(targetAgentId) ?? [];
        newSessions.set(targetAgentId, [...agentMessages, errorMessage]);
        return newSessions;
      });
      return;
    }

    // Generate unique message ID for this stream
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const streamKey = `${targetAgentId}-${messageId}`;

    console.log(`[sendMessageForTargetAgent] Starting stream ${streamKey} for Kanban task`);

    // 🦆 SESSIONS-FIRST: Get session for conversation continuity
    // In sessions-first architecture, targetAgentId IS the sessionId
    const { sessions } = useSessionStore.getState();
    const session = sessions.find(s => s.id === targetAgentId);
    const existingSessionId = session?.claudeSessionId;
    if (existingSessionId) {
      console.log(`[sendMessageForTargetAgent] Resuming session ${existingSessionId} for task ${targetAgentId}`);
    }

    // 🦆 SESSIONS-FIRST: Auto-transition session from TODO to in_progress
    if (session && session.status === 'todo') {
      console.log(`[sendMessageForTargetAgent] Auto-transitioning session ${targetAgentId} from TODO to in_progress`);
      const { updateSession } = useSessionStore.getState();
      await updateSession(targetAgentId, { status: 'in_progress', updatedAt: Date.now() });
    }

    // 🦆 SESSIONS-FIRST: Re-fetch session after potential status change
    const { sessions: updatedSessions } = useSessionStore.getState();
    const updatedSession = updatedSessions.find(s => s.id === targetAgentId);

    // 🦆 BRANCH-PER-SESSION: Use session's worktreePath if available, then projectPath
    const effectiveWorkingDirectory = updatedSession?.worktreePath || updatedSession?.projectPath || options?.workingDirectory || '/';
    console.log(`[sendMessageForTargetAgent] Using working directory: ${effectiveWorkingDirectory}`)

    // Save the prompt for restoration on abort
    lastPromptsRef.current.set(targetAgentId, content);

    // Create abort controller
    const abortController = new AbortController();
    abortControllersRef.current.set(streamKey, abortController);

    // Track this stream as active
    if (!activeStreamsRef.current.has(targetAgentId)) {
      activeStreamsRef.current.set(targetAgentId, new Set());
    }
    activeStreamsRef.current.get(targetAgentId)!.add(streamKey);

    // Get current messages for this agent
    const currentMessagesSnapshot = chatSessions.get(targetAgentId) ?? [];

    // Create user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user-${Math.random().toString(36).substr(2, 9)}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
    };

    // Add user message
    setChatSessions((prev) => {
      return appendMessagesToSession(prev, targetAgentId, [userMessage]);
    });

    // Set loading for this agent
    setChatLoadingMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(targetAgentId, true);
      return newMap;
    });

    // Create assistant message placeholder
    const turnId = createChatTurnId();
    const assistantMessageId = `msg-${Date.now()}-assistant-${Math.random().toString(36).substr(2, 9)}`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: 0,
      status: 'streaming',
      settings: {
        model: getActiveModelName(options?.model),
        // Brain: task-effort-model-aware-refactor
        effort: options?.effort || defaultEffortForModel(options?.model || ''),
        thinkingMode: options?.thinkingMode || 'auto',
        modelDisplayName: getActiveModelDisplayName(options?.model) || undefined,
      },
      metadata: { turnId },
    };

    activeQueryIdRef.current.set(targetAgentId, turnId);
    abortedTurnIdsRef.current.delete(targetAgentId);

    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      const agentMessages = newSessions.get(targetAgentId) ?? [];

      // Brain: fix-late-render-abort-stale-buffer
      // Discard any stale buffered events — same reasoning as sendMessageForAgent.
      if (eventBufferRef.current.has(targetAgentId)) {
        const staleCount = eventBufferRef.current.get(targetAgentId)!.length;
        console.log(`🦆 [sendMessageForTargetAgent] Discarding ${staleCount} stale buffered events for ${targetAgentId}`);
        eventBufferRef.current.delete(targetAgentId);
      }
      newSessions.set(targetAgentId, [...agentMessages, assistantMessage]);
      return newSessions;
    });

    try {
      // Ensure listener is ready for this Kanban task
      await ensureListenerReady(targetAgentId);
      await new Promise(resolve => setTimeout(resolve, 150));

      let prompt = content;

      // Build IDE context (open file, selection) as a separate field
      // Injected into system prompt by Node.js — not concatenated into user message
      const ideContext = await buildContextPrefix(effectiveWorkingDirectory ?? null);

      // Create abort promise
      const abortPromise = new Promise<never>((_, reject) => {
        if (abortController.signal.aborted) {
          reject(new Error('Aborted'));
        }
        abortController.signal.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
      });

      // Call Rust backend
      const response = await Promise.race([
        invoke<{
          result: string;
          session_id: string;
          total_cost_usd: number;
          usage: UsageStats;
        }>('send_message_via_sdk_streaming', {
          agentId: targetAgentId,
          // Brain: 037-anthropic-compatible-providers
          request: await (async () => {
            const prf = getProviderRequestFields(remoteModels, options?.model);
            const providerConfig = await getActiveProviderConfig(targetAgentId);
            // 🦆 AUTOMATION FIX: If a non-anthropic provider is specified in options,
            // override provider fields so Ollama/custom models resolve correctly
            const isJobProvider = options?.provider && options.provider !== 'anthropic';
            const { providerBaseUrl: globalBaseUrl, providerApiKey: globalApiKey } = useSettingsStore.getState().claude;
            return {
            prompt,
            // 🦆 MODEL FIX: For non-anthropic providers, use model ID directly; for Anthropic, resolve friendly name
            model: isJobProvider ? (options?.model || 'opus46') : prf.resolveModel(options?.model || 'opus46'),
            thinkingMode: options?.thinkingMode,
            permissionMode: options?.permissionMode,
            // Extract only file paths from ChatAttachment objects - Rust expects Vec<String>
            attachments: (options?.attachments || []).map(att => att.path).filter(Boolean),
            // 🦆 WORKTREE ISOLATION: Use effectiveWorkingDirectory which prioritizes worktreePath
            cwd: effectiveWorkingDirectory,
            sessionId: existingSessionId,
            turnId,
            effort: options?.effort,
            allowedTools: [
              'Skill', 'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
              'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
              'AskUserQuestion',
            ],
            sessionKey: targetAgentId,
            // 🦆 LLM Provider fields (Ollama/custom support)
            provider: isJobProvider ? options.provider : prf.provider,
            providerBaseUrl: isJobProvider ? (globalBaseUrl || 'http://localhost:11434') : prf.providerBaseUrl,
            providerApiKey: isJobProvider && options.provider === 'custom' ? globalApiKey : prf.providerApiKey,
            // Brain: 037-anthropic-compatible-providers
            providerConfig,
            toolSearchMode: useSettingsStore.getState().claude.toolSearchMode,
            // IDE context: injected into system prompt by Node.js, not into user message
            ideContext: ideContext || undefined,
          };
          })(),
        }),
        abortPromise,
      ]);

      // Update message with final result
      setChatSessions((prev) => {
        const newSessions = new Map(prev);
        const agentMessages = newSessions.get(targetAgentId) ?? [];
        newSessions.set(
          targetAgentId,
          agentMessages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: response.result,
                  status: 'complete' as const,
                  metadata: {
                    ...msg.metadata,
                    ...(response.usage ? {
                      turnUsage: {
                        input_tokens: response.usage.input_tokens || 0,
                        output_tokens: response.usage.output_tokens || 0,
                        cache_read_input_tokens: response.usage.cache_read_input_tokens || 0,
                        cache_creation_input_tokens: response.usage.cache_creation_input_tokens || 0,
                      },
                    } : {}),
                    turnCost: response.total_cost_usd,
                  },
                }
              : msg
          )
        );
        return newSessions;
      });

      // Update tokens
      setChatTokensMap((prev) => {
        const newMap = new Map(prev);
        const current = newMap.get(targetAgentId) || {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalCost: 0,
        };
        newMap.set(targetAgentId, {
          inputTokens: current.inputTokens + (response.usage?.input_tokens || 0),
          outputTokens: current.outputTokens + (response.usage?.output_tokens || 0),
          cacheCreationTokens: current.cacheCreationTokens + (response.usage?.cache_creation_input_tokens || 0),
          cacheReadTokens: current.cacheReadTokens + (response.usage?.cache_read_input_tokens || 0),
          totalCost: current.totalCost + response.total_cost_usd,
          // Preserve contextWindow so stamina bar stays visible between turns
          contextWindow: current.contextWindow,
        });
        return newMap;
      });

      console.log(`[sendMessageForTargetAgent] Completed for ${targetAgentId}, session_id: ${response.session_id}`);

      // 🦆 SESSIONS-FIRST: Save claudeSessionId in session store for resume support
      if (response.session_id) {
        const { updateSession: updateSess } = useSessionStore.getState();
        await updateSess(targetAgentId, {
          claudeSessionId: response.session_id,
          messageCount: (updatedSession?.messageCount || 0) + 2, // user + assistant
          inputTokens: (updatedSession?.inputTokens || 0) + (response.usage?.input_tokens || 0),
          outputTokens: (updatedSession?.outputTokens || 0) + (response.usage?.output_tokens || 0),
          cacheCreationTokens: (updatedSession?.cacheCreationTokens || 0) + (response.usage?.cache_creation_input_tokens || 0),
          cacheReadTokens: (updatedSession?.cacheReadTokens || 0) + (response.usage?.cache_read_input_tokens || 0),
          totalCost: (updatedSession?.totalCost || 0) + response.total_cost_usd,
        });
      }

      // 🦆 CRITICAL: Save sessionId in Kanban task for persistence across app restarts
      if (response.session_id) {
        const { updateTask, getTasksByStatus } = useKanbanStore.getState();
        // Get current task to accumulate token values
        const allTasks = [...getTasksByStatus('todo'), ...getTasksByStatus('in_progress'), ...getTasksByStatus('done')];
        const kanbanTask = allTasks.find(t => t.id === targetAgentId);
        
        await updateTask(targetAgentId, {
          sessionId: response.session_id,
          // Also update token usage on the task
          inputTokens: (kanbanTask?.inputTokens || 0) + (response.usage?.input_tokens || 0),
          outputTokens: (kanbanTask?.outputTokens || 0) + (response.usage?.output_tokens || 0),
          cacheCreationTokens: (kanbanTask?.cacheCreationTokens || 0) + (response.usage?.cache_creation_input_tokens || 0),
          cacheReadTokens: (kanbanTask?.cacheReadTokens || 0) + (response.usage?.cache_read_input_tokens || 0),
          totalCost: (kanbanTask?.totalCost || 0) + response.total_cost_usd,
        });
        console.log(`[sendMessageForTargetAgent] Saved sessionId ${response.session_id} to Kanban task ${targetAgentId}`);
      }

      // 🦆 SESSIONS-FIRST: Notify that session agent completed response (plays Quack sound + toast)
      // Find session info to get a better label
      const { sessions: finalSessions } = useSessionStore.getState();
      const finalSession = finalSessions.find(s => s.id === targetAgentId);
      const taskLabel = finalSession?.title || 'Session Task';
      const taskCwd = finalSession?.projectPath || '';
      notifyAgentReadyRef.current({ id: targetAgentId, label: taskLabel, cwd: taskCwd });

      // 🦆 Save chat session to persistent storage
      // CRITICAL: Build final messages manually to avoid React state timing issues
      // chatSessions.get() would return STALE data because setChatSessions hasn't flushed yet
      const finalUserMessage: ChatMessage = {
        ...userMessage,
        status: 'complete' as const, // User message is complete after sending
      };
      const finalAssistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: 'assistant',
        content: response.result,
        timestamp: Date.now(),
        status: 'complete' as const,
        settings: {
          model: options?.model || 'opus47',
          // Brain: task-effort-model-aware-refactor
          effort: options?.effort || defaultEffortForModel(options?.model || ''),
          thinkingMode: options?.thinkingMode || 'auto',
          modelDisplayName: getActiveModelDisplayName(options?.model) || undefined,
        },
        metadata: { turnId },
      };
      const messagesToSave = [...currentMessagesSnapshot, finalUserMessage, finalAssistantMessage];
      await saveKanbanChatSession(targetAgentId, messagesToSave, response.session_id);

    } catch (err) {
      console.error('[sendMessageForTargetAgent] Error:', err);

      const wasAborted = abortController.signal.aborted;

      setChatSessions((prev) => {
        const newSessions = new Map(prev);
        const agentMessages = newSessions.get(targetAgentId) ?? [];
        newSessions.set(
          targetAgentId,
          agentMessages.map((msg) =>
            msg.id === assistantMessageId
              ? {
                  ...msg,
                  content: wasAborted ? 'Stream stopped by user' : `Error: ${err instanceof Error ? err.message : String(err)}`,
                  status: 'error' as const,
                  error: wasAborted ? 'Aborted' : String(err),
                }
              : msg
          )
        );
        if (wasAborted) {
          const abortedTurnIds = abortedTurnIdsRef.current.get(targetAgentId) ?? new Set<string>();
          abortedTurnIds.add(turnId);
          abortedTurnIdsRef.current.set(targetAgentId, abortedTurnIds);
          eventBufferRef.current.delete(targetAgentId);
          activeQueryIdRef.current.delete(targetAgentId);
        }
        return newSessions;
      });
    } finally {
      // Clear loading state
      setChatLoadingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(targetAgentId, false);
        return newMap;
      });

      // Clean up stream tracking
      activeStreamsRef.current.get(targetAgentId)?.delete(streamKey);
      abortControllersRef.current.delete(streamKey);
    }
  }, [isChatConfigured, chatSessions, ensureListenerReady, saveKanbanChatSession, remoteModels]);

  // Abort stream for a specific agent (used by Kanban)
  const abortStreamForTargetAgent = useCallback((targetAgentId: string) => {
    const activeStreams = activeStreamsRef.current.get(targetAgentId);
    if (!activeStreams || activeStreams.size === 0) {
      console.log('[abortStreamForTargetAgent] No active streams for:', targetAgentId);
      return;
    }

    console.log(`[abortStreamForTargetAgent] Aborting ${activeStreams.size} stream(s) for: ${targetAgentId}`);

    activeStreams.forEach((streamKey) => {
      const abortController = abortControllersRef.current.get(streamKey);
      if (abortController && !abortController.signal.aborted) {
        abortController.abort();
      }
    });

    // Kill the backend Node.js process so it stops immediately
    invoke('abort_sdk_stream', { sessionKey: targetAgentId }).catch((err) => {
      console.warn('[abortStreamForTargetAgent] Failed to kill backend process:', err);
    });
  }, []);

  // Clear conversation for a specific agent (used by Kanban)
  const clearConversationForTargetAgent = useCallback((targetAgentId: string) => {
    // Clear local UI state
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      newSessions.set(targetAgentId, []);
      return newSessions;
    });

    // Clear last prompt
    lastPromptsRef.current.delete(targetAgentId);

    // Clear tokens
    setChatTokensMap((prev) => {
      const newMap = new Map(prev);
      newMap.delete(targetAgentId);
      return newMap;
    });

    console.log('[clearConversationForTargetAgent] Cleared for:', targetAgentId);
  }, []);

  // Get last prompt for a specific agent (used by Kanban)
  const getLastPromptForTargetAgent = useCallback((targetAgentId: string): string | null => {
    return lastPromptsRef.current.get(targetAgentId) || null;
  }, []);

  // Compact conversation for a specific agent (used by Kanban)
  const compactConversationForTargetAgent = useCallback(async (targetAgentId: string) => {
    const currentMessages = chatSessions.get(targetAgentId) ?? [];
    const totalMessages = currentMessages.length;

    // Need at least 6 messages to compact (keep last 5, summarize the rest)
    if (totalMessages < 6) {
      toast.info('Not enough messages to compact (need at least 6)', {
        duration: 3000,
      });
      return;
    }

    console.log('[compactConversationForTargetAgent] Starting compaction for:', targetAgentId);

    try {
      // Keep last 5 messages, summarize everything before
      const messagesToKeep = 5;
      const messagesToSummarize = currentMessages.slice(0, totalMessages - messagesToKeep);
      const messagesToPreserve = currentMessages.slice(totalMessages - messagesToKeep);

      // Create a text representation of messages to summarize
      const conversationText = messagesToSummarize
        .map((msg) => {
          const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
          return `${role}: ${msg.content}`;
        })
        .join('\n\n');

      // Create the compaction prompt (similar to Claude Code's /compact)
      const compactPrompt = `Please create a concise summary of the following conversation history. Focus on:
- Key decisions and conclusions reached
- Important code changes or implementations discussed
- Critical context needed for future interactions
- Technical details that should not be lost

Keep the summary brief but informative (aim for 200-300 words maximum).

Conversation to summarize:
${conversationText}

Please respond ONLY with the summary, no preamble or explanations.`;

      // Show loading indicator
      toast.loading('Compacting conversation...', {
        duration: 1000,
        id: 'compacting',
      });

      // Set loading state
      setChatLoadingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(targetAgentId, true);
        return newMap;
      });

      // Generate unique message ID
      const messageId = `msg-${Date.now()}-compact`;

      // 🦆 SESSIONS-FIRST: Get working directory from session
      const { sessions: compactSessions } = useSessionStore.getState();
      const compactSession = compactSessions.find(s => s.id === targetAgentId);
      const workingDir = compactSession?.projectPath || explorerPath;

      // Call Claude to generate summary using Haiku (faster + cheaper for summaries)
      const response = await invoke<{
        result: string;
        session_id: string;
        total_cost_usd: number;
        usage: UsageStats;
      }>('send_message_via_sdk_streaming', {
        agentId: targetAgentId,
        // Brain: 037-anthropic-compatible-providers
        request: await (async () => {
          const prf = getProviderRequestFields(remoteModels);
          const providerConfig = await getActiveProviderConfig(targetAgentId);
          return {
          prompt: compactPrompt,
          model: prf.resolveModel('haiku'),
          permissionMode: 'bypass',
          cwd: workingDir,
          allowedTools: [
            'Skill', 'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
            'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
            'AskUserQuestion',
          ],
          sessionKey: targetAgentId,
          provider: prf.provider,
          providerBaseUrl: prf.providerBaseUrl,
          providerApiKey: prf.providerApiKey,
          providerConfig,
        };
        })(),
      });

      // Create a system message with the summary
      const summaryMessage: ChatMessage = {
        id: messageId,
        role: 'assistant',
        content: `📦 **Conversation Summary** (${messagesToSummarize.length} messages compacted)\n\n${response.result}`,
        timestamp: Date.now(),
        status: 'complete',
        events: [],
      };

      // Replace old messages with summary + keep recent messages
      setChatSessions((prev) => {
        const newSessions = new Map(prev);
        newSessions.set(targetAgentId, [summaryMessage, ...messagesToPreserve]);
        return newSessions;
      });

      console.log(`[compactConversationForTargetAgent] Compaction complete: ${messagesToSummarize.length} messages → 1 summary`);

      // Reset tokens to 0 after compact. The next SDK result event will report
      // the real context window size post-compact, giving us accurate numbers.
      const currentTokens = chatTokensMap.get(targetAgentId);
      setChatTokensMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(targetAgentId, {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalCost: currentTokens?.totalCost || 0, // Preserve cumulative cost
          contextWindow: currentTokens?.contextWindow, // Preserve so stamina bar stays visible
        });
        return newMap;
      });

      toast.dismiss('compacting');
      toast.success(`Compacted! ${messagesToSummarize.length} messages summarized. Token count will update on next message.`, {
        duration: 5000,
      });

    } catch (error) {
      console.error('[compactConversationForTargetAgent] Failed to compact:', error);
      toast.dismiss('compacting');
      toast.error('Failed to compact conversation');
    } finally {
      // Clear loading state
      setChatLoadingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(targetAgentId, false);
        return newMap;
      });
    }
  }, [chatSessions, chatTokensMap, explorerPath, remoteModels]);

  // ============================================
  // END KANBAN CHAT INTEGRATION FUNCTIONS
  // ============================================

  // Compact conversation for current agent (custom implementation since SDK /compact is buggy)
  // 🦆 SESSION-FIRST: Use chatKey (sessionId when available) for message lookup
  // 🦆 FIX SESSION MIXING: Only use activeSessionId, no fallback
  const compactCurrentAgentConversation = useCallback(async () => {
    const chatKey = activeSessionId;
    if (!chatKey) {
      console.warn('[compactConversation] No activeSessionId set, cannot compact');
      return;
    }

    const currentMessages = chatSessions.get(chatKey) ?? [];
    const totalMessages = currentMessages.length;

    // Need at least 6 messages to compact (keep last 5, summarize the rest)
    if (totalMessages < 6) {
      toast.info('Not enough messages to compact (need at least 6)', {
        duration: 3000,
      });
      return;
    }

    console.log('[compactConversation] Starting compaction for chatKey:', chatKey);

    try {
      // Keep last 5 messages, summarize everything before
      const messagesToKeep = 5;
      const messagesToSummarize = currentMessages.slice(0, totalMessages - messagesToKeep);
      const messagesToPreserve = currentMessages.slice(totalMessages - messagesToKeep);

      // Create a text representation of messages to summarize
      const conversationText = messagesToSummarize
        .map((msg) => {
          const role = msg.role === 'user' ? 'User' : msg.role === 'assistant' ? 'Assistant' : 'System';
          return `${role}: ${msg.content}`;
        })
        .join('\n\n');

      // Create the compaction prompt (similar to Claude Code's /compact)
      const compactPrompt = `Please create a concise summary of the following conversation history. Focus on:
- Key decisions and conclusions reached
- Important code changes or implementations discussed
- Critical context needed for future interactions
- Technical details that should not be lost

Keep the summary brief but informative (aim for 200-300 words maximum).

Conversation to summarize:
${conversationText}

Please respond ONLY with the summary, no preamble or explanations.`;

      // Show loading indicator
      toast.loading('Compacting conversation...', {
        duration: 1000,
        id: 'compacting',
      });

      // Set loading state
      setChatLoadingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(chatKey, true);
        return newMap;
      });

      // Generate unique message ID
      const messageId = `msg-${Date.now()}-compact`;

      // Call Claude to generate summary using Haiku (faster + cheaper for summaries)
      const response = await invoke<{
        result: string;
        session_id: string;
        total_cost_usd: number;
        usage: UsageStats;
      }>('send_message_via_sdk_streaming', {
        agentId: activeId,
        // Brain: 037-anthropic-compatible-providers
        request: await (async () => {
          const prf = getProviderRequestFields(remoteModels);
          const providerConfig = await getActiveProviderConfig(activeId);
          return {
          prompt: compactPrompt,
          model: prf.resolveModel('haiku'),
          permissionMode: 'bypass',
          cwd: activeTerminal?.cwd ?? explorerPath,
          allowedTools: [
            'Skill', 'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
            'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
            'AskUserQuestion',
          ],
          sessionKey: activeId,
          provider: prf.provider,
          providerBaseUrl: prf.providerBaseUrl,
          providerApiKey: prf.providerApiKey,
          providerConfig,
        };
        })(),
      });

      // Create a system message with the summary
      const summaryMessage: ChatMessage = {
        id: messageId,
        role: 'assistant',
        content: `📦 **Conversation Summary** (${messagesToSummarize.length} messages compacted)\n\n${response.result}`,
        timestamp: Date.now(),
        status: 'complete',
        events: [],
      };

      // Replace old messages with summary + keep recent messages
      setChatSessions((prev) => {
        const newSessions = new Map(prev);
        newSessions.set(chatKey, [summaryMessage, ...messagesToPreserve]);
        return newSessions;
      });

      console.log(`[compactConversation] Compaction complete: ${messagesToSummarize.length} messages → 1 summary`);

      // Reset tokens to 0 after compact. The next SDK result event will report
      // the real context window size post-compact, giving us accurate numbers.
      const currentTokens = chatTokensMap.get(chatKey);
      setChatTokensMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(chatKey, {
          inputTokens: 0,
          outputTokens: 0,
          cacheCreationTokens: 0,
          cacheReadTokens: 0,
          totalCost: currentTokens?.totalCost || 0, // Preserve cumulative cost
          contextWindow: currentTokens?.contextWindow, // Preserve so stamina bar stays visible
        });
        return newMap;
      });

      toast.dismiss('compacting');
      toast.success(`Compacted! ${messagesToSummarize.length} messages summarized. Token count will update on next message.`, {
        duration: 5000,
      });

    } catch (error) {
      console.error('[compactConversation] Failed to compact:', error);
      toast.dismiss('compacting');
      toast.error('Failed to compact conversation');
    } finally {
      // Clear loading state
      setChatLoadingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(chatKey, false);
        return newMap;
      });
    }
  }, [activeSessionId, chatSessions, chatTokensMap, activeTerminal, explorerPath, remoteModels]);

  // Clear conversation for current agent (Claude SDK /clear command)
  const clearCurrentAgentConversation = useCallback(async () => {
    if (!activeId || !sendMessageForAgentRef.current) return;

    // Show confirmation dialog
    const confirmed = await confirm('Are you sure you want to clear this conversation? This action cannot be undone.', {
      title: 'Clear Conversation',
      kind: 'warning',
    });

    if (!confirmed) return;

    try {
      // Send /clear command to Claude SDK first
      await sendMessageForAgentRef.current('/clear');

      // Clear local UI state
      setChatSessions((prev) => {
        const newSessions = new Map(prev);
        newSessions.set(activeId, []);
        return newSessions;
      });

      // Clear last prompt
      lastPromptsRef.current.delete(activeId);

      // Clear tokens for this agent
      setChatTokensMap((prev) => {
        const newMap = new Map(prev);
        newMap.delete(activeId);
        return newMap;
      });

      // Clear session ID for this agent
      setChatSessionIds((prev) => {
        const newMap = new Map(prev);
        newMap.delete(activeId);
        return newMap;
      });

      // 🦆 STAMINA PRESERVATION: Reset token counts and session ID in agentChats
      setAgentChats((prev) => {
        return prev.map((agent) => {
          if (agent.id === activeId) {
            return {
              ...agent,
              sessionId: undefined,
              inputTokens: 0,
              outputTokens: 0,
              cacheCreationTokens: 0,
              cacheReadTokens: 0,
            };
          }
          return agent;
        });
      });

      toast.success('Conversation cleared');
    } catch (error) {
      console.error('Failed to clear conversation:', error);
      toast.error('Failed to clear conversation');
    }
  }, [activeId]);

  // 🛡️ ToolPermission: Respond to a tool permission request (Ask mode)
  // Brain: pattern-permission-modes (Ask mode)
  const respondToToolPermission = useCallback(async (
    requestId: string,
    approved: boolean,
    feedback?: string
  ) => {
    const pending = pendingToolPermissions.get(requestId);
    if (!pending) {
      console.error('[App] Cannot respond to tool permission: no pending request', requestId);
      return;
    }

    const processKey = pending.sessionKey || pending.agentId;
    try {
      await invoke('answer_user_question', {
        agentId: processKey,
        requestId,
        answers: { approved, feedback: feedback || '' },
      });
      console.log(`🛡️ Tool permission ${approved ? 'ALLOWED' : 'DENIED'}: ${pending.toolName} (requestId=${requestId})`);
    } catch (error) {
      console.error('[App] Failed to respond to tool permission:', error);
    }

    // Remove from pending + clear sidebar dot via pendingQuestionIdsMap
    // Must use this path (not direct chatStore) so the sync useEffect propagates removal
    const pendingKey = pending.sessionKey || pending.agentId;
    setPendingQuestionIdsMap((prev) => {
      const newMap = new Map(prev);
      const pendingSet = new Set<string>(newMap.get(pendingKey) || new Set<string>());
      pendingSet.delete(`tp-${requestId}`);
      if (pendingSet.size === 0) {
        newMap.delete(pendingKey);
      } else {
        newMap.set(pendingKey, pendingSet);
      }
      return newMap;
    });
    setPendingToolPermissions((prev) => {
      const next = new Map(prev);
      next.delete(requestId);
      return next;
    });
  }, [pendingToolPermissions]);

  // 🛡️ "Allow always for [ToolName]": approve + whitelist tool for rest of session
  // Brain: pattern-permission-modes (Ask mode)
  const handleAllowAlwaysTool = useCallback(async (requestId: string) => {
    const pending = pendingToolPermissions.get(requestId);
    if (!pending) return;

    // 1. Add tool to auto-approved set for this session
    const approveKey = pending.sessionKey || pending.agentId;
    const existing = autoApprovedToolsRef.current.get(approveKey) || new Set<string>();
    existing.add(pending.toolName);
    autoApprovedToolsRef.current.set(approveKey, existing);
    console.log(`🛡️ [ALLOW-ALWAYS] ${pending.toolName} whitelisted for session ${approveKey}. Auto-approved tools:`, Array.from(existing));

    // 2. Approve this request (reuses respondToToolPermission logic)
    await respondToToolPermission(requestId, true);
  }, [pendingToolPermissions, respondToToolPermission]);

  // 🗣️ AskUserQuestion: Answer a question from Claude for the current agent
  // Uses stdin bidirectional communication with requestId
  // 🦆 FIX: Now accepts sessionKey to prevent cross-session contamination
  const answerUserQuestionForAgent = useCallback(async (
    toolUseId: string,
    answers: AskUserQuestionAnswers,
    targetSessionKey?: string // 🦆 FIX: Session key from the UI component showing the question
  ) => {
    if (!activeId) {
      console.error('[App] Cannot answer question: no active agent');
      return;
    }

    // 🦆 FIX: Helper to find requestId with retry support for race conditions
    // Now filters by BOTH agentId AND sessionKey to prevent session mixing
    // 🦆 FIX: Returns the MOST RECENT (last inserted) match to avoid stale requestIds
    const findRequestId = (): { requestId: string | null; sessionKey?: string; questions: unknown[] } => {
      let latest: { requestId: string; sessionKey?: string; questions: unknown[] } | null = null;

      for (const [requestId, data] of pendingUserQuestions.entries()) {
        // 🦆 FIX: Match by agentId AND sessionKey (if provided) to prevent cross-session contamination
        const agentMatches = data.agentId === activeId;
        const sessionMatches = !targetSessionKey || data.sessionKey === targetSessionKey;

        if (agentMatches && sessionMatches) {
          // Keep iterating to find the LAST (most recent) match in insertion order
          latest = { requestId, sessionKey: data.sessionKey, questions: data.questions };
        }
      }

      return latest || { requestId: null, sessionKey: undefined, questions: [] };
    };

    // 🦆 FIX: Retry with exponential backoff for race conditions
    // Total wait time: 200ms + 400ms + 800ms = 1400ms before giving up
    const MAX_RETRY_ATTEMPTS = 4;
    const BASE_RETRY_DELAY_MS = 200;

    let foundRequestId: string | null = null;
    let foundSessionKey: string | undefined = undefined;
    let foundQuestions: unknown[] = [];

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      const result = findRequestId();
      if (result.requestId) {
        foundRequestId = result.requestId;
        foundSessionKey = result.sessionKey;
        foundQuestions = result.questions;
        if (attempt > 0) {
          console.info(`[App] 🗣️ Found requestId on attempt ${attempt + 1}:`, foundRequestId);
        }
        break;
      }

      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delay = BASE_RETRY_DELAY_MS * Math.pow(2, attempt);
        console.info(`[App] 🗣️ No pending requestId found, retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRY_ATTEMPTS})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    if (!foundRequestId) {
      console.error('[App] Cannot answer question: no pending requestId for agent after retries', {
        activeId,
        targetSessionKey,
        pendingQuestionsSize: pendingUserQuestions.size,
        pendingQuestions: Array.from(pendingUserQuestions.entries()).map(([id, data]) => ({
          requestId: id,
          agentId: data.agentId,
          sessionKey: data.sessionKey
        }))
      });
      toast.error('Unable to submit answer. The agent may still be processing. Please wait a moment and try again.');
      return;
    }

    // 🦆 FIX: Use sessionKey if available, fallback to agentId for backwards compatibility
    const pendingKey = foundSessionKey || activeId;
    console.info('[App] 🗣️ Answering user question via stdin:', {
      activeId,
      targetSessionKey,
      foundSessionKey,
      requestId: foundRequestId,
      toolUseId,
      pendingKey,
      answersKeys: Object.keys(answers),
      // 🐛 DEBUG: Show current pending state before removal
      currentPendingForKey: Array.from(pendingQuestionIdsMap.get(pendingKey) || new Set()),
      allPendingKeys: Array.from(pendingQuestionIdsMap.keys())
    });

    // Mark question as answered immediately for UI feedback
    setAnsweredQuestionsMap(prev => {
      const newMap = new Map(prev);
      const agentAnswers = new Map(newMap.get(activeId) || new Map());
      agentAnswers.set(toolUseId, answers);
      newMap.set(activeId, agentAnswers);
      return newMap;
    });

    // Remove from pending question IDs (UI state)
    // 🦆 FIX: Use sessionKey-based pendingKey to match how it was stored
    // 🦆 FIX: Safe state updates with null checks (foundRequestId validated above)
    // 🐛 DEBUG: Try all possible keys to find where the requestId was stored
    const allPossibleKeys = [pendingKey, activeId, targetSessionKey, foundSessionKey].filter(Boolean);
    console.log('[App] 🗣️ Before removing from pendingQuestionIdsMap:', {
      pendingKey,
      activeId,
      targetSessionKey,
      foundSessionKey,
      toolUseId,
      foundRequestId,
      currentPendingForPendingKey: Array.from(pendingQuestionIdsMap.get(pendingKey) || new Set()),
      // Check all possible keys to see where it might be stored
      allPossibleKeys,
      foundInKeys: allPossibleKeys.filter(key => {
        const pending = pendingQuestionIdsMap.get(key!);
        return pending && (pending.has(foundRequestId || '') || pending.has(toolUseId));
      })
    });
    setPendingQuestionIdsMap(prev => {
      const newMap = new Map(prev);
      const pending = new Set<string>(newMap.get(pendingKey) || new Set<string>());
      console.log('[App] 🗣️ Inside setPendingQuestionIdsMap - pending before delete:', Array.from(pending));
      pending.delete(toolUseId);
      if (foundRequestId) {
        pending.delete(foundRequestId);
      }
      console.log('[App] 🗣️ Inside setPendingQuestionIdsMap - pending after delete:', Array.from(pending));
      if (pending.size === 0) {
        newMap.delete(pendingKey);
        console.log('[App] 🗣️ Deleted entire pendingKey from map');
      } else {
        newMap.set(pendingKey, pending);
        console.log('[App] 🗣️ Updated pending set for key');
      }
      return newMap;
    });

    // Remove from pendingUserQuestions (stdin state)
    if (foundRequestId) {
      setPendingUserQuestions(prev => {
        const newMap = new Map(prev);
        newMap.delete(foundRequestId);
        return newMap;
      });
    }

    try {
      // Dynamic import to avoid circular dependencies
      const { answerUserQuestionViaStdin } = await import('./services/claudeSDK');

      // Send answer via stdin to the Node.js process
      // The answers should be in the format { "header": "selected_value" }
      // 🦆 FIX: Use sessionKey (foundSessionKey) instead of agentId to support concurrent sessions
      // Process registration now uses sessionKey, so we must use the same key here
      const processKey = foundSessionKey || activeId;
      await answerUserQuestionViaStdin(
        processKey,
        foundRequestId,
        answers as Record<string, string>
      );

      console.log('[App] 🗣️ Question answered successfully via stdin');

      // Track analytics
      posthog.capture('user_question_answered', {
        question_count: Object.keys(answers).length,
        tool_use_id: toolUseId,
        agent_id: activeId,
      });
    } catch (error) {
      console.error('[App] Failed to send question answer:', error);
      toast.error('Failed to submit answer. Please try again.');

      // 🦆 FIX: Revert state with validation to allow user retry
      setAnsweredQuestionsMap(prev => {
        const newMap = new Map(prev);
        const agentAnswers = new Map(newMap.get(activeId) || new Map());
        agentAnswers.delete(toolUseId);
        newMap.set(activeId, agentAnswers);
        return newMap;
      });

      // Re-add to pending question IDs (UI state)
      setPendingQuestionIdsMap(prev => {
        const newMap = new Map(prev);
        const pending = new Set<string>(newMap.get(pendingKey) || new Set<string>());
        pending.add(toolUseId);
        newMap.set(pendingKey, pending);
        return newMap;
      });

      // Re-add to pendingUserQuestions only if we have valid data
      if (foundRequestId && foundQuestions.length > 0) {
        setPendingUserQuestions(prev => {
          const newMap = new Map(prev);
          // Only restore if not already present (avoid duplicates)
          if (!newMap.has(foundRequestId)) {
            newMap.set(foundRequestId, {
              agentId: activeId,
              sessionKey: foundSessionKey,
              questions: foundQuestions
            });
          }
          return newMap;
        });
      }

      console.info('[App] 🔄 Reverted question state - user can retry');
    }
  }, [activeId, pendingUserQuestions]);

  const updateAgentSettings = useCallback((updates: Partial<AgentChatSettings>) => {
    // 🦆 SESSIONS-FIRST: Use sessionId for settings if available, fallback to agentId
    const key = activeSessionId || activeId;
    if (!key) return;

    setAgentChatSettings((prev) => {
      const newMap = new Map(prev);

      // Get presets for fallback defaults
      const presets = useSettingsStore.getState().agentModePresets;
      const bypassPreset = presets.bypass;

      const fallbackModel = normalizeModelName(bypassPreset?.model || 'opus47');
      const current = newMap.get(key) ?? {
        inputDraft: '',
        model: fallbackModel,
        thinkingMode: bypassPreset?.thinkingMode || 'auto',
        permissionMode: 'bypass',
        // Brain: task-effort-model-aware-refactor — preset effort first, then model-aware default
        effort: bypassPreset?.effort || defaultEffortForModel(fallbackModel),
      };

      // Auto-switch settings based on permission mode using presets from settings
      let finalUpdates = { ...updates };
      if (updates.permissionMode !== undefined && updates.permissionMode !== current.permissionMode) {
        const preset = presets[updates.permissionMode as 'bypass' | 'plan' | 'ask' | 'debug' | 'chat'];
        if (preset) {
          finalUpdates.model = normalizeModelName(preset.model);
          finalUpdates.thinkingMode = preset.thinkingMode;
          finalUpdates.effort = preset.effort;
        }
      }

      newMap.set(key, { ...current, ...finalUpdates });
      return newMap;
    });
  }, [activeSessionId, activeId]);

  // 📋 PlanApproval: Approve or reject a plan from ExitPlanMode
  // Reuses the same stdin communication as AskUserQuestion
  const respondToPlanApproval = useCallback(async (
    requestId: string,
    approved: boolean,
    feedback?: string
  ) => {
    if (!activeId) {
      console.error('[App] Cannot respond to plan: no active agent');
      return;
    }

    const planData = pendingPlanApprovals.get(requestId);
    if (!planData) {
      console.error('[App] Cannot respond to plan: no pending request for', requestId);
      return;
    }

    const processKey = planData.sessionKey || planData.agentId;
    const pendingKey = planData.sessionKey || planData.agentId;

    console.info('[App] 📋 Responding to plan approval:', {
      requestId,
      approved,
      feedback,
      processKey,
    });

    // Remove from pending state
    setPendingPlanApprovals(prev => {
      const next = new Map(prev);
      next.delete(requestId);
      return next;
    });
    setPendingQuestionIdsMap(prev => {
      const newMap = new Map(prev);
      const pending = new Set<string>(newMap.get(pendingKey) || new Set<string>());
      pending.delete(requestId);
      if (pending.size === 0) {
        newMap.delete(pendingKey);
      } else {
        newMap.set(pendingKey, pending);
      }
      return newMap;
    });

    try {
      const { answerUserQuestionViaStdin } = await import('./services/claudeSDK');

      // Send response via stdin - reuse the same mechanism as AskUserQuestion
      // The backend expects { requestId, answers } format
      // We encode approved/feedback as answers that stream-daemon.js will parse
      await answerUserQuestionViaStdin(
        processKey,
        requestId,
        { approved: approved ? 'true' : 'false', feedback: feedback || '' }
      );

      console.log('[App] 📋 Plan approval response sent successfully');

      // Auto-switch to Bypass (Build) mode after plan approval so the next
      // user message lets the agent execute. The UI permission toggle updates
      // immediately so the user sees "Build" mode for their next prompt.
      if (approved) {
        updateAgentSettings({ permissionMode: 'bypass' });
      }
    } catch (error) {
      console.error('[App] Failed to send plan approval response:', error);
      toast.error('Failed to send plan response. Please try again.');

      // Revert state on error
      if (planData) {
        setPendingPlanApprovals(prev => {
          const next = new Map(prev);
          next.set(requestId, planData);
          return next;
        });
        setPendingQuestionIdsMap(prev => {
          const newMap = new Map(prev);
          const pending = new Set<string>(newMap.get(pendingKey) || new Set<string>());
          pending.add(requestId);
          newMap.set(pendingKey, pending);
          return newMap;
        });
      }
    }
  }, [activeId, pendingPlanApprovals, updateAgentSettings]);

  // Teammate stream drill-down: open a tab to view teammate's session stream
  const handleTeammateDrillDown = useCallback((sessionId: string, name: string) => {
    const tabId = `teammate-${sessionId}`;
    const existingTab = tabs.find(t => t.id === tabId);
    if (existingTab) {
      setActiveTabId(tabId);
      return;
    }

    const team = useTeamStore.getState().activeTeam;
    const member = team?.members.find(m => m.name.toLowerCase() === name.toLowerCase());

    const newTab: Tab = {
      id: tabId,
      label: name,
      type: 'teammate-stream',
      closable: true,
      color: member?.color,
      teammateSessionId: sessionId,
      teammateName: name,
    };

    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(tabId);
  }, [tabs, setActiveTabId]);

  // Open current session in terminal window with claude --resume command
  const openSessionInTerminal = useCallback(async () => {
    if (!activeId) return;

    const sessionId = chatSessionIds.get(activeId);
    if (!sessionId) {
      toast.error('No session ID found for this agent');
      return;
    }

    try {
      // Get current agent info and project path
      const currentAgent = agentChats.find((a) => a.id === activeId);
      const terminalCwd = currentAgent?.cwd || explorerPath || process.env.HOME || '~';
      const terminalLabel = `Resume ${sessionId.slice(0, 8)}`;

      // Prepare projects list from active projects (terminals in sidebar)
      const projects = activeProjects.map(project => ({
        path: project.path,
        name: project.name,
      }));

      // Open terminal window with initial command to resume session
      await openTerminalWindow(projects, {
        projectPath: terminalCwd,
        command: `claude --resume ${sessionId}`,
        terminalLabel: terminalLabel,
      });

      toast.success('Opening session in terminal window', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to open session in terminal:', error);
      toast.error('Failed to open session in terminal');
    }
  }, [activeId, chatSessionIds, agentChats, explorerPath, openTerminalWindow]);

  // 🦆 SESSIONS-FIRST: Open session in terminal window with claude --resume command
  const openKanbanSessionInTerminal = useCallback(async (sessionId: string) => {
    const session = agentSessions.find(s => s.id === sessionId);
    if (!session) {
      toast.error('Session not found');
      return;
    }

    if (!session.claudeSessionId) {
      toast.error('No Claude session ID found for this session');
      return;
    }

    try {
      const terminalCwd = session.projectPath || explorerPath || process.env.HOME || '~';
      const terminalLabel = `Resume ${session.claudeSessionId.slice(0, 8)}`;

      // Prepare projects list from active projects (terminals in sidebar)
      const projects = activeProjects.map(project => ({
        path: project.path,
        name: project.name,
      }));

      // Open terminal window with initial command to resume session
      await openTerminalWindow(projects, {
        projectPath: terminalCwd,
        command: `claude --resume ${session.claudeSessionId}`,
        terminalLabel: terminalLabel,
      });

      toast.success('Opening session in terminal window', {
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to open session in terminal:', error);
      toast.error('Failed to open session in terminal');
    }
  }, [agentSessions, agentChats, explorerPath, openTerminalWindow]);

  // Quack Agency state
  const [showQuackAgencyDrawer, setShowQuackAgencyDrawer] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, _setSelectedAgent] = useState<AgentDetails | null>(null);
  // activeAgent moved to top of component for TypeScript hoisting
  const [pendingAgentMention, setPendingAgentMention] = useState<AgentInfo | null>(null); // Agent to insert as @mention in input
  const [pendingFileMention, setPendingFileMention] = useState<{ name: string; path: string; relativePath: string; isDirectory: boolean } | null>(null); // File/folder to insert as @mention
  const [pendingSlashCommand, setPendingSlashCommand] = useState<{ name: string; description: string } | null>(null); // Slash command to insert in input
  const [pendingSkillMention, setPendingSkillMention] = useState<{ name: string } | null>(null); // Skill to insert as @skill:name mention
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsInitialized, setAgentsInitialized] = useState(false); // True after first load completes
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentsDirectoryExists, setAgentsDirectoryExists] = useState<boolean>(true);

  // Skills state
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsDirectoryExists, setSkillsDirectoryExists] = useState<boolean>(true);

  // Hooks state
  const [hooks, setHooks] = useState<HookConfig[]>([]);
  const [loadingHooks, setLoadingHooks] = useState(false);
  const [hooksError, setHooksError] = useState<string | null>(null);

  // Context drawer state
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [contextScope, setContextScope] = useState<string | null>(null);

  // Skills drawer state
  const [showSkillDrawer, setShowSkillDrawer] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);

  // PiP Window hook
  const { isPipOpen, openPipWindow, togglePipWindow, closePipWindow, updatePipAgents, showPipWindow, hidePipWindow } = usePipWindow();

  // activeTerminal moved to top of component for TypeScript hoisting

  // 🦆 SESSION-FIRST: Compute current session's chat messages and loading state
  // Now uses activeSessionId as the primary key for chat messages (independent sessions per agent)
  // 🦆 FIX SESSION MIXING: Only use activeSessionId, no fallback to activeId
  // The fallback was causing session mixing because activeId could point to a different agent
  const chatKey = activeSessionId; // REMOVED || activeId fallback

  const currentAgentMessages = useMemo(() => {
    // 🦆 FIX SESSION MIXING: If activeTaskId is set, return empty - task messages are handled separately
    if (activeTaskId) {
      console.log(`[ChatView] activeTaskId is set (${activeTaskId}), returning empty for currentAgentMessages`);
      return [];
    }
    return chatKey ? (chatSessions.get(chatKey) ?? []) : [];
  }, [chatKey, chatSessions, activeSessionId, activeTaskId]);

  const currentAgentLoading = useMemo(() => {
    return chatKey ? (chatLoadingMap.get(chatKey) ?? false) : false;
  }, [chatKey, chatLoadingMap]);

  // 🦆 FIX: Task messages need useMemo to trigger re-renders when chatSessions changes
  // Previously calculated inline which didn't properly track Map changes
  const activeTaskMessages = useMemo(() => {
    if (!activeTaskId) return [];
    const messages = chatSessions.get(activeTaskId) ?? [];
    console.log(`[ChatView] Loading task messages for activeTaskId="${activeTaskId}": ${messages.length} messages`);
    return messages;
  }, [activeTaskId, chatSessions]);

  const activeTaskLoading = useMemo(() => {
    return activeTaskId ? (chatLoadingMap.get(activeTaskId) ?? false) : false;
  }, [activeTaskId, chatLoadingMap]);

  const activeTaskTokens = useMemo(() => {
    return activeTaskId ? chatTokensMap.get(activeTaskId) : undefined;
  }, [activeTaskId, chatTokensMap]);

  // 🦆 SESSION-FIRST: Token tracking now uses chatKey (sessionId when available)
  const currentAgentTokens = useMemo(() => {
    const tokens = chatKey ? (chatTokensMap.get(chatKey) ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalCost: 0,
    }) : {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalCost: 0,
    };
    // Brain: gotcha-stamina-overhead-static-estimate
    // Priority: measuredOverhead (from countTokens API, precise) > projectOverheadCache (static estimate)
    const cwd = activeTerminal?.cwd || explorerPath || '';
    const staticOverhead = cwd ? projectOverheadCache.get(cwd) : undefined;
    const overhead = tokens.measuredOverhead ?? staticOverhead;
    return { ...tokens, overhead, contextWindow: tokens.contextWindow };
  }, [chatKey, chatTokensMap, activeTerminal?.cwd, explorerPath, projectOverheadCache]);

  const selectedGitEntry = useMemo(() => {
    if (!gitSummary || !selectedGitPath) {
      return null;
    }
    return (
      gitSummary.entries.find((entry) => entry.path === selectedGitPath) ?? null
    );
  }, [gitSummary, selectedGitPath]);

  // Grid columns: Always show left sidebar (360px), Kanban replaces main content area
  // Right side panel can be toggled in both normal and Kanban mode
  // In Kanban mode: default collapsed unless kanbanSidePanelExpanded is true (user clicked on project)
  // When no agents/projects: hide sidebar completely (empty state)
  const showSidebar = terminals.length > 0 || persistedProjects.size > 0;
  // WHY: auto-collapsed tabs (docs, whiteboard, office) must fully hide panel, not show 420px gap
  const isAutoCollapsedTab = activeTabId.startsWith('docs-') || activeTabId.startsWith('second-brain-') || activeTabId.startsWith('memory-graph-') || activeTabId.startsWith('claude-assets-') || activeTabId.startsWith('project-dashboard-') || isOfficeTabActive || isFeatureMapTabActive;
  const shouldShowSidePanel = isKanbanTabActive
    ? kanbanSidePanelExpanded && !sidePanelCollapsed
    : !sidePanelCollapsed && !isAutoCollapsedTab;

  // WHY: compact strip (44px) only when user explicitly collapsed + normal tab, otherwise 0px
  const gridTemplateColumns = !showSidebar
    ? "0px minmax(0, 1fr) 0px"  // Empty state: full width center
    : shouldShowSidePanel
      ? "360px minmax(0, 1fr) 420px"
      : (sidePanelCollapsed && activeId && !isAutoCollapsedTab)
        ? "360px minmax(0, 1fr) 44px"  // Compact icon strip
        : "360px minmax(0, 1fr) 0px";  // Auto-collapsed tab or no agent

  // Update PiP window with current agent states
  // Uses sessionStore (same source as Task Hub) so all non-done sessions appear
  // Brain: 005-performance-critical-refactor — debounced to avoid IPC spam during streaming
  const pipDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isPipOpen) return;

    // Brain: 005-performance-critical-refactor
    // Throttle to 2Hz (500ms) — prevents excessive IPC during multi-agent streaming
    if (pipDebounceRef.current) clearTimeout(pipDebounceRef.current);
    pipDebounceRef.current = setTimeout(() => {
      const activeSessions = agentSessions.filter((s) => s.status !== 'done');
      const pipAgents: PipAgentState[] = activeSessions.map((session) => {
        const terminal = terminals.find((t) => t.id === session.agentId);
        const isLoading = chatLoadingMap.get(session.id) === true
          || chatLoadingMap.get(session.agentId) === true;

        let status: PipAgentStatus = 'idle';
        if (isLoading) status = 'streaming';

        let lastMessage: string | undefined;
        let currentTool: string | undefined;
        let toolsExecuted = 0;
        const messages = chatSessions.get(session.agentId);
        if (messages && messages.length > 0) {
          const lastMsg = messages.filter((m) => m.role === 'assistant').pop();
          if (lastMsg) {
            const lastEvent = lastMsg.events?.filter((e) => e.type === 'assistant').pop();
            if (lastEvent && lastEvent.type === 'assistant') {
              const textBlocks = lastEvent.message?.content?.filter((c: any) => c.type === 'text') ?? [];
              if (textBlocks.length > 0) {
                lastMessage = textBlocks[textBlocks.length - 1].text?.substring(0, 100);
              }
              const toolBlocks = lastEvent.message?.content?.filter((c: any) => c.type === 'tool_use') ?? [];
              toolsExecuted = toolBlocks.length;
              if (toolBlocks.length > 0 && isLoading) {
                currentTool = toolBlocks[toolBlocks.length - 1].name;
                status = 'executing';
              }
            }
            if (lastMsg.error) status = 'error';
          }
          if (messages.length === 0 && isLoading) status = 'thinking';
        }

        return {
          agentId: session.agentId,
          agentName: terminal?.label || session.title,
          projectName: session.projectName,
          avatar: terminal?.avatar,
          sessionId: session.id,
          color: terminal?.color || '#f28c52',
          status,
          lastMessage: lastMessage || session.title,
          lastActivity: session.updatedAt,
          toolsExecuted,
          currentTool,
        };
      });

      updatePipAgents(pipAgents);
    }, 500);

    return () => {
      if (pipDebounceRef.current) clearTimeout(pipDebounceRef.current);
    };
  }, [agentSessions, chatSessions, chatLoadingMap, terminals, isPipOpen, updatePipAgents]);

  // Listen for click-to-focus events from PiP window
  // Use ref to avoid teardown/setup on every terminals change (prevents Tauri listener race condition)
  terminalsRef.current = terminals;

  // Sync terminals to Zustand store so components (e.g. PlanWidget agent picker)
  // can read them without prop drilling through the entire tree
  // Brain: 047-plan-delegate-remote
  const syncTerminalsToStore = useTerminalStore(s => s.setTerminals);
  const syncActiveIdToStore = useTerminalStore(s => s.setActiveId);
  useEffect(() => {
    syncTerminalsToStore(terminals);
  }, [terminals, syncTerminalsToStore]);
  useEffect(() => {
    syncActiveIdToStore(activeId);
  }, [activeId, syncActiveIdToStore]);

  useEffect(() => {
    if (!tauriAvailable) return;

    const unlisten = listen<{ agentId: string; sessionId?: string }>('pip-agent-clicked', async (event) => {
      const { agentId, sessionId } = event.payload;
      console.log('🦆 PiP agent clicked, focusing on agent:', agentId, 'session:', sessionId);

      // If we have a sessionId, use handleSessionClick for full activation
      // (selects session, switches tab, focuses chat, injects personality)
      if (sessionId && handleSessionClickRef.current) {
        handleSessionClickRef.current(sessionId);
        const w = getCurrentWindow();
        await w.setFocus();
        return;
      }

      // Fallback: just switch active terminal
      const terminal = terminalsRef.current.find((t) => t.id === agentId);
      if (terminal) {
        setActiveId(terminal.id);
        const w = getCurrentWindow();
        await w.setFocus();
      }
    });

    return () => {
      unlisten.then((fn) => fn()).catch(() => undefined);
    };
  }, [tauriAvailable]);

  // PiP context menu actions: Mark Done, Delete, Rename
  useEffect(() => {
    if (!tauriAvailable) return;

    const unlistenDone = listen<{ sessionId: string }>('pip-session-mark-done', (event) => {
      const { sessionId } = event.payload;
      useSessionStore.getState().markDone(sessionId);
    });

    const unlistenDelete = listen<{ sessionId: string }>('pip-session-delete', (event) => {
      const { sessionId } = event.payload;
      useSessionStore.getState().deleteSession(sessionId);
    });

    const unlistenRename = listen<{ sessionId: string; newTitle: string }>('pip-session-rename', (event) => {
      const { sessionId, newTitle } = event.payload;
      useSessionStore.getState().updateSession(sessionId, { title: newTitle });
    });

    return () => {
      unlistenDone.then((fn) => fn()).catch(() => undefined);
      unlistenDelete.then((fn) => fn()).catch(() => undefined);
      unlistenRename.then((fn) => fn()).catch(() => undefined);
    };
  }, [tauriAvailable]);

  // PiP stays visible at all times (no auto-hide on main window focus)
  // The user controls visibility via the PiP button or Settings toggle

  // Connect Settings PiP toggle + auto-open on startup
  const openPipWindowRef = useRef(openPipWindow);
  const closePipWindowRef = useRef(closePipWindow);
  openPipWindowRef.current = openPipWindow;
  closePipWindowRef.current = closePipWindow;

  useEffect(() => {
    if (!tauriAvailable) return;

    // PiP is always closed on startup — user opens it manually via sidebar button
    // The pip-enabled preference only controls the Settings toggle state, not auto-open
    let cancelled = false;

    // Listen for Settings PiP toggle
    const handlePipSettingChanged = (e: Event) => {
      const enabled = (e as CustomEvent).detail?.enabled;
      if (enabled) {
        openPipWindowRef.current();
      } else {
        closePipWindowRef.current();
      }
    };
    window.addEventListener('pip-setting-changed', handlePipSettingChanged);

    return () => {
      cancelled = true;
      window.removeEventListener('pip-setting-changed', handlePipSettingChanged);
    };
  }, [tauriAvailable]); // stable dep - runs once

  // Brain: 005-performance-critical-refactor
  // normalizeModelName extracted to src/utils/modelUtils.ts (module-level, no re-creation)

  // 🦆 SESSIONS-FIRST: Use sessionId for settings if available, fallback to agentId
  const settingsKey = activeSessionId || activeId;

  const getCurrentAgentSettings = useCallback((): AgentChatSettings => {
    if (!settingsKey) {
      // Default settings when no session/agent is active - use presets from settings
      const presets = useSettingsStore.getState().agentModePresets;
      const bypassPreset = presets.bypass;
      const fallbackModel = normalizeModelName(bypassPreset?.model || 'opus47');

      return {
        inputDraft: '',
        model: fallbackModel,
        thinkingMode: bypassPreset?.thinkingMode || 'auto',
        permissionMode: 'bypass',
        // Brain: task-effort-model-aware-refactor
        effort: bypassPreset?.effort || defaultEffortForModel(fallbackModel),
      };
    }

    const existing = agentChatSettings.get(settingsKey);
    if (existing) {
      // Normalize the model name in case it's a legacy ID
      const normalizedModel = normalizeModelName(existing.model);
      return {
        ...existing,
        model: normalizedModel,
        // Brain: task-effort-model-aware-refactor — default based on actual model, not hardcoded
        effort: existing.effort || defaultEffortForModel(normalizedModel),
      };
    }

    // Initialize default settings for new session using presets from settings
    const presets = useSettingsStore.getState().agentModePresets;
    const bypassPreset = presets.bypass;
    const fallbackModel = normalizeModelName(bypassPreset?.model || 'opus47');

    const defaultSettings: AgentChatSettings = {
      inputDraft: '',
      model: fallbackModel,
      thinkingMode: bypassPreset?.thinkingMode || 'auto',
      permissionMode: 'bypass',
      // Brain: task-effort-model-aware-refactor
      effort: bypassPreset?.effort || defaultEffortForModel(fallbackModel),
    };

    setAgentChatSettings((prev) => {
      const newMap = new Map(prev);
      newMap.set(settingsKey, defaultSettings);
      return newMap;
    });

    return defaultSettings;
  }, [settingsKey, agentChatSettings]);

  const currentSettings = getCurrentAgentSettings();

  const playQuackSound = useCallback(() => {
    if (typeof window === "undefined" || !quackSoundEnabled) {
      return;
    }
    try {
      const audio = new Audio(notificationAudio);
      audio.volume = 0.6; // Volume moderato per le notifiche
      audio.play().catch((error) => {
        console.warn("Unable to play notification sound", error);
      });
    } catch (error) {
      console.warn("Unable to play notification sound", error);
    }
  }, [notificationAudio, quackSoundEnabled]);

  const toggleQuackSound = useCallback(() => {
    setQuackSoundEnabled(prev => {
      const newValue = !prev;
      localStorage.setItem('quackSoundEnabled', String(newValue));
      return newValue;
    });
  }, []);

  const loadSavedCommands = useCallback(async () => {
    try {
      const commands = await invoke<SavedCommand[]>("load_saved_commands");
      setSavedCommands(commands);
    } catch (error) {
      console.warn("Unable to load saved commands", error);
    }
  }, []);

  // Native Terminal handlers
  const handleAddTerminalWindow = useCallback(
    async (name: string, directory: string, color: string, savedCommand?: SavedCommand) => {
      try {
        // If a saved command is provided, use its cwd
        const finalDirectory = savedCommand?.cwd || directory;

        // Create terminal window entry (no Rust invoke needed - TerminalWindowsPanel handles window creation)
        const newTerminal: NativeTerminal = {
          id: crypto.randomUUID(),
          name,
          color,
          directory: finalDirectory,
          app: 'Terminal',
          isOpen: false,
          createdAt: Date.now(),
        };

        setNativeTerminals((prev) => [...prev, newTerminal]);

        if (savedCommand) {
          toast.success(`Terminal window "${name}" added with command "${savedCommand.name}"`);
        } else {
          toast.success(`Terminal window "${name}" added`);
        }
      } catch (error) {
        console.error("Failed to add terminal window:", error);
        toast.error(
          `Failed to add terminal window: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },
    []
  );

  // Unused - keeping for future use
  // @ts-ignore - TS6133: Keeping for future implementation
  const handleRemoveNativeTerminal = useCallback(
    async (terminal: NativeTerminal) => {
      if (!tauriAvailable) {
        return;
      }

      try {
        // Try to close the terminal window
        await invoke("close_native_terminal", { name: terminal.name, app: terminal.app });
      } catch (error) {
        console.warn("Failed to close terminal window:", error);
      }

      // Remove from list regardless of whether close succeeded
      setNativeTerminals((prev) => prev.filter((t) => t.id !== terminal.id));
      toast.success(`Terminal "${terminal.name}" removed`);
    },
    [tauriAvailable]
  );

  // Unused - keeping for future use
  // @ts-ignore - TS6133: Keeping for future implementation
  const handleFocusNativeTerminal = useCallback(
    async (terminal: NativeTerminal) => {
      if (!tauriAvailable) {
        return;
      }

      try {
        const result = await invoke<{ success: boolean }>(
          "focus_native_terminal",
          { name: terminal.name, app: terminal.app }
        );

        if (result.success) {
          // Update isOpen state
          setNativeTerminals((prev) =>
            prev.map((t) =>
              t.id === terminal.id ? { ...t, isOpen: true } : t
            )
          );
        } else {
          toast.error("Terminal window not found");
        }
      } catch (error) {
        console.error("Failed to focus terminal:", error);
        toast.error("Failed to bring terminal to front");
      }
    },
    [tauriAvailable]
  );

  // Unused - keeping for future use
  // @ts-ignore - TS6133: Keeping for future implementation
  const handleOpenNativeTerminal = useCallback(
    async (terminal: NativeTerminal) => {
      if (!tauriAvailable) {
        return;
      }

      try {
        const result = await invoke<{ success: boolean; pid?: number }>(
          "open_native_terminal",
          {
            name: terminal.name,
            directory: terminal.directory || undefined,
            app: terminal.app,
          }
        );

        if (result.success) {
          setNativeTerminals((prev) =>
            prev.map((t) =>
              t.id === terminal.id
                ? { ...t, isOpen: true, pid: result.pid }
                : t
            )
          );
          toast.success(`Terminal "${terminal.name}" reopened`);
        }
      } catch (error) {
        console.error("Failed to open terminal:", error);
        toast.error("Failed to open terminal");
      }
    },
    [tauriAvailable]
  );

  const showIntroReplay = useCallback(() => {
    setIntroReplayActive(true);
    // SplashScreen will call onComplete after animation
  }, []);

  // 🦆 RACE CONDITION FIX: Split static listeners (don't depend on terminals) from dynamic ones
  // This prevents the crash where listeners are torn down and recreated on every terminal status change
  // which causes Tauri's internal "listeners[eventId].handlerId" race condition
  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }
    void loadSavedCommands();

    // Load performance monitor preference
    const loadPreferences = async () => {
      try {
        const prefs = await invoke<{ show_performance_monitor: boolean }>("get_preferences");
        setShowPerformanceMonitor(prefs.show_performance_monitor);
      } catch (error) {
        console.warn("Unable to load preferences", error);
      }
    };
    void loadPreferences();

    // Listen for preference changes
    const unlistenPromise = listen<{ show_performance_monitor: boolean }>("preferences-changed", (event) => {
      setShowPerformanceMonitor(event.payload.show_performance_monitor);
    });

    // Listen for menu event to open Settings (formerly AI Settings)
    const unlistenAISettingsPromise = listen("open-ai-settings", () => {
      setShowSettings(true);
    });

    const unlistenWatchIntroPromise = listen("watch-intro", () => {
      showIntroReplay();
    });

    // Listen for menu event to check for updates (opens Settings > About)
    const unlistenCheckUpdatesPromise = listen("check-for-updates", () => {
      setSettingsInitialCategory('about');
      setShowSettings(true);
    });

    // Listen for menu event to open Backgrounds modal
    const unlistenBackgroundsPromise = listen("open-backgrounds", () => {
      setShowBackgroundsModal(true);
    });

    // Listen for tray menu event to open PiP window
    const unlistenOpenPipPromise = listen("open-pip-window", () => {
      console.log("🦆 Tray menu: Opening PiP window");
      togglePipWindow();
    });

    // Brain: pattern-code-editor-tab
    // Listen for editFile tool requests from agent
    const unlistenEditFilePromise = listen<{
      filePath: string;
      newContent: string;
      sessionKey: string;
      toolUseId: string;
    }>('edit-file-request', async (event) => {
      const { filePath: editPath, newContent, sessionKey, toolUseId } = event.payload;
      console.log('[Editor] edit-file-request received:', editPath);
      try {
        const original = await invoke<string>('read_file_content', { path: editPath });
        const { useEditorStore } = await import('./stores/editorStore');
        useEditorStore.getState().openDiff({
          filePath: editPath,
          original,
          proposed: newContent,
          source: 'agent',
          sessionKey,
          toolUseId,
        });
        handleOpenCodeEditorTab(editPath);
      } catch (err) {
        console.error('[Editor] Failed to handle edit-file-request:', err);
      }
    });

    // 🗣️ GLOBAL AskUserQuestion listener - more reliable than agent-specific listeners
    // This catches events even when agent-specific listener doesn't exist (e.g., task chats, sessions)
    const unlistenAskUserQuestionGlobalPromise = listen<{
      requestId: string;
      questions: unknown[];
      agentId: string;
      sessionKey?: string; // 🦆 FIX: Now includes sessionKey for per-session tracking
    }>('ask-user-question', async (event) => {
      console.log(`🗣️ [GLOBAL] AskUserQuestion event received:`, event.payload);
      const { requestId, questions, agentId, sessionKey } = event.payload;

      // Store the pending question for when user responds
      // 🦆 FIX: Include sessionKey for proper per-session tracking when removing
      // 🦆 FIX: Remove stale pending questions for the same agent+session before adding new one
      // This prevents requestId mismatch when agent asks multiple questions in sequence
      setPendingUserQuestions((prev) => {
        const next = new Map(prev);

        // Remove any stale pending questions for the same agent+session
        for (const [existingId, existingData] of next.entries()) {
          if (existingData.agentId === agentId &&
              (!sessionKey || existingData.sessionKey === sessionKey)) {
            console.log(`🗣️ [GLOBAL] Removing stale pending question: ${existingId} (replaced by ${requestId})`);
            next.delete(existingId);
          }
        }

        next.set(requestId, { agentId, sessionKey, questions });
        return next;
      });

      // 🦆 FIX: Use sessionKey (if available) as the key for pending questions
      // This ensures the "?" indicator shows only on the specific session that has the question
      // Fallback to agentId for backwards compatibility with older events
      const pendingKey = sessionKey || agentId;
      console.log(`🗣️ [GLOBAL] Using pendingKey=${pendingKey} (sessionKey=${sessionKey}, agentId=${agentId})`);

      // Also add to pending question IDs for UI state
      setPendingQuestionIdsMap((prev) => {
        const newMap = new Map(prev);
        const pending = new Set<string>(newMap.get(pendingKey) || new Set<string>());
        pending.add(requestId); // Note: this is requestId, not toolUseId
        newMap.set(pendingKey, pending);
        return newMap;
      });

      // 🔔 Send in-app toast + native notification when agent needs user input
      try {
        // Use terminalsRef (always current) instead of stale agentChats closure
        const terminal = terminalsRef.current.find((t) => t.id === agentId);
        const agentName = terminal?.label || 'Agent';
        const questionCount = Array.isArray(questions) ? questions.length : 1;

        // Extract project name from cwd
        let projectName = 'Quack';
        if (terminal?.cwd) {
          const pathParts = terminal.cwd.split(/[/\\]/);
          projectName = pathParts.filter(Boolean).pop() || 'Quack';
        }

        // In-app toast (always visible, even when app is in focus)
        const avatarResult = getAgentAvatar(agentName, terminal?.avatar);
        const agentAvatar = typeof avatarResult === 'string' ? avatarResult : getDuckdroidUrl();
        showProjectToast({
          projectName,
          projectColor: 'var(--accent-color)',
          agentName,
          agentAvatar,
          message: questionCount === 1
            ? 'Needs your input — answer the question'
            : `Has ${questionCount} questions for you`,
          type: 'warning',
        }, 8000);

        // Native notification (visible when app is NOT in focus)
        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: `${agentName} needs your input`,
          body: questionCount === 1
            ? 'The agent has a question for you'
            : `The agent has ${questionCount} questions for you`,
        });
        console.log(`🔔 Desktop notification sent for ${agentName}`);
      } catch (notifyError) {
        console.warn('Failed to send notification:', notifyError);
      }
    });

    // 🛡️ GLOBAL ToolPermissionRequest listener - Ask mode tool approval
    // Brain: pattern-permission-modes (Ask mode)
    const unlistenToolPermissionGlobalPromise = listen<{
      requestId: string;
      toolName: string;
      input: Record<string, unknown>;
      agentId: string;
      sessionKey?: string;
    }>('tool-permission-request', async (event) => {
      console.log(`🛡️ [GLOBAL] ToolPermissionRequest event received:`, event.payload);
      const { requestId, toolName, input, agentId, sessionKey } = event.payload;

      // 🛡️ "Allow always" check: if tool was previously approved for this session, auto-respond
      const approveKey = sessionKey || agentId;
      const autoApproved = autoApprovedToolsRef.current.get(approveKey);
      if (autoApproved?.has(toolName)) {
        console.log(`🛡️ [AUTO-APPROVE] ${toolName} auto-approved for session ${approveKey}`);
        try {
          await invoke('answer_user_question', {
            agentId: approveKey,
            requestId,
            answers: { approved: true, feedback: '' },
          });
        } catch (err) {
          console.error('[App] Failed to auto-approve tool permission:', err);
        }
        return; // Don't show banner, don't add to pending
      }

      setPendingToolPermissions((prev) => {
        const next = new Map(prev);
        next.set(requestId, {
          requestId,
          toolName,
          input,
          agentId,
          sessionKey,
          timestamp: Date.now(),
        });
        return next;
      });

      // 🛡️ Add to pendingQuestionIdsMap for sidebar dot indicator
      // Must use this path (not direct chatStore) so the sync useEffect propagates it
      // Same pattern as AskUserQuestion (line 5230) and PlanApproval (line 5362)
      const pendingKey = sessionKey || agentId;
      setPendingQuestionIdsMap((prev) => {
        const newMap = new Map(prev);
        const pending = new Set<string>(newMap.get(pendingKey) || new Set<string>());
        pending.add(`tp-${requestId}`);
        newMap.set(pendingKey, pending);
        return newMap;
      });

      // 🔔 Notification: toast + native (same pattern as AskUserQuestion)
      const terminal = terminalsRef.current.find((t) => t.id === agentId);
      const agentName = terminal?.label || 'Agent';
      let projectName = 'Quack';
      if (terminal?.cwd) {
        const pathParts = terminal.cwd.split(/[/\\]/);
        projectName = pathParts.filter(Boolean).pop() || 'Quack';
      }
      const filePath = input.file_path || input.filePath || input.path;
      const target = typeof filePath === 'string'
        ? filePath.split(/[/\\]/).pop() || toolName
        : toolName;

      const avatarResult = getAgentAvatar(agentName, terminal?.avatar);
      const agentAvatar = typeof avatarResult === 'string' ? avatarResult : getDuckdroidUrl();
      showProjectToast({
        projectName,
        projectColor: '#f59e0b',
        agentName,
        agentAvatar,
        message: `Wants to use ${toolName} on ${target}`,
        type: 'warning',
      }, 6000);

      try {
        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: `${agentName} needs permission`,
          body: `${toolName} on ${target} — Allow or Deny`,
        });
      } catch (notifyError) {
        console.warn('Failed to send tool permission notification:', notifyError);
      }
    });

    // 📋 GLOBAL PlanApprovalRequest listener - catches ExitPlanMode events
    const unlistenPlanApprovalGlobalPromise = listen<{
      requestId: string;
      plan: unknown;
      agentId: string;
      sessionKey?: string;
    }>('plan-approval-request', async (event) => {
      console.log(`📋 [GLOBAL] PlanApprovalRequest event received:`, event.payload);
      const { requestId, plan, agentId, sessionKey } = event.payload;

      // Store the pending plan approval for when user responds
      setPendingPlanApprovals((prev) => {
        const next = new Map(prev);
        next.set(requestId, { agentId, sessionKey, plan });
        return next;
      });

      // Also add to pending question IDs for UI state (shows indicator on agent)
      const pendingKey = sessionKey || agentId;
      setPendingQuestionIdsMap((prev) => {
        const newMap = new Map(prev);
        const pending = new Set<string>(newMap.get(pendingKey) || new Set<string>());
        pending.add(requestId);
        newMap.set(pendingKey, pending);
        return newMap;
      });

      // 🔔 Send in-app toast + native notification for plan approval
      try {
        // Use terminalsRef (always current) instead of stale agentChats closure
        const terminal = terminalsRef.current.find((t) => t.id === agentId);
        const agentName = terminal?.label || 'Agent';

        // Extract project name from cwd
        let projectName = 'Quack';
        if (terminal?.cwd) {
          const pathParts = terminal.cwd.split(/[/\\]/);
          projectName = pathParts.filter(Boolean).pop() || 'Quack';
        }

        // In-app toast (always visible, even when app is in focus)
        const avatarResult = getAgentAvatar(agentName, terminal?.avatar);
        const agentAvatar = typeof avatarResult === 'string' ? avatarResult : getDuckdroidUrl();
        showProjectToast({
          projectName,
          projectColor: 'var(--accent-color)',
          agentName,
          agentAvatar,
          message: 'Needs plan approval — review and approve',
          type: 'warning',
        }, 8000);

        // Native notification (visible when app is NOT in focus)
        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: `${agentName} needs plan approval`,
          body: 'Review and approve the plan to proceed',
        });
      } catch (notifyError) {
        console.warn('Failed to send notification:', notifyError);
      }
    });

    // 📱 Listen for session updates from external sources (WhatsApp, Telegram, etc.)
    // When the Rust backend creates sessions via HTTP API, it emits this event
    const unlistenSessionsUpdatedPromise = listen<{
      action: string;
      sessionId: string;
      source: string;
    }>("sessions-updated", async (event) => {
      console.log("📱 Sessions updated from external source:", event.payload);
      const { action, sessionId, source } = event.payload;

      // Reload sessions from storage to sync with external changes
      await useSessionStore.getState().loadSessions();

      // Log source for debugging
      console.log(`📱 Session ${action}: ${sessionId} (source: ${source})`);
    });

    // 📱 Listen for WhatsApp auto-start chat requests
    // When WhatsApp watcher creates a session and wants to auto-start it with a prompt
    const unlistenSessionAutoStartPromise = listen<{
      sessionId: string;
      prompt: string;
      whatsappRecipient?: string;
      autoSend: boolean;
    }>("session-auto-start", async (event) => {
      console.log("📱 Session auto-start request:", event.payload);
      const { sessionId, prompt, whatsappRecipient, autoSend } = event.payload;

      // Reload sessions to ensure we have the latest
      await useSessionStore.getState().loadSessions();

      // Find the session to get the agentId
      const sessions = useSessionStore.getState().sessions;
      const session = sessions.find(s => s.id === sessionId);

      if (!session) {
        console.error(`📱 Session not found for auto-start: ${sessionId}`);
        return;
      }

      console.log(`📱 Found session for auto-start: ${session.title} (agent: ${session.agentId})`);

      // Build prompt with WhatsApp MCP instruction if recipient is provided
      let finalPrompt = prompt;
      if (whatsappRecipient) {
        finalPrompt = `${prompt}\n\n---\nIMPORTANT: After completing this task, respond to the user via WhatsApp using the MCP WhatsApp tool. Send the response to: ${whatsappRecipient}`;
      }

      // Set pending BEFORE state updates so useEffect finds it when activeSessionId changes
      if (autoSend) {
        console.log(`📱 Setting pendingAutoStartRef for session ${sessionId}`);
        pendingAutoStartRef.current = { prompt: finalPrompt, sessionId };
      }

      // Set the agent and session as active (triggers React re-render → useEffect picks up pending)
      setActiveId(session.agentId);
      setActiveSessionIdExclusive(sessionId);

      // Edge case: if activeSessionId was already this sessionId, useEffect won't re-trigger
      // In that case, send directly after a delay
      if (autoSend) {
        setTimeout(() => {
          if (pendingAutoStartRef.current?.sessionId === sessionId) {
            console.log(`📱 Fallback: pendingAutoStart still pending, sending directly`);
            pendingAutoStartRef.current = null;
            if (sendMessageForAgentRef.current) {
              sendMessageForAgentRef.current(finalPrompt);
            }
          }
        }, 2000);
      }
    });

    // 📱 Remote API: Execute command from mobile dashboard
    // Creates a session for the agent and sends the prompt
    const unlistenRemoteExecutePromise = listen<{
      sessionId: string;
      agentId: string;
      agentName: string;
      projectPath: string;
      projectName: string;
      prompt: string;
      model?: string;
      leadSessionId?: string;
      source: string;
      autoSend: boolean;
    }>("remote-execute", async (event) => {
      console.log("📱 [Remote Execute] Request:", event.payload);
      const { sessionId: remoteSessionId, agentId, prompt, projectPath, projectName, model: remoteModel, leadSessionId } = event.payload;

      // Dedup guard: synchronous check BEFORE any async work
      // pendingAutoStartRef check fails because it's set after createSession (async race)
      if (handledRemoteSessionIds.current.has(remoteSessionId)) {
        console.log(`📱 [Remote Execute] Already handling session ${remoteSessionId}, skipping duplicate`);
        return;
      }
      handledRemoteSessionIds.current.add(remoteSessionId);

      // Find the terminal for this agent
      const agent = terminalsRef.current.find(t => t.id === agentId);
      if (!agent) {
        console.error(`📱 [Remote Execute] Agent not found: ${agentId}`);
        return;
      }

      try {
        // Inject the TARGET agent's personality into CLAUDE.md of the target
        // project BEFORE the daemon spawns. Without this the teammate daemon
        // reads the lead agent's persona still present in CLAUDE.md and
        // identifies itself as the lead (bug: Leo answering as Jack).
        // Brain: 025-team-delegation-footer
        await injectAgentPersonality(agent, projectPath);

        // Create a new session
        // Use the session ID from Rust so mobile can poll with the correct ID
        // Brain: 025-team-delegation-footer
        const titlePrefix = leadSessionId ? '[Team]' : '[Remote]';
        const newSession = await useSessionStore.getState().createSession({
          id: remoteSessionId,
          title: `${titlePrefix} ${prompt.slice(0, 50)}...`,
          agentId,
          projectPath: projectPath || agent.cwd,
          projectName: projectName || extractProjectId(agent.cwd) || 'project',
          status: 'in_progress',
          messageCount: 0,
          initialPrompt: prompt,
          leadSessionId: leadSessionId || undefined,
        });

        console.log(`📱 [Remote Execute] Session created: ${newSession.id}, leadSessionId: ${leadSessionId ?? 'none'}`);

        // Set active and send
        setActiveId(agentId);
        setActiveSessionIdExclusive(newSession.id);

        // Use pendingAutoStart to send the prompt once the session is active
        pendingAutoStartRef.current = { prompt, sessionId: newSession.id, model: remoteModel };

        // Fallback: if activeSessionId was already set, send directly
        setTimeout(() => {
          if (pendingAutoStartRef.current?.sessionId === newSession.id) {
            console.log(`📱 [Remote Execute] Fallback: sending directly`);
            const pendingModel = pendingAutoStartRef.current.model;
            pendingAutoStartRef.current = null;
            if (sendMessageForAgentRef.current) {
              sendMessageForAgentRef.current(prompt, pendingModel ? { model: pendingModel } : undefined);
            }
          }
        }, 2000);
      } catch (err) {
        console.error(`📱 [Remote Execute] Failed:`, err);
      }
    });

    // 📱 Remote API: Send message to existing session from mobile dashboard
    const unlistenRemoteSendMessagePromise = listen<{
      sessionId: string;
      message: string;
      source: string;
    }>("remote-send-message", async (event) => {
      console.log("📱 [Remote SendMessage] Request:", event.payload);
      const { sessionId, message } = event.payload;

      // Find the session to get the agentId
      const sessions = useSessionStore.getState().sessions;
      const session = sessions.find(s => s.id === sessionId);
      if (!session) {
        console.error(`📱 [Remote SendMessage] Session not found: ${sessionId}`);
        return;
      }

      // Set the agent and session active, then send
      setActiveId(session.agentId);
      setActiveSessionIdExclusive(sessionId);

      // Use pendingAutoStart to send the message
      pendingAutoStartRef.current = { prompt: message, sessionId };

      setTimeout(() => {
        if (pendingAutoStartRef.current?.sessionId === sessionId) {
          console.log(`📱 [Remote SendMessage] Fallback: sending directly`);
          pendingAutoStartRef.current = null;
          if (sendMessageForAgentRef.current) {
            sendMessageForAgentRef.current(message);
          }
        }
      }, 2000);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenAISettingsPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenWatchIntroPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenCheckUpdatesPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenBackgroundsPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenOpenPipPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenEditFilePromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenAskUserQuestionGlobalPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenToolPermissionGlobalPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenPlanApprovalGlobalPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenSessionsUpdatedPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenSessionAutoStartPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenRemoteExecutePromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenRemoteSendMessagePromise.then(unlisten => unlisten()).catch(() => undefined);
    };
  }, [loadSavedCommands, showIntroReplay, tauriAvailable, togglePipWindow, loadKanbanTasks, setActiveSessionIdExclusive]);

  // 🦆 DYNAMIC LISTENERS: These depend on terminals and need careful cleanup
  // Use a ref to track terminal IDs to avoid rapid listener churn on status changes
  const terminalIdsRef = useRef<string[]>([]);
  const askUserListenersRef = useRef<Map<string, () => void>>(new Map());

  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }

    // Only track terminal IDs, not the full terminals array
    // This prevents re-running on every status change (idle/busy)
    const currentTerminalIds = terminals.map(t => t.id).sort();
    const previousTerminalIds = terminalIdsRef.current;

    // Find which terminals were added or removed
    const addedIds = currentTerminalIds.filter(id => !previousTerminalIds.includes(id));
    const removedIds = previousTerminalIds.filter(id => !currentTerminalIds.includes(id));

    // Skip if no terminals were added or removed (just status changes)
    if (addedIds.length === 0 && removedIds.length === 0 && previousTerminalIds.length > 0) {
      return;
    }

    terminalIdsRef.current = currentTerminalIds;

    // 🗣️ Setup AskUserQuestion listeners only for NEW terminals
    addedIds.forEach((terminalId) => {
      // Skip if listener already exists
      if (askUserListenersRef.current.has(terminalId)) {
        return;
      }

      const eventName = `ask-user-question:${terminalId}`;
      listen<{
        requestId: string;
        questions: unknown[];
        agentId: string;
        sessionKey?: string; // 🦆 FIX: Now includes sessionKey for per-session tracking
      }>(eventName, (event) => {
        console.log(`🗣️ AskUserQuestion event received for agent ${terminalId}:`, event.payload);
        const { requestId, questions, agentId, sessionKey } = event.payload;

        // Store the pending question for when user responds
        // 🦆 FIX: Include sessionKey for proper per-session tracking
        // 🦆 FIX: Remove stale pending questions for the same agent+session before adding new one
        setPendingUserQuestions((prev) => {
          const next = new Map(prev);

          // Remove any stale pending questions for the same agent+session
          for (const [existingId, existingData] of next.entries()) {
            if (existingData.agentId === agentId &&
                (!sessionKey || existingData.sessionKey === sessionKey)) {
              console.log(`🗣️ [Agent] Removing stale pending question: ${existingId} (replaced by ${requestId})`);
              next.delete(existingId);
            }
          }

          next.set(requestId, { agentId, sessionKey, questions });
          return next;
        });
      }).then((unlisten) => {
        askUserListenersRef.current.set(terminalId, unlisten);
        console.log(`[AskUser] Listener ready for terminal: ${terminalId}`);
      }).catch((error) => {
        console.error(`[AskUser] Failed to setup listener for ${terminalId}:`, error);
      });
    });

    // Cleanup listeners for REMOVED terminals
    removedIds.forEach((terminalId) => {
      const unlisten = askUserListenersRef.current.get(terminalId);
      if (unlisten) {
        unlisten();
        askUserListenersRef.current.delete(terminalId);
      }
    });

    // Cleanup on unmount
    return () => {
      askUserListenersRef.current.forEach((unlisten) => {
        unlisten();
      });
      askUserListenersRef.current.clear();
    };
  }, [tauriAvailable, terminals]);

  // 🦆 TELEGRAM STATUS: Separate effect with ref to avoid closure issues
  const telegramTerminalsRef = useRef(terminals);
  telegramTerminalsRef.current = terminals;

  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }

    // Listen for Telegram /status command - uses ref to get current terminals
    const unlistenTelegramStatusPromise = listen<{ unique_id: string; telegram_chat_id: number }>(
      "telegram-command-status",
      async (event) => {
        console.log("🦆 Telegram /status command received:", event.payload);
        const { telegram_chat_id } = event.payload;
        const currentTerminals = telegramTerminalsRef.current;

        try {
          // Get all active agents (terminals)
          const activeAgents = currentTerminals
            .filter((t) => t.status === "busy" || t.status === "idle")
            .map((t) => `• ${t.label} - ${t.status === "busy" ? "🟡 Working" : "🟢 Ready"}`)
            .join("\n");

          const message = activeAgents.length > 0
            ? `🦆 *Active Agents* (${currentTerminals.length})\n\n${activeAgents}`
            : "🦆 No active agents.\n\nCreate a new terminal to get started!";

          // Send status message to Telegram
          await invoke("send_telegram_message", {
            payload: {
              chat_id: telegram_chat_id,
              text: message,
            },
          });
        } catch (error) {
          console.error("Failed to send Telegram status:", error);
        }
      }
    );

    return () => {
      unlistenTelegramStatusPromise.then(unlisten => unlisten()).catch(() => undefined);
    };
  }, [tauriAvailable]);

  // Brain: fix-linux-projects-disappear-on-restart
  // Immediate save when terminal count changes (project added/removed).
  // Sessions are saved instantly on creation, but the debounced auto-save below
  // waits 2 seconds. During that window, saveAgentSessions() writes to disk
  // without the agents key. This effect ensures agents hit disk BEFORE any
  // concurrent session save can write a file without them.
  const savedTerminalCount = useRef(-1);
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped || terminals.length === 0) return;
    if (terminals.length !== savedTerminalCount.current) {
      savedTerminalCount.current = terminals.length;
      const agents = terminals.map(terminalToUnifiedAgent);
      void saveUnifiedAgents(agents);
    }
  }, [hasBootstrapped, tauriAvailable, terminals]);

  // Auto-save terminals to storage (debounced to avoid excessive writes)
  // Handles property updates (cwd, label, personality, etc.) — not structural changes.
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }

    // Debounce storage save - wait 2 seconds after last change before saving
    const saveTimer = setTimeout(() => {
      if (terminals.length > 0) {
        // Convert terminals to unified agents and save
        void (async () => {
          try {
            const agents = terminals.map(terminalToUnifiedAgent);
            await saveUnifiedAgents(agents);
          } catch (error) {
            console.error("[App] Failed to save terminals to unified storage:", error);
          }
        })();
      } else {
        // Don't save empty array - it would overwrite existing agents!
        // This can happen during startup when terminals haven't loaded yet
        console.log("[App] Skipping save - no terminals loaded yet");
      }
    }, 2000); // Wait 2 seconds before saving

    return () => clearTimeout(saveTimer);
  }, [hasBootstrapped, tauriAvailable, terminals]);

  // Auto-save tabs by terminal to storage (debounced to avoid saving on every switch)
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }

    // Debounce storage save - wait 2 seconds after last change before saving
    const saveTimer = setTimeout(() => {
      if (tabsByTerminal.size > 0) {
        void saveTabsByTerminalToStorage(tabsByTerminal);
      } else {
        // If no tabs, clean up storage
        void (async () => {
          try {
            const store = await Store.load(getTestModeStoreName("quack-terminals.json"));
            await store.delete(TABS_BY_TERMINAL_KEY);
            await store.save();
          } catch {
            // Ignore errors
          }
        })();
      }
    }, 2000); // Wait 2 seconds before saving

    return () => clearTimeout(saveTimer);
  }, [tabsByTerminal, tauriAvailable, hasBootstrapped]);

  // Auto-save Native Terminals when they change
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }

    if (nativeTerminals.length > 0) {
      void saveNativeTerminalsToStorage(nativeTerminals);
    } else {
      // If no native terminals, clean up storage
      void (async () => {
        try {
          const store = await Store.load(getTestModeStoreName("quack-terminals.json"));
          await store.delete(NATIVE_TERMINALS_STORAGE_KEY);
          await store.save();
        } catch {
          // Ignore errors
        }
      })();
    }
  }, [hasBootstrapped, tauriAvailable, nativeTerminals]);

  // AgentChats auto-save removed - now using unifiedAgentStorage

  // Auto-save active AgentChat when it changes (Phase 1)
  const ensureNotificationPermission =
    useCallback(async (): Promise<boolean> => {
      if (!tauriAvailable) {
        return false;
      }
      try {
        let granted = await isPermissionGranted();
        if (!granted) {
          const permission = await requestPermission();
          granted = permission === "granted";
        }
        setNotificationGranted(granted);
        return granted;
      } catch (error) {
        console.warn("Unable to verify notification permissions", error);
        setNotificationGranted(false);
        return false;
      }
    }, [tauriAvailable]);

  const notifyTerminalReady = useCallback(
    async (payload: { id: string; label: string }) => {
      playQuackSound();

      // Find the terminal to get avatar and color info
      const terminal = terminals.find(t => t.id === payload.id || t.label === payload.label);
      const agentName = payload.label || "AI Assistant";

      // Extract project name from cwd (last folder in path)
      let projectName = "Project";
      if (terminal?.cwd) {
        const pathParts = terminal.cwd.split(/[/\\]/);
        projectName = pathParts.filter(Boolean).pop() || "Project";
      }

      // Get project color
      const repoKey = `repo-${projectName}`;
      const projectColor = getProjectColor(repoKey, projectColors, 0);

      // Get avatar URL
      const avatarResult = getAgentAvatar(agentName, terminal?.avatar);
      const agentAvatar = typeof avatarResult === 'string' ? avatarResult : getDuckdroidUrl();

      // Show in-app toast notification with project context
      showProjectToast({
        projectName,
        projectColor,
        agentName,
        agentAvatar,
        message: "Terminal ready - waiting for input",
        type: 'info',
      }, 4000);

      if (!tauriAvailable) {
        return;
      }

      let granted = notificationGranted;
      if (!granted) {
        granted = await ensureNotificationPermission();
      }

      if (!granted) {
        return;
      }

      try {
        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: projectName,
          body: `${agentName}: Terminal ready`,
        });
      } catch (error) {
        console.warn("Unable to show notification", error);
      }
    },
    [ensureNotificationPermission, notificationGranted, playQuackSound, tauriAvailable, terminals, projectColors]
  );

  // Notify when agent/chat completes response
  const notifyAgentReady = useCallback(
    async (payload: { id: string; label: string; cwd?: string }) => {
      playQuackSound();

      // Find the terminal to get avatar and color info
      const terminal = terminals.find(t => t.id === payload.id || t.label === payload.label);
      const agentName = payload.label || "AI Assistant";

      // Extract project name from cwd (last folder in path)
      let projectName = "Project";
      if (payload.cwd) {
        const pathParts = payload.cwd.split(/[/\\]/);
        projectName = pathParts.filter(Boolean).pop() || "Project";
      } else if (terminal?.cwd) {
        const pathParts = terminal.cwd.split(/[/\\]/);
        projectName = pathParts.filter(Boolean).pop() || "Project";
      }

      // Get project color
      const repoKey = `repo-${projectName}`;
      const projectColor = getProjectColor(repoKey, projectColors, 0);

      // Get avatar URL (async operation)
      const avatarResult = getAgentAvatar(agentName, terminal?.avatar);
      const agentAvatar = typeof avatarResult === 'string' ? avatarResult : getDuckdroidUrl();

      // Show in-app toast notification with project context
      showProjectToast({
        projectName,
        projectColor,
        agentName,
        agentAvatar,
        message: "Response completed!",
        type: 'success',
      }, 4000);

      if (!tauriAvailable) {
        return;
      }

      let granted = notificationGranted;
      if (!granted) {
        granted = await ensureNotificationPermission();
      }

      if (!granted) {
        return;
      }

      try {
        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: projectName,
          body: `${agentName}: Response completed!`,
        });

        // Telegram notifications are now handled by the Rust notification bridge
        // (telegram_notifications.rs) which subscribes to WsBroadcast events
        // and sends formatted summaries with inline keyboard buttons.
        // Brain: 002-telegram-bidirectional-chat
        lastAgentResponseRef.current.delete(payload.id);
      } catch (error) {
        console.warn("Unable to show notification", error);
      }
    },
    [ensureNotificationPermission, notificationGranted, playQuackSound, tauriAvailable, terminals, projectColors]
  );

  // Keep ref to latest notifyAgentReady to avoid dependency issues
  const notifyAgentReadyRef = useRef(notifyAgentReady);
  useEffect(() => {
    notifyAgentReadyRef.current = notifyAgentReady;
  }, [notifyAgentReady]);

  const loadDirectory = useCallback(
    async (path?: string) => {
      setLoadingExplorer(true);
      setExplorerError(null);
      if (!tauriAvailable) {
        setLoadingExplorer(false);
        setExplorerError(
          "Launch the Tauri desktop app to use the file explorer."
        );
        setExplorerTree({});
        setExplorerRoot(null);
        return;
      }
      try {
        const listing = await invoke<DirectoryListing>("list_directory", {
          path: path ?? null,
        });
        setExplorerPath(listing.path);
        setExplorerTree((previous) => ({
          ...previous,
          [listing.path]: listing.entries,
        }));
        setExplorerRoot(listing.path);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setExplorerError(message);
      } finally {
        setLoadingExplorer(false);
      }
    },
    [tauriAvailable]
  );

  const fetchDirectoryChildren = useCallback(
    async (path: string) => {
      if (!tauriAvailable) {
        setExplorerError(
          "Launch the Tauri desktop app to use the file explorer."
        );
        return [];
      }
      try {
        const listing = await invoke<DirectoryListing>("list_directory", {
          path,
        });
        setExplorerTree((previous) => ({
          ...previous,
          [listing.path]: listing.entries,
        }));
        return listing.entries;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setExplorerError(message);
        return [];
      }
    },
    [tauriAvailable]
  );

  // Auto-refresh FileExplorer when files are modified by Claude
  useEffect(() => {
    if (refreshExplorerTrigger > 0 && explorerRoot) {
      // Clear stale cache so subdirectories are re-fetched when expanded
      setExplorerTree({});
      // Refresh the root directory to show new/modified files
      loadDirectory(explorerRoot);
    }
  }, [refreshExplorerTrigger, explorerRoot, loadDirectory]);

  // Helper callbacks without dependencies - defined FIRST to avoid temporal dead zone
  const clearTerminalAttention = useCallback((id: string) => {
    setTerminals((prev) => {
      // Performance: Skip se già senza attention per evitare re-render inutili
      const current = prev.find(t => t.id === id);
      if (current && !current.needsAttention) {
        return prev; // Ritorna stesso array → NO re-render!
      }

      return prev.map((terminal) =>
        terminal.id === id ? { ...terminal, needsAttention: false } : terminal
      );
    });
  }, []);

  const clearIdleTimer = useCallback((id: string) => {
    const timer = idleTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      idleTimersRef.current.delete(id);
    }
  }, []);

  const clearNotificationTimer = useCallback((id: string) => {
    const timer = notificationTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      notificationTimersRef.current.delete(id);
    }
  }, []);

  // Status management callbacks - can now safely use helper callbacks above
  const markTerminalBusy = useCallback((id: string) => {
    // Anti-flickering: cancella timer visuale pending se esiste
    const visualTimer = visualIdleTimersRef.current.get(id);
    if (visualTimer) {
      clearTimeout(visualTimer);
      visualIdleTimersRef.current.delete(id);
    }

    // Cancella timer di notifica quando il terminale diventa busy
    clearNotificationTimer(id);

    setTerminals((prev) => {
      // Performance: Skip se già busy per evitare re-render inutili
      const current = prev.find(t => t.id === id);
      if (current?.status === 'busy') {
        return prev; // Ritorna stesso array → NO re-render!
      }

      return prev.map((terminal) =>
        terminal.id === id
          ? {
              ...terminal,
              status: "busy",
              needsAttention: false,
              hasResponded: false,          // Reset: nuovo prompt inviato
              responseStartTime: Date.now() // Timestamp inizio lavoro
            }
          : terminal
      );
    });
  }, [clearNotificationTimer]);

  const markTerminalIdle = useCallback(
    (id: string, options?: { suppressNotification?: boolean }) => {
      // Note: suppressNotification option is passed from external-terminal-status event
      // but not currently used in this function. Kept for future implementation.
      void options;

      // Anti-flickering: delay di 400ms prima di mostrare idle
      // Cancella timer esistente se presente
      const existingTimer = visualIdleTimersRef.current.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // Schedule il cambio di stato con delay
      const timer = setTimeout(() => {
        setTerminals((prev) => {
          // Performance: Skip se già idle per evitare re-render inutili
          const current = prev.find(t => t.id === id);
          if (current?.status === 'idle') {
            return prev; // Ritorna stesso array → NO re-render!
          }

          return prev.map((terminal) => {
            if (terminal.id !== id) {
              return terminal;
            }
            const wasBusy = terminal.status === "busy";
            const needsAttention = wasBusy && id !== activeId;
            return {
              ...terminal,
              status: "idle",
              needsAttention,
            };
          });
        });

        visualIdleTimersRef.current.delete(id);
      }, VISUAL_IDLE_DELAY_MS);

      visualIdleTimersRef.current.set(id, timer);
    },
    [activeId]
  );

  const scheduleIdleTimer = useCallback(
    (id: string) => {
      // Cancella il timer esistente se c'è (reset on activity)
      const existingTimer = idleTimersRef.current.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        idleTimersRef.current.delete(id);
      }

      // Crea un nuovo timer che triggera dopo 5s (activity bar response)
      const handle = setTimeout(() => {
        markTerminalIdle(id);
        idleTimersRef.current.delete(id);
      }, IDLE_TIMEOUT_MS);
      idleTimersRef.current.set(id, handle);
    },
    [markTerminalIdle]
  );

  const scheduleNotificationTimer = useCallback(
    (id: string) => {
      // Cancella il timer esistente se c'è (reset on activity)
      const existingTimer = notificationTimersRef.current.get(id);
      if (existingTimer) {
        clearTimeout(existingTimer);
        notificationTimersRef.current.delete(id);
      }

      // Crea un nuovo timer che triggera dopo 1 minuto di inattività
      const handle = setTimeout(() => {
        // Retrieve terminal info for notification
        const terminal = terminalsRef.current.find(t => t.id === id);

        if (!terminal || terminal.status !== 'idle') {
          notificationTimersRef.current.delete(id);
          return;
        }

        // 🦆 SMART LOGIC: Notifica SOLO se:
        // 1. Terminal è idle
        // 2. hasResponded === false (prima risposta per questo prompt)
        // 3. Tempo dall'ultimo busy > 5 secondi (filtro anti-spam)
        // 4. Terminal NON è attivo (utente sta guardando altro)

        const hasResponded = terminal.hasResponded ?? false;
        const responseStartTime = terminal.responseStartTime ?? 0;
        const timeSinceBusy = Date.now() - responseStartTime;
        const isMinimumTimeElapsed = timeSinceBusy > 5000; // 5 secondi
        const isTerminalInactive = id !== activeId;

        const shouldNotify =
          !hasResponded &&
          isMinimumTimeElapsed &&
          (NOTIFY_ACTIVE_TERMINAL || isTerminalInactive);

        if (shouldNotify) {
          void notifyTerminalReady({ id: terminal.id, label: terminal.label });

          // Marca come "già risposto" per evitare notifiche multiple
          setTerminals((prev) =>
            prev.map((t) =>
              t.id === id ? { ...t, hasResponded: true } : t
            )
          );
        }

        notificationTimersRef.current.delete(id);
      }, NOTIFICATION_TIMEOUT_MS);
      notificationTimersRef.current.set(id, handle);
    },
    [activeId, notifyTerminalReady]
  );

  const resolveTerminalId = useCallback(
    ({ id, label }: { id?: string | null; label?: string | null }) => {
      const terminalsSnapshot = terminalsRef.current;
      const candidates = [id, label];

      for (const candidate of candidates) {
        if (!candidate) {
          continue;
        }
        const trimmed = candidate.trim();
        if (!trimmed) {
          continue;
        }
        const direct = terminalsSnapshot.find(
          (terminal) => terminal.id === trimmed
        );
        if (direct) {
          return direct.id;
        }
      }

      for (const candidate of candidates) {
        if (!candidate) {
          continue;
        }
        const trimmed = candidate.trim();
        if (!trimmed) {
          continue;
        }
        const normalizedCandidate = normalizeKey(trimmed);
        const labelMatch = terminalsSnapshot.find(
          (terminal) => normalizeKey(terminal.label) === normalizedCandidate
        );
        if (labelMatch) {
          return labelMatch.id;
        }
      }

      for (const candidate of candidates) {
        if (!candidate) {
          continue;
        }
        const trimmed = candidate.trim();
        if (!trimmed) {
          continue;
        }
        const slugCandidate = slugify(trimmed);
        const slugMatch = terminalsSnapshot.find(
          (terminal) => slugify(terminal.label) === slugCandidate
        );
        if (slugMatch) {
          return slugMatch.id;
        }
      }

      return null;
    },
    []
  );

  // Performance: buffer per output chunks per debounce status detection
  const outputBuffersRef = useRef<Map<string, { chunks: string[], lastCheck: number }>>(new Map());
  const STATUS_CHECK_INTERVAL = 200; // Check status ogni 200ms invece che ogni chunk

  const handleOpenAIAssistant = useCallback((intent = '') => {
    setAiIntent(intent);
    setAiInitialMode(undefined);
    setAiContext({
      os: 'macos',
      shell: 'zsh',
      cwd: activeTerminal?.cwd || '',
      recentCommands: recentCommandsRef.current.slice(-5),
    });
    setShowAIAssistant(true);
  }, [activeTerminal]);

  const handleOpenPromptEngineer = useCallback(() => {
    setAiIntent('');
    setAiInitialMode('prompt-engineer');
    setAiContext({
      os: 'macos',
      shell: 'zsh',
      cwd: activeTerminal?.cwd || '',
      recentCommands: recentCommandsRef.current.slice(-5),
    });
    setShowAIAssistant(true);
  }, [activeTerminal]);

  const handleAICommandSelect = useCallback((command: string) => {
    if (!activeId) return;

    // Execute the AI command in the active terminal
    void invoke('write_to_terminal', { id: activeId, data: command + '\r' });

    // Add to recent commands
    recentCommandsRef.current = [...recentCommandsRef.current.slice(-9), command];

    // Close the modal
    setShowAIAssistant(false);
  }, [activeId]);

  // Quack Agency handlers
  const loadAgents = useCallback(async () => {
    if (!tauriAvailable) {
      return;
    }

    setLoadingAgents(true);
    setAgentsError(null);

    try {
      const workingDir = getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);
      console.log('[loadAgents] 🦆 Loading agents with workingDir:', workingDir, 'cwd:', activeTerminal?.cwd, 'explorerPath:', explorerPath);

      // Check if PROJECT agents directory exists (for UI indicator)
      // Note: Global agents (~/.claude/agents/) are ALWAYS loaded regardless of this check
      const dirExists = await invoke<boolean>("check_agents_directory", {
        workingDir,
      });
      console.log('[loadAgents] 🦆 Project directory exists:', dirExists);
      setAgentsDirectoryExists(dirExists);

      // ALWAYS call list_agents - it loads both global AND project agents
      // The dirExists check is only for UI purposes (showing "setup" message)
      const agentsList = await invoke<AgentInfo[]>("list_agents", {
        workingDir,
      });
      console.log('[loadAgents] 🦆 Loaded agents:', agentsList.length, agentsList.map(a => a.name));
      setAgents(agentsList);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAgentsError(message);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
      setAgentsInitialized(true); // Mark first load as complete (for splash screen)

      // Hide the overlay loader after React has finished rendering
      // Use requestAnimationFrame to wait for paint, then a small delay for layout stabilization
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          // Double rAF ensures React render + browser paint are complete
          setTimeout(() => {
            const appLoader = document.getElementById('app-loader');
            if (appLoader) {
              appLoader.classList.add('fade-out');
              setTimeout(() => appLoader.remove(), 800); // Match CSS transition duration
            }
          }, 150); // Delay for layout stabilization before fade
        });
      });
    }
  }, [tauriAvailable, activeTerminal?.cwd, explorerPath]);

  const handleSelectAgent = useCallback(async (agentInfo: AgentInfo) => {
    if (!tauriAvailable) {
      return;
    }

    // Create or select agent tab instead of opening drawer
    const agentTabId = `agent-${agentInfo.name}-${agentInfo.scope}`;

    // Check if tab already exists
    const existingTab = tabs.find(t => t.id === agentTabId);

    if (existingTab) {
      // Tab already exists, just activate it
      setActiveTabId(agentTabId);
    } else {
      // Create new agent tab with duckdroid icon
      const newTab: Tab = {
        id: agentTabId,
        label: agentInfo.name.replace(/-/g, ' '),
        type: 'agent',
        closable: true,
        agentName: agentInfo.name,
        agentScope: agentInfo.scope as 'global' | 'project',
        icon: (
          <img
            src={agentInfo.avatar ? getAvatarUrl(agentInfo.avatar) : getDuckdroidUrl()}
            alt="Agent"
            style={{ width: '16px', height: '16px', borderRadius: '3px' }}
          />
        ),
      };

      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId(agentTabId);
    }
  }, [tauriAvailable, tabs]);

  // Handler for creating a new agent via tab
  const handleCreateNewAgent = useCallback((scope: 'global' | 'project' = 'project') => {
    const agentTabId = `agent-new-${Date.now()}`;

    const newTab: Tab = {
      id: agentTabId,
      label: 'New Agent',
      type: 'agent',
      closable: true,
      agentName: '',
      agentScope: scope,
      isNewAgent: true,
    };

    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(agentTabId);
  }, []);

  // Handler for selecting or creating a droid - opens in external IDE if available
  const handleSelectDroid = useCallback((agentName: string, agentScope: 'global' | 'project', isNew = false, filePath?: string) => {
    if (isNew) {
      handleCreateNewAgent(agentScope);
      return;
    }

    // Open in external IDE or internal code editor
    if (filePath) {
      const { fileOpenTarget } = useIDEStore.getState();
      if (fileOpenTarget === 'external') {
        void tryOpenInIDE(filePath);
      } else {
        handleOpenFileInEditorTab(filePath);
      }
      return;
    }

    // No filePath: open legacy internal tab
    const agentTabId = `agent-${agentName}-${agentScope}`;
    const existingTab = tabs.find(t => t.id === agentTabId);

    if (existingTab) {
      setActiveTabId(agentTabId);
    } else {
      const newTab: Tab = {
        id: agentTabId,
        label: agentName.replace(/-/g, ' '),
        type: 'agent',
        closable: true,
        agentName,
        agentScope,
      };

      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId(agentTabId);
    }
  }, [tabs, handleCreateNewAgent]);

  const handleUseAgent = useCallback((agentInfo: AgentInfo) => {
    // Set the agent as active for the chat tab
    setActiveAgent(agentInfo);

    // Also trigger mention insertion in ChatInput for the message
    setPendingAgentMention(agentInfo);

    toast.success(`Agent activated: ${agentInfo.name}`, {
      description: 'Type your message to send with this agent',
      duration: 2000,
    });
  }, []);

  // Command tab handler - opens in external IDE if available, falls back to internal tab
  const handleSelectCommand = useCallback((commandName: string, commandScope: 'global' | 'project', isNew = false, filePath?: string) => {
    // Open in external IDE or internal code editor
    if (!isNew && filePath) {
      const { fileOpenTarget } = useIDEStore.getState();
      if (fileOpenTarget === 'external') {
        void tryOpenInIDE(filePath);
      } else {
        handleOpenFileInEditorTab(filePath);
      }
      return;
    }

    // No filePath (new command): open legacy internal tab
    const commandTabId = isNew ? `command-new-${Date.now()}` : `command-${commandName}-${commandScope}`;
    const existingTab = tabs.find(t => t.id === commandTabId);

    if (existingTab) {
      setActiveTabId(commandTabId);
    } else {
      const newTab: Tab = {
        id: commandTabId,
        label: isNew ? 'New Command' : `/${commandName}`,
        type: 'command',
        closable: true,
        commandName,
        commandScope,
        isNewCommand: isNew,
      };
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId(commandTabId);
    }
  }, [tabs]);

  // Rule tab handler - opens in external IDE if available, falls back to internal tab
  const handleSelectRule = useCallback((ruleName: string, ruleScope: 'global' | 'project', isNew = false, filePath?: string) => {
    // Open in external IDE or internal code editor
    if (!isNew && filePath) {
      const { fileOpenTarget } = useIDEStore.getState();
      if (fileOpenTarget === 'external') {
        void tryOpenInIDE(filePath);
      } else {
        handleOpenFileInEditorTab(filePath);
      }
      return;
    }

    // No filePath (new rule): open legacy internal tab
    const ruleTabId = isNew ? `rule-new-${Date.now()}` : `rule-${ruleName}-${ruleScope}`;
    const existingTab = tabs.find(t => t.id === ruleTabId);

    if (existingTab) {
      setActiveTabId(ruleTabId);
    } else {
      const newTab: Tab = {
        id: ruleTabId,
        label: isNew ? 'New Rule' : ruleName,
        type: 'rule',
        closable: true,
        ruleName,
        ruleScope,
        isNewRule: isNew,
      };
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId(ruleTabId);
    }
  }, [tabs]);

  // Skills handlers
  const loadSkills = useCallback(async () => {
    if (!tauriAvailable) {
      return;
    }

    setLoadingSkills(true);
    setSkillsError(null);

    try {
      const workingDir = getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);

      // Check if PROJECT skills directory exists (for UI display purposes)
      const dirExists = await invoke<boolean>("check_skills_directory", {
        workingDir,
      });
      setSkillsDirectoryExists(dirExists);

      // ALWAYS call list_skills - it will return global skills even if project dir doesn't exist
      const skillsList = await invoke<SkillInfo[]>("list_skills", {
        workingDir,
      });
      setSkills(skillsList);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setSkillsError(message);
      setSkills([]);
    } finally {
      setLoadingSkills(false);
    }
  }, [tauriAvailable, activeTerminal?.cwd, explorerPath]);

  // Skills handler - opens in external IDE if available, falls back to internal tab
  const handleSelectSkill = useCallback(async (skillInfo: SkillInfo) => {
    if (!tauriAvailable) {
      return;
    }

    // Open in external IDE or internal code editor
    if (skillInfo.file_path) {
      const { fileOpenTarget } = useIDEStore.getState();
      if (fileOpenTarget === 'external') {
        const opened = await tryOpenInIDE(skillInfo.file_path);
        if (opened) return;
      } else {
        handleOpenFileInEditorTab(skillInfo.file_path);
        return;
      }
    }

    // No file_path: open legacy internal tab
    try {
      const skillTabId = `skill-${skillInfo.name}-${skillInfo.scope}`;
      const existingTab = tabs.find(t => t.id === skillTabId);

      if (existingTab) {
        setActiveTabId(skillTabId);
      } else {
        const newTab: Tab = {
          id: skillTabId,
          label: skillInfo.name.replace(/-/g, ' '),
          type: 'skill',
          closable: true,
          skillName: skillInfo.name,
          skillScope: skillInfo.scope as 'global' | 'project',
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(skillTabId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to open skill: ${message}`);
    }
  }, [tauriAvailable, tabs]);

  // Hooks handlers
  const loadHooks = useCallback(async () => {
    if (!tauriAvailable) {
      return;
    }

    setLoadingHooks(true);
    setHooksError(null);

    try {
      const workingDir = getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);
      const hooksList = await invoke<HookConfig[]>("list_hooks", {
        workingDir,
      });
      setHooks(hooksList);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setHooksError(message);
      setHooks([]);
    } finally {
      setLoadingHooks(false);
    }
  }, [tauriAvailable, activeTerminal?.cwd, explorerPath]);

  const handleSaveHook = useCallback(async (hook: HookConfig) => {
    if (!tauriAvailable) {
      throw new Error('Tauri not available');
    }

    const workingDir = getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);
    await invoke<HookConfig>("save_hook", {
      workingDir,
      hook,
    });
    toast.success(`Hook "${hook.name}" saved`);
  }, [tauriAvailable, activeTerminal?.cwd, explorerPath]);

  const handleDeleteHook = useCallback(async (hookId: string, scope: string) => {
    if (!tauriAvailable) {
      throw new Error('Tauri not available');
    }

    const workingDir = getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);
    await invoke("delete_hook", {
      workingDir,
      hookId,
      scope,
    });
    toast.success('Hook deleted');
  }, [tauriAvailable, activeTerminal?.cwd, explorerPath]);

  const handleToggleHook = useCallback(async (hookId: string, enabled: boolean) => {
    if (!tauriAvailable) {
      throw new Error('Tauri not available');
    }

    const workingDir = getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);
    await invoke("toggle_hook", {
      workingDir,
      hookId,
      enabled,
    });
    // No toast here - toggle is fast and visual feedback is immediate
  }, [tauriAvailable, activeTerminal?.cwd, explorerPath]);

  // Marketplace refresh handler - refreshes all panels when resources are installed
  const handleMarketplaceRefresh = useCallback(async () => {
    // Reload agents, skills, and let panels like CommandsPanel/MCPPanel refresh internally
    await Promise.all([
      loadAgents(),
      loadSkills(),
    ]);
  }, [loadAgents, loadSkills]);

  // Handle agent bundle installed from Quack Store - creates terminal in sidebar
  const handleAgentBundleInstalled = useCallback(async (data: AgentBundleInstallData) => {
    if (!tauriAvailable) return;

    const { template, projectPath, projectName, installedSkills, installedRules } = data;
    try {
      const created = await invoke<TerminalInfo>("create_terminal", {
        label: template.suggestedName,
        color: template.suggestedColor,
        cwd: projectPath,
        workingOn: null,
        avatar: template.suggestedAvatar || null,
        branch: null,
      });

      const personality: Partial<AgentPersonality> = {
        role: template.role,
        communicationStyle: template.communicationStyle,
        customNotes: template.customNotes,
        selectedSkills: installedSkills.length > 0 ? installedSkills : undefined,
        selectedRules: installedRules.length > 0 ? installedRules : undefined,
      };

      const createdWithState: TerminalInfo = {
        ...created,
        status: "idle",
        needsAttention: false,
        hasResponded: false,
        responseStartTime: null,
        avatar: template.suggestedAvatar,
        personality,
      };

      setTerminals((prev) => [...prev, createdWithState]);
      setActiveId(createdWithState.id);
      setActiveSessionId(null);
      setActiveTaskId(null);
      setActiveTabId('chat');
      clearTerminalAttention(createdWithState.id);
      void addActiveAgent(projectPath, createdWithState.id);

      // Persist project in sidebar
      setPersistedProjects(prev => {
        if (prev.has(projectPath)) return prev;
        const next = new Map(prev);
        next.set(projectPath, projectName);
        return next;
      });

      // Save personality in background
      if (Object.keys(personality).length > 0) {
        const fullPersonality: AgentPersonality = {
          id: createdWithState.id,
          name: template.suggestedName,
          role: personality.role || '',
          communicationStyle: personality.communicationStyle || 'friendly',
          customNotes: personality.customNotes || undefined,
          selectedRules: personality.selectedRules || undefined,
          selectedSkills: personality.selectedSkills || undefined,
        };

        fireAndForget('save_agent_personality', {
          projectPath,
          personality: fullPersonality,
        }, (error) => {
          console.error('Failed to save personality:', error);
        });

        fireAndForget('inject_personality_to_claude_md', {
          projectPath,
          personality: fullPersonality,
        }, (error) => {
          console.error('Failed to inject personality to CLAUDE.md:', error);
        });
      }

      // Close the store drawer after successful install
      setShowStoreDrawer(false);
    } catch (err) {
      console.error('Failed to create agent from bundle:', err);
      toast.error('Agent installed but failed to add to sidebar');
    }
  }, [tauriAvailable, clearTerminalAttention, addActiveAgent]);

  const handleMentionFile = useCallback((filePath: string, fileName: string, isDirectory: boolean) => {
    // Calculate relative path from explorerRoot
    const basePath = explorerRoot ?? explorerPath;
    let relativePath = filePath;

    if (basePath && filePath.startsWith(basePath)) {
      relativePath = filePath.substring(basePath.length).replace(/^\//, '');
    }

    // Set pending file/folder mention for ChatInput to pick up
    setPendingFileMention({
      name: fileName,
      path: filePath,
      relativePath: relativePath,
      isDirectory,
    });

    toast.success(`File mention added: @file:${relativePath}`, {
      description: 'File reference inserted in chat input',
      duration: 2000,
    });
  }, [explorerRoot, explorerPath]);

  const handleCreateAgent = useCallback(async (
    name: string,
    description: string,
    model: string,
    color: string,
    content: string,
    scope: 'global' | 'project',
    workingOn?: string,
    avatar?: string
  ) => {
    if (!tauriAvailable) {
      return;
    }


    try {
      const workingDir = getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);
      await invoke<string>("create_agent", {
        name,
        description,
        model,
        color,
        content,
        scope,
        workingDir,
        workingOn,
        avatar,
      });
      toast.success(`Agent created successfully: ${name}`, {
        description: `New agent "${name}" has been added`,
        duration: 3000,
      });
      // Refresh agents list
      void loadAgents();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to create agent: ${message}`, {
        duration: 5000,
      });
    }
  }, [tauriAvailable, activeTerminal?.cwd, explorerPath, loadAgents]);

  const handleOpenContextDrawer = useCallback((scope: string) => {
    setContextScope(scope);
    setShowContextDrawer(true);
  }, []);

  const handleUseCommand = useCallback((command: { name: string; description: string }) => {
    // Set pending slash command to trigger insertion in ChatInput
    setPendingSlashCommand(command);
    toast.success(`Command added: /${command.name}`, {
      description: 'Press Enter to execute the command',
      duration: 2000,
    });
  }, []);


  const handleClearAgent = useCallback(() => {
    setActiveAgent(null);
    toast.info('Agent deactivated', {
      description: 'Chat will use default model settings',
      duration: 2000,
    });
  }, []);


  // Load Quack Agency agents on startup
  // Load agents in parallel with main bootstrap (non-blocking)
  // booting/hasBootstrapped are controlled by main bootstrap only (line ~6355)
  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }
    console.log('[Startup] Loading agents...');
    void loadAgents().then(() => console.log('[Startup] Agents loaded'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tauriAvailable]);

  // 🦆 FIX: Reload agents when project/working directory changes
  // This ensures @mention dropdown shows correct droids for the current project
  //
  // NOTE: `loadAgents` is intentionally NOT in deps. Its useCallback re-creates
  // on every change of activeTerminal?.cwd OR explorerPath, which during a
  // session click change in two cascading steps (setActiveId then loadDirectory)
  // would re-trigger this effect twice — paying the Tauri round-trip
  // (`check_agents_directory` + `list_agents`) on every cross-project session
  // switch. Keying on `currentWorkingDir` alone coalesces both transitions
  // into a single load. Same pattern as the loadSkills effect below.
  // Brain: fix-token-stats-panel-blocks-project-switch (related slow-switch work)
  const currentWorkingDir = activeTerminal?.cwd ?? explorerPath;
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped || !currentWorkingDir) {
      return;
    }
    console.log('[Agents] Reloading agents for new working directory:', currentWorkingDir);
    void loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentWorkingDir, tauriAvailable, hasBootstrapped]);

  // Load Skills on startup only (not on every terminal switch!)
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }
    void loadSkills();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tauriAvailable, hasBootstrapped]); // Intentionally NOT including loadSkills to prevent re-load on every switch

  // Listen for plugin installation/uninstallation events and refresh agents list
  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }

    const unlistenInstalled = listen('plugin-installed', (event) => {
      console.log('🦆 Plugin installed event received:', event.payload);
      void loadAgents();
      toast.success('Plugin installed successfully! Agents list updated.');
    });

    const unlistenUninstalled = listen('plugin-uninstalled', () => {
      console.log('🦆 Plugin uninstalled event received');
      void loadAgents();
      toast.info('Plugin uninstalled. Agents list updated.');
    });

    return () => {
      void unlistenInstalled.then((fn) => fn()).catch(() => undefined);
      void unlistenUninstalled.then((fn) => fn()).catch(() => undefined);
    };
  }, [loadAgents, tauriAvailable]);

  // Helper to apply background (image or gradient)
  const applyBackground = useCallback((backgroundName: string) => {
    // Handle transparent background (default)
    if (backgroundName === 'transparent') {
      document.body.style.backgroundImage = 'none';
      document.body.style.backgroundColor = 'transparent';
      document.body.style.backgroundRepeat = '';
      document.body.style.backgroundPosition = '';
      document.body.style.backgroundSize = '';
      return;
    }

    // Check if it's a gradient
    if (backgroundName.startsWith('gradient-')) {
      // Map gradient names to actual CSS gradients
      const gradientMap: Record<string, string> = {
        // Solid colors
        'gradient-black-plain': '#000000',
        'gradient-dark-gray-plain': '#0D1118',
        'gradient-midnight': '#0f1115',
        // Gradients
        'gradient-orange-dark': 'linear-gradient(135deg, #1a0f0a 0%, #3d2415 50%, #1a0f0a 100%)',
        'gradient-blue-dark': 'linear-gradient(135deg, #0a0f1a 0%, #15243d 50%, #0a0f1a 100%)',
        'gradient-green-dark': 'linear-gradient(135deg, #0a1a0f 0%, #15392d 50%, #0a1a0f 100%)',
        'gradient-purple-dark': 'linear-gradient(135deg, #160a1a 0%, #2d1539 50%, #160a1a 100%)',
        'gradient-red-dark': 'linear-gradient(135deg, #1a0a0a 0%, #3d1515 50%, #1a0a0a 100%)',
        'gradient-teal-dark': 'linear-gradient(135deg, #0a1a1a 0%, #153d3d 50%, #0a1a1a 100%)',
        'gradient-amber-dark': 'linear-gradient(135deg, #1a150a 0%, #3d3015 50%, #1a150a 100%)',
        'gradient-neon': 'linear-gradient(135deg, #0a0a1a 0%, #1a0a2d 25%, #2d0a3d 50%, #1a0a2d 75%, #0a0a1a 100%)',
        'gradient-cosmic': 'linear-gradient(180deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)',
      };

      const gradient = gradientMap[backgroundName];
      if (gradient) {
        if (gradient.startsWith('linear-gradient') || gradient.startsWith('radial-gradient')) {
          document.body.style.backgroundImage = gradient;
          document.body.style.backgroundColor = 'transparent';
        } else {
          // Solid color
          document.body.style.backgroundImage = 'none';
          document.body.style.backgroundColor = gradient;
        }
        document.body.style.backgroundSize = '';
        document.body.style.backgroundRepeat = '';
        document.body.style.backgroundPosition = '';
      }
    } else {
      // It's an image file - use pre-loaded URLs from component scope
      const imageMap: Record<string, string> = {
        'duck.png': duckBackgroundImage,
        'ducks-pattern.png': ducksPatternBackgroundImage,
        'duck-pattern3.png': duckPattern3BackgroundImage,
        'hacker.png': hackerBackgroundImage,
        'duckbusiness.png': duckBusinessBackgroundImage,
        'duckmoto.png': duckMotoBackgroundImage,
        'duckpool.png': duckPoolBackgroundImage,
        'duckread.png': duckReadBackgroundImage,
        'gtaduck.png': gtaDuckBackgroundImage,
        'jazzduck.png': jazzDuckBackgroundImage,
        'e00b8faae79c45741ad8ff0060614a1ddd03bcea.png': cyberpunkDuckBackgroundImage,
      };

      const imagePath = imageMap[backgroundName] || `/images/backgrounds/${backgroundName}`;
      document.body.style.backgroundImage = `url('${imagePath}')`;
      document.body.style.backgroundColor = 'transparent';

      // Apply repeat-y and center position only for duck-pattern3.png
      if (backgroundName === 'duck-pattern3.png') {
        document.body.style.backgroundRepeat = 'repeat-y';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundSize = 'auto';
      } else {
        document.body.style.backgroundRepeat = '';
        document.body.style.backgroundPosition = '';
        document.body.style.backgroundSize = '';
      }
    }
  }, [duckBackgroundImage, ducksPatternBackgroundImage, duckPattern3BackgroundImage]);

  // Load saved background on mount (immediately, so it shows during splash)
  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }

    const loadBackground = async () => {
      try {
        const savedBackground = await invoke<string>("get_background_image");
        setCurrentBackground(savedBackground);
        applyBackground(savedBackground);
      } catch (error) {
        console.warn("Unable to load saved background", error);
        // Apply default background if no saved preference
        applyBackground(currentBackground);
      }
    };

    void loadBackground();
  }, [tauriAvailable, applyBackground]);

  // Apply background when it changes
  useEffect(() => {
    if (!currentBackground) {
      return;
    }

    applyBackground(currentBackground);
  }, [currentBackground, applyBackground]);

  const handleSelectBackground = useCallback(async (background: string) => {
    if (!tauriAvailable) {
      return;
    }

    try {
      await invoke("set_background_image", { image: background });
      setCurrentBackground(background);
    } catch (error) {
      console.error("Unable to save background", error);
    }
  }, [tauriAvailable]);

  const handleTerminalInput = useCallback(
    (id: string, data: string) => {
      if (!data) {
        return;
      }

      // Track commands for AI context
      // Command tracking is handled by TerminalView component

      if (
        data.includes("\r") ||
        data.includes("\n") ||
        data.trim().length > 0
      ) {
        markTerminalBusy(id);
        clearIdleTimer(id);
        clearNotificationTimer(id); // Reset notification timer on input
        // Reset output buffer quando user invia input
        outputBuffersRef.current.delete(id);
      }
    },
    [clearIdleTimer, clearNotificationTimer, markTerminalBusy, terminals]
  );

  const handleTerminalOutput = useCallback(
    (id: string, data: string) => {
      if (!data) {
        return;
      }

      // Performance: accumula chunks invece di processare subito
      const now = Date.now();
      let bufferEntry = outputBuffersRef.current.get(id);

      if (!bufferEntry) {
        bufferEntry = { chunks: [], lastCheck: now };
        outputBuffersRef.current.set(id, bufferEntry);
      }

      bufferEntry.chunks.push(data);

      // Check status solo ogni 200ms o se chunk contiene newline (probabile prompt)
      const shouldCheck = (now - bufferEntry.lastCheck) >= STATUS_CHECK_INTERVAL
        || data.includes('\n') || data.includes('\r');

      if (shouldCheck && bufferEntry.chunks.length > 0) {
        // Combina tutti i chunks e controlla una volta sola
        const combined = bufferEntry.chunks.join('');

        if (chunkContainsPrompt(combined)) {
          markTerminalIdle(id);
          clearIdleTimer(id);
          // Schedule notification timer dopo che l'idle viene rilevato
          scheduleNotificationTimer(id);
          outputBuffersRef.current.delete(id);
        } else {
          // Solo marca busy e schedule timer, non pulire buffer
          markTerminalBusy(id);
          scheduleIdleTimer(id);
          // Resetta notification timer perché c'è attività
          scheduleNotificationTimer(id);
          bufferEntry.lastCheck = now;
          // Mantieni solo ultimi 3 chunks per non far crescere troppo il buffer
          bufferEntry.chunks = bufferEntry.chunks.slice(-3);
        }
      } else if (!shouldCheck) {
        // Se non checkiamo ancora, marca busy e schedule timer senza check pesante
        markTerminalBusy(id);
        scheduleIdleTimer(id);
        // Resetta notification timer perché c'è attività
        scheduleNotificationTimer(id);
      }
    },
    [clearIdleTimer, markTerminalBusy, markTerminalIdle, scheduleIdleTimer, scheduleNotificationTimer]
  );

  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }

    const unlistenPromise = listen<{
      id?: string | null;
      label?: string | null;
      status: string;
      notify?: boolean;
    }>("external-terminal-status", (event) => {
      const payload = event.payload;
      if (!payload) {
        return;
      }

      const resolvedId = resolveTerminalId({
        id: payload.id ?? undefined,
        label: payload.label ?? undefined,
      });
      if (!resolvedId) {
        console.warn(
          "Hook event ignored: no matching terminal for",
          payload
        );
        return;
      }

      const status =
        typeof payload.status === "string" ? payload.status.toLowerCase() : "";
      if (status === "busy") {
        markTerminalBusy(resolvedId);
        clearIdleTimer(resolvedId);
      } else if (status === "idle") {
        clearIdleTimer(resolvedId);
        markTerminalIdle(resolvedId, {
          suppressNotification: payload.notify === false,
        });
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [
    clearIdleTimer,
    markTerminalBusy,
    markTerminalIdle,
    resolveTerminalId,
    tauriAvailable,
  ]);

  // Listen for file open requests from browser window
  useEffect(() => {
    if (!tauriAvailable) return;

    const unlistenPromise = listen<{ filePath: string }>('open-file-from-browser', async (event) => {
      const { filePath } = event.payload;
      console.log('🦆 Opening file from browser window:', filePath);

      try {
        // Open file in main window - create file tab directly
        const fileName = filePath.split('/').pop() || 'Unknown';
        const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

        const newFileTab: Tab = {
          id: `file-${Date.now()}`,
          label: fileName,
          type: 'file',
          filePath: filePath,
          closable: true,
          icon: fileExtension === 'ts' || fileExtension === 'tsx' ? '📘' :
                fileExtension === 'js' || fileExtension === 'jsx' ? '📙' :
                fileExtension === 'json' ? '📋' :
                fileExtension === 'css' || fileExtension === 'scss' ? '🎨' :
                fileExtension === 'md' ? '📝' : '📄',
        };

        setTabs((prevTabs) => [...prevTabs, newFileTab]);
        setActiveTabId(newFileTab.id);

        toast.success('File opened from browser! 📂', {
          description: filePath,
          duration: 2000,
        });
      } catch (error) {
        console.error('Failed to open file from browser:', error);
        toast.error('Failed to open file', {
          description: String(error),
          duration: 3000,
        });
      }
    });

    return () => {
      void unlistenPromise.then((fn) => fn()).catch(() => undefined);
    };
  }, [tauriAvailable]);

  // 📄 Listen for OPEN_FILE_IN_TAB events from Second Brain (document nodes)
  useEffect(() => {
    const handleOpenFileInTab = async (event: CustomEvent<{ filePath: string; projectName?: string }>) => {
      const { filePath, projectName } = event.detail;
      console.log('🦆 Opening file from Second Brain:', filePath, 'projectName:', projectName);

      // Resolve relative paths to absolute paths
      let absolutePath = filePath;

      if (!filePath.startsWith('/')) {
        // For relative paths, try to find the project path from MCP memory
        let projectPath: string | null = null;

        if (projectName) {
          try {
            // Read MCP memory to find project path
            const graph = await invoke<{ entities: Array<{ name: string; entityType: string; observations: string[] }> }>('read_mcp_memory_file');

            // Find the project entity
            const projectEntity = graph.entities.find(
              e => e.entityType === 'project' && e.name.toLowerCase() === projectName.toLowerCase()
            );

            if (projectEntity) {
              // Extract path from observations (format: "Path: /path/to/project")
              const pathObs = projectEntity.observations.find(obs => obs.startsWith('Path:'));
              if (pathObs) {
                projectPath = pathObs.substring(5).trim(); // Remove "Path:" prefix
                console.log('🦆 Found project path from MCP memory:', projectPath);
              }
            }
          } catch (err) {
            console.warn('🦆 Failed to lookup project path from MCP memory:', err);
          }
        }

        // Use project path from memory, or fall back to current explorerRoot
        const basePath = projectPath || explorerRoot;
        if (basePath) {
          absolutePath = `${basePath}/${filePath}`;
        }
      }

      // Open in external IDE only if user prefers it
      const { fileOpenTarget } = useIDEStore.getState();
      if (fileOpenTarget === 'external') {
        toast('Opening in your IDE...', { duration: 2000 });
        try {
          const { openFileInIDE } = useIDEStore.getState();
          await openFileInIDE(absolutePath);
          return;
        } catch (err) {
          console.error('[App] Failed to open Second Brain doc in IDE:', err);
          toast.error('Failed to open in IDE');
        }
      }

      // Open internal tab (default)
      const fileName = absolutePath.split('/').pop() || 'Document';
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || '';

      const fileTabId = `file-${absolutePath}`;
      const newFileTab: Tab = {
        id: fileTabId,
        label: fileName,
        type: 'file',
        filePath: absolutePath,
        closable: true,
        icon: fileExtension === 'md' ? '📝' :
              fileExtension === 'ts' || fileExtension === 'tsx' ? '📘' :
              fileExtension === 'js' || fileExtension === 'jsx' ? '📙' :
              fileExtension === 'json' ? '📋' : '📄',
      };

      // Add tab if it doesn't exist
      setTabs((prevTabs) => {
        const existingTab = prevTabs.find(t => t.id === fileTabId);
        if (!existingTab) {
          return [...prevTabs, newFileTab];
        }
        return prevTabs;
      });

      setActiveTabId(fileTabId);

      // Load file content (like handleOpenFilePreview does)
      setPreviewFile({ name: fileName, path: absolutePath });
      setPreviewContent('');
      setPreviewImageData(null);
      setPreviewError(null);
      setPreviewDiffInfo(null);
      setPreviewLineChanges(null);
      setLoadingPreview(true);

      try {
        // Check if file is an image
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
        const isImage = imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));

        if (isImage) {
          // Load image as base64
          const base64Data = await invoke<string>('read_file_preview', { path: absolutePath });
          const ext = fileName.toLowerCase().split('.').pop() || 'png';
          const mimeTypes: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon',
            'tiff': 'image/tiff',
            'tif': 'image/tiff',
          };
          const mimeType = mimeTypes[ext] || 'image/png';
          setPreviewImageData(`data:${mimeType};base64,${base64Data}`);
        } else {
          // Load file content
          const content = await invoke<string>('read_file_content', { path: absolutePath });
          setPreviewContent(content);
        }

        toast.success('Document opened!', {
          description: fileName,
          duration: 2000,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('🦆 Error loading file from Second Brain:', message);
        setPreviewError(message);
        toast.error('Failed to open document', {
          description: message,
          duration: 4000,
        });
      } finally {
        setLoadingPreview(false);
      }
    };

    window.addEventListener('OPEN_FILE_IN_TAB', handleOpenFileInTab as unknown as EventListener);

    return () => {
      window.removeEventListener('OPEN_FILE_IN_TAB', handleOpenFileInTab as unknown as EventListener);
    };
  }, [explorerRoot]);

  useEffect(() => {
    if (!tauriAvailable) {
      setBooting(false);
      setHasBootstrapped(true);
      setExplorerError("Run the app via Tauri to activate terminals.");
      return;
    }

    void ensureNotificationPermission();

    const bootstrap = async () => {
      try {
        // 💰 License revalidation check (on every app startup)
        try {
          const { getLicenseData, revalidateLicense } = await import('./config/features');
          const licenseData = getLicenseData();

          // Always revalidate on app startup (no more 7-day check)
          if (licenseData) {
            console.log('🦆 Revalidating license on app startup (Gumroad + Supabase)...');
            const isStillValid = await revalidateLicense();

            if (!isStillValid) {
              console.warn('⚠️ License is no longer valid (refunded, expired, or subscription ended)');
              // Toast notification to inform user
              toast.error('License Deactivated', {
                description: 'Your license is no longer valid. Switching to Free tier.',
                duration: 10000,
              });
            } else {
              console.log('✅ License revalidated successfully');
            }
          }
        } catch (licenseError) {
          console.warn('License revalidation check failed (non-critical):', licenseError);
        }

        // ✅ DEFENSIVE: Check storage version before loading any data
        // This prevents crashes from incompatible data formats after app updates
        await checkStorageVersion();

        // Load project colors for project-first modal
        const colors = await loadProjectColors();
        setProjectColors(colors);

        // NOTE: Legacy migration removed - storage is now clean
        // If you need to re-enable migration, uncomment:
        // await migrateFromLegacy();

        // Load saved agents from unified storage
        const savedAgents = await loadUnifiedAgents();
        const savedMetadata = savedAgents.map(unifiedAgentToTerminalMetadata);
        setHasSavedAgents(savedAgents.length > 0);

        // Brain: fix-linux-projects-disappear-on-restart
        // Immediately re-save agents to ensure the 'agents' key exists in the store.
        // This guards against the race condition where saveAgentSessions() calls
        // store.save() before agents have been written, causing the agents key to
        // be absent from the file. By saving eagerly at boot, the key is always present.
        if (savedAgents.length > 0) {
          await saveUnifiedAgents(savedAgents);
        }

        // Build persisted projects map from saved agents
        const projectMap = new Map<string, string>();
        for (const agent of savedAgents) {
          if (agent.projectPath && !projectMap.has(agent.projectPath)) {
            projectMap.set(agent.projectPath, agent.projectName || extractProjectId(agent.projectPath) || 'Unknown');
          }
        }
        setPersistedProjects(projectMap);

        if (savedMetadata.length > 0) {
          console.log(`Found ${savedMetadata.length} saved terminals from unified storage`);

          // Recreate terminals from saved metadata
          const recreated: TerminalInfo[] = [];
          for (const metadata of savedMetadata) {
            try {
              const terminal = await invoke<TerminalInfo>("create_terminal", {
                id: metadata.id, // ✅ CRITICAL: Pass saved ID to maintain personality linkage
                label: metadata.label,
                color: metadata.color,
                cwd: metadata.cwd,
              });

              // Preserve agentChatId if it exists
              const terminalWithState: TerminalInfo = {
                ...terminal,
                status: "idle" as const,
                needsAttention: false,
                hasResponded: false,
                responseStartTime: null,
                workingOn: metadata.workingOn,
                avatar: metadata.avatar,
                branch: metadata.branch,
                personality: metadata.personality, // Restore personality traits
              };

              recreated.push(terminalWithState);

              // ✅ ONE-TIME MIGRATION: For old save files, check if personality file exists
              // If personality data exists in state but file doesn't exist, create it
              if (metadata.personality && terminal.id) {
                try {
                  // Check if personality file already exists
                  const loadedPersonality = await invoke<AgentPersonality>('load_agent_personality', {
                    projectPath: metadata.cwd,
                    personalityId: terminal.id,
                  });

                  // Only create if we got default (file doesn't exist)
                  if (loadedPersonality.id === 'default') {
                    console.log(`📝 Creating personality file for "${metadata.label}" from saved state...`);

                    const personalityToSave: AgentPersonality = {
                      id: terminal.id,
                      name: metadata.label,
                      role: metadata.personality.role || 'Feature Coordinator',
                      technicalContext: metadata.personality.technicalContext,
                      rules: metadata.personality.rules,
                      communicationStyle: metadata.personality.communicationStyle || 'friendly',
                      customNotes: metadata.personality.customNotes,
                      // Legacy fields
                      intro: metadata.personality.intro,
                      personality: metadata.personality.personality,
                      quirks: metadata.personality.quirks,
                      specialties: metadata.personality.specialties,
                      skills: metadata.personality.skills,
                      expressions: metadata.personality.expressions,
                    };

                    await invoke('save_agent_personality', {
                      projectPath: metadata.cwd,
                      personality: personalityToSave,
                    });

                    await invoke('inject_personality_to_claude_md', {
                      projectPath: metadata.cwd,
                      personality: personalityToSave,
                    });

                    console.log(`✅ Created personality file for "${metadata.label}"`);
                  } else {
                    console.log(`✅ Personality file already exists for "${metadata.label}"`);
                  }
                } catch (err) {
                  console.warn(`Could not check/create personality for ${metadata.label}:`, err);
                }
              }

              // console.log(`Recreated terminal: ${terminal.label}`, { // Performance: Disabled logging
              //   workingOn: metadata.workingOn,
              //   avatar: metadata.avatar,
              //   branch: metadata.branch,
              //   personality: metadata.personality ? 'loaded' : 'none',
              // });
            } catch (error) {
              console.warn(
                `Unable to recreate terminal ${metadata.label}`,
                error
              );
            }
          }

          // SIMPLE: Just load terminals - no migration needed!
          setTerminals(recreated);

          // 🔵 Initialize lastReadTimestamps to NOW for all agents at boot
          // This prevents "Quack quack..." badge from showing on pre-existing sessions
          // Badge should only appear for NEW messages received after app startup
          const bootTimestamp = Date.now();
          setLastReadTimestamps((prev) => {
            const updated = new Map(prev);
            for (const terminal of recreated) {
              if (!updated.has(terminal.id)) {
                updated.set(terminal.id, bootTimestamp);
              }
            }
            return updated;
          });

          // Load sessions from sessionStore (sessions-first architecture)
          await useSessionStore.getState().loadSessions();

          // Auto-cleanup old completed sessions (>30 days)
          const sessionsBeforeCleanup = useSessionStore.getState().sessions;
          const { deletedCount, deletedIds } = cleanupOldSessions(sessionsBeforeCleanup, 30);

          if (deletedCount > 0) {
            console.log(`[Session Cleanup] Deleted ${deletedCount} old sessions (>30 days old, status=done):`, deletedIds);
            const sessionStore = useSessionStore.getState();
            for (const id of deletedIds) {
              await sessionStore.deleteSession(id);
            }
            await sessionStore.loadSessions();
            toast.success(`Cleaned up ${deletedCount} old session(s)`, {
              description: 'Removed sessions completed more than 30 days ago',
              duration: 3000,
            });
          }

          const allSessions = useSessionStore.getState().sessions;
          console.log(`[Session Bootstrap] Loaded ${allSessions.length} sessions`);

          // 🦆 STAMINA PERSISTENCE: Restore chatTokensMap from persisted session tokens
          // This ensures stamina bar shows correct values after app restart
          const restoredTokens = new Map<string, {
            inputTokens: number; outputTokens: number;
            cacheCreationTokens: number; cacheReadTokens: number; totalCost: number;
          }>();
          for (const session of allSessions) {
            if (session.inputTokens && session.inputTokens > 0) {
              restoredTokens.set(session.id, {
                inputTokens: session.inputTokens,
                outputTokens: session.outputTokens || 0,
                cacheCreationTokens: session.cacheCreationTokens || 0,
                cacheReadTokens: session.cacheReadTokens || 0,
                totalCost: session.totalCost || 0,
              });
            }
          }
          if (restoredTokens.size > 0) {
            setChatTokensMap(restoredTokens);
            console.log(`[Session Bootstrap] 🦆 Restored stamina tokens for ${restoredTokens.size} sessions`);
          }

          // 🚀 LAZY HYDRATION: Chat messages are now loaded on-demand when session is selected
          // This significantly improves startup time by avoiding N resume_session calls at boot

          // Load tabs by terminal from storage
          const savedTabsByTerminal = await loadTabsByTerminalFromStorage();
          if (savedTabsByTerminal.size > 0) {
            setTabsByTerminal(savedTabsByTerminal);
          }

          // Set first terminal as active if we have any
          if (recreated.length > 0) {
            setActiveId(recreated[0].id);
            await loadDirectory(recreated[0].cwd);
          }
        } else {
          console.log('No saved terminals found - empty state will be shown');
          // Sessions-first: just load sessions (chat messages loaded on-demand)
          await useSessionStore.getState().loadSessions();
          const allSessions = useSessionStore.getState().sessions;
          console.log(`[Session Bootstrap] Loaded ${allSessions.length} sessions (no terminals)`);

          // 🚀 LAZY HYDRATION: Chat messages are now loaded on-demand when session is selected
          // This significantly improves startup time by avoiding N resume_session calls at boot
        }
      } catch (error) {
        console.error("Error during initialization", error);
      } finally {
        setBooting(false);
        setHasBootstrapped(true);

        // Load saved native terminals (non-blocking, after app is ready)
        void (async () => {
          try {
            const savedNativeTerminals = await loadNativeTerminalsFromStorage();
            if (savedNativeTerminals.length > 0) {
              console.log(`Found ${savedNativeTerminals.length} saved native terminals`);
              setNativeTerminals(savedNativeTerminals);
            }
          } catch (error) {
            console.warn("Unable to load saved native terminals", error);
          }
        })();
      }
    };

    void bootstrap();
  }, [ensureNotificationPermission, loadDirectory, tauriAvailable]);

  // Load Kanban tasks on mount
  useEffect(() => {
    loadKanbanTasks();
  }, [loadKanbanTasks]);

  // 🦆 FIX: Load chat sessions on app startup (not when opening Kanban!)
  // This ensures messages with events are loaded ONCE at startup,
  // preventing formatting loss when navigating to/from Kanban view
  useEffect(() => {
    if (hasBootstrapped) {
      console.log('[App Startup] Loading chat sessions from storage...');
      loadKanbanChatSessions().then(() => {
        console.log('[App Startup] Chat sessions loaded successfully');
      }).catch((err) => {
        console.warn('[App Startup] Failed to load chat sessions:', err);
      });
    }
  }, [hasBootstrapped, loadKanbanChatSessions]);

  useEffect(() => {
    if (!tauriAvailable) {
      setBooting(false);
    }
  }, [tauriAvailable]);

  // Cleanup intro audio on unmount
  useEffect(() => {
    return () => {
      if (introAudioRef.current) {
        introAudioRef.current.pause();
        introAudioRef.current.currentTime = 0;
        introAudioRef.current = null;
      }
    };
  }, []);


  // Global keyboard shortcut: Cmd+J to open AI Assistant
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+J on Mac or Ctrl+J on other platforms
      if ((e.metaKey || e.ctrlKey) && e.key === 'j') {
        e.preventDefault();
        handleOpenAIAssistant();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleOpenAIAssistant]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const connect = async () => {
      try {
        if (!tauriAvailable) {
          return;
        }
        unlisten = await listen<TerminalExitEvent>("terminal-exit", (event) => {
          setTerminals((prev) =>
            prev.map((terminal) =>
              terminal.id === event.payload.id
                ? { ...terminal, alive: false }
                : terminal
            )
          );
          markTerminalIdle(event.payload.id);
        });
      } catch (error) {
        console.warn("Unable to listen to exit events", error);
      }
    };

    void connect();

    return () => {
      if (unlisten) {
        unlisten();
      }
    };
  }, [markTerminalIdle, tauriAvailable]);

  const handleToggleGroup = useCallback((cwd: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(cwd)) {
        next.delete(cwd);
      } else {
        next.add(cwd);
      }
      localStorage.setItem(
        "sidebar.collapsed.groups",
        JSON.stringify(Array.from(next))
      );
      return next;
    });
  }, []);

  const handleEditTerminal = useCallback(async (terminal: TerminalInfo) => {
    setEditingTerminal(terminal);
    setNewTerminalName(terminal.label);
    setNewTerminalColor(terminal.color);
    setNewTerminalPath(terminal.cwd);
    setNewTerminalWorkingOn(terminal.workingOn || "");
    setNewTerminalAvatar(terminal.avatar || ""); // Use empty string as fallback
    setNewTerminalError(null);

    // Load personality from terminal state (already persisted)
    if (terminal.personality && Object.keys(terminal.personality).length > 0) {
      setNewTerminalPersonality({
        technicalContext: '',
        rules: [],
        customNotes: '',
        ...terminal.personality,
      });
      console.log('✅ Loaded personality from state for:', terminal.label);
    } else {
      // Try to load from Rust as fallback
      try {
        const personality = await invoke<AgentPersonality>('load_agent_personality', {
          projectPath: terminal.cwd,
          personalityId: terminal.id,
        });
        setNewTerminalPersonality({
          technicalContext: '',
          rules: [],
          customNotes: '',
          ...personality,
        });
        console.log('✅ Loaded personality from Rust for:', terminal.label);
      } catch (error) {
        // No personality found - reset to default
        console.log('No existing personality found, using default');
        setNewTerminalPersonality({
          role: 'Feature Coordinator',
          intro: 'Experienced PM specializing in feature delivery and team coordination',
          communicationStyle: 'friendly',
          specialties: ['feature-planning', 'team-alignment'],
          personality: 'Organized. Proactive',
          skills: [],
          expressions: [],
        });
      }
    }

    setShowNewTerminalModal(true);
  }, []);

  // Handle editing agent from Agent Context Panel
  const handleEditAgentFromContext = useCallback(async () => {
    const activeTerminal = terminals.find((t) => t.id === activeId);
    if (!activeTerminal) {
      console.warn('No active terminal to edit');
      return;
    }

    // Load terminal data for editing
    setEditingTerminal(activeTerminal);
    setNewTerminalName(activeTerminal.label);
    setNewTerminalColor(activeTerminal.color);
    setNewTerminalPath(activeTerminal.cwd);
    setNewTerminalWorkingOn(activeTerminal.workingOn || "");
    setNewTerminalAvatar(activeTerminal.avatar || ""); // Use empty string as fallback
    setNewTerminalError(null);

    // ALWAYS try to load personality from Rust first (has most recent data from filesystem)
    // This ensures selectedSkills and other fields are loaded correctly even after app restart
    try {
      const personality = await invoke<AgentPersonality>('load_agent_personality', {
        projectPath: activeTerminal.cwd,
        personalityId: activeTerminal.id,
      });
      setNewTerminalPersonality({
        technicalContext: '',
        rules: [],
        customNotes: '',
        ...personality,
      });
      console.log('✅ Loaded personality from Rust for:', activeTerminal.label, 'skills:', personality.selectedSkills);

      // Also update terminal state with loaded personality (for AgentPersonalityCard)
      setTerminals(prev => prev.map(t =>
        t.id === activeTerminal.id
          ? { ...t, personality: { ...t.personality, ...personality } }
          : t
      ));
    } catch (error) {
      // No personality found in Rust - use terminal state or default
      console.log('No personality found in Rust, using state/default for:', activeTerminal.label);
      if (activeTerminal.personality && Object.keys(activeTerminal.personality).length > 0) {
        setNewTerminalPersonality({
          technicalContext: '',
          rules: [],
          customNotes: '',
          ...activeTerminal.personality,
        });
      } else {
        setNewTerminalPersonality({
          role: 'Feature Coordinator',
          intro: 'Experienced PM specializing in feature delivery and team coordination',
          communicationStyle: 'friendly',
          specialties: ['feature-planning', 'team-alignment'],
          personality: 'Organized. Proactive',
          skills: [],
          expressions: [],
        });
      }
    }

    // Open modal with initial step = 'agent' and mode = 'create' (form)
    // This will show the agent form directly, skipping project context
    setShowNewTerminalModal(true);
  }, [activeId, terminals]);

  // Handle session click from AgentSessionList
  const handleSessionClick = useCallback((sessionId: string) => {
    // Find the session in sessionStore
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.sessions.find(s => s.id === sessionId);
    if (!session) {
      console.warn('[App] Session not found:', sessionId);
      return;
    }

    // Cross-project switch detection: show fullscreen loader to cover the
    // ~2-3s freeze window caused by loadDirectory + cascade effects.
    // Use flushSync to force the loader to paint BEFORE the heavy sync work.
    const isCrossProject = !!session.projectPath && session.projectPath !== currentProjectPath;
    if (isCrossProject) {
      flushSync(() => {
        setProjectSwitchTarget({
          projectName: session.projectName || 'project',
          projectPath: session.projectPath,
        });
      });
      // Safety net: never let the loader stay up more than 3.5s — if the effect
      // that clears it on rootPath match doesn't fire (race / error), this fires.
      if (projectSwitchSafetyRef.current) clearTimeout(projectSwitchSafetyRef.current);
      projectSwitchSafetyRef.current = setTimeout(() => setProjectSwitchTarget(null), 3500);
    }

    // Pre-populate ChatInput with initial prompt and attachments (only if not consumed yet)
    if (!session.initialPromptConsumed) {
      if (session.initialPrompt) {
        setTaskInputDrafts(prev => {
          const newMap = new Map(prev);
          newMap.set(sessionId, session.initialPrompt!);
          return newMap;
        });
      }
      if (session.initialAttachments?.length) {
        useChatStore.getState().setAttachments(sessionId, session.initialAttachments);
      }
      // Defer the disk write so it doesn't pile onto the switch cascade
      setTimeout(() => sessionStore.updateSession(sessionId, { initialPromptConsumed: true }), 0);
    }

    const { isKanbanViewActive, setKanbanViewActive } = useKanbanStore.getState();
    if (isKanbanViewActive) {
      setKanbanViewActive(false);
    }

    // Heavy work runner — wrapped so we can defer it for cross-project switches
    // (gives the loader a chance to paint before React unmounts ChatView and
    // triggers the cascade of useEffects). For same-project switches we run it
    // synchronously: the work is cheap and deferring would cause a flash.
    const runStateUpdates = () => {
      // startTransition tells React 18 these updates are non-urgent.
      // The fullscreen-loader-overlay (already painted via flushSync) stays
      // visible while React commits this in interruptible chunks.
      startTransition(() => {
        setActiveTabId('chat');
        setActiveSessionIdExclusive(sessionId);
        selectSession(sessionId);
        if (session.agentId) {
          setActiveId(session.agentId);
        }
      });
    };

    const runHeavySideEffects = () => {
      if (session.agentId) {
        const agentTerminal = terminals.find(t => t.id === session.agentId);
        if (agentTerminal && tauriAvailable) {
          // Fire-and-forget personality injection (writes CLAUDE.md on disk).
          // No need to await — UI doesn't depend on this completing.
          (async () => {
            try {
              const personality = await invoke<AgentPersonality>('load_agent_personality', {
                projectPath: agentTerminal.cwd,
                personalityId: agentTerminal.id,
              });
              await invoke('inject_personality_to_claude_md', {
                projectPath: agentTerminal.cwd,
                personality,
              });
            } catch (error) {
              console.warn('[handleSessionClick] personality inject failed:', error);
            }
          })();
        }
      }
      if (session.projectPath) {
        void loadDirectory(session.projectPath);
      }
    };

    if (isCrossProject) {
      // Two stages of deferral: first state updates (so ChatView remount happens
      // after the loader is on screen), then heavy I/O (so Rust calls don't
      // start until both repaints are done). 50ms is enough for one frame.
      setTimeout(runStateUpdates, 0);
      setTimeout(runHeavySideEffects, 50);
    } else {
      runStateUpdates();
      runHeavySideEffects();
    }
  }, [selectSession, terminals, loadDirectory, setActiveSessionIdExclusive, tauriAvailable, currentProjectPath]);
  handleSessionClickRef.current = handleSessionClick;

  const handleUpdateWorkingOn = useCallback(async (terminalId: string, workingOn: string) => {
    // Update terminal workingOn field
    setTerminals((prevTerminals) =>
      prevTerminals.map((t) =>
        t.id === terminalId ? { ...t, workingOn } : t
      )
    );

    // Persist to backend if Tauri is available
    if (tauriAvailable) {
      try {
        await invoke('update_terminal_working_on', {
          terminalId,
          workingOn,
        });
      } catch (error) {
        console.error('Failed to persist workingOn:', error);
      }
    }
  }, [tauriAvailable]);

  const handleDuplicateTerminal = useCallback(async (terminal: TerminalInfo) => {
    if (!tauriAvailable) {
      return;
    }

    try {
      // Generate new name: "Terminal Copy" or "Terminal Copy 2"
      const baseName = terminal.label;
      const copyPattern = /^(.+?)(?: Copy(?: (\d+))?)?$/;
      const match = baseName.match(copyPattern);

      let newName: string;
      if (match) {
        const originalName = match[1];
        const existingCopyNumber = match[2] ? parseInt(match[2], 10) : 0;

        if (existingCopyNumber > 0) {
          newName = `${originalName} Copy ${existingCopyNumber + 1}`;
        } else if (baseName.endsWith(' Copy')) {
          newName = `${originalName} Copy 2`;
        } else {
          newName = `${baseName} Copy`;
        }
      } else {
        newName = `${baseName} Copy`;
      }

      // Create new terminal with ALL characteristics from original (except workingOn)
      const created = await invoke<TerminalInfo>("create_terminal", {
        label: newName,
        color: terminal.color,
        cwd: terminal.cwd,
        avatar: terminal.avatar, // ✅ Copy avatar!
        branch: terminal.branch, // ✅ Copy branch!
        // Note: working_on is NOT copied - starts empty
      });

      const createdWithState: TerminalInfo = {
        ...created,
        status: "idle",
        needsAttention: false,
        hasResponded: false,
        responseStartTime: null,
      };

      setTerminals((prev) => [...prev, createdWithState]);
      setActiveId(created.id);

      // Add to active-agents.json index (file-based persistence)
      void addActiveAgent(terminal.cwd, created.id);

      // Try to copy personality from original agent
      try {
        const originalPersonality = await invoke<AgentPersonality>('load_agent_personality', {
          projectPath: terminal.cwd,
          personalityId: terminal.id,
        });

        // Save personality with new agent ID
        const newPersonality: AgentPersonality = {
          ...originalPersonality,
          id: created.id, // ← New agent ID
          name: newName, // ← New agent name
        };

        await invoke('save_agent_personality', {
          projectPath: terminal.cwd,
          personality: newPersonality,
        });

        // Inject personality into CLAUDE.md
        await invoke('inject_personality_to_claude_md', {
          projectPath: terminal.cwd,
          personality: newPersonality,
        });

        console.log(`✅ Copied personality for agent "${newName}"`);
      } catch (error) {
        // No personality found or copy failed - not critical
        console.log('No personality to copy or personality copy failed');
      }

      toast.success(`Agent duplicated: ${newName} 🦆`);
    } catch (error) {
      console.error("Failed to duplicate agent:", error);
      toast.error("Failed to duplicate agent");
    }
  }, [tauriAvailable]);

  const handleResetTerminal = useCallback(async (terminal: TerminalInfo) => {
    // 🦆 NEW APPROACH: Generate a completely NEW agent ID to ensure fresh SDK session
    // This is the cleanest way to avoid Claude SDK context compaction issues
    // The SDK associates sessions with agentId, so a new ID = completely fresh context

    const oldId = terminal.id;
    const newId = crypto.randomUUID();
    const sessionId = chatSessionIds.get(oldId);

    console.log(`🔄 [Reset Agent] Starting reset for "${terminal.label}"`);
    console.log(`  Old ID: ${oldId}`);
    console.log(`  New ID: ${newId}`);
    console.log(`  Old Session: ${sessionId || 'none'}`);

    // 1. Abort any active stream for the old agent
    if (sessionId) {
      try {
        const { abortSessionStream } = await import('./services/claudeSDK');
        abortSessionStream(sessionId);
        console.log(`✅ Aborted active stream for old session: ${sessionId}`);
      } catch (error) {
        console.warn('Failed to abort stream:', error);
      }
    }

    // 2. Clean up old session in backend (optional - the file can stay as history)
    if (sessionId && tauriAvailable) {
      try {
        await invoke('reset_agent_session', {
          agentId: oldId,
          sessionId
        });
        console.log(`✅ Backend cleanup complete for old agent ${oldId}`);
      } catch (error) {
        console.error('Failed to reset backend session:', error);
        // Continue anyway - old session file staying is not critical
      }
    }

    // 3. Update terminal with NEW ID while preserving all other properties
    setTerminals((prev) =>
      prev.map((t) =>
        t.id === oldId
          ? {
              ...t,
              id: newId,
              // Reset session-related fields to ensure fresh start
              sessionId: undefined,
            }
          : t
      )
    );

    // 4. Clear old state mappings (they used oldId as key)
    setChatSessions((prev) => {
      const newMap = new Map(prev);
      newMap.delete(oldId);
      // Don't set anything for newId - let it start fresh
      return newMap;
    });

    setChatSessionIds((prev) => {
      const newMap = new Map(prev);
      newMap.delete(oldId);
      // Don't set anything for newId - SDK will create new session on first message
      return newMap;
    });

    setChatTokensMap((prev) => {
      const newMap = new Map(prev);
      newMap.delete(oldId);
      // Don't set anything for newId - stamina starts at 100%
      return newMap;
    });

    // 5. Clean up usage sessions for old session
    if (sessionId) {
      setUsageSessions((prevSessions) =>
        prevSessions.filter(s => s.session_id !== sessionId)
      );
    }

    // 6. Update active terminal ID if this was the active one
    setActiveId((prevActiveId) =>
      prevActiveId === oldId ? newId : prevActiveId
    );

    // 7. Update agentChats to remove old ID and not carry over any state
    setAgentChats((prev) =>
      prev.filter((chat) => chat.id !== oldId)
      // Don't add newId - let it be created fresh on first interaction
    );

    // 7.5. Tasks are now independent from agents - no need to update activeTaskPerAgent
    // (activeTaskId is now a direct state, not tied to any agent)

    // 8. Update Kanban tasks that reference the old agent ID
    // This prevents "Agent terminal not found" errors when opening tasks after reset
    const kanbanState = useKanbanStore.getState();
    const tasks = kanbanState.getAllTasks();
    const affectedTasks = tasks.filter((t: KanbanTask) => t.assignedAgent?.id === oldId);

    for (const task of affectedTasks) {
      if (task.assignedAgent) {
        await kanbanState.updateTask(task.id, {
          assignedAgent: {
            ...task.assignedAgent,
            id: newId,
          }
        });
      }
    }

    if (affectedTasks.length > 0) {
      console.log(`🔄 [Reset Agent] Updated ${affectedTasks.length} Kanban task(s) to new agent ID`);
    }

    console.log(`✅ [Reset Agent] Complete! "${terminal.label}" now has fresh ID: ${newId}`);
    toast.success(`Agent reset: ${terminal.label} - Fresh context, stamina 100%! 🦆`);
  }, [chatSessionIds, tauriAvailable]);

  const handleReorderTerminals = useCallback((reorderedIds: string[]) => {
    setTerminals((prev) => {
      // Crea una mappa per accesso rapido
      const terminalMap = new Map(prev.map((t) => [t.id, t]));
      // Riordina secondo l'array di IDs
      return reorderedIds.map((id) => terminalMap.get(id)).filter(Boolean) as TerminalInfo[];
    });
  }, []);

  const handleOpenNewTerminalModal = useCallback((projectPath?: string) => {
    if (!tauriAvailable) {
      setExplorerError("Terminals available only via desktop app.");
      return;
    }

    setEditingTerminal(null);
    setNewTerminalError(null);
    const index = terminals.length;
    const defaultColor = TERMINAL_COLORS[index % TERMINAL_COLORS.length];
    setNewTerminalName(getRandomName()); // Random international agent name (140+ names)
    setNewTerminalColor(defaultColor);
    setNewTerminalWorkingOn(""); // Reset working on field
    setNewTerminalAvatar(""); // Reset to empty - will auto-select from randomized list
    setNewTerminalBranch(""); // 🔧 FIX: Reset branch to empty string - modal will load current branch
    setNewTerminalUseWorktree(false); // Reset worktree option
    setNewTerminalPersonality({ // Reset personality to default
      role: 'Feature Coordinator',
      intro: 'Experienced PM specializing in feature delivery and team coordination',
      communicationStyle: 'friendly',
      specialties: ['feature-planning', 'team-alignment'],
      personality: 'Organized. Proactive',
      skills: [],
      expressions: [],
    });

    // If projectPath is provided (from sidebar +), pre-select project and skip to agent step
    if (projectPath) {
      setNewTerminalPath(projectPath);
      setInitialModalStep('agent');
    } else {
      const fallbackPath = activeTerminal?.cwd ?? explorerPath ?? "";
      setNewTerminalPath(fallbackPath);
      setInitialModalStep('project');
    }
    setShowNewTerminalModal(true);
  }, [activeTerminal, explorerPath, tauriAvailable, terminals.length]);

  // Open New Terminal Modal with a specific project path (for Kanban integration)
  const handleOpenNewAgentForKanban = useCallback((projectPath: string) => {
    if (!tauriAvailable) {
      setExplorerError("Terminals available only via desktop app.");
      return;
    }

    // Reset to clean state
    setEditingTerminal(null);
    setNewTerminalError(null);
    const index = terminals.length;
    const defaultColor = TERMINAL_COLORS[index % TERMINAL_COLORS.length];
    setNewTerminalName(getRandomName());
    setNewTerminalColor(defaultColor);
    setNewTerminalWorkingOn("");
    setNewTerminalAvatar("");
    setNewTerminalBranch("");
    setNewTerminalUseWorktree(false);
    setNewTerminalPersonality({
      role: 'Feature Coordinator',
      intro: 'Experienced PM specializing in feature delivery and team coordination',
      communicationStyle: 'friendly',
      specialties: ['feature-planning', 'team-alignment'],
      personality: 'Organized. Proactive',
      skills: [],
      expressions: [],
    });

    // Set the project path from Kanban
    setNewTerminalPath(projectPath);
    setShowNewTerminalModal(true);
  }, [tauriAvailable, terminals.length]);

  const handleCancelNewTerminal = useCallback(() => {
    if (creatingTerminal) {
      return;
    }
    setShowNewTerminalModal(false);
    setNewTerminalError(null);
    setSelectingDirectory(false);
    setEditingTerminal(null);
  }, [creatingTerminal]);

  // Handle installing starter agent bundles from onboarding
  const handleInstallStarterBundles = useCallback(async (
    bundles: Array<{ resource: import('./types').MarketplaceResource; template: import('./types').AgentTemplate }>,
    projectPath: string,
    projectName: string
  ) => {
    const createdAgents: UnifiedAgent[] = [];
    const usedNames = new Set<string>();
    for (const bundle of bundles) {
      try {
        const agent = await installAgentBundle(bundle.resource, projectPath, projectName, usedNames);
        createdAgents.push(agent);
        usedNames.add(agent.name);
        console.log(`[Onboarding] Installed starter bundle: ${bundle.template.suggestedName} → ${agent.name}`);
      } catch (err) {
        console.error(`[Onboarding] Failed to install bundle ${bundle.template.suggestedName}:`, err);
      }
    }

    // Create Tauri terminals for each newly created agent and add to sidebar
    const newTerminals: TerminalInfo[] = [];
    for (const agent of createdAgents) {
      try {
        const terminal = await invoke<TerminalInfo>("create_terminal", {
          id: agent.id,
          label: agent.name,
          color: agent.color,
          cwd: agent.projectPath,
        });
        newTerminals.push({
          ...terminal,
          status: "idle" as const,
          needsAttention: false,
          hasResponded: false,
          responseStartTime: null,
          avatar: agent.avatar,
          personality: agent.personality,
        });

        // Save personality file and inject into CLAUDE.md
        if (agent.personality) {
          const fullPersonality: AgentPersonality = {
            id: agent.id,
            name: agent.name,
            role: agent.personality.role || '',
            communicationStyle: agent.personality.communicationStyle || 'professional',
            customNotes: agent.personality.customNotes,
            selectedRules: agent.personality.selectedRules,
            selectedSkills: agent.personality.selectedSkills,
            intro: '',
            personality: '',
            quirks: '',
            specialties: [],
            skills: [],
            expressions: [],
          };
          try {
            await invoke('save_agent_personality', {
              projectPath: agent.projectPath,
              personality: fullPersonality,
            });
            await invoke('inject_personality_to_claude_md', {
              projectPath: agent.projectPath,
              personality: fullPersonality,
            });
            console.log(`[Onboarding] Injected personality for "${agent.name}" into CLAUDE.md`);
          } catch (personalityErr) {
            console.warn(`[Onboarding] Failed to inject personality for ${agent.name}:`, personalityErr);
          }
        }
      } catch (err) {
        console.error(`[Onboarding] Failed to create terminal for ${agent.name}:`, err);
      }
    }

    if (newTerminals.length > 0) {
      setTerminals(prev => [...prev, ...newTerminals]);
      // Select the first created agent
      setActiveId(newTerminals[0].id);
      setHasSavedAgents(true);
      // Add project to persisted projects
      setPersistedProjects(prev => {
        const next = new Map(prev);
        next.set(projectPath, projectName);
        return next;
      });
      // Add all new agents to active-agents.json index
      for (const terminal of newTerminals) {
        void addActiveAgent(projectPath, terminal.id);
      }
    }
  }, [installAgentBundle]);

  const handleSelectDirectory = useCallback(async () => {
    if (selectingDirectory || !tauriAvailable) {
      return;
    }

    setNewTerminalError(null);
    setSelectingDirectory(true);
    try {
      const selected = (await openDialog({
        directory: true,
        multiple: false,
        defaultPath: newTerminalPath || explorerPath || undefined,
        title: "Select working directory",
      })) as string | string[] | null;

      if (typeof selected === "string") {
        setNewTerminalPath(selected);
      } else if (
        Array.isArray(selected) &&
        selected.length > 0 &&
        typeof selected[0] === "string"
      ) {
        setNewTerminalPath(selected[0]);
      }
    } catch (error) {
      console.error("Unable to select directory", error);
      setNewTerminalError("Unable to select directory. Please try again.");
    } finally {
      setSelectingDirectory(false);
    }
  }, [explorerPath, newTerminalPath, selectingDirectory, tauriAvailable]);

  const handleConfirmNewTerminal = useCallback(async (agentData?: SavedAgent) => {
    if (!tauriAvailable || creatingTerminal) {
      return;
    }

    // Use agent data if provided (from "Use" button), otherwise use state
    const trimmedName = agentData?.name || newTerminalName.trim();
    const trimmedPath = newTerminalPath.trim(); // Path always from state (project context)
    const trimmedWorkingOn = agentData?.workingOn?.trim() || newTerminalWorkingOn.trim();
    const agentColor = agentData?.color || newTerminalColor;
    const agentAvatar = agentData?.avatar || newTerminalAvatar;
    const agentPersonality = agentData?.personality || newTerminalPersonality;

    if (!trimmedName) {
      setNewTerminalError("Enter a terminal name.");
      return;
    }

    if (!trimmedPath) {
      setNewTerminalError("Select working directory.");
      return;
    }

    // Validate word count for "Working on" (max 20 words)
    if (trimmedWorkingOn) {
      const wordCount = trimmedWorkingOn.split(/\s+/).length;
      if (wordCount > 20) {
        setNewTerminalError('Working on must be 20 words or less');
        return;
      }
    }

    setCreatingTerminal(true);
    setNewTerminalError(null);

    try {
      // CRITICAL FIX: Verify terminal exists in BOTH React state AND Rust backend registry
      // This prevents "Terminale non trovato" error when:
      // 1. Terminal was closed but React state wasn't updated
      // 2. User is editing a SavedAgent (not an active terminal)
      // 3. Backend crashed/restarted but frontend still has stale state
      const terminalInReactState = editingTerminal &&
        terminals.some(t => t.id === editingTerminal.id);

      // Check if terminal exists in Rust backend registry
      let terminalInBackend = false;
      if (editingTerminal && terminalInReactState) {
        try {
          terminalInBackend = await invoke<boolean>("terminal_exists", { id: editingTerminal.id });
        } catch (err) {
          console.warn(`[handleConfirmNewTerminal] Failed to check terminal existence in backend:`, err);
          terminalInBackend = false;
        }
      }

      const terminalStillExists = terminalInReactState && terminalInBackend;

      // Log for debugging
      if (editingTerminal && !terminalStillExists) {
        console.warn(`[handleConfirmNewTerminal] Terminal ${editingTerminal.id} not found. React state: ${terminalInReactState}, Backend: ${terminalInBackend}. Creating new terminal instead.`);
      }

      if (editingTerminal && terminalStillExists) {
        // CRITICAL FIX: Update terminal with timeout to prevent freeze
        await invokeWithTimeout("update_terminal", {
          id: editingTerminal.id,
          label: trimmedName,
          color: agentColor,
          cwd: trimmedPath,
          workingOn: trimmedWorkingOn || null,
          avatar: agentAvatar,
          branch: newTerminalBranch || null,
        }, 3000); // 3 second timeout

        // Update state immediately (optimistic update)
        setTerminals((prev) =>
          prev.map((t) =>
            t.id === editingTerminal.id
              ? {
                  ...t,
                  label: trimmedName,
                  color: agentColor,
                  cwd: trimmedPath,
                  workingOn: trimmedWorkingOn || undefined,
                  avatar: agentAvatar,
                  branch: newTerminalBranch || undefined,
                  personality: agentPersonality, // Update personality in state
                }
              : t
          )
        );

        // CRITICAL FIX: Save personality in background (non-blocking)
        // This prevents UI freeze if CLAUDE.md is large or filesystem is slow
        if (agentPersonality && Object.keys(agentPersonality).length > 0) {
          const fullPersonality: AgentPersonality = {
            id: editingTerminal.id,
            name: trimmedName,
            role: agentPersonality.role || '',
            technicalContext: agentPersonality.technicalContext || undefined,
            rules: agentPersonality.rules || undefined,
            communicationStyle: agentPersonality.communicationStyle || 'friendly',
            customNotes: agentPersonality.customNotes || undefined,
            // Claude Code rules (new simplified flow)
            selectedRules: agentPersonality.selectedRules || undefined,
            // Selected skills (for proactive use)
            selectedSkills: agentPersonality.selectedSkills || undefined,
            // Toolkit (skills, droids, commands for quick-access)
            toolkit: agentPersonality.toolkit || undefined,
            // Legacy fields (kept for backwards compatibility)
            intro: agentPersonality.intro || '',
            personality: agentPersonality.personality || '',
            quirks: agentPersonality.quirks || '',
            specialties: agentPersonality.specialties || [],
            skills: agentPersonality.skills || [],
            expressions: agentPersonality.expressions || [],
          };

          // Fire and forget - don't block UI
          fireAndForget('save_agent_personality', {
            projectPath: trimmedPath,
            personality: fullPersonality,
          }, (error) => {
            console.error('Failed to save personality:', error);
            toast.warning('Personality save failed but terminal updated successfully');
          });

          // Inject into CLAUDE.md also in background
          fireAndForget('inject_personality_to_claude_md', {
            projectPath: trimmedPath,
            personality: fullPersonality,
          }, (error) => {
            console.error('Failed to inject personality to CLAUDE.md:', error);
          });

          console.log(`✅ Updated personality for agent "${trimmedName}" (saving in background)`);
        }

        // Force context panel refresh when agent is edited
        setAgentRefreshKey((prev) => prev + 1);

        // If cwd changed and this is active terminal, reload directory
        if (
          trimmedPath !== editingTerminal.cwd &&
          editingTerminal.id === activeId
        ) {
          await loadDirectory(trimmedPath);
        }

        // Close modal immediately - don't wait for personality save
        setShowNewTerminalModal(false);
        setEditingTerminal(null);
      } else {
        // Create new terminal - SIMPLE! No AgentChat logic
        console.log('🔍 DEBUG: Creating terminal with avatar:', newTerminalAvatar);
        console.log('🔍 DEBUG: newTerminalBranch:', JSON.stringify(newTerminalBranch), 'type:', typeof newTerminalBranch, 'length:', newTerminalBranch?.length);
        console.log('🔍 DEBUG: newTerminalUseWorktree:', newTerminalUseWorktree);

        // Handle Git branch creation and worktree if specified
        let worktreePath: string | undefined;
        if (newTerminalBranch && newTerminalBranch.trim()) {
          try {
            // Check if branch exists
            const branches = await invoke<Array<{name: string, isCurrent: boolean, hasRemote: boolean}>>('git_list_branches', {
              rootPath: trimmedPath
            });
            console.log('🔍 DEBUG: Available branches:', branches.map(b => `${b.name}${b.isCurrent ? ' (current)' : ''}`).join(', '));

            const branchExists = branches.some(b => b.name === newTerminalBranch);
            console.log('🔍 DEBUG: Branch exists?', branchExists, 'Branch name:', newTerminalBranch);

            // 🔧 CRITICAL FIX: If branch is "main" and doesn't exist, skip Git operations
            // This happens when the modal default wasn't properly overridden
            if (newTerminalBranch === 'main' && !branchExists) {
              console.warn('⚠️ SKIPPING: Branch "main" does not exist in repository. Using current branch instead.');
              // Don't try to create or switch - just use current branch
            } else if (newTerminalUseWorktree && !branchExists) {
              // Create worktree for new branch
              console.log(`Creating worktree for new branch: ${newTerminalBranch}`);

              // Calculate worktree path: /path/to/repo-branchname
              const repoName = extractProjectId(trimmedPath) || 'repo';
              const sanitizedBranch = newTerminalBranch.replace(/\//g, '-');
              // Get parent directory using cross-platform path separator
              const pathSegments = trimmedPath.replace(/[/\\]+$/, '').split(/[/\\]/);
              const parentDir = pathSegments.slice(0, -1).join('/');
              worktreePath = `${parentDir}/${repoName}-${sanitizedBranch}`;

              await invoke('git_add_worktree', {
                path: worktreePath,
                branchName: newTerminalBranch,
                createBranch: true,
                rootPath: trimmedPath
              });

              console.log(`✅ Worktree created at: ${worktreePath}`);
            } else if (!branchExists) {
              // Create new branch from current (no worktree)
              console.log(`Creating new branch: ${newTerminalBranch}`);
              await invoke('git_create_branch', {
                branchName: newTerminalBranch,
                fromBranch: null, // Will branch from current
                switch: true, // Automatically switch to new branch
                rootPath: trimmedPath
              });
            } else {
              // Branch exists - check if we need to switch to it
              const currentBranch = branches.find(b => b.isCurrent);
              if (currentBranch && currentBranch.name === newTerminalBranch) {
                // Already on the target branch, no need to switch
                console.log(`Already on branch: ${newTerminalBranch}, skipping switch`);
              } else {
                // Switch to the existing branch
                console.log(`Switching to existing branch: ${newTerminalBranch}`);
                await invoke('git_switch_branch', {
                  branchName: newTerminalBranch,
                  rootPath: trimmedPath
                });
              }
            }
          } catch (err) {
            console.warn('Git branch/worktree operation failed:', err);
            setNewTerminalError(`Failed to create branch/worktree: ${err}`);
            return;
          }
        }

        // Use worktree path if it was created, otherwise use trimmedPath
        const effectivePath = worktreePath || trimmedPath;

        const created = await invoke<TerminalInfo>("create_terminal", {
          label: trimmedName,
          color: agentColor,
          cwd: effectivePath,
          workingOn: trimmedWorkingOn || null,
          avatar: agentAvatar,
          branch: newTerminalBranch || null,
        });

        const createdWithState: TerminalInfo = {
          ...created,
          status: "idle",
          needsAttention: false,
          hasResponded: false,
          responseStartTime: null,
          workingOn: trimmedWorkingOn || undefined,
          avatar: agentAvatar,
          branch: newTerminalBranch || undefined,
          useWorktree: newTerminalUseWorktree && !!worktreePath,
          worktreePath: worktreePath,
          personality: agentPersonality, // Store personality in state
        };

        // Save metadata for Telegram notifications immediately
        agentMetadataRef.current.set(createdWithState.id, {
          name: trimmedName,
          cwd: effectivePath,
        });

        setTerminals((prev) => [...prev, createdWithState]);
        setActiveId(createdWithState.id);
        // Show agent overview (not a stale session) for the new agent
        setActiveSessionId(null);
        setActiveTaskId(null);
        setActiveTabId('chat');
        clearTerminalAttention(createdWithState.id);

        // Add to active-agents.json index (file-based persistence)
        void addActiveAgent(effectivePath, createdWithState.id);

        // Persist project in sidebar
        const projectPath = effectivePath;
        const projectName = extractProjectId(projectPath) || 'Unknown';
        setPersistedProjects(prev => {
          if (prev.has(projectPath)) return prev;
          const next = new Map(prev);
          next.set(projectPath, projectName);
          return next;
        });

        // Save agent personality if configured
        if (agentPersonality && Object.keys(agentPersonality).length > 0) {
          try {
            const fullPersonality: AgentPersonality = {
              id: createdWithState.id,
              name: trimmedName,
              role: agentPersonality.role || '',
              technicalContext: agentPersonality.technicalContext || undefined,
              rules: agentPersonality.rules || undefined,
              communicationStyle: agentPersonality.communicationStyle || 'friendly',
              customNotes: agentPersonality.customNotes || undefined,
              // Claude Code rules (new simplified flow)
              selectedRules: agentPersonality.selectedRules || undefined,
              // Selected skills (for proactive use)
              selectedSkills: agentPersonality.selectedSkills || undefined,
              // Legacy fields (kept for backwards compatibility)
              intro: agentPersonality.intro || '',
              personality: agentPersonality.personality || '',
              quirks: agentPersonality.quirks || '',
              specialties: agentPersonality.specialties || [],
              skills: agentPersonality.skills || [],
              expressions: agentPersonality.expressions || [],
            };

            // DEBUG: Log what we're sending to Rust
            console.log('🔍 [FRONTEND] About to save personality:');
            console.log('🔍 [FRONTEND] Name:', fullPersonality.name);
            console.log('🔍 [FRONTEND] Role:', fullPersonality.role);
            console.log('🔍 [FRONTEND] Skills:', JSON.stringify(fullPersonality.skills));
            console.log('🔍 [FRONTEND] SelectedRules:', JSON.stringify(fullPersonality.selectedRules));
            console.log('🔍 [FRONTEND] CustomNotes:', fullPersonality.customNotes);

            await invoke('save_agent_personality', {
              projectPath: effectivePath,
              personality: fullPersonality,
            });

            // Inject personality into CLAUDE.md
            await invoke('inject_personality_to_claude_md', {
              projectPath: effectivePath,
              personality: fullPersonality,
            });

            console.log(`✅ Saved personality for agent "${trimmedName}"`);
          } catch (error) {
            console.error('Failed to save personality:', error);
            // Don't block terminal creation if personality save fails
          }
        }

        setShowNewTerminalModal(false);
        await loadDirectory(createdWithState.cwd);

        console.log(`Created terminal "${trimmedName}" with cwd="${trimmedPath}"`);
      }
    } catch (error) {
      console.error("Unable to save terminal", error);
      const message = error instanceof Error ? error.message : String(error);

      // CRITICAL FIX: Better error messages for timeout errors
      if (message.includes('timeout') || message.includes('timed out')) {
        setNewTerminalError('Operation timed out. Please try again or check your filesystem.');
        toast.error('Save operation timed out', {
          description: 'The filesystem might be slow. Your changes may not have been saved.',
          duration: 5000,
        });
      } else {
        setNewTerminalError(message);
      }
    } finally {
      // CRITICAL: Always reset this flag to prevent permanent UI freeze
      setCreatingTerminal(false);
    }
  }, [
    activeId,
    clearTerminalAttention,
    creatingTerminal,
    editingTerminal,
    loadDirectory,
    newTerminalColor,
    newTerminalName,
    newTerminalPath,
    newTerminalWorkingOn,
    newTerminalAvatar,
    newTerminalPersonality,
    newTerminalBranch,      // FIX: Add branch to dependencies
    newTerminalUseWorktree, // FIX: Add useWorktree to dependencies
    tauriAvailable,
    terminals,              // FIX: Add terminals to verify existence before update
  ]);

  // Quick create terminal - no modal, instant like VSCode (Phase 3 - AgentChat integration)
  const handleQuickCreateTerminal = useCallback(async () => {
    if (!tauriAvailable || creatingTerminal) {
      return;
    }

    // Require an active terminal to know which cwd to use
    const activeTerminal = terminals.find((t) => t.id === activeId);
    if (!activeTerminal) {
      // No active terminal - open modal to create first one
      handleOpenNewTerminalModal();
      return;
    }

    setCreatingTerminal(true);

    try {
      // Generate automatic name "Terminal N"
      const terminalNumbers = terminals
        .map((t) => {
          const match = t.label.match(/^Terminal (\d+)$/);
          return match ? parseInt(match[1], 10) : 0;
        })
        .filter((n) => n > 0);
      const nextNumber = terminalNumbers.length > 0 ? Math.max(...terminalNumbers) + 1 : terminals.length + 1;
      const autoName = `Terminal ${nextNumber}`;

      // Pick random color from TERMINAL_COLORS array
      const randomColor = TERMINAL_COLORS[Math.floor(Math.random() * TERMINAL_COLORS.length)];

      // SIMPLE: Use active terminal's CWD (same root of work)
      const cwd = activeTerminal.cwd;

      // Create terminal immediately
      const created = await invoke<TerminalInfo>("create_terminal", {
        label: autoName,
        color: randomColor,
        cwd,
      });

      const createdWithState: TerminalInfo = {
        ...created,
        status: "idle",
        needsAttention: false,
        hasResponded: false,
        responseStartTime: null,
      };

      // Save metadata for Telegram notifications immediately
      agentMetadataRef.current.set(createdWithState.id, {
        name: autoName,
        cwd: cwd,
      });

      console.log(`[QuickCreate] Created terminal "${autoName}" with cwd="${cwd}"`);

      setTerminals((prev) => [...prev, createdWithState]);
      setActiveId(createdWithState.id);
      clearTerminalAttention(createdWithState.id);

      // Add to active-agents.json index (file-based persistence)
      void addActiveAgent(cwd, createdWithState.id);

      // Load directory
      await loadDirectory(createdWithState.cwd);

      console.log(`Quick-created terminal "${autoName}"`);
    } catch (error) {
      console.error("Unable to quick create terminal", error);
      toast.error("Failed to create terminal");
    } finally {
      setCreatingTerminal(false);
    }
  }, [
    tauriAvailable,
    creatingTerminal,
    terminals,
    activeId,
    handleOpenNewTerminalModal,
    clearTerminalAttention,
    loadDirectory,
  ]);

  // 💰 License and upgrade handlers
  const handleShowUpgrade = useCallback((limitType: typeof upgradeLimitType = 'terminals') => {
    setUpgradeLimitType(limitType);
    setShowUpgradeModal(true);
  }, []);

  const handleActivateLicense = useCallback(() => {
    setShowUpgradeModal(false);
    setShowLicenseModal(true);
  }, []);

  const handleLicenseSuccess = useCallback(() => {
    setIsProUser(true);
    toast.success('License activated! Thank you for supporting Quack!', {
      duration: 5000,
    });
  }, []);

  const handleSelectTerminal = useCallback(
    async (id: string) => {
      if (!tauriAvailable) {
        return;
      }
      setActiveId(id);
      clearTerminalAttention(id);
      clearIdleTimer(id);

      // 🦆 FIX AGENT OVERVIEW: When clicking on agent card, NEVER auto-select a session
      // The user should see the "agent overview" (SessionEmptyState) with:
      // - List of past sessions
      // - Button to create new session
      // Session auto-selection should ONLY happen when clicking directly on a session item
      setActiveTaskId(null);
      setActiveSessionId(null);
      console.log(`[handleSelectTerminal] Agent clicked: ${id} - showing agent overview (SessionEmptyState)`);

      // Always open the chat tab when selecting a terminal from sidebar
      // This ensures consistent behavior - first tab is always the agent chat
      setActiveTabId('chat');
      const terminal = terminals.find((candidate) => candidate.id === id);
      if (terminal) {
        await loadDirectory(terminal.cwd);

        // Switch to terminal's branch if specified
        if (terminal.branch) {
          try {
            console.log(`Switching to branch: ${terminal.branch} for terminal ${terminal.label}`);
            await invoke('git_switch_branch', {
              branchName: terminal.branch,
              rootPath: terminal.cwd
            });
          } catch (err) {
            console.warn(`Failed to switch to branch ${terminal.branch}:`, err);
            // Don't block terminal selection if branch switch fails
          }
        }

        // Load and inject personality into CLAUDE.md
        try {
          console.log(`🔍 Loading personality for "${terminal.label}" (ID: ${terminal.id}) from ${terminal.cwd}`);
          const personality = await invoke<AgentPersonality>('load_agent_personality', {
            projectPath: terminal.cwd,
            personalityId: terminal.id,
          });

          console.log(`🔍 Loaded personality:`, {
            id: personality.id,
            name: personality.name,
            role: personality.role,
            technicalContext: personality.technicalContext?.substring(0, 50) + '...',
            customNotes: personality.customNotes?.substring(0, 50) + '...',
          });

          // Inject into CLAUDE.md
          await invoke('inject_personality_to_claude_md', {
            projectPath: terminal.cwd,
            personality,
          });

          console.log(`✅ Injected personality for "${terminal.label}" into CLAUDE.md`);
        } catch (error) {
          // No personality found or injection failed - not critical
          console.error(`❌ Failed to inject personality for "${terminal.label}":`, error);
          console.log(`No personality to inject for "${terminal.label}"`);
        }
      }
    },
    [
      agentSessions,
      clearIdleTimer,
      clearTerminalAttention,
      loadDirectory,
      tauriAvailable,
      terminals,
      setActiveSessionIdExclusive,
    ]
  );

  const handleCloseTerminal = useCallback(
    async (id: string) => {
      if (!tauriAvailable) {
        return;
      }
      clearIdleTimer(id);
      clearNotificationTimer(id);

      // Anti-flickering: cleanup visual idle timer
      const visualTimer = visualIdleTimersRef.current.get(id);
      if (visualTimer) {
        clearTimeout(visualTimer);
        visualIdleTimersRef.current.delete(id);
      }

      // Get the terminal's project path before closing
      const closingTerminal = terminals.find(t => t.id === id);
      const projectPath = closingTerminal?.cwd;

      try {
        await invoke("close_terminal", { id });
      } catch (error) {
        console.error("Unable to close terminal", error);
      }

      // Remove from active-agents.json index
      if (projectPath) {
        void removeActiveAgent(projectPath, id);
      }

      let nextActive: string | null = activeId;
      let nextPath: string | null = null;

      setTerminals((prev) => {
        const updated = prev.filter((terminal) => terminal.id !== id);
        if (updated.length === prev.length) {
          return prev;
        }

        if (activeId === id) {
          const fallback = updated[updated.length - 1];
          nextActive = fallback ? fallback.id : null;
          nextPath = fallback ? fallback.cwd : null;
        }

        return updated;
      });

      setActiveId(nextActive);
      if (nextActive) {
        clearTerminalAttention(nextActive);
        clearIdleTimer(nextActive);
      }
      if (nextPath) {
        void loadDirectory(nextPath);
      }
    },
    [
      activeId,
      clearIdleTimer,
      clearNotificationTimer,
      clearTerminalAttention,
      loadDirectory,
      tauriAvailable,
      terminals,
    ]
  );


  // Remove project: close all agents for this project path
  const handleRemoveProject = useCallback(
    async (projectPath: string) => {
      if (!tauriAvailable) return;

      // Find all terminals for this project
      const projectTerminals = terminals.filter(t => t.cwd === projectPath);

      // Close each terminal via Tauri and clean up
      for (const terminal of projectTerminals) {
        clearIdleTimer(terminal.id);
        clearNotificationTimer(terminal.id);
        const visualTimer = visualIdleTimersRef.current.get(terminal.id);
        if (visualTimer) {
          clearTimeout(visualTimer);
          visualIdleTimersRef.current.delete(terminal.id);
        }
        try {
          await invoke("close_terminal", { id: terminal.id });
        } catch (error) {
          console.error("Unable to close terminal", terminal.id, error);
        }
        // Delete agent from storage
        try {
          await deleteAgent(terminal.id);
        } catch {
          // Agent may not exist in storage
        }
      }

      // Remove from persisted projects
      setPersistedProjects(prev => {
        const next = new Map(prev);
        next.delete(projectPath);
        return next;
      });

      // Update state: remove all terminals for this project
      setTerminals(prev => {
        const updated = prev.filter(t => t.cwd !== projectPath);
        if (activeId && projectTerminals.some(t => t.id === activeId)) {
          const fallback = updated[updated.length - 1];
          setActiveId(fallback ? fallback.id : null);
        }
        return updated;
      });
    },
    [activeId, clearIdleTimer, clearNotificationTimer, terminals, tauriAvailable]
  );

  // ============================================
  // AgentChat Management Handlers (Phase 1)
  // ============================================

  // NO AgentChat handlers needed - terminals are independent!

  // Handler to open terminal window with projects from agents
  const handleCreateAgentTerminal = useCallback(() => {
    // NEW BEHAVIOR: Open separate Tauri window for terminals
    // Pass projects derived from terminals (activeProjects)
    const projects = activeProjects.map(project => ({
      path: project.path,
      name: project.name,
    }));
    openTerminalWindow(projects);
  }, [activeProjects, openTerminalWindow]);

  // Sync terminal window projects when activeProjects change
  // updateTerminalWindowProjects now handles the window lookup internally
  useEffect(() => {
    const projects = activeProjects.map(project => ({
      path: project.path,
      name: project.name,
    }));
    // Only update if there are projects (don't clear the list with empty array)
    if (projects.length > 0) {
      updateTerminalWindowProjects(projects);
    }
  }, [activeProjects, updateTerminalWindowProjects]);

  // Listen for sync request from terminal window (manual sync button)
  useEffect(() => {
    const unlistenPromise = listen('terminal-window-request-sync', () => {
      console.log('[App] Received sync request from terminal window');
      const projects = activeProjects.map(project => ({
        path: project.path,
        name: project.name,
      }));
      updateTerminalWindowProjects(projects);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(() => undefined);
    };
  }, [activeProjects, updateTerminalWindowProjects]);

  const handleColorChange = useCallback(
    async (id: string, color: string) => {
      if (!tauriAvailable) {
        return;
      }
      try {
        const updated = await invoke<TerminalInfo>("set_terminal_color", {
          id,
          color,
        });
        setTerminals((prev) =>
          prev.map((terminal) =>
            terminal.id === id ? { ...terminal, ...updated } : terminal
          )
        );
      } catch (error) {
        console.error("Unable to update color", error);
      }
    },
    [tauriAvailable]
  );

  // Centralized helper: try to open file in preferred IDE with toast notification
  // Returns true if opened in IDE, false if no IDE set (caller should fallback)
  // Brain: pattern-code-editor-tab
  // Respects fileOpenTarget setting: only opens in IDE when user prefers 'external'
  const tryOpenInIDE = useCallback(async (filePath: string, line?: number): Promise<boolean> => {
    const { preferredIDE, fileOpenTarget, openFileInIDE } = useIDEStore.getState();
    if (!preferredIDE || fileOpenTarget !== 'external') return false;

    try {
      toast('Opening in your IDE...', { duration: 2000 });
      await openFileInIDE(filePath, line);
      return true;
    } catch (err) {
      console.error('[App] Failed to open file in IDE:', err);
      toast.error('Failed to open in IDE');
      return false;
    }
  }, []);

  const handleOpenFilePreview = useCallback(
    async (entry: DirectoryEntry, lineChanges?: LineChange[]) => {
      if (!tauriAvailable || entry.is_dir) {
        return;
      }

      // Brain: pattern-code-editor-tab
      // Check user preference: internal editor tab or external IDE
      if (!lineChanges) {
        // Detect image files — open in ImageTabView instead of CodeEditor
        const imageExtensions = /\.(jpe?g|png|gif|webp|svg|ico|bmp|tiff?)$/i;
        if (imageExtensions.test(entry.name)) {
          const imgTabId = `image-${entry.path}`;
          const existingImgTab = tabs.find(t => t.id === imgTabId);
          if (existingImgTab) {
            setActiveTabId(imgTabId);
            return;
          }
          const ext = entry.name.split('.').pop()?.toLowerCase() || '';
          const mimeMap: Record<string, string> = {
            jpg: 'image/jpeg', jpeg: 'image/jpeg',
            png: 'image/png', gif: 'image/gif',
            webp: 'image/webp', svg: 'image/svg+xml',
            ico: 'image/x-icon', bmp: 'image/bmp',
            tif: 'image/tiff', tiff: 'image/tiff',
          };
          try {
            // Read file as binary bytes via Tauri, then convert to base64
            const bytes = await invoke<number[]>('read_binary_file', { path: entry.path });
            const uint8 = new Uint8Array(bytes);
            // Convert to base64 in chunks to avoid call stack overflow on large files
            let binary = '';
            const chunkSize = 8192;
            for (let i = 0; i < uint8.length; i += chunkSize) {
              binary += String.fromCharCode(...uint8.slice(i, i + chunkSize));
            }
            const base64Data = btoa(binary);
            const imgTab: Tab = {
              id: imgTabId,
              label: entry.name,
              type: 'image',
              closable: true,
              filePath: entry.path,
              imageData: base64Data,
              mediaType: mimeMap[ext] || 'image/png',
            };
            setTabs(prev => [...prev, imgTab]);
            setActiveTabId(imgTabId);
          } catch (err) {
            console.error('[FileExplorer] Failed to read image:', err);
          }
          return;
        }

        const { fileOpenTarget } = useIDEStore.getState();
        if (fileOpenTarget === 'external') {
          const opened = await tryOpenInIDE(entry.path);
          if (opened) return;
        }
        // Default: open in internal editor tab
        const { useEditorStore } = await import('./stores/editorStore');
        useEditorStore.getState().openFile(entry.path);
        handleOpenCodeEditorTab(entry.path);
        return;
      }

      // Check if file is modified by AI and has lineChanges
      // If lineChanges not provided, check fileEditsMap
      let finalLineChanges = lineChanges;
      if (!finalLineChanges) {
        const fileEdit = fileEditsMap.get(entry.path);
        if (fileEdit && fileEdit.lineChanges && fileEdit.lineChanges.length > 0) {
          finalLineChanges = fileEdit.lineChanges;
          console.log('[handleOpenFilePreview] Auto-loaded lineChanges for modified file:', entry.path, finalLineChanges.length, 'changes');
        }
      }

      // Create or activate tab for this file
      const fileTabId = `file-${entry.path}`;
      const newFileTab = {
        id: fileTabId,
        label: entry.name,
        type: 'file' as const,
        closable: true,
        filePath: entry.path,
      };

      setTabs((prevTabs) => {
        const existingTab = prevTabs.find(t => t.id === fileTabId);
        if (!existingTab) {
          return [...prevTabs, newFileTab];
        }
        return prevTabs;
      });

      // Also save to tabsByTerminal for the active terminal
      if (activeId) {
        setTabsByTerminal((prev) => {
          const updated = new Map(prev);
          const terminalTabs = updated.get(activeId) || [];
          const existingTab = terminalTabs.find(t => t.id === fileTabId);

          if (!existingTab) {
            updated.set(activeId, [...terminalTabs, newFileTab]);
            console.log('[handleOpenFilePreview] Saved tab for terminal:', activeId, entry.name);
          }

          return updated;
        });
      }

      setActiveTabId(fileTabId);

      // Load file content
      setPreviewFile({ name: entry.name, path: entry.path });
      setPreviewContent("");
      setPreviewImageData(null);
      setPreviewError(null);
      setPreviewDiffInfo(null);
      setPreviewLineChanges(finalLineChanges || null);
      setLoadingPreview(true);

      try {
        // Check if file is an image
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
        const isImage = imageExtensions.some(ext => entry.name.toLowerCase().endsWith(ext));

        if (isImage) {
          // Load image as base64
          const base64Data = await invoke<string>("read_file_preview", {
            path: entry.path,
          });

          // Detect MIME type from extension
          const ext = entry.name.toLowerCase().split('.').pop() || 'png';
          const mimeTypes: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'bmp': 'image/bmp',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'ico': 'image/x-icon',
            'tiff': 'image/tiff',
            'tif': 'image/tiff',
          };
          const mimeType = mimeTypes[ext] || 'image/png';

          setPreviewImageData(`data:${mimeType};base64,${base64Data}`);
        } else {
          // Load file content for non-image files
          const content = await invoke<string>("read_file_content", {
            path: entry.path,
          });
          setPreviewContent(content);
        }

        // If file is modified, also load the diff
        const isModified = gitSummary?.entries?.some((gitEntry) => {
          const fullPath = explorerRoot
            ? `${explorerRoot}/${gitEntry.path}`.replace(/\/+/g, "/")
            : gitEntry.path;
          return fullPath === entry.path;
        });

        if (isModified && gitSummary && explorerRoot) {
          try {
            // Calculate path relative to git root
            let relativePath = entry.path;
            if (entry.path.startsWith(explorerRoot)) {
              relativePath = entry.path.substring(explorerRoot.length);
              if (relativePath.startsWith("/")) {
                relativePath = relativePath.substring(1);
              }
            }

            const diff = await invoke<string>("git_diff", {
              path: relativePath,
              staged: false,
              untracked: false,
              rootPath: explorerRoot,
            });

            const diffInfo = parseDiff(diff);
            setPreviewDiffInfo(diffInfo);

            // 🔧 FIX: If no lineChanges provided from AI, convert diffInfo to LineChange[] format
            // This ensures decorations are shown when clicking "View Modified Files" from chat
            if (!lineChanges || lineChanges.length === 0) {
              const convertedLineChanges: LineChange[] = [
                ...diffInfo.additions.map(line => ({ line, type: 'added' as const })),
                ...diffInfo.modifications.map(line => ({ line, type: 'modified' as const })),
                ...diffInfo.deletions.map(line => ({ line, type: 'removed' as const })),
              ];
              setPreviewLineChanges(convertedLineChanges);
              console.log('[handleOpenFilePreview] Converted diffInfo to lineChanges:', convertedLineChanges.length, 'changes');
            }
          } catch (diffError) {
            console.warn("Unable to load diff:", diffError);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error('Error loading file:', message);
        setPreviewError(message);
      } finally {
        setLoadingPreview(false);
      }
    },
    [tauriAvailable, gitSummary, explorerRoot, activeId, fileEditsMap, tabs]
  );

  const handleFilePathClick = useCallback(async (path: string, lineChanges?: LineChange[]) => {
    // Parse optional :line suffix (e.g. "src/App.tsx:42")
    let filePath = path;
    let line: number | undefined;
    const lineMatch = path.match(/^(.+):(\d+)$/);
    if (lineMatch) {
      filePath = lineMatch[1];
      line = parseInt(lineMatch[2], 10);
    }

    // Try opening in external IDE (skip for files with lineChanges - need internal diff view)
    if (!lineChanges) {
      const opened = await tryOpenInIDE(filePath, line);
      if (opened) return;
    }

    // Brain: pattern-code-editor-tab — respect fileOpenTarget for internal editor
    const { fileOpenTarget } = useIDEStore.getState();
    if (fileOpenTarget !== 'external') {
      // Inline editor open to avoid TDZ (handleOpenFileInEditorTab defined later)
      import('./stores/editorStore').then(({ useEditorStore }) => {
        const fileEdit = fileEditsMap.get(filePath);
        const lc = fileEdit?.lineChanges;
        useEditorStore.getState().openFile(filePath, lc);
        handleOpenCodeEditorTab(filePath);
      });
      return;
    }

    // Fallback: open in preview drawer
    const name = filePath.split('/').pop() || filePath;
    const fakeEntry: DirectoryEntry = {
      name,
      path: filePath,
      is_dir: false,
      is_symlink: false,
    };
    handleOpenFilePreview(fakeEntry, lineChanges);
  }, [tryOpenInIDE, fileEditsMap, handleOpenFilePreview]);

  // Handler to open file in preferred IDE (legacy, used by other components)
  const handleOpenInIDE = useCallback(async (path: string) => {
    await tryOpenInIDE(path);
  }, [tryOpenInIDE]);

  // Handler to open diff drawer from EditSummaryBar
  const handleDiffClick = useCallback(async (filePath: string, status: 'created' | 'modified' | 'deleted') => {
    console.log('[App] Diff clicked for:', filePath, 'status:', status);

    // Clear git panel selection (we're using synthetic entry)
    setSelectedGitPath(null);

    setDiffLoading(true);
    setDiffError(null);
    setShowDiffDrawer(true);

    // Create synthetic GitStatusEntry for the DiffDrawer
    const rootPath = activeTerminal?.cwd ?? explorerRoot ?? explorerPath ?? undefined;
    let relativePath = filePath;
    if (rootPath && filePath.startsWith(rootPath)) {
      relativePath = filePath.substring(rootPath.length);
      if (relativePath.startsWith('/')) {
        relativePath = relativePath.substring(1);
      }
    }

    // Map status to git status codes
    const syntheticEntry: GitStatusEntry = {
      path: relativePath,
      staged_status: null,
      unstaged_status: status === 'modified' ? 'M' : (status === 'deleted' ? 'D' : null),
      is_untracked: status === 'created',
      original_path: null,
      additions: 0,
      deletions: 0,
    };
    setEditSummaryDiffEntry(syntheticEntry);

    try {
      let diffContent = '';

      if (status === 'created') {
        // File created: Read content and show all as added lines
        try {
          const content = await invoke<string>('read_file_content', {
            path: filePath,
            rootPath
          });

          // Format as unified diff with all lines as additions
          const lines = content.split('\n');
          diffContent = `diff --git a/${filePath} b/${filePath}\n`;
          diffContent += `new file\n`;
          diffContent += `--- /dev/null\n`;
          diffContent += `+++ b/${filePath}\n`;
          diffContent += `@@ -0,0 +1,${lines.length} @@\n`;
          diffContent += lines.map(line => `+${line}`).join('\n');
        } catch (err) {
          console.error('[handleDiffClick] Failed to read created file:', err);
          throw new Error(`Failed to read file: ${err instanceof Error ? err.message : String(err)}`);
        }
      } else if (status === 'modified') {
        // File modified: Use git diff
        try {
          // Convert absolute path to relative if needed
          let relativePath = filePath;
          if (rootPath && filePath.startsWith(rootPath)) {
            relativePath = filePath.substring(rootPath.length);
            if (relativePath.startsWith('/')) {
              relativePath = relativePath.substring(1);
            }
          }

          diffContent = await invoke<string>('git_diff', {
            path: relativePath,
            staged: false,
            untracked: true,
            rootPath,
          });

          if (!diffContent || diffContent.trim() === '') {
            // No diff available - file might have been committed already
            setDiffLoading(false);
            setShowDiffDrawer(false);
            toast.info('No changes to show', {
              description: 'This file has no pending changes. It may have been committed already.',
              duration: 3000,
            });
            return;
          }
        } catch (err) {
          console.error('[handleDiffClick] Failed to get git diff:', err);
          // Check if this is a "file already committed" scenario
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (errorMsg.includes('no changes') || errorMsg.includes('not modified')) {
            setDiffLoading(false);
            setShowDiffDrawer(false);
            toast.info('No changes to show', {
              description: 'This file has no pending changes. It may have been committed already.',
              duration: 3000,
            });
            return;
          }
          throw new Error(`Failed to get diff: ${errorMsg}`);
        }
      } else if (status === 'deleted') {
        // File deleted: Show previous content as removed lines
        try {
          // Try to get the deleted content from git
          let relativePath = filePath;
          if (rootPath && filePath.startsWith(rootPath)) {
            relativePath = filePath.substring(rootPath.length);
            if (relativePath.startsWith('/')) {
              relativePath = relativePath.substring(1);
            }
          }

          // Get diff for deleted file
          diffContent = await invoke<string>('git_diff', {
            path: relativePath,
            staged: false,
            untracked: true,
            rootPath,
          });

          if (!diffContent || diffContent.trim() === '') {
            // If no git history, show placeholder
            diffContent = `diff --git a/${filePath} b/${filePath}\n`;
            diffContent += `deleted file\n`;
            diffContent += `--- a/${filePath}\n`;
            diffContent += `+++ /dev/null\n`;
            diffContent += `@@ -1 +0,0 @@\n`;
            diffContent += `-File was deleted (no git history available)`;
          }
        } catch (err) {
          console.error('[handleDiffClick] Failed to get deleted file diff:', err);
          throw new Error(`Failed to get deleted file diff: ${err instanceof Error ? err.message : String(err)}`);
        }
      }

      setDiffContent(diffContent);
      setDiffLoading(false);

      toast.success(`Diff loaded for ${filePath}`, {
        description: `Status: ${status}`,
        duration: 2000,
      });
    } catch (err) {
      console.error('[handleDiffClick] Error loading diff:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);

      // Check for common scenarios where diff isn't available
      if (errorMsg.includes('no changes') ||
          errorMsg.includes('not modified') ||
          errorMsg.includes('does not exist') ||
          errorMsg.includes('fatal: bad revision')) {
        setDiffLoading(false);
        setShowDiffDrawer(false);
        toast.info('No changes to show', {
          description: 'This file has no pending changes. It may have been committed already.',
          duration: 3000,
        });
        return;
      }

      setDiffError(errorMsg);
      setDiffLoading(false);

      toast.error('Failed to load diff', {
        description: errorMsg,
        duration: 3000,
      });
    }
  }, [activeTerminal?.cwd, explorerRoot, explorerPath]);

  // Brain: fix-changes-panel-race-condition
  // Handler to update modified files map (for FileExplorer indicators).
  // REPLACES (not merges) — ChatView's useMemo always sends the complete set
  // from all assistant messages, so replace is correct and avoids stale data
  // from previous sessions persisting after a session switch.
  const handleEditsChange = useCallback((edits: FileEdit[], deletes: FileDeleted[]) => {
    setModifiedFiles(() => {
      const fresh = new Map<string, 'created' | 'modified' | 'deleted'>();
      edits.forEach(edit => {
        fresh.set(edit.filePath, edit.status || 'modified');
      });
      deletes.forEach(deleted => {
        fresh.set(deleted.filePath, 'deleted');
      });
      return fresh;
    });

    setFileEditsMap(() => {
      const fresh = new Map<string, FileEdit>();
      edits.forEach(edit => {
        fresh.set(edit.filePath, edit);
      });
      return fresh;
    });
  }, []);

  // Handler to open Browser Manager tab
  const handleOpenBrowserTab = useCallback(() => {
    // Create Browser Manager tab in main Quack tab system
    const newTab: Tab = {
      id: `browser-manager-${Date.now()}`,
      label: 'Browser Manager',
      type: 'browser',
      closable: true,
      icon: '🌐',
    };

    setTabs((prevTabs) => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);

    console.log('🦆 Browser Manager tab opened:', newTab.id);

    toast.success('Browser Manager opened! 🌐', {
      description: 'Enter a URL to open in native browser window',
      duration: 2000,
    });
  }, []);

  // Handler to open Documentation tab
  const handleOpenDocsTab = useCallback(() => {
    const newTab = openDocsTab();
    setTabs((prevTabs) => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);

    // Auto-close side-panel when opening docs
    setSidePanelCollapsed(true);

    console.log('🦆 Documentation tab opened:', newTab.id);
    toast.success('Guide opened! 📖', {
      description: 'Learn how to use Quack and Claude Code',
      duration: 2000,
    });
  }, [openDocsTab]);


  // Handler for opening Knowledge Graph tab (deprecated - brain modules removed)
  const handleOpenMemoryGraphTab = useCallback(() => {
    console.log('[Quack] Memory Graph tab deprecated - use Obsidian vault directly');
  }, []);

  // Handler for opening Brain window (separate Tauri webview)
  // Accepts explicit projectPath (from repo-action-row) or falls back to active cwd
  const handleOpenBrainWindow = useCallback(async (explicitProjectPath?: string) => {
    try {
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const { emitTo } = await import('@tauri-apps/api/event');
      const projectPath = explicitProjectPath || activeTerminal?.cwd || undefined;

      // Check if brain window already exists
      const existing = (await WebviewWindow.getAll()).find(w => w.label === 'brain');

      if (existing) {
        // Update project if a specific path was requested
        if (projectPath) {
          await emitTo('brain', 'brain-project-update', { projectPath });
        }
        await existing.setFocus();
        setBrainWindowOpen(true);
        return;
      }

      // Create via Rust command (uses fixed label "brain", reuses if exists)
      await invoke('open_brain_window', { projectPath });
      setBrainWindowOpen(true);

      // Listen for window close to update active state
      const brainWindow = (await WebviewWindow.getAll()).find(w => w.label === 'brain');
      if (brainWindow) {
        brainWindow.once('tauri://destroyed', () => {
          setBrainWindowOpen(false);
        });
      }
    } catch (error) {
      console.error('[Quack] Failed to open Brain window:', error);
    }
  }, [activeTerminal?.cwd]);

  // Sync brain window project when active project changes
  useEffect(() => {
    if (!brainWindowOpen) return;
    const projectPath = activeTerminal?.cwd || undefined;
    if (!projectPath) return;

    const syncBrainProject = async () => {
      try {
        const { emitTo } = await import('@tauri-apps/api/event');
        await emitTo('brain', 'brain-project-update', { projectPath });
      } catch (err) {
        console.warn('[Quack] Failed to sync brain project:', err);
      }
    };
    syncBrainProject();
  }, [brainWindowOpen, activeTerminal?.cwd]);

  // Handler for opening Second Brain tab with a specific node (deprecated)
  const handleOpenSecondBrainWithNode = useCallback((_nodeId: string, _nodeLabel: string) => {
    console.log('[Quack] Second Brain with node deprecated - use Obsidian vault directly');
  }, []);
  // Handler for opening image in a dedicated tab (used by agent/chat with base64 data)
  const handleOpenImageTab = useCallback((filePath: string, imageData: string, mediaType: string) => {
    const fileName = filePath.split("/").pop() || "Image";
    const newTab: Tab = {
      id: `image-${Date.now()}`,
      label: fileName,
      type: "image",
      closable: true,
      filePath,
      imageData,
      mediaType,
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);


  // Handler for opening/focusing Kanban tab (toggle behavior with Cmd+K)
  // Refactored to avoid nested state updates which can cause race conditions
  const handleOpenKanbanTab = useCallback(async () => {
    // First, check if Kanban is popped out in a separate window
    if (isTabPoppedOut('kanban-board')) {
      console.log('[Quack] Kanban is popped out, focusing the popup window');
      // Focus the popup window instead of opening a tab
      const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
      const allWindows = await WebviewWindow.getAll();
      const kanbanPopout = allWindows.find(w => w.label.includes('kanban'));
      if (kanbanPopout) {
        await kanbanPopout.setFocus();
        return;
      }
    }

    // Toggle: if already on Kanban tab, switch back to Chat
    if (activeTabId === 'kanban-board') {
      console.log('[Quack] Kanban tab toggled off, returning to chat');
      // 🦆 SESSIONS-FIRST: Don't auto-select sessions - preserve current state
      // If user had a session selected, it stays selected
      // If no session was selected, show the agent empty state
      setActiveTabId('chat');
      return;
    }

    // When opening full Kanban board, hide the mini-panel in sidebar
    setShowKanbanMiniPanel(false);

    // Check if kanban tab already exists
    const existingTab = tabs.find(t => t.type === 'kanban');

    if (existingTab) {
      // Tab exists, just focus it
      console.log('[Quack] Kanban tab exists, focusing it');
      setActiveTabId('kanban-board');
    } else {
      // Create new kanban tab and focus it
      const newTab = openKanbanTab();
      console.log('[Quack] Kanban tab created:', newTab.id);
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId('kanban-board');
    }
  }, [openKanbanTab, activeTabId, tabs, isTabPoppedOut]);

  // Handler for opening/focusing Automation tab (toggle with Cmd+J)
  const handleOpenAutomationTab = useCallback(() => {
    if (activeTabId === 'automation-board') {
      setActiveTabId('chat');
      return;
    }
    const existingTab = tabs.find(t => t.type === 'automation');
    if (existingTab) {
      setActiveTabId('automation-board');
    } else {
      const newTab = openAutomationTab();
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId('automation-board');
    }
  }, [openAutomationTab, activeTabId, tabs]);

  // Handler for opening/focusing Office tab
  const handleOpenOfficeTab = useCallback(() => {
    if (activeTabId === 'office-view') {
      setActiveTabId('chat');
      return;
    }
    const existingTab = tabs.find(t => t.type === 'office');
    if (existingTab) {
      setActiveTabId('office-view');
    } else {
      const newTab = openOfficeTab();
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId('office-view');
    }
  }, [openOfficeTab, activeTabId, tabs]);

  // Handler for opening/focusing Whiteboard tab (toggle with Cmd+Shift+W)
  const handleOpenFeatureMapTab = useCallback(() => {
    if (activeTabId === 'feature-map') {
      setActiveTabId('chat');
      return;
    }
    const existingTab = tabs.find(t => t.type === 'feature-map');
    if (existingTab) {
      // Ensure initialProjectPath is set (may be missing on tabs created before the fix)
      if (!existingTab.initialProjectPath && activeTerminal?.cwd) {
        setTabs(prev => prev.map(t =>
          t.id === existingTab.id ? { ...t, initialProjectPath: activeTerminal.cwd } : t
        ));
      }
      setActiveTabId('feature-map');
    } else {
      const newTab = openFeatureMapTab(activeTerminal?.cwd);
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId('feature-map');
    }
  }, [openFeatureMapTab, activeTabId, tabs, activeTerminal?.cwd]);

  // Force-open whiteboard for a specific project. Used by Office View v2 room click.
  const handleOpenWhiteboardForProject = useCallback(
    (projectPath: string) => {
      const existingTab = tabs.find(t => t.type === 'feature-map');
      if (existingTab) {
        if (existingTab.initialProjectPath !== projectPath) {
          setTabs(prev => prev.map(t =>
            t.id === existingTab.id ? { ...t, initialProjectPath: projectPath } : t
          ));
        }
      } else {
        setTabs(prevTabs => [...prevTabs, openFeatureMapTab(projectPath)]);
      }
      setActiveTabId('feature-map');
    },
    [openFeatureMapTab, tabs]
  );

  // Handler for opening/focusing Code Editor tab (toggle with Cmd+E, per-file tabs)
  // Brain: pattern-code-editor-tab
  const handleOpenCodeEditorTab = useCallback((filePath?: string) => {
    // Toggle: if no filePath and current tab is a code-editor tab, switch to chat
    if (!filePath && activeTabId.startsWith('code-editor')) {
      setActiveTabId('chat');
      return;
    }
    if (!filePath) return;

    const fileTabId = codeEditorTabId(filePath);
    const existingTab = tabs.find(t => t.id === fileTabId);

    if (existingTab) {
      setActiveTabId(fileTabId);
    } else {
      const newTab = openCodeEditorTab(filePath);
      setTabs(prevTabs => [...prevTabs, newTab]);
      setActiveTabId(newTab.id);
    }
  }, [openCodeEditorTab, activeTabId, tabs]);

  // Handler to open a file in the editor tab (used by ChangesPanel, etc.)
  // Brain: pattern-code-editor-tab — pass lineChanges from fileEditsMap for diff highlighting
  const handleOpenFileInEditorTab = useCallback((filePath: string) => {
    import('./stores/editorStore').then(({ useEditorStore }) => {
      const fileEdit = fileEditsMap.get(filePath);
      const lineChanges = fileEdit?.lineChanges;
      useEditorStore.getState().openFile(filePath, lineChanges);
      handleOpenCodeEditorTab(filePath);
    });
  }, [handleOpenCodeEditorTab, fileEditsMap]);

  // Listen for quack:open-file events from MarkdownText file link clicks
  useEffect(() => {
    const handleOpenFile = (e: Event) => {
      const { path } = (e as CustomEvent<{ path: string }>).detail;
      if (!path) return;

      // Absolute path — open directly
      if (path.startsWith('/')) {
        handleOpenCodeEditorTab(path);
        return;
      }

      // Relative path — resolve against explorerRoot + src/
      if (explorerRoot) {
        const candidates = [
          `${explorerRoot}/src/${path}`,
          `${explorerRoot}/${path}`,
        ];
        // Try src/ first, then root
        invoke<string>('read_file_content', { path: candidates[0] })
          .then(() => handleOpenCodeEditorTab(candidates[0]))
          .catch(() => handleOpenCodeEditorTab(candidates[1]));
      }
    };

    window.addEventListener('quack:open-file', handleOpenFile);
    return () => window.removeEventListener('quack:open-file', handleOpenFile);
  }, [handleOpenCodeEditorTab, explorerRoot]);

  // Listen for quack:open-symbol events from MarkdownText symbol chip clicks
  // Uses editorStore.pendingNavigationLine instead of setTimeout for reliable timing
  useEffect(() => {
    let inFlight = false;
    const handleOpenSymbol = async (e: Event) => {
      const { symbol } = (e as CustomEvent<{ symbol: string }>).detail;
      if (!symbol || inFlight) return;

      if (!explorerRoot) {
        toast.error('Apri un progetto per navigare ai simboli');
        return;
      }

      inFlight = true;
      try {
        const result = await findDefinition(symbol, explorerRoot);
        if (result.definitions.length === 0) {
          toast.error(`Definition not found for \`${symbol}\``);
          return;
        }
        const def = result.definitions[0];
        // line is 1-based (tree-sitter convention)
        const { useEditorStore } = await import('./stores/editorStore');
        useEditorStore.getState().setPendingNavigationLine(def.line);
        handleOpenCodeEditorTab(def.file);
      } catch {
        toast.error(`Definition not found for \`${symbol}\``);
      } finally {
        inFlight = false;
      }
    };

    window.addEventListener('quack:open-symbol', handleOpenSymbol);
    return () => window.removeEventListener('quack:open-symbol', handleOpenSymbol);
  }, [handleOpenCodeEditorTab, explorerRoot]);

  // Handler for firing an automation job — creates a session and sends the prompt
  const handleAutomationFireJob = useCallback(async (job: AutomationJob) => {
    console.log('[Automation] Firing job:', job.name, 'agent:', job.agentId);

    const agent = terminals.find(t => t.id === job.agentId);
    if (!agent) {
      console.error('[Automation] Agent not found:', job.agentId);
      toast.error(`Agent "${job.agentName}" not found — cannot fire job "${job.name}"`);
      return;
    }

    try {
      // 0. Inject agent personality into CLAUDE.md before firing.
      // Brain: 025-team-delegation-footer (shared injectAgentPersonality helper)
      await injectAgentPersonality(agent, job.projectPath);

      // 1. Create a new AgentSession for this automation run
      const sessionTitle = `[Auto] ${job.name || 'Unnamed Job'}`;
      const newSession = await createSession({
        title: sessionTitle,
        agentId: job.agentId,
        projectPath: job.projectPath || agent.cwd,
        projectName: job.projectName || extractProjectId(agent.cwd) || 'project',
        status: 'in_progress',
        messageCount: 0,
        initialPrompt: job.promptTemplate,
      });

      console.log('[Automation] Session created:', newSession.id, 'title:', sessionTitle, 'model:', job.model);

      // 2. Send the prompt to the agent via the session
      await sendMessageForTargetAgent(newSession.id, job.promptTemplate, {
        workingDirectory: job.projectPath || agent.cwd,
        model: job.model,
        provider: job.provider,
      });

      toast.success(`Job "${job.name}" fired — session created under ${job.agentName}`);
    } catch (err) {
      console.error('[Automation] Failed to fire job:', err);
      toast.error(`Failed to fire job "${job.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [terminals, createSession, sendMessageForTargetAgent]);

  // Brain: fix-automation-job-fires-repeatedly
  // Global automation scheduler — always mounted, fires jobs even when Automation tab is closed
  useEffect(() => {
    if (!tauriAvailable) return;

    // Initialize the automation store (loads jobs from disk)
    useAutomationStore.getState().initialize();

    // Start the Rust scheduler (idempotent — safe to call multiple times)
    invoke('start_automation_scheduler').catch(err =>
      console.error('[Automation] Failed to start scheduler:', err)
    );

    // Brain: fix-automation-job-fires-repeatedly
    // Listen for 30s tick from Rust scheduler
    // Defense-in-depth: 3 layers prevent re-fires:
    //   1. claimJobForFiring() — synchronous lock, prevents concurrent fires
    //   2. nextRunAt advanced synchronously in-memory before any async work
    //   3. lastRunStatus set to 'running' synchronously
    const unlistenTickPromise = listen('automation-scheduler-tick', () => {
      const store = useAutomationStore.getState();
      const now = Date.now();

      for (const job of store.jobs) {
        if (!job.enabled || !job.nextRunAt) continue;
        if (now < job.nextRunAt) continue;
        if (job.skipIfRunning && job.lastRunStatus === 'running') continue;

        // LAYER 1: Synchronous firing lock — if another tick already claimed this job, skip
        if (!store.claimJobForFiring(job.id)) continue;

        // LAYER 2+3: Advance nextRunAt and set status SYNCHRONOUSLY in the store
        // This ensures the NEXT tick (30s later) sees updated state immediately
        const nextRunAt = getNextFireTime(job.cronExpression);
        const updatedJobs = useAutomationStore.getState().jobs.map(j =>
          j.id === job.id
            ? { ...j, nextRunAt: nextRunAt ?? undefined, lastRunStatus: 'running' as const }
            : j
        );
        useAutomationStore.setState({ jobs: updatedJobs });

        // Async fire — runs in background, lock released when done
        (async () => {
          try {
            const { markJobRunning, markRunComplete, updateJob, releaseJobFiring } =
              useAutomationStore.getState();
            const run = await markJobRunning(job.id);
            await invoke('mark_automation_job_running', { jobId: job.id });

            // Persist nextRunAt to disk (already updated in-memory above)
            await updateJob(job.id, { nextRunAt: nextRunAt ?? undefined });

            const agent = terminalsRef.current.find(t => t.id === job.agentId);
            if (!agent) {
              console.error('[Automation] Agent not found:', job.agentId);
              await markRunComplete(run.id, 'failed', undefined, `Agent "${job.agentName}" not found`);
              await invoke('mark_automation_job_completed', { jobId: job.id });
              releaseJobFiring(job.id);
              return;
            }

            // Inject agent personality into CLAUDE.md before firing.
            // Brain: 025-team-delegation-footer (shared injectAgentPersonality helper)
            await injectAgentPersonality(agent, job.projectPath);

            const autoTitle = `[Auto] ${job.name || 'Unnamed Job'}`;
            const newSession = await createSession({
              title: autoTitle,
              agentId: job.agentId,
              projectPath: job.projectPath || agent.cwd,
              projectName: job.projectName || extractProjectId(agent.cwd) || 'project',
              status: 'in_progress',
              messageCount: 0,
              initialPrompt: job.promptTemplate,
            });

            await sendMessageForTargetAgent(newSession.id, job.promptTemplate, {
              workingDirectory: job.projectPath || agent.cwd,
              model: job.model,
              provider: job.provider,
            });

            console.log(`[Automation] Job "${job.name}" fired — session ${newSession.id}, title: ${autoTitle}, model: ${job.model}`);

            // Release lock and mark success after 5s
            setTimeout(async () => {
              const s = useAutomationStore.getState();
              const currentRun = s.history.find(r => r.id === run.id);
              if (currentRun?.status === 'running') {
                await s.markRunComplete(run.id, 'success');
                await invoke('mark_automation_job_completed', { jobId: job.id });
              }
              s.releaseJobFiring(job.id);
            }, 5000);
          } catch (err) {
            console.error('[Automation] Failed to fire job:', err);
            useAutomationStore.getState().releaseJobFiring(job.id);
          }
        })();
      }
    });

    // Listen for remote API changes to automation jobs
    const unlistenJobsUpdated = listen('automation-jobs-updated', async () => {
      console.log('[Automation] Jobs updated externally, reloading from disk...');
      useAutomationStore.setState({ initialized: false });
      await useAutomationStore.getState().initialize();
    });

    // Listen for remote API changes to sessions
    const unlistenSessionsUpdated = listen('sessions-updated', () => {
      console.log('[Sessions] Sessions updated externally, reloading...');
      useSessionStore.getState().loadSessions();
    });

    return () => {
      unlistenTickPromise.then(fn => fn()).catch(() => undefined);
      unlistenJobsUpdated.then(fn => fn()).catch(() => undefined);
      unlistenSessionsUpdated.then(fn => fn()).catch(() => undefined);
    };
  }, [tauriAvailable, createSession, sendMessageForTargetAgent]);

  // Handler for opening Git Drawer with fullscreen loader
  const handleOpenGitDrawer = useCallback(() => {
    // Show fullscreen loader immediately if we don't have data yet
    if (!gitSummary) {
      setLoadingGit(true);
      // Delay opening the drawer to let the loader paint first
      setTimeout(() => {
        setShowGitDrawer(true);
      }, 50);
    } else {
      // Data already cached, open immediately
      setShowGitDrawer(true);
    }
  }, [gitSummary]);

  // Handler for opening Project Dashboard tab
  const handleOpenProjectDashboard = useCallback((projectPath: string, projectName: string) => {
    const tabId = `project-dashboard-${projectPath.replace(/\//g, '-')}`;

    // ALWAYS show fullscreen loader IMMEDIATELY when clicking on a project
    setLoadingDashboard(true);

    // Use setTimeout to yield to the browser's event loop, ensuring the loader
    // can paint before we trigger heavy state updates and component rendering.
    // This is more reliable than requestAnimationFrame for ensuring visual feedback.
    setTimeout(() => {
      // Increment refresh key to force data reload even if tab exists
      setDashboardRefreshKey(prev => prev + 1);

      // Check if tab already exists
      const existingTab = tabs.find(t => t.id === tabId);

      if (existingTab) {
        // Tab exists, just focus it
        console.log('[Quack] Project Dashboard tab exists, focusing it:', tabId);
        setActiveTabId(tabId);
      } else {
        // Create new project dashboard tab and insert as FIRST tab
        const newTab = openProjectDashboardTab(projectPath, projectName);
        console.log('[Quack] Project Dashboard tab created (as first):', newTab.id);
        setTabs(prevTabs => [newTab, ...prevTabs]);
        setActiveTabId(tabId);
      }
    }, 50); // Small delay ensures browser has time to paint the loader
  }, [openProjectDashboardTab, tabs]);

  // Handler for creating a Kanban task from the context menu (right-click on agent)
  // Opens the Kanban tab and the new task modal with pre-populated agent data
  const handleCreateTaskFromAgent = useCallback((terminal: TerminalInfo) => {
    // Extract project name from path
    const projectName = extractProjectId(terminal.cwd) || 'Unknown';

    // Build initial values for the task modal
    const initialValues: KanbanTaskInitialValues = {
      projectPath: terminal.cwd,
      projectName,
      branch: terminal.branch,
      agentId: terminal.id,
      agentName: terminal.label,
      agentAvatar: terminal.avatar,
      agentColor: terminal.color,
      targetStatus: 'todo', // Always start in TODO
    };

    // Open Kanban tab first, then request the modal with initial values
    handleOpenKanbanTab();
    requestNewTaskModal(initialValues);
  }, [handleOpenKanbanTab, requestNewTaskModal]);

  // Open task in agent's main Chat tab (no separate tab created)
  // This makes the task's chat appear in the agent's Chat tab, like an independent conversation
  // 🦆 PERFORMANCE: Optimized with parallel operations and immediate UI updates
  // - UI updates happen FIRST (optimistic update)
  // - Independent operations run in parallel (Promise.all)
  // - Store cache prevents repeated disk reads
  const openTaskTab = useCallback(async (task: KanbanTask) => {
    // Task must have an assigned agent (needed for running the agent)
    if (!task.assignedAgent?.id) {
      console.warn('[Quack] Cannot open task without assigned agent:', task.id);
      return;
    }

    const agentId = task.assignedAgent.id;
    let terminal = terminals.find(t => t.id === agentId);

    // Fallback: search by agent name if UUID not found (handles stale references after agent reset)
    if (!terminal && task.assignedAgent?.name) {
      terminal = terminals.find(t => t.label === task.assignedAgent!.name);
      if (terminal) {
        console.warn(`[Quack] Agent UUID changed for "${task.assignedAgent.name}". Auto-fixing task reference...`);
        // Auto-fix: update the task with the new UUID
        useKanbanStore.getState().updateTask(task.id, {
          assignedAgent: { ...task.assignedAgent!, id: terminal.id }
        });
      }
    }

    if (!terminal) {
      console.warn(`[Quack] Agent terminal not found for task: ${task.assignedAgent.id}`);
      return;
    }

    const projectPath = task.projectPath || terminal.cwd;
    const taskTabId = `task-${task.id}`;

    // ========================================
    // STEP 1: CREATE/FOCUS TASK TAB (Optimistic UI)
    // ========================================
    // Tasks are now FIRST-CLASS CITIZENS with their own dedicated tabs
    // DO NOT activate the agent - task is independent!

    // Check if task tab already exists
    const existingTaskTab = tabs.find(t => t.id === taskTabId);

    if (!existingTaskTab) {
      // Create new task tab
      const taskTitle = task.title || 'Untitled Task';
      const taskLabel = taskTitle.length > 25
        ? taskTitle.substring(0, 25) + '...'
        : taskTitle;

      const newTaskTab: Tab = {
        id: taskTabId,
        label: taskLabel,
        type: 'task',
        closable: true,
        color: task.assignedAgent?.color,
        taskId: task.id,
      };

      setTabs(prev => [...prev, newTaskTab]);
      console.log(`[Quack] Created new task tab for "${task.title}"`);
    }

    // Activate task tab and set activeTaskId
    setActiveTabId(taskTabId);
    // 🦆 FIX SESSION MIXING: Use exclusive setter to clear activeSessionId
    setActiveTaskIdExclusive(task.id);

    // ========================================
    // STEP 2: PARALLEL OPERATIONS
    // ========================================
    // Run independent operations in parallel to reduce total wait time
    const previousTaskId = activeTaskId;

    const [, chatLoadResult] = await Promise.all([
      // Operation 1: Load project directory (file system I/O)
      loadDirectory(projectPath).catch(err => {
        console.warn(`[openTaskTab] Failed to load directory:`, err);
        return null;
      }),

      // Operation 2: Load chat messages from disk (Store I/O)
      (async () => {
        try {
          const store = await getCachedStore('quack-chats.json');
          const savedChat = await store.get<{
            messages: ChatMessage[];
            tokens?: { inputTokens: number; outputTokens: number; cacheCreationTokens?: number; cacheReadTokens?: number; totalCost?: number };
            sessionId?: string;
            timestamp?: number;
          }>(`chat-${task.id}`);

          return savedChat;
        } catch (error) {
          console.warn(`[openTaskTab] Failed to load messages for task ${task.id}:`, error);
          return null;
        }
      })(),

      // Operation 3: Save previous task messages (Store I/O)
      // This runs in parallel with loading new task data
      (async () => {
        if (previousTaskId && previousTaskId !== task.id) {
          const currentMessages = chatSessions.get(previousTaskId);
          if (currentMessages && currentMessages.length > 0) {
            console.log(`[openTaskTab] Saving ${currentMessages.length} messages for previous task ${previousTaskId} before switching...`);
            try {
              await saveKanbanChatSession(previousTaskId, currentMessages);
            } catch (err) {
              console.warn(`[openTaskTab] Failed to save previous task messages:`, err);
            }
          }
        }
      })(),
    ]);

    // ========================================
    // STEP 3: PROCESS LOADED DATA
    // ========================================
    // Update chat sessions with loaded messages
    const existingMessages = chatSessions.get(task.id);
    const hasInMemoryMessages = existingMessages && existingMessages.length > 0;

    if (chatLoadResult?.messages) {
      // 🦆 FIX: NEVER overwrite in-memory messages that have events - they are SACRED
      // The "more messages on disk" condition was REMOVED because it caused formatting loss
      const existingHasEvents = existingMessages?.some(m => m.events && m.events.length > 0);
      const loadedHasEvents = chatLoadResult.messages.some(m => m.events && m.events.length > 0);

      // Only load from disk if:
      // 1. No messages in memory, OR
      // 2. Loaded messages have events and existing don't (upgrade quality)
      // REMOVED: "messages.length > existingMessages.length" - caused formatting loss!
      const shouldLoad = !hasInMemoryMessages || (loadedHasEvents && !existingHasEvents);

      if (shouldLoad) {
        setChatSessions(prev => {
          const newSessions = new Map(prev);
          newSessions.set(task.id, chatLoadResult.messages);
          return newSessions;
        });
        console.log(`[openTaskTab] ✅ Loaded ${chatLoadResult.messages.length} messages from disk for task "${task.title}" (hasEvents: ${loadedHasEvents})`);
      } else {
        console.log(`[openTaskTab] 🛡️ PROTECTED: Keeping ${existingMessages?.length} in-memory messages for task "${task.title}" (hasEvents: ${existingHasEvents})`);
      }

      // Always restore tokens if available
      if (chatLoadResult.tokens) {
        setChatTokensMap(prev => {
          const newMap = new Map(prev);
          newMap.set(task.id, {
            inputTokens: chatLoadResult.tokens!.inputTokens || 0,
            outputTokens: chatLoadResult.tokens!.outputTokens || 0,
            cacheCreationTokens: chatLoadResult.tokens!.cacheCreationTokens || 0,
            cacheReadTokens: chatLoadResult.tokens!.cacheReadTokens || 0,
            totalCost: chatLoadResult.tokens!.totalCost || 0,
          });
          return newMap;
        });
      }
    } else {
      // Task has no messages on disk - only initialize if also no in-memory messages
      if (!hasInMemoryMessages) {
        setChatSessions(prev => {
          const newSessions = new Map(prev);
          newSessions.set(task.id, []);
          return newSessions;
        });
        console.log(`[Quack] Task "${task.title}" has no messages, initialized empty array`);
      } else {
        console.log(`[Quack] Task "${task.title}" has ${existingMessages.length} in-memory messages (not on disk yet)`);
      }
    }

    console.log(`[Quack] Task "${task.title}" opened in dedicated task tab (independent from agent)`);

    // Pre-create listener AFTER state updates (non-blocking for UI)
    // This can be async because the UI is already showing the correct messages
    ensureListenerReady(task.id).then(() => {
      console.log(`[Quack] Listener pre-created for task "${task.title}" (${task.id})`);
    }).catch(err => {
      console.warn(`[Quack] Failed to pre-create listener for task "${task.title}":`, err);
    });
  }, [terminals, tabs, loadDirectory, activeTaskId, chatSessions, saveKanbanChatSession, setActiveTaskIdExclusive]);

  // ========================================
  // SELECT TASK (like selecting an agent - no new tabs)
  // ========================================
  // When clicking a task in the sidebar, show its chat in the main area
  // This behaves like selecting an agent - no tab creation
  const selectTask = useCallback(async (task: KanbanTask) => {
    // Task must have an assigned agent
    if (!task.assignedAgent?.id) {
      console.warn('[Quack] Cannot select task without assigned agent:', task.id);
      return;
    }

    const agentId = task.assignedAgent.id;
    let terminal = terminals.find(t => t.id === agentId);

    // Fallback: search by agent name if UUID not found
    if (!terminal && task.assignedAgent?.name) {
      terminal = terminals.find(t => t.label === task.assignedAgent!.name);
      if (terminal) {
        console.warn(`[Quack] Agent UUID changed for "${task.assignedAgent.name}". Auto-fixing task reference...`);
        useKanbanStore.getState().updateTask(task.id, {
          assignedAgent: { ...task.assignedAgent!, id: terminal.id }
        });
      }
    }

    if (!terminal) {
      console.warn(`[Quack] Agent terminal not found for task: ${task.assignedAgent.id}`);
      return;
    }

    const projectPath = task.projectPath || terminal.cwd;

    // Set the assigned agent as active (shows Agent Personality in side panel)
    setActiveId(terminal.id);
    // Set task as active (this will show task chat in the main area)
    // 🦆 FIX SESSION MIXING: Use exclusive setter to clear activeSessionId
    setActiveTaskIdExclusive(task.id);
    // Switch to chat tab (not a task-specific tab)
    setActiveTabId('chat');

    // Load task messages if not already loaded
    const existingMessages = chatSessions.get(task.id) || [];
    const hasInMemoryMessages = existingMessages.length > 0;

    // Load directory for file explorer
    loadDirectory(projectPath).catch(err => {
      console.warn(`[selectTask] Failed to load directory:`, err);
    });

    // Switch to task's branch if specified (same as agent selection)
    if (task.branch) {
      try {
        console.log(`[selectTask] Switching to branch: ${task.branch}`);
        await invoke('git_switch_branch', {
          branchName: task.branch,
          rootPath: projectPath
        });
      } catch (err) {
        console.warn(`[selectTask] Failed to switch to branch ${task.branch}:`, err);
      }
    }

    // Load and inject agent personality into CLAUDE.md (same as agent selection)
    try {
      console.log(`[selectTask] Loading personality for agent "${terminal.label}" (ID: ${terminal.id})`);
      const personality = await invoke<AgentPersonality>('load_agent_personality', {
        projectPath: terminal.cwd,
        personalityId: terminal.id,
      });

      // Inject into CLAUDE.md
      await invoke('inject_personality_to_claude_md', {
        projectPath: terminal.cwd,
        personality,
      });

      console.log(`[selectTask] ✅ Injected personality for "${terminal.label}" into CLAUDE.md`);
    } catch (error) {
      console.warn(`[selectTask] Failed to inject personality:`, error);
    }

    // Load chat messages from disk if needed
    // 🦆 FIX: Also check if existing messages have events before loading
    const existingHasEvents = existingMessages.some(m => m.events && m.events.length > 0);

    if (!hasInMemoryMessages || !existingHasEvents) {
      try {
        const store = await getCachedStore('quack-chats.json');
        const savedChat = await store.get<{
          messages: ChatMessage[];
          tokens?: { inputTokens: number; outputTokens: number; cacheCreationTokens?: number; cacheReadTokens?: number; totalCost?: number };
          sessionId?: string;
          timestamp?: number;
        }>(`chat-${task.id}`);

        if (savedChat && savedChat.messages && savedChat.messages.length > 0) {
          const savedHasEvents = savedChat.messages.some(m => m.events && m.events.length > 0);

          // Only load if: no messages in memory, OR saved has events and existing doesn't
          const shouldLoad = !hasInMemoryMessages || (savedHasEvents && !existingHasEvents);

          if (shouldLoad) {
            setChatSessions(prev => {
              const newSessions = new Map(prev);
              newSessions.set(task.id, savedChat.messages);
              return newSessions;
            });
            console.log(`[selectTask] ✅ Loaded ${savedChat.messages.length} messages for task "${task.title}" (hasEvents: ${savedHasEvents})`);
          } else {
            console.log(`[selectTask] 🛡️ PROTECTED: Keeping ${existingMessages.length} in-memory messages for task "${task.title}" (hasEvents: ${existingHasEvents})`);
          }

          if (savedChat.tokens) {
            setChatTokensMap(prev => {
              const newMap = new Map(prev);
              newMap.set(task.id, {
                inputTokens: savedChat.tokens!.inputTokens || 0,
                outputTokens: savedChat.tokens!.outputTokens || 0,
                cacheCreationTokens: savedChat.tokens!.cacheCreationTokens || 0,
                cacheReadTokens: savedChat.tokens!.cacheReadTokens || 0,
                totalCost: savedChat.tokens!.totalCost || 0,
              });
              return newMap;
            });
          }
        }
      } catch (error) {
        console.warn(`[selectTask] Failed to load messages for task ${task.id}:`, error);
      }
    }

    // Pre-create listener
    ensureListenerReady(task.id).catch(err => {
      console.warn(`[Quack] Failed to pre-create listener for task:`, err);
    });

    console.log(`[Quack] Task "${task.title}" selected (showing in main chat area)`);
  }, [terminals, chatSessions, loadDirectory, setActiveTaskIdExclusive]);

  // Global keyboard shortcuts
  useGlobalKeyboardShortcuts({
    toggleKanban: handleOpenKanbanTab,
    toggleAutomation: handleOpenAutomationTab,
    toggleOffice: handleOpenOfficeTab,
    toggleFeatureMap: handleOpenFeatureMapTab,
    openTerminalWindow: handleCreateAgentTerminal,  // Cmd+T opens Terminal Window App
    newAgent: handleOpenNewTerminalModal,           // Cmd+N opens New Agent modal
    toggleSidePanel: useCallback(() => {
      setSidePanelCollapsed((prev: boolean) => !prev);
    }, []),
    focusFileSearch: useCallback(() => {
      // Focus the File Explorer search input
      const searchInput = document.querySelector<HTMLInputElement>('input.explorer-search');
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }, []),
    newKanbanTask: useCallback(() => {
      // Only works when Kanban tab is active
      const isKanbanTabActive = activeTabId === 'kanban-board';
      if (isKanbanTabActive) {
        requestNewTaskModal();
      }
    }, [activeTabId, requestNewTaskModal]),
    toggleSidebarView: useCallback(() => {
      // Focus the Task Hub section in the right-side accordion
      if (sidePanelCollapsed) {
        setSidePanelCollapsed(false);
        setTimeout(() => setForceExpandSection('taskhub'), 50);
      } else {
        setForceExpandSection('taskhub');
      }
    }, [sidePanelCollapsed]),
  });

  // Tab management handlers
  const handleTabClick = useCallback((tabId: string) => {
    updateActiveTab(tabId);

    // If clicking a file tab, restore its preview
    if (tabId.startsWith('file-')) {
      const tab = tabs.find(t => t.id === tabId);
      if (tab?.filePath) {
        const name = tab.label;
        const path = tab.filePath;
        const fakeEntry: DirectoryEntry = {
          name,
          path,
          is_dir: false,
          is_symlink: false,
        };
        handleOpenFilePreview(fakeEntry);
      }
    }
  }, [tabs, handleOpenFilePreview, updateActiveTab]);

  const handleTabClose = useCallback(async (tabId: string) => {
    // Don't close the chat tab
    if (tabId === 'chat') return;

    // Check if this is a task tab - reset activeTaskId when closing
    if (tabId.startsWith('task-')) {
      const tab = tabs.find(t => t.id === tabId);
      if (tab?.taskId === activeTaskId) {
        // 🦆 FIX SESSION MIXING: Just clear the task, don't need exclusive here
        // because we're just clearing, not setting a new value
        setActiveTaskId(null);
      }
    }

    // Check if this is an agent-terminal tab
    const tab = tabs.find(t => t.id === tabId);
    if (tab?.type === 'agent-terminal' && tab.terminalId) {
      // Ask for confirmation before closing terminal
      const confirmed = await confirm(
        `Close terminal "${tab.label}"? This will terminate the running process.`,
        { title: 'Close Terminal', kind: 'warning' }
      );

      if (!confirmed) {
        return;
      }

      // Dispose terminal instance and close backend PTY
      const { disposeXTermInstance } = await import('./components/XTermInstance');
      disposeXTermInstance(tab.terminalId);

      // Remove terminal from agentTerminals list (NEW STATE!)
      setAgentTerminals((prev) => prev.filter(t => t.id !== tab.terminalId));

      console.log(`✅ Closed agent terminal: ${tab.label} (${tab.terminalId})`);
    }

    // If closing a file tab that is currently being previewed, reset preview state
    if (tab?.type === 'file' && activeTabId === tabId) {
      setPreviewFile(null);
      setPreviewContent('');
      setLoadingPreview(false);
      setPreviewError(null);
    }

    // Handle split view: if closing the split tab, just close the split
    if (splitTabId === tabId) {
      setSplitTabId(null);
    }

    setTabs((prevTabs) => {
      const filtered = prevTabs.filter(t => t.id !== tabId);

      // If closing active tab, switch to previous tab or chat
      if (activeTabId === tabId) {
        // If split is active, promote split tab to primary
        if (splitTabId && splitTabId !== tabId) {
          handleTabClick(splitTabId);
          setSplitTabId(null);
        } else {
          const closedIndex = prevTabs.findIndex(t => t.id === tabId);
          const newActiveTab = filtered[Math.max(0, closedIndex - 1)];
          const newActiveTabId = newActiveTab?.id || 'chat';
          handleTabClick(newActiveTabId);
        }
      }

      return filtered;
    });

    // Also remove from tabsByTerminal for the active terminal
    if (activeId) {
      setTabsByTerminal((prev) => {
        const updated = new Map(prev);
        const terminalTabs = updated.get(activeId) || [];
        const filtered = terminalTabs.filter(t => t.id !== tabId);

        if (filtered.length !== terminalTabs.length) {
          updated.set(activeId, filtered);
          console.log('[handleTabClose] Removed tab from terminal:', activeId, tabId);
        }

        return updated;
      });
    }
  }, [activeTabId, activeId, tabs, activeTaskId, handleTabClick]);

  // Handle tab reorder via drag and drop
  const handleTabReorder = useCallback((reorderedTabs: Tab[]) => {
    console.log('[handleTabReorder] Reordering tabs');

    // Update global tabs state
    setTabs(reorderedTabs);

    // Update tabsByTerminal for the active terminal
    if (activeId) {
      setTabsByTerminal((prev) => {
        const updated = new Map(prev);
        const fileTabs = reorderedTabs.filter(t => t.type === 'file');

        if (fileTabs.length > 0) {
          updated.set(activeId, fileTabs);
          console.log('[handleTabReorder] Updated tab order for terminal:', activeId);
        }

        return updated;
      });
    }
  }, [activeId]);

  // Split View handlers
  const handleSplitDropLeft = useCallback((tabId: string) => {
    setIsDraggingTab(false); // Always reset drag state on drop
    if (tabId === activeTabId && !splitTabId) return;
    if (tabId === splitTabId) {
      setSplitTabId(activeTabId);
      setActiveTabId(tabId);
      return;
    }
    if (tabId === activeTabId) return;
    if (!splitTabId) {
      setSplitTabId(activeTabId);
    }
    handleTabClick(tabId);
  }, [activeTabId, splitTabId]);

  const handleSplitDropRight = useCallback((tabId: string) => {
    setIsDraggingTab(false); // Always reset drag state on drop
    if (tabId === splitTabId) return;
    if (tabId === activeTabId) {
      setSplitTabId(tabId);
      setActiveTabId('chat');
      return;
    }
    setSplitTabId(tabId);
  }, [activeTabId, splitTabId]);

  const handleCloseSplit = useCallback(() => {
    setSplitTabId(null);
    setIsDraggingTab(false);
  }, []);

  // Create or find a tab from sidebar drop data, return its ID
  const resolveTabFromSidebarDrop = useCallback((data: SidebarDropData): string | null => {
    try {
      const parsed = JSON.parse(data.payload);

      if (data.mimeType === 'application/quack-file' && parsed.path) {
        const tabId = codeEditorTabId(parsed.path);
        if (!tabs.find(t => t.id === tabId)) {
          const newTab = openCodeEditorTab(parsed.path);
          setTabs(prev => [...prev, newTab]);
        }
        return tabId;
      }

      if (data.mimeType === 'application/quack-skill' && parsed.path) {
        const tabId = codeEditorTabId(parsed.path);
        if (!tabs.find(t => t.id === tabId)) {
          const newTab = openCodeEditorTab(parsed.path);
          setTabs(prev => [...prev, newTab]);
        }
        return tabId;
      }

      if (data.mimeType === 'application/quack-rule' && parsed.path) {
        const tabId = codeEditorTabId(parsed.path);
        if (!tabs.find(t => t.id === tabId)) {
          const newTab = openCodeEditorTab(parsed.path);
          setTabs(prev => [...prev, newTab]);
        }
        return tabId;
      }

      if (data.mimeType === 'application/quack-command') {
        const cmdTabId = `command-${parsed.name}-${parsed.scope || 'project'}`;
        if (!tabs.find(t => t.id === cmdTabId)) {
          const newTab: Tab = {
            id: cmdTabId,
            label: `/${parsed.name}`,
            type: 'command',
            closable: true,
            commandName: parsed.name,
            commandScope: parsed.scope || 'project',
          };
          setTabs(prev => [...prev, newTab]);
        }
        return cmdTabId;
      }
    } catch {
      console.warn('[SplitView] Failed to parse sidebar drop data');
    }
    return null;
  }, [tabs, openCodeEditorTab]);

  // Handle sidebar item dropped on split zone
  const handleSidebarDropRight = useCallback((data: SidebarDropData) => {
    setIsDraggingSidebar(false);
    const tabId = resolveTabFromSidebarDrop(data);
    if (!tabId) return;
    setSplitTabId(tabId);
  }, [resolveTabFromSidebarDrop]);

  const handleSidebarDropLeft = useCallback((data: SidebarDropData) => {
    setIsDraggingSidebar(false);
    const tabId = resolveTabFromSidebarDrop(data);
    if (!tabId) return;
    setActiveTabId(tabId);
  }, [resolveTabFromSidebarDrop]);

  // Detect sidebar drag over content area
  const handleContentDragOver = useCallback((e: React.DragEvent) => {
    const types = e.dataTransfer.types;
    const isSidebar = types.includes('application/quack-file') ||
      types.includes('application/quack-skill') ||
      types.includes('application/quack-rule') ||
      types.includes('application/quack-command');
    if (isSidebar) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      if (!isDraggingSidebar) setIsDraggingSidebar(true);
    }
  }, [isDraggingSidebar]);

  const handleContentDragLeave = useCallback((e: React.DragEvent) => {
    // Only reset if leaving the content area entirely
    const rect = splitContainerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const { clientX: x, clientY: y } = e;
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setIsDraggingSidebar(false);
    }
  }, []);

  // Handle sidebar drop into chat zone (inserts @file or @skill mention)
  // Brain: fix-skill-drop-overlay-intercept
  const handleChatDrop = useCallback((data: SidebarDropData) => {
    setIsDraggingSidebar(false); // Always clear overlay — was after early return causing frozen UI
    if (data.mimeType === 'application/quack-file') {
      try {
        const fileData = JSON.parse(data.payload) as { name: string; path: string; isDir?: boolean };
        handleMentionFile(fileData.path, fileData.name, fileData.isDir ?? false);
      } catch { /* ignore parse errors */ }
    } else if (data.mimeType === 'application/quack-skill') {
      try {
        const skillData = JSON.parse(data.payload) as { type: string; name: string };
        if (skillData.name) {
          setPendingSkillMention({ name: skillData.name });
        }
      } catch { /* ignore parse errors */ }
    }
  }, [handleMentionFile]);

  // Handle tab popout - drag tab outside tab bar to create floating window
  const handleTabPopout = useCallback(async (tab: Tab, position: PopoutPosition) => {
    console.log('[App] Tab popout requested:', tab.id, tab.type, position);

    // Don't pop out chat tab
    if (tab.type === 'chat') {
      console.warn('[App] Cannot pop out chat tab');
      return;
    }

    // Check if already popped out
    if (isTabPoppedOut(tab.id)) {
      console.log('[App] Tab already popped out:', tab.id);
      return;
    }

    try {
      // Enrich feature-map tab with projectPath if missing (tabs created before fix)
      const enrichedTab = (tab.type === 'feature-map' && !tab.initialProjectPath && activeTerminal?.cwd)
        ? { ...tab, initialProjectPath: activeTerminal.cwd }
        : tab;

      // Create popout window
      console.log('[App] Calling popoutTab...');
      const windowLabel = await popoutTab(enrichedTab, position);
      console.log('[App] popoutTab returned:', windowLabel);

      if (windowLabel) {
        // Remove tab from main window
        setTabs(prev => prev.filter(t => t.id !== tab.id));

        // Switch to chat tab if the active tab was popped out
        if (activeTabId === tab.id) {
          setActiveTabId('chat');
        }

        console.log('[App] Tab popped out successfully:', tab.id);
      } else {
        console.warn('[App] popoutTab returned null - window creation may have failed');
      }
    } catch (error) {
      console.error('[App] Tab popout error:', error);
    }
  }, [popoutTab, isTabPoppedOut, activeTabId, activeTerminal?.cwd]);

  // Keyboard navigation for tabs (TAB key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // TAB to cycle through tabs (only when not focused in input)
      if (e.key === 'Tab' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        const target = e.target as HTMLElement;
        // Don't interfere with input/textarea focus
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
          return;
        }

        e.preventDefault();
        const currentIndex = tabs.findIndex(t => t.id === activeTabId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTabId(tabs[nextIndex].id);
      }

      // CMD/CTRL + W to close active file tab
      if (e.key === 'w' && (e.metaKey || e.ctrlKey)) {
        if (activeTabId !== 'chat' && activeTabId.startsWith('file-')) {
          e.preventDefault();
          handleTabClose(activeTabId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, handleTabClose]);

  // Update Chat tab label and color based on active terminal (agent)
  useEffect(() => {
    console.log('[Tab Update] activeTerminal:', activeTerminal);

    setTabs((prevTabs) => {
      const chatTabIndex = prevTabs.findIndex(t => t.id === 'chat');
      if (chatTabIndex === -1) return prevTabs;

      const updatedTabs = [...prevTabs];
      const chatTab = { ...updatedTabs[chatTabIndex] };

      if (activeTerminal) {
        // Update chat tab with terminal (agent) label and color
        console.log('[Tab Update] Setting tab to:', activeTerminal.label, activeTerminal.color);
        chatTab.label = activeTerminal.label;
        chatTab.color = activeTerminal.color;
      } else {
        // Reset to default "Chat" label without color
        console.log('[Tab Update] Resetting tab to Chat');
        chatTab.label = 'Chat';
        chatTab.color = undefined;
      }

      updatedTabs[chatTabIndex] = chatTab;
      return updatedTabs;
    });
  }, [activeTerminal]);

  // Switch tabs when active terminal (agent) changes
  // Brain: fix-split-tab-disappears-on-send
  // This effect handles TWO concerns:
  // 1. Tab save/restore when SWITCHING agents (activeId changes)
  // 2. Chat tab label/color update when terminal properties change (activeTerminal changes)
  //
  // CRITICAL: The full tab rebuild (setTabs with merged array) must ONLY run when
  // activeId changes. Previously it ran on every activeTerminal change, which happens
  // whenever terminal status updates (idle→busy on message send). This caused non-special
  // tabs (code-editor, file, image, feature-map) to be dropped from the tabs array,
  // breaking split view.
  useEffect(() => {
    if (!activeId) return;

    const previousId = previousActiveIdRef.current;
    const isAgentSwitch = previousId !== activeId;

    if (isAgentSwitch) {
      console.log('[Tab Switch] Active terminal changed to:', activeId, activeTerminal?.label);

      // Save current tabs for the PREVIOUS terminal (if any)
      if (previousId) {
        setTabsByTerminal((prev) => {
          const updated = new Map(prev);

          // Find file tabs (exclude chat tab)
          const fileTabs = tabs.filter(t => t.type === 'file');

          // Store tabs for the PREVIOUS terminal ID
          if (fileTabs.length > 0) {
            const previousTerminalTabs = prev.get(previousId) || [];
            if (fileTabs.length !== previousTerminalTabs.length ||
                !fileTabs.every((tab, i) => tab.id === previousTerminalTabs[i]?.id)) {
              updated.set(previousId, fileTabs);
              console.log('[Tab Switch] Saved', fileTabs.length, 'tabs for PREVIOUS terminal:', previousId);
            }
          } else if (prev.has(previousId)) {
            // If no file tabs, remove the entry for the previous terminal
            updated.delete(previousId);
            console.log('[Tab Switch] Removed tabs for PREVIOUS terminal (no file tabs):', previousId);
          }

          return updated;
        });
      }

      // Load tabs for the NEW active terminal
      const terminalTabs = tabsByTerminal.get(activeId) || [];
      console.log('[Tab Switch] Loading', terminalTabs.length, 'tabs for NEW terminal:', activeId);

      // Always include the chat tab with updated name and color, plus any file tabs for this terminal
      const chatTab: Tab = {
        id: 'chat',
        label: activeTerminal?.label || 'Chat',
        type: 'chat',
        closable: false,
        color: activeTerminal?.color
      };

      // 🦆 FIX: Preserve special tabs (kanban, docs, second-brain, memory-graph, etc.)
      // These tabs should persist across agent switches - they are not agent-specific
      // Brain: fix-office-view-snaps-back-to-chat
      const specialTabTypes = [
        'kanban', 'docs', 'second-brain', 'memory-graph', 'claude-assets',
        'agent', 'skill', 'command', 'browser-manager', 'agent-terminal',
        'office', 'automation'
      ];

      setTabs(prevTabs => {
        // Keep any special tabs that were open
        const specialTabs = prevTabs.filter(t => specialTabTypes.includes(t.type));
        const merged = [chatTab, ...terminalTabs, ...specialTabs];
        // Deduplicate by id (keep first occurrence)
        const seen = new Set<string>();
        const deduped = merged.filter(t => {
          if (seen.has(t.id)) return false;
          seen.add(t.id);
          return true;
        });
        return deduped;
      });

      // 🦆 FIX: Don't change activeTabId if user is viewing a special tab
      // This prevents the "tab closes immediately" bug when opening Kanban
      const isSpecialTabActive = specialTabTypes.some(type =>
        activeTabId.includes(type) || activeTabId === 'kanban-board'
      );

      if (!isSpecialTabActive) {
        // If we have file tabs, keep the current active tab if it exists, otherwise activate first file tab
        if (terminalTabs.length > 0) {
          const activeTabExists = ['chat', ...terminalTabs.map(t => t.id)].includes(activeTabId);
          if (!activeTabExists) {
            setActiveTabId(terminalTabs[0].id);
          }
        } else {
          // No file tabs, activate chat
          setActiveTabId('chat');
        }
      }

      // Update the ref to track this terminal as the "previous" for next switch
      previousActiveIdRef.current = activeId;
    } else {
      // NOT an agent switch — only update chat tab label/color (terminal renamed, etc.)
      setTabs(prevTabs => prevTabs.map(t =>
        t.id === 'chat'
          ? { ...t, label: activeTerminal?.label || 'Chat', color: activeTerminal?.color }
          : t
      ));
    }
  }, [activeId, activeTerminal]);

  const handleRefreshPreview = useCallback(async () => {
    if (!tauriAvailable || !previewFile) {
      return;
    }
    setPreviewError(null);
    setLoadingPreview(true);
    try {
      // Check if file is an image
      const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
      const isImage = imageExtensions.some(ext => previewFile.name.toLowerCase().endsWith(ext));

      if (isImage) {
        // Reload image as base64
        const base64Data = await invoke<string>("read_file_preview", {
          path: previewFile.path,
        });

        // Detect MIME type from extension
        const ext = previewFile.name.toLowerCase().split('.').pop() || 'png';
        const mimeTypes: Record<string, string> = {
          'png': 'image/png',
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'gif': 'image/gif',
          'bmp': 'image/bmp',
          'webp': 'image/webp',
          'svg': 'image/svg+xml',
          'ico': 'image/x-icon',
          'tiff': 'image/tiff',
          'tif': 'image/tiff',
        };
        const mimeType = mimeTypes[ext] || 'image/png';

        setPreviewImageData(`data:${mimeType};base64,${base64Data}`);
      } else {
        const content = await invoke<string>("read_file_content", {
          path: previewFile.path,
        });
        setPreviewContent(content);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreviewError(message);
    } finally {
      setLoadingPreview(false);
    }
  }, [previewFile, tauriAvailable]);

  const handleFormatPreview = useCallback(async () => {
    if (!tauriAvailable || !previewFile) {
      return;
    }

    const extension = previewFile.name.split(".").pop()?.toLowerCase() ?? "";
    const parser = (() => {
      if (["ts", "tsx"].includes(extension)) {
        return "typescript";
      }
      if (["js", "jsx", "mjs", "cjs"].includes(extension)) {
        return "babel";
      }
      if (extension === "json") {
        return "json";
      }
      if (["css", "scss", "less"].includes(extension)) {
        return "css";
      }
      if (["html", "htm"].includes(extension)) {
        return "html";
      }
      if (["md", "mdx", "markdown"].includes(extension)) {
        return "markdown";
      }
      return null;
    })();

    if (!parser) {
      setPreviewError("Formatting not available for this file type.");
      return;
    }

    setFormattingPreview(true);
    setPreviewError(null);
    try {
      const prettier = await import("prettier/standalone");
      const [babel, typescript, html, postcss, markdown] = await Promise.all([
        import("prettier/plugins/babel"),
        import("prettier/plugins/typescript"),
        import("prettier/plugins/html"),
        import("prettier/plugins/postcss"),
        import("prettier/plugins/markdown"),
      ]);

      const plugins = [
        babel.default,
        typescript.default,
        html.default,
        postcss.default,
        markdown.default,
      ].filter(Boolean);

      const formatted = await prettier.format(previewContent, {
        parser,
        plugins,
      });

      setPreviewContent(formatted);
      await invoke("write_file_content", {
        path: previewFile.path,
        content: formatted,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPreviewError(message);
    } finally {
      setFormattingPreview(false);
    }
  }, [previewContent, previewFile, tauriAvailable]);

  const handleSaveFile = useCallback(
    async (content: string) => {
      if (!tauriAvailable || !previewFile) {
        return;
      }
      setPreviewError(null);
      try {
        await invoke("write_file_content", { path: previewFile.path, content });
        setPreviewContent(content);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setPreviewError(message);
      }
    },
    [previewFile, tauriAvailable]
  );

  const handleClosePreview = useCallback(() => {
    setPreviewFile(null);
    setPreviewContent("");
    setPreviewError(null);
    setPreviewDiffInfo(null);
    setLoadingPreview(false);
    setFormattingPreview(false);
  }, []);

  const handleExecuteAICommand = useCallback(
    async (command: string, label: string, terminalId?: string) => {
      if (!tauriAvailable) {
        return;
      }
      // Use provided terminalId or fallback to activeId
      const targetId = terminalId || activeId;
      if (!targetId) {
        console.warn('No terminal ID available for command execution');
        return;
      }
      try {
        await invoke("write_to_terminal", {
          id: targetId,
          data: command + "\n",
        });
        console.log(`AI command executed: ${label} -> ${command} in terminal ${targetId}`);
      } catch (error) {
        console.error("Error executing AI command", error);
      }
    },
    [activeId, tauriAvailable]
  );

  const handleLaunchSavedCommand = useCallback(
    async (
      command: SavedCommand,
      options?: { launchImmediately?: boolean }
    ) => {
      if (!tauriAvailable) {
        return;
      }

      try {
        let targetTerminalId = activeId;
        if (!targetTerminalId || options?.launchImmediately) {
          const result = await invoke<TerminalInfo>("create_terminal", {
            label: command.name,
            color: command.color,
            cwd: command.cwd ?? null,
            commandOrigin: command.command,
          });
          const terminalWithState: TerminalInfo = {
            ...result,
            status: "busy",
            needsAttention: false,
            hasResponded: false,
            responseStartTime: Date.now(),
          };
          setTerminals((prev) => [...prev, terminalWithState]);
          targetTerminalId = terminalWithState.id;
          setActiveId(targetTerminalId);

          // Add to active-agents.json index (file-based persistence)
          if (command.cwd) {
            void addActiveAgent(command.cwd, terminalWithState.id);
          }
        }

        if (targetTerminalId) {
          await invoke("write_to_terminal", {
            id: targetTerminalId,
            data: `${command.command}\n`,
          });
          markTerminalBusy(targetTerminalId);
        }
      } catch (error) {
        console.error("Unable to launch saved command", error);
      }
    },
    [activeId, markTerminalBusy, tauriAvailable]
  );

  // Create an agent terminal tab and execute a command in it
  const handleCreateTerminalWithCommand = useCallback(
    async (label: string, command: string, cwd?: string) => {
      if (!tauriAvailable || !activeId) {
        return;
      }

      try {
        // Get current agent info
        const currentAgent = terminals.find(t => t.id === activeId);
        const terminalCwd = cwd || currentAgent?.cwd || explorerPath || process.env.HOME || "~";

        // Create backend terminal (PTY)
        const created = await invoke<TerminalInfo>("create_terminal", {
          label,
          color: currentAgent?.color || TERMINAL_COLORS[0],
          cwd: terminalCwd,
        });

        // Create AgentTerminal entry (associated with active agent)
        const newAgentTerminal: AgentTerminal = {
          id: created.id,
          name: label,
          projectPath: terminalCwd, // Associate with project path
          color: currentAgent?.color || TERMINAL_COLORS[0],
          cwd: terminalCwd,
          alive: true,
          status: "busy",
          createdAt: Date.now(),
        };

        // Add to agentTerminals state
        setAgentTerminals(prev => [...prev, newAgentTerminal]);

        // Create agent terminal tab
        const agentTerminalTab: Tab = {
          id: `agent-terminal-${created.id}`,
          label,
          type: 'agent-terminal',
          closable: true,
          color: currentAgent?.color || TERMINAL_COLORS[0],
          terminalId: created.id,
          // icon removed - rendered directly in TabBar to avoid React serialization issues
        };

        setTabs((prevTabs) => [...prevTabs, agentTerminalTab]);
        setActiveTabId(agentTerminalTab.id);

        // Add to tabsByTerminal for the active agent
        setTabsByTerminal((prev) => {
          const updated = new Map(prev);
          const currentTabs = updated.get(activeId) || [];
          updated.set(activeId, [...currentTabs, agentTerminalTab]);
          return updated;
        });

        // Execute command in the new terminal
        await invoke("write_to_terminal", {
          id: created.id,
          data: `${command}\n`,
        });

        console.log(`Created agent terminal "${label}" and executed: ${command}`);
      } catch (error) {
        console.error("Unable to create terminal with command", error);
        toast.error("Failed to create terminal");
      }
    },
    [tauriAvailable, activeId, terminals, explorerPath]
  );

  const refreshGitSummary = useCallback(async () => {
    if (!tauriAvailable) {
      return;
    }
    setLoadingGit(true);
    setGitError(null);
    setHistoryError(null);

    try {
      // 🦆 BRANCH-PER-SESSION: Use session's worktreePath if available
      const activeSession = activeSessionId
        ? useSessionStore.getState().sessions.find(s => s.id === activeSessionId)
        : null;
      const rootPath = activeSession?.worktreePath || activeTerminal?.cwd || explorerPath || undefined;
      const [statusResult, historyResult] = await Promise.allSettled([
        invoke<GitStatusSummary>("git_status_summary", { rootPath }),
        invoke<GitCommitEntry[]>("git_commit_history", { limit: 50, branchName: null, rootPath, all: true }),
      ]);

      if (statusResult.status === "fulfilled") {
        const result = statusResult.value;
        setGitSummary(result);
        setGitError(null);
        setSelectedGitPath((previous) => {
          if (result.entries.length === 0) {
            return null;
          }
          if (
            previous &&
            result.entries.some((entry) => entry.path === previous)
          ) {
            return previous;
          }
          return result.entries[0].path;
        });
      } else {
        const reason = statusResult.reason;
        const message =
          reason instanceof Error ? reason.message : String(reason);
        setGitError(message);
        setGitSummary(null);
        setSelectedGitPath(null);
      }

      if (historyResult.status === "fulfilled") {
        setCommitHistory(historyResult.value);
        setHistoryError(null);
      } else {
        const reason = historyResult.reason;
        const message =
          reason instanceof Error ? reason.message : String(reason);
        setCommitHistory([]);
        setHistoryError(message);
      }
    } finally {
      setLoadingGit(false);
    }
  }, [activeTerminal, explorerPath, tauriAvailable, activeSessionId]);

  useEffect(() => {
    if (showGitDrawer) {
      void refreshGitSummary();
    }
  }, [refreshGitSummary, showGitDrawer]);

  // 🦆 BRANCH-PER-SESSION: Refresh git panel when active session changes
  useEffect(() => {
    if (activeSessionId && showGitDrawer) {
      void refreshGitSummary();
    }
  }, [activeSessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load git status on startup only (not on every terminal switch!)
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }
    void refreshGitSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tauriAvailable, hasBootstrapped]); // Intentionally NOT including refreshGitSummary to prevent re-load on every switch

  // Refresh git history when active agent changes (Changes panel always visible)
  // This ensures the History tab shows commits from the current project, not quack-app
  useEffect(() => {
    if (activeId && tauriAvailable && hasBootstrapped) {
      void refreshGitSummary();
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectGitEntry = useCallback((entry: GitStatusEntry) => {
    setSelectedGitPath(entry.path);
    setEditSummaryDiffEntry(null); // Clear synthetic entry when selecting from git panel
    if (entry.unstaged_status || entry.is_untracked) {
      setDiffView("worktree");
    } else if (entry.staged_status) {
      setDiffView("staged");
    }
    // Open diff drawer when file is selected
    setShowDiffDrawer(true);
  }, []);

  const handleOpenFileFromGit = useCallback(
    (relativePath: string) => {
      if (!explorerRoot) {
        return;
      }

      // Convert relative path to absolute path
      const fullPath = `${explorerRoot}/${relativePath}`.replace(/\/+/g, "/");

      // Extract file name
      const fileName = relativePath.split("/").pop() || relativePath;

      // Create a fake DirectoryEntry to open the file
      const fakeEntry: DirectoryEntry = {
        name: fileName,
        path: fullPath,
        is_dir: false,
        is_symlink: false,
      };

      // Use the same logic as handleOpenFilePreview
      void handleOpenFilePreview(fakeEntry);
    },
    [explorerRoot, handleOpenFilePreview]
  );

  // Handler to open .mcp.json file - opens in external IDE if available
  const handleOpenMcpConfig = useCallback(
    (filePath: string) => {
      // Open in external IDE only if user prefers it
      const { fileOpenTarget } = useIDEStore.getState();
      if (fileOpenTarget === 'external') {
        void tryOpenInIDE(filePath);
        return;
      }

      // Open in internal editor (default)
      const fileName = filePath.split('/').pop() || '.mcp.json';
      const fakeEntry: DirectoryEntry = {
        name: fileName,
        path: filePath,
        is_dir: false,
        is_symlink: false,
      };
      void handleOpenFilePreview(fakeEntry);
    },
    [handleOpenFilePreview]
  );

  // Handler to open Terminal Window for a specific repository
  const handleOpenTerminalWindowForRepo = useCallback(
    async (repoPath: string, repoName: string) => {
      try {
        // Get all existing projects from activeProjects (same pattern as Terminals button)
        const projects = activeProjects.map(project => ({
          path: project.path,
          name: project.name,
        }));

        // Add the clicked project if not already in list
        const clickedProject = { name: repoName, path: repoPath };
        const allProjects = [...projects, clickedProject];

        // Remove duplicates by path
        const uniqueProjects = allProjects.filter(
          (p, i, arr) => arr.findIndex(x => x.path === p.path) === i
        );

        // Open terminal window with all projects and create a terminal in the clicked project
        await openTerminalWindow(uniqueProjects, {
          projectPath: repoPath,
          command: '', // Empty command just opens a new terminal
          terminalLabel: `Terminal - ${repoName}`,
        });
      } catch (error) {
        console.error('Failed to open terminal window:', error);
        toast.error('Failed to open terminal window');
      }
    },
    [activeProjects, openTerminalWindow]
  );

  const handleStageEntry = useCallback(
    async (entry: GitStatusEntry) => {
      if (!tauriAvailable) {
        return;
      }
      setGitError(null);
      try {
        const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
        await invoke("git_stage", { path: entry.path, rootPath });
        await refreshGitSummary();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setGitError(message);
      }
    },
    [activeTerminal, explorerPath, refreshGitSummary, tauriAvailable]
  );

  const handleUnstageEntry = useCallback(
    async (entry: GitStatusEntry) => {
      if (!tauriAvailable) {
        return;
      }
      setGitError(null);
      try {
        const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
        await invoke("git_unstage", { path: entry.path, rootPath });
        await refreshGitSummary();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setGitError(message);
      }
    },
    [activeTerminal, explorerPath, refreshGitSummary, tauriAvailable]
  );

  const handleStageAll = useCallback(async () => {
    if (!tauriAvailable || !gitSummary) {
      return;
    }
    setGitError(null);
    try {
      const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;

      // Stage all unstaged files
      const unstagedFiles = gitSummary.entries.filter(
        (entry) => entry.unstaged_status || entry.is_untracked
      );

      for (const entry of unstagedFiles) {
        await invoke("git_stage", { path: entry.path, rootPath });
      }

      await refreshGitSummary();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitError(message);
    }
  }, [
    activeTerminal,
    explorerPath,
    gitSummary,
    refreshGitSummary,
    tauriAvailable,
  ]);

  const handleCommit = useCallback(async () => {
    if (!tauriAvailable || commitMessage.trim().length === 0) {
      return;
    }
    setCommitting(true);
    setGitError(null);
    try {
      const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
      await invoke("git_commit", { message: commitMessage, rootPath });
      setCommitMessage("");
      await refreshGitSummary();
      // Trigger badge refresh in RepositoryGroup
      setGitRefreshTrigger(prev => prev + 1);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setGitError(message);
    } finally {
      setCommitting(false);
    }
  }, [
    activeTerminal,
    commitMessage,
    explorerPath,
    refreshGitSummary,
    tauriAvailable,
  ]);

  const handleGenerateCommitMessage = useCallback(async () => {
    if (!tauriAvailable || !gitSummary) {
      return;
    }

    try {
      // Get diff of all staged files
      const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
      const stagedEntries = gitSummary.entries.filter(e => e.staged_status);

      if (stagedEntries.length === 0) {
        return;
      }

      // Get diffs for all staged files
      const diffs = await Promise.all(
        stagedEntries.map(async (entry) => {
          try {
            const diff = await invoke<string>("git_diff", {
              path: entry.path,
              rootPath,
              staged: true,
            });
            return `File: ${entry.path}\n${diff}`;
          } catch (error) {
            return `File: ${entry.path}\n(Failed to get diff)`;
          }
        })
      );

      const fullDiff = diffs.join("\n\n");

      // Build AI prompt with git diff
      const stagedFilesList = stagedEntries.map(e => `- ${e.path} (${e.staged_status})`).join('\n');

      const aiPrompt = `I need you to analyze these staged git changes and help me commit them.

**Staged files:**
${stagedFilesList}

**Git diff:**
\`\`\`diff
${fullDiff}
\`\`\`

Please:
1. Analyze the changes and suggest a clear, concise commit message following conventional commit format (feat/fix/docs/style/refactor/test/chore)
2. After I approve the message, you can commit the changes using the Bash tool with: \`git commit -m "your message"\`
3. Optionally, ask if I want to push the changes as well

Start by suggesting the commit message.`;

      // Check if "git-manager" agent already exists
      let gitManagerAgent = agents.find(a => a.name === "git-manager");

      // If not exists, create it
      if (!gitManagerAgent) {
        const agentContent = `# Git Manager Agent

You are a specialized Git operations manager. Your role is to:

1. **Analyze Git diffs** and suggest clear, concise commit messages
2. **Follow conventional commit format** (feat/fix/docs/style/refactor/test/chore)
3. **Execute git operations** using the Bash tool when approved
4. **Suggest git best practices** for commits and version control

When analyzing changes:
- Focus on the "why" rather than the "what"
- Keep commit messages concise but descriptive
- Group related changes logically
- Suggest breaking up large commits if needed

You have access to all Bash tools to execute git commands like:
- \`git commit -m "message"\`
- \`git push\`
- \`git log\`
- etc.`;

        await invoke<string>("create_agent", {
          name: "git-manager",
          description: "Specialized agent for Git operations, commit message generation, and version control best practices",
          model: "sonnet",
          color: "#10b981", // Green color for git
          content: agentContent,
          scope: "project",
          workingDir: rootPath,
        });

        // Reload agents list
        await loadAgents();

        // Find the newly created agent
        // Note: we need to wait a bit for the agents list to update
        await new Promise(resolve => setTimeout(resolve, 500));
        const updatedAgents = await invoke<AgentInfo[]>("list_agents", {
          workingDir: rootPath
        });
        gitManagerAgent = updatedAgents.find(a => a.name === "git-manager");

        if (!gitManagerAgent) {
          throw new Error("Failed to create git-manager agent");
        }

        toast.success("Git Manager agent created!", {
          description: "Opening chat with git-manager...",
          duration: 2000,
        });
      }

      // Close Git drawer
      setShowGitDrawer(false);

      // Set the Git Manager agent as active agent for the next message
      setActiveAgent(gitManagerAgent);

      // Wait a bit for state to update
      await new Promise(resolve => setTimeout(resolve, 100));

      // Send the prompt with the Git Manager agent active
      // This will use the current chat session with git-manager agent
      await sendMessageForAgent(aiPrompt);

      // Show success toast
      toast.success("Git analysis started", {
        description: "git-manager agent is analyzing your changes...",
        duration: 3000,
      });

    } catch (error) {
      console.error("Error generating commit message:", error);
      setGitError(error instanceof Error ? error.message : String(error));
      toast.error("Failed to create Git Manager agent", {
        description: error instanceof Error ? error.message : String(error),
        duration: 4000,
      });
    }
  }, [tauriAvailable, gitSummary, activeTerminal, explorerPath, agents, sendMessageForAgent, loadAgents]);

  const handleDiffViewChange = useCallback((view: "worktree" | "staged") => {
    setDiffView(view);
  }, []);

  // Session handlers
  const handleSelectSession = useCallback((session: SessionInfo) => {
    setSelectedSession(session);
    setSessionDetailsDrawerOpen(true);
  }, []);

  const handleSessionIdClick = useCallback(async (sessionId: string) => {
    // Load session details and open drawer
    try {
      const sessionDetails = await invoke<SessionInfo>('get_session_details', { sessionId });
      setSelectedSession(sessionDetails);
      setSessionDetailsDrawerOpen(true);
    } catch (error) {
      console.error('[handleSessionIdClick] Failed to load session:', error);
      toast.error('Failed to load session details');
    }
  }, []);

  // ⏪ File Checkpointing: Rewind files to before a specific message (SDK 0.2.7+)
  const handleRewindFiles = useCallback(async (userMessageId: string) => {
    // Get the current session ID (Claude Code session, not internal session)
    const isTaskChat = activeTaskId && activeTabId === 'agent-chat';
    let sessionId: string | undefined;

    if (isTaskChat) {
      const activeTaskSession = agentSessions.find(s => s.id === activeTaskId);
      sessionId = activeTaskSession?.claudeSessionId;
    } else {
      const session = agentSessions.find(s => s.id === activeSessionId);
      sessionId = session?.claudeSessionId;
    }

    if (!sessionId) {
      toast.error('No active session found');
      return;
    }

    // Show confirmation dialog
    const confirmed = await confirm(
      'This will revert all file changes made after this message. This action cannot be undone.',
      {
        title: 'Rewind Files',
        kind: 'warning',
        okLabel: 'Rewind',
        cancelLabel: 'Cancel',
      }
    );

    if (!confirmed) {
      return;
    }

    try {
      toast.loading('Rewinding files...', { id: 'rewind-files' });
      const { rewindFiles } = await import('./services/claudeSDK');
      const result = await rewindFiles(sessionId, userMessageId);

      if (result.success) {
        toast.success('Files rewound successfully', {
          id: 'rewind-files',
          description: 'File changes have been reverted',
        });
      } else {
        toast.error('Failed to rewind files', {
          id: 'rewind-files',
          description: result.error || 'Unknown error',
        });
      }
    } catch (error) {
      console.error('[handleRewindFiles] Failed:', error);
      toast.error('Failed to rewind files', {
        id: 'rewind-files',
        description: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }, [activeTaskId, activeTabId, agentSessions, activeSessionId]);

  const handleResumeSession = useCallback(async (sessionId: string) => {
    if (!tauriAvailable || creatingTerminal) {
      return;
    }

    setCreatingTerminal(true);

    try {
      // 1. Load complete session data from backend
      console.log('[Resume] Loading session:', sessionId);
      const sessionDetails = await invoke<{
        id: string;
        title: string;
        created_at: number;
        updated_at: number;
        message_count: number;
        total_tokens: number;
        total_cost: number;
        status: string;
        working_directory: string | null;
        model: string | null;
        agent_name: string | null;
        messages: Array<{ role: string; content: string; timestamp: number | null }>;
        usage: {
          input_tokens: number;
          output_tokens: number;
          cache_creation_input_tokens: number;
          cache_read_input_tokens: number;
        };
      }>('resume_session', { sessionId });

      console.log('[Resume] Session details loaded:', sessionDetails);

      // 2. Determine working directory
      const workingDirectory = sessionDetails.working_directory || explorerPath || await invoke<string>('get_home_directory');
      const resumeTitle = sessionDetails.title || 'Session';
      const terminalName = `Resumed: ${resumeTitle.substring(0, 40)}${resumeTitle.length > 40 ? '...' : ''}`;

      // 3. Create new terminal for the resumed session
      console.log('[Resume] Creating terminal:', terminalName, 'cwd:', workingDirectory);
      const created = await invoke<TerminalInfo>('create_terminal', {
        label: terminalName,
        color: TERMINAL_COLORS[terminals.length % TERMINAL_COLORS.length],
        cwd: workingDirectory,
        workingOn: null,
        avatar: '68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg', // Default duck avatar
        branch: null,
      });

      const createdWithState: TerminalInfo = {
        ...created,
        status: 'idle',
        needsAttention: false,
        hasResponded: false,
        responseStartTime: null,
        workingOn: undefined,
        avatar: '68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg',
        branch: undefined,
      };

      console.log('[Resume] Terminal created:', createdWithState.id);

      // 4. Convert SessionHistoryMessage[] to ChatMessage[]
      const chatMessages: ChatMessage[] = sessionDetails.messages.map((msg, index) => ({
        id: `msg-resumed-${index}`,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.timestamp || sessionDetails.created_at + (index * 1000),
        status: 'complete' as const,
      }));

      console.log('[Resume] Converted', chatMessages.length, 'messages');

      // 5. Add terminal to state
      setTerminals((prev) => [...prev, createdWithState]);
      setActiveId(createdWithState.id);
      clearTerminalAttention(createdWithState.id);

      // Add to active-agents.json index (file-based persistence)
      void addActiveAgent(workingDirectory, createdWithState.id);

      // 6. Load conversation history into chat
      setChatSessions((prev) => {
        const updated = new Map(prev);
        updated.set(createdWithState.id, chatMessages);
        return updated;
      });

      // ✅ CRITICAL FIX: Preserve session ID so next message continues the conversation
      setChatSessionIds((prev) => {
        const updated = new Map(prev);
        updated.set(createdWithState.id, sessionId);
        return updated;
      });

      // 🦆 SESSION PERSISTENCE: Save session ID in AgentChat for persistence across app restarts
      setAgentChats((prev) => {
        return prev.map((agent) => {
          if (agent.id === createdWithState.id) {
            return {
              ...agent,
              sessionId: sessionId,
            };
          }
          return agent;
        });
      });

      console.log('[Resume] Session ID preserved:', sessionId);

      // 7. Set token usage if available
      setChatTokensMap((prev) => {
        const updated = new Map(prev);
        updated.set(createdWithState.id, {
          inputTokens: sessionDetails.usage.input_tokens,
          outputTokens: sessionDetails.usage.output_tokens,
          cacheCreationTokens: sessionDetails.usage.cache_creation_input_tokens,
          cacheReadTokens: sessionDetails.usage.cache_read_input_tokens,
          totalCost: sessionDetails.total_cost ?? 0, // Restore cost from session
        });
        return updated;
      });

      // 8. Close drawer and load directory
      setSessionDetailsDrawerOpen(false);
      await loadDirectory(createdWithState.cwd);

      // 9. Switch to chat tab
      setActiveTabId('chat');

      toast.success(`Resumed session: ${sessionDetails.title}`, {
        description: `Loaded ${chatMessages.length} messages`,
        duration: 3000,
      });

      console.log('[Resume] Session resumed successfully');
    } catch (error) {
      console.error('[Resume] Failed to resume session:', error);
      const message = error instanceof Error ? error.message : String(error);
      toast.error('Failed to resume session', {
        description: message,
        duration: 4000,
      });
    } finally {
      setCreatingTerminal(false);
    }
  }, [tauriAvailable, creatingTerminal, terminals.length, explorerPath, clearTerminalAttention, loadDirectory]);

  const handleDeleteSession = useCallback(async (_sessionId: string) => {
    // Toast messages are handled by SessionDetailsDrawer
    // Just update UI state here
    setSessionDetailsDrawerOpen(false);
    setSelectedSession(null);
    setSessionsRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    const timers = idleTimersRef.current;
    const visualTimers = visualIdleTimersRef.current;
    const notificationTimers = notificationTimersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
      // Anti-flickering: cleanup visual idle timers
      visualTimers.forEach((timer) => clearTimeout(timer));
      visualTimers.clear();
      // Cleanup notification timers
      notificationTimers.forEach((timer) => clearTimeout(timer));
      notificationTimers.clear();
    };
  }, []);

  useEffect(() => {
    if (!selectedGitEntry) {
      setDiffContent("");
      setDiffError(null);
      return;
    }
    if (diffView === "staged" && !selectedGitEntry.staged_status) {
      if (selectedGitEntry.unstaged_status || selectedGitEntry.is_untracked) {
        setDiffView("worktree");
      }
    } else if (
      diffView === "worktree" &&
      !(selectedGitEntry.unstaged_status || selectedGitEntry.is_untracked)
    ) {
      if (selectedGitEntry.staged_status) {
        setDiffView("staged");
      }
    }
  }, [diffView, selectedGitEntry]);

  useEffect(() => {
    if (!tauriAvailable || !showGitDrawer) {
      return;
    }
    if (!selectedGitEntry) {
      return;
    }
    const showStaged = diffView === "staged";
    if (showStaged && !selectedGitEntry.staged_status) {
      setDiffContent("No differences in staging.");
      setDiffError(null);
      return;
    }
    if (
      !showStaged &&
      !(selectedGitEntry.unstaged_status || selectedGitEntry.is_untracked)
    ) {
      setDiffContent("No differences in working tree.");
      setDiffError(null);
      return;
    }

    let cancelled = false;
    const fetchDiff = async () => {
      setDiffLoading(true);
      setDiffError(null);
      try {
        const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
        const diff = await invoke<string>("git_diff", {
          path: selectedGitEntry.path,
          staged: showStaged,
          untracked: selectedGitEntry.is_untracked,
          rootPath,
        });
        if (!cancelled) {
          setDiffContent(diff);
        }
      } catch (error) {
        if (!cancelled) {
          const message =
            error instanceof Error ? error.message : String(error);
          setDiffError(message);
          setDiffContent("");
        }
      } finally {
        if (!cancelled) {
          setDiffLoading(false);
        }
      }
    };

    void fetchDiff();

    return () => {
      cancelled = true;
    };
  }, [
    activeTerminal,
    diffView,
    explorerPath,
    selectedGitEntry,
    showGitDrawer,
    tauriAvailable,
  ]);

  // Splash screen removed - app loads directly with smooth CSS transition
  // The #root element in index.html has a smooth reveal animation
  // The HTML duck parade loader (#app-loader) stays visible until agents load

  // While booting, render nothing - the HTML loader (#app-loader) is already visible
  // This prevents flickering caused by showing a React spinner on top of the HTML loader
  if (booting) {
    return null;
  }

  if (!tauriAvailable) {
    return (
      <div className="app-fallback">
        <div className="fallback-card">
          <h1>Quack</h1>
          <p>
            This interface requires Tauri desktop environment to manage
            terminals and the file explorer.
          </p>
          <p>
            Launch the app with:
            <code>npm run tauri:dev</code>
          </p>
          <p>
            Close the browser tab and use the desktop window launched by the
            command.
          </p>
        </div>
      </div>
    );
  }

  // If we're in the preview-webview, don't render anything
  // The preview window should only show the external URL content
  if (isPreviewWebview) {
    return null;
  }

  return (
    <>


      {/* Drag region removed - now using data-tauri-drag-region on sidebar-header only */}

      {/* 🔐 Claude Auth Banner - Disabled for now */}
      {/* TODO: Re-enable when auth flow is properly implemented */}
      {false && showSidebar && claudeCliAvailable === false && !claudeAuthBannerDismissed && (
        <ClaudeAuthBanner
          onOpenSettings={() => {
            setShowSettings(true);
            // Auto-navigate to AI Assistant section if possible
          }}
          onDismiss={() => setClaudeAuthBannerDismissed(true)}
          dismissible={true}
          isExpanded={claudeAuthBannerExpanded}
          onToggle={() => setClaudeAuthBannerExpanded(!claudeAuthBannerExpanded)}
        />
      )}

      {/* ProBanner removed — Quack is free forever */}

      <div
        ref={appShellRef}
        className={`app-shell ${sidePanelCollapsed || (!activeId && !isKanbanTabActive && !isOfficeTabActive && !isFeatureMapTabActive) || activeTabId.startsWith('docs-') || activeTabId.startsWith('second-brain-') || activeTabId.startsWith('memory-graph-') || activeTabId.startsWith('claude-assets-') || activeTabId.startsWith('project-dashboard-') || (isKanbanTabActive && !kanbanSidePanelExpanded) || isOfficeTabActive || isFeatureMapTabActive ? 'side-panel-collapsed' : ''} ${terminals.length === 0 && persistedProjects.size === 0 ? 'no-agents sidebar-hidden' : ''} ${isKanbanTabActive ? 'kanban-mode' : ''} ${isOfficeTabActive || isFeatureMapTabActive ? 'office-mode' : ''} ${isChatFullscreen ? 'chat-fullscreen' : ''}`}
        style={{ gridTemplateColumns }}
      >
        {/* Hide sidebar when no projects/agents */}
        {(terminals.length > 0 || persistedProjects.size > 0) && <TerminalSidebar
          terminals={terminals}
          activeId={activeId}
          creating={creatingTerminal}
          collapsedGroups={collapsedGroups}
          // AgentChats for UI grouping (optional)
          agentChats={agentChats}
          activeAgentChatId={activeAgentChatId}
          onSelectAgentChat={(chatId) => {
            console.log('[onSelectAgentChat] Called with chatId:', chatId);
            console.log('[onSelectAgentChat] Available agentChats:', agentChats);
            setActiveAgentChatId(chatId);
          }}
          onDeleteAgentChat={async (chatId) => {
            // Brain: fix-memory-leak-14gb-ram
            // Centralized cleanup: removes ALL data from every Map/Ref for this agent
            cleanupAgentData(chatId);
            setAgentChats(prev => prev.filter(chat => chat.id !== chatId));
            if (activeAgentChatId === chatId) {
              setActiveAgentChatId(null);
            }
            console.log(`[onDeleteAgentChat] Cleaned up all data for agent: ${chatId}`);
          }}
          onUpdateAgentChat={(chatId, updates) => {
            setAgentChats(prev => prev.map(chat =>
              chat.id === chatId ? { ...chat, ...updates } : chat
            ));
          }}
          onCreateAgent={handleOpenNewTerminalModal}
          // PiP props
          onTogglePip={togglePipWindow}
          isPipOpen={isPipOpen}
          // Kanban View props
          isKanbanTabActive={isKanbanTabActive}
          onOpenKanbanTab={handleOpenKanbanTab}
          inProgressTaskCount={inProgressTaskCount}
          // Quack sound props
          onToggleQuackSound={toggleQuackSound}
          quackSoundEnabled={quackSoundEnabled}
          // Chat sessions
          chatSessions={chatSessions}
          lastReadTimestamps={lastReadTimestamps}
          chatLoadingMap={chatLoadingMap}
          // Terminal props
          onAdd={handleOpenNewTerminalModal}
          onSelect={handleSelectTerminal}
          onClose={handleCloseTerminal}
          onColorChange={handleColorChange}
          onEdit={handleEditTerminal}
          onDuplicate={handleDuplicateTerminal}
          onReset={handleResetTerminal}
          onToggleGroup={handleToggleGroup}
          onReorder={handleReorderTerminals}
          onOpenSettings={() => setShowSettings(true)}
          onOpenGitPanel={handleOpenGitDrawer}
          onOpenTerminalWindow={handleOpenTerminalWindowForRepo}
          onOpenBrain={handleOpenBrainWindow}
          onOpenDashboard={handleOpenProjectDashboard}
          onOpenClaudeAssets={openClaudeAssetsTab}
          onRemoveProject={handleRemoveProject}
          persistedProjects={persistedProjects}
          // onCreateTask={handleCreateTaskFromAgent} // Temporarily hidden
          // Session props
          onSessionClick={handleSessionClick}
          activeSessionId={activeSessionId ?? undefined}
          onActiveSessionDone={() => {
            // Navigate back to agent overview when active session is marked as done
            setActiveSessionId(null);
            setActiveTaskId(null);
          }}
          // Open Agent Personality accordion
          onOpenPersonality={() => {
            console.log('[App] onOpenPersonality from sidebar clicked');
            if (sidePanelCollapsed) {
              setSidePanelCollapsed(false);
              setTimeout(() => {
                setForceExpandSection('agent-context');
              }, 50);
            } else {
              setForceExpandSection('agent-context');
            }
          }}
          // Kanban button is now built into TerminalSidebar
          gitRefreshTrigger={gitRefreshTrigger}
          // Saved Commands
          onOpenSavedCommands={() => {
            setSavedCommandsFilterProject(null);
            setSavedCommandsDrawerOpen(true);
          }}
          onOpenProjectSavedCommands={(projectPath) => {
            setSavedCommandsFilterProject(projectPath);
            setSavedCommandsDrawerOpen(true);
          }}
          currentProjectPath={currentProjectPath}
        />}

        {/* Terminal pane - show video background when no terminals, otherwise show chat */}
        <section className={`terminal-pane ${activeTabId.startsWith('docs-') || activeTabId.startsWith('second-brain-') || activeTabId.startsWith('memory-graph-') || activeTabId.startsWith('claude-assets-') || activeTabId.startsWith('project-dashboard-') || isOfficeTabActive || isFeatureMapTabActive ? 'full-width-tab' : ''}`}>
          {terminals.length === 0 && persistedProjects.size === 0 ? (
            /* Empty state when no projects at all - show image or guide */
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Drag region for empty state - sidebar is hidden so we need a draggable area */}
              <div
                data-tauri-drag-region
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '40px',
                  zIndex: 10,
                  // Brain: gotcha-window-confirm-tauri-webview
                }}
              />
              {/* Guide Viewer - shown when emptyStateShowGuide is true */}
              {emptyStateShowGuide ? (
                <div style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--bg-primary, #121216)',
                }}>
                  {/* Header with back button */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    background: 'rgba(18, 18, 22, 0.95)',
                  }}>
                    <button
                      type="button"
                      onClick={() => setEmptyStateShowGuide(false)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        fontSize: '13px',
                        fontWeight: 500,
                        borderRadius: '6px',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'rgba(255, 255, 255, 0.7)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 12H5"/>
                        <path d="M12 19l-7-7 7-7"/>
                      </svg>
                      Back
                    </button>
                    <span style={{ color: 'var(--accent-color)', fontWeight: 600, fontSize: '14px' }}>
                      Quack Guide
                    </span>
                  </div>
                  {/* Docs content */}
                  <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <DocsTabView
                      tab={{ id: 'empty-state-docs', type: 'docs', label: 'Guide', closable: false }}
                      isActive={true}
                    />
                  </div>
                </div>
              ) : (
                /* Empty state with ASCII duck - Codex-style centered layout */
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '24px',
                  textAlign: 'center',
                }}>
                  {/* ASCII Duck with morphing animation */}
                  <div className="empty-state-duck">
                    <span className="duck-frame">{'>°)>'}</span>
                    <span className="duck-frame">{'>^)>'}</span>
                    <span className="duck-frame">{'>·)>'}</span>
                    <span className="duck-frame">{'>~)>'}</span>
                    <span className="duck-frame">{'>´)>'}</span>
                  </div>

                  {/* Tagline */}
                  <p style={{
                    fontSize: '14px',
                    color: 'rgba(255, 255, 255, 0.5)',
                    margin: 0,
                    fontWeight: 400,
                  }}>
                    What will you build today?
                  </p>

                  {/* Primary action: New Project */}
                  <button
                    type="button"
                    onClick={() => handleOpenNewTerminalModal()}
                    style={{
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: 'none',
                      background: 'linear-gradient(135deg, var(--accent-color), var(--accent-gradient-end))',
                      color: 'white',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 16px rgba(var(--accent-rgb), 0.35)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(var(--accent-rgb), 0.45)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 16px rgba(var(--accent-rgb), 0.35)';
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"/>
                      <line x1="5" y1="12" x2="19" y2="12"/>
                    </svg>
                    New project
                  </button>

                  {/* Secondary links - horizontal layout */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '20px',
                    marginTop: '8px',
                  }}>
                    {/* Open Guide */}
                    <button
                      type="button"
                      onClick={() => openExternal('https://quack.build/docs')}
                      style={{
                        padding: '0',
                        fontSize: '12px',
                        fontWeight: 400,
                        border: 'none',
                        background: 'transparent',
                        color: 'rgba(255, 255, 255, 0.4)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                      </svg>
                      Guide
                    </button>

                    <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>·</span>

                    {/* Discord */}
                    <button
                      type="button"
                      onClick={() => openExternal('https://discord.gg/bQd39uDhnc')}
                      style={{
                        padding: '0',
                        fontSize: '12px',
                        fontWeight: 400,
                        border: 'none',
                        background: 'transparent',
                        color: 'rgba(255, 255, 255, 0.4)',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.7)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                      </svg>
                      Discord
                    </button>

                    <span style={{ color: 'rgba(255, 255, 255, 0.2)' }}>·</span>

                    {/* Email */}
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 400,
                        color: 'rgba(255, 255, 255, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '5px',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2"/>
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                      </svg>
                      quack@quack.build
                    </span>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Chat area when agents are active */
            <div className="terminal-container" data-main-content style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Action Icons - aligned right above tabs */}
              <ActionIcons
              projectPath={activeTerminal?.cwd ?? explorerPath}
              onGitClick={() => setShowGitDrawer(!showGitDrawer)}
              onUsageClick={() => handleCreateTerminalWithCommand("Plan Usage", "claude /usage")}
              onTelegramClick={() => setShowTelegramSetup(true)}
              onTerminalClick={handleCreateAgentTerminal}
              onBrowserClick={handleOpenBrowserTab}
              onDroidFactoryClick={() => setDroidFactoryOpen(true)}
              onMemoryGraphClick={handleOpenMemoryGraphTab}
              onClaudeAssetsClick={openClaudeAssetsTab}
              onGuideClick={handleOpenDocsTab}
              onToggleSidePanel={() => setSidePanelCollapsed(!sidePanelCollapsed)}
              sidePanelCollapsed={sidePanelCollapsed}
              terminalWindowOpen={terminalWindowOpen}
              claudeAssetsOpen={tabs.some(t => t.type === 'claude-assets' && t.id === activeTabId)}
              isAuthenticated={claudeCliAvailable !== false}
              onLoginClick={async () => {
                try {
                  const cwd = activeTerminal?.cwd ?? explorerPath ?? process.env.HOME ?? "~";
                  const projects = activeProjects.map(project => ({
                    path: project.path,
                    name: project.name,
                  }));
                  await openTerminalWindow(projects, {
                    projectPath: cwd,
                    command: 'claude /login',
                    terminalLabel: 'Claude Login',
                  });
                } catch (error) {
                  console.error("Failed to open claude login:", error);
                }
              }}
              onKanbanClick={handleOpenKanbanTab}
              isKanbanActive={tabs.some(t => t.type === 'kanban' && t.id === activeTabId)}
              inProgressTaskCount={inProgressTaskCount}
              onAutomationClick={handleOpenAutomationTab}
              isAutomationActive={tabs.some(t => t.type === 'automation' && t.id === activeTabId)}
              onOfficeClick={handleOpenOfficeTab}
              isOfficeActive={isOfficeTabActive}
              onFeatureMapClick={handleOpenFeatureMapTab}
              isFeatureMapActive={isFeatureMapTabActive}
              onCodeEditorClick={() => handleOpenCodeEditorTab()}
              isCodeEditorActive={isCodeEditorTabActive}
              onStoreClick={() => setShowStoreDrawer(!showStoreDrawer)}
              isStoreOpen={showStoreDrawer}
            />

            {/* Tab Bar - VSCode style (always shown) */}
            {/* 🦆 Use displayTabs which shows task title when a task is active */}
            <TabBar
              tabs={displayTabs}
              activeTabId={activeTabId}
              splitTabId={splitTabId}
              splitRatio={splitRatio}
              onTabClick={handleTabClick}
              onTabClose={handleTabClose}
              onTabReorder={handleTabReorder}
              onTabPopout={handleTabPopout}
              onDragStateChange={(id) => setIsDraggingTab(!!id)}
              onCloseSplit={handleCloseSplit}
              onTabSplit={(tabId) => setSplitTabId(tabId)}
            />

            {/* Content Area - fills remaining space */}
            <div
              ref={splitContainerRef}
              style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: splitTabId ? 'row' : 'column', position: 'relative' }}
              onDragOver={handleContentDragOver}
              onDragLeave={handleContentDragLeave}
            >
              {/* Split Drop Zone overlay */}
              <SplitDropZone
                visible={(isDraggingTab && !splitTabId) || isDraggingSidebar}
                onDropLeft={handleSplitDropLeft}
                onDropRight={handleSplitDropRight}
                onSidebarDropLeft={handleSidebarDropLeft}
                onSidebarDropRight={handleSidebarDropRight}
                onChatDrop={handleChatDrop}
                showChatZone={isDraggingSidebar}
              />

              {/* Left Pane (or full pane when not split) */}
              <div style={{ flex: splitTabId ? splitRatio : 1, minHeight: 0, minWidth: splitTabId ? 300 : undefined, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Kanban Tab View - shown when kanban tab is active */}
              {activeTabId === 'kanban-board' && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'kanban') {
                  return (
                    <KanbanTabView
                      tab={activeTab}
                      isActive={true}
                      terminals={terminals}
                      chatSessions={chatSessions}
                      chatLoadingMap={chatLoadingMap}
                      onSendMessage={sendMessageForTargetAgent}
                      onAbortStream={abortStreamForTargetAgent}
                      onClearConversation={clearConversationForTargetAgent}
                      onCompactConversation={compactConversationForTargetAgent}
                      getLastPrompt={getLastPromptForTargetAgent}
                      sessionTokensMap={chatTokensMap}
                      onCreateNewAgent={handleOpenNewAgentForKanban}
                      defaultModel={currentSettings.model}
                      defaultThinkingMode={currentSettings.thinkingMode as 'auto' | 'think' | 'hard' | 'harder' | 'ultra'}
                      defaultPermissionMode={currentSettings.permissionMode as PermissionMode}
                      defaultEffort={currentSettings.effort || 'medium'}
                      onLoadChatSessions={loadKanbanChatSessions}
                      onDiffClick={handleDiffClick}
                      onOpenSessionInTerminal={openKanbanSessionInTerminal}
                      onToggleSidePanel={() => setKanbanSidePanelExpanded(!kanbanSidePanelExpanded)}
                      sidePanelExpanded={kanbanSidePanelExpanded}
                      onToggleMiniPanel={() => {
                        const newValue = !showKanbanMiniPanel;
                        setShowKanbanMiniPanel(newValue);
                        if (newValue) {
                          // When activating mini-panel: return to chat tab and expand sidebar
                          setActiveTabId('chat');
                          if (sidePanelCollapsed) {
                            setSidePanelCollapsed(false);
                          }
                        }
                      }}
                      showMiniPanel={showKanbanMiniPanel}
                      onOpenTaskTab={selectTask}
                      onSessionClick={handleSessionClick}
                      onExitKanban={() => setActiveTabId('chat')}
                      onOpenTerminal={async (path, label) => {
                        // Open terminal in specified directory (worktree or project path)
                        const projectName = label || extractProjectId(path) || 'Terminal';
                        const uniqueProjects = [{ path, name: projectName }];
                        await openTerminalWindow(uniqueProjects, {
                          projectPath: path,
                          command: '', // No initial command, just open in directory
                          terminalLabel: label,
                        });
                      }}
                    />
                  );
                }
                return null;
              })()}

              {/* Kanban Notification Bar - shown after /background command creates a task */}
              {pendingNotification && !isKanbanTabActive && (
                <KanbanNotificationBar
                  taskTitle={pendingNotification.taskTitle}
                  onOpenKanban={() => {
                    handleOpenKanbanTab();
                    dismissNotification();
                  }}
                  onDismiss={dismissNotification}
                />
              )}

              {/* Code Editor Tab View (per-file multi-tab) */}
              {/* Brain: pattern-code-editor-tab */}
              {isCodeEditorTabActive && (() => {
                const editorTab = tabs.find(t => t.id === activeTabId && t.type === 'code-editor');
                if (editorTab) {
                  return (
                    <CodeEditorTabView
                      tab={editorTab}
                      isActive={true}
                    />
                  );
                }
                return null;
              })()}

              {/* Automation Tab View - shown when automation tab is active */}
              {activeTabId === 'automation-board' && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'automation') {
                  return (
                    <AutomationTabView
                      tab={activeTab}
                      isActive={true}
                      terminals={terminals}
                      onSessionClick={handleSessionClick}
                      onExitAutomation={() => setActiveTabId('chat')}
                      onFireJob={handleAutomationFireJob}
                    />
                  );
                }
                return null;
              })()}

              {/* Office Tab View - stays mounted forever once opened to preserve WebGL context */}
              {/* Brain: fix-office-webgl-shader-remount */}
              {(() => {
                const officeTab = tabs.find(t => t.type === 'office');
                if (officeTab) officeEverOpened.current = true;
                if (!officeEverOpened.current) return null;
                return (
                  <OfficeTabView
                    tab={officeTab ?? { id: 'office-view', label: 'Office', type: 'office' as const, closable: true }}
                    isActive={isOfficeTabActive && !!officeTab}
                    terminals={terminals}
                    onRoomClick={(projectPath) => {
                      const agent = terminals.find(t => t.cwd === projectPath);
                      if (agent) {
                        setActiveId(agent.id);
                        setActiveTabId('chat');
                      }
                    }}
                    onDuckClick={(agentId) => {
                      setActiveId(agentId);
                      setActiveTabId('chat');
                    }}
                    onSessionClick={handleSessionClick}
                    onOpenWhiteboard={handleOpenWhiteboardForProject}
                    onExitOffice={() => setActiveTabId('chat')}
                  />
                );
              })()}

              {/* Whiteboard Tab View — pure SVG, no WebGL context issues */}
              {(() => {
                const fmTab = tabs.find(t => t.type === 'feature-map');
                if (!fmTab) return null;
                return (
                  <FeatureMapTabView
                    tab={fmTab}
                    isActive={isFeatureMapTabActive}
                    projectPath={fmTab.initialProjectPath ?? activeTerminal?.cwd}
                    onOpenFileInEditor={handleOpenCodeEditorTab}
                  />
                );
              })()}

              {/* NOTE: Task tabs removed - tasks now open in agent's main Chat tab via activeTaskPerAgent state */}

              {/* Project Dashboard Tab View - shown when project-dashboard tab is active */}
              {activeTabId.startsWith('project-dashboard-') && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'project-dashboard') {
                  return (
                    <ProjectDashboardTabView
                      key={`dashboard-${dashboardRefreshKey}`}
                      tab={activeTab}
                      isActive={true}
                      onOpenKanban={handleOpenKanbanTab}
                      onOpenGitPanel={handleOpenGitDrawer}
                      onNewTask={() => {
                        // Open kanban and trigger new task creation
                        handleOpenKanbanTab();
                        // The kanban view will handle the new task flow
                        console.log('[Quack] New Task requested for project:', activeTab.filePath);
                      }}
                      onLoadingChange={setLoadingDashboard}
                    />
                  );
                }
                return null;
              })()}

              {/* Chat View - shown when chat tab is active and Kanban is not active */}
              {/* 🦆 SESSIONS-FIRST: Shows session chat */}
              {activeTabId === 'chat' && !isKanbanTabActive && (() => {
                // Check if we have an active task (now a session in sessions-first)
                const activeTaskSession = activeTaskId ? agentSessions.find(s => s.id === activeTaskId) : null;
                
                // 🦆 FIX: isTaskChat should be true if activeTaskId is set, even if session not found in store
                // This ensures we always show task messages, not agent messages, when a task is selected
                // The session might not be in the store yet (race condition) or might have been removed
                const isTaskChat = !!activeTaskId;
                
                // Get agent info for avatar display (from kanbanStore's agentInfoMap)
                const taskAgentInfo = activeTaskSession ? useKanbanStore.getState().agentInfoMap.get(activeTaskSession.agentId) : undefined;

                // Task-specific data - always use activeTaskId as the key
                const taskMessages = activeTaskId ? (chatSessions.get(activeTaskId) ?? []) : [];
                const taskLoading = activeTaskId ? (chatLoadingMap.get(activeTaskId) ?? false) : false;
                const taskTokens = activeTaskId ? chatTokensMap.get(activeTaskId) : undefined;
                
                // 🦆 SESSIONS-FIRST: Show empty state if no session is selected (and not a task chat)
                // Agent click shows sessions list, user must click a session to see chat
                if (!isTaskChat && !activeSessionId && activeId && activeTerminal) {
                  return (
                    <SessionEmptyState
                      agent={activeTerminal}
                      onSessionClick={handleSessionClick}
                      onOpenPersonality={() => {
                        console.log('[SessionEmptyState] onOpenPersonality clicked, sidePanelCollapsed:', sidePanelCollapsed);
                        // Ensure side panel is not collapsed, then expand Agent Personality section
                        if (sidePanelCollapsed) {
                          setSidePanelCollapsed(false);
                          // Wait for side panel to expand before setting force expand
                          setTimeout(() => {
                            setForceExpandSection('agent-context');
                          }, 50);
                        } else {
                          setForceExpandSection('agent-context');
                        }
                      }}
                    />
                  );
                }

                return (
                  <ChatView
                    key={isTaskChat ? `task-${activeTaskId}` : `${activeId ?? 'no-agent'}-${activeSessionId ?? 'no-session'}`}
                    projectTerminals={activeTerminal ? terminals.filter(t => t.cwd === activeTerminal.cwd && t.id !== activeId) : []}
                    messages={isTaskChat ? taskMessages : currentAgentMessages}
                    isLoading={isTaskChat ? taskLoading : currentAgentLoading}
                    onSendMessage={isTaskChat
                      ? (content, opts) => sendMessageForTargetAgent(activeTaskId!, content, {
                          ...opts,
                          workingDirectory: activeTaskSession?.projectPath || opts?.workingDirectory || '/',
                        })
                      : sendMessageForAgent
                    }
                    activeAgent={activeAgent}
                    onClearAgent={isTaskChat
                      ? () => setActiveTaskId(null) // Just deselect task, don't close anything
                      : handleClearAgent
                    }
                    agents={agents}
                    onSelectAgent={handleUseAgent}
                    onFilePathClick={handleFilePathClick}
                    onOpenInIDE={handleOpenInIDE}
                    onSessionIdClick={handleSessionIdClick}
                    onDiffClick={handleDiffClick}
                    onEditsChange={handleEditsChange}
                    pendingAgentMention={pendingAgentMention}
                    onMentionInserted={() => setPendingAgentMention(null)}
                    pendingFileMention={pendingFileMention}
                    onFileMentionInserted={() => setPendingFileMention(null)}
                    pendingSlashCommand={pendingSlashCommand}
                    onCommandInserted={() => setPendingSlashCommand(null)}
                    pendingSkillMention={pendingSkillMention}
                    onSkillMentionInserted={() => setPendingSkillMention(null)}
                    basePath={isTaskChat ? (activeTaskSession?.projectPath || explorerRoot || explorerPath) : (explorerRoot ?? explorerPath)}
                    inputDraft={isTaskChat
                      ? (taskInputDrafts.get(activeTaskId!) || (taskMessages.length === 0 ? '' : ''))
                      : currentSettings.inputDraft
                    }
                    onInputDraftChange={(draft) => {
                      if (isTaskChat && activeTaskId) {
                        setTaskInputDrafts(prev => {
                          const newMap = new Map(prev);
                          newMap.set(activeTaskId, draft);
                          return newMap;
                        });
                      } else {
                        updateAgentSettings({ inputDraft: draft });
                      }
                    }}
                    model={currentSettings.model}
                    onModelChange={(model) => updateAgentSettings({ model })}
                    thinkingMode={currentSettings.thinkingMode as 'auto' | 'think' | 'hard' | 'harder' | 'ultra'}
                    onThinkingModeChange={(thinkingMode) => updateAgentSettings({ thinkingMode })}
                    permissionMode={currentSettings.permissionMode as PermissionMode}
                    onPermissionModeChange={(permissionMode) => updateAgentSettings({ permissionMode })}
                    effort={currentSettings.effort || 'medium'}
                    onEffortChange={(effort) => updateAgentSettings({ effort })}
                    onAbortStream={isTaskChat ? () => abortStreamForTargetAgent(activeTaskId!) : abortStreamForAgent}
                    lastPrompt={isTaskChat
                      ? (getLastPromptForTargetAgent(activeTaskId!) || undefined)
                      : (getLastPromptForAgent() || undefined)
                    }
                    onClearConversation={isTaskChat
                      ? () => clearConversationForTargetAgent(activeTaskId!)
                      : clearCurrentAgentConversation
                    }
                    onCompactConversation={isTaskChat
                      ? () => compactConversationForTargetAgent(activeTaskId!)
                      : compactCurrentAgentConversation
                    }
                    onOpenSessionInTerminal={isTaskChat
                      ? () => openKanbanSessionInTerminal(activeTaskId!)
                      : openSessionInTerminal
                    }
                    sessionTokens={isTaskChat ? taskTokens : currentAgentTokens}
                    openaiApiKey={openaiApiKey ?? undefined}
                    onOpenPromptEngineer={handleOpenPromptEngineer}
                    agentName={isTaskChat ? (activeTaskSession?.title || 'Task') : (activeTerminal?.label || 'Jack')}
                    agentAvatar={isTaskChat ? taskAgentInfo?.avatar : activeTerminal?.avatar}
                    projectName={isTaskChat ? (activeTaskSession?.projectName || projectName) : projectName}
                    gitBranch={gitBranch}
                    workingOn={activeTerminal?.workingOn}
                    onWorkingOnChange={(value) => {
                      if (!showNewTerminalModal && !editingTerminal && activeTerminal) {
                        handleUpdateWorkingOn(activeTerminal.id, value);
                      }
                    }}
                    selectedRules={activeTerminal?.personality?.selectedRules}
                    onEditRules={activeTerminal ? () => {
                      setEditingTerminal(activeTerminal);
                      setShowNewTerminalModal(true);
                    } : undefined}
                    // Agent Toolkit - quick-access tools for EquipBar (chips at bottom of input)
                    agentToolkit={activeTerminal?.personality?.toolkit}
                    onInsertAtCursor={(text) => {
                      // Insert text at cursor by appending to current input draft
                      if (isTaskChat && activeTaskId) {
                        const currentDraft = taskInputDrafts.get(activeTaskId) || '';
                        const newDraft = currentDraft + text;
                        setTaskInputDrafts(prev => {
                          const newMap = new Map(prev);
                          newMap.set(activeTaskId, newDraft);
                          return newMap;
                        });
                      } else {
                        const currentDraft = currentSettings.inputDraft || '';
                        const newDraft = currentDraft + text;
                        updateAgentSettings({ inputDraft: newDraft });
                      }
                    }}
                    onOpenKanban={handleOpenKanbanTab}
                    onUserQuestionAnswer={answerUserQuestionForAgent}
                    pendingQuestionIds={pendingQuestionIdsMap.get(isTaskChat ? activeTaskId! : (activeId ?? '')) || EMPTY_SET}
                    answeredQuestions={answeredQuestionsMap.get(isTaskChat ? activeTaskId! : (activeId ?? '')) || EMPTY_MAP}
                    currentSessionId={isTaskChat
                      ? activeTaskId ?? undefined
                      : (activeSessionId
                        ? agentSessions.find(s => s.id === activeSessionId)?.claudeSessionId ?? activeSessionId
                        : undefined)
                    }
                    // 🦆 SESSION-FIRST: Internal session ID for state management (attachments, settings)
                    internalSessionId={isTaskChat ? activeTaskId ?? undefined : activeSessionId ?? undefined}
                    // Fullscreen mode
                    isFullscreen={isChatFullscreen}
                    onToggleFullscreen={() => setIsChatFullscreen(!isChatFullscreen)}
                    // File Checkpointing (SDK 0.2.7+)
                    onRewindFiles={handleRewindFiles}
                    onOpenImageTab={handleOpenImageTab}
                    // Open Agent Personality in sidebar
                    onOpenPersonality={() => {
                      // Ensure side panel is not collapsed, then expand Agent Personality section
                      if (sidePanelCollapsed) {
                        setSidePanelCollapsed(false);
                      }
                      setForceExpandSection('agent-context');
                    }}
                    // Plan approval
                    pendingPlanApprovalIds={(() => {
                      const ids = new Set<string>();
                      const key = isTaskChat ? activeTaskId! : (activeId ?? '');
                      for (const [reqId, data] of pendingPlanApprovals.entries()) {
                        if (data.agentId === key || data.sessionKey === key) {
                          ids.add(reqId);
                        }
                      }
                      return ids;
                    })()}
                    onPlanApprovalResponse={respondToPlanApproval}
                    pendingToolPermissions={(() => {
                      const key = isTaskChat ? activeTaskId! : (activeId ?? '');
                      const perms: PendingToolPermission[] = [];
                      for (const [, data] of pendingToolPermissions.entries()) {
                        if (data.agentId === key || data.sessionKey === key) {
                          perms.push(data);
                        }
                      }
                      return perms;
                    })()}
                    onToolPermissionResponse={respondToToolPermission}
                    onAllowAlwaysTool={handleAllowAlwaysTool}
                    onTeammateDrillDown={handleTeammateDrillDown}
                    onAgentCommitDetected={() => {
                      void refreshGitSummary();
                      setAgentCommitTs(Date.now());
                    }}
                  />
                );
              })()}

              {/* Task Chat View - shown when a task tab is active */}
              {/* 🦆 SESSIONS-FIRST: Sessions are tasks, shown in dedicated tabs */}
              {activeTabId.startsWith('task-') && !isKanbanTabActive && (() => {
                // Get session from the tab's taskId (which is now sessionId)
                const activeTab = tabs.find(t => t.id === activeTabId);
                const taskSessionId = activeTab?.taskId;
                const activeSession = taskSessionId ? agentSessions.find(s => s.id === taskSessionId) : null;
                // Get agent info for avatar display
                const agentInfo = activeSession ? useKanbanStore.getState().agentInfoMap.get(activeSession.agentId) : undefined;

                if (!activeSession || !taskSessionId) {
                  return (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.5)' }}>
                      Session not found
                    </div>
                  );
                }

                const taskMessages = chatSessions.get(taskSessionId) ?? [];
                const taskLoading = chatLoadingMap.get(taskSessionId) ?? false;
                const taskTokens = chatTokensMap.get(taskSessionId);

                return (
                  <ChatView
                    key={`task-${taskSessionId}`}
                    projectTerminals={activeTerminal ? terminals.filter(t => t.cwd === activeTerminal.cwd && t.id !== activeId) : []}
                    messages={taskMessages}
                    isLoading={taskLoading}
                    onSendMessage={(content, opts) => sendMessageForTargetAgent(taskSessionId, content, {
                      ...opts,
                      workingDirectory: activeSession.projectPath || opts?.workingDirectory || '/',
                    })}
                    activeAgent={activeAgent}
                    onClearAgent={() => {
                      // Close the task tab when clearing
                      handleTabClose(activeTabId);
                    }}
                    agents={agents}
                    onSelectAgent={handleUseAgent}
                    onFilePathClick={handleFilePathClick}
                    onOpenInIDE={handleOpenInIDE}
                    onSessionIdClick={handleSessionIdClick}
                    onDiffClick={handleDiffClick}
                    onEditsChange={handleEditsChange}
                    pendingAgentMention={pendingAgentMention}
                    onMentionInserted={() => setPendingAgentMention(null)}
                    pendingFileMention={pendingFileMention}
                    onFileMentionInserted={() => setPendingFileMention(null)}
                    pendingSlashCommand={pendingSlashCommand}
                    onCommandInserted={() => setPendingSlashCommand(null)}
                    pendingSkillMention={pendingSkillMention}
                    onSkillMentionInserted={() => setPendingSkillMention(null)}
                    basePath={activeSession.projectPath || explorerRoot || explorerPath}
                    inputDraft={taskInputDrafts.get(taskSessionId) || (taskMessages.length === 0 ? '' : '')}
                    onInputDraftChange={(draft) => {
                      setTaskInputDrafts(prev => {
                        const newMap = new Map(prev);
                        newMap.set(taskSessionId, draft);
                        return newMap;
                      });
                    }}
                    model={currentSettings.model}
                    onModelChange={(model) => updateAgentSettings({ model })}
                    thinkingMode={currentSettings.thinkingMode as 'auto' | 'think' | 'hard' | 'harder' | 'ultra'}
                    onThinkingModeChange={(thinkingMode) => updateAgentSettings({ thinkingMode })}
                    permissionMode={currentSettings.permissionMode as PermissionMode}
                    onPermissionModeChange={(permissionMode) => updateAgentSettings({ permissionMode })}
                    effort={currentSettings.effort || 'medium'}
                    onEffortChange={(effort) => updateAgentSettings({ effort })}
                    onAbortStream={() => abortStreamForTargetAgent(taskSessionId)}
                    lastPrompt={getLastPromptForTargetAgent(taskSessionId) || undefined}
                    onClearConversation={() => clearConversationForTargetAgent(taskSessionId)}
                    onCompactConversation={() => compactConversationForTargetAgent(taskSessionId)}
                    onOpenSessionInTerminal={() => openKanbanSessionInTerminal(taskSessionId)}
                    sessionTokens={taskTokens}
                    openaiApiKey={openaiApiKey ?? undefined}
                    onOpenPromptEngineer={handleOpenPromptEngineer}
                    // Agent display info - show task title for task chat
                    agentName={activeSession.title || 'Task'}
                    agentAvatar={agentInfo?.avatar}
                    // Project context
                    projectName={activeSession.projectName || projectName}
                    gitBranch={gitBranch}
                    // Working on field
                    workingOn={activeTerminal?.workingOn}
                    onWorkingOnChange={(value) => {
                      // CRITICAL FIX: Don't update if modal is open for editing to prevent infinite loop
                      if (!showNewTerminalModal && !editingTerminal && activeTerminal) {
                        handleUpdateWorkingOn(activeTerminal.id, value);
                      }
                    }}
                    // Agent Toolkit - quick-access tools for EquipBar
                    agentToolkit={activeTerminal?.personality?.toolkit}
                    onInsertAtCursor={(text) => {
                      // Insert text at cursor by appending to current input draft
                      const currentDraft = taskInputDrafts.get(taskSessionId) || '';
                      const newDraft = currentDraft + text;
                      setTaskInputDrafts(prev => {
                        const newMap = new Map(prev);
                        newMap.set(taskSessionId, newDraft);
                        return newMap;
                      });
                    }}
                    // Agent Rules - automatically loaded from personality
                    selectedRules={activeTerminal?.personality?.selectedRules}
                    onEditRules={activeTerminal ? () => {
                      // Open the edit modal with the current terminal
                      setEditingTerminal(activeTerminal);
                      setShowNewTerminalModal(true);
                    } : undefined}
                    // Open Kanban view callback
                    onOpenKanban={handleOpenKanbanTab}
                    onUserQuestionAnswer={answerUserQuestionForAgent}
                    pendingQuestionIds={pendingQuestionIdsMap.get(taskSessionId) || EMPTY_SET}
                    answeredQuestions={answeredQuestionsMap.get(taskSessionId) || EMPTY_MAP}
                    // 🦆 FIX: Display claudeSessionId (real Claude Code ID) in header badge
                    currentSessionId={agentSessions.find(s => s.id === taskSessionId)?.claudeSessionId ?? taskSessionId}
                    // 🦆 Internal session ID for state management (attachments, settings)
                    internalSessionId={taskSessionId}
                    // Fullscreen mode
                    isFullscreen={isChatFullscreen}
                    onToggleFullscreen={() => setIsChatFullscreen(!isChatFullscreen)}
                    // File Checkpointing (SDK 0.2.7+)
                    onRewindFiles={handleRewindFiles}
                    onOpenImageTab={handleOpenImageTab}
                    // Open Agent Personality in sidebar
                    onOpenPersonality={() => {
                      // Ensure side panel is not collapsed, then expand Agent Personality section
                      if (sidePanelCollapsed) {
                        setSidePanelCollapsed(false);
                      }
                      setForceExpandSection('agent-context');
                    }}
                    // Plan approval
                    pendingPlanApprovalIds={(() => {
                      const ids = new Set<string>();
                      for (const [reqId, data] of pendingPlanApprovals.entries()) {
                        if (data.agentId === taskSessionId || data.sessionKey === taskSessionId) {
                          ids.add(reqId);
                        }
                      }
                      return ids;
                    })()}
                    onPlanApprovalResponse={respondToPlanApproval}
                    pendingToolPermissions={(() => {
                      const perms: PendingToolPermission[] = [];
                      for (const [, data] of pendingToolPermissions.entries()) {
                        if (data.agentId === taskSessionId || data.sessionKey === taskSessionId) {
                          perms.push(data);
                        }
                      }
                      return perms;
                    })()}
                    onToolPermissionResponse={respondToToolPermission}
                    onAllowAlwaysTool={handleAllowAlwaysTool}
                    onTeammateDrillDown={handleTeammateDrillDown}
                    onAgentCommitDetected={() => {
                      void refreshGitSummary();
                      setAgentCommitTs(Date.now());
                    }}
                  />
                );
              })()}

              {/* File Preview - shown when file tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('file-') && !isKanbanTabActive && (
                <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <FilePreviewDrawer
                    ref={previewDrawerRef}
                    open={true}
                    filename={previewFile?.name ?? null}
                    path={previewFile?.path ?? null}
                    content={previewContent}
                    loading={loadingPreview}
                    error={previewError}
                    formatting={formattingPreview}
                    diffInfo={previewDiffInfo}
                    lineChanges={previewLineChanges ?? undefined}
                    onClose={() => setActiveTabId('chat')}
                    onRefresh={handleRefreshPreview}
                    onFormat={handleFormatPreview}
                    onSave={handleSaveFile}
                    onHasUnsavedChanges={setPreviewHasUnsavedChanges}
                    imageData={previewImageData}
                    embedded={true}
                    onOpenInEditor={(filePath) => {
                      handleOpenCodeEditorTab(filePath);
                      import('./stores/editorStore').then(({ useEditorStore }) => {
                        useEditorStore.getState().openFile(filePath);
                      });
                    }}
                  />
                  <FileActionButtons
                    onRefresh={handleRefreshPreview}
                    onFormat={handleFormatPreview}
                    onSave={() => {
                      previewDrawerRef.current?.triggerSave();
                    }}
                    onOpenIDE={async () => {
                      if (!previewFile?.path) return;
                      try {
                        const { openFileInIDE } = useIDEStore.getState();
                        await openFileInIDE(previewFile.path);
                        toast.success("File opened in IDE");
                      } catch (error) {
                        console.error("Failed to open file in IDE:", error);
                        toast.error("Failed to open file in IDE");
                      }
                    }}
                    onRevealFinder={async () => {
                      if (!previewFile?.path) return;
                      try {
                        await invoke("reveal_in_finder", { path: previewFile.path });
                      } catch (error) {
                        console.error("Failed to reveal in Finder:", error);
                        toast.error("Failed to reveal in Finder");
                      }
                    }}
                    onClose={() => {
                      handleTabClose(activeTabId);
                    }}
                    disabled={loadingPreview}
                    formatting={formattingPreview}
                    hasUnsavedChanges={previewHasUnsavedChanges}
                    isImageFile={previewFile?.name ? ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'].some(ext => previewFile.name!.toLowerCase().endsWith(ext)) : false}
                    isMarkdownFile={previewFile?.name ? previewFile.name.toLowerCase().endsWith('.md') : false}
                    isEditMode={previewDrawerRef.current?.isEditMode ?? false}
                    onToggleEditMode={() => {
                      previewDrawerRef.current?.toggleEditMode();
                    }}
                  />
                </div>
              )}

              {/* Agent Viewer - shown when agent tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('agent-') && !isKanbanTabActive && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                // For new agents, agentName is empty string but we still need to render
                if (activeTab?.type === 'agent' && activeTab.agentScope && (activeTab.agentName !== undefined)) {
                  return (
                    <AgentViewer
                      key={activeTab.id} // Force new instance when tab changes
                      agentName={activeTab.agentName}
                      agentScope={activeTab.agentScope}
                      workingDir={activeTerminal?.cwd || explorerPath || undefined}
                      onRefresh={() => {
                        // Close tab after delete or cancel new agent
                        if (activeTab.isNewAgent) {
                          handleTabClose(activeTab.id);
                        }
                        loadAgents();
                      }}
                      isNewAgent={activeTab.isNewAgent}
                    />
                  );
                }
                return null;
              })()}

              {/* Browser Manager - shown when browser tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('browser-manager-') && !isKanbanTabActive && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'browser') {
                  return <BrowserManager />;
                }
                return null;
              })()}

              {/* Skill Viewer - shown when skill tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('skill-') && !isKanbanTabActive && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'skill' && activeTab.skillName && activeTab.skillScope) {
                  return (
                    <SkillViewer
                      skillName={activeTab.skillName}
                      skillScope={activeTab.skillScope}
                      workingDir={activeTerminal?.cwd || explorerPath || undefined}
                      onRefresh={loadSkills}
                    />
                  );
                }
                return null;
              })()}

              {/* Command Viewer - shown when command tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('command-') && !isKanbanTabActive && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                // For new commands, commandName is empty string but we still need to render
                if (activeTab?.type === 'command' && activeTab.commandScope && (activeTab.commandName !== undefined)) {
                  return (
                    <CommandViewer
                      key={activeTab.id} // Force new instance when tab changes
                      commandName={activeTab.commandName}
                      commandScope={activeTab.commandScope}
                      workingDir={activeTerminal?.cwd || explorerPath || undefined}
                      onRefresh={() => {
                        // Close tab after delete or cancel new command
                        handleTabClose(activeTab.id);
                      }}
                      isNewCommand={activeTab.isNewCommand}
                    />
                  );
                }
                return null;
              })()}

              {/* Rule Viewer - shown when rule tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('rule-') && !isKanbanTabActive && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                // For new rules, ruleName is empty string but we still need to render
                if (activeTab?.type === 'rule' && activeTab.ruleScope && (activeTab.ruleName !== undefined)) {
                  return (
                    <RuleViewer
                      key={activeTab.id} // Force new instance when tab changes
                      ruleName={activeTab.ruleName}
                      ruleScope={activeTab.ruleScope}
                      workingDir={activeTerminal?.cwd || explorerPath || undefined}
                      onRefresh={() => {
                        // Close tab after delete or cancel new rule
                        handleTabClose(activeTab.id);
                      }}
                      isNewRule={activeTab.isNewRule}
                    />
                  );
                }
                return null;
              })()}

              {/* Documentation Viewer - shown when docs tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('docs-') && !isKanbanTabActive && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'docs') {
                  return <DocsTabView tab={activeTab} isActive={true} />;
                }
                return null;
              })()}

              {/* Memory Graph / Second Brain - deprecated, use Obsidian vault directly */}
              {(activeTabId.startsWith('memory-graph-') || activeTabId.startsWith('second-brain-')) && !isKanbanTabActive && (
                <div style={{ padding: '40px', textAlign: 'center', opacity: 0.5 }}>
                  Brain: Open in Obsidian
                </div>
              )}

              {/* Claude Assets Manager - shown when claude-assets tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('claude-assets-') && !isKanbanTabActive && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'claude-assets') {
                  return (
                    <ClaudeAssetsTabView
                      tab={activeTab}
                      isActive={true}
                      terminals={terminals}
                      onOpenFile={(path) => {
                        // Open file in Monaco editor tab
                        const fileName = path.split('/').pop() || 'file';
                        const existingTab = tabs.find(t => t.type === 'file' && t.filePath === path);
                        if (existingTab) {
                          setActiveTabId(existingTab.id);
                        } else {
                          const newTab: Tab = {
                            id: `file-${Date.now()}`,
                            label: fileName,
                            type: 'file',
                            closable: true,
                            filePath: path,
                          };
                          setTabs(prev => [...prev, newTab]);
                          setActiveTabId(newTab.id);
                        }
                      }}
                      onSelectCommand={handleSelectCommand}
                      onSelectRule={handleSelectRule}
                      onSelectDroid={handleSelectDroid}
                    />
                  );
                }
                return null;
              })()}

              {/* Image Viewer - shown when image tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('image-') && !isKanbanTabActive && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'image') {
                  return <ImageTabView tab={activeTab} isActive={true} />;
                }
                return null;
              })()}


              {/* Teammate Stream Tab - shown when teammate-stream tab is active */}
              {activeTabId.startsWith('teammate-') && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'teammate-stream' && activeTab.teammateSessionId) {
                  return (
                    <TeammateStreamTab
                      sessionId={activeTab.teammateSessionId}
                      teammateName={activeTab.teammateName || 'Teammate'}
                      teammateColor={activeTab.color}
                    />
                  );
                }
                return null;
              })()}

              {/* Agent Terminal Tabs - render ALL terminals, show/hide with visibility (hidden in Kanban mode) */}
              {tabs.some(t => t.type === 'agent-terminal') && !isKanbanTabActive && (
                <div style={{
                  flex: 1,
                  minHeight: 0,
                  position: 'relative',
                  overflow: 'hidden',
                  display: tabs.some(t => t.type === 'agent-terminal' && activeTabId === t.id) ? 'flex' : 'none',
                  flexDirection: 'column'
                }}>
                  {tabs
                    .filter(t => t.type === 'agent-terminal' && t.terminalId)
                    .map(tab => {
                      const agentTerminal = agentTerminals.find(t => t.id === tab.terminalId);
                      if (!agentTerminal) return null;

                      return (
                        <XTermInstance
                          key={agentTerminal.id}
                          terminalId={agentTerminal.id}
                          color={agentTerminal.color}
                          isActive={activeTabId === tab.id}
                        />
                      );
                    })
                  }
                </div>
              )}
              </div>{/* End Left Pane */}

              {/* Split Divider + Right Pane */}
              {splitTabId && (
                <>
                  <SplitPaneDivider
                    onRatioChange={setSplitRatio}
                    containerRef={splitContainerRef}
                  />
                  <div style={{ flex: 1 - splitRatio, minHeight: 0, minWidth: 300, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Split pane content - render the split tab */}
                    {(() => {
                      const sTab = tabs.find(t => t.id === splitTabId);
                      if (!sTab) return null;

                      // Code Editor — standalone instance, not singleton editorStore
                      if (sTab.type === 'code-editor' && sTab.editorFilePath) {
                        return (
                          <SplitCodeEditor
                            key={sTab.editorFilePath}
                            filePath={sTab.editorFilePath}
                          />
                        );
                      }

                      // Feature Map (Whiteboard)
                      if (sTab.type === 'feature-map') {
                        return (
                          <FeatureMapTabView
                            tab={sTab}
                            isActive={true}
                            projectPath={activeTerminal?.cwd}
                            onOpenFileInEditor={handleOpenCodeEditorTab}
                          />
                        );
                      }

                      // File Preview
                      if (sTab.type === 'file' && sTab.filePath) {
                        return (
                          <FilePreviewDrawer
                            open={true}
                            filename={sTab.filePath.split('/').pop() ?? null}
                            path={sTab.filePath}
                            content={previewContent}
                            loading={loadingPreview}
                            error={previewError}
                            formatting={formattingPreview}
                            diffInfo={previewDiffInfo}
                            lineChanges={previewLineChanges ?? undefined}
                            onClose={handleCloseSplit}
                            onRefresh={handleRefreshPreview}
                            onFormat={handleFormatPreview}
                            onSave={handleSaveFile}
                            onHasUnsavedChanges={() => {}}
                            imageData={previewImageData}
                            embedded={true}
                          />
                        );
                      }

                      // Docs
                      if (sTab.type === 'docs') {
                        return <DocsTabView tab={sTab} isActive={true} />;
                      }

                      // Image
                      if (sTab.type === 'image') {
                        return <ImageTabView tab={sTab} isActive={true} />;
                      }

                      // Agent viewer
                      if (sTab.type === 'agent' && sTab.agentScope && sTab.agentName !== undefined) {
                        return (
                          <AgentViewer
                            key={sTab.id}
                            agentName={sTab.agentName}
                            agentScope={sTab.agentScope}
                            workingDir={activeTerminal?.cwd || explorerPath || undefined}
                            onRefresh={loadAgents}
                            isNewAgent={sTab.isNewAgent}
                          />
                        );
                      }

                      // Skill viewer
                      if (sTab.type === 'skill' && sTab.skillName && sTab.skillScope) {
                        return (
                          <SkillViewer
                            skillName={sTab.skillName}
                            skillScope={sTab.skillScope}
                            workingDir={activeTerminal?.cwd || explorerPath || undefined}
                            onRefresh={loadSkills}
                          />
                        );
                      }

                      // Browser
                      if (sTab.type === 'browser') {
                        return <BrowserManager />;
                      }

                      // Kanban
                      if (sTab.type === 'kanban') {
                        return (
                          <KanbanTabView
                            tab={sTab}
                            isActive={true}
                            isSplitPane={true}
                            terminals={terminals}
                            chatSessions={chatSessions}
                            chatLoadingMap={chatLoadingMap}
                            onSendMessage={sendMessageForTargetAgent}
                            onAbortStream={abortStreamForTargetAgent}
                            onClearConversation={clearConversationForTargetAgent}
                            onCompactConversation={compactConversationForTargetAgent}
                            getLastPrompt={getLastPromptForTargetAgent}
                            sessionTokensMap={chatTokensMap}
                            onCreateNewAgent={handleOpenNewAgentForKanban}
                            defaultModel={currentSettings.model}
                            defaultThinkingMode={currentSettings.thinkingMode as 'auto' | 'think' | 'hard' | 'harder' | 'ultra'}
                            defaultPermissionMode={currentSettings.permissionMode as PermissionMode}
                            defaultEffort={currentSettings.effort || 'medium'}
                            onLoadChatSessions={loadKanbanChatSessions}
                            onDiffClick={handleDiffClick}
                            onOpenSessionInTerminal={openKanbanSessionInTerminal}
                            onToggleSidePanel={() => setKanbanSidePanelExpanded(!kanbanSidePanelExpanded)}
                            sidePanelExpanded={kanbanSidePanelExpanded}
                            onToggleMiniPanel={() => {
                              const newValue = !showKanbanMiniPanel;
                              setShowKanbanMiniPanel(newValue);
                              if (newValue) {
                                setActiveTabId('chat');
                                if (sidePanelCollapsed) {
                                  setSidePanelCollapsed(false);
                                }
                              }
                            }}
                            showMiniPanel={showKanbanMiniPanel}
                            onOpenTaskTab={selectTask}
                            onSessionClick={handleSessionClick}
                            onExitKanban={() => setActiveTabId('chat')}
                            onOpenTerminal={async (path, label) => {
                              const projectName = label || extractProjectId(path) || 'Terminal';
                              const uniqueProjects = [{ path, name: projectName }];
                              await openTerminalWindow(uniqueProjects, {
                                projectPath: path,
                                command: '',
                                terminalLabel: label,
                              });
                            }}
                          />
                        );
                      }

                      // Fallback: unsupported tab type for split
                      return (
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                          Questo tipo di tab non supporta la split view
                        </div>
                      );
                    })()}
                  </div>
                </>
              )}
            </div>{/* End Content Area */}
          </div>
          )}
        </section>

        {/* Sidebar Accordion - Codex-style (NEW) */}
        <SidePanelAccordion
          // FileExplorer props
          rootPath={(explorerRoot ?? explorerPath) || null}
          tree={explorerTree}
          loading={loadingExplorer}
          error={explorerError}
          activePath={explorerPath}
          activeFilePath={previewFile?.path ?? null}
          modifiedFiles={modifiedFiles}
          onOpenFile={handleOpenFilePreview}
          onLoadChildren={fetchDirectoryChildren}
          onMentionFile={handleMentionFile}
          // Agents props
          agents={agents}
          selectedAgent={selectedAgent}
          loadingAgents={loadingAgents}
          agentsError={agentsError}
          agentsDirectoryExists={agentsDirectoryExists}
          workingDir={activeTerminal?.cwd ?? undefined}
          onSelectAgent={handleSelectAgent}
          onUseAgent={handleUseAgent}
          onRefreshAgents={loadAgents}
          onCreateAgent={handleCreateAgent}
          // Skills props
          skills={skills}
          loadingSkills={loadingSkills}
          skillsError={skillsError}
          skillsDirectoryExists={skillsDirectoryExists}
          onSelectSkill={handleSelectSkill}
          onRefreshSkills={loadSkills}
          // Hooks props
          hooks={hooks}
          loadingHooks={loadingHooks}
          hooksError={hooksError}
          onRefreshHooks={loadHooks}
          onSaveHook={handleSaveHook}
          onDeleteHook={handleDeleteHook}
          onToggleHook={handleToggleHook}
          // Commands props
          onSelectCommand={handleSelectCommand}
          // Rules props
          onSelectRule={handleSelectRule}
          // Droids props
          onSelectDroid={handleSelectDroid}
          // Context props
          tauriAvailable={tauriAvailable}
          onOpenContextDrawer={handleOpenContextDrawer}
          // Agent Context props
          activeAgentId={activeId || null}
          activeAgentName={(() => {
            const activeTerminal = terminals.find((t) => t.id === activeId);
            return activeTerminal?.label || null;
          })()}
          activeAgentAvatar={(() => {
            const activeTerminal = terminals.find((t) => t.id === activeId);
            return activeTerminal?.avatar || null;
          })()}
          activeAgentWorkingOn={(() => {
            const activeTerminal = terminals.find((t) => t.id === activeId);
            return activeTerminal?.workingOn || null;
          })()}
          activeAgentCwd={(() => {
            const activeTerminal = terminals.find((t) => t.id === activeId);
            return activeTerminal?.cwd || null;
          })()}
          activeAgentPersonality={(() => {
            const activeTerminal = terminals.find((t) => t.id === activeId);
            return activeTerminal?.personality || null;
          })()}
          activeAgentColor={(() => {
            const activeTerminal = terminals.find((t) => t.id === activeId);
            return activeTerminal?.color || null;
          })()}
          projectName={projectName}
          gitBranch={gitBranch}
          agentRefreshKey={agentRefreshKey}
          onEditAgent={handleEditAgentFromContext}
          onSessionClick={handleSessionClick}
          activeSessionId={activeSessionId ?? undefined}
          // Collapse props
          isCollapsed={sidePanelCollapsed || activeTabId.startsWith('docs-') || activeTabId.startsWith('second-brain-') || activeTabId.startsWith('memory-graph-') || activeTabId.startsWith('claude-assets-') || activeTabId.startsWith('project-dashboard-') || (isKanbanTabActive && !kanbanSidePanelExpanded) || isOfficeTabActive || isFeatureMapTabActive}
          userCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => {
            if (isKanbanTabActive) {
              setKanbanSidePanelExpanded(!kanbanSidePanelExpanded);
            } else {
              setSidePanelCollapsed(!sidePanelCollapsed);
            }
          }}
          // MCP props
          onOpenMcpConfig={handleOpenMcpConfig}
          // Sessions props
          onSelectSession={handleSelectSession}
          // Changes panel props
          onRefreshGitStatus={refreshGitSummary}
          onClearModifiedFiles={() => setModifiedFiles(new Map())}
          onOpenInEditor={handleOpenFileInEditorTab}
          branch={gitBranch || null}
          isWorktree={!!activeTerminal?.useWorktree}
          gitHistory={commitHistory}
          gitHistoryLoading={loadingGit}
          lastRefreshTs={agentCommitTs}
          // Task Hub props
          terminals={terminals}
          chatSessions={chatSessions}
          onActiveSessionDone={() => {
            setActiveSessionId(null);
            setActiveTaskId(null);
          }}
          // Force expand section
          forceExpandSection={forceExpandSection}
          onForceExpandHandled={() => setForceExpandSection(null)}
        />

        <NewTerminalModal
          open={showNewTerminalModal}
          isEditing={editingTerminal !== null}
          name={newTerminalName}
          path={newTerminalPath}
          color={newTerminalColor}
          workingOn={newTerminalWorkingOn}
          avatar={newTerminalAvatar}
          personality={newTerminalPersonality}
          branch={newTerminalBranch}
          useWorktree={newTerminalUseWorktree}
          availableColors={TERMINAL_COLORS}
          selectingDirectory={selectingDirectory}
          creating={creatingTerminal}
          error={newTerminalError}
          activeProjects={activeProjects}
          initialStep={initialModalStep}
          onNameChange={setNewTerminalName}
          onPathChange={setNewTerminalPath}
          onColorChange={setNewTerminalColor}
          onWorkingOnChange={setNewTerminalWorkingOn}
          onAvatarChange={setNewTerminalAvatar}
          onPersonalityChange={handlePersonalityChange}
          onBranchChange={setNewTerminalBranch}
          onUseWorktreeChange={setNewTerminalUseWorktree}
          onBrowse={handleSelectDirectory}
          onCancel={handleCancelNewTerminal}
          onConfirm={handleConfirmNewTerminal}
          onOpenStore={() => {
            setShowNewTerminalModal(false);
            setShowStoreDrawer(true);
          }}
          isOnboarding={terminals.length === 0 && !hasSavedAgents}
          onInstallStarterBundles={handleInstallStarterBundles}
        />

        {/* FilePreviewDrawer overlay DISABLED - now using tab-embedded preview only */}
        <FilePreviewDrawer
          open={false}
          filename={previewFile?.name ?? null}
          path={previewFile?.path ?? null}
          content={previewContent}
          loading={loadingPreview}
          error={previewError}
          formatting={formattingPreview}
          diffInfo={previewDiffInfo}
          lineChanges={previewLineChanges ?? undefined}
          imageData={previewImageData}
          onClose={handleClosePreview}
          onRefresh={handleRefreshPreview}
          onFormat={handleFormatPreview}
          onSave={handleSaveFile}
          onOpenInEditor={(filePath) => {
            handleOpenCodeEditorTab(filePath);
            import('./stores/editorStore').then(({ useEditorStore }) => {
              useEditorStore.getState().openFile(filePath);
            });
          }}
        />

        <SavedCommandsDrawer
          open={savedCommandsDrawerOpen}
          commands={savedCommandsFilterProject
            ? savedCommands.filter(c => c.projectPath === savedCommandsFilterProject || !c.projectPath)
            : savedCommands}
          filterProject={savedCommandsFilterProject}
          onClearFilter={() => setSavedCommandsFilterProject(null)}
          onLaunch={(command, immediate) =>
            handleLaunchSavedCommand(
              command,
              immediate ? { launchImmediately: true } : undefined
            )
          }
          onEdit={(command) => {
            setEditingCommand(command);
            setSavedCommandModalOpen(true);
          }}
          onCreate={() => {
            setEditingCommand(null);
            setSavedCommandModalOpen(true);
          }}
          onDelete={async (command) => {
            await invoke("delete_command", { id: command.id });
            setSavedCommands((prev) =>
              prev.filter((item) => item.id !== command.id)
            );
          }}
          onClose={() => setSavedCommandsDrawerOpen(false)}
        />

        <SessionDetailsDrawer
          isOpen={sessionDetailsDrawerOpen}
          sessionId={selectedSession?.id || null}
          currentActiveSessionId={activeId ? chatSessionIds.get(activeId) : undefined}
          onClose={() => setSessionDetailsDrawerOpen(false)}
          onResumeSession={handleResumeSession}
          onDeleteSession={handleDeleteSession}
        />

        <div className={`git-drawer ${showGitDrawer ? "open" : ""}`}>
          <div
            className="git-drawer-backdrop"
            onClick={() => setShowGitDrawer(false)}
          />
          <div className="git-drawer-panel">
            <header className="git-drawer-header">
              <h2>Git</h2>
              <button
                type="button"
                className="git-drawer-close"
                onClick={() => setShowGitDrawer(false)}
              >
                ✕
              </button>
            </header>
            {loadingGit && !gitSummary ? (
              <div className="git-drawer-loading">
                <div className="git-drawer-spinner" />
                <p>Loading Git status...</p>
              </div>
            ) : (
              <GitPanel
                summary={gitSummary}
                loading={loadingGit}
                error={gitError}
                history={commitHistory}
                historyLoading={loadingGit}
                historyError={historyError}
                selected={selectedGitEntry}
                onRefresh={refreshGitSummary}
                onSelect={handleSelectGitEntry}
                onStageAll={handleStageAll}
                onOpenFile={handleOpenFileFromGit}
                commitMessage={commitMessage}
                onCommitMessageChange={setCommitMessage}
                onCommit={handleCommit}
                committing={committing}
                onGenerateCommitMessage={handleGenerateCommitMessage}
                rootPath={effectiveGitRootPath}
                terminals={terminals}
                onBranchSwitch={async (branchName) => {
                  // Switch to the branch
                  try {
                    await invoke('git_switch_branch', {
                      branchName: branchName,
                      rootPath: explorerPath,
                    });

                    // Close diff drawer if open
                    setShowDiffDrawer(false);
                    setSelectedGitPath(null);

                    // Refresh git status and reload branches
                    await refreshGitSummary();
                  } catch (error) {
                    console.error('Failed to switch branch:', error);
                    alert(`Failed to switch branch: ${error}`);
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Diff Drawer - Opened when clicking a file (from git panel or EditSummaryBar) */}
        {showDiffDrawer && (selectedGitEntry || editSummaryDiffEntry) && (
          <DiffDrawer
            selected={selectedGitEntry || editSummaryDiffEntry}
            diffContent={diffContent}
            diffLoading={diffLoading}
            diffError={diffError}
            diffView={diffView}
            onDiffViewChange={handleDiffViewChange}
            onStage={handleStageEntry}
            onUnstage={handleUnstageEntry}
            onClose={() => {
              setShowDiffDrawer(false);
              setEditSummaryDiffEntry(null); // Clear synthetic entry on close
            }}
          />
        )}

        {showStoreDrawer && (
          <div className="git-drawer open">
            <div
              className="git-drawer-backdrop"
              onClick={() => setShowStoreDrawer(false)}
            />
            <div className="git-drawer-panel quack-store-drawer-panel">
              <QuackStoreDrawer
                onClose={() => setShowStoreDrawer(false)}
                onRefresh={handleMarketplaceRefresh}
                activeProjects={activeProjects}
                onAgentBundleInstalled={handleAgentBundleInstalled}
              />
            </div>
          </div>
        )}

        <SavedCommandModal
          open={savedCommandModalOpen}
          command={editingCommand}
          defaultProjectPath={savedCommandsFilterProject}
          onClose={() => {
            setSavedCommandModalOpen(false);
            setEditingCommand(null);
          }}
          onSaved={(command) => {
            setSavedCommands((prev) => {
              const index = prev.findIndex((c) => c.id === command.id);
              if (index >= 0) {
                const updated = [...prev];
                updated[index] = command;
                return updated;
              }
              return [...prev, command];
            });
            setSavedCommandModalOpen(false);
            setEditingCommand(null);
          }}
        />

        <AddTerminalWindowModal
          isOpen={showAddNativeTerminalModal}
          onClose={() => setShowAddNativeTerminalModal(false)}
          onConfirm={async (name, directory, color, savedCommand) => {
            await handleAddTerminalWindow(name, directory, color, savedCommand);
            setShowAddNativeTerminalModal(false);
          }}
          defaultDirectory={explorerPath || activeTerminal?.cwd || ""}
          savedCommands={savedCommands}
        />

        {showSettings && (
          <UnifiedSettings
            onClose={() => {
              setShowSettings(false);
              setSettingsInitialCategory(undefined);
            }}
            initialCategory={settingsInitialCategory}
            onOpenTelegramSetup={() => {
              setShowSettings(false);
              setSettingsInitialCategory(undefined);
              setShowTelegramSetup(true);
            }}
          />
        )}

        {/* Fullscreen Loading Overlay for Dashboard/Git */}
        {(loadingDashboard || (loadingGit && showGitDrawer && !gitSummary)) && (
          <div className="fullscreen-loader-overlay">
            <div className="fullscreen-loader-content">
              <div className="fullscreen-loader-spinner" />
              <p>{loadingDashboard ? 'Loading project dashboard...' : 'Loading Git status...'}</p>
            </div>
          </div>
        )}

        {/* Cross-project switch loader — covers the ~2s freeze from cascade effects */}
        {projectSwitchTarget && (
          <div className="fullscreen-loader-overlay">
            <div className="fullscreen-loader-content">
              <div className="fullscreen-loader-spinner" />
              <p>Switching to <strong>{projectSwitchTarget.projectName}</strong>…</p>
            </div>
          </div>
        )}

        {showPerformanceMonitor && <PerformanceMonitor />}

        {showAIAssistant && (
          <AIAssistant
            intent={aiIntent}
            context={aiContext}
            initialMode={aiInitialMode}
            onClose={() => setShowAIAssistant(false)}
            onSelectCommand={handleAICommandSelect}
          />
        )}

        <QuackAgencyDrawer
          open={showQuackAgencyDrawer}
          agents={agents}
          selectedAgent={selectedAgent}
          loading={loadingAgents}
          error={agentsError}
          workingDir={activeTerminal?.cwd ?? explorerPath}
          directoryExists={agentsDirectoryExists}
          onClose={() => setShowQuackAgencyDrawer(false)}
          onSelectAgent={handleSelectAgent}
          onRefresh={loadAgents}
        />

        <ContextDrawer
          open={showContextDrawer}
          scope={contextScope}
          workingDir={activeTerminal?.cwd ?? explorerPath}
          onClose={() => setShowContextDrawer(false)}
        />

        <SkillDrawer
          open={showSkillDrawer}
          selectedSkill={selectedSkill}
          workingDir={activeTerminal?.cwd ?? explorerPath}
          onClose={() => setShowSkillDrawer(false)}
        />

        <BackgroundsModal
          open={showBackgroundsModal}
          currentBackground={currentBackground}
          onSelect={handleSelectBackground}
          onClose={() => setShowBackgroundsModal(false)}
        />

        <TelegramSetup
          open={showTelegramSetup}
          onClose={() => setShowTelegramSetup(false)}
        />

        <DroidFactoryDrawer
          open={droidFactoryOpen}
          onClose={() => setDroidFactoryOpen(false)}
          onSendMessage={sendMessageForAgent}
          userStats={userStats}
        />

      </div>

      {/* Watch Intro replay - uses SplashScreen component */}
      {introReplayActive && (
        <SplashScreen
          onComplete={() => setIntroReplayActive(false)}
        />
      )}

      {/* 💰 License and Upgrade Modals */}
      <LicenseModal
        isOpen={showLicenseModal}
        onClose={() => setShowLicenseModal(false)}
        onSuccess={handleLicenseSuccess}
      />

      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onActivateLicense={handleActivateLicense}
        limitType={upgradeLimitType}
      />

      {/* Prerequisites Check - FIRST: Check Git, Node.js, Claude CLI installation */}
      <PrerequisitesCheck />

      {/* Git Config Onboarding - SECOND: Configure Git user.name and user.email */}
      <GitConfigOnboarding />

      {/* IDE Onboarding - THIRD: Select preferred IDE */}
      <IDEOnboarding />

      {/* Terminal Window - Now opens as separate Tauri window via useTerminalWindowManager */}

      {/* Update notification toast — checks GitHub releases on mount */}
      <UpdateToast />

      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}

// TEMPORARILY DISABLED: MaxPlanProvider causing TDZ error
// function App() {
//   return (
//     <MaxPlanProvider>
//       <AppContent />
//     </MaxPlanProvider>
//   );
// }

// Temporary: Direct export without MaxPlanProvider
function App() {
  return <AppContent />;
}

export default App;
