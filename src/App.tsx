import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import posthog from "posthog-js";
import { invokeWithTimeout, fireAndForget } from "./utils/invokeWithTimeout";
import { useClaudeCliAvailability } from "./contexts/TestModeContext";
import { getTestModeStoreName } from "./utils/testModeStorage";
import { getCurrentVersion } from "./utils/version";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog, confirm } from "@tauri-apps/plugin-dialog";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { Store } from "@tauri-apps/plugin-store";
import { Toaster, toast } from "sonner";
import "sonner/dist/styles.css";
import "./sonner-custom.css";
import { saveSessionBackup } from "./utils/sessionRecovery";

import TerminalSidebar from "./components/TerminalSidebar";
import SidePanel from "./components/SidePanel";
import NewTerminalModal from "./components/NewTerminalModal";
import FilePreviewDrawer, { type FilePreviewDrawerRef } from "./components/FilePreviewDrawer";
import FileActionButtons from "./components/FileActionButtons";
import GitPanel from "./components/GitPanel";
import DiffDrawer from "./components/DiffDrawer";
import MarketplaceDrawer from "./components/MarketplaceDrawer";
import SavedCommandsDrawer from "./components/SavedCommandsDrawer";
import SavedCommandModal from "./components/SavedCommandModal";
import SessionDetailsDrawer from "./components/SessionDetailsDrawer";
// import { NativeTerminalPanel } from "./components/NativeTerminalPanel"; // Unused - commented out
import { AddTerminalWindowModal } from "./components/AddTerminalWindowModal";
// TitleBar removed - using native macOS decorations
// import { TitleBar } from "./components/TitleBar";
import UnifiedSettings from "./components/settings/UnifiedSettings";
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
import KanbanToast from "./components/KanbanToast";
import { useDocsTab } from "./hooks/useDocsTab";
import { useGlobalKeyboardShortcuts } from "./hooks/useGlobalKeyboardShortcuts";
import { useMemoryGraphTab } from "./hooks/useMemoryGraphTab";
import { useSecondBrainTab } from "./hooks/useSecondBrainTab";
import { useKanbanTab } from "./hooks/useKanbanTab";
import { useKanbanChatSync } from "./hooks/useKanbanChatSync";
import { useSessionMessageSync } from "./hooks/useSessionMessageSync";
import { useProjectDashboardTab } from "./hooks/useProjectDashboardTab";
import DocsTabView from "./views/DocsTabView";
import MemoryGraphTabView from "./views/MemoryGraphTabView";
import SecondBrainTabView from "./views/SecondBrainTabView";
import ClaudeAssetsTabView from "./views/ClaudeAssetsTabView";
import KanbanTabView from "./views/KanbanTabView";
import ProjectDashboardTabView from "./views/ProjectDashboardTabView";
import ImageTabView from "./views/ImageTabView";
import { useClaudeAssetsTab } from "./hooks/useClaudeAssetsTab";
import { useUIStore } from "./stores/uiStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useKanbanStore } from "./stores/kanbanStore";
import { useSessionStore } from "./stores/sessionStore";
import { useChatStore } from "./stores/chatStore";
import KanbanNotificationBar from "./components/KanbanNotificationBar";
import { LicenseModal } from "./components/LicenseModal";
import { UpgradeModal } from "./components/UpgradeModal";
import ObsidianSyncInitializer from "./components/ObsidianSyncInitializer";
import KanbanWatcherInitializer from "./components/KanbanWatcherInitializer";
import { ProBanner } from "./components/ProBanner";
import { ClaudeAuthBanner } from "./components/ClaudeAuthBanner";
import { DroidFactoryDrawer } from "./components/droid-factory";
import { useDroidFactory } from "./hooks/useDroidFactory";
import IDEOnboarding from "./components/settings/IDEOnboarding";
import { isPro, canCreateTerminal } from "./config/features";
import type { DiffInfo } from "./components/CodeEditorMonaco";
import { parseDiff } from "./lib/diffParser";
import type { ChatSendOptions } from "./hooks/useClaudeChat";
import type { SlashCommand } from "./hooks/useSlashCommands";
import { useDeepLinkHandler } from "./hooks/useDeepLinkHandler";
import { usePipWindow } from "./hooks/usePipWindow";
import { useSystemWakeHandler } from "./hooks/useSystemWakeHandler";
// import { useTelegramBot } from "./hooks/useTelegramBot"; // DEPRECATED - using Telegram Central Bot now
import {
  saveTabsByTerminalToStorage,
  loadTabsByTerminalFromStorage,
  saveNativeTerminalsToStorage,
  loadNativeTerminalsFromStorage,
  STORAGE_KEY,
  TABS_BY_TERMINAL_KEY,
  NATIVE_TERMINALS_STORAGE_KEY,
} from "./services/terminalStorage";
import {
  loadAgents as loadUnifiedAgents,
  saveAgents as saveUnifiedAgents,
  migrateFromLegacy,
  type UnifiedAgent,
} from "./services/unifiedAgentStorage";
import { extractAndSaveMemories, extractManualMemoryFromInput } from "./services/memoryIntegration";
import { getMemorySettings, addMemory } from "./services/memoryStorage";
import { generateMemoryId } from "./services/memoryExtractor";
import { buildMemoryObserverPrompt } from "./services/memoryObserverPrompt";
import { dispatchMCPMemoryUpdate, type MCPKnowledgeGraph } from "./hooks/useUnifiedMemory";
import { calculateProjectOverhead } from "./services/conversationRecovery";
import { getDuckdroidUrl, getAgentAvatar } from "./utils/agentAvatars";
import { showProjectToast } from "./components/ProjectToast";
import { loadAvailableDroids } from "./utils/skillsAndDroidsLoader";
import { loadProjectColors, getProjectColor, DEFAULT_PROJECT_COLORS } from "./utils/projectColors";
import { cleanupOldSessions } from "./utils/sessionCleanup";
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
  SavedAgent,
  HookConfig,
  KanbanTask,
  KanbanTaskInitialValues,
  AskUserQuestionAnswers,
} from "./types";
import { getRandomName } from "./utils/agentNames";

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
// Terminal <-> UnifiedAgent Conversion Helpers
// ============================================

/**
 * Convert TerminalInfo to UnifiedAgent for storage
 */
