import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { invokeWithTimeout, fireAndForget } from "./utils/invokeWithTimeout";
import { useClaudeCliAvailability } from "./contexts/TestModeContext";
import { getTestModeStoreName } from "./utils/testModeStorage";
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
import { TitleBar } from "./components/TitleBar";
import UnifiedSettings from "./components/settings/UnifiedSettings";
import PerformanceMonitor from "./components/PerformanceMonitor";
import AIAssistant from "./components/AIAssistant";
import QuackAgencyDrawer from "./components/QuackAgencyDrawer";
import ContextDrawer from "./components/ContextDrawer";
import SkillDrawer from "./components/SkillDrawer";
import BackgroundsModal from "./components/BackgroundsModal";
import TelegramSetup from "./components/TelegramSetup";
import ChatView, { type LineChange } from "./components/ChatView";
import TabBar, { type Tab } from "./components/TabBar";
import ActionIcons from "./components/ActionIcons";
import { AgentTerminalTab } from "./components/AgentTerminalTab";
import { TerminalIcon } from "./components/TerminalIcon";
import AgentViewer from "./components/AgentViewer";
import SkillViewer from "./components/SkillViewer";
import CommandViewer from "./components/CommandViewer";
import BrowserManager from "./components/BrowserManager";
import { LicenseModal } from "./components/LicenseModal";
import { UpgradeModal } from "./components/UpgradeModal";
import { ProBanner } from "./components/ProBanner";
import { ClaudeAuthBanner } from "./components/ClaudeAuthBanner";
import { isPro, canCreateTerminal } from "./config/features";
import type { DiffInfo } from "./components/CodeEditorCodeMirror";
import { parseDiff } from "./lib/diffParser";
import type { ChatSendOptions } from "./hooks/useClaudeChat";
import type { SlashCommand } from "./hooks/useSlashCommands";
import { useDeepLinkHandler } from "./hooks/useDeepLinkHandler";
import { usePipWindow } from "./hooks/usePipWindow";
// import { useTelegramBot } from "./hooks/useTelegramBot"; // DEPRECATED - using Telegram Central Bot now
import {
  saveTerminalsToStorage,
  loadTerminalsFromStorage,
  saveTabsByTerminalToStorage,
  loadTabsByTerminalFromStorage,
  saveNativeTerminalsToStorage,
  loadNativeTerminalsFromStorage,
  STORAGE_KEY,
  TABS_BY_TERMINAL_KEY,
  NATIVE_TERMINALS_STORAGE_KEY,
  type TerminalMetadata,
} from "./services/terminalStorage";
import {
  saveAgentChatsToStorage,
  loadAgentChatsFromStorage,
} from "./services/agentChatStorage";
import { getDuckdroidUrl } from "./utils/agentAvatars";
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
} from "./types";
import { getRandomName } from "./utils/agentNames";

import "./App.css";
import "./components/MetroStyle.css";

const INTRO_REPLAY_DURATION_MS = 5000;

// Notification settings
const NOTIFY_ACTIVE_TERMINAL = true; // Send notifications even for active terminal

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

