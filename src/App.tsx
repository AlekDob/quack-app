import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
import PluginsPanel from "./components/PluginsPanel";
import SavedCommandsDrawer from "./components/SavedCommandsDrawer";
import SavedCommandModal from "./components/SavedCommandModal";
import { SessionDetailsDrawer } from "./components/SessionDetailsDrawer";
// import { NativeTerminalPanel } from "./components/NativeTerminalPanel"; // Unused - commented out
import { AddTerminalWindowModal } from "./components/AddTerminalWindowModal";
import { TitleBar } from "./components/TitleBar";
import PreviewDrawer from "./components/PreviewDrawer";
import UnifiedSettings from "./components/settings/UnifiedSettings";
import PerformanceMonitor from "./components/PerformanceMonitor";
import AIAssistant from "./components/AIAssistant";
import QuackAgencyDrawer from "./components/QuackAgencyDrawer";
import ContextDrawer from "./components/ContextDrawer";
import SkillDrawer from "./components/SkillDrawer";
import BackgroundsModal from "./components/BackgroundsModal";
import TelegramSetup from "./components/TelegramSetup";
import ChatView from "./components/ChatView";
import TabBar, { type Tab } from "./components/TabBar";
import ActionIcons from "./components/ActionIcons";
import { AgentTerminalTab } from "./components/AgentTerminalTab";
import { TerminalIcon } from "./components/TerminalIcon";
import AgentViewer from "./components/AgentViewer";
import BrowserManager from "./components/BrowserManager";
import type { DiffInfo } from "./components/CodeEditor";
import { parseDiff } from "./lib/diffParser";
import type { ChatSendOptions } from "./hooks/useClaudeChat";
import { useDeepLinkHandler } from "./hooks/useDeepLinkHandler";
import { usePipWindow } from "./hooks/usePipWindow";
// import { useTelegramBot } from "./hooks/useTelegramBot"; // DEPRECATED - using Telegram Central Bot now

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
} from "./types";
import { getAgentAvatar } from "./utils/agentAvatars";

interface TerminalMetadata {
  label: string;
  color: string;
  cwd: string;
  workingOn?: string;
  avatar?: string;
  branch?: string;
}

import "./App.css";
import "./components/MetroStyle.css";

const INTRO_REPLAY_DURATION_MS = 5000;

const COLORS = [
  "#f28c52",
  "#ffb26f",
  "#ffd166",
  "#f77aa6",
  "#4dd4b3",
  "#8fa6ff",
  "#f2a57b",
];

// Notification settings
const NOTIFY_ACTIVE_TERMINAL = true; // Send notifications even for active terminal

// eslint-disable-next-line no-control-regex
const ANSI_REGEX = new RegExp("\\x1B\\[[0-9;?]*[ -/]*[@-~]", "g");
// eslint-disable-next-line no-control-regex
const OSC_REGEX = new RegExp("\\x1B\\][^\\x07]*\\x07", "g");
const PROMPT_REGEX = /(?:[$#%>|❯])\s*$/;

const normalizeKey = (value: string): string => value.trim().toLowerCase();
const slugify = (value: string): string =>
  normalizeKey(value).replace(/[^a-z0-9]+/g, "-");

const stripAnsi = (text: string): string =>
  text.replace(OSC_REGEX, "").replace(ANSI_REGEX, "");

const chunkContainsPrompt = (text: string): boolean => {
  const sanitized = stripAnsi(text).replace(/\r/g, "\n");
  const lines = sanitized
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length === 0) {
    return false;
  }
  return PROMPT_REGEX.test(lines[lines.length - 1]);
};

// Debounce utility for auto-save
function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };

  return debounced as T & { cancel: () => void };
}

const STORAGE_KEY = "terminals";

const saveTerminalsToStorage = async (terminals: TerminalInfo[]) => {
  try {
    const store = await Store.load("quack-terminals.json");
    // SIMPLE: Save terminal metadata only
    const metadata = terminals.map((t) => ({
      label: t.label,
      color: t.color,
      cwd: t.cwd,
      workingOn: t.workingOn,
      avatar: t.avatar,
      branch: t.branch,
    }));
    await store.set(STORAGE_KEY, metadata);
    await store.save();
    console.log(`Saved ${metadata.length} terminals`);
  } catch (error) {
    console.warn("Unable to save terminals", error);
  }
};