function terminalToUnifiedAgent(terminal: TerminalInfo): UnifiedAgent {
  // Extract project name from cwd (last segment of path)
  const projectName = terminal.cwd?.split("/").pop() ?? "Unknown";

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

function AppContent() {
  // Load assets INSIDE the component, not at module level
  const introAudio = new URL("../sounds/quack-intro.mp3", import.meta.url).href;
  const notificationAudio = new URL("../sounds/quack.mp3", import.meta.url).href;
  const duckBackgroundImage = new URL("../images/backgrounds/duck.png", import.meta.url).href;
  const ducksPatternBackgroundImage = new URL("../images/backgrounds/ducks-pattern.png", import.meta.url).href;
  const duckPattern3BackgroundImage = new URL("../images/backgrounds/duck-pattern3.png", import.meta.url).href;
  const quackAgentBackgroundImage = new URL("../images/backgrounds/quack-agent.jpeg", import.meta.url).href;
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

  // System wake handler - prevents blank screen after macOS standby
  useSystemWakeHandler({ debug: true });

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

  // Memory Graph tab management
  const { openMemoryGraphTab } = useMemoryGraphTab();


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


  // Second Brain tab management
  const { openSecondBrainTab } = useSecondBrainTab();

  // Kanban tab management
  const { openKanbanTab } = useKanbanTab();

  // Project Dashboard tab management
  const { openProjectDashboardTab } = useProjectDashboardTab();

  // Kanban sync - emit loading state and task changes to popout windows
  const { emitLoadingState, emitTasksChanged } = useKanbanChatSync();


  // Claude Assets Manager tab - hook is called later after tabs state is defined

  // Terminal Window manager - opens separate Tauri window for terminals
  const { openTerminalWindow, updateProjects: updateTerminalWindowProjects, isOpen: terminalWindowOpen } = useTerminalWindowManager();

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
    }
  }, []);

  // 🗣️ AskUserQuestion: Track pending requests from canUseTool callback
  // Maps requestId -> { agentId, sessionKey, questions } for responding via stdin
  // 🦆 FIX: Added sessionKey to track which specific session has the pending question
  const [pendingUserQuestions, setPendingUserQuestions] = useState<Map<string, { agentId: string; sessionKey?: string; questions: unknown[] }>>(new Map());

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
      const name = path.split('/').pop() || path;

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
  const [explorerTree, setExplorerTree] = useState<
    Record<string, DirectoryEntry[]>
  >({});
  const [explorerRoot, setExplorerRoot] = useState<string | null>(null);

  // 🧠 QUACK MEMORY: Listen for memory-observer background task completion
  useEffect(() => {
    if (!tauriAvailable) return;

    let unlisten: (() => void) | undefined;

    listen<{ taskId: string; result: { success: boolean; output?: string; error?: string } }>(
      'background-task-complete',
      async (event) => {
        const { result } = event.payload;

        // Only process successful memory-observer tasks
        if (!result.success || !result.output) return;

        // Check if this looks like a memory-observer result (contains JSON with memories)
        if (!result.output.includes('"memories"')) return;

        try {
          // Extract JSON from the output (may have surrounding text)
          const jsonMatch = result.output.match(/\{[\s\S]*"memories"[\s\S]*\}/);
          if (!jsonMatch) return;

          const parsed = JSON.parse(jsonMatch[0]);
          if (!parsed.memories || !Array.isArray(parsed.memories)) return;

          console.log(`[Memory Observer] Received ${parsed.memories.length} memories from background task`);

          // Save each extracted memory
          for (const mem of parsed.memories) {
            if (mem.content && mem.category) {
              const now = Date.now();
              await addMemory({
                id: generateMemoryId(),
                content: mem.content,
                category: mem.category as 'preference' | 'fact' | 'decision' | 'pattern' | 'mistake' | 'context',
                confidence: mem.confidence || 'medium',
                scope: explorerPath ? 'project' : 'global',
                keywords: mem.content.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3).slice(0, 10),
                projectPath: explorerPath || undefined,
                createdAt: now,
                lastAccessedAt: now,
                accessCount: 0,
                userVerified: false,
                isArchived: false,
              });
              console.log(`[Memory Observer] Saved memory: ${mem.category} - "${mem.content.substring(0, 50)}..."`);
            }
          }

          // Show toast if memories were saved
          if (parsed.memories.length > 0) {
            toast.success(`Extracted ${parsed.memories.length} memory(s)`, {
              description: 'From tool execution analysis',
              duration: 3000,
            });
          }
        } catch (err) {
          console.warn('[Memory Observer] Failed to parse memories:', err);
        }
      }
    ).then((fn) => {
      unlisten = fn;
    });

    return () => {
      unlisten?.();
    };
  }, [tauriAvailable, explorerPath]);

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
    // Load from localStorage, default to true
    const stored = localStorage.getItem('quackSoundEnabled');
    return stored === null ? true : stored === 'true';
  });
  const [_booting, setBooting] = useState(true);
  // Splash is now handled by native HTML splash in index.html only
  // React SplashScreen is only used for "Watch Intro" replay feature
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [introVersion, setIntroVersion] = useState('');

  // Fetch app version for intro screen
  useEffect(() => {
    getCurrentVersion().then(version => setIntroVersion(`v${version}`));
  }, []);
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    path: string;
  } | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewImageData, setPreviewImageData] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [formattingPreview, setFormattingPreview] = useState(false);
  const [previewDiffInfo, setPreviewDiffInfo] = useState<DiffInfo | null>(null);
  const [previewLineChanges, setPreviewLineChanges] = useState<LineChange[] | null>(null);
  const [previewHasUnsavedChanges, setPreviewHasUnsavedChanges] = useState(false);
  const previewDrawerRef = useRef<FilePreviewDrawerRef>(null);
  const [showGitDrawer, setShowGitDrawer] = useState(false);
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);
  const [showPluginsDrawer, setShowPluginsDrawer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [sidePanelCollapsed, setSidePanelCollapsed] = useState(false);
  // Chat fullscreen mode - hides side panel and expands chat
  const [isChatFullscreen, setIsChatFullscreen] = useState(false);
  // Track sidebar state before Kanban view to restore it on exit
  const sidePanelCollapsedBeforeKanbanRef = useRef<boolean | null>(null);
  // Track if user wants side panel expanded while in Kanban mode (e.g., clicked on project name)
  const [kanbanSidePanelExpanded, setKanbanSidePanelExpanded] = useState(false);
  // Show Kanban Mini Panel in sidebar (toggled via button in Kanban tab header)
  const [showKanbanMiniPanel, setShowKanbanMiniPanel] = useState(false);
  const [emptyStateShowGuide, setEmptyStateShowGuide] = useState(false);

  // Tab system state
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'chat', label: 'Chat', type: 'chat', closable: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('chat');

  // Derived state: is Kanban tab currently active?
  // This replaces the old isKanbanTabActive overlay approach
  const isKanbanTabActive = activeTabId === 'kanban-board';

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
  const IDLE_TIMEOUT_MS = 5000; // 5s - for activity bar (fast response)
  const NOTIFICATION_TIMEOUT_MS = 60000; // 1 minute - for notifications only
  const VISUAL_IDLE_DELAY_MS = 400; // Delay before showing idle status (prevents flickering)
  const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);
  const [savedCommandsDrawerOpen, setSavedCommandsDrawerOpen] = useState(false);
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
  const [proBannerExpanded, setProBannerExpanded] = useState(true);
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

  // Auto-collapse ProBanner after 10 seconds
  useEffect(() => {
    if (!isProUser && proBannerExpanded) {
      const timer = setTimeout(() => {
        setProBannerExpanded(false);
      }, 10000); // 10 seconds

      return () => clearTimeout(timer);
    }
  }, [isProUser, proBannerExpanded]);

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
  const chatConversationHistoryRef = useRef<Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>>(new Map());
  // Agent metadata (name, cwd) for Telegram notifications
  const agentMetadataRef = useRef<Map<string, { name: string; cwd: string }>>(new Map());
  // Last response text per agent for Telegram notifications
  const lastAgentResponseRef = useRef<Map<string, string>>(new Map());
  const [isChatConfigured, setIsChatConfigured] = useState(false);

  // Abort controllers and last prompts for each agent
  // Key format: `${activeId}-${messageId}` to prevent race conditions between concurrent streams
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const lastPromptsRef = useRef<Map<string, string>>(new Map());
  // Track active streams per SESSION (not per agent) to prevent concurrency issues
  // Key is sessionKey (activeSessionId || activeId), Value is Set of streamKeys
  // This allows different sessions of the same agent to be stopped independently
  const activeStreamsRef = useRef<Map<string, Set<string>>>(new Map());
  // Track stream count for UI display (Map of agentId -> count)
  // const [activeStreamCounts, setActiveStreamCounts] = useState<Map<string, number>>(new Map());

  // 🦆 SESSION PERSISTENCE: REMOVED - No longer showing resume messages
  // Users can resume via Sessions panel instead

  // 🦆 RACE CONDITION FIX: Track active event listeners to ensure they're ready before invoke()
  // This prevents the bug where events are emitted before the listener is set up
  const activeListenersRef = useRef<Map<string, () => void>>(new Map());

  // 🦆 EVENT BUFFER FIX: Buffer events that arrive before the streaming message is ready
  // This fixes the intermittent bug where Task/droid widgets don't appear because
  // the event arrives before React's setState has created the streaming message
  const eventBufferRef = useRef<Map<string, ClaudeEvent[]>>(new Map());

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
  }>>(new Map());

  // Project overhead cache - maps cwd to calculated overhead
  // Calculated once per project when agent is activated
  const [projectOverheadCache, setProjectOverheadCache] = useState<Map<string, number>>(new Map());

  // Session ID tracking per agent - for resuming sessions in terminal
  const [chatSessionIds, setChatSessionIds] = useState<Map<string, string>>(new Map());

  // 🗣️ AskUserQuestion state - track pending and answered questions per agent
  const [pendingQuestionIdsMap, setPendingQuestionIdsMap] = useState<Map<string, Set<string>>>(new Map());
  const [answeredQuestionsMap, setAnsweredQuestionsMap] = useState<Map<string, Map<string, AskUserQuestionAnswers>>>(new Map());

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

  // 🦆 SESSIONS-FIRST: Sync chatSessions with chatStore for activity indicators
  // AgentSessionItem needs chatMessages to determine hasUnreadMessages and show "Quack quack..."
  const chatStoreAddMessage = useChatStore((state) => state.addMessage);
  const chatStoreClearSession = useChatStore((state) => state.clearSession);
  const chatStoreGetSession = useChatStore((state) => state.getSession);
  useEffect(() => {
    // Sync each session's messages to chatStore
    chatSessions.forEach((messages, sessionId) => {
      const storeMessages = chatStoreGetSession(sessionId);
      // Check if sync is needed:
      // 1. Different number of messages
      // 2. Last message status changed (e.g., streaming -> complete)
      const lastMsg = messages[messages.length - 1];
      const lastStoreMsg = storeMessages[storeMessages.length - 1];
      const needsSync =
        messages.length !== storeMessages.length ||
        (lastMsg && lastStoreMsg && lastMsg.status !== lastStoreMsg.status);

      if (needsSync) {
        // Clear and re-add all messages (simple but effective)
        chatStoreClearSession(sessionId);
        messages.forEach(msg => {
          chatStoreAddMessage(sessionId, msg);
        });
      }
    });
  }, [chatSessions, chatStoreAddMessage, chatStoreClearSession, chatStoreGetSession]);

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

      const updatedTokens = {
        inputTokens: currentTokens.inputTokens + usage.input_tokens,
        outputTokens: currentTokens.outputTokens + usage.output_tokens,
        cacheCreationTokens: currentTokens.cacheCreationTokens + (usage.cache_creation_input_tokens || 0),
        cacheReadTokens: currentTokens.cacheReadTokens + (usage.cache_read_input_tokens || 0),
        // total_cost_usd is cumulative from SDK, so we just set it (not add)
        totalCost: totalCostUsd ?? currentTokens.totalCost,
      };

      newMap.set(agentId, updatedTokens);

      const total = updatedTokens.inputTokens + updatedTokens.outputTokens +
                   updatedTokens.cacheCreationTokens + updatedTokens.cacheReadTokens;
      console.log(`[Token Tracking] 🦆 Accumulated tokens for agent ${agentId}: ${total} total, cost: $${updatedTokens.totalCost.toFixed(4)}`, updatedTokens);

      // 🦆 STAMINA PRESERVATION: Update agentChats with new token counts for persistence
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
    sessionKey?: string // 🦆 SESSION-FIRST: sessionKey from Rust event wrapper
  ) => {
    const evt = claudeEvent as any;

    // 🦆 SESSION-FIRST FIX: STRICT session isolation - NEVER fallback to agentId
    // If sessionKey is missing, log error and reject the event to prevent mixing
    if (!sessionKey) {
      console.error(`🚨 [${source}] REJECTED event without sessionKey! agentId=${agentId}, type=${claudeEvent.type}. This would cause session mixing.`);
      return; // REJECT event - do not write to any session
    }
    const messageKey = sessionKey;

    console.log(`🎯 [${source}] Event received for agentId=${agentId}, writing to messageKey=${messageKey}:`, {
      type: claudeEvent.type,
      hasMessage: !!evt.message,
      sessionKeyFromEvent: sessionKey,
      contentTypes: evt.message?.content?.map((c: any) => ({ type: c.type, name: c.name })),
    });

    // Update chat session with incoming events using messageKey
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      const sessionMessages = newSessions.get(messageKey) ?? [];
      const lastMsg = sessionMessages[sessionMessages.length - 1];

      // Check if we have a streaming message ready
      if (lastMsg && lastMsg.role === 'assistant' && lastMsg.status === 'streaming') {
        // 🦆 BUFFER FLUSH: First, check if there are buffered events to apply
        // 🦆 SESSION-FIRST: Use messageKey for buffer (parallel sessions need separate buffers)
        const bufferedEvents = eventBufferRef.current.get(messageKey) || [];
        if (bufferedEvents.length > 0) {
          console.log(`🦆 [${source}] Flushing ${bufferedEvents.length} buffered events for messageKey=${messageKey}`);
          eventBufferRef.current.delete(messageKey);
        }

        const updatedMessages = [...sessionMessages];

        // Combine buffered events with current event
        const allEvents = [...bufferedEvents, claudeEvent];

        // Check if this is the first assistant response (for timestamp update)
        const isFirstAssistantResponse = claudeEvent.type === 'assistant' &&
                                         claudeEvent.message?.content &&
                                         claudeEvent.message.content.length > 0 &&
                                         lastMsg.timestamp === 0;

        updatedMessages[updatedMessages.length - 1] = {
          ...lastMsg,
          events: [...(lastMsg.events || []), ...allEvents],
          timestamp: isFirstAssistantResponse ? Date.now() : lastMsg.timestamp,
        };
        newSessions.set(messageKey, updatedMessages);

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
        const buffer = eventBufferRef.current.get(messageKey) || [];
        buffer.push(claudeEvent);
        eventBufferRef.current.set(messageKey, buffer);
      }

      return newSessions;
    });

    // Handle token updates from result events - use messageKey for token tracking
    if (claudeEvent.type === 'result' && claudeEvent.usage) {
      console.log(`[${source}] 🦆 Token update for messageKey=${messageKey}:`, claudeEvent.usage, `cost: $${claudeEvent.total_cost_usd || 0}`);
      handleTokenUpdate(messageKey, claudeEvent.usage, claudeEvent.total_cost_usd);
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
        return [...prev, newSession];
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
    const pathParts = cwd.split('/').filter(Boolean);
    const project = pathParts[pathParts.length - 1] || '';
    setProjectName(project);

    // Use the branch associated with this terminal (agent workspace)
    // instead of the current repository branch on disk
    if (activeTerminal.branch) {
      setGitBranch(activeTerminal.branch);
    } else {
      // Fallback: Get current git branch from disk if no branch is assigned to terminal
      invoke<string>('git_current_branch', { rootPath: cwd })
        .then((branch) => {
          setGitBranch(branch.trim());
        })
        .catch(() => {
          setGitBranch(''); // Not a git repository or error
        });
    }
  }, [activeTerminal, tauriAvailable]);

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

  // Sync terminal status with chatLoadingMap and check if waiting for response
  useEffect(() => {
    setTerminals((prev) => {
      return prev.map((terminal) => {
        const isLoading = chatLoadingMap.get(terminal.id) ?? false;
        const newStatus = isLoading ? 'busy' : 'idle';

        // Check if chat is waiting for user response
        const chatMessages = chatSessions.get(terminal.id) ?? [];
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

        // Debug logging
        if (terminal.label === 'Agent Carlos') {
          console.log(`[App.tsx] 🔔 ${terminal.label} waitingForResponse calculation:`, {
            isLoading,
            messagesCount: chatMessages.length,
            hasUserMessage,
            isDormant,
            lastMessageRole: lastMessage?.role,
            lastMessageStatus: lastMessage?.status,
            result: isWaitingForResponse
          });
        }

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

    // Save current tabs for previous agent (if any)
    if (previousId && previousId !== activeId) {
      // console.log(`🦆 [Tab Management] Saving tabs for agent: ${previousId}`, tabs); // Performance: Disabled logging
      setTabsByTerminal((prev) => {
        const updated = new Map(prev);
        // Filter out chat tab (always present) and special tabs - save only file tabs
        // Special tabs persist across agents and shouldn't be stored per-agent
        const specialTabTypes = [
          'kanban', 'docs', 'second-brain', 'memory-graph', 'claude-assets',
          'agent', 'skill', 'command', 'browser-manager', 'agent-terminal', 'chat'
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
      const specialTabTypes = [
        'kanban', 'docs', 'second-brain', 'memory-graph', 'claude-assets',
        'agent', 'skill', 'command', 'browser-manager', 'agent-terminal'
      ];

      // Always include chat tab + restored agent tabs + preserve special tabs
      setTabs(prevTabs => {
        const specialTabs = prevTabs.filter(t => specialTabTypes.includes(t.type));
        return [
          { id: 'chat', label: 'Chat', type: 'chat', closable: false },
          ...restoredTabs,
          ...specialTabs
        ];
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
    }

    // Update previous activeId ref
    previousActiveIdRef.current = activeId;
  }, [activeId]); // Only depend on activeId change

  // 🦆 Ref to sendMessageForAgent function (to avoid circular dependency)
  const sendMessageForAgentRef = useRef<((content: string, options?: ChatSendOptions) => Promise<void>) | null>(null);

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

  // 🦆 RACE CONDITION FIX: Only track agent IDs, not full chatSessions
  // This prevents rapid listener teardown/setup during streaming which causes
  // "listeners[eventId].handlerId" errors from Tauri's event system
  const activeAgentIdsKey = Array.from(chatSessions.keys()).sort().join(',');

  useEffect(() => {
    if (!tauriAvailable) return;

    // Get all agent IDs that have chat sessions
    const activeAgentIds = activeAgentIdsKey.split(',').filter(Boolean);

    // Track which listeners we're setting up in THIS effect run
    const newlyCreatedListeners = new Set<string>();

    // Setup listener for each active agent (only if not already active)
    const setupPromises = activeAgentIds.map(async (agentId) => {
      // 🦆 RACE FIX: Skip if listener already exists (created by ensureListenerReady)
      if (activeListenersRef.current.has(agentId)) {
        console.log(`[Multi-Listener] Listener already exists for agent: ${agentId}`);
        return;
      }

      const eventName = `claude-event:${agentId}`;

      try {
        // 🦆 SESSION-FIRST: Events now come wrapped with sessionKey
        // Payload structure: { sessionKey: string, event: ClaudeEvent }
        const unlisten = await listen<{ sessionKey: string; event: ClaudeEvent }>(eventName, (event) => {
          const { sessionKey, event: claudeEvent } = event.payload;

          // 🦆 EVENT BUFFER FIX: Use centralized event handler with buffering support
          // 🦆 SESSION-FIRST: Pass sessionKey so events go to the correct chat session
          handleClaudeEvent(agentId, claudeEvent, 'Multi-Listener', sessionKey);

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

                        // Check if this is a result from mcp__memory__read_graph
                        // The content might be a string or have a text field
                        const resultContent = typeof content.content === 'string'
                          ? content.content
                          : content.content?.[0]?.text || content.text || JSON.stringify(content.content);

                        // Look for knowledge graph structure in the result
                        if (resultContent && resultContent.includes('entities') && resultContent.includes('relations')) {
                          console.log('[MCP Memory] 📊 Found potential knowledge graph data');
                          try {
                            // Try to parse the JSON from the result
                            const jsonMatch = resultContent.match(/\{[\s\S]*"entities"[\s\S]*"relations"[\s\S]*\}/);
                            if (jsonMatch) {
                              const graphData = JSON.parse(jsonMatch[0]) as MCPKnowledgeGraph;
                              console.log('[MCP Memory] ✅ Parsed knowledge graph:', {
                                entities: graphData.entities?.length || 0,
                                relations: graphData.relations?.length || 0,
                                entityNames: graphData.entities?.map(e => e.name),
                              });
                              // Dispatch event to update Memory Panel
                              dispatchMCPMemoryUpdate(graphData);
                            } else {
                              console.log('[MCP Memory] ⚠️ JSON match failed, trying direct parse');
                              // Try direct parse
                              const graphData = JSON.parse(resultContent) as MCPKnowledgeGraph;
                              if (graphData.entities) {
                                console.log('[MCP Memory] ✅ Direct parse succeeded:', {
                                  entities: graphData.entities?.length || 0,
                                  relations: graphData.relations?.length || 0,
                                });
                                dispatchMCPMemoryUpdate(graphData);
                              }
                            }
                          } catch (parseErr) {
                            console.warn('[MCP Memory] ❌ Failed to parse knowledge graph:', parseErr);
                          }
                        }
                      }
                    });
                  }
                });

                // Trigger FileExplorer refresh if files were modified
                if (hasFileModifications) {
                  setRefreshExplorerTrigger(prev => prev + 1);
                }

                // 🧠 QUACK MEMORY: Launch memory-observer for tool executions
                // Uses built-in prompt (no external droid file needed)
                if (toolExecutions.length > 0) {
                  console.log(`[Memory Observer] Tool executions detected: ${toolExecutions.length}`,
                    toolExecutions.map(t => t.name));

                  // Launch async task outside of setter (to avoid blocking React)
                  setTimeout(async () => {
                    try {
                      const settings = await getMemorySettings();
                      console.log('[Memory Observer] Settings check:', {
                        enabled: settings.enabled,
                        llmExtractionTrigger: settings.llmExtractionTrigger,
                        extractionMode: settings.extractionMode,
                      });

                      // Only run if memory is enabled and tool-based extraction is on
                      if (settings.enabled && settings.llmExtractionTrigger === 'tool-based') {
                        // Build the full prompt with embedded system instructions
                        const memoryObserverPrompt = buildMemoryObserverPrompt(toolExecutions);

                        console.log(`[Memory Observer] Launching for ${toolExecutions.length} tool(s):`,
                          toolExecutions.map(t => t.name).join(', '));

                        // TODO: Memory Observer now needs to use Kanban shell tasks
                        // Old runDroidInBackground removed, needs migration
                        console.log('[Memory Observer] Background agent not yet migrated to Kanban');
                      } else {
                        console.log('[Memory Observer] Skipping - conditions not met:', {
                          enabled: settings.enabled,
                          trigger: settings.llmExtractionTrigger,
                          expected: 'tool-based',
                        });
                      }
                    } catch (err) {
                      console.warn('[Memory Observer] Failed to launch:', err);
                    }
                  }, 0);
                }
              }

              // Return unchanged - we're just reading, not modifying
              return currentSessions;
            });
          }
        });

        // 🦆 RACE FIX: Store in shared ref instead of local map
        activeListenersRef.current.set(agentId, unlisten);
        newlyCreatedListeners.add(agentId);
        console.log(`[Multi-Listener] Listener registered for agent: ${agentId}`);
      } catch (error) {
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

  // 🦆 PRE-WARM LISTENER: Setup listener when agent is selected (before first message)
  // This reuses the same listener setup logic as multi-listener but triggers on activeId change
  // instead of waiting for chatSessions to update
  useEffect(() => {
    if (!tauriAvailable || !activeId) return;

    // If listener already exists, nothing to do
    if (activeListenersRef.current.has(activeId)) {
      console.log(`[Pre-warm] Listener already exists for activeId: ${activeId}`);
      return;
    }

    // Setup listener for the active agent NOW (before any message is sent)
    const eventName = `claude-event:${activeId}`;
    console.log(`[Pre-warm] Setting up listener for activeId: ${activeId}`);

    // 🦆 EVENT BUFFER FIX: Use centralized event handler with buffering support
    // 🦆 SESSION-FIRST: Events now come wrapped with sessionKey
    listen<{ sessionKey: string; event: ClaudeEvent }>(eventName, (event) => {
      const { sessionKey, event: claudeEvent } = event.payload;
      handleClaudeEvent(activeId, claudeEvent, 'Pre-warm', sessionKey);
    }).then((unlisten) => {
      activeListenersRef.current.set(activeId, unlisten);
      console.log(`[Pre-warm] Listener ready for activeId: ${activeId}`);
    }).catch((error) => {
      console.error(`[Pre-warm] Failed for ${activeId}:`, error);
    });
  }, [tauriAvailable, activeId]);

  // 🦆 SESSION PERSISTENCE: REMOVED - Agents always start fresh
  // Users can resume sessions via Sessions panel -> "Resume Session" button
  // This simplifies UX and avoids confusion about session continuity

  // 🦆 RACE CONDITION FIX: Helper function to ensure listener is ready for an agent
  // This prevents events being emitted before the listener is set up
  const ensureListenerReady = useCallback(async (agentId: string) => {
    // If listener already exists, we're good
    if (activeListenersRef.current.has(agentId)) {
      console.log(`[Listener] Already active for agent: ${agentId}`);
      return;
    }

    // Set up a new listener for this agent
    const eventName = `claude-event:${agentId}`;
    console.log(`[Listener] Setting up listener for agent: ${agentId}`);

    try {
      // 🦆 SESSION-FIRST: Events now come wrapped with sessionKey
      const unlisten = await listen<{ sessionKey: string; event: ClaudeEvent }>(eventName, (event) => {
        const { sessionKey, event: claudeEvent } = event.payload;

        // 🦆 EVENT BUFFER FIX: Use centralized event handler with buffering support
        // 🦆 SESSION-FIRST: Pass sessionKey so events go to the correct chat session
        handleClaudeEvent(agentId, claudeEvent, 'ensureListenerReady', sessionKey);

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

      // Store the unlisten function
      activeListenersRef.current.set(agentId, unlisten);
      console.log(`[Listener] Ready for agent: ${agentId}`);
    } catch (error) {
      console.error(`[Listener] Failed to setup for ${agentId}:`, error);
    }
  }, [handleClaudeEvent]);

  // Send message for specific agent
  // 🦆 SESSION-FIRST: Use chatKey (sessionId when available) for message storage
  // but keep using activeId (agentId) for Claude SDK routing and event listeners
  const sendMessageForAgent = useCallback(async (content: string, options?: ChatSendOptions) => {
    // #region agent log
    fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:sendMessageForAgent',message:'🚀 sendMessageForAgent CALLED',data:{content:content?.substring(0,100),activeId,activeSessionId,stack:new Error().stack?.split('\n').slice(0,10)},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'A-send-call'})}).catch(()=>{});
    // #endregion
    if (!content.trim() || !activeId) return;

    // 🦆 SESSION-FIRST: Require an active session to send messages
    // The empty state UI prevents users from typing without a session selected
    // If we reach this point without a session, something is wrong - bail out
    if (!activeSessionId) {
      console.error(`🦆 [SESSION-FIRST] No active session selected - cannot send message`);
      toast.error('Please select a session first');
      return;
    }

    const messageKey = activeSessionId;
    console.log(`🦆 [SESSION-FIRST] Sending message to session: ${messageKey}`);

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

    // Populate ref for Telegram integration (on first call)
    if (!sendMessageForAgentRef.current) {
      sendMessageForAgentRef.current = sendMessageForAgent;
    }

    // 🧠 QUACK MEMORY: Check for manual '#' trigger to save memory directly
    if (content.trim().startsWith('#')) {
      try {
        const savedMemory = await extractManualMemoryFromInput(
          content,
          activeId, // sessionId
          explorerPath || undefined // projectPath
        );
        if (savedMemory) {
          console.log(`[sendMessageForAgent] 🧠 Manual memory saved: ${savedMemory.category} - "${savedMemory.content.substring(0, 50)}..."`);
          toast.success(`Memory saved: ${savedMemory.category}`, {
            description: savedMemory.content.substring(0, 100),
            duration: 3000,
          });
        }
      } catch (memErr) {
        console.warn('[sendMessageForAgent] Manual memory extraction failed:', memErr);
      }
      // Continue sending the message to the AI regardless
    }

    // 🦆 RACE CONDITION FIX: Ensure listener is ready BEFORE calling invoke
    // Note: The real fix was removing the cleanup logic that was removing listeners
    // prematurely. Now listeners persist until the agent is explicitly deleted.
    await ensureListenerReady(activeId);

    // 🦆 CRITICAL: Wait for Tauri to fully register the listener internally
    // The listen() promise resolves immediately, but Tauri's internal event routing
    // may not be ready yet. This delay ensures events don't get lost.
    // Without this, the first Task event can be emitted before the listener catches it.
    console.log(`[sendMessage] Listener ready for ${activeId}, waiting for Tauri registration...`);
    await new Promise(resolve => setTimeout(resolve, 150));
    console.log(`[sendMessage] Tauri registration delay complete for ${activeId}`);

    // Generate unique message ID for this stream
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const streamKey = `${activeId}-${messageId}`;

    // 🦆 SESSION-FIRST: No need to check for active streams or block - events now contain sessionKey
    // Each stream sends its sessionKey to Rust, which includes it in emitted events
    // The event handler uses the sessionKey from the event to route to the correct chat session
    console.log(`[sendMessage] Starting stream ${streamKey} for session ${messageKey}`);

    // Save the prompt for restoration on abort
    lastPromptsRef.current.set(activeId, content);

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
        id: `msg-${Date.now()}-error`,
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

    // 🦆 SESSION-FIRST: Get current session's chat messages using messageKey
    const currentMessages = chatSessions.get(messageKey) ?? [];

    // 🦆 Create AgentChat automatically if it doesn't exist (for UI-created agents)
    if (!agentChats.find(a => a.id === activeId)) {
      // Get terminal info for this activeId
      const terminal = terminals.find(t => t.id === activeId);
      if (terminal) {
        const newAgentChat: AgentChat = {
          id: activeId,
          name: terminal.label,
          color: terminal.color,
          cwd: terminal.cwd,
          createdAt: Date.now(),
        };

        setAgentChats((prev) => [...prev, newAgentChat]);

        // Save metadata for Telegram notifications
        agentMetadataRef.current.set(activeId, {
          name: terminal.label,
          cwd: terminal.cwd,
        });

        console.log('🦆 Auto-created AgentChat for UI-created agent:', newAgentChat);
      }
    }

    // Create user message
    const attachments = options?.attachments ?? [];
    const attachmentLines = attachments.map((item, index) => `Attachment ${index + 1}: ${item.path}`);
    const contentWithAttachments =
      attachmentLines.length > 0
        ? `${content}\n\nAttachments:\n${attachmentLines.join('\n')}`
        : content;

    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
      attachments,
    };

    // Add user message to agent's chat session
    const messagesToAdd: ChatMessage[] = [userMessage];

    // If agent is selected, add system message showing agent invocation
    if (activeAgent) {
      const agentSystemMessage: ChatMessage = {
        id: `msg-${Date.now()}-agent-system-${activeId}`, // Include activeId for uniqueness
        role: 'system',
        content: `🦆 Invoking droid: **${activeAgent.name}**`,
        timestamp: Date.now() + 1, // Slightly after user message
        status: 'complete',
        metadata: {
          sessionId: activeId, // Track which session this message belongs to
        },
      };
      messagesToAdd.push(agentSystemMessage);
    }

    // 🦆 SESSION-FIRST: Add messages to session using messageKey
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      newSessions.set(messageKey, [...currentMessages, ...messagesToAdd]);
      return newSessions;
    });

    // Track chat message sent to PostHog
    const messageStartTime = performance.now();
    posthog.capture('ai_message_sent', {
      agent_id: activeId,
      agent_name: activeAgent?.name || 'unknown',
      has_attachments: attachments.length > 0,
      attachments_count: attachments.length,
      model: options?.model || 'sonnet',
      thinking_mode: options?.thinkingMode || 'auto',
      message_length: content.length,
    });

    // Create assistant message placeholder with settings metadata (SDK 0.1.54+)
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      // 🦆 FIX: Start with timestamp = 0 so it doesn't affect sorting until assistant responds
      // Timestamp will be updated to Date.now() when first response arrives (see event listener)
      timestamp: 0,
      status: 'streaming',
      // Store settings used for this message (for UI display)
      settings: {
        model: (options?.model || 'sonnet') as 'opus' | 'sonnet' | 'haiku',
        effort: options?.effort || 'medium',
        thinkingMode: options?.thinkingMode || 'auto',
      },
    };

    // 🦆 SESSION-FIRST: Clear previous response text for this session (new conversation turn)
    lastAgentResponseRef.current.delete(messageKey);

    // 🦆 EVENT BUFFER FIX: Clear any stale buffered events from previous conversations for this session
    // 🦆 SESSION-FIRST: Use messageKey for buffer (parallel sessions need separate buffers)
    eventBufferRef.current.delete(messageKey);

    // 🦆 SESSION-FIRST: Add assistant message placeholder using messageKey
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      const sessionMessages = newSessions.get(messageKey) ?? [];

      // 🦆 EVENT BUFFER FIX: Check if there are buffered events to apply immediately
      // This handles the race condition where events arrive before this setState completes
      // 🦆 SESSION-FIRST: Use messageKey for buffer
      const bufferedEvents = eventBufferRef.current.get(messageKey) || [];
      if (bufferedEvents.length > 0) {
        console.log(`🦆 [sendMessageForAgent] Flushing ${bufferedEvents.length} buffered events for messageKey=${messageKey}`);
        eventBufferRef.current.delete(messageKey);

        // Apply buffered events to the new assistant message
        const messageWithBufferedEvents = {
          ...assistantMessage,
          events: bufferedEvents,
        };
        newSessions.set(messageKey, [...sessionMessages, messageWithBufferedEvents]);
      } else {
        newSessions.set(messageKey, [...sessionMessages, assistantMessage]);
      }

      return newSessions;
    });

    try {
      // Build context from agent's conversation history
      const agentHistory = chatConversationHistoryRef.current.get(activeId) ?? [];
      let prompt = contentWithAttachments;
      if (agentHistory.length > 0) {
        const history = agentHistory
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        prompt = `${history}\n\nUser: ${contentWithAttachments}`;
      }

      // Call Rust backend for SDK streaming
      // Events are received via the claude-event listener above
      const workingDir = getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);

      // Create abort promise that rejects when signal is aborted
      const abortPromise = new Promise<never>((_, reject) => {
        if (abortController.signal.aborted) {
          reject(new Error('Aborted'));
        }
        abortController.signal.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
      });

      // 🦆 SIMPLIFIED: Always start fresh conversation
      // Users can resume sessions via Sessions panel -> "Resume Session" button
      // #region agent log
      fetch('http://127.0.0.1:7243/ingest/3ea3e874-66c9-4ccd-807c-e75a9897e915',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'App.tsx:send_message_via_sdk_streaming',message:'🔥 CALLING CLAUDE API',data:{prompt:prompt?.substring(0,200),activeId,messageKey,workingDir},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'D-api-call'})}).catch(()=>{});
      // #endregion
      // Race between invoke and abort
      const response = await Promise.race([
        invoke<{
          result: string;
          session_id: string;
          total_cost_usd: number;
          usage: UsageStats;
        }>('send_message_via_sdk_streaming', {
          agentId: activeId,
          request: {
            prompt,
            model: options?.model || 'sonnet',
            thinkingMode: options?.thinkingMode,
            permissionMode: options?.permissionMode,
            attachments: attachments.map(a => a.path),
            // Pass all available droids for @mention invocation
            // The SDK will recognize @droid-name syntax and delegate to the appropriate agent
            agents: availableDroids.length > 0 ? availableDroids.map(droid => ({
              name: droid.id.replace('global-', ''), // Use ID as name for @mention matching
              description: droid.description,
              model: 'sonnet', // Default model for droids
              filePath: droid.path,
            })) : undefined,
            cwd: workingDir,
            // 🦆 SESSION-FIRST: Use claudeSessionId from active session for resuming
            // If session has no claudeSessionId yet, don't pass one (creates NEW Claude session)
            sessionId: agentSessions.find(s => s.id === messageKey)?.claudeSessionId,
            // 🦆 SESSION-FIRST: Pass sessionKey so Rust can include it in emitted events
            // This enables parallel conversations - each stream knows where to route events
            sessionKey: messageKey,
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
            // 🧠 User-selected priority keywords for memory search (3x weight)
            userKeywords: options?.userKeywords || [],
          },
        }),
        abortPromise,
      ]);

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
                }
              : msg
          )
        );
        return newSessions;
      });

      // Add to agent's conversation history
      const updatedHistory = [
        ...agentHistory,
        {
          role: 'user' as const,
          content: contentWithAttachments,
        },
        {
          role: 'assistant' as const,
          content: response.result,
        },
      ];
      chatConversationHistoryRef.current.set(activeId, updatedHistory);

      // 🧠 Quack Memory: Auto-extract memories from AI response
      try {
        const workingDir = getEffectiveWorkingDir(activeTerminal?.cwd, explorerPath);
        const memoriesExtracted = await extractAndSaveMemories(
          response.result,
          response.session_id,
          workingDir
        );
        if (memoriesExtracted > 0) {
          console.log(`[sendMessageForAgent] 🧠 Extracted ${memoriesExtracted} memories`);
        }
      } catch (memErr) {
        // Non-critical, don't block chat
        console.warn('[sendMessageForAgent] Memory extraction failed:', memErr);
      }

      // 🦆 SESSION-FIRST FIX: Save Claude session ID to the SPECIFIC session (not agent!)
      // Each session has its own claudeSessionId for independent conversations
      // The messageKey is the session ID, which is what we need to use
      try {
        await updateSession(messageKey, {
          claudeSessionId: response.session_id,
          updatedAt: Date.now(),
        });
        console.log(`[SESSION-FIX] Saved claudeSessionId ${response.session_id.slice(0, 8)}... to session ${messageKey}`);
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
      const agentLabel = activeTerminal?.label || activeAgent?.name || 'AI Assistant';
      trackUsage(
        activeId,
        agentLabel,
        response.session_id,
        response.total_cost_usd,
        response.usage  // ✅ Now passing full usage stats from Rust backend!
      );

      // Notify that agent response is complete
      const agentCwd = activeTerminal?.cwd || explorerPath || '';
      notifyAgentReadyRef.current({ id: activeId, label: agentLabel, cwd: agentCwd });

      // Track successful AI response to PostHog
      const responseTime = Math.round(performance.now() - messageStartTime);
      posthog.capture('ai_response_received', {
        agent_id: activeId,
        agent_name: agentLabel,
        response_time_ms: responseTime,
        response_length: response.result?.length || 0,
        model: options?.model || 'sonnet',
        session_id: response.session_id,
        total_cost_usd: response.total_cost_usd,
      });

      // Keep active agent persistent - don't reset after sending
      // The agent stays active until explicitly cleared by the user
    } catch (err) {
      console.error('Error calling Claude SDK:', err);

      // Track error to PostHog
      const errorMsg = err instanceof Error ? err.message : String(err);
      const wasAborted = abortController.signal.aborted;
      posthog.capture('ai_error', {
        agent_id: activeId,
        error_type: wasAborted ? 'user_aborted' : 'stream_error',
        error_message: errorMsg.substring(0, 200),
        model: options?.model || 'sonnet',
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
                    content: 'Stream stopped by user',
                    status: 'error' as const,
                    error: 'Aborted',
                  }
                : msg
            )
          );
          return newSessions;
        });
      } else {
        const errorMessage =
          err instanceof Error
            ? err.message
            : typeof err === 'string'
              ? err
              : 'Unknown error';

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
                    content: `Quack! 🦆 I encountered an error: ${errorMessage}`,
                    status: 'error' as const,
                    error: errorMessage,
                  }
                : msg
            )
          );
          return newSessions;
        });
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
  }, [activeId, activeSessionId, agentSessions, terminals, isChatConfigured, chatSessions, activeAgent, activeTerminal?.cwd, explorerPath, availableDroids, ensureListenerReady, updateSession]);

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
      console.log('[loadKanbanChatSessions] No Kanban tasks with sessionIds to load');
      return;
    }

    console.log(`[loadKanbanChatSessions] Loading ${tasksWithSessions.length} Kanban chat sessions...`);

    // Load Quack storage first (contains full ChatMessage[] with events for tool widgets)
    let store: Awaited<ReturnType<typeof Store.load>> | null = null;
    try {
      store = await Store.load('quack-chats.json');
    } catch (error) {
      console.warn('[loadKanbanChatSessions] Could not load quack-chats.json store:', error);
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
                console.log(`[loadKanbanChatSessions] ✅ Updated messages for task ${task.id} (had: ${existingMessages?.length || 0}, now: ${savedChat.messages.length}, hasEvents: ${savedHasEvents})`);
              } else {
                console.log(`[loadKanbanChatSessions] 🛡️ PROTECTED: Keeping in-memory messages for task ${task.id} (${existingMessages?.length} msgs with events: ${existingHasEvents})`);
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

            console.log(`[loadKanbanChatSessions] Restored ${savedChat.messages.length} messages with events for task ${task.id} from Quack storage`);
            continue; // Successfully loaded, skip Rust backend fallback
          }
        }

        // Fallback: Load from Rust backend (loses events, shows raw text only)
        console.log(`[loadKanbanChatSessions] Falling back to Rust backend for task ${task.id}`);
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
              console.log(`[loadKanbanChatSessions] Loaded ${chatMessages.length} messages from Rust for task ${task.id} ${newHasEvents ? 'WITH EVENTS' : 'without events'}`);
            } else {
              console.log(`[loadKanbanChatSessions] 🛡️ PROTECTED: Skipping Rust fallback for task ${task.id} - keeping in-memory messages with events. Session integrity preserved.`);
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
              console.log(`[loadKanbanChatSessions] Saved ${chatMessages.length} messages ${hasEvents ? 'WITH EVENTS' : 'without events (no better data exists)'} to store for task ${task.id}`);
            } else {
              console.log(`[loadKanbanChatSessions] 🛡️ PROTECTED: Skipping save for task ${task.id} - would overwrite event-rich messages with event-less fallback data. Session integrity preserved.`);
            }
          }

          console.log(`[loadKanbanChatSessions] Restored ${chatMessages.length} messages (raw text) for task ${task.id} from Rust backend`);
        }
      } catch (error) {
        console.warn(`[loadKanbanChatSessions] Failed to load session ${task.sessionId} for task ${task.id}:`, error);
        // Continue loading other sessions even if one fails
      }
    }
  }, []);

  // 🦆 Save Kanban chat session to persistent storage for MCP access
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
        id: `msg-${Date.now()}-error`,
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

    // 🦆 SESSIONS-FIRST: Use session's projectPath as working directory
    // (Worktree isolation not used in sessions-first architecture)
    const effectiveWorkingDirectory = updatedSession?.projectPath || options?.workingDirectory || '/';
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
    const currentMessages = chatSessions.get(targetAgentId) ?? [];

    // Create user message
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'sending',
    };

    // Add user message
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      newSessions.set(targetAgentId, [...currentMessages, userMessage]);
      return newSessions;
    });

    // Set loading for this agent
    setChatLoadingMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(targetAgentId, true);
      return newMap;
    });

    // Create assistant message placeholder
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: 0,
      status: 'streaming',
      settings: {
        model: (options?.model || 'sonnet') as 'opus' | 'sonnet' | 'haiku',
        effort: options?.effort || 'medium',
        thinkingMode: options?.thinkingMode || 'auto',
      },
    };

    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      const agentMessages = newSessions.get(targetAgentId) ?? [];

      // 🦆 EVENT BUFFER FIX: Flush buffered events to prevent race condition
      // Same pattern as sendMessageForAgent (line ~1914-1940)
      const bufferedEvents = eventBufferRef.current.get(targetAgentId) || [];
      if (bufferedEvents.length > 0) {
        console.log(`🦆 [sendMessageForTargetAgent] Flushing ${bufferedEvents.length} buffered events for ${targetAgentId}`);
        eventBufferRef.current.delete(targetAgentId);
        const messageWithBufferedEvents = {
          ...assistantMessage,
          events: bufferedEvents,
        };
        newSessions.set(targetAgentId, [...agentMessages, messageWithBufferedEvents]);
      } else {
        newSessions.set(targetAgentId, [...agentMessages, assistantMessage]);
      }
      return newSessions;
    });

    try {
      // Ensure listener is ready for this Kanban task
      await ensureListenerReady(targetAgentId);
      await new Promise(resolve => setTimeout(resolve, 150));

      // Build context from conversation history
      const agentHistory = chatConversationHistoryRef.current.get(targetAgentId) ?? [];
      let prompt = content;
      if (agentHistory.length > 0) {
        const history = agentHistory
          .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
          .join('\n\n');
        prompt = `${history}\n\nUser: ${content}`;
      }

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
          request: {
            prompt,
            model: options?.model || 'sonnet',
            thinkingMode: options?.thinkingMode,
            permissionMode: options?.permissionMode,
            // Extract only file paths from ChatAttachment objects - Rust expects Vec<String>
            attachments: (options?.attachments || []).map(att => att.path).filter(Boolean),
            // 🦆 WORKTREE ISOLATION: Use effectiveWorkingDirectory which prioritizes worktreePath
            cwd: effectiveWorkingDirectory,
            sessionId: existingSessionId, // 🦆 Pass existing sessionId for conversation continuity
            effort: options?.effort,
            // 🗣️ Enable interactive tools like AskUserQuestion (SDK v0.1.71+)
            // NOTE: Must use camelCase because Rust struct uses #[serde(rename_all = "camelCase")]
            allowedTools: [
              'Skill', 'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
              'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
              'AskUserQuestion',
            ],
            // 🧠 User-selected priority keywords for memory search (3x weight)
            userKeywords: options?.userKeywords || [],
            // 🦆 FIX: Pass sessionKey for AskUserQuestion event routing
            // This ensures ask-user-question events are emitted with the same key
            // that the frontend uses to identify the session (targetAgentId)
            sessionKey: targetAgentId,
          },
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
                }
              : msg
          )
        );
        return newSessions;
      });

      // Add to conversation history
      const updatedHistory = [
        ...agentHistory,
        { role: 'user' as const, content },
        { role: 'assistant' as const, content: response.result },
      ];
      chatConversationHistoryRef.current.set(targetAgentId, updatedHistory);

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
        });
        return newMap;
      });

      console.log(`[sendMessageForTargetAgent] Completed for ${targetAgentId}, session_id: ${response.session_id}`);

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

      // 🦆 Save chat session to persistent storage for MCP Kanban access
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
          model: (options?.model || 'sonnet') as 'opus' | 'sonnet' | 'haiku',
          effort: options?.effort || 'medium',
          thinkingMode: options?.thinkingMode || 'auto',
        },
      };
      const messagesToSave = [...currentMessages, finalUserMessage, finalAssistantMessage];
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
  }, [isChatConfigured, chatSessions, ensureListenerReady, saveKanbanChatSession]);

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
  }, []);

  // Clear conversation for a specific agent (used by Kanban)
  const clearConversationForTargetAgent = useCallback((targetAgentId: string) => {
    // Clear local UI state
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      newSessions.set(targetAgentId, []);
      return newSessions;
    });

    // Clear conversation history
    chatConversationHistoryRef.current.delete(targetAgentId);

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
        request: {
          prompt: compactPrompt,
          model: 'haiku', // Use faster model for summaries
          permissionMode: 'bypass',
          cwd: workingDir,
          allowedTools: [
            'Skill', 'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
            'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
            'AskUserQuestion',
          ],
          // 🦆 FIX: Pass sessionKey for AskUserQuestion event routing
          sessionKey: targetAgentId,
        },
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

      // Get current tokens and estimate reduction
      const currentTokens = chatTokensMap.get(targetAgentId);
      const currentInputTokens = currentTokens?.inputTokens || 0;
      const currentOutputTokens = currentTokens?.outputTokens || 0;

      // Estimate 60% reduction (based on removed messages)
      const reducedInputTokens = Math.floor(currentInputTokens * 0.4);
      const reducedOutputTokens = Math.floor(currentOutputTokens * 0.4);
      const savedTokens = (currentInputTokens + currentOutputTokens) - (reducedInputTokens + reducedOutputTokens);

      // Update token counts
      setChatTokensMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(targetAgentId, {
          inputTokens: reducedInputTokens,
          outputTokens: reducedOutputTokens,
          cacheCreationTokens: currentTokens?.cacheCreationTokens || 0,
          cacheReadTokens: currentTokens?.cacheReadTokens || 0,
          totalCost: currentTokens?.totalCost || 0, // Preserve cost through compaction
        });
        return newMap;
      });

      toast.dismiss('compacting');
      toast.success(`Compacted! ${messagesToSummarize.length} messages → 1 summary. ~${savedTokens.toLocaleString()} tokens freed`, {
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
  }, [chatSessions, chatTokensMap, explorerPath]);

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
        request: {
          prompt: compactPrompt,
          model: 'haiku', // Use faster model for summaries
          permissionMode: 'bypass',
          cwd: activeTerminal?.cwd ?? explorerPath,
          // 🗣️ Enable interactive tools (SDK v0.1.71+) - though AskUserQuestion unlikely for /compact
          // NOTE: Must use camelCase because Rust struct uses #[serde(rename_all = "camelCase")]
          allowedTools: [
            'Skill', 'Task', 'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep',
            'WebFetch', 'WebSearch', 'TodoWrite', 'NotebookEdit', 'SlashCommand',
            'AskUserQuestion',
          ],
          // 🦆 FIX: Pass sessionKey for AskUserQuestion event routing
          sessionKey: activeId,
        },
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

      // Get current tokens and estimate reduction
      const currentTokens = chatTokensMap.get(chatKey);
      const currentInputTokens = currentTokens?.inputTokens || 0;
      const currentOutputTokens = currentTokens?.outputTokens || 0;

      // Estimate 60% reduction (based on removed messages)
      const reducedInputTokens = Math.floor(currentInputTokens * 0.4);
      const reducedOutputTokens = Math.floor(currentOutputTokens * 0.4);
      const savedTokens = (currentInputTokens + currentOutputTokens) - (reducedInputTokens + reducedOutputTokens);

      // Update token counts
      setChatTokensMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(chatKey, {
          inputTokens: reducedInputTokens,
          outputTokens: reducedOutputTokens,
          cacheCreationTokens: currentTokens?.cacheCreationTokens || 0,
          cacheReadTokens: currentTokens?.cacheReadTokens || 0,
          totalCost: currentTokens?.totalCost || 0, // Preserve cost through compaction
        });
        return newMap;
      });

      toast.dismiss('compacting');
      toast.success(`Compacted! ${messagesToSummarize.length} messages → 1 summary. ~${savedTokens.toLocaleString()} tokens freed 🦆`, {
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
  }, [activeSessionId, chatSessions, chatTokensMap, activeTerminal, explorerPath]);

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

      // Clear conversation history
      chatConversationHistoryRef.current.set(activeId, []);

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
    const findRequestId = (): { requestId: string | null; sessionKey?: string; questions: unknown[] } => {
      for (const [requestId, data] of pendingUserQuestions.entries()) {
        // 🦆 FIX: Match by agentId AND sessionKey (if provided) to prevent cross-session contamination
        const agentMatches = data.agentId === activeId;
        const sessionMatches = !targetSessionKey || data.sessionKey === targetSessionKey;

        if (agentMatches && sessionMatches) {
          return { requestId, sessionKey: data.sessionKey, questions: data.questions };
        }
      }
      return { requestId: null, sessionKey: undefined, questions: [] };
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

      // Prepare projects list from agent chats
      const projects = agentChats.map(agent => ({
        path: agent.cwd,
        name: agent.cwd.split('/').pop() || agent.cwd,
      }));
      // Remove duplicates by path
      const uniqueProjects = projects.filter(
        (p, i, arr) => arr.findIndex(x => x.path === p.path) === i
      );

      // Open terminal window with initial command to resume session
      await openTerminalWindow(uniqueProjects, {
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

      // Prepare projects list from agent chats
      const projects = agentChats.map(agent => ({
        path: agent.cwd,
        name: agent.cwd.split('/').pop() || agent.cwd,
      }));
      // Remove duplicates by path
      const uniqueProjects = projects.filter(
        (p, i, arr) => arr.findIndex(x => x.path === p.path) === i
      );

      // Open terminal window with initial command to resume session
      await openTerminalWindow(uniqueProjects, {
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
  const [pendingFileMention, setPendingFileMention] = useState<{ name: string; path: string; relativePath: string } | null>(null); // File to insert as @file mention
  const [pendingSlashCommand, setPendingSlashCommand] = useState<{ name: string; description: string } | null>(null); // Slash command to insert in input
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
  const { isPipOpen, togglePipWindow, updatePipAgents, showPipWindow, hidePipWindow } = usePipWindow();

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
    const messages = chatKey ? (chatSessions.get(chatKey) ?? []) : [];
    console.log(`[ChatView] Loading messages for chatKey="${chatKey}" (sessionId: ${activeSessionId}): ${messages.length} messages`);
    return messages;
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
    // Get project overhead from cache based on current cwd
    const cwd = activeTerminal?.cwd || explorerPath || '';
    const overhead = cwd ? projectOverheadCache.get(cwd) : undefined;
    return { ...tokens, overhead };
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
  const shouldShowSidePanel = isKanbanTabActive
    ? kanbanSidePanelExpanded && !sidePanelCollapsed
    : !sidePanelCollapsed;
  const gridTemplateColumns = shouldShowSidePanel
    ? "360px minmax(0, 1fr) 420px"
    : "360px minmax(0, 1fr) 0px";

  // Update PiP window with current agent states
  useEffect(() => {
    if (!isPipOpen) return;

    const pipAgents: PipAgentState[] = [];

    // For each active chat session, build PiP agent state
    chatSessions.forEach((messages, agentId) => {
      const terminal = terminals.find((t) => t.id === agentId);
      if (!terminal) return;

      // Determine agent status
      let status: PipAgentStatus = 'idle';
      let lastMessage: string | undefined;
      let currentTool: string | undefined;
      let toolsExecuted = 0;

      // Check if agent is currently loading/streaming
      const isLoading = chatLoadingMap.get(agentId) ?? false;
      if (isLoading) {
        status = 'streaming';
      }

      // Get last assistant message
      const lastMsg = messages.filter((m) => m.role === 'assistant').pop();
      if (lastMsg) {
        // Extract last text from events
        const lastEvent = lastMsg.events?.filter((e) => e.type === 'assistant').pop();
        if (lastEvent && lastEvent.type === 'assistant') {
          const textBlocks = lastEvent.message?.content?.filter((c: any) => c.type === 'text') ?? [];
          if (textBlocks.length > 0) {
            lastMessage = textBlocks[textBlocks.length - 1].text?.substring(0, 100);
          }

          // Count tools executed
          const toolBlocks = lastEvent.message?.content?.filter((c: any) => c.type === 'tool_use') ?? [];
          toolsExecuted = toolBlocks.length;

          // Get current tool if any
          if (toolBlocks.length > 0 && isLoading) {
            currentTool = toolBlocks[toolBlocks.length - 1].name;
            status = 'executing';
          }
        }

        // Check for error
        if (lastMsg.error) {
          status = 'error';
        }
      }

      // Check if thinking (no messages yet but loading)
      if (messages.length === 0 && isLoading) {
        status = 'thinking';
      }

      pipAgents.push({
        agentId: terminal.id,
        agentName: terminal.label,
        color: terminal.color,
        status,
        lastMessage,
        lastActivity: messages.length > 0 ? messages[messages.length - 1].timestamp : undefined,
        toolsExecuted,
        currentTool,
      });
    });

    updatePipAgents(pipAgents);
  }, [chatSessions, chatLoadingMap, terminals, isPipOpen, updatePipAgents]);

  // Listen for click-to-focus events from PiP window
  useEffect(() => {
    if (!tauriAvailable) return;

    const unlisten = listen<{ agentId: string; sessionId?: string }>('pip-agent-clicked', async (event) => {
      const { agentId } = event.payload;
      console.log('🦆 PiP agent clicked, focusing on agent:', agentId);

      // Find the terminal for this agent
      const terminal = terminals.find((t) => t.id === agentId);
      if (terminal) {
        // Switch to this terminal
        setActiveId(terminal.id);

        // Focus the main window
        const window = getCurrentWindow();
        await window.setFocus();
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [tauriAvailable, terminals]);

  // Auto-show/hide PiP based on main window focus
  useEffect(() => {
    if (!tauriAvailable || !isPipOpen) return;

    const window = getCurrentWindow();

    // Listen for window focus events
    const unlistenFocus = window.onFocusChanged(async ({ payload: focused }) => {
      if (focused) {
        // Main window gained focus - hide PiP
        console.log('🦆 Main window focused, hiding PiP');
        await hidePipWindow();
      } else {
        // Main window lost focus - show PiP
        console.log('🦆 Main window unfocused, showing PiP');
        await showPipWindow();
      }
    });

    return () => {
      unlistenFocus.then((fn) => fn());
    };
  }, [tauriAvailable, isPipOpen, showPipWindow, hidePipWindow]);

  // Agent Chat Settings helpers - get or create settings for current agent
  // Normalize model name from legacy full IDs to short names
  const normalizeModelName = (model: string): 'opus' | 'sonnet' | 'haiku' => {
    if (model.includes("opus")) return "opus";
    if (model.includes("sonnet")) return "sonnet";
    if (model.includes("haiku")) return "haiku"; // Haiku 4.5 (default)
    return "sonnet"; // Fallback to sonnet if unknown
  };

  // 🦆 SESSIONS-FIRST: Use sessionId for settings if available, fallback to agentId
  const settingsKey = activeSessionId || activeId;

  const getCurrentAgentSettings = useCallback((): AgentChatSettings => {
    if (!settingsKey) {
      // Default settings when no session/agent is active - use presets from settings
      const presets = useSettingsStore.getState().agentModePresets;
      const bypassPreset = presets.bypass;

      return {
        inputDraft: '',
        model: bypassPreset?.model || 'sonnet',
        thinkingMode: bypassPreset?.thinkingMode || 'auto',
        permissionMode: 'bypass',
        effort: bypassPreset?.effort || 'medium', // SDK 0.1.54+ - Default from preset
      };
    }

    const existing = agentChatSettings.get(settingsKey);
    if (existing) {
      // Normalize the model name in case it's a legacy full ID
      return {
        ...existing,
        model: normalizeModelName(existing.model),
        effort: existing.effort || 'medium', // Ensure default if not set
      };
    }

    // Initialize default settings for new session using presets from settings
    const presets = useSettingsStore.getState().agentModePresets;
    const bypassPreset = presets.bypass;

    const defaultSettings: AgentChatSettings = {
      inputDraft: '',
      model: bypassPreset?.model || 'sonnet',
      thinkingMode: bypassPreset?.thinkingMode || 'auto',
      permissionMode: 'bypass',
      effort: bypassPreset?.effort || 'medium', // SDK 0.1.54+ - Default from preset
    };

    setAgentChatSettings((prev) => {
      const newMap = new Map(prev);
      newMap.set(settingsKey, defaultSettings);
      return newMap;
    });

    return defaultSettings;
  }, [settingsKey, agentChatSettings]);

  const updateAgentSettings = useCallback((updates: Partial<AgentChatSettings>) => {
    // 🦆 SESSIONS-FIRST: Use sessionId for settings if available, fallback to agentId
    const key = activeSessionId || activeId;
    if (!key) return;

    setAgentChatSettings((prev) => {
      const newMap = new Map(prev);

      // Get presets for fallback defaults
      const presets = useSettingsStore.getState().agentModePresets;
      const bypassPreset = presets.bypass;

      const current = newMap.get(key) ?? {
        inputDraft: '',
        model: bypassPreset?.model || 'sonnet',
        thinkingMode: bypassPreset?.thinkingMode || 'auto',
        permissionMode: 'bypass',
        effort: bypassPreset?.effort || 'medium', // SDK 0.1.54+ - Default from preset
      };

      // Auto-switch settings based on permission mode using presets from settings
      let finalUpdates = { ...updates };
      if (updates.permissionMode !== undefined && updates.permissionMode !== current.permissionMode) {
        const preset = presets[updates.permissionMode as 'bypass' | 'plan'];
        if (preset) {
          finalUpdates.model = preset.model;
          finalUpdates.thinkingMode = preset.thinkingMode;
          finalUpdates.effort = preset.effort;
        }
      }

      newMap.set(key, { ...current, ...finalUpdates });
      return newMap;
    });
  }, [activeSessionId, activeId]);

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

    // Listen for menu event to open Backgrounds modal
    const unlistenBackgroundsPromise = listen("open-backgrounds", () => {
      setShowBackgroundsModal(true);
    });

    // Listen for tray menu event to open PiP window
    const unlistenOpenPipPromise = listen("open-pip-window", () => {
      console.log("🦆 Tray menu: Opening PiP window");
      togglePipWindow();
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
      setPendingUserQuestions((prev) => {
        const next = new Map(prev);
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

      // 🔔 Send desktop notification when agent needs user input
      try {
        // Get agent name for the notification
        const agentChat = agentChats.find((a) => a.id === agentId);
        const agentName = agentChat?.name || 'Agent';
        const questionCount = Array.isArray(questions) ? questions.length : 1;

        await sendNotification({
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

    // Listen for Kanban updates from Claude Agent SDK custom tools
    const unlistenKanbanUpdatePromise = listen<{
      eventType: string;
      payload: {
        taskId?: string;
        task?: unknown;
        title?: string;
        previousStatus?: string;
        newStatus?: string;
        completionNote?: string;
        reason?: string;
        updates?: Record<string, unknown>;
        parentTaskId?: string;
      };
      timestamp: number;
      agentId: string;
    }>("kanban:update", async (event) => {
      console.log("📋 Kanban update event received:", event.payload);
      const { eventType, payload } = event.payload;

      // Reload sessions from storage to sync with backend changes (sessions-first architecture)
      await useSessionStore.getState().loadSessions();
      // Also reload kanban tasks for backwards compatibility
      await loadKanbanTasks();

      // Show toast notification based on event type
      const toastMessages: Record<string, string> = {
        task_created: payload.parentTaskId
          ? `Subtask created: "${(payload.task as { title?: string })?.title || 'New task'}"`
          : `Task created: "${(payload.task as { title?: string })?.title || 'New task'}"`,
        task_moved: `Task moved to ${payload.newStatus}${payload.completionNote ? ` - ${payload.completionNote}` : ''}`,
        task_updated: `Task updated`,
        task_deleted: `Task "${payload.title}" deleted${payload.reason ? ` - ${payload.reason}` : ''}`,
      };

      const message = toastMessages[eventType];
      if (message) {
        // Use console for now, will be replaced with toast
        console.log(`📋 Kanban: ${message}`);
        // TODO: Add toast notification here
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

      // Set the agent and session as active
      setActiveId(session.agentId);
      setActiveSessionIdExclusive(sessionId);

      // Build prompt with WhatsApp MCP instruction if recipient is provided
      let finalPrompt = prompt;
      if (whatsappRecipient) {
        finalPrompt = `${prompt}\n\n---\nIMPORTANT: After completing this task, respond to the user via WhatsApp using the MCP WhatsApp tool. Send the response to: ${whatsappRecipient}`;
      }

      // Auto-send the prompt if requested
      if (autoSend && sendMessageForAgentRef.current) {
        // Small delay to ensure UI is ready
        await new Promise(resolve => setTimeout(resolve, 300));
        console.log(`📱 Auto-sending prompt for session ${sessionId}:`, finalPrompt.substring(0, 100));
        await sendMessageForAgentRef.current(finalPrompt);
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenAISettingsPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenWatchIntroPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenBackgroundsPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenOpenPipPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenAskUserQuestionGlobalPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenKanbanUpdatePromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenSessionsUpdatedPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenSessionAutoStartPromise.then(unlisten => unlisten()).catch(() => undefined);
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
        setPendingUserQuestions((prev) => {
          const next = new Map(prev);
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
        try {
          unlisten();
        } catch (e) {
          // Ignore errors during cleanup
        }
        askUserListenersRef.current.delete(terminalId);
        console.log(`[AskUser] Listener removed for terminal: ${terminalId}`);
      }
    });

    // Cleanup on unmount
    return () => {
      askUserListenersRef.current.forEach((unlisten, id) => {
        try {
          unlisten();
        } catch (e) {
          // Ignore errors during cleanup
        }
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

  // Auto-save terminals to storage (debounced to avoid excessive writes)
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

        // Send Telegram notification if user is linked
        try {
          const [, chatId] = await invoke<[string | null, number | null]>("get_telegram_link");
          if (chatId) {
            // Get the last response text (if available)
            const lastResponse = lastAgentResponseRef.current.get(payload.id) || '';

            let message = '';

            if (!lastResponse) {
              // No text response (only tool calls)
              message = `🦆 *${projectName}*\n\n${agentName}: Response completed!\n\n_Open Quack to view details_`;
            } else if (lastResponse.length <= 1000) {
              // Short response: send FULL text
              // Clean up markdown formatting for Telegram
              const cleanText = lastResponse
                .replace(/```[\s\S]*?```/g, '[code block]')
                .replace(/`([^`]+)`/g, '$1');

              message = `🦆 *${projectName}*\n\n${agentName}:\n\n${cleanText}\n\n---\n_View in Quack for full context_`;
            } else {
              // Long response: send summary (first 300 chars)
              const summary = lastResponse.substring(0, 297) + '...';
              const cleanSummary = summary
                .replace(/```[\s\S]*?```/g, '[code]')
                .replace(/`([^`]+)`/g, '$1');

              message = `🦆 *${projectName}*\n\n${agentName}:\n\n${cleanSummary}\n\n_Open Quack to view full response (${lastResponse.length} chars)_`;
            }

            await invoke("send_telegram_message", {
              payload: {
                chat_id: chatId,
                text: message,
              },
            });

            // Clear the saved response after sending notification
            lastAgentResponseRef.current.delete(payload.id);
          }
        } catch (error) {
          console.warn("Unable to send Telegram notification", error);
        }
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
            src={agentInfo.avatar ? `/images/ducks/new-avatars/${agentInfo.avatar}` : getDuckdroidUrl()}
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

  // Handler for selecting or creating a droid via Claude Assets panel
  const handleSelectDroid = useCallback((agentName: string, agentScope: 'global' | 'project', isNew = false) => {
    if (isNew) {
      handleCreateNewAgent(agentScope);
      return;
    }

    const agentTabId = `agent-${agentName}-${agentScope}`;

    // Check if tab already exists
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

  // Command tab handler
  const handleSelectCommand = useCallback((commandName: string, commandScope: 'global' | 'project', isNew = false) => {
    const commandTabId = isNew ? `command-new-${Date.now()}` : `command-${commandName}-${commandScope}`;

    // Check if tab already exists
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

  // Rule tab handler
  const handleSelectRule = useCallback((ruleName: string, ruleScope: 'global' | 'project', isNew = false) => {
    const ruleTabId = isNew ? `rule-new-${Date.now()}` : `rule-${ruleName}-${ruleScope}`;

    // Check if tab already exists
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

  const handleSelectSkill = useCallback(async (skillInfo: SkillInfo) => {
    if (!tauriAvailable) {
      return;
    }

    try {
      // Create a new tab for the skill instead of opening drawer
      const skillTabId = `skill-${skillInfo.name}-${skillInfo.scope}`;

      // Check if tab already exists
      const existingTab = tabs.find(t => t.id === skillTabId);

      if (existingTab) {
        // Tab already exists, just switch to it
        setActiveTabId(skillTabId);
      } else {
        // Create new skill tab
        const newTab: Tab = {
          id: skillTabId,
          label: skillInfo.name.replace(/-/g, ' '),
          type: 'skill',
          closable: true,
          skillName: skillInfo.name,
          skillScope: skillInfo.scope as 'global' | 'project',
          // icon removed - rendered directly in TabBar to avoid React serialization issues
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

  const handleMentionFile = useCallback((filePath: string, fileName: string) => {
    // Calculate relative path from explorerRoot
    const basePath = explorerRoot ?? explorerPath;
    let relativePath = filePath;

    if (basePath && filePath.startsWith(basePath)) {
      relativePath = filePath.substring(basePath.length).replace(/^\//, '');
    }

    // Set pending file mention for ChatInput to pick up
    setPendingFileMention({
      name: fileName,
      path: filePath,
      relativePath: relativePath,
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

    // ✅ FREE TIER VALIDATION: Check terminal limit before creating (same as NewTerminalModal)
    if (!canCreateTerminal(terminals.length)) {
      toast.error('Free tier limited to 3 terminals', {
        description: 'Upgrade to Pro for unlimited terminals',
        duration: 5000,
      });
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
  // No longer blocking splash - agents load in background while native splash shows
  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }
    const loadInitialAgents = async () => {
      console.log('[Startup] Loading agents...');
      await loadAgents();
      console.log('[Startup] Agents loaded');
      setBooting(false);
      if (!hasBootstrapped) {
        setHasBootstrapped(true);
      }
    };
    void loadInitialAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tauriAvailable]);

  // 🦆 FIX: Reload agents when project/working directory changes
  // This ensures @mention dropdown shows correct droids for the current project
  const currentWorkingDir = activeTerminal?.cwd ?? explorerPath;
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped || !currentWorkingDir) {
      return;
    }
    console.log('[Agents] Reloading agents for new working directory:', currentWorkingDir);
    void loadAgents();
  }, [currentWorkingDir, tauriAvailable, hasBootstrapped, loadAgents]);

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
      void unlistenInstalled.then((fn) => fn());
      void unlistenUninstalled.then((fn) => fn());
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
        'quack-agent.jpeg': quackAgentBackgroundImage,
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
      void unlistenPromise.then((fn) => fn());
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

          // Note: Chat history is managed by Claude SDK via session resume
          // No need to load local messages - SDK handles conversation continuity

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
          // Sessions-first: just load sessions, SDK manages chat history
          await useSessionStore.getState().loadSessions();
          const allSessions = useSessionStore.getState().sessions;
          console.log(`[Session Bootstrap] Loaded ${allSessions.length} sessions (no terminals)`);
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

    // Load personality from terminal state
    if (activeTerminal.personality && Object.keys(activeTerminal.personality).length > 0) {
      setNewTerminalPersonality({
        technicalContext: '',
        rules: [],
        customNotes: '',
        ...activeTerminal.personality,
      });
      console.log('✅ Loaded personality from state for:', activeTerminal.label);
    } else {
      // Try to load from Rust as fallback
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
        console.log('✅ Loaded personality from Rust for:', activeTerminal.label);
      } catch (error) {
        // No personality found - use current personality or default
        console.log('No existing personality found, using current or default');
        setNewTerminalPersonality(activeTerminal.personality || {
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
    console.log('[App] Session clicked:', sessionId);

    // Find the session in sessionStore
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.sessions.find(s => s.id === sessionId);
    if (!session) {
      console.warn('[App] Session not found:', sessionId);
      return;
    }

    // Pre-populate ChatInput with initial prompt and attachments (only if not consumed yet)
    if (!session.initialPromptConsumed) {
      // Pre-populate input draft with initial prompt
      if (session.initialPrompt) {
        console.log('[App] Pre-populating input with initial prompt:', session.initialPrompt.substring(0, 50) + '...');
        setTaskInputDrafts(prev => {
          const newMap = new Map(prev);
          newMap.set(sessionId, session.initialPrompt!);
          return newMap;
        });
      }

      // Pre-populate attachments in chatStore
      if (session.initialAttachments?.length) {
        console.log('[App] Pre-populating attachments:', session.initialAttachments.length);
        useChatStore.getState().setAttachments(sessionId, session.initialAttachments);
      }

      // Mark initial prompt as consumed to avoid re-population on re-open
      sessionStore.updateSession(sessionId, { initialPromptConsumed: true });
    }

    // Close Kanban view if open - show the chat instead
    const { isKanbanViewActive, setKanbanViewActive } = useKanbanStore.getState();
    if (isKanbanViewActive) {
      setKanbanViewActive(false);
    }

    // Switch to chat tab (exit Kanban tab if active)
    setActiveTabId('chat');

    // Set active session in local state
    // 🦆 FIX SESSION MIXING: Use exclusive setter to clear activeTaskId
    setActiveSessionIdExclusive(sessionId);

    // Select the session in the store
    selectSession(sessionId);

    // If session has an associated agent, select that agent
    // 🦆 FIX: Always set activeId to session.agentId, even if agent is not in terminals
    // This prevents the bug where activeId stays on the previous agent, causing
    // messages to be sent with the wrong agentId
    if (session.agentId) {
      const agentTerminal = terminals.find(t => t.id === session.agentId);
      if (agentTerminal) {
        console.log('[App] Selecting agent for session:', agentTerminal.label);

        // 🦆 FIX: Inject agent personality into CLAUDE.md when clicking session
        // This ensures the CLAUDE.md reflects the agent's personality, same as clicking agent-card
        if (tauriAvailable) {
          (async () => {
            try {
              console.log(`[handleSessionClick] Loading personality for "${agentTerminal.label}" (ID: ${agentTerminal.id})`);
              const personality = await invoke<AgentPersonality>('load_agent_personality', {
                projectPath: agentTerminal.cwd,
                personalityId: agentTerminal.id,
              });

              // Inject into CLAUDE.md
              await invoke('inject_personality_to_claude_md', {
                projectPath: agentTerminal.cwd,
                personality,
              });

              console.log(`[handleSessionClick] ✅ Injected personality for "${agentTerminal.label}" into CLAUDE.md`);
            } catch (error) {
              // No personality found or injection failed - not critical
              console.warn(`[handleSessionClick] Failed to inject personality:`, error);
            }
          })();
        }
      } else {
        console.warn('[App] Agent not found in terminals for session:', session.agentId);
      }
      // Always set activeId to the session's agent, even if terminal not found
      setActiveId(session.agentId);
    }

    // 🦆 FIX: Sync File Explorer with session's project path
    if (session.projectPath) {
      console.log('[App] Syncing File Explorer to session projectPath:', session.projectPath);
      void loadDirectory(session.projectPath);
    }
  }, [selectSession, terminals, loadDirectory, setActiveSessionIdExclusive, tauriAvailable]);

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

    // 💰 Check Pro limit before opening modal
    if (!canCreateTerminal(terminals.length)) {
      setUpgradeLimitType('terminals');
      setShowUpgradeModal(true);
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

    // 💰 Check Pro limit before opening modal
    if (!canCreateTerminal(terminals.length)) {
      setUpgradeLimitType('terminals');
      setShowUpgradeModal(true);
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
              const repoName = trimmedPath.split('/').pop() || 'repo';
              const sanitizedBranch = newTerminalBranch.replace(/\//g, '-');
              const parentDir = trimmedPath.split('/').slice(0, -1).join('/');
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
        clearTerminalAttention(createdWithState.id);

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
    toast.success('🎉 Quack Pro activated! Enjoy unlimited features!', {
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

      try {
        await invoke("close_terminal", { id });
      } catch (error) {
        console.error("Unable to close terminal", error);
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
    ]
  );

  // Handle project click from Kanban - show side panel with project context (without exiting Kanban)
  const handleKanbanProjectClick = useCallback((projectPath: string) => {
    // Find an agent (terminal) that belongs to this project
    const projectAgent = terminals.find(t => t.cwd === projectPath);

    if (projectAgent) {
      // Select the agent (this populates the side panel with agent context)
      setActiveId(projectAgent.id);

      // Expand the side panel to show the agent context
      setSidePanelCollapsed(false);

      // Mark that we want the side panel expanded in Kanban mode
      setKanbanSidePanelExpanded(true);

      // Load the project directory for file explorer
      void loadDirectory(projectPath);
    } else {
      console.warn(`No agent found for project: ${projectPath}`);
    }
  }, [terminals, loadDirectory]);


  // ============================================
  // AgentChat Management Handlers (Phase 1)
  // ============================================

  // NO AgentChat handlers needed - terminals are independent!

  // Handler to open terminal window with projects from agents
  const handleCreateAgentTerminal = useCallback(() => {
    // NEW BEHAVIOR: Open separate Tauri window for terminals
    // Pass projects derived from agentChats
    const projects = agentChats.map(agent => ({
      path: agent.cwd,
      name: agent.cwd.split('/').pop() || agent.cwd,
    }));
    // Remove duplicates by path
    const uniqueProjects = projects.filter(
      (p, i, arr) => arr.findIndex(x => x.path === p.path) === i
    );
    openTerminalWindow(uniqueProjects);
  }, [agentChats, openTerminalWindow]);

  // Sync terminal window projects when agentChats change
  // updateTerminalWindowProjects now handles the window lookup internally
  useEffect(() => {
    const projects = agentChats.map(agent => ({
      path: agent.cwd,
      name: agent.cwd.split('/').pop() || agent.cwd,
    }));
    // Remove duplicates by path
    const uniqueProjects = projects.filter(
      (p, i, arr) => arr.findIndex(x => x.path === p.path) === i
    );
    // This will only emit if the window exists
    updateTerminalWindowProjects(uniqueProjects);
  }, [agentChats, updateTerminalWindowProjects]);

  // Listen for sync request from terminal window (manual sync button)
  useEffect(() => {
    const unlistenPromise = listen('terminal-window-request-sync', () => {
      console.log('[App] Received sync request from terminal window');
      const projects = agentChats.map(agent => ({
        path: agent.cwd,
        name: agent.cwd.split('/').pop() || agent.cwd,
      }));
      const uniqueProjects = projects.filter(
        (p, i, arr) => arr.findIndex(x => x.path === p.path) === i
      );
      updateTerminalWindowProjects(uniqueProjects);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten());
    };
  }, [agentChats, updateTerminalWindowProjects]);

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

  const handleOpenFilePreview = useCallback(
    async (entry: DirectoryEntry, lineChanges?: LineChange[]) => {
      if (!tauriAvailable || entry.is_dir) {
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
    [tauriAvailable, gitSummary, explorerRoot, activeId, fileEditsMap]
  );

  const handleFilePathClick = useCallback((path: string, lineChanges?: LineChange[]) => {
    const name = path.split('/').pop() || path;
    // Create a fake DirectoryEntry to open the file
    const fakeEntry: DirectoryEntry = {
      name,
      path,
      is_dir: false,
      is_symlink: false,
    };
    // Use handleOpenFilePreview to actually load file content
    handleOpenFilePreview(fakeEntry, lineChanges);
  }, [handleOpenFilePreview]);

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
            untracked: false,
            rootPath,
          });

          if (!diffContent || diffContent.trim() === '') {
            // No diff available - file might have been committed already
            // Show informative message instead of treating as new file
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
            untracked: false,
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

  // Handler to update modified files map (for FileExplorer indicators)
  const handleEditsChange = useCallback((edits: FileEdit[], deletes: FileDeleted[]) => {
    const newModifiedFiles = new Map<string, 'created' | 'modified' | 'deleted'>();
    const newFileEditsMap = new Map<string, FileEdit>();

    // Add all edited files with their status and complete info
    edits.forEach(edit => {
      newModifiedFiles.set(edit.filePath, edit.status || 'modified');
      newFileEditsMap.set(edit.filePath, edit);
    });

    // Add all deleted files
    deletes.forEach(deleted => {
      newModifiedFiles.set(deleted.filePath, 'deleted');
    });

    setModifiedFiles(newModifiedFiles);
    setFileEditsMap(newFileEditsMap);
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


  // Handler for opening Knowledge Graph tab
  const handleOpenMemoryGraphTab = useCallback(() => {
    // Check if memory graph tab already exists
    const existingTab = tabs.find(t => t.type === 'memory-graph');
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const newTab = openMemoryGraphTab();
    setTabs((prevTabs) => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);

    console.log('[Quack] Knowledge Graph tab opened:', newTab.id);
  }, [openMemoryGraphTab, tabs]);

  // Handler for opening Second Brain tab
  const handleOpenSecondBrainTab = useCallback(() => {
    // Check if second brain tab already exists
    const existingTab = tabs.find(t => t.type === 'second-brain');
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return;
    }

    const newTab = openSecondBrainTab();
    setTabs((prevTabs) => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);

    console.log('[Quack] Second Brain tab opened:', newTab.id);
  }, [openSecondBrainTab, tabs]);

  // Handler for opening Second Brain tab with a specific node (from Knowledge Graph)
  const handleOpenSecondBrainWithNode = useCallback((nodeId: string, nodeLabel: string) => {
    // Always create new tab when opening specific node
    const newTab = openSecondBrainTab({ nodeId, nodeLabel });
    setTabs((prevTabs) => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);

    console.log('[Quack] Second Brain tab opened with node:', nodeId, nodeLabel);
  }, [openSecondBrainTab]);
  // Handler for opening image in a dedicated tab
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
    const pathParts = terminal.cwd.split('/');
    const projectName = pathParts[pathParts.length - 1];

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
    openTerminalWindow: handleCreateAgentTerminal,  // Cmd+T opens Terminal Window App
    newAgent: handleOpenNewTerminalModal,           // Cmd+N opens New Agent modal
    toggleSidePanel: useCallback(() => {
      setSidePanelCollapsed(prev => !prev);
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

    setTabs((prevTabs) => {
      const filtered = prevTabs.filter(t => t.id !== tabId);

      // If closing active tab, switch to previous tab or chat
      if (activeTabId === tabId) {
        const closedIndex = prevTabs.findIndex(t => t.id === tabId);
        const newActiveTab = filtered[Math.max(0, closedIndex - 1)];
        const newActiveTabId = newActiveTab?.id || 'chat';

        // Use handleTabClick instead of setActiveTabId to trigger file loading
        handleTabClick(newActiveTabId);
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
      // Create popout window
      console.log('[App] Calling popoutTab...');
      const windowLabel = await popoutTab(tab, position);
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
  }, [popoutTab, isTabPoppedOut, activeTabId]);

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
  useEffect(() => {
    if (!activeId) return;

    console.log('[Tab Switch] Active terminal changed to:', activeId, activeTerminal?.label);

    // Save current tabs for the PREVIOUS terminal (if any)
    const previousId = previousActiveIdRef.current;
    if (previousId && previousId !== activeId) {
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
    const specialTabTypes = [
      'kanban', 'docs', 'second-brain', 'memory-graph', 'claude-assets',
      'agent', 'skill', 'command', 'browser-manager', 'agent-terminal'
    ];

    setTabs(prevTabs => {
      // Keep any special tabs that were open
      const specialTabs = prevTabs.filter(t => specialTabTypes.includes(t.type));
      return [chatTab, ...terminalTabs, ...specialTabs];
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
      const rootPath = activeTerminal?.cwd ?? explorerPath ?? undefined;
      const [statusResult, historyResult] = await Promise.allSettled([
        invoke<GitStatusSummary>("git_status_summary", { rootPath }),
        invoke<GitCommitEntry[]>("git_commit_history", { limit: 50, branchName: null, rootPath }),
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
  }, [activeTerminal, explorerPath, tauriAvailable]);

  useEffect(() => {
    if (showGitDrawer) {
      void refreshGitSummary();
    }
  }, [refreshGitSummary, showGitDrawer]);

  // Load git status on startup only (not on every terminal switch!)
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }
    void refreshGitSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tauriAvailable, hasBootstrapped]); // Intentionally NOT including refreshGitSummary to prevent re-load on every switch

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

  // Handler to open .mcp.json file in Monaco editor
  const handleOpenMcpConfig = useCallback(
    (repoPath: string) => {
      // Construct the full path to .mcp.json
      const mcpFilePath = `${repoPath}/.mcp.json`;
      const fileName = '.mcp.json';

      // Create a fake DirectoryEntry to open the file
      const fakeEntry: DirectoryEntry = {
        name: fileName,
        path: mcpFilePath,
        is_dir: false,
        is_symlink: false,
      };

      // Use handleOpenFilePreview to open the file
      void handleOpenFilePreview(fakeEntry);
    },
    [handleOpenFilePreview]
  );

  // Handler to open Terminal Window for a specific repository
  const handleOpenTerminalWindowForRepo = useCallback(
    async (repoPath: string, repoName: string) => {
      try {
        // Get all existing projects from agentChats (same pattern as Terminals button)
        const projects = agentChats.map(agent => ({
          path: agent.cwd,
          name: agent.cwd.split('/').pop() || agent.cwd,
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
    [agentChats, openTerminalWindow]
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

    // ✅ FREE TIER VALIDATION: Check terminal limit before resuming (creates new terminal)
    if (!canCreateTerminal(terminals.length)) {
      toast.error('Free tier limited to 3 terminals', {
        description: 'Upgrade to Pro for unlimited terminals',
        duration: 5000,
      });
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

  // Track when app started for minimum splash duration
  const appMountTimeRef = useRef(Date.now());
  const MINIMUM_SPLASH_DURATION = 4000; // Show splash for at least 4 seconds

  // Hide native HTML splash when agents are loaded (sidebar populated)
  useEffect(() => {
    console.log('[Splash] agentsInitialized:', agentsInitialized);
    if (!agentsInitialized) return; // Wait for first agent load to complete

    const nativeSplash = document.getElementById('native-splash');
    console.log('[Splash] nativeSplash element:', nativeSplash ? 'found' : 'NOT FOUND');
    if (!nativeSplash) return;

    // Calculate remaining time to meet minimum duration
    const elapsed = Date.now() - appMountTimeRef.current;
    const remainingTime = Math.max(0, MINIMUM_SPLASH_DURATION - elapsed);
    console.log('[Splash] elapsed:', elapsed, 'remainingTime:', remainingTime);

    // Wait for minimum duration, then fade out
    const timeoutId = setTimeout(() => {
      console.log('[Splash] Fading out now');
      nativeSplash.classList.add('fade-out');
      setTimeout(() => nativeSplash.remove(), 300);
    }, remainingTime);

    return () => clearTimeout(timeoutId);
  }, [agentsInitialized]); // Run when agents finish loading

  // REMOVED: React SplashScreen at startup
  // Native splash in index.html now handles the intro animation
  // SplashScreen component is only used for "Watch Intro" replay feature

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
      {/* Obsidian Sync Initializer - Auto-starts vault watcher when sync is enabled */}
      <ObsidianSyncInitializer />

      {/* Kanban Watcher Initializer - Auto-starts file watcher for MCP sync (event-driven architecture) */}
      <KanbanWatcherInitializer />

      {/* Drag region removed - now using data-tauri-drag-region on sidebar-header only */}

      {/* 🔐 Claude Auth Banner - Fixed at bottom when CLI not available */}
      {claudeCliAvailable === false && !claudeAuthBannerDismissed && (
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

      {/* 💰 Pro Banner - Fixed at bottom with collapse to badge */}
      {/* Only show if auth banner is not visible (priority system) */}
      {!isProUser && !(claudeCliAvailable === false && !claudeAuthBannerDismissed) && (
        <ProBanner
          onUpgrade={() => handleShowUpgrade('terminals')}
          isExpanded={proBannerExpanded}
          onToggle={() => setProBannerExpanded(!proBannerExpanded)}
        />
      )}

      <div
        ref={appShellRef}
        className={`app-shell ${sidePanelCollapsed || (!activeId && !isKanbanTabActive) || activeTabId.startsWith('docs-') || activeTabId.startsWith('second-brain-') || activeTabId.startsWith('memory-graph-') || activeTabId.startsWith('claude-assets-') || activeTabId.startsWith('project-dashboard-') || (isKanbanTabActive && !kanbanSidePanelExpanded) ? 'side-panel-collapsed' : ''} ${terminals.length === 0 ? 'no-agents' : ''} ${isKanbanTabActive ? 'kanban-mode' : ''} ${isChatFullscreen ? 'chat-fullscreen' : ''}`}
        style={{ gridTemplateColumns }}
      >
        <TerminalSidebar
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
            // 🦆 Clean up listener for this agent
            const unlisten = activeListenersRef.current.get(chatId);
            if (unlisten) {
              unlisten();
              activeListenersRef.current.delete(chatId);
              console.log(`[onDeleteAgentChat] Cleaned up listener for agent: ${chatId}`);
            }
            // Remove from chatSessions map
            setChatSessions(prev => {
              const newSessions = new Map(prev);
              newSessions.delete(chatId);
              return newSessions;
            });
            setAgentChats(prev => prev.filter(chat => chat.id !== chatId));
            if (activeAgentChatId === chatId) {
              setActiveAgentChatId(null);
            }

            // Note: SDK session cleanup happens automatically
            console.log(`[onDeleteAgentChat] Removed agent chat: ${chatId}`);
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
          onOpenDashboard={handleOpenProjectDashboard}
          // onCreateTask={handleCreateTaskFromAgent} // Temporarily hidden
          // Session props
          onSessionClick={handleSessionClick}
          activeSessionId={activeSessionId ?? undefined}
          // Kanban button is now built into TerminalSidebar
          gitRefreshTrigger={gitRefreshTrigger}
        />

        {/* Terminal pane - show video background when no terminals, otherwise show chat */}
        <section className={`terminal-pane ${activeTabId.startsWith('docs-') || activeTabId.startsWith('second-brain-') || activeTabId.startsWith('memory-graph-') || activeTabId.startsWith('claude-assets-') || activeTabId.startsWith('project-dashboard-') ? 'full-width-tab' : ''}`}>
          {terminals.length === 0 ? (
            /* Empty state when no agents - show image or guide */
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
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
                    <span style={{ color: '#f28c52', fontWeight: 600, fontSize: '14px' }}>
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
                /* Image background when no agents with Open Guide button */
                <>
                  <img
                    src="/images/quack-agent.jpeg"
                    alt="Quack Agent"
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: 'center',
                    }}
                  />
                  {/* Open Guide Button - positioned top right */}
                  <button
                    type="button"
                    onClick={() => setEmptyStateShowGuide(true)}
                    style={{
                      position: 'absolute',
                      top: '24px',
                      right: '24px',
                      padding: '12px 24px',
                      fontSize: '14px',
                      fontWeight: 600,
                      borderRadius: '8px',
                      border: '1px solid rgba(242, 140, 82, 0.4)',
                      background: 'rgba(18, 18, 22, 0.85)',
                      backdropFilter: 'blur(12px)',
                      color: '#f28c52',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(242, 140, 82, 0.15)';
                      e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.6)';
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(242, 140, 82, 0.2)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'rgba(18, 18, 22, 0.85)';
                      e.currentTarget.style.borderColor = 'rgba(242, 140, 82, 0.4)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.3)';
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                    Open Guide
                  </button>
                </>
              )}
            </div>
          ) : (
            /* Chat area when agents are active */
            <div className="terminal-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Action Icons - aligned right above tabs */}
              <ActionIcons
              projectPath={activeTerminal?.cwd ?? explorerPath}
              onGitClick={() => setShowGitDrawer(!showGitDrawer)}
              onPluginsClick={() => setShowPluginsDrawer(!showPluginsDrawer)}
              onUsageClick={async () => {
                try {
                  const cwd = activeTerminal?.cwd ?? explorerPath ?? process.env.HOME ?? "~";
                  // Open in Terminal Window (separate Tauri window) instead of tab
                  const projects = agentChats.map(agent => ({
                    path: agent.cwd,
                    name: agent.cwd.split('/').pop() || agent.cwd,
                  }));
                  const uniqueProjects = projects.filter(
                    (p, i, arr) => arr.findIndex(x => x.path === p.path) === i
                  );
                  await openTerminalWindow(uniqueProjects, {
                    projectPath: cwd,
                    command: 'claude /usage',
                    terminalLabel: 'Claude Plan Usage',
                  });
                } catch (error) {
                  console.error("Failed to open claude usage:", error);
                }
              }}
              onTelegramClick={() => setShowTelegramSetup(true)}
              onTerminalClick={handleCreateAgentTerminal}
              onBrowserClick={handleOpenBrowserTab}
              onDroidFactoryClick={() => setDroidFactoryOpen(true)}
              onMemoryGraphClick={handleOpenMemoryGraphTab}
              onSecondBrainClick={handleOpenSecondBrainTab}
              onClaudeAssetsClick={openClaudeAssetsTab}
              onGuideClick={handleOpenDocsTab}
              onToggleSidePanel={() => setSidePanelCollapsed(!sidePanelCollapsed)}
              sidePanelCollapsed={sidePanelCollapsed}
              terminalWindowOpen={terminalWindowOpen}
              secondBrainOpen={tabs.some(t => t.type === 'second-brain' && t.id === activeTabId)}
              claudeAssetsOpen={tabs.some(t => t.type === 'claude-assets' && t.id === activeTabId)}
              isAuthenticated={claudeCliAvailable !== false}
              onLoginClick={async () => {
                try {
                  const cwd = activeTerminal?.cwd ?? explorerPath ?? process.env.HOME ?? "~";
                  const projects = agentChats.map(agent => ({
                    path: agent.cwd,
                    name: agent.cwd.split('/').pop() || agent.cwd,
                  }));
                  const uniqueProjects = projects.filter(
                    (p, i, arr) => arr.findIndex(x => x.path === p.path) === i
                  );
                  await openTerminalWindow(uniqueProjects, {
                    projectPath: cwd,
                    command: 'claude /login',
                    terminalLabel: 'Claude Login',
                  });
                } catch (error) {
                  console.error("Failed to open claude login:", error);
                }
              }}
            />

            {/* Tab Bar - VSCode style (always shown) */}
            {/* 🦆 Use displayTabs which shows task title when a task is active */}
            <TabBar
              tabs={displayTabs}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
              onTabClose={handleTabClose}
              onTabReorder={handleTabReorder}
              onTabPopout={handleTabPopout}
            />

            {/* Content Area - fills remaining space */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
                      defaultModel={currentSettings.model as 'opus' | 'sonnet' | 'haiku'}
                      defaultThinkingMode={currentSettings.thinkingMode as 'auto' | 'think' | 'hard' | 'harder' | 'ultra'}
                      defaultPermissionMode={currentSettings.permissionMode as 'plan' | 'bypass'}
                      defaultEffort={currentSettings.effort || 'medium'}
                      onLoadChatSessions={loadKanbanChatSessions}
                      onProjectClick={handleKanbanProjectClick}
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
                        const projectName = label || path.split('/').pop() || 'Terminal';
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
                    />
                  );
                }

                return (
                  <ChatView
                    key={isTaskChat ? `task-${activeTaskId}` : `${activeId ?? 'no-agent'}-${activeSessionId ?? 'no-session'}`}
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
                    onSessionIdClick={handleSessionIdClick}
                    onDiffClick={handleDiffClick}
                    onEditsChange={handleEditsChange}
                    pendingAgentMention={pendingAgentMention}
                    onMentionInserted={() => setPendingAgentMention(null)}
                    pendingFileMention={pendingFileMention}
                    onFileMentionInserted={() => setPendingFileMention(null)}
                    pendingSlashCommand={pendingSlashCommand}
                    onCommandInserted={() => setPendingSlashCommand(null)}
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
                    model={currentSettings.model as 'opus' | 'sonnet' | 'haiku'}
                    onModelChange={(model) => updateAgentSettings({ model })}
                    thinkingMode={currentSettings.thinkingMode as 'auto' | 'think' | 'hard' | 'harder' | 'ultra'}
                    onThinkingModeChange={(thinkingMode) => updateAgentSettings({ thinkingMode })}
                    permissionMode={currentSettings.permissionMode as 'plan' | 'bypass'}
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
                    pendingQuestionIds={pendingQuestionIdsMap.get(isTaskChat ? activeTaskId! : (activeId ?? '')) || new Set()}
                    answeredQuestions={answeredQuestionsMap.get(isTaskChat ? activeTaskId! : (activeId ?? '')) || new Map()}
                    currentSessionId={isTaskChat ? activeTaskId ?? undefined : activeSessionId ?? undefined}
                    // 🦆 SESSION-FIRST: Internal session ID for state management (attachments, settings)
                    internalSessionId={isTaskChat ? activeTaskId ?? undefined : activeSessionId ?? undefined}
                    // Fullscreen mode
                    isFullscreen={isChatFullscreen}
                    onToggleFullscreen={() => setIsChatFullscreen(!isChatFullscreen)}
                    // File Checkpointing (SDK 0.2.7+)
                    onRewindFiles={handleRewindFiles}
                    onOpenImageTab={handleOpenImageTab}
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
                    onSessionIdClick={handleSessionIdClick}
                    onDiffClick={handleDiffClick}
                    onEditsChange={handleEditsChange}
                    pendingAgentMention={pendingAgentMention}
                    onMentionInserted={() => setPendingAgentMention(null)}
                    pendingFileMention={pendingFileMention}
                    onFileMentionInserted={() => setPendingFileMention(null)}
                    pendingSlashCommand={pendingSlashCommand}
                    onCommandInserted={() => setPendingSlashCommand(null)}
                    basePath={activeSession.projectPath || explorerRoot || explorerPath}
                    inputDraft={taskInputDrafts.get(taskSessionId) || (taskMessages.length === 0 ? '' : '')}
                    onInputDraftChange={(draft) => {
                      setTaskInputDrafts(prev => {
                        const newMap = new Map(prev);
                        newMap.set(taskSessionId, draft);
                        return newMap;
                      });
                    }}
                    model={currentSettings.model as 'opus' | 'sonnet' | 'haiku'}
                    onModelChange={(model) => updateAgentSettings({ model })}
                    thinkingMode={currentSettings.thinkingMode as 'auto' | 'think' | 'hard' | 'harder' | 'ultra'}
                    onThinkingModeChange={(thinkingMode) => updateAgentSettings({ thinkingMode })}
                    permissionMode={currentSettings.permissionMode as 'plan' | 'bypass'}
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
                    pendingQuestionIds={pendingQuestionIdsMap.get(taskSessionId) || new Set()}
                    answeredQuestions={answeredQuestionsMap.get(taskSessionId) || new Map()}
                    // 🦆 FIX: Use Quack session ID (taskSessionId) for AskUserQuestion matching
                    // The backend stores questions keyed by sessionKey (Quack session ID), not claudeSessionId
                    currentSessionId={taskSessionId}
                    // 🦆 Internal session ID for state management (attachments, settings)
                    internalSessionId={taskSessionId}
                    // Fullscreen mode
                    isFullscreen={isChatFullscreen}
                    onToggleFullscreen={() => setIsChatFullscreen(!isChatFullscreen)}
                    // File Checkpointing (SDK 0.2.7+)
                    onRewindFiles={handleRewindFiles}
                    onOpenImageTab={handleOpenImageTab}
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
                        await invoke("open_file_in_editor", { path: previewFile.path });
                        toast.success("File opened in default editor");
                      } catch (error) {
                        console.error("Failed to open file in editor:", error);
                        toast.error("Failed to open file in editor");
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
                      workingDir={activeTerminal?.cwd ?? explorerPath ?? undefined}
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
                      workingDir={activeTerminal?.cwd ?? explorerPath ?? undefined}
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
                      workingDir={activeTerminal?.cwd ?? explorerPath ?? undefined}
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
                      workingDir={activeTerminal?.cwd ?? explorerPath ?? undefined}
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

              {/* Memory Graph Viewer - shown when memory-graph tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('memory-graph-') && !isKanbanTabActive && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'memory-graph') {
                  return <MemoryGraphTabView
                    tab={activeTab}
                    isActive={true}
                    onOpenSecondBrain={handleOpenSecondBrainWithNode}
                  />;
                }
                return null;
              })()}

              {/* Second Brain Outliner - shown when second-brain tab is active (hidden in Kanban mode) */}
              {activeTabId.startsWith('second-brain-') && !isKanbanTabActive && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'second-brain') {
                  return <SecondBrainTabView tab={activeTab} isActive={true} />;
                }
                return null;
              })()}

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
            </div>
          </div>
          )}
        </section>

        <SidePanel
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
          onTogglePip={togglePipWindow}
          isPipOpen={isPipOpen}
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
          onUseCommand={handleUseCommand}
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
          onImportAgent={async (importedAgent) => {
            // Refresh agent list after bundle import
            console.log('[App] Agent imported from bundle:', importedAgent.name);
            await loadAgents();
          }}
          projectName={projectName}
          gitBranch={gitBranch}
          agentRefreshKey={agentRefreshKey}
          onEditAgent={handleEditAgentFromContext}
          onSessionClick={handleSessionClick}
          activeSessionId={activeSessionId ?? undefined}
          // Terminal props
          activeTerminalId={activeId}
          terminals={terminals}
          onTerminalInput={handleTerminalInput}
          onTerminalOutput={handleTerminalOutput}
          onUpdateRecentCommands={(commands) => {
            recentCommandsRef.current = commands;
          }}
          onSelectTerminal={handleSelectTerminal}
          // TerminalToolBar props
          onExecuteCommand={handleExecuteAICommand}
          onToggleSavedCommands={() =>
            setSavedCommandsDrawerOpen((value) => !value)
          }
          savedCommandsOpen={savedCommandsDrawerOpen}
          onCreateTerminal={handleQuickCreateTerminal}
          // Usage props
          usageSessions={usageSessions}
          onClearUsage={handleClearUsage}
          onCreateTerminalWithCommand={handleCreateTerminalWithCommand}
          // Sessions props
          onSelectSession={handleSelectSession}
          sessionsRefreshKey={sessionsRefreshKey}
          // Collapse props - also collapse when special tabs (docs, second-brain, memory-graph, claude-assets, project-dashboard) are active
          // In Kanban mode: use kanbanSidePanelExpanded to control visibility
          isCollapsed={sidePanelCollapsed || activeTabId.startsWith('docs-') || activeTabId.startsWith('second-brain-') || activeTabId.startsWith('memory-graph-') || activeTabId.startsWith('claude-assets-') || activeTabId.startsWith('project-dashboard-') || (isKanbanTabActive && !kanbanSidePanelExpanded)}
          onToggleCollapse={() => {
            if (isKanbanTabActive) {
              // In Kanban mode, toggle kanbanSidePanelExpanded
              setKanbanSidePanelExpanded(!kanbanSidePanelExpanded);
            } else {
              setSidePanelCollapsed(!sidePanelCollapsed);
            }
          }}
          isKanbanTabActive={isKanbanTabActive} // Used to show/hide toggle button
          // MCP props
          onOpenMcpConfig={handleOpenMcpConfig}
          // Kanban Mini Panel props
          chatLoadingMap={chatLoadingMap}
          chatSessions={chatSessions}
          onKanbanTaskClick={(taskId) => {
            // Open Kanban tab and select the task
            handleOpenKanbanTab();
            // Select task in store
            const { selectTask, openDrawer } = useKanbanStore.getState();
            selectTask(taskId);
            openDrawer();
          }}
          onOpenKanban={handleOpenKanbanTab}
          showKanbanMiniPanel={showKanbanMiniPanel}
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
          onOpenDroidFactory={() => setDroidFactoryOpen(true)}
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
        />

        <SavedCommandsDrawer
          open={savedCommandsDrawerOpen}
          commands={savedCommands}
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
                rootPath={explorerPath}
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

        <div className={`git-drawer ${showPluginsDrawer ? "open" : ""}`}>
          <div
            className="git-drawer-backdrop"
            onClick={() => setShowPluginsDrawer(false)}
          />
          <div className="git-drawer-panel">
            <header className="git-drawer-header">
              <h2>Plugin Marketplace</h2>
              <button
                type="button"
                className="git-drawer-close"
                onClick={() => setShowPluginsDrawer(false)}
              >
                ✕
              </button>
            </header>
            <MarketplaceDrawer
              workingDir={explorerPath || undefined}
              onRefresh={handleMarketplaceRefresh}
            />
          </div>
        </div>

        <SavedCommandModal
          open={savedCommandModalOpen}
          command={editingCommand}
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
            onClose={() => setShowSettings(false)}
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

        {/* Old BackgroundTasksDrawer - removed, replaced by Kanban shell tasks */}

        {/* Kanban toast notifications for Claude tool events */}
        <KanbanToast />
      </div>

      {/* Watch Intro replay - uses SplashScreen component */}
      {introReplayActive && (
        <SplashScreen
          version={introVersion}
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

      {/* IDE Onboarding - First-run dialog to select preferred IDE */}
      <IDEOnboarding />

      {/* Terminal Window - Now opens as separate Tauri window via useTerminalWindowManager */}

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

