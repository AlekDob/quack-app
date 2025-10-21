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
import FilePreviewDrawer from "./components/FilePreviewDrawer";
import GitPanel from "./components/GitPanel";
import PluginsPanel from "./components/PluginsPanel";
import SavedCommandsDrawer from "./components/SavedCommandsDrawer";
import SavedCommandModal from "./components/SavedCommandModal";
// import { NativeTerminalPanel } from "./components/NativeTerminalPanel"; // Unused - commented out
import { AddNativeTerminalModal } from "./components/AddNativeTerminalModal";
import PreviewDrawer from "./components/PreviewDrawer";
import UnifiedSettings from "./components/settings/UnifiedSettings";
import PerformanceMonitor from "./components/PerformanceMonitor";
import AIAssistant from "./components/AIAssistant";
import QuackAgencyDrawer from "./components/QuackAgencyDrawer";
import ContextDrawer from "./components/ContextDrawer";
import BackgroundsModal from "./components/BackgroundsModal";
import ChatView from "./components/ChatView";
import type { DiffInfo } from "./components/CodeEditor";
import { parseDiff } from "./lib/diffParser";
import type { ChatSendOptions } from "./hooks/useClaudeChat";

import type {
  AgentChat,
  DirectoryEntry,
  DirectoryListing,
  GitCommitEntry,
  GitStatusEntry,
  GitStatusSummary,
  NativeTerminal,
  NativeTerminalApp,
  TerminalExitEvent,
  TerminalInfo,
  SavedCommand,
  TerminalContext,
  AgentInfo,
  AgentDetails,
  ChatMessage,
  ClaudeEvent,
  AgentChatSettings,
  SessionUsage,
  UsageStats,
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
// Migration System (Phase 2)
// ============================================
// NO migration needed! Terminals are independent entities, grouped only by cwd in the UI

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

  // AgentChat state (workspace containers for terminal tabs)
  // AgentChats kept for UI grouping only - NOT linked to terminals!
  const [agentChats, setAgentChats] = useState<AgentChat[]>([]);

  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Native Terminals state (Mac Terminal.app integration)
  const [nativeTerminals, setNativeTerminals] = useState<NativeTerminal[]>([]);
  const [showAddNativeTerminalModal, setShowAddNativeTerminalModal] = useState(false);

  // Derived state - moved here to fix TypeScript hoisting errors
  const [activeAgent, setActiveAgent] = useState<AgentInfo | null>(null); // Agent currently used in chat (Quack Agency)

  const activeTerminal = useMemo(
    () => terminals.find((terminal) => terminal.id === activeId) ?? null,
    [activeId, terminals]
  );

  const [explorerPath, setExplorerPath] = useState("");
  const [explorerTree, setExplorerTree] = useState<
    Record<string, DirectoryEntry[]>
  >({});
  const [explorerRoot, setExplorerRoot] = useState<string | null>(null);
  const [loadingExplorer, setLoadingExplorer] = useState(false);
  const [explorerError, setExplorerError] = useState<string | null>(null);
  const [refreshExplorerTrigger, setRefreshExplorerTrigger] = useState(0);
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
  const [showPluginsDrawer, setShowPluginsDrawer] = useState(false);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
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

  // Abort controllers and last prompts for each agent
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const lastPromptsRef = useRef<Map<string, string>>(new Map());

  // Agent Chat Settings - persistent configuration per agent
  const [agentChatSettings, setAgentChatSettings] = useState<Map<string, AgentChatSettings>>(new Map());

  // Usage tracking - cost and token usage from Claude Agent SDK
  const [usageSessions, setUsageSessions] = useState<SessionUsage[]>([]);

  // Track usage from Claude Agent SDK response
  const trackUsage = useCallback((
    agentId: string,
    agentName: string,
    sessionId: string,
    totalCostUsd: number,
    usage?: { input_tokens: number; output_tokens: number; cache_creation_input_tokens?: number; cache_read_input_tokens?: number }
  ) => {
    const now = Date.now();

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
  }, []);

  // Clear all usage data
  const handleClearUsage = useCallback(() => {
    setUsageSessions([]);
  }, []);

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

  // Listen for Claude SDK streaming events from backend
  useEffect(() => {
    if (!tauriAvailable || !activeId) return;

    const eventName = `claude-event:${activeId}`;
    const unlistenPromise = listen<ClaudeEvent>(eventName, (event) => {
      const claudeEvent = event.payload;

      // Update chat session with incoming events
      setChatSessions((prev) => {
        const newSessions = new Map(prev);
        const agentMessages = newSessions.get(activeId) ?? [];
        const lastMsg = agentMessages[agentMessages.length - 1];

        if (lastMsg && lastMsg.role === 'assistant' && lastMsg.status === 'streaming') {
          const updatedMessages = [...agentMessages];
          updatedMessages[updatedMessages.length - 1] = {
            ...lastMsg,
            events: [...(lastMsg.events || []), claudeEvent],
          };
          newSessions.set(activeId, updatedMessages);
        }

        return newSessions;
      });

      // Auto-refresh FileExplorer when files are created/modified
      if (claudeEvent.type === 'result') {
        // Get all events from the last message to check for Write/Edit tools
        setChatSessions((prev) => {
          const agentMessages = prev.get(activeId) ?? [];
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

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(() => undefined);
    };
  }, [tauriAvailable, activeId]);

  // Send message for specific agent
  const sendMessageForAgent = useCallback(async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || !activeId) return;

    // Save the prompt for restoration on abort
    lastPromptsRef.current.set(activeId, content);

    // Create abort controller for this stream
    const abortController = new AbortController();
    abortControllersRef.current.set(activeId, abortController);

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
      const agentLabel = activeAgent?.name || `Agent ${activeId}`;
      trackUsage(
        activeId,
        agentLabel,
        response.session_id,
        response.total_cost_usd,
        response.usage  // ✅ Now passing full usage stats from Rust backend!
      );

      // Notify that agent response is complete
      notifyAgentReadyRef.current({ id: activeId, label: agentLabel });

      // Reset active agent after sending message
      // This ensures agent is only used for this message, not persistent
      setActiveAgent(null);
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

      // Clean up abort controller
      abortControllersRef.current.delete(activeId);
    }
  }, [activeId, isChatConfigured, chatSessions, activeAgent, activeTerminal?.cwd, explorerPath]);

  // Abort streaming for specific agent
  const abortStreamForAgent = useCallback(() => {
    if (!activeId) return;

    const abortController = abortControllersRef.current.get(activeId);
    if (abortController && !abortController.signal.aborted) {
      console.log('[abortStreamForAgent] Aborting stream for agent:', activeId);
      abortController.abort();
    }
  }, [activeId]);

  // Get last prompt for specific agent
  const getLastPromptForAgent = useCallback(() => {
    if (!activeId) return '';
    return lastPromptsRef.current.get(activeId) || '';
  }, [activeId]);

  // Clear conversation for current agent
  const clearCurrentAgentConversation = useCallback(async () => {
    if (!activeId) return;

    // Show confirmation dialog
    const confirmed = await confirm('Are you sure you want to clear this conversation? This action cannot be undone.', {
      title: 'Clear Conversation',
      kind: 'warning',
    });

    if (!confirmed) return;

    // Clear messages
    setChatSessions((prev) => {
      const newSessions = new Map(prev);
      newSessions.set(activeId, []);
      return newSessions;
    });

    // Clear conversation history
    chatConversationHistoryRef.current.set(activeId, []);

    // Clear last prompt
    lastPromptsRef.current.delete(activeId);

    // Show success toast
    toast.success('Conversation cleared');
  }, [activeId]);

  // Quack Agency state
  const [showQuackAgencyDrawer, setShowQuackAgencyDrawer] = useState(false);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentDetails | null>(null);
  // activeAgent moved to top of component for TypeScript hoisting
  const [pendingAgentMention, setPendingAgentMention] = useState<AgentInfo | null>(null); // Agent to insert as @mention in input
  const [pendingFileMention, setPendingFileMention] = useState<{ name: string; path: string; relativePath: string } | null>(null); // File to insert as @file mention
  const [pendingSlashCommand, setPendingSlashCommand] = useState<{ name: string; description: string } | null>(null); // Slash command to insert in input
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [agentsError, setAgentsError] = useState<string | null>(null);
  const [agentsDirectoryExists, setAgentsDirectoryExists] = useState<boolean>(true);

  // Context drawer state
  const [showContextDrawer, setShowContextDrawer] = useState(false);
  const [contextScope, setContextScope] = useState<string | null>(null);

  // activeTerminal moved to top of component for TypeScript hoisting

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
  const handleAddNativeTerminal = useCallback(
    async (name: string, directory: string, color: string, app: NativeTerminalApp, savedCommand?: SavedCommand) => {
      if (!tauriAvailable) {
        toast.error("Tauri is not available");
        return;
      }

      try {
        // If a saved command is provided, use its command and cwd
        const finalDirectory = savedCommand?.cwd || directory;
        const commandToExecute = savedCommand?.command;

        const result = await invoke<{ success: boolean; pid?: number }>(
          "open_native_terminal",
          {
            name,
            directory: finalDirectory || undefined,
            app,
            command: commandToExecute || undefined
          }
        );

        if (result.success) {
          const newTerminal: NativeTerminal = {
            id: crypto.randomUUID(),
            name,
            app,
            color,
            directory: finalDirectory,
            isOpen: true,
            pid: result.pid,
            createdAt: Date.now(),
          };

          setNativeTerminals((prev) => [...prev, newTerminal]);
          if (savedCommand) {
            toast.success(`Terminal "${name}" opened with command "${savedCommand.name}"`);
          } else {
            toast.success(`Terminal "${name}" opened successfully`);
          }
        } else {
          toast.error("Failed to open terminal");
        }
      } catch (error) {
        console.error("Failed to open native terminal:", error);
        toast.error(
          `Failed to open terminal: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    },
    [tauriAvailable]
  );

  // Quick-launch native terminal with AI tool command (Claude Code, Factory AI, Codex)
  const handleQuickLaunchNativeTerminal = useCallback(
    async (command: string, label: string) => {
      // Preset color palette for random selection
      const colors = [
        "#4ecdc4",
        "#ff6b6b",
        "#95e1d3",
        "#f38181",
        "#aa96da",
        "#fcbad3",
        "#a8d8ea",
        "#ffb5e8",
        "#c7ceea",
        "#ffd3b6",
        "#d4a5a5",
      ];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      // Get current directory (prefer explorerPath, fallback to activeTerminal cwd or home)
      const currentDirectory = explorerPath || activeTerminal?.cwd || "";

      // Create a SavedCommand object for the AI tool
      const aiToolCommand: SavedCommand = {
        id: crypto.randomUUID(),
        name: label,
        command,
        cwd: currentDirectory,
        color: randomColor,
        category: "dev",
      };

      // Launch native terminal with the command
      await handleAddNativeTerminal(
        label,
        currentDirectory,
        randomColor,
        "Terminal", // Default to Terminal.app (user can change this later in settings)
        aiToolCommand
      );
    },
    [explorerPath, activeTerminal, handleAddNativeTerminal]
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

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenAISettingsPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenWatchIntroPromise.then(unlisten => unlisten()).catch(() => undefined);
      unlistenBackgroundsPromise.then(unlisten => unlisten()).catch(() => undefined);
    };
  }, [loadSavedCommands, showIntroReplay, tauriAvailable]);

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

  // Notify when agent/chat completes response
  const notifyAgentReady = useCallback(
    async (payload: { id: string; label: string }) => {
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
        await sendNotification({
          id: Number(Date.now() % 2147483647),
          title: payload.label,
          body: "Response completed! 🦆",
        });
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
        scope: agentInfo.scope, // ← AGGIUNTO: passa lo scope (global/project)
      });
      setSelectedAgent(details);
      setShowQuackAgencyDrawer(true); // Apre il drawer quando si seleziona un agent
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAgentsError(message);
    }
  }, [tauriAvailable, activeTerminal?.cwd, explorerPath]);

  const handleUseAgent = useCallback((agentInfo: AgentInfo) => {
    // Instead of setting activeAgent, we'll trigger mention insertion in ChatInput
    // This is done by setting a pending mention that ChatInput will pick up
    setPendingAgentMention(agentInfo);
    toast.success(`Agent mention added: @${agentInfo.name}`, {
      description: 'Type your message to send with this agent',
      duration: 2000,
    });
  }, []);

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
    scope: 'global' | 'project'
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
              };

              recreated.push(terminalWithState);
              console.log(`Recreated terminal: ${terminal.label}`);
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

          // Set first terminal as active if we have any
          if (recreated.length > 0) {
            setActiveId(recreated[0].id);
            await loadDirectory(recreated[0].cwd);
          }
        } else {
          console.log('No saved terminals found');

          // Load any existing AgentChats even if no terminals (optional UI grouping)
          const existingChats = await loadAgentChatsFromStorage();
          if (existingChats.length > 0) {
            setAgentChats(existingChats);
          }

          // Create a default terminal
          const initial = await invoke<TerminalInfo>("create_terminal", {
            label: "Terminal 1",
            color: COLORS[0],
            cwd: null,
          });
          const initialWithState = {
            ...initial,
            status: "idle" as const,
            needsAttention: false,
            hasResponded: false,
            responseStartTime: null,
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
        // Create new terminal - SIMPLE! No AgentChat logic
        const created = await invoke<TerminalInfo>("create_terminal", {
          label: trimmedName,
          color: newTerminalColor,
          cwd: trimmedPath,
        });

        const createdWithState: TerminalInfo = {
          ...created,
          status: "idle",
          needsAttention: false,
          hasResponded: false,
          responseStartTime: null,
        };

        setTerminals((prev) => [...prev, createdWithState]);
        setActiveId(createdWithState.id);
        clearTerminalAttention(createdWithState.id);
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


  // ============================================
  // AgentChat Management Handlers (Phase 1)
  // ============================================

  // NO AgentChat handlers needed - terminals are independent!

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
          // AgentChats for UI grouping (optional)
          agentChats={agentChats}
          activeAgentChatId={null}
          onSelectAgentChat={() => {}}
          onDeleteAgentChat={() => {}}
          onUpdateAgentChat={() => {}}
          onCreateAgent={handleOpenNewTerminalModal}
          // Terminal props
          onAdd={handleOpenNewTerminalModal}
          onSelect={handleSelectTerminal}
          onClose={handleCloseTerminal}
          onColorChange={handleColorChange}
          onEdit={handleEditTerminal}
          onDuplicate={handleDuplicateTerminal}
          onToggleGroup={handleToggleGroup}
          onReorder={handleReorderTerminals}
          onOpenSettings={() => setShowSettings(true)}
        />

        <section className="terminal-pane">
          <div className="main-toolbar">
            <div className="main-toolbar-top">
              <div className="main-toolbar-title">
                <h2 className="main-toolbar-heading">
                  🦆 {activeTerminal?.label ?? 'Claude Agent Chat'}
                </h2>
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
                className={`git-tab-button ${showPluginsDrawer ? "active" : ""}`}
                onClick={() => setShowPluginsDrawer(!showPluginsDrawer)}
              >
                Plugins
              </button>
              <button
                type="button"
                className="git-tab-button"
                onClick={handleOpenPreviewDrawer}
              >
                Preview
              </button>
              <button
                type="button"
                className="git-tab-button"
                onClick={async () => {
                  try {
                    const cwd = activeTerminal?.cwd ?? explorerPath ?? process.env.HOME ?? "~";
                    await invoke("open_claude_usage_in_terminal", { cwd });
                  } catch (error) {
                    console.error("Failed to open claude usage:", error);
                  }
                }}
                title="Open Claude usage in terminal"
              >
                Usage
              </button>
              </div>
            </div>
          </div>
          <div className="terminal-container">
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
            />
          </div>
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
          // Commands props
          onUseCommand={handleUseCommand}
          // Context props
          tauriAvailable={tauriAvailable}
          onOpenContextDrawer={handleOpenContextDrawer}
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
          onQuickLaunchNativeTerminal={handleQuickLaunchNativeTerminal}
          // Native Terminals props
          nativeTerminals={nativeTerminals}
          onAddNativeTerminal={() => setShowAddNativeTerminalModal(true)}
          onRemoveNativeTerminal={async (id) => {
            const terminal = nativeTerminals.find((t) => t.id === id);
            if (!terminal) return;
            try {
              await invoke("close_native_terminal", {
                name: terminal.name,
                app: terminal.app,
              });
              setNativeTerminals((prev) => prev.filter((t) => t.id !== id));
            } catch (error) {
              console.error("Failed to close native terminal:", error);
            }
          }}
          onOpenNativeTerminal={(terminal) => {
            // Aggiorna solo lo stato - l'invoke è già fatto in NativeTerminalPanel
            setNativeTerminals((prev) =>
              prev.map((t) =>
                t.id === terminal.id ? { ...t, isOpen: true } : t
              )
            );
          }}
          onFocusNativeTerminal={(terminal) => {
            // Aggiorna solo lo stato - l'invoke è già fatto in NativeTerminalPanel
            setNativeTerminals((prev) =>
              prev.map((t) =>
                t.id === terminal.id ? { ...t, isOpen: true } : t
              )
            );
          }}
          onMarkClosedNativeTerminal={(id) => {
            // Mark terminal as closed when focus fails (window was closed externally)
            setNativeTerminals((prev) =>
              prev.map((t) => (t.id === id ? { ...t, isOpen: false } : t))
            );
          }}
          // Usage props
          usageSessions={usageSessions}
          onClearUsage={handleClearUsage}
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

        <AddNativeTerminalModal
          isOpen={showAddNativeTerminalModal}
          onClose={() => setShowAddNativeTerminalModal(false)}
          onConfirm={async (name, directory, color, app, savedCommand) => {
            await handleAddNativeTerminal(name, directory, color, app, savedCommand);
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