const loadTerminalsFromStorage = async (): Promise<TerminalMetadata[]> => {
  try {
    const store = await Store.load("quack-terminals.json");
    const stored = await store.get<TerminalMetadata[]>(STORAGE_KEY);
    return stored ?? [];
  } catch (error) {
    console.warn("Unable to load saved terminals", error);
    return [];
  }
};

// ============================================
// Tabs per Terminal Storage Functions
// ============================================

const TABS_BY_TERMINAL_KEY = "tabsByTerminal";

const saveTabsByTerminalToStorage = async (tabsByTerminal: Map<string, Tab[]>) => {
  try {
    const store = await Store.load("quack-terminals.json");
    // Convert Map to plain object for storage
    const obj: Record<string, Tab[]> = {};
    tabsByTerminal.forEach((tabs, terminalId) => {
      obj[terminalId] = tabs;
    });
    await store.set(TABS_BY_TERMINAL_KEY, obj);
    await store.save();
    console.log(`Saved tabs for ${Object.keys(obj).length} terminals`);
  } catch (error) {
    console.error("Failed to save tabs by terminal:", error);
  }
};

const loadTabsByTerminalFromStorage = async (): Promise<Map<string, Tab[]>> => {
  try {
    const store = await Store.load("quack-terminals.json");
    const stored = await store.get<Record<string, Tab[]>>(TABS_BY_TERMINAL_KEY);

    if (stored) {
      // Convert plain object back to Map
      const map = new Map<string, Tab[]>();
      Object.entries(stored).forEach(([terminalId, tabs]) => {
        map.set(terminalId, tabs);
      });
      console.log(`Loaded tabs for ${map.size} terminals from storage`);
      return map;
    }
    return new Map();
  } catch (error) {
    console.warn("Unable to load saved tabs by terminal", error);
    return new Map();
  }
};

// ============================================
// Native Terminal Storage Functions
// ============================================
const NATIVE_TERMINALS_STORAGE_KEY = "nativeTerminals";

const saveNativeTerminalsToStorage = async (terminals: NativeTerminal[]) => {
  try {
    const store = await Store.load("quack-terminals.json");
    // Mark all as closed on save (they might not be running when app restarts)
    const metadata = terminals.map((t) => ({
      ...t,
      isOpen: false,
      pid: undefined,
    }));
    await store.set(NATIVE_TERMINALS_STORAGE_KEY, metadata);
    await store.save();
    console.log(`Saved ${metadata.length} native terminals`);
  } catch (error) {
    console.warn("Unable to save native terminals", error);
  }
};

const loadNativeTerminalsFromStorage = async (): Promise<NativeTerminal[]> => {
  try {
    const store = await Store.load("quack-terminals.json");
    const stored = await store.get<NativeTerminal[]>(NATIVE_TERMINALS_STORAGE_KEY);
    return stored ?? [];
  } catch (error) {
    console.warn("Unable to load saved native terminals", error);
    return [];
  }
};

// ============================================
// AgentChat Storage Functions (Phase 1)
// ============================================

const AGENT_CHATS_KEY = "agentChats";
// No migration keys needed anymore!

const saveAgentChatsToStorage = async (chats: AgentChat[]): Promise<void> => {
  try {
    const store = await Store.load("quack-agent-chats.json");
    await store.set(AGENT_CHATS_KEY, chats);
    await store.save();
    console.log(`Saved ${chats.length} AgentChats to storage`);
  } catch (error) {
    console.error("Failed to save AgentChats:", error);
    toast.error("Failed to save workspace configuration");
  }
};

const loadAgentChatsFromStorage = async (): Promise<AgentChat[]> => {
  try {
    const store = await Store.load("quack-agent-chats.json");
    const stored = await store.get<AgentChat[]>(AGENT_CHATS_KEY);
    if (stored) {
      console.log(`Loaded ${stored.length} AgentChats from storage`);
      return stored;
    }
    return [];
  } catch (error) {
    console.warn("Unable to load AgentChats:", error);
    return [];
  }
};

// NO storage for activeAgentChat - not needed!

