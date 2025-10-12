import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
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
import FilePreviewDrawer from "./components/FilePreviewDrawer";
import GitPanel from "./components/GitPanel";
import ToolBar from "./components/ToolBar";
import ProcessesDrawer from "./components/ProcessesDrawer";
import SavedCommandsDrawer from "./components/SavedCommandsDrawer";
import SavedCommandModal from "./components/SavedCommandModal";
import PreviewDrawer from "./components/PreviewDrawer";
import AISettingsPanel from "./components/AISettingsPanel";
import PerformanceMonitor from "./components/PerformanceMonitor";
import AIAssistant from "./components/AIAssistant";
import QuackAgencyDrawer from "./components/QuackAgencyDrawer";
import BackgroundsModal from "./components/BackgroundsModal";
import ChatView from "./components/ChatView";
import type { DiffInfo } from "./components/CodeEditor";
import { parseDiff } from "./lib/diffParser";
import type { ChatSendOptions } from "./hooks/useClaudeChat";

import type {
  DirectoryEntry,
  DirectoryListing,
  GitCommitEntry,
  GitStatusEntry,
  GitStatusSummary,
  TerminalExitEvent,
  TerminalInfo,
  SavedCommand,
  ProcessInfo,
  TerminalContext,
  AgentInfo,
  AgentDetails,
  ChatMessage,
} from "./types";

interface TerminalMetadata {
  label: string;
  color: string;
  cwd: string;
}

import "./App.css";

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

const STORAGE_KEY = "terminals";