function App() {
  // Load assets INSIDE the component, not at module level
  const introAudio = new URL("../sounds/quack-intro.mp3", import.meta.url).href;
  const notificationAudio = new URL("../sounds/quack.mp3", import.meta.url).href;
  const duckBackgroundImage = new URL("../images/backgrounds/duck.png", import.meta.url).href;
  const ducksPatternBackgroundImage = new URL("../images/backgrounds/ducks-pattern.png", import.meta.url).href;
  const duckPattern3BackgroundImage = new URL("../images/backgrounds/duck-pattern3.png", import.meta.url).href;

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

  // AgentChat state (workspace containers for terminal tabs)
  // AgentChats kept for UI grouping only - NOT linked to terminals!
  const [agentChats, setAgentChats] = useState<AgentChat[]>([]);
  const [activeAgentChatId, setActiveAgentChatId] = useState<string | null>(null);

  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // NEW: Agent Terminals - Terminali integrati XTerm associati agli agenti (separati da terminals)
  const [agentTerminals, setAgentTerminals] = useState<AgentTerminal[]>([]);

  // Native Terminals state (Mac Terminal.app integration)
  const [nativeTerminals, setNativeTerminals] = useState<NativeTerminal[]>([]);
  const [showAddNativeTerminalModal, setShowAddNativeTerminalModal] = useState(false);

  // Derived state - moved here to fix TypeScript hoisting errors
  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null); // Agent currently used in chat (Quack Agency)

  const activeTerminal = useMemo(
    () => terminals.find((terminal) => terminal.id === activeId) ?? null,
    [activeId, terminals]
  );

  // Project context for chat header
  const [projectName, setProjectName] = useState<string>('');
  const [gitBranch, setGitBranch] = useState<string>('');

  const [explorerPath, setExplorerPath] = useState("");
  const [explorerTree, setExplorerTree] = useState<
    Record<string, DirectoryEntry[]>
  >({});
  const [explorerRoot, setExplorerRoot] = useState<string | null>(null);
  const [loadingExplorer, setLoadingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [refreshExplorerTrigger, setRefreshExplorerTrigger] = useState(0);
  const [creatingTerminal, setCreatingTerminal] = useState(false);

  // OpenAI API Key for Whisper
  const [openaiApiKey, setOpenaiApiKey] = useState<string | null>(null);
  const [showNewTerminalModal, setShowNewTerminalModal] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState("");
  const [newTerminalPath, setNewTerminalPath] = useState("");
  const [newTerminalColor, setNewTerminalColor] = useState<string>(TERMINAL_COLORS[0]);
  const [newTerminalWorkingOn, setNewTerminalWorkingOn] = useState("");
  const [newTerminalAvatar, setNewTerminalAvatar] = useState("68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg");
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
      return newPersonality;
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
  const [videoEnded, setVideoEnded] = useState(false);
  const [splashFadingOut, setSplashFadingOut] = useState(false);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
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

  // Tab system state
  const [tabs, setTabs] = useState<Tab[]>([
    { id: 'chat', label: 'Chat', type: 'chat', closable: false }
  ]);
  const [activeTabId, setActiveTabId] = useState('chat');
  // Track last active tab per terminal/agent
  const lastActiveTabPerTerminal = useRef<Map<string, string>>(new Map());

  // Wrapper to update activeTabId and save it for current terminal
  const updateActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    if (activeId) {
      lastActiveTabPerTerminal.current.set(activeId, tabId);
    }
  }, [activeId]);

  // Tabs per terminal/agent - each agent has its own set of file tabs
  const [tabsByTerminal, setTabsByTerminal] = useState<Map<string, Tab[]>>(new Map());

  // Track previous activeId to save tabs correctly when switching terminals
  const previousActiveIdRef = useRef<string | null>(null);

  const [gitSummary, setGitSummary] = useState<GitStatusSummary | null>(null);
  const [loadingGit, setLoadingGit] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [selectedGitPath, setSelectedGitPath] = useState<string | null>(null);
  const [diffContent, setDiffContent] = useState("");
  const [diffLoading, setDiffLoading] = useState(false);
  const [diffError, setDiffError] = useState<string | null>(null);
  const [diffView, setDiffView] = useState<"worktree" | "staged">("worktree");
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
  const introReplayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introAudioRef = useRef<HTMLAudioElement | null>(null);

  // Background state
  const [showBackgroundsModal, setShowBackgroundsModal] = useState(false);

  // 💰 License and upgrade modals state
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeLimitType, setUpgradeLimitType] = useState<'terminals' | 'groups' | 'backgrounds' | 'agency' | 'sync'>('terminals');
  const [isProUser, setIsProUser] = useState(isPro());
  const [proBannerExpanded, setProBannerExpanded] = useState(true);
  const [claudeCliAvailable, setClaudeCliAvailable] = useState<boolean | null>(null);
  const [claudeAuthBannerExpanded, setClaudeAuthBannerExpanded] = useState(true);
  const [claudeAuthBannerDismissed, setClaudeAuthBannerDismissed] = useState(false);
  const [currentBackground, setCurrentBackground] = useState("duck.png");

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
  // Track active streams per agent to prevent concurrency issues
  const activeStreamsRef = useRef<Map<string, Set<string>>>(new Map());
  // Track stream count for UI display (Map of agentId -> count)
  // const [activeStreamCounts, setActiveStreamCounts] = useState<Map<string, number>>(new Map());

  // 🦆 SESSION PERSISTENCE: Track which agents have already shown the resume message (to prevent duplicates)
  const resumeMessageShownRef = useRef<Set<string>>(new Set());

  // Agent Chat Settings - persistent configuration per agent
  const [agentChatSettings, setAgentChatSettings] = useState<Map<string, AgentChatSettings>>(new Map());

  // Usage tracking - cost and token usage from Claude Agent SDK
  const [usageSessions, setUsageSessions] = useState<SessionUsage[]>([]);

  // Token tracking per agent - cumulative session tokens for UI display
  const [chatTokensMap, setChatTokensMap] = useState<Map<string, {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
  }>>(new Map());

  // Session ID tracking per agent - for resuming sessions in terminal
  const [chatSessionIds, setChatSessionIds] = useState<Map<string, string>>(new Map());

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

  // Sync terminal status with chatLoadingMap and check if waiting for response
  useEffect(() => {
    setTerminals((prev) => {
      return prev.map((terminal) => {
        const isLoading = chatLoadingMap.get(terminal.id) ?? false;
        const newStatus = isLoading ? 'busy' : 'idle';

        // Check if chat is waiting for user response
        const chatMessages = chatSessions.get(terminal.id) ?? [];
        const lastMessage = chatMessages[chatMessages.length - 1];
        const isWaitingForResponse =
          !isLoading && // Not currently loading
          chatMessages.length > 0 && // Has messages
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

    // Save current tabs for previous agent (if any)
    if (previousId && previousId !== activeId) {
      // console.log(`🦆 [Tab Management] Saving tabs for agent: ${previousId}`, tabs); // Performance: Disabled logging
      setTabsByTerminal((prev) => {
        const updated = new Map(prev);
        // Filter out chat tab (always present) - save only file/terminal tabs
        const agentTabs = tabs.filter(t => t.type !== 'chat');
        updated.set(previousId, agentTabs);
        return updated;
      });
    }

    // Restore tabs for new active agent
    if (activeId) {
      const restoredTabs = tabsByTerminal.get(activeId) || [];
      // console.log(`🦆 [Tab Management] Restoring tabs for agent: ${activeId}`, restoredTabs); // Performance: Disabled logging

      // Always include chat tab + restored agent tabs
      setTabs([
        { id: 'chat', label: 'Chat', type: 'chat', closable: false },
        ...restoredTabs
      ]);

      // Always activate chat tab when switching agents for consistent UX
      // Users expect to see the agent chat first, not the last visited tab
      setActiveTabId('chat');
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
  useEffect(() => {
    if (!tauriAvailable) return;

    // Track all active listeners (Map of agentId -> unlisten function)
    const listenersMap = new Map<string, () => void>();

    // Get all agent IDs that have chat sessions
    const activeAgentIds = Array.from(chatSessions.keys());

    // console.log('[Multi-Listener] Setting up listeners for agents:', activeAgentIds); // Performance: Disabled logging

    // Setup listener for each active agent
    const setupPromises = activeAgentIds.map(async (agentId) => {
      const eventName = `claude-event:${agentId}`;

      try {
        const unlisten = await listen<ClaudeEvent>(eventName, (event) => {
          const claudeEvent = event.payload;

          // console.log(`[Multi-Listener] Event received for agent ${agentId}:`, claudeEvent.type); // Performance: Disabled logging

          // Update chat session with incoming events
          setChatSessions((prev) => {
            const newSessions = new Map(prev);
            const agentMessages = newSessions.get(agentId) ?? [];
            const lastMsg = agentMessages[agentMessages.length - 1];

            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.status === 'streaming') {
              const updatedMessages = [...agentMessages];

              // 🦆 FIX: Update timestamp when assistant STARTS responding (first event with content)
              // This ensures agents sort correctly (by response time, not user input time)
              // Check if timestamp is still 0 (placeholder) and this is an assistant event with content
              const isFirstAssistantResponse = claudeEvent.type === 'assistant' &&
                                               claudeEvent.message?.content &&
                                               claudeEvent.message.content.length > 0 &&
                                               lastMsg.timestamp === 0;

              updatedMessages[updatedMessages.length - 1] = {
                ...lastMsg,
                events: [...(lastMsg.events || []), claudeEvent],
                // Update timestamp ONLY when first assistant response arrives (timestamp was 0)
                timestamp: isFirstAssistantResponse ? Date.now() : lastMsg.timestamp,
              };
              newSessions.set(agentId, updatedMessages);

              // Extract and save text content from assistant messages for Telegram notifications
              if (claudeEvent.type === 'assistant' && claudeEvent.message?.content) {
                let textContent = '';
                claudeEvent.message.content.forEach((content) => {
                  if (content.type === 'text' && content.text) {
                    textContent += content.text;
                  }
                });

                if (textContent) {
                  // Append to existing response text (streaming)
                  const existingText = lastAgentResponseRef.current.get(agentId) || '';
                  lastAgentResponseRef.current.set(agentId, existingText + textContent);
                }
              }
            }

            return newSessions;
          });

          // Track tokens from result events - ACCUMULATE each turn's usage
          // Note: result.usage contains tokens for the SINGLE turn, not cumulative session total
          // We must manually accumulate across all turns to get total session usage
          if (claudeEvent.type === 'result' && claudeEvent.usage) {
            const usage = claudeEvent.usage;

            setChatTokensMap((prev) => {
              const newMap = new Map(prev);
              const currentTokens = newMap.get(agentId) || {
                inputTokens: 0,
                outputTokens: 0,
                cacheCreationTokens: 0,
                cacheReadTokens: 0,
              };

              const updatedTokens = {
                inputTokens: currentTokens.inputTokens + usage.input_tokens,
                outputTokens: currentTokens.outputTokens + usage.output_tokens,
                cacheCreationTokens: currentTokens.cacheCreationTokens + (usage.cache_creation_input_tokens || 0),
                cacheReadTokens: currentTokens.cacheReadTokens + (usage.cache_read_input_tokens || 0),
              };

              newMap.set(agentId, updatedTokens);

              const total = updatedTokens.inputTokens + updatedTokens.outputTokens +
                           updatedTokens.cacheCreationTokens + updatedTokens.cacheReadTokens;
              console.log(`[Token Tracking] Accumulated tokens for agent ${agentId}: ${total} total`, updatedTokens);

              // 🦆 STAMINA PRESERVATION: Update agentChats with new token counts
              setAgentChats((prev) => {
                return prev.map((agent) => {
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
          }

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

            const agentSession = chatSessions.get(agentId);
            console.log('🦆 [Telegram] Agent completed:', {
              agentId,
              agentName: agentMetadata?.name,
              workingDir: agentMetadata?.cwd,
              hasSession: !!agentSession,
              isError: claudeEvent.is_error,
              hasMetadata: !!agentMetadata,
            });

            // 🦆 Telegram notification now handled by notifyAgentReady in the "result" handler above

            // Get all events from the last message to check for Write/Edit tools
            setChatSessions((prev) => {
              const agentMessages = prev.get(agentId) ?? [];
              const lastMsg = agentMessages[agentMessages.length - 1];

              if (lastMsg && lastMsg.events) {
                let hasFileModifications = false;

                // Check assistant events for Write/Edit tool uses
                lastMsg.events.forEach((evt) => {
                  if (evt.type === 'assistant' && evt.message?.content) {
                    evt.message.content.forEach((content) => {
                      if (content.type === 'tool_use') {
                        const toolName = content.name?.toLowerCase();
                        const input = content.input as any;

                        // Check if Write or Edit tools were used
                        if ((toolName === 'write' && input?.file_path) ||
                            (toolName === 'edit' && input?.file_path)) {
                          hasFileModifications = true;
                        }
                      }
                    });
                  }
                });

                // Trigger FileExplorer refresh if files were modified
                if (hasFileModifications) {
                  setRefreshExplorerTrigger(prev => prev + 1);
                }
              }

              return prev;
            });
          }
        });

        listenersMap.set(agentId, unlisten);
        console.log(`[Multi-Listener] Listener registered for agent: ${agentId}`);
      } catch (error) {
        console.error(`[Multi-Listener] Failed to setup listener for ${agentId}:`, error);
      }
    });

    // Wait for all listeners to be setup
    Promise.all(setupPromises).catch((error) => {
      console.error('[Multi-Listener] Error setting up listeners:', error);
    });

    // Cleanup ALL listeners when component unmounts or chatSessions change
    return () => {
      console.log('[Multi-Listener] Cleaning up listeners for:', Array.from(listenersMap.keys()));
      listenersMap.forEach((unlisten, agentId) => {
        try {
          unlisten();
          console.log(`[Multi-Listener] Listener removed for agent: ${agentId}`);
        } catch (error) {
          console.error(`[Multi-Listener] Error removing listener for ${agentId}:`, error);
        }
      });
      listenersMap.clear();
    };
  }, [tauriAvailable, chatSessions]); // 🦆 Now depends on chatSessions, not activeId!

  // 🦆 SESSION PERSISTENCE: Show "Continuing conversation" message when switching to agent with saved session
  useEffect(() => {
    if (!activeId) return;

    // Check if we've already shown the message for this agent
    if (resumeMessageShownRef.current.has(activeId)) return;

    // Check if this agent has a saved session ID
    const savedSessionId = chatSessionIds.get(activeId);
    if (!savedSessionId) return;

    // Check if chat is empty (no messages yet)
    const currentMessages = chatSessions.get(activeId) ?? [];
    if (currentMessages.length > 0) return; // Already has messages, don't show the banner

    // Show "Continuing conversation" message
    const resumeMessage: ChatMessage = {
      id: `msg-system-resume-${Date.now()}`,
      role: 'assistant',
      content: '📜 **Previous conversation detected**\n\nThis agent has an active session. The conversation history is preserved and will continue from where you left off.\n\n💡 Right-click the agent and select "Reset Agent" to start fresh.',
      timestamp: Date.now(),
      status: 'complete',
    };

    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      newSessions.set(activeId, [resumeMessage]);
      return newSessions;
    });

    // Mark this agent as having shown the resume message
    resumeMessageShownRef.current.add(activeId);

    console.log(`[Session Persistence] Showed resume message for agent ${activeId} with session ${savedSessionId}`);
  }, [activeId, chatSessionIds]);

  // Send message for specific agent
  const sendMessageForAgent = useCallback(async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || !activeId) return;

    // Populate ref for Telegram integration (on first call)
    if (!sendMessageForAgentRef.current) {
      sendMessageForAgentRef.current = sendMessageForAgent;
    }

    // Generate unique message ID for this stream
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const streamKey = `${activeId}-${messageId}`;

    console.log(`[sendMessage] Starting stream ${streamKey}`);

    // Save the prompt for restoration on abort
    lastPromptsRef.current.set(activeId, content);

    // Create abort controller with composite key to prevent race conditions
    const abortController = new AbortController();
    abortControllersRef.current.set(streamKey, abortController);

    // Track this stream as active for this agent
    if (!activeStreamsRef.current.has(activeId)) {
      activeStreamsRef.current.set(activeId, new Set());
    }
    activeStreamsRef.current.get(activeId)!.add(streamKey);

    // Update stream count for UI
    // setActiveStreamCounts((prev) => {
    //   const newCounts = new Map(prev);
    //   newCounts.set(activeId, activeStreamsRef.current.get(activeId)!.size);
    //   return newCounts;
    // });

    console.log(`[sendMessage] Active streams for ${activeId}:`, activeStreamsRef.current.get(activeId)?.size || 0);

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
        const agentMessages = newSessions.get(activeId) ?? [];
        newSessions.set(activeId, [...agentMessages, errorMessage]);
        return newSessions;
      });
      return;
    }

    // Get current agent's chat session
    const currentMessages = chatSessions.get(activeId) ?? [];

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
        id: `msg-${Date.now()}-agent-system`,
        role: 'system',
        content: `🦆 Invoking agent: **${activeAgent.name}**`,
        timestamp: Date.now() + 1, // Slightly after user message
        status: 'complete',
      };
      messagesToAdd.push(agentSystemMessage);
    }

    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      newSessions.set(activeId, [...currentMessages, ...messagesToAdd]);
      return newSessions;
    });

    // Set loading for this agent
    setChatLoadingMap((prev) => {
      const newMap = new Map(prev);
      newMap.set(activeId, true);
      return newMap;
    });

    // Create assistant message placeholder
    const assistantMessageId = `msg-${Date.now()}-assistant`;
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      // 🦆 FIX: Start with timestamp = 0 so it doesn't affect sorting until assistant responds
      // Timestamp will be updated to Date.now() when first response arrives (see event listener)
      timestamp: 0,
      status: 'streaming',
    };

    // Clear previous response text for this agent (new conversation turn)
    lastAgentResponseRef.current.delete(activeId);

    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      const agentMessages = newSessions.get(activeId) ?? [];
      newSessions.set(activeId, [...agentMessages, assistantMessage]);
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
      const workingDir = activeTerminal?.cwd ?? explorerPath;

      // Create abort promise that rejects when signal is aborted
      const abortPromise = new Promise<never>((_, reject) => {
        if (abortController.signal.aborted) {
          reject(new Error('Aborted'));
        }
        abortController.signal.addEventListener('abort', () => {
          reject(new Error('Aborted'));
        });
      });

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
            agents: activeAgent ? [{
              name: activeAgent.name,
              description: activeAgent.description,
              model: activeAgent.model,
              filePath: activeAgent.file_path,
            }] : undefined,
            cwd: workingDir,
            // ✅ CRITICAL FIX: Pass saved session ID to backend for conversation continuity
            sessionId: chatSessionIds.get(activeId),
          },
        }),
        abortPromise,
      ]);

      // Update message with final result
      setChatSessions((prev) => {
        const newSessions = new Map(prev);
        const agentMessages = newSessions.get(activeId) ?? [];
        newSessions.set(
          activeId,
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

      // ✅ CRITICAL FIX: Save session ID for resume support
      setChatSessionIds((prev) => {
        const updated = new Map(prev);
        updated.set(activeId, response.session_id);
        return updated;
      });

      // 🦆 SESSION PERSISTENCE: Save session ID in AgentChat for persistence across app restarts
      setAgentChats((prev) => {
        return prev.map((agent) => {
          if (agent.id === activeId) {
            return {
              ...agent,
              sessionId: response.session_id,
            };
          }
          return agent;
        });
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

      // Keep active agent persistent - don't reset after sending
      // The agent stays active until explicitly cleared by the user
    } catch (err) {
      console.error('Error calling Claude SDK:', err);

      // Check if this was an abort
      if (abortController.signal.aborted) {
        console.log('[sendMessageForAgent] Stream was aborted by user');

        // Update message with aborted status
        setChatSessions((prev) => {
          const newSessions = new Map(prev);
          const agentMessages = newSessions.get(activeId) ?? [];
          newSessions.set(
            activeId,
            agentMessages.map((msg) =>
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

        // Update message with error
        setChatSessions((prev) => {
          const newSessions = new Map(prev);
          const agentMessages = newSessions.get(activeId) ?? [];
          newSessions.set(
            activeId,
            agentMessages.map((msg) =>
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
      // Clear loading for this agent
      setChatLoadingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(activeId, false);
        return newMap;
      });

      // Clean up abort controller with composite key
      abortControllersRef.current.delete(streamKey);

      // Remove from active streams
      const activeStreams = activeStreamsRef.current.get(activeId);
      if (activeStreams) {
        activeStreams.delete(streamKey);
        if (activeStreams.size === 0) {
          activeStreamsRef.current.delete(activeId);
        }
      }

      // Update stream count for UI
      // setActiveStreamCounts((prev) => {
      //   const newCounts = new Map(prev);
      //   const currentCount = activeStreamsRef.current.get(activeId)?.size || 0;
      //   if (currentCount === 0) {
      //     newCounts.delete(activeId);
      //   } else {
      //     newCounts.set(activeId, currentCount);
      //   }
      //   return newCounts;
      // });

      console.log(`[sendMessage] Stream ${streamKey} ended. Remaining streams for ${activeId}:`, activeStreamsRef.current.get(activeId)?.size || 0);
    }
  }, [activeId, isChatConfigured, chatSessions, activeAgent, activeTerminal?.cwd, explorerPath]);

  // Abort streaming for specific agent - aborts ALL active streams for this agent
  const abortStreamForAgent = useCallback(() => {
    if (!activeId) return;

    const activeStreams = activeStreamsRef.current.get(activeId);
    if (!activeStreams || activeStreams.size === 0) {
      console.log('[abortStreamForAgent] No active streams for agent:', activeId);
      return;
    }

    console.log(`[abortStreamForAgent] Aborting ${activeStreams.size} stream(s) for agent: ${activeId}`);

    // Abort all active streams for this agent
    activeStreams.forEach((streamKey) => {
      const abortController = abortControllersRef.current.get(streamKey);
      if (abortController && !abortController.signal.aborted) {
        console.log(`[abortStreamForAgent] Aborting stream: ${streamKey}`);
        abortController.abort();
      }
    });
  }, [activeId]);

  // Get last prompt for specific agent
  const getLastPromptForAgent = useCallback(() => {
    if (!activeId) return '';
    return lastPromptsRef.current.get(activeId) || '';
  }, [activeId]);

  // Compact conversation for current agent (custom implementation since SDK /compact is buggy)
  const compactCurrentAgentConversation = useCallback(async () => {
    if (!activeId) return;

    const currentMessages = chatSessions.get(activeId) ?? [];
    const totalMessages = currentMessages.length;

    // Need at least 6 messages to compact (keep last 5, summarize the rest)
    if (totalMessages < 6) {
      toast.info('Not enough messages to compact (need at least 6)', {
        duration: 3000,
      });
      return;
    }

    console.log('[compactConversation] Starting compaction for agent:', activeId);

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
        newMap.set(activeId, true);
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
        newSessions.set(activeId, [summaryMessage, ...messagesToPreserve]);
        return newSessions;
      });

      console.log(`[compactConversation] Compaction complete: ${messagesToSummarize.length} messages → 1 summary`);

      // Get current tokens and estimate reduction
      const currentTokens = chatTokensMap.get(activeId);
      const currentInputTokens = currentTokens?.inputTokens || 0;
      const currentOutputTokens = currentTokens?.outputTokens || 0;

      // Estimate 60% reduction (based on removed messages)
      const reducedInputTokens = Math.floor(currentInputTokens * 0.4);
      const reducedOutputTokens = Math.floor(currentOutputTokens * 0.4);
      const savedTokens = (currentInputTokens + currentOutputTokens) - (reducedInputTokens + reducedOutputTokens);

      // Update token counts
      setChatTokensMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(activeId, {
          inputTokens: reducedInputTokens,
          outputTokens: reducedOutputTokens,
          cacheCreationTokens: currentTokens?.cacheCreationTokens || 0,
          cacheReadTokens: currentTokens?.cacheReadTokens || 0,
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
        newMap.set(activeId, false);
        return newMap;
      });
    }
  }, [activeId, chatSessions, chatTokensMap, activeTerminal, explorerPath]);

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

      // Clear resume message flag so it can show again if a new session is created
      resumeMessageShownRef.current.delete(activeId);

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

  // Open current session in terminal tab with claude --resume command
  const openSessionInTerminal = useCallback(async () => {
    if (!activeId || !tauriAvailable) return;

    const sessionId = chatSessionIds.get(activeId);
    if (!sessionId) {
      toast.error('No session ID found for this agent');
      return;
    }

    try {
      // Get current agent info
      const currentAgent = terminals.find((t) => t.id === activeId);
      const terminalCwd = currentAgent?.cwd || explorerPath || process.env.HOME || '~';
      const terminalLabel = `Resume ${sessionId.slice(0, 8)}`;

      // Create backend terminal (PTY)
      const created = await invoke<TerminalInfo>('create_terminal', {
        label: terminalLabel,
        color: currentAgent?.color || TERMINAL_COLORS[0],
        cwd: terminalCwd,
      });

      // Create AgentTerminal entry (associated with active agent)
      const newAgentTerminal: AgentTerminal = {
        id: created.id,
        name: terminalLabel,
        agentId: activeId, // Associate with active agent
        color: currentAgent?.color || TERMINAL_COLORS[0],
        cwd: terminalCwd,
        alive: true,
        createdAt: Date.now(),
      };

      setAgentTerminals((prev) => [...prev, newAgentTerminal]);

      // Create Tab for this terminal
      const agentTerminalTab: Tab = {
        id: `agent-terminal-${created.id}`,
        label: terminalLabel,
        type: 'agent-terminal',
        closable: true,
        color: currentAgent?.color || TERMINAL_COLORS[0],
        terminalId: created.id,
      };

      setTabs((prev) => [...prev, agentTerminalTab]);
      setActiveTabId(agentTerminalTab.id);

      // Execute claude --resume command in the new terminal
      await invoke('write_to_terminal', {
        id: created.id,
        data: `claude --resume ${sessionId}\n`,
      });

      toast.success(`Opened session in terminal tab`, {
        duration: 3000,
      });
    } catch (error) {
      console.error('Failed to open session in terminal:', error);
      toast.error('Failed to open session in terminal');
    }
  }, [activeId, chatSessionIds, terminals, explorerPath, tauriAvailable]);

  // Quack Agency state
  const [showQuackAgencyDrawer, setShowQuackAgencyDrawer] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, _setSelectedAgent] = useState<AgentDetails | null>(null);
  // activeAgent moved to top of component for TypeScript hoisting
  const [pendingAgentMention, setPendingAgentMention] = useState<AgentInfo | null>(null); // Agent to insert as @mention in input
  const [pendingFileMention, setPendingFileMention] = useState<{ name: string; path: string; relativePath: string } | null>(null); // File to insert as @file mention
  const [pendingSlashCommand, setPendingSlashCommand] = useState<{ name: string; description: string } | null>(null); // Slash command to insert in input
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentsDirectoryExists, setAgentsDirectoryExists] = useState<boolean>(true);

  // Skills state
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loadingSkills, setLoadingSkills] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);
  const [skillsDirectoryExists, setSkillsDirectoryExists] = useState<boolean>(true);

  // Context drawer state
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [contextScope, setContextScope] = useState<string | null>(null);

  // Skills drawer state
  const [showSkillDrawer, setShowSkillDrawer] = useState(false);
  const [selectedSkill, setSelectedSkill] = useState<SkillInfo | null>(null);

  // PiP Window hook
  const { isPipOpen, togglePipWindow, updatePipAgents, showPipWindow, hidePipWindow } = usePipWindow();

  // activeTerminal moved to top of component for TypeScript hoisting

  // Compute current agent's chat messages and loading state
  const currentAgentMessages = useMemo(() => {
    return activeId ? (chatSessions.get(activeId) ?? []) : [];
  }, [activeId, chatSessions]);

  const currentAgentLoading = useMemo(() => {
    return activeId ? (chatLoadingMap.get(activeId) ?? false) : false;
  }, [activeId, chatLoadingMap]);

  const currentAgentTokens = useMemo(() => {
    return activeId ? (chatTokensMap.get(activeId) ?? {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    }) : {
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    };
  }, [activeId, chatTokensMap]);

  const selectedGitEntry = useMemo(() => {
    if (!gitSummary || !selectedGitPath) {
      return null;
    }
    return (
      gitSummary.entries.find((entry) => entry.path === selectedGitPath) ?? null
    );
  }, [gitSummary, selectedGitPath]);

  const gridTemplateColumns = sidePanelCollapsed
    ? "360px minmax(0, 1fr) 0px"
    : "360px minmax(0, 1fr) 420px";

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

  const getCurrentAgentSettings = useCallback((): AgentChatSettings => {
    if (!activeId) {
      // Default settings when no agent is active
      return {
        inputDraft: '',
        model: 'sonnet',
        thinkingMode: 'auto',
        permissionMode: 'bypass',
      };
    }

    const existing = agentChatSettings.get(activeId);
    if (existing) {
      // Normalize the model name in case it's a legacy full ID
      return {
        ...existing,
        model: normalizeModelName(existing.model),
      };
    }

    // Initialize default settings for new agent
    const defaultSettings: AgentChatSettings = {
      inputDraft: '',
      model: 'sonnet',
      thinkingMode: 'auto',
      permissionMode: 'bypass',
    };

    setAgentChatSettings((prev) => {
      const newMap = new Map(prev);
      newMap.set(activeId, defaultSettings);
      return newMap;
    });

    return defaultSettings;
  }, [activeId, agentChatSettings]);

  const updateAgentSettings = useCallback((updates: Partial<AgentChatSettings>) => {
    if (!activeId) return;

    setAgentChatSettings((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(activeId) ?? {
        inputDraft: '',
        model: 'sonnet',
        thinkingMode: 'auto',
        permissionMode: 'bypass',
      };

      // Auto-switch model based on permission mode if permission mode is being changed
      let finalUpdates = { ...updates };
      if (updates.permissionMode !== undefined && updates.permissionMode !== current.permissionMode) {
        // When switching to plan mode → use opus
        if (updates.permissionMode === 'plan') {
          finalUpdates.model = 'opus';
        }
        // When switching to bypass mode → use sonnet
        else if (updates.permissionMode === 'bypass') {
          finalUpdates.model = 'sonnet';
        }
      }

      newMap.set(activeId, { ...current, ...finalUpdates });
      return newMap;
    });
  }, [activeId]);

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
    if (introReplayTimeoutRef.current) {
      clearTimeout(introReplayTimeoutRef.current);
      introReplayTimeoutRef.current = null;
    }

    if (introAudioRef.current) {
      introAudioRef.current.pause();
      introAudioRef.current.currentTime = 0;
      introAudioRef.current = null;
    }

    setIntroReplayActive(true);

    const audio = new Audio(introAudio);
    audio.volume = 0.5;
    audio.play().catch((error) => {
      console.warn("Unable to play intro audio:", error);
    });
    introAudioRef.current = audio;

    introReplayTimeoutRef.current = setTimeout(() => {
      setIntroReplayActive(false);
      if (introAudioRef.current) {
        introAudioRef.current.pause();
        introAudioRef.current.currentTime = 0;
        introAudioRef.current = null;
      }
      introReplayTimeoutRef.current = null;
    }, INTRO_REPLAY_DURATION_MS);
  }, [introAudio]);

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

    // Listen for Telegram /status command
    const unlistenTelegramStatusPromise = listen<{ unique_id: string; telegram_chat_id: number }>(
      "telegram-command-status",
      async (event) => {
        console.log("🦆 Telegram /status command received:", event.payload);
        const { telegram_chat_id } = event.payload;

        try {
          // Get all active agents (terminals)
          const activeAgents = terminals
            .filter((t) => t.status === "busy" || t.status === "idle")
            .map((t) => `• ${t.label} - ${t.status === "busy" ? "🟡 Working" : "🟢 Ready"}`)
            .join("\n");

          const message = activeAgents.length > 0
            ? `🦆 *Active Agents* (${terminals.length})\n\n${activeAgents}`
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
      unlistenPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenAISettingsPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenWatchIntroPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenBackgroundsPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenOpenPipPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenTelegramStatusPromise.then(unlisten => unlisten()).catch(() => undefined);
    };
  }, [loadSavedCommands, showIntroReplay, tauriAvailable, togglePipWindow, terminals]);

  // Auto-save terminals to storage (debounced to avoid excessive writes)
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }

    // Debounce storage save - wait 2 seconds after last change before saving
    const saveTimer = setTimeout(() => {
      if (terminals.length > 0) {
        void saveTerminalsToStorage(terminals);
      } else {
        // If no terminals, clean up storage
        void (async () => {
          try {
            const store = await Store.load(getTestModeStoreName("quack-terminals.json"));
            await store.delete(STORAGE_KEY);
            await store.save();
          } catch {
            // Ignore errors
          }
        })();
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

  // Auto-save AgentChats when they change (Phase 1)
  useEffect(() => {
    if (!tauriAvailable) return;

    const saveDebounced = debounce(() => {
      if (agentChats.length > 0) {
        void saveAgentChatsToStorage(agentChats);
      }
    }, 1000);

    saveDebounced();

    return () => {
      saveDebounced.cancel();
    };
  }, [agentChats, tauriAvailable]);

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

      // Show in-app toast notification
      toast.success(`${payload.label}`, {
        description: "Hey, you can do something here!",
        duration: 4000,
      });

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
        // Find the terminal to get its cwd and extract project name
        const terminal = terminals.find(t => t.id === payload.id || t.label === payload.label);
        const agentName = payload.label || "AI Assistant";

        // Extract project name from cwd (last folder in path)
        let projectName = "Project";
        if (terminal?.cwd) {
          const pathParts = terminal.cwd.split(/[/\\]/);
          projectName = pathParts.filter(Boolean).pop() || "Project";
        }

        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: projectName,
          body: `${agentName}: Hey, you can do something here!`,
        });
      } catch (error) {
        console.warn("Unable to show notification", error);
      }
    },
    [ensureNotificationPermission, notificationGranted, playQuackSound, tauriAvailable, terminals]
  );

  // Notify when agent/chat completes response
  const notifyAgentReady = useCallback(
    async (payload: { id: string; label: string; cwd?: string }) => {
      playQuackSound();

      // Show in-app toast notification
      toast.success(`${payload.label}`, {
        description: "Response completed! 🦆",
        duration: 4000,
      });

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
        const agentName = payload.label || "AI Assistant";

        // Extract project name from cwd (last folder in path)
        let projectName = "Project";
        if (payload.cwd) {
          const pathParts = payload.cwd.split(/[/\\]/);
          projectName = pathParts.filter(Boolean).pop() || "Project";
        }

        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: projectName,
          body: `${agentName}: Response completed! 🦆`,
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
    [ensureNotificationPermission, notificationGranted, playQuackSound, tauriAvailable]
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
      const workingDir = activeTerminal?.cwd ?? explorerPath ?? undefined;

      // Check if agents directory exists
      const dirExists = await invoke<boolean>("check_agents_directory", {
        workingDir,
      });
      setAgentsDirectoryExists(dirExists);

      if (!dirExists) {
        setAgents([]);
        setAgentsError(null); // Clear error if directory just doesn't exist
        return;
      }

      const agentsList = await invoke<AgentInfo[]>("list_agents", {
        workingDir,
      });
      setAgents(agentsList);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAgentsError(message);
      setAgents([]);
    } finally {
      setLoadingAgents(false);
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

  // Skills handlers
  const loadSkills = useCallback(async () => {
    if (!tauriAvailable) {
      return;
    }

    setLoadingSkills(true);
    setSkillsError(null);

    try {
      const workingDir = activeTerminal?.cwd ?? explorerPath ?? undefined;

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
      const workingDir = activeTerminal?.cwd ?? explorerPath ?? undefined;
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

  const handleViewCommand = useCallback((command: SlashCommand) => {
    if (!tauriAvailable) {
      return;
    }

    try {
      // Create a new tab for the command
      const commandTabId = `command-${command.name}-${command.scope}`;

      // Check if tab already exists
      const existingTab = tabs.find(t => t.id === commandTabId);

      if (existingTab) {
        // Tab already exists, just switch to it
        setActiveTabId(commandTabId);
      } else {
        // Create new command tab
        const newTab: Tab = {
          id: commandTabId,
          label: command.name,
          type: 'command',
          closable: true,
          command: command,
          // icon removed - rendered directly in TabBar to avoid React serialization issues
        };

        setTabs(prevTabs => [...prevTabs, newTab]);
        setActiveTabId(commandTabId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to open command: ${message}`);
    }
  }, [tauriAvailable, tabs]);

  const handleClearAgent = useCallback(() => {
    setActiveAgent(null);
    toast.info('Agent deactivated', {
      description: 'Chat will use default model settings',
      duration: 2000,
    });
  }, []);


  // Load Quack Agency agents on startup
  // Load Agents on startup only (not on every terminal switch!)
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }
    void loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tauriAvailable, hasBootstrapped]); // Intentionally NOT including loadAgents to prevent re-load on every switch

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
    // Check if it's a gradient
    if (backgroundName.startsWith('gradient-')) {
      // Map gradient names to actual CSS gradients - MUCH more colorful!
      const gradientMap: Record<string, string> = {
        'gradient-black-plain': 'linear-gradient(#000000, #000000)',
        'gradient-dark-gray-plain': 'linear-gradient(#0D1118, #0D1118)',
        'gradient-orange-dark': 'linear-gradient(135deg, #1a0f0a 0%, #3d2415 25%, #5a3a25 50%, #3d2415 75%, #1a0f0a 100%)',
        'gradient-blue-dark': 'linear-gradient(135deg, #0a0f1a 0%, #15243d 25%, #20355a 50%, #15243d 75%, #0a0f1a 100%)',
        'gradient-green-dark': 'linear-gradient(135deg, #0a1a0f 0%, #15392d 25%, #20564a 50%, #15392d 75%, #0a1a0f 100%)',
        'gradient-purple-dark': 'linear-gradient(135deg, #160a1a 0%, #2d1539 25%, #4a2056 50%, #2d1539 75%, #160a1a 100%)',
        'gradient-red-dark': 'linear-gradient(135deg, #1a0a0a 0%, #3d1515 25%, #5a2020 50%, #3d1515 75%, #1a0a0a 100%)',
        'gradient-teal-dark': 'linear-gradient(135deg, #0a1a1a 0%, #153d3d 25%, #205a5a 50%, #153d3d 75%, #0a1a1a 100%)',
        'gradient-amber-dark': 'linear-gradient(135deg, #1a150a 0%, #3d3015 25%, #5a4a20 50%, #3d3015 75%, #1a150a 100%)',
      };

      const gradient = gradientMap[backgroundName];
      if (gradient) {
        document.body.style.backgroundImage = gradient;
        document.body.style.backgroundSize = '';
      }
    } else {
      // It's an image file - use pre-loaded URLs from component scope
      const imageMap: Record<string, string> = {
        'duck.png': duckBackgroundImage,
        'ducks-pattern.png': ducksPatternBackgroundImage,
        'duck-pattern3.png': duckPattern3BackgroundImage,
      };

      const imagePath = imageMap[backgroundName] || `/images/backgrounds/${backgroundName}`;
      document.body.style.backgroundImage = `url('${imagePath}')`;

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

  // Load saved background on mount (only after video ends)
  useEffect(() => {
    if (!tauriAvailable || !videoEnded) {
      return;
    }

    const loadBackground = async () => {
      try {
        const savedBackground = await invoke<string>("get_background_image");
        setCurrentBackground(savedBackground);
        applyBackground(savedBackground);
      } catch (error) {
        console.warn("Unable to load saved background", error);
      }
    };

    void loadBackground();
  }, [tauriAvailable, videoEnded, applyBackground]);

  // Apply background when it changes (only after video ends)
  useEffect(() => {
    if (!currentBackground || !videoEnded) {
      return;
    }

    applyBackground(currentBackground);
  }, [currentBackground, videoEnded, applyBackground]);

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

        // Try to load saved terminals
        const savedMetadata = await loadTerminalsFromStorage();

        if (savedMetadata.length > 0) {
          console.log(`Found ${savedMetadata.length} saved terminals`);

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

          // Load AgentChats for UI grouping (optional)
          const existingChats = await loadAgentChatsFromStorage();
          if (existingChats.length > 0) {
            setAgentChats(existingChats);

            // 🦆 STAMINA PRESERVATION: Initialize chatTokensMap with saved token counts
            const initialTokensMap = new Map<string, {
              inputTokens: number;
              outputTokens: number;
              cacheCreationTokens: number;
              cacheReadTokens: number;
            }>();
            const initialSessionIds = new Map<string, string>();

            existingChats.forEach((agent) => {
              // Load tokens
              if (agent.inputTokens !== undefined || agent.outputTokens !== undefined) {
                initialTokensMap.set(agent.id, {
                  inputTokens: agent.inputTokens ?? 0,
                  outputTokens: agent.outputTokens ?? 0,
                  cacheCreationTokens: agent.cacheCreationTokens ?? 0,
                  cacheReadTokens: agent.cacheReadTokens ?? 0,
                });
              }

              // 🦆 SESSION PERSISTENCE: Load session IDs
              if (agent.sessionId) {
                initialSessionIds.set(agent.id, agent.sessionId);
              }
            });

            if (initialTokensMap.size > 0) {
              setChatTokensMap(initialTokensMap);
              console.log(`[Stamina Preservation] Loaded tokens for ${initialTokensMap.size} agents`);
            }

            if (initialSessionIds.size > 0) {
              setChatSessionIds(initialSessionIds);
              console.log(`[Session Persistence] Loaded session IDs for ${initialSessionIds.size} agents`);
            }
          }

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

          // Load any existing AgentChats even if no terminals (optional UI grouping)
          const existingChats = await loadAgentChatsFromStorage();
          if (existingChats.length > 0) {
            setAgentChats(existingChats);

            // 🦆 STAMINA PRESERVATION: Initialize chatTokensMap with saved token counts
            const initialTokensMap = new Map<string, {
              inputTokens: number;
              outputTokens: number;
              cacheCreationTokens: number;
              cacheReadTokens: number;
            }>();
            const initialSessionIds = new Map<string, string>();

            existingChats.forEach((agent) => {
              // Load tokens
              if (agent.inputTokens !== undefined || agent.outputTokens !== undefined) {
                initialTokensMap.set(agent.id, {
                  inputTokens: agent.inputTokens ?? 0,
                  outputTokens: agent.outputTokens ?? 0,
                  cacheCreationTokens: agent.cacheCreationTokens ?? 0,
                  cacheReadTokens: agent.cacheReadTokens ?? 0,
                });
              }

              // 🦆 SESSION PERSISTENCE: Load session IDs
              if (agent.sessionId) {
                initialSessionIds.set(agent.id, agent.sessionId);
              }
            });

            if (initialTokensMap.size > 0) {
              setChatTokensMap(initialTokensMap);
              console.log(`[Stamina Preservation] Loaded tokens for ${initialTokensMap.size} agents`);
            }

            if (initialSessionIds.size > 0) {
              setChatSessionIds(initialSessionIds);
              console.log(`[Session Persistence] Loaded session IDs for ${initialSessionIds.size} agents`);
            }
          }
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
  useEffect(() => {
    if (!tauriAvailable) {
      setBooting(false);
    }
  }, [tauriAvailable]);

  useEffect(() => {
    return () => {
      if (introReplayTimeoutRef.current) {
        clearTimeout(introReplayTimeoutRef.current);
        introReplayTimeoutRef.current = null;
      }
      if (introAudioRef.current) {
        introAudioRef.current.pause();
        introAudioRef.current.currentTime = 0;
        introAudioRef.current = null;
      }
    };
  }, []);

  // Intro audio disabled - can be re-enabled later when you decide what to use
  // useEffect(() => {
  //   if (!videoEnded && tauriAvailable) {
  //     const audio = new Audio(introAudio);
  //     audio.volume = 0.5;
  //     audio.play().catch((error) => {
  //       console.warn("Unable to play intro audio:", error);
  //     });

  //     return () => {
  //       audio.pause();
  //       audio.currentTime = 0;
  //     };
  //   }
  // }, [videoEnded, tauriAvailable, introAudio]);

  // Clean background during video splash to avoid flash
  useEffect(() => {
    if (!videoEnded) {
      // Remove background image during splash for clean black screen
      document.body.style.backgroundImage = 'none';
    }
  }, [videoEnded]);

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
    setNewTerminalAvatar(terminal.avatar || "68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg");
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
    setNewTerminalAvatar(activeTerminal.avatar || "68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg");
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

  const handleResetTerminal = useCallback((terminal: TerminalInfo) => {
    // Clear chat session for this terminal
    setChatSessions((prev) => {
      const newMap = new Map(prev);
      newMap.delete(terminal.id);
      return newMap;
    });

    // Get session ID for this terminal to remove usage data
    setChatSessionIds((prev) => {
      const sessionId = prev.get(terminal.id);

      // Remove usage sessions for this session ID
      if (sessionId) {
        setUsageSessions((prevSessions) =>
          prevSessions.filter(s => s.session_id !== sessionId)
        );
      }

      // Remove session ID mapping
      const newMap = new Map(prev);
      newMap.delete(terminal.id);
      return newMap;
    });

    // Reset token tracking for this agent (stamina back to 100%)
    setChatTokensMap((prev) => {
      const newMap = new Map(prev);
      newMap.delete(terminal.id);
      return newMap;
    });

    toast.success(`Agent reset: ${terminal.label} - Stamina restored to 100%! 🦆`);
  }, []);

  const handleReorderTerminals = useCallback((reorderedIds: string[]) => {
    setTerminals((prev) => {
      // Crea una mappa per accesso rapido
      const terminalMap = new Map(prev.map((t) => [t.id, t]));
      // Riordina secondo l'array di IDs
      return reorderedIds.map((id) => terminalMap.get(id)).filter(Boolean) as TerminalInfo[];
    });
  }, []);

  const handleOpenNewTerminalModal = useCallback(() => {
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
    setNewTerminalAvatar("68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg"); // Reset to first avatar
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
    const fallbackPath = activeTerminal?.cwd ?? explorerPath ?? "";
    setNewTerminalPath(fallbackPath);
    setShowNewTerminalModal(true);
  }, [activeTerminal, explorerPath, tauriAvailable, terminals.length]);

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
      if (editingTerminal) {
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
              // Legacy fields (kept for backwards compatibility)
              intro: agentPersonality.intro || '',
              personality: agentPersonality.personality || '',
              quirks: agentPersonality.quirks || '',
              specialties: agentPersonality.specialties || [],
              skills: agentPersonality.skills || [],
              expressions: agentPersonality.expressions || [],
            };

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
    tauriAvailable,
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
      clearIdleTimer,
      clearTerminalAttention,
      loadDirectory,
      tauriAvailable,
      terminals,
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


  // ============================================
  // AgentChat Management Handlers (Phase 1)
  // ============================================

  // NO AgentChat handlers needed - terminals are independent!

  // Handler to create a new agent terminal tab
  const handleCreateAgentTerminal = useCallback(async () => {
    if (!tauriAvailable || !activeId) {
      return;
    }

    try {
      // Get current agent info from terminals (legacy)
      const currentAgent = terminals.find(t => t.id === activeId);
      const terminalCwd = currentAgent?.cwd || explorerPath || process.env.HOME || "~";

      // Generate unique terminal name PER-AGENT
      const agentTerminalCount = agentTerminals.filter(t => t.agentId === activeId).length;
      const terminalNumber = agentTerminalCount + 1;
      const terminalName = `Terminal ${terminalNumber}`;

      // Create backend terminal (PTY)
      const created = await invoke<TerminalInfo>("create_terminal", {
        label: terminalName,
        color: currentAgent?.color || TERMINAL_COLORS[0],
        cwd: terminalCwd,
      });

      // Create AgentTerminal entry (NEW STATE - not in terminals!)
      const newAgentTerminal: AgentTerminal = {
        id: created.id,
        name: terminalName,
        agentId: activeId, // Associate with active agent
        color: currentAgent?.color || TERMINAL_COLORS[0],
        cwd: terminalCwd,
        alive: true,
        status: "idle",
        createdAt: Date.now(),
      };

      setAgentTerminals((prev) => [...prev, newAgentTerminal]);

      // Create agent terminal tab
      const agentTerminalTab: Tab = {
        id: `agent-terminal-${created.id}`,
        label: terminalName,
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

      console.log(`✅ Created agent terminal tab: ${terminalName}`);
    } catch (error) {
      console.error("Failed to create agent terminal:", error);
      toast.error("Failed to create terminal");
    }
  }, [tauriAvailable, activeId, terminals, explorerPath, agentTerminals]);

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
      setPreviewLineChanges(lineChanges || null);
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
    [tauriAvailable, gitSummary, explorerRoot, activeId]
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
      const { disposeAgentTerminalTab } = await import('./components/AgentTerminalTab');
      disposeAgentTerminalTab(tab.terminalId);

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
  }, [activeTabId, activeId, tabs, handleTabClick]);

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

    setTabs([chatTab, ...terminalTabs]);

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
          agentId: activeId, // Associate with active agent
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
      const terminalName = `Resumed: ${sessionDetails.title.substring(0, 40)}${sessionDetails.title.length > 40 ? '...' : ''}`;

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

  if (!videoEnded || splashFadingOut) {
    return (
      <div className="app-loader" style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#000',
        zIndex: 9999,
        opacity: splashFadingOut ? 0 : 1,
        transition: 'opacity 0.8s ease-out',
        pointerEvents: splashFadingOut ? 'none' : 'auto',
      }}>
        {/* Video background */}
        <video
          autoPlay
          muted
          playsInline
          onEnded={() => {
            // When video ends, mark it as ended and start fade out
            setVideoEnded(true);
            setSplashFadingOut(true);
            // After fade animation completes, hide splash completely
            setTimeout(() => {
              setBooting(false);
              setSplashFadingOut(false);
              if (!hasBootstrapped) {
                setHasBootstrapped(true);
              }
            }, 800); // Match transition duration
          }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        >
          <source src="/video/introquack.mp4" type="video/mp4" />
        </video>

        {/* Dark overlay (30% opacity) */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.3)',
          zIndex: 1,
        }} />

        {/* "QUACK" text with colorful glow and fade-in animation */}
        <h1 style={{
          position: 'relative',
          zIndex: 2,
          fontSize: '120px',
          fontWeight: '900',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
          color: '#fff',
          margin: 0,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          textShadow: `
            0 0 20px rgba(242, 140, 82, 0.8),
            0 0 40px rgba(242, 140, 82, 0.6),
            0 0 60px rgba(77, 212, 179, 0.5),
            0 0 80px rgba(77, 212, 179, 0.3)
          `,
          animation: 'quackFadeIn 1s ease-out forwards',
        }}>
          QUACK
        </h1>

        {/* Fade-in animation keyframes */}
        <style>{`
          @keyframes quackFadeIn {
            from {
              opacity: 0;
              transform: scale(0.9);
            }
            to {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <>
      <TitleBar />

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
        className={`app-shell ${sidePanelCollapsed || !activeId ? 'side-panel-collapsed' : ''} ${terminals.length === 0 ? 'no-agents' : ''}`}
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
          onDeleteAgentChat={(chatId) => {
            setAgentChats(prev => prev.filter(chat => chat.id !== chatId));
            if (activeAgentChatId === chatId) {
              setActiveAgentChatId(null);
            }
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
          // Quack sound props
          onToggleQuackSound={toggleQuackSound}
          quackSoundEnabled={quackSoundEnabled}
          // Chat sessions
          chatSessions={chatSessions}
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
          onOpenGitPanel={() => setShowGitDrawer(true)}
          gitRefreshTrigger={gitRefreshTrigger}
        />

        {/* Terminal pane - show video background when no terminals, otherwise show chat */}
        <section className="terminal-pane">
          {terminals.length === 0 ? (
            /* Image background when no agents */
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
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
                  await handleCreateTerminalWithCommand("Claude Plan Usage", "claude /usage", cwd);
                } catch (error) {
                  console.error("Failed to open claude usage:", error);
                }
              }}
              onTelegramClick={() => setShowTelegramSetup(true)}
              onTerminalClick={handleCreateAgentTerminal}
              onBrowserClick={handleOpenBrowserTab}
              onToggleSidePanel={() => setSidePanelCollapsed(!sidePanelCollapsed)}
              sidePanelCollapsed={sidePanelCollapsed}
            />

            {/* Tab Bar - VSCode style */}
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId}
              onTabClick={handleTabClick}
              onTabClose={handleTabClose}
              onTabReorder={handleTabReorder}
            />

            {/* Content Area - fills remaining space */}
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              {/* Chat View - shown when chat tab is active */}
              {activeTabId === 'chat' && (
                <ChatView
              key={activeId ?? 'no-agent'}
              messages={currentAgentMessages}
              isLoading={currentAgentLoading}
              onSendMessage={sendMessageForAgent}
              activeAgent={activeAgent}
              onClearAgent={handleClearAgent}
              agents={agents}
              onSelectAgent={handleUseAgent}
              onFilePathClick={handleFilePathClick}
              pendingAgentMention={pendingAgentMention}
              onMentionInserted={() => setPendingAgentMention(null)}
              pendingFileMention={pendingFileMention}
              onFileMentionInserted={() => setPendingFileMention(null)}
              pendingSlashCommand={pendingSlashCommand}
              onCommandInserted={() => setPendingSlashCommand(null)}
              basePath={explorerRoot ?? explorerPath}
              // Agent Chat Settings - persistent per-agent state
              inputDraft={currentSettings.inputDraft}
              onInputDraftChange={(draft) => updateAgentSettings({ inputDraft: draft })}
              model={currentSettings.model as 'opus' | 'sonnet' | 'haiku'}
              onModelChange={(model) => updateAgentSettings({ model })}
              thinkingMode={currentSettings.thinkingMode as 'auto' | 'think' | 'hard' | 'harder' | 'ultra'}
              onThinkingModeChange={(thinkingMode) => updateAgentSettings({ thinkingMode })}
              permissionMode={currentSettings.permissionMode as 'plan' | 'bypass'}
              onPermissionModeChange={(permissionMode) => updateAgentSettings({ permissionMode })}
              // Streaming control
              onAbortStream={abortStreamForAgent}
              lastPrompt={getLastPromptForAgent()}
              // Conversation management
              onClearConversation={clearCurrentAgentConversation}
              onCompactConversation={compactCurrentAgentConversation}
              onOpenSessionInTerminal={openSessionInTerminal}
              // Token usage tracking
              sessionTokens={currentAgentTokens}
              // OpenAI API key for Whisper
              openaiApiKey={openaiApiKey ?? undefined}
              // Open Prompt Engineer
              onOpenPromptEngineer={handleOpenPromptEngineer}
              // Agent display info
              agentName={activeTerminal?.label || 'Jack'}
              agentAvatar={activeTerminal?.avatar}
              // Project context
              projectName={projectName}
              gitBranch={gitBranch}
              // Working on field
              workingOn={activeTerminal?.workingOn}
              onWorkingOnChange={(value) => {
                // CRITICAL FIX: Don't update if modal is open for editing to prevent infinite loop
                if (!showNewTerminalModal && !editingTerminal && activeTerminal) {
                  handleUpdateWorkingOn(activeTerminal.id, value);
                }
              }}
            />
              )}

              {/* File Preview - shown when file tab is active */}
              {activeTabId.startsWith('file-') && (
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

              {/* Agent Viewer - shown when agent tab is active */}
              {activeTabId.startsWith('agent-') && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'agent' && activeTab.agentName && activeTab.agentScope) {
                  return (
                    <AgentViewer
                      agentName={activeTab.agentName}
                      agentScope={activeTab.agentScope}
                      workingDir={activeTerminal?.cwd ?? explorerPath ?? undefined}
                      onRefresh={loadAgents}
                    />
                  );
                }
                return null;
              })()}

              {/* Browser Manager - shown when browser tab is active */}
              {activeTabId.startsWith('browser-manager-') && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'browser') {
                  return <BrowserManager />;
                }
                return null;
              })()}

              {/* Skill Viewer - shown when skill tab is active */}
              {activeTabId.startsWith('skill-') && (() => {
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

              {/* Command Viewer - shown when command tab is active */}
              {activeTabId.startsWith('command-') && (() => {
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (activeTab?.type === 'command' && activeTab.command) {
                  return (
                    <CommandViewer
                      command={activeTab.command}
                      onUseCommand={handleUseCommand}
                    />
                  );
                }
                return null;
              })()}

              {/* Agent Terminal Tabs - render ALL terminals, show/hide with visibility */}
              {tabs.some(t => t.type === 'agent-terminal') && (
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
                        <AgentTerminalTab
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
          // Commands props
          onUseCommand={handleUseCommand}
          onViewCommand={handleViewCommand}
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
          projectName={projectName}
          gitBranch={gitBranch}
          agentRefreshKey={agentRefreshKey}
          onEditAgent={handleEditAgentFromContext}
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
          // Collapse props
          isCollapsed={sidePanelCollapsed}
          onToggleCollapse={() => setSidePanelCollapsed(!sidePanelCollapsed)}
        />

        <NewTerminalModal
          open={showNewTerminalModal}
          isEditing={editingTerminal !== null}
          initialStep={editingTerminal !== null ? 'agent' : 'context'}
          initialAgentMode={editingTerminal !== null ? 'create' : 'select'}
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
          onNameChange={setNewTerminalName}
          onColorChange={setNewTerminalColor}
          onWorkingOnChange={setNewTerminalWorkingOn}
          onAvatarChange={setNewTerminalAvatar}
          onPersonalityChange={handlePersonalityChange}
          onBranchChange={setNewTerminalBranch}
          onUseWorktreeChange={setNewTerminalUseWorktree}
          onBrowse={handleSelectDirectory}
          onCancel={handleCancelNewTerminal}
          onConfirm={handleConfirmNewTerminal}
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
          </div>
        </div>

        {/* Diff Drawer - Opened when clicking a file */}
        {showDiffDrawer && selectedGitEntry && (
          <DiffDrawer
            selected={selectedGitEntry}
            diffContent={diffContent}
            diffLoading={diffLoading}
            diffError={diffError}
            diffView={diffView}
            onDiffViewChange={handleDiffViewChange}
            onStage={handleStageEntry}
            onUnstage={handleUnstageEntry}
            onClose={() => setShowDiffDrawer(false)}
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
      </div>

      {introReplayActive && (
        <div
          className="intro-replay-overlay"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#000',
            zIndex: 9999,
          }}
        >
          {/* Video background */}
          <video
            autoPlay
            muted
            playsInline
            loop
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
            }}
          >
            <source src="/video/introquack.mp4" type="video/mp4" />
          </video>

          {/* Dark overlay (30% opacity) */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 1,
          }} />

          {/* "QUACK" text with colorful glow and fade-in animation */}
          <h1 style={{
            position: 'relative',
            zIndex: 2,
            fontSize: '120px',
            fontWeight: '900',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
            color: '#fff',
            margin: 0,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            textShadow: `
              0 0 20px rgba(242, 140, 82, 0.8),
              0 0 40px rgba(242, 140, 82, 0.6),
              0 0 60px rgba(77, 212, 179, 0.5),
              0 0 80px rgba(77, 212, 179, 0.3)
            `,
            animation: 'quackFadeIn 1s ease-out forwards',
          }}>
            QUACK
          </h1>

          {/* Fade-in animation keyframes */}
          <style>{`
            @keyframes quackFadeIn {
              from {
                opacity: 0;
                transform: scale(0.9);
              }
              to {
                opacity: 1;
                transform: scale(1);
              }
            }
          `}</style>
        </div>
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

      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}

export default App;