// ============================================
// Random Agent Names
// ============================================
const AGENT_NAMES = [
  'Agent Jack',
  'Agent Mike',
  'Agent Julie',
  'Agent John',
  'Agent Scott',
  'Agent Carmelo',
  'Agent Giuseppe',
  'Agent Roberta',
  'Agent Charlie',
  'Agent Alex',
  'Agent Sam',
  'Agent Jordan',
  'Agent Taylor',
  'Agent Morgan',
  'Agent Casey',
  'Agent Riley',
  'Agent Quinn',
  'Agent Avery',
  'Agent Parker',
  'Agent Skylar',
];

const getRandomAgentName = () => {
  return AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
};

// ============================================
// Migration System (Phase 2)
// ============================================
// NO migration needed! Terminals are independent entities, grouped only by cwd in the UI

function App() {
  // Load assets INSIDE the component, not at module level
  const splashImage = new URL("../images/quack-visual-ide.jpeg", import.meta.url).href;
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
  const [newTerminalColor, setNewTerminalColor] = useState(COLORS[0]);
  const [newTerminalWorkingOn, setNewTerminalWorkingOn] = useState("");
  const [newTerminalAvatar, setNewTerminalAvatar] = useState("68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg");
  const [newTerminalBranch, setNewTerminalBranch] = useState("");
  const [newTerminalUseWorktree, setNewTerminalUseWorktree] = useState(false);
  const [newTerminalPersonality, setNewTerminalPersonality] = useState<Partial<AgentPersonality>>({
    role: 'Feature Coordinator',
    intro: 'Experienced PM specializing in feature delivery and team coordination',
    communicationStyle: 'friendly',
    specialties: ['feature-planning', 'team-alignment'],
    personality: 'Organized. Proactive',
    skills: [],
    expressions: [],
  });
  const [newTerminalError, setNewTerminalError] = useState<string | null>(null);
  const [selectingDirectory, setSelectingDirectory] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);
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
  const [previewHasUnsavedChanges, setPreviewHasUnsavedChanges] = useState(false);
  const previewDrawerRef = useRef<FilePreviewDrawerRef>(null);
  const [showGitDrawer, setShowGitDrawer] = useState(false);
  const [showDiffDrawer, setShowDiffDrawer] = useState(false);
  const [showPluginsDrawer, setShowPluginsDrawer] = useState(false);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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

  const [previewDrawerWidth, setPreviewDrawerWidth] = useState(() => {
    if (typeof window === "undefined") {
      return 960;
    }
    const stored = window.localStorage.getItem("previewDrawer.width");
    const value = stored ? Number.parseInt(stored, 10) : NaN;
    if (Number.isFinite(value)) {
      return Math.min(1200, Math.max(420, value));
    }
    return Math.min(window.innerWidth * 0.7, 960);
  });
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
  const [currentBackground, setCurrentBackground] = useState("duck.png");

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
      console.log(`🦆 [Tab Management] Saving tabs for agent: ${previousId}`, tabs);
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
      console.log(`🦆 [Tab Management] Restoring tabs for agent: ${activeId}`, restoredTabs);

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
        color: COLORS[agentChats.length % COLORS.length],
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

    console.log('[Multi-Listener] Setting up listeners for agents:', activeAgentIds);

    // Setup listener for each active agent
    const setupPromises = activeAgentIds.map(async (agentId) => {
      const eventName = `claude-event:${agentId}`;

      try {
        const unlisten = await listen<ClaudeEvent>(eventName, (event) => {
          const claudeEvent = event.payload;

          console.log(`[Multi-Listener] Event received for agent ${agentId}:`, claudeEvent.type);

          // Update chat session with incoming events
          setChatSessions((prev) => {
            const newSessions = new Map(prev);
            const agentMessages = newSessions.get(agentId) ?? [];
            const lastMsg = agentMessages[agentMessages.length - 1];

            if (lastMsg && lastMsg.role === 'assistant' && lastMsg.status === 'streaming') {
              const updatedMessages = [...agentMessages];
              updatedMessages[updatedMessages.length - 1] = {
                ...lastMsg,
                events: [...(lastMsg.events || []), claudeEvent],
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
        content: `🦆 Invocando agente: **${activeAgent.name}**`,
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
      timestamp: Date.now(),
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
        color: currentAgent?.color || COLORS[0],
        cwd: terminalCwd,
      });

      // Create AgentTerminal entry (associated with active agent)
      const newAgentTerminal: AgentTerminal = {
        id: created.id,
        name: terminalLabel,
        agentId: activeId, // Associate with active agent
        color: currentAgent?.color || COLORS[0],
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
        color: currentAgent?.color || COLORS[0],
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

  // Performance: Stabilizza modifiedEntries reference per evitare re-render FileExplorer
  const stableModifiedEntries = useMemo(() => {
    if (!gitSummary?.entries) return null;
    // Memoizza basandosi su length + primi path per shallow equality check
    return gitSummary.entries;
  }, [
    gitSummary?.entries?.length,
    gitSummary?.entries?.[0]?.path,
    gitSummary?.entries?.[gitSummary.entries.length - 1]?.path
  ]);

  const gridTemplateColumns = "360px minmax(0, 1fr) 420px";

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
      return existing;
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
    if (typeof window === "undefined") {
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
  }, [notificationAudio]);

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

  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }

    if (terminals.length > 0) {
      void saveTerminalsToStorage(terminals);
    } else {
      // If no terminals, clean up storage
      void (async () => {
        try {
          const store = await Store.load("quack-terminals.json");
          await store.delete(STORAGE_KEY);
          await store.save();
        } catch {
          // Ignore errors
        }
      })();
    }
  }, [hasBootstrapped, tauriAvailable, terminals]);

  // Auto-save tabs by terminal to storage
  useEffect(() => {
    if (!tauriAvailable || !hasBootstrapped) {
      return;
    }

    if (tabsByTerminal.size > 0) {
      void saveTabsByTerminalToStorage(tabsByTerminal);
    } else {
      // If no tabs, clean up storage
      void (async () => {
        try {
          const store = await Store.load("quack-terminals.json");
          await store.delete(TABS_BY_TERMINAL_KEY);
          await store.save();
        } catch {
          // Ignore errors
        }
      })();
    }
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
          const store = await Store.load("quack-terminals.json");
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
            src={agentInfo.avatar ? `/images/ducks/avatars/${agentInfo.avatar}` : '/duckdroid.png'}
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

      // Check if skills directory exists
      const dirExists = await invoke<boolean>("check_skills_directory", {
        workingDir,
      });
      setSkillsDirectoryExists(dirExists);

      if (!dirExists) {
        setSkills([]);
        setSkillsError(null); // Clear error if directory just doesn't exist
        return;
      }

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
      // Open the skill drawer with selected skill
      setSelectedSkill(skillInfo);
      setShowSkillDrawer(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(`Failed to load skill: ${message}`);
    }
  }, [tauriAvailable]);

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

  const handleClearAgent = useCallback(() => {
    setActiveAgent(null);
    toast.info('Agent deactivated', {
      description: 'Chat will use default model settings',
      duration: 2000,
    });
  }, []);


  // Load Quack Agency agents on startup
  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }
    void loadAgents();
  }, [loadAgents, tauriAvailable]);

  // Load Skills on startup
  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }
    void loadSkills();
  }, [loadSkills, tauriAvailable]);

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

  // Load saved background on mount
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
        // Try to load saved terminals
        const savedMetadata = await loadTerminalsFromStorage();

        if (savedMetadata.length > 0) {
          console.log(`Found ${savedMetadata.length} saved terminals`);

          // Recreate terminals from saved metadata
          const recreated: TerminalInfo[] = [];
          for (const metadata of savedMetadata) {
            try {
              const terminal = await invoke<TerminalInfo>("create_terminal", {
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
              };

              recreated.push(terminalWithState);
              console.log(`Recreated terminal: ${terminal.label}`, {
                workingOn: metadata.workingOn,
                avatar: metadata.avatar,
                branch: metadata.branch,
              });
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

    // Try to load existing personality
    try {
      const personality = await invoke<AgentPersonality>('load_agent_personality', {
        projectPath: terminal.cwd,
        personalityId: terminal.id,
      });
      setNewTerminalPersonality(personality);
      console.log('✅ Loaded existing personality for:', terminal.label);
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

    setShowNewTerminalModal(true);
  }, []);

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

      // Create new terminal with same color and cwd
      const created = await invoke<TerminalInfo>("create_terminal", {
        label: newName,
        color: terminal.color,
        cwd: terminal.cwd,
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
      toast.success(`Agent duplicated: ${newName}`);
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

    toast.success(`Agent reset: ${terminal.label}`);
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
    setEditingTerminal(null);
    setNewTerminalError(null);
    const index = terminals.length;
    const defaultColor = COLORS[index % COLORS.length];
    setNewTerminalName(getRandomAgentName()); // Random agent name instead of "Terminal X"
    setNewTerminalColor(defaultColor);
    setNewTerminalWorkingOn(""); // Reset working on field
    setNewTerminalAvatar("68b54025bcf1dfbc9e03e20882688ddcadd28c27.jpeg"); // Reset to first avatar
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

  const handleConfirmNewTerminal = useCallback(async () => {
    if (!tauriAvailable || creatingTerminal) {
      return;
    }

    const trimmedName = newTerminalName.trim();
    const trimmedPath = newTerminalPath.trim();
    const trimmedWorkingOn = newTerminalWorkingOn.trim();

    if (!trimmedName) {
      setNewTerminalError("Enter a terminal name.");
      return;
    }

    if (!trimmedPath) {
      setNewTerminalError("Select working directory.");
      return;
    }

    // Validate word count for "Working on" (max 5 words)
    if (trimmedWorkingOn) {
      const wordCount = trimmedWorkingOn.split(/\s+/).length;
      if (wordCount > 5) {
        setNewTerminalError('Working on must be 5 words or less');
        return;
      }
    }

    setCreatingTerminal(true);
    setNewTerminalError(null);

    try {
      if (editingTerminal) {
        // Update existing terminal
        await invoke("update_terminal", {
          id: editingTerminal.id,
          label: trimmedName,
          color: newTerminalColor,
          cwd: trimmedPath,
          workingOn: trimmedWorkingOn || null,
          avatar: newTerminalAvatar,
          branch: newTerminalBranch || null,
        });

        setTerminals((prev) =>
          prev.map((t) =>
            t.id === editingTerminal.id
              ? {
                  ...t,
                  label: trimmedName,
                  color: newTerminalColor,
                  cwd: trimmedPath,
                  workingOn: trimmedWorkingOn || undefined,
                  avatar: newTerminalAvatar,
                  branch: newTerminalBranch || undefined,
                }
              : t
          )
        );

        // Save agent personality if configured
        if (newTerminalPersonality && Object.keys(newTerminalPersonality).length > 0) {
          try {
            const fullPersonality: AgentPersonality = {
              id: editingTerminal.id,
              name: trimmedName,
              role: newTerminalPersonality.role || '',
              personality: newTerminalPersonality.personality || '',
              quirks: newTerminalPersonality.quirks || '',
              communicationStyle: newTerminalPersonality.communicationStyle || 'friendly',
              specialties: newTerminalPersonality.specialties || [],
              skills: newTerminalPersonality.skills || [],
              expressions: newTerminalPersonality.expressions || [],
            };

            await invoke('save_agent_personality', {
              projectPath: trimmedPath,
              personality: fullPersonality,
            });

            // Inject personality into CLAUDE.md
            await invoke('inject_personality_to_claude_md', {
              projectPath: trimmedPath,
              personality: fullPersonality,
            });

            console.log(`✅ Updated personality for agent "${trimmedName}"`);
          } catch (error) {
            console.error('Failed to save personality:', error);
            // Don't block terminal update if personality save fails
          }
        }

        // If cwd changed and this is active terminal, reload directory
        if (
          trimmedPath !== editingTerminal.cwd &&
          editingTerminal.id === activeId
        ) {
          await loadDirectory(trimmedPath);
        }

        setShowNewTerminalModal(false);
        setEditingTerminal(null);
      } else {
        // Create new terminal - SIMPLE! No AgentChat logic
        console.log('Creating terminal with avatar:', newTerminalAvatar, 'branch:', newTerminalBranch);

        // Handle Git branch creation and worktree if specified
        let worktreePath: string | undefined;
        if (newTerminalBranch) {
          try {
            // Check if branch exists
            const branches = await invoke<Array<{name: string, isCurrent: boolean, hasRemote: boolean}>>('git_list_branches', {
              rootPath: trimmedPath
            });

            const branchExists = branches.some(b => b.name === newTerminalBranch);

            if (newTerminalUseWorktree && !branchExists) {
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
              // Branch exists, just switch to it (no worktree)
              console.log(`Switching to existing branch: ${newTerminalBranch}`);
              await invoke('git_switch_branch', {
                branchName: newTerminalBranch,
                rootPath: trimmedPath
              });
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
          color: newTerminalColor,
          cwd: effectivePath,
          workingOn: trimmedWorkingOn || null,
          avatar: newTerminalAvatar,
          branch: newTerminalBranch || null,
        });

        const createdWithState: TerminalInfo = {
          ...created,
          status: "idle",
          needsAttention: false,
          hasResponded: false,
          responseStartTime: null,
          workingOn: trimmedWorkingOn || undefined,
          avatar: newTerminalAvatar,
          branch: newTerminalBranch || undefined,
          useWorktree: newTerminalUseWorktree && !!worktreePath,
          worktreePath: worktreePath,
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
        if (newTerminalPersonality && Object.keys(newTerminalPersonality).length > 0) {
          try {
            const fullPersonality: AgentPersonality = {
              id: createdWithState.id,
              name: trimmedName,
              role: newTerminalPersonality.role || '',
              personality: newTerminalPersonality.personality || '',
              quirks: newTerminalPersonality.quirks || '',
              communicationStyle: newTerminalPersonality.communicationStyle || 'friendly',
              specialties: newTerminalPersonality.specialties || [],
              skills: newTerminalPersonality.skills || [],
              expressions: newTerminalPersonality.expressions || [],
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
      setNewTerminalError(message);
    } finally {
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

      // Pick random color from COLORS array
      const randomColor = COLORS[Math.floor(Math.random() * COLORS.length)];

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
          const personality = await invoke<AgentPersonality>('load_agent_personality', {
            projectPath: terminal.cwd,
            personalityId: terminal.id,
          });

          // Inject into CLAUDE.md
          await invoke('inject_personality_to_claude_md', {
            projectPath: terminal.cwd,
            personality,
          });

          console.log(`✅ Injected personality for "${terminal.label}" into CLAUDE.md`);
        } catch (error) {
          // No personality found or injection failed - not critical
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

  const handleOpenPreviewDrawer = useCallback(() => {
    setShowPreviewDrawer(true);
  }, []);

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
        color: currentAgent?.color || COLORS[0],
        cwd: terminalCwd,
      });

      // Create AgentTerminal entry (NEW STATE - not in terminals!)
      const newAgentTerminal: AgentTerminal = {
        id: created.id,
        name: terminalName,
        agentId: activeId, // Associate with active agent
        color: currentAgent?.color || COLORS[0],
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
        color: currentAgent?.color || COLORS[0],
        terminalId: created.id,
        icon: <TerminalIcon />,
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
    async (entry: DirectoryEntry) => {
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
      setLoadingPreview(true);

      try {
        // Check if file is an image
        const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'];
        const isImage = imageExtensions.some(ext => entry.name.toLowerCase().endsWith(ext));

        if (isImage) {
          // Load image as base64
          const base64Data = await invoke<string>("read_image_as_base64", {
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

            setPreviewDiffInfo(parseDiff(diff));
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

  const handleFilePathClick = useCallback((path: string) => {
    const name = path.split('/').pop() || path;
    // Create a fake DirectoryEntry to open the file
    const fakeEntry: DirectoryEntry = {
      name,
      path,
      is_dir: false,
      is_symlink: false,
    };
    // Use handleOpenFilePreview to actually load file content
    handleOpenFilePreview(fakeEntry);
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

    setTabs((prevTabs) => {
      const filtered = prevTabs.filter(t => t.id !== tabId);

      // If closing active tab, switch to previous tab or chat
      if (activeTabId === tabId) {
        const closedIndex = prevTabs.findIndex(t => t.id === tabId);
        const newActiveTab = filtered[Math.max(0, closedIndex - 1)];
        setActiveTabId(newActiveTab?.id || 'chat');
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
  }, [activeTabId, activeId, tabs]);

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
        const base64Data = await invoke<string>("read_image_as_base64", {
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
          color: currentAgent?.color || COLORS[0],
          cwd: terminalCwd,
        });

        // Create AgentTerminal entry (associated with active agent)
        const newAgentTerminal: AgentTerminal = {
          id: created.id,
          name: label,
          agentId: activeId, // Associate with active agent
          color: currentAgent?.color || COLORS[0],
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
          color: currentAgent?.color || COLORS[0],
          terminalId: created.id,
          icon: <TerminalIcon />,
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

  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }
    void refreshGitSummary();
  }, [refreshGitSummary, tauriAvailable]);

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

  const handleResumeSession = useCallback(async (_sessionId: string) => {
    try {
      // Resume the session in the current agent chat
      if (activeId) {
        // The session will be automatically resumed by passing sessionId to claudeSDK
        toast.success('Session will be resumed in next message');
        setSessionDetailsDrawerOpen(false);
        // TODO: Could add logic to load session history into chat view here
      } else {
        toast.error('Please select an agent first');
      }
    } catch (error) {
      console.error('Failed to resume session:', error);
      toast.error('Failed to resume session');
    }
  }, [activeId]);

  const handleDeleteSession = useCallback(async (sessionId: string) => {
    try {
      await invoke('delete_session', { sessionId });
      toast.success('Session deleted successfully');
      return Promise.resolve();
    } catch (error) {
      console.error('Failed to delete session:', error);
      toast.error('Failed to delete session');
      return Promise.reject(error);
    }
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
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
          }}
        >
          <source src="/video/introquack.mp4" type="video/mp4" />
        </video>
      </div>
    );
  }

  return (
    <>
      <TitleBar />
      <div
        ref={appShellRef}
        className="app-shell"
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
            /* Video background when no agents */
            <div
              style={{
                width: '100%',
                height: '100%',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <video
                autoPlay
                loop
                muted
                playsInline
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center',
                }}
              >
                <source src="/video/introquack.mp4" type="video/mp4" />
              </video>
            </div>
          ) : (
            /* Chat area when agents are active */
            <div className="terminal-container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
              {/* Action Icons - aligned right above tabs */}
              <ActionIcons
              onGitClick={() => setShowGitDrawer(!showGitDrawer)}
              onPluginsClick={() => setShowPluginsDrawer(!showPluginsDrawer)}
              onPreviewClick={handleOpenPreviewDrawer}
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
              model={currentSettings.model as 'opus' | 'sonnet' | 'haiku' | 'haiku-3.5'}
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
              agentAvatar={activeTerminal?.avatar ? getAgentAvatar(activeTerminal.label, activeTerminal.avatar) : undefined}
              // Project context
              projectName={projectName}
              gitBranch={gitBranch}
              // Working on field
              workingOn={activeTerminal?.workingOn}
              onWorkingOnChange={(value) => activeTerminal && handleUpdateWorkingOn(activeTerminal.id, value)}
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
                    disabled={loadingPreview}
                    formatting={formattingPreview}
                    hasUnsavedChanges={previewHasUnsavedChanges}
                    isImageFile={previewFile?.name ? ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.svg', '.ico', '.tiff', '.tif'].some(ext => previewFile.name!.toLowerCase().endsWith(ext)) : false}
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
          modifiedEntries={stableModifiedEntries}
          gitRootPath={explorerRoot}
          // Agents props
          agents={agents}
          selectedAgent={selectedAgent}
          loadingAgents={loadingAgents}
          agentsError={agentsError}
          agentsDirectoryExists={agentsDirectoryExists}
          workingDir={activeTerminal?.cwd ?? explorerPath}
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
          projectName={projectName}
          gitBranch={gitBranch}
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
          availableColors={COLORS}
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
          session={selectedSession}
          open={sessionDetailsDrawerOpen}
          onClose={() => setSessionDetailsDrawerOpen(false)}
          onResume={handleResumeSession}
          onDelete={handleDeleteSession}
        />

        <PreviewDrawer
          open={showPreviewDrawer}
          onClose={() => setShowPreviewDrawer(false)}
          width={previewDrawerWidth}
          minWidth={420}
          maxWidth={1200}
          onResize={(width) => {
            setPreviewDrawerWidth(width);
            if (typeof window !== "undefined") {
              window.localStorage.setItem("previewDrawer.width", String(Math.round(width)));
            }
          }}
          explorerPath={explorerPath}
          processes={[]} // TODO: Implement process tracking
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
            <PluginsPanel workingDir={explorerPath || undefined} />
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
            currentBackground={currentBackground}
            onSelectBackground={handleSelectBackground}
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
          style={{ backgroundImage: `url(${splashImage})` }}
        />
      )}

      <Toaster position="bottom-right" richColors closeButton />
    </>
  );
}

export default App;