const saveTerminalsToStorage = async (terminals: TerminalInfo[]) => {
  try {
    const store = await Store.load("quack-terminals.json");
    const metadata: TerminalMetadata[] = terminals.map((t) => ({
      label: t.label,
      color: t.color,
      cwd: t.cwd,
    }));
    await store.set(STORAGE_KEY, metadata);
    await store.save();
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

function App() {
  // Load assets INSIDE the component, not at module level
  const splashImage = new URL("../images/quack-agency.jpeg", import.meta.url).href;
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

  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [explorerPath, setExplorerPath] = useState("");
  const [explorerTree, setExplorerTree] = useState<
    Record<string, DirectoryEntry[]>
  >({});
  const [explorerRoot, setExplorerRoot] = useState<string | null>(null);
  const [loadingExplorer, setLoadingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [creatingTerminal, setCreatingTerminal] = useState(false);
  const [showNewTerminalModal, setShowNewTerminalModal] = useState(false);
  const [newTerminalName, setNewTerminalName] = useState("");
  const [newTerminalPath, setNewTerminalPath] = useState("");
  const [newTerminalColor, setNewTerminalColor] = useState(COLORS[0]);
  const [newTerminalError, setNewTerminalError] = useState<string | null>(null);
  const [selectingDirectory, setSelectingDirectory] = useState(false);
  const [notificationGranted, setNotificationGranted] = useState(false);
  const [booting, setBooting] = useState(true);
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    path: string;
  } | null>(null);
  const [previewContent, setPreviewContent] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [formattingPreview, setFormattingPreview] = useState(false);
  const [previewDiffInfo, setPreviewDiffInfo] = useState<DiffInfo | null>(null);
  const [showGitDrawer, setShowGitDrawer] = useState(false);
  const [showProcessesDrawer, setShowProcessesDrawer] = useState(false);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
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
  const [activeProcesses, setActiveProcesses] = useState<ProcessInfo[]>([]);
  const [savedCommandsDrawerOpen, setSavedCommandsDrawerOpen] = useState(false);
  const [savedCommandModalOpen, setSavedCommandModalOpen] = useState(false);
  const [editingCommand, setEditingCommand] = useState<SavedCommand | null>(
    null
  );
  const [showPerformanceMonitor, setShowPerformanceMonitor] = useState(false);
  const [showAIAssistant, setShowAIAssistant] = useState(false);
  const [aiIntent, setAiIntent] = useState('');
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

  // Multi-Chat state - one chat session per agent
  const [chatSessions, setChatSessions] = useState<Map<string, ChatMessage[]>>(new Map());
  const [chatLoadingMap, setChatLoadingMap] = useState<Map<string, boolean>>(new Map());
  const chatConversationHistoryRef = useRef<Map<string, Array<{ role: 'user' | 'assistant'; content: string }>>>(new Map());
  const [isChatConfigured, setIsChatConfigured] = useState(false);

  // Initialize chat on mount
  useEffect(() => {
    if (tauriAvailable) {
      const initialize = async () => {
        try {
          const available = await invoke<boolean>('check_claude_cli_available');
          setIsChatConfigured(available);
        } catch (err) {
          console.error('Failed to check Claude CLI:', err);
          setIsChatConfigured(false);
        }
      };
      void initialize();
    }
  }, [tauriAvailable]);

  // Send message for specific agent
  const sendMessageForAgent = useCallback(async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || !activeId) return;

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
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      newSessions.set(activeId, [...currentMessages, userMessage]);
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

      // Call Claude CLI
      const sanitizedAttachments = attachments
        .map((item) => item.path)
        .filter((path) => !!path);

      const requestPayload = {
        prompt,
        model: options?.model,
        thinkingMode: options?.thinkingMode,
        permissionMode: options?.permissionMode,
        attachments: sanitizedAttachments.length > 0 ? sanitizedAttachments : undefined,
      };

      interface ClaudeCliResponse {
        result: string;
        session_id: string;
        total_cost_usd: number;
        usage: {
          input_tokens: number;
          output_tokens: number;
          cache_read_input_tokens: number;
          cache_creation_input_tokens: number;
        };
      }

      const response = await invoke<ClaudeCliResponse>('send_message_via_cli', {
        request: requestPayload,
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

      // Update message with response
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
    } catch (err) {
      console.error('Error calling Claude CLI:', err);

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
    } finally {
      // Clear loading for this agent
      setChatLoadingMap((prev) => {
        const newMap = new Map(prev);
        newMap.set(activeId, false);
        return newMap;
      });
    }
  }, [activeId, isChatConfigured, chatSessions]);

  // Quack Agency state
  const [showQuackAgencyDrawer, setShowQuackAgencyDrawer] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentDetails | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentsDirectoryExists, setAgentsDirectoryExists] = useState<boolean>(true);

  const activeTerminal = useMemo(
    () => terminals.find((terminal) => terminal.id === activeId) ?? null,
    [activeId, terminals]
  );

  // Compute current agent's chat messages and loading state
  const currentAgentMessages = useMemo(() => {
    return activeId ? (chatSessions.get(activeId) ?? []) : [];
  }, [activeId, chatSessions]);

  const currentAgentLoading = useMemo(() => {
    return activeId ? (chatLoadingMap.get(activeId) ?? false) : false;
  }, [activeId, chatLoadingMap]);

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

  const loadActiveProcesses = useCallback(async () => {
    if (!tauriAvailable) {
      return;
    }

    try {
      const processes = await invoke<ProcessInfo[]>('get_active_processes');
      setActiveProcesses(processes);
    } catch (error) {
      console.error('Failed to load active processes:', error);
      setActiveProcesses([]);
    }
  }, [tauriAvailable]);

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

    // Listen for menu event to open AI Settings
    const unlistenAISettingsPromise = listen("open-ai-settings", () => {
      setShowAISettings(true);
    });

    const unlistenWatchIntroPromise = listen("watch-intro", () => {
      showIntroReplay();
    });

    // Listen for menu event to open Backgrounds modal
    const unlistenBackgroundsPromise = listen("open-backgrounds", () => {
      setShowBackgroundsModal(true);
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenAISettingsPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenWatchIntroPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenBackgroundsPromise.then(unlisten => unlisten()).catch(() => undefined);
    };
    // Performance: NON fare polling continuo dei processi - carica solo quando necessario
    // Il drawer ProcessesDrawer chiamerà loadActiveProcesses quando aperto
  }, [loadSavedCommands, showIntroReplay, tauriAvailable]);

  // Performance: Carica processi solo quando drawer è aperto (on-demand invece di polling)
  useEffect(() => {
    if (!tauriAvailable || !showProcessesDrawer) {
      return;
    }

    // Caricamento iniziale
    void loadActiveProcesses();

    // Polling solo quando drawer è aperto (ogni 5 secondi invece di 3)
    const interval = setInterval(() => {
      void loadActiveProcesses();
    }, 5000);

    return () => clearInterval(interval);
  }, [loadActiveProcesses, showProcessesDrawer, tauriAvailable]);

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
        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: payload.label,
          body: "Hey, you can do something here!",
        });
      } catch (error) {
        console.warn("Unable to show notification", error);
      }
    },
    [ensureNotificationPermission, notificationGranted, playQuackSound, tauriAvailable]
  );

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
          ? { ...terminal, status: "busy", needsAttention: false }
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
        if (terminal && terminal.status === 'idle') {
          const shouldNotify = NOTIFY_ACTIVE_TERMINAL || id !== activeId;
          if (shouldNotify) {
            void notifyTerminalReady({ id: terminal.id, label: terminal.label });
          }
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

    try {
      const workingDir = activeTerminal?.cwd ?? explorerPath ?? undefined;
      const details = await invoke<AgentDetails>("get_agent_details", {
        name: agentInfo.name,
        workingDir,
      });
      setSelectedAgent(details);
      setShowQuackAgencyDrawer(true); // Apre il drawer quando si seleziona un agent
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAgentsError(message);
    }
  }, [tauriAvailable, activeTerminal?.cwd, explorerPath]);

  // Load Quack Agency agents on startup
  useEffect(() => {
    if (!tauriAvailable) {
      return;
    }
    void loadAgents();
  }, [loadAgents, tauriAvailable]);

  // Helper to apply background (image or gradient)
  const applyBackground = useCallback((backgroundName: string) => {
    // Check if it's a gradient
    if (backgroundName.startsWith('gradient-')) {
      // Map gradient names to actual CSS gradients - MUCH more colorful!
      const gradientMap: Record<string, string> = {
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
          // Recreate terminals from saved metadata
          const recreated: TerminalInfo[] = [];
          for (const metadata of savedMetadata) {
            try {
              const terminal = await invoke<TerminalInfo>("create_terminal", {
                label: metadata.label,
                color: metadata.color,
                cwd: metadata.cwd,
              });
              recreated.push({
                ...terminal,
                status: "idle" as const,
                needsAttention: false,
              });
            } catch (error) {
              console.warn(
                `Unable to recreate terminal ${metadata.label}`,
                error
              );
            }
          }

          if (recreated.length > 0) {
            setTerminals(recreated);
            setActiveId(recreated[0].id);
            await loadDirectory(recreated[0].cwd);
          } else {
            // Fallback: create a default terminal
            const initial = await invoke<TerminalInfo>("create_terminal", {
              label: "Terminal 1",
              color: COLORS[0],
              cwd: null,
            });
            const initialWithState = {
              ...initial,
              status: "idle" as const,
              needsAttention: false,
            };
            setTerminals([initialWithState]);
            setActiveId(initialWithState.id);
            await loadDirectory(initialWithState.cwd);
          }
        } else {
          // No saved terminals, create a default one
          const initial = await invoke<TerminalInfo>("create_terminal", {
            label: "Terminal 1",
            color: COLORS[0],
            cwd: null,
          });
          const initialWithState = {
            ...initial,
            status: "idle" as const,
            needsAttention: false,
          };
          setTerminals([initialWithState]);
          setActiveId(initialWithState.id);
          await loadDirectory(initialWithState.cwd);
        }
      } catch (error) {
        console.error("Error during initialization", error);
      } finally {
        setBooting(false);
        setHasBootstrapped(true);
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

  // Play intro audio on splash screen
  useEffect(() => {
    if (booting && tauriAvailable) {
      const audio = new Audio(introAudio);
      audio.volume = 0.5;
      audio.play().catch((error) => {
        console.warn("Unable to play intro audio:", error);
      });

      return () => {
        audio.pause();
        audio.currentTime = 0;
      };
    }
  }, [booting, tauriAvailable, introAudio]);

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

  const handleEditTerminal = useCallback((terminal: TerminalInfo) => {
    setEditingTerminal(terminal);
    setNewTerminalName(terminal.label);
    setNewTerminalColor(terminal.color);
    setNewTerminalPath(terminal.cwd);
    setNewTerminalError(null);
    setShowNewTerminalModal(true);
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
    setNewTerminalName(`Terminal ${index + 1}`);
    setNewTerminalColor(defaultColor);
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

    if (!trimmedName) {
      setNewTerminalError("Enter a terminal name.");
      return;
    }

    if (!trimmedPath) {
      setNewTerminalError("Select working directory.");
      return;
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
        });

        setTerminals((prev) =>
          prev.map((t) =>
            t.id === editingTerminal.id
              ? {
                  ...t,
                  label: trimmedName,
                  color: newTerminalColor,
                  cwd: trimmedPath,
                }
              : t
          )
        );

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
        // Create new terminal
        const created = await invoke<TerminalInfo>("create_terminal", {
          label: trimmedName,
          color: newTerminalColor,
          cwd: trimmedPath,
        });
        const createdWithState: TerminalInfo = {
          ...created,
          status: "idle",
          needsAttention: false,
        };
        setTerminals((prev) => [...prev, createdWithState]);
        setActiveId(createdWithState.id);
        clearTerminalAttention(createdWithState.id);
        setShowNewTerminalModal(false);
        await loadDirectory(createdWithState.cwd);
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
    tauriAvailable,
  ]);

  const handleSelectTerminal = useCallback(
    (id: string) => {
      if (!tauriAvailable) {
        return;
      }
      setActiveId(id);
      clearTerminalAttention(id);
      clearIdleTimer(id);
      const terminal = terminals.find((candidate) => candidate.id === id);
      if (terminal) {
        void loadDirectory(terminal.cwd);
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


  const handleOpenPreviewDrawer = useCallback(() => {
    setShowPreviewDrawer(true);
  }, []);
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
      setPreviewFile({ name: entry.name, path: entry.path });
      setPreviewContent("");
      setPreviewError(null);
      setPreviewDiffInfo(null);
      setLoadingPreview(true);

      try {
        // Load file content
        const content = await invoke<string>("read_file_content", {
          path: entry.path,
        });
        setPreviewContent(content);

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
          } catch (diffError) {
            console.warn("Unable to load diff:", diffError);
            // Don't block file opening if diff fails
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setPreviewError(message);
      } finally {
        setLoadingPreview(false);
      }
    },
    [tauriAvailable, gitSummary, explorerRoot]
  );

  const handleRefreshPreview = useCallback(async () => {
    if (!tauriAvailable || !previewFile) {
      return;
    }
    setPreviewError(null);
    setLoadingPreview(true);
    try {
      const content = await invoke<string>("read_file_content", {
        path: previewFile.path,
      });
      setPreviewContent(content);
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
    async (command: string, label: string) => {
      if (!tauriAvailable || !activeId) {
        return;
      }
      try {
        await invoke("write_to_terminal", {
          id: activeId,
          data: command + "\n",
        });
        console.log(`AI command executed: ${label} -> ${command}`);
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
        invoke<GitCommitEntry[]>("git_commit_history", { limit: 50, rootPath }),
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

  const handleDiffViewChange = useCallback((view: "worktree" | "staged") => {
    setDiffView(view);
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

  if (booting) {
    return (
      <div className="app-loader">
        <div className="app-loader-card">
          <img
            src={splashImage}
            alt="Logo Quack"
            className="app-loader-image"
          />
        </div>
      </div>
    );
  }

  return (
    <>
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
          onAdd={handleOpenNewTerminalModal}
          onSelect={handleSelectTerminal}
          onClose={handleCloseTerminal}
          onColorChange={handleColorChange}
          onEdit={handleEditTerminal}
          onToggleGroup={handleToggleGroup}
          onReorder={handleReorderTerminals}
          onToggleProcesses={() =>
            setShowProcessesDrawer((value) => !value)
          }
          processesOpen={showProcessesDrawer}
        />

        <section className="terminal-pane">
          <div className="main-toolbar">
            <div className="main-toolbar-top">
              <div className="main-toolbar-title">
                <h2 className="main-toolbar-heading">🦆 Claude Agent Chat</h2>
                {import.meta.env.DEV && (
                  <span className="dev-badge">DEV</span>
                )}
              </div>
              <div className="main-toolbar-right">
                <div
                  className="git-branch-indicator"
                  title={
                    gitSummary?.branch
                      ? `Current branch: ${gitSummary.branch}`
                      : "Current branch unavailable"
                  }
                >
                  <span
                    className="git-branch-indicator-dot"
                    aria-hidden="true"
                  />
                  <span className="git-branch-indicator-name">
                    {gitSummary?.branch ?? "—"}
                  </span>
                </div>
                <button
                  type="button"
                  className={`git-tab-button ${showGitDrawer ? "active" : ""}`}
                  onClick={() => setShowGitDrawer(!showGitDrawer)}
                >
                  Git
                </button>
              <button
                type="button"
                className="git-tab-button"
                onClick={handleOpenPreviewDrawer}
              >
                Preview
              </button>
              </div>
            </div>
            <div className="main-toolbar-bottom">
              <span className="terminal-status">
                AI Agent Chat Interface
              </span>
            </div>
          </div>
          <div className="terminal-container">
            <ChatView
              messages={currentAgentMessages}
              isLoading={currentAgentLoading}
              onSendMessage={sendMessageForAgent}
            />
          </div>
          <ToolBar
            onExecuteCommand={handleExecuteAICommand}
            onToggleSavedCommands={() =>
              setSavedCommandsDrawerOpen((value) => !value)
            }
            savedCommandsOpen={savedCommandsDrawerOpen}
            onOpenAIAssistant={handleOpenAIAssistant}
          />
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
          onRefreshAgents={loadAgents}
          // Terminal props
          activeTerminalId={activeId}
          terminals={terminals}
          onTerminalInput={handleTerminalInput}
          onTerminalOutput={handleTerminalOutput}
          onUpdateRecentCommands={(commands) => {
            recentCommandsRef.current = commands;
          }}
        />

        <NewTerminalModal
          open={showNewTerminalModal}
          isEditing={editingTerminal !== null}
          name={newTerminalName}
          path={newTerminalPath}
          color={newTerminalColor}
          availableColors={COLORS}
          selectingDirectory={selectingDirectory}
          creating={creatingTerminal}
          error={newTerminalError}
          onNameChange={setNewTerminalName}
          onColorChange={setNewTerminalColor}
          onBrowse={handleSelectDirectory}
          onCancel={handleCancelNewTerminal}
          onConfirm={handleConfirmNewTerminal}
        />

        <FilePreviewDrawer
          open={previewFile !== null}
          filename={previewFile?.name ?? null}
          path={previewFile?.path ?? null}
          content={previewContent}
          loading={loadingPreview}
          error={previewError}
          formatting={formattingPreview}
          diffInfo={previewDiffInfo}
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

        <ProcessesDrawer
          open={showProcessesDrawer}
          processes={activeProcesses}
          onClose={() => setShowProcessesDrawer(false)}
          onRefresh={loadActiveProcesses}
          onFocusTerminal={handleSelectTerminal}
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
          processes={activeProcesses}
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
              diffContent={diffContent}
              diffLoading={diffLoading}
              diffError={diffError}
              diffView={diffView}
              onDiffViewChange={handleDiffViewChange}
              onRefresh={refreshGitSummary}
              onSelect={handleSelectGitEntry}
              onStage={handleStageEntry}
              onUnstage={handleUnstageEntry}
              onStageAll={handleStageAll}
              onOpenFile={handleOpenFileFromGit}
              commitMessage={commitMessage}
              onCommitMessageChange={setCommitMessage}
              onCommit={handleCommit}
              committing={committing}
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

        {showAISettings && (
          <AISettingsPanel onClose={() => setShowAISettings(false)} />
        )}

        {showPerformanceMonitor && <PerformanceMonitor />}

        {showAIAssistant && (
          <AIAssistant
            intent={aiIntent}
            context={aiContext}
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

        <BackgroundsModal
          open={showBackgroundsModal}
          currentBackground={currentBackground}
          onSelect={handleSelectBackground}
          onClose={() => setShowBackgroundsModal(false)}
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
