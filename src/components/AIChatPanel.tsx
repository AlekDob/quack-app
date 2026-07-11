import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { Icon } from "./Icon";
import { SubagentPill } from "./SubagentPill";
import { ComposerMic, ComposerDictationBar } from "./ComposerMic";
import type { DictationCapture } from "../dictation";
import {
  CC_EFFORT_DEFAULT,
  CC_EFFORTS,
  EffortPopover,
  normalizeCcEffort,
  type CcEffort,
} from "./EffortPopover";
import { ChatNavRail } from "./ChatNavRail";
import { TurnStreamStatus } from "./TurnStreamStatus";
import { ContextFilesDock } from "./ContextFilesDock";
import { ComposerContextBar } from "./ComposerContextBar";
import { ComposerGitActions } from "./ComposerGitActions";
import { AgentCommitDock } from "./AgentCommitDock";
import {
  hydrateAgentCommitFromMessages,
  inspectBashToolResult,
} from "../agentCommitDetect";
import { clearAgentCommit, commitKey } from "../agentCommitStore";
import { useWorkspaceChatContext } from "../workspaceChatContext";
import { isUnderRoot } from "../pathUtils";
import { openUrl } from "@tauri-apps/plugin-opener";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  chatStream,
  pullStream,
  type ChatMessage,
  type ToolCall,
} from "../ai";
import {
  hasApiKey,
  makeQualifiedModel,
  parseQualifiedModel,
  isAgenticProviderId,
  warmupOllamaModel,
  type ProviderModel,
} from "../providers";
import { openSettings } from "../settingsBus";
import { useStore, parseKey, findPaneById } from "../store";
import { addNewAIChat, defaultNewChatAnchor } from "../addNewAIChat";
import { useEditorState, getActiveEditor } from "../editorState";
import { setWorkspaceRoot } from "../wsRoot";
import {
  BACKGROUND_WAKE_PROMPT,
  lastTurnLaunchedBackgroundBash,
  scheduleBackgroundWake,
  type BackgroundWakeHandle,
} from "../backgroundWake";
import {
  getString as lsGetString,
  setString as lsSetString,
} from "../localStore";
import { setPermMode } from "../permModeStore";
import {
  balanceFences,
  cleanStaleToolMessages,
  extractCodeBlocks,
  extractTaggedCodeBlocks,
  isShellLang,
  parseInlineToolCalls,
  pickPriorityFiles,
  splitThinking,
} from "../chatTextUtils";
import { executeTool, TOOLS } from "../aiTools";
import { SLASH_COMMANDS, type SlashCommand } from "../slashCommands";
import {
  AgentFileOpen,
  AskQuestionCard,
  CompactChat,
  extractEditDiffs,
  InterleavedBlocks,
  SubagentOpen,
  HtmlPreviewOpen,
  ChatFileOpen,
  ToolCallRow,
  toolDetailFor,
} from "./chatToolRender";
import { ComposeCard } from "./composeCard";
import { openHtmlPreviewTab } from "./HtmlPreviewPane";
import { resolveChatFilePath } from "../chatFileLinks";
import { PermissionCard, PrivacyBanner } from "./aiInlineCards";
import {
  ProviderSessionsButton,
  HeaderMenu,
  TimelineScrubber,
  TodosCard,
  UsageChip,
} from "./chatPanelChrome";
import { matchExclusion } from "../aiPrivacy";
import { publishTasks } from "../aiTaskStore";
import { publishChatDiff } from "../chatDiffStore";
import { summarizeLastTurn } from "../sessionDiffStats";
import { loadWorkspaceRules } from "../workspaceRules";
import { appendJackUserPreferences } from "../jackPrefs";
import {
  fetchBrainContextForTurn,
  getBrainInjectEnabled,
} from "../brainInject";
import { recordBrainUsage } from "../brainUsageStore";
import { BrainTurnChip } from "./BrainTurnChip";
import { ReasoningTurnChip } from "./ReasoningTurnChip";
import { BrainSaveChip } from "./BrainSaveChip";
import {
  parseBrainSaveProposal,
  stripBrainSaveBlocks,
} from "../brainSave";
import {
  type ImageAttachment,
  MAX_ATTACHED_IMAGES,
  attachFromBlob,
  attachFromPath,
  providerAcceptsImages,
  rehydrateAttachment,
  registerChatDropZone,
} from "../imageAttach";
import {
  COMPOSER_FILE_DROP_ATTR,
  registerComposerFileDrop,
  subscribeComposerFileDropHover,
} from "../fileComposerDrag";
import { ClaudePermissionOverlay } from "./ClaudePermissionOverlay";
import {
  loadUsage,
  recordUsage,
  thisMonthTotal,
  thisMonthWorkspaceTotal,
  wouldExceedHardCap,
} from "../aiUsageLog";
import { captureSnapshot } from "../composeSnapshots";
import {
  error as toastError,
  errMsg,
  info as toastInfo,
  success as toastSuccess,
} from "../notify";
import { confirm as dialogConfirm } from "../dialog";
import {
  loadSessions,
  saveSession,
  deleteSession,
  patchSession,
  newSessionId,
  deriveTitle,
  type ChatSession,
} from "../chatHistory";
import { registerChatPersist } from "../chatPersistFlush";
import {
  recoverSessionFromAnyProvider,
  persistRecoveredSession,
} from "../chatProviderRecovery";
import { registerChatSaveFailed } from "../chatStoreCache";
import {
  draftFromSession,
  mergeComposerDraft,
  mergeSessionKnobs,
  type ChatComposerDraft,
} from "../composerDraft";
import {
  readProviderSessionIds,
  setProviderSessionId,
  writeProviderSessionIds,
} from "../providerSession";
import {
  allProviderLinkedTitles,
  ProviderSessionChip,
} from "../providerSessionChrome";
import { providerSessions } from "../ipc";
import { resumeProviderInTerminal } from "../providerSessionTerminal";
import type { ProviderId } from "../providers/types";
import {
  buildSessionUsageLocal,
  normUsagePct,
  parseUsageExtra,
  parseUsageLimits,
} from "../sessionUsageLocal";
import {
  contextFillPct,
  contextTokensFromApiUsage,
  estimateContextUsed,
  resolveContextWindow,
  type TurnTokens,
} from "../contextUsage";
import {
  contextTokensFromDisk,
  guessClaudeSessionId,
  mergeDiskBilling,
} from "../sessionDiskHydrate";
import { SessionUsageCircle } from "./SessionUsageCircle";
import {
  SessionUsageDrawer,
  type SessionUsageData,
} from "./SessionUsageDrawer";
import {
  claudeCode,
  search,
  pty,
  fs,
} from "../ipc";
import { MarkdownPreview } from "./MarkdownPreview";
import { UserTurnBar } from "./UserMessageBar";
import { ModelPickerPopover } from "./ModelPickerPopover";
import { ModelBrowser } from "./ModelBrowser";
import { resolvePinnedPlatform } from "../chatPinnedProvider";
import { ManageModelsModal } from "./ManageModelsModal";
import { loadSubagents, type SubagentDef } from "../subagents";
import { loadSkills, type SkillDef } from "../skills";
import { permissionFor } from "../toolPermissions";
import { onAIPromptRequest, requestAIPrompt } from "../aiBus";
import { onChatStopRequest } from "../aiStopBus";
import { ComposerQueue } from "./ComposerQueue";
import { ClaudeLoginBanner } from "./ClaudeLoginBanner";
import {
  probeClaudeAuth,
  subscribeClaudeAuth,
  type ClaudeAuthProbe,
} from "../claudeAuthStatus";
import { relPath } from "../pathUtils";
import { runCommand } from "../actions";
import {
  MentionSuggestions,
  type MentionItem,
} from "./MentionSuggestions";
import {
  groupChatTurns,
  isNearBottom,
  pinUserTurnToTop,
  scrollToBottom,
} from "../chatScroll";
import {
  ensureCloudCatalog,
  ensureModelDiscovery,
  getModelDiscovery,
  isPickerCatalogLoading,
  mergeLiveCliModelsIntoDiscovery,
  subscribeModelDiscovery,
  warmPickerCatalogs,
  type ModelDiscoverySnapshot,
} from "../modelDiscoveryStore";

// @-mention parser: given the composer text and current cursor index,
// return the active @-segment when the cursor sits in one. A segment
// starts at an @ and ends at whitespace; if either condition isn't
// met, returns null. Hoisted out of the component because it's pure
// and gets called on every keystroke — module scope keeps it from
// being recreated each render.
function parseMention(
  input: string,
  cursor: number,
): { query: string; start: number; end: number } | null {
  if (cursor <= 0 || cursor > input.length) return null;
  let i = cursor - 1;
  while (i >= 0) {
    const ch = input[i];
    if (ch === "@") {
      // Only treat @ as a mention trigger when it sits at start-of-
      // string or after whitespace — otherwise an email address or
      // an ESM import like @scope/pkg fires the popover.
      if (i === 0 || /\s/.test(input[i - 1])) {
        return { query: input.slice(i + 1, cursor), start: i, end: cursor };
      }
      return null;
    }
    if (/\s/.test(ch)) return null;
    i--;
  }
  return null;
}

function draftFromComposerSnap(snap: {
  input: string;
  queue: string[];
  attachTree: boolean;
  attachTerminal: boolean;
  attachedAgents: string[];
  attachedImages: ImageAttachment[];
}): ChatComposerDraft | undefined {
  const draft: ChatComposerDraft = {};
  if (snap.input) draft.input = snap.input;
  if (snap.queue.length > 0) draft.queue = [...snap.queue];
  if (snap.attachTree) draft.attachTree = true;
  if (snap.attachTerminal) draft.attachTerminal = true;
  if (snap.attachedAgents.length > 0) {
    draft.attachedAgents = [...snap.attachedAgents];
  }
  if (snap.attachedImages.length > 0) {
    draft.attachedImages = snap.attachedImages.map((i) => ({
      id: i.id,
      path: i.path,
      name: i.name,
    }));
  }
  return Object.keys(draft).length > 0 ? draft : undefined;
}

interface Props {
  wsId: string;
  root: string;
  /**
   * When set, this AIChatPanel instance is bound to a moveable AI tab
   * (one of `WorkspaceData.aiChats[aiChatId]`). It will load that tab's
   * stored sessionId on mount, and write back any sessionId / title
   * changes so they survive pane drags + reloads.
   *
   * When omitted, the panel runs in legacy "right-side singleton" mode:
   * it auto-restores the most-recent saved session on workspace switch,
   * just like before.
   */
  aiChatId?: string;
  /** False when this tab's host is hidden (background multitask). Gates Esc so
   *  only the visible chat's shortcut fires — other mounted panels may still
   *  have an in-flight turn. */
  chatVisible?: boolean;
  /** Fires after the bound tab's session + messages are hydrated (agent-mode switch overlay). */
  onHydrated?: () => void;
}

// Per-chat budget threshold in USD, persisted in localStorage. 0 =
// disabled (no warning ever fires). Read on every turn so changes
// from Settings take effect immediately.
const BUDGET_KEY = "lcp.claudeCode.budgetUsd";
// Last-used Claude Code permission mode, persisted so "Auto" sticks across
// restarts. Empty / missing = Ask (null). See permModeStore for how the mode
// reaches the permission overlay.
const PERM_MODE_KEY = "lcp.claudeCode.permMode";
// Default effort for brand-new chats — each saved session stores its own.
const EFFORT_KEY = "lcp.claudeCode.effort";
function readEffort(): string {
  return normalizeCcEffort(lsGetString(EFFORT_KEY));
}
function readDefaultPermMode(): string | null {
  const raw = lsGetString(PERM_MODE_KEY);
  return raw || null;
}
function sessionKnobsFrom(
  session: ChatSession | undefined,
): { effort: string; thinking: boolean | null; permMode: string | null } {
  if (!session) return defaultSessionKnobs();
  return {
    effort: session.ccEffort
      ? normalizeCcEffort(session.ccEffort)
      : CC_EFFORT_DEFAULT,
    thinking: session.ccThinking ?? null,
    permMode: session.ccPermMode !== undefined ? session.ccPermMode : null,
  };
}
function defaultSessionKnobs(): {
  effort: string;
  thinking: boolean | null;
  permMode: string | null;
} {
  return {
    effort: readEffort(),
    thinking: null,
    permMode: readDefaultPermMode(),
  };
}
function readBudgetUsd(): number {
  const raw = lsGetString(BUDGET_KEY);
  if (!raw) return 0;
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const OLLAMA_DOWNLOAD = "https://ollama.com/download";
const SUGGESTED_MODELS = [
  "qwen2.5-coder:7b",
  "qwen2.5-coder:3b",
  "llama3.2:3b",
  "phi3:mini",
];
const STORAGE_KEY = "lcp.ollama.lastModel";

// Pure text helpers (extractCodeBlocks, splitThinking, parseInlineToolCalls,
// etc.) live in chatTextUtils.ts so the chat panel doesn't have to host
// 250 lines of regex / brace-walking that's reusable elsewhere.


function insertIntoActiveEditor(text: string): boolean {
  const ed = getActiveEditor();
  if (!ed) return false;
  const sel = ed.getSelection();
  if (!sel) return false;
  ed.executeEdits("ai-insert", [
    {
      range: sel,
      text,
      forceMoveMarkers: true,
    },
  ]);
  ed.focus();
  return true;
}

export function AIChatPanel({
  wsId,
  root,
  aiChatId,
  chatVisible = true,
  onHydrated,
}: Props) {
  // Gate expensive usage/discovery polls to the foreground workspace.
  // Background panels stay mounted (multitask + mount-asymmetry) but
  // catch up with one poll when the user switches back.
  const wsActive = useStore((s) => s.activeId === wsId);
  // Agent mode supplies this via context to render denser (tool bursts
  // collapse to an icon row, tighter spacing). Default false → the docked
  // chat is unchanged.
  const compact = useContext(CompactChat);
  // Parent-provided file opener (agent-mode popup); forwarded in compact mode
  // so the docked-chat opener below doesn't clobber it. See fileOpenHandler.
  const parentFileOpen = useContext(AgentFileOpen);
  // Start in "ready" rather than "checking" so the panel renders the
  // normal UI immediately on open. "Checking for Ollama…" used to flash
  // up before model discovery finished, which was confusing for users
  // who don't even use Ollama (they're on Claude Code or a cloud key).
  // Discovery still runs in the background and may flip the state to
  // "missing" / "no-models" if no models exist anywhere.
  const bootDiscovery = getModelDiscovery();
  const [status, setStatus] = useState<
    "checking" | "missing" | "ready" | "no-models"
  >(() =>
    bootDiscovery && bootDiscovery.allModels.length > 0 ? "ready" : "ready",
  );
  const [allModels, setAllModels] = useState<ProviderModel[]>(
    () => bootDiscovery?.allModels ?? [],
  );
  // Curated cloud models, shown in the browser regardless of key status so
  // users can discover what's available before setting up a key.
  const [allCloudCatalog, setAllCloudCatalog] = useState<ProviderModel[]>(
    () => bootDiscovery?.cloudCatalog ?? [],
  );
  const [claudeCodeAvailable, setClaudeCodeAvailable] = useState(
    () => bootDiscovery?.claudeCodeAvailable ?? false,
  );
  const [claudeAuth, setClaudeAuth] = useState<ClaudeAuthProbe | null>(null);
  const [cursorCliAvailable, setCursorCliAvailable] = useState(
    () => bootDiscovery?.cursorCliAvailable ?? false,
  );
  const [openCodeAvailable, setOpenCodeAvailable] = useState(
    () => bootDiscovery?.openCodeAvailable ?? false,
  );
  // Rules-file hint shown in the header. Loaded once per workspace
  // mount + refreshed whenever fs events suggest the file may have
  // changed. Null when no rules file exists.
  const [rulesSource, setRulesSource] = useState<string | null>(null);
  const [rulesPath, setRulesPath] = useState<string | null>(null);
  // Full char count of the rules file — drives the colored token-weight dot.
  const [rulesBytes, setRulesBytes] = useState<number>(0);
  const [selected, setSelected] = useState<string>("");
  const [input, setInput] = useState("");
  const [dictating, setDictating] = useState(false);
  const [fileDropHover, setFileDropHover] = useState(false);
  const dictationCaptureRef = useRef<Promise<DictationCapture> | null>(null);
  // Image attachments staged on the composer (agentic providers). Cleared
  // after each send. The zoom modal holds the full-quality data: URL of
  // whichever thumbnail the user clicked (fetched from disk on demand).
  const [attachedImages, setAttachedImages] = useState<ImageAttachment[]>([]);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState<string | null>(null);
  // Live chronological block log for the in-progress assistant bubble.
  // Mirrors `blocksThisRound` inside sendUserText so the streaming
  // bubble can render text → tool → text → tool in real time instead
  // of dumping all tool calls above the text on round-end. Cleared
  // when streaming ends and the message is committed to `messages`.
  const [streamingBlocks, setStreamingBlocks] = useState<
    NonNullable<ChatMessage["blocks"]>
  >([]);
  // Per-model pull progress so multiple installs can run in parallel.
  // Map(modelName → "human-readable progress line"). Empty = nothing pulling.
  const [pullProgressMap, setPullProgressMap] = useState<
    Record<string, string>
  >({});
  const [browserOpen, setBrowserOpen] = useState(false);
  const [manageModelsOpen, setManageModelsOpen] = useState(false);
  const [catalogWarming, setCatalogWarming] = useState(false);
  const isAnyPulling = Object.keys(pullProgressMap).length > 0;
  const aggregatedPullProgress = isAnyPulling
    ? Object.values(pullProgressMap).join(" · ")
    : null;
  const {
    attachContext,
    attachedFiles,
    addAttachedFile,
    clearAttachedFiles,
  } = useWorkspaceChatContext(wsId);
  const [runningTools, setRunningTools] = useState(false);
  // Tool calls currently in flight, with enough detail per row to render
  // a per-line "Tool path" + a short preview of the change (so the user
  // can see what's about to land instead of a truncated "+7" overflow).
  // Each entry tracks status so done rows can render a checkmark
  // instead of the perpetual-spinner illusion. id matches the
  // tool_use_id so tool_result events can flip the matching label
  // to "done" the moment the result lands.
  const [activeToolLabels, setActiveToolLabels] = useState<
    Array<{
      id?: string;
      name: string;
      detail: string;
      preview?: string;
      status: "running" | "done" | "error";
    }>
  >([]);
  // Live tool calls + results for the in-progress bubble. Mirror state
  // updated alongside streamingBlocks so InterleavedBlocks can resolve
  // each `tool_call` block to a real ToolCall + its result while the
  // round is still streaming. Cleared on round end.
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [streamingToolResults, setStreamingToolResults] = useState<
    Array<{ tool_use_id: string; content: string; is_error?: boolean }>
  >([]);
  // Inline permission request — when a tool needs "ask" approval, instead
  // of popping a modal we render a card in the chat with multiple options.
  // The chat loop awaits a Promise that resolves when the user clicks one.
  const [pendingPermission, setPendingPermission] = useState<{
    call: ToolCall;
    resolve: (decision: "allow" | "deny") => void;
  } | null>(null);
  // Live tokens-per-second during streaming, and a sticky "warming up"
  // marker for the cold-start window before the first token arrives.
  const [tokensPerSec, setTokensPerSec] = useState<number | null>(null);
  // Most-recent end-of-turn usage report from the agentic provider
  // (Claude Code emits this in its `result` event). Pinned in the
  // status strip so the user sees what the last turn cost in dollars +
  // tokens, including cache hit ratio. Cleared on new chat / clear.
  const [lastUsage, setLastUsage] = useState<{
    cost?: number;
    durationMs?: number;
    model?: string;
    tokens?: {
      input: number;
      output: number;
      cacheRead: number;
      cacheCreate: number;
    };
    /** Last API message_start snapshot — true context window fill. */
    contextTokens?: {
      input: number;
      output: number;
      cacheRead: number;
      cacheCreate: number;
    };
  } | null>(null);
  // Live context snapshot — updated on each API message_start/delta mid-turn.
  const [liveContextTokens, setLiveContextTokens] = useState<TurnTokens | null>(
    null,
  );
  // JSONL fallback when CC runs outside Quack's stream (terminal / attach).
  const [diskContextTokens, setDiskContextTokens] =
    useState<TurnTokens | null>(null);
  // Last non-empty context ring reading — kept visible while a new turn
  // is in flight so the circle doesn't flash empty before usage arrives.
  const pinnedContextRef = useRef<{
    pct: number;
    used: number;
    window: number;
    estimate: boolean;
  } | null>(null);
  // Latest TodoWrite snapshot from the agent, rendered as a sticky
  // checklist above the chat. Per Shrivu Shankar — "the todo list is
  // the most informative single artifact of an agent run". Updated
  // every time Claude Code emits a TodoWrite tool_use; cleared on new
  // chat / clear / restore.
  const [todos, setTodos] = useState<Array<{
    content: string;
    status: "pending" | "in_progress" | "completed";
    activeForm?: string;
  }> | null>(null);
  // TaskCreate/TaskUpdate (Claude Code's session task tools) feed the
  // SAME checklist. Tasks are numbered in creation order, matching the
  // CLI's "#N" ids, so TaskUpdate's taskId resolves to a row.
  const taskIndexRef = useRef<Map<string, number>>(new Map());
  const taskCounterRef = useRef(0);

  // Mirror the checklist into the shared store so the agent-mode sidebar's
  // Tasks section can render it. Keyed by aiChatId; singleton (no id) chats
  // don't publish since nothing reads them.
  useEffect(() => {
    if (aiChatId) publishTasks(aiChatId, todos);
  }, [todos, aiChatId]);

  useEffect(() => {
    if (!aiChatId) return;
    publishChatDiff(
      aiChatId,
      messages.length > 0 ? summarizeLastTurn(messages) : null,
    );
  }, [messages, aiChatId]);

  // Rebuild the sticky checklist from saved history. The checklist is
  // normally driven by LIVE tool_call events, so a reload or chat
  // switch dropped it even though the tasks sit right there in the
  // transcript. Replays TodoWrite snapshots and TaskCreate/TaskUpdate
  // in message order, and re-seeds the task-id mapping so live
  // TaskUpdate calls in a resumed session still resolve.
  const rebuildChecklist = (msgs: ChatMessage[]) => {
    taskIndexRef.current.clear();
    taskCounterRef.current = 0;
    let list: Array<{
      content: string;
      status: "pending" | "in_progress" | "completed";
      activeForm?: string;
    }> = [];
    for (const m of msgs) {
      if (m.role !== "assistant" || !m.tool_calls) continue;
      for (const c of m.tool_calls) {
        const a = c.function.arguments;
        if (c.function.name === "TodoWrite" && Array.isArray(a.todos)) {
          list = (a.todos as unknown[])
            .filter(
              (t): t is Record<string, unknown> =>
                !!t && typeof t === "object",
            )
            .map((t) => ({
              content:
                typeof t.content === "string" ? t.content : "(untitled)",
              status:
                t.status === "in_progress" || t.status === "completed"
                  ? (t.status as "in_progress" | "completed")
                  : ("pending" as const),
              activeForm:
                typeof t.activeForm === "string" ? t.activeForm : undefined,
            }));
        } else if (c.function.name === "TaskCreate") {
          const subject =
            typeof a.subject === "string" && a.subject
              ? a.subject
              : typeof a.description === "string" && a.description
                ? a.description
                : "(task)";
          const taskId = String(++taskCounterRef.current);
          taskIndexRef.current.set(taskId, list.length);
          list.push({
            content: subject,
            status: "pending",
            activeForm:
              typeof a.activeForm === "string" ? a.activeForm : undefined,
          });
        } else if (c.function.name === "TaskUpdate") {
          const taskId =
            typeof a.taskId === "string"
              ? a.taskId
              : typeof a.task_id === "string"
                ? a.task_id
                : a.taskId != null
                  ? String(a.taskId)
                  : "";
          const idx = taskIndexRef.current.get(taskId);
          if (idx !== undefined && list[idx]) {
            const cur = { ...list[idx] };
            const st = a.status;
            if (
              st === "pending" ||
              st === "in_progress" ||
              st === "completed"
            ) {
              cur.status = st;
            } else if (st === "cancelled" || st === "deleted") {
              cur.status = "completed";
            }
            if (typeof a.subject === "string" && a.subject) {
              cur.content = a.subject;
            }
            list[idx] = cur;
          }
        }
      }
    }
    setTodos(list.length > 0 ? list : null);
  };
  const tryProviderRecover = useCallback(
    async (row: ChatSession, gen: number) => {
      const recovered = await recoverSessionFromAnyProvider(root, row);
      if (!recovered || gen !== ccHydrateGenRef.current) return;
      const msgs = cleanStaleToolMessages(recovered.session.messages);
      setMessages(msgs);
      rebuildChecklist(msgs);
      persistRecoveredSession(wsId, { ...recovered.session, messages: msgs });
      setSessions(loadSessions(wsId));
      toastInfo(
        `Restored ${msgs.length} messages from ${recovered.provider} session`,
      );
    },
    [root, wsId],
  );
  // Cumulative USD spend across every turn in this chat. Persisted
  // alongside the conversation so the running tally survives reloads.
  // Used by the spend chip in the footer + the budget-warning toast.
  const [chatTotalCost, setChatTotalCost] = useState<number>(0);
  // Cumulative token counters for the session usage drawer.
  const [cumulativeTokensIn, setCumulativeTokensIn] = useState(0);
  const [cumulativeTokensOut, setCumulativeTokensOut] = useState(0);
  const [cumulativeCacheRead, setCumulativeCacheRead] = useState(0);
  const [cumulativeTurns, setCumulativeTurns] = useState(0);
  const [diskSessionDurationMs, setDiskSessionDurationMs] = useState(0);
  const [sessionStartTs] = useState(() => Date.now());
  // Pin the ring fill across in-flight turns (context or plan %).
  const pinnedRingRef = useRef(0);
  const planCacheRef = useRef<{
    sessionPct: number;
    sessionResetsAt: string | null;
    limits: SessionUsageData["limits"];
    extra: SessionUsageData["extra"];
  } | null>(null);
  const usageMetricsRef = useRef({
    wsId,
    selected,
    allModels,
    chatTotalCost: 0,
    cumulativeTokensIn: 0,
    cumulativeTokensOut: 0,
    cumulativeCacheRead: 0,
    cumulativeTurns: 0,
    diskSessionDurationMs: 0,
    assistantTurns: 0,
    lastUsage: null as typeof lastUsage,
    liveContextTokens: null as TurnTokens | null,
    diskContextTokens: null as TurnTokens | null,
    sessionStartTs: Date.now(),
  });
  // Toggle: has the user been warned about the budget for this chat
  // yet? Avoids spamming the toast every turn once they cross.
  const [budgetWarned, setBudgetWarned] = useState(false);
  // Timeline scrubber — when non-null, messages past this index are
  // dimmed and the user can branch from that point into a new chat
  // tab without disturbing the current one. Null = no scrub (live).
  // Reset on session change, new chat, regenerate.
  const [scrubIndex, setScrubIndex] = useState<number | null>(null);
  const [warmingUp, setWarmingUp] = useState(false);
  // EMA of recent assistant generations for the slow-model banner.
  const [recentTps, setRecentTps] = useState<number | null>(null);
  // Wall-clock of the last stream event we received from the provider.
  // Used by the inline-status to switch from "Generating response…" to
  // "Still working — Xs since last update" when the stream goes quiet
  // for a noticeable while. User reported waiting "so long for messages
  // to come back" with the indicator hidden — this gives them visible
  // proof that the app hasn't lost track.
  const [lastStreamEventAt, setLastStreamEventAt] = useState<number | null>(
    null,
  );
  // Keying the 1-Hz tick interval by `streaming === null ? 'idle' : 'live'`
  // so we set it up exactly once per turn (start) and tear it down once
  // (end), instead of churning the interval on every incoming event when
  // we used `lastStreamEventAt` as the dep.
  const [, setNowTick] = useState(0);
  const isStreamingForTick = streaming !== null;
  useEffect(() => {
    if (!isStreamingForTick) return;
    const t = window.setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => window.clearInterval(t);
  }, [isStreamingForTick]);
  // Initialize sessionId DIRECTLY from the chat-tab descriptor on
  // first render. Was using a fresh newSessionId() which created a
  // race: the setAIChatSession effect would briefly overwrite the
  // descriptor with the throwaway id before the restore effect set
  // it back. If a save fired during that window, the chat history
  // got persisted under the throwaway id and refresh-resume couldn't
  // find it. Reading synchronously here closes the race.
  const [sessionId, setSessionId] = useState<string>(() => {
    if (aiChatId) {
      const desc = useStore.getState().loaded[wsId]?.aiChats[aiChatId];
      if (desc?.sessionId) return desc.sessionId;
    }
    return newSessionId();
  });
  // Claude Code provider session id, captured from stream-json `system/init`.
  // Lets us pass --resume on every follow-up turn so the CLI keeps the
  // server-side context window alive instead of re-paying cold-start cost.
  // Cleared when the user starts a new chat or restores a non-CC session.
  const [providerSessionIds, setProviderSessionIds] = useState<
    Partial<Record<ProviderId, string>>
  >({});
  const [pinnedProviderId, setPinnedProviderId] = useState<
    ProviderId | undefined
  >();
  const claudeSessionId = providerSessionIds["claude-code"];
  // Per-chat Claude Code session knobs — restored from ChatSession on switch.
  const [ccEffort, setCcEffort] = useState<string>(() => readEffort());
  const [effortPulseToken, setEffortPulseToken] = useState(0);
  const bumpEffortPulse = () => setEffortPulseToken((n) => n + 1);
  const applyCcEffort = (v: CcEffort, toast = true) => {
    setCcEffort(v);
    if (toast) toastInfo(`Effort: ${v} (from your next message)`);
  };
  const [ccPermMode, setCcPermMode] = useState<string | null>(
    () => readDefaultPermMode(),
  );
  const [ccThinking, setCcThinking] = useState<boolean | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [attachTree, setAttachTree] = useState(false);
  const [attachTerminal, setAttachTerminal] = useState(false);
  // Subagents the user @-mentioned this turn — the send flow delegates
  // the turn to them via the Task tool (Claude Code only). The full
  // catalog (project + global .claude/agents) is loaded into `agents`.
  const [agents, setAgents] = useState<SubagentDef[]>([]);
  const [attachedAgents, setAttachedAgents] = useState<string[]>([]);
  const queueRef = useRef<string[]>([]);
  const [queuedMessages, setQueuedMessages] = useState<string[]>([]);
  const syncQueueUi = useCallback(() => {
    setQueuedMessages([...queueRef.current]);
  }, []);
  const composerPersistRef = useRef({
    sessionId: "",
    input: "",
    queue: [] as string[],
    attachTree: false,
    attachTerminal: false,
    attachedAgents: [] as string[],
    attachedImages: [] as ImageAttachment[],
  });
  const knobsPersistRef = useRef({
    ccEffort,
    ccThinking,
    ccPermMode,
  });
  const lastSaveWarnAt = useRef(0);
  const ccHydrateGenRef = useRef(0);
  const persistTranscriptRef = useRef<() => void>(() => {});
  const warnSaveFailed = useCallback(() => {
    if (Date.now() - lastSaveWarnAt.current < 30_000) return;
    lastSaveWarnAt.current = Date.now();
    toastError(
      "Chat not saved — disk write failed. Copy important messages or restart Quack.",
    );
  }, []);
  useEffect(() => {
    registerChatSaveFailed(warnSaveFailed);
    return () => registerChatSaveFailed(() => {});
  }, [warnSaveFailed]);
  const applyComposerDraft = useCallback(
    (draft: ChatComposerDraft) => {
      setInput(draft.input ?? "");
      queueRef.current = draft.queue ? [...draft.queue] : [];
      syncQueueUi();
      setAttachTree(!!draft.attachTree);
      setAttachTerminal(!!draft.attachTerminal);
      setAttachedAgents(draft.attachedAgents ?? []);
      if (!draft.attachedImages?.length) {
        setAttachedImages([]);
        return;
      }
      void Promise.all(draft.attachedImages.map(rehydrateAttachment)).then(
        (imgs) =>
          setAttachedImages(
            imgs.filter((x): x is ImageAttachment => x !== null),
          ),
      );
    },
    [syncQueueUi],
  );
  const flushComposerDraft = useCallback(
    (sid: string) => {
      if (!sid) return;
      mergeComposerDraft(
        wsId,
        sid,
        draftFromComposerSnap(composerPersistRef.current) ?? {},
      );
    },
    [wsId],
  );
  const flushSessionState = useCallback(
    (sid: string) => {
      if (!sid) return;
      flushComposerDraft(sid);
      mergeSessionKnobs(wsId, sid, knobsPersistRef.current);
    },
    [wsId, flushComposerDraft],
  );
  // Skills offered in the `/` menu (Claude Code only) — loaded from
  // <ws>/.claude/skills + ~/.claude/skills alongside the subagent scan.
  const [skills, setSkills] = useState<SkillDef[]>([]);
  const [slashIndex, setSlashIndex] = useState(0);
  // @-mention file autocomplete in the composer. mentionState carries
  // the active query (text after @ up to cursor) and the byte range
  // it occupies in the input string so accept-completion can replace
  // the right slice. Null when the cursor is not inside an @-segment.
  const [mentionState, setMentionState] = useState<{
    query: string;
    start: number; // index of '@' in input
    end: number; // cursor position
  } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);
  // Workspace-file cache for the autocomplete. Populated lazily on
  // the first @ keystroke so we don't pay the IPC cost in every
  // chat session whether the user mentions files or not.
  const [mentionFiles, setMentionFiles] = useState<string[] | null>(null);
  // Shell-style prompt history. historyIdx counts backwards through
  // the user-message stream (0 = most recent); null means we're not
  // in history mode. historyDraft snapshots whatever the user was
  // typing when they entered history mode so ArrowDown past the
  // start restores it instead of leaving the buffer empty.
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);
  const historyDraftRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const editorState = useEditorState();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const composerShellRef = useRef<HTMLDivElement>(null);
  // Hidden file picker behind the composer "+" button (image attachments).
  const attachInputRef = useRef<HTMLInputElement>(null);
  // Root element ref — its bounding rect is the drop-zone the window-level
  // drag-drop listener (App.tsx) hit-tests image drops against.
  const panelRef = useRef<HTMLDivElement>(null);
  const stickyBottomRef = useRef(true);
  // While true, auto tail-follow is suppressed (Cursor-style turn pin).
  const pinActiveRef = useRef(false);
  // Visible "jump to bottom" affordance. Mirrors stickyBottomRef into
  // React state so the button can render when the user scrolls up
  // mid-stream and they need a one-click way back to the live tail.
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [expandedMsgIdx, setExpandedMsgIdx] = useState<Set<number>>(new Set());

  // Reset expanded state when the conversation switches (new chat / restore).
  useEffect(() => {
    setExpandedMsgIdx(new Set());
  }, [sessionId]);

  // Probe for a workspace rules file on mount + on workspace change so
  // the header indicator reflects whether one is in play. We re-probe
  // after every send completes (in the streaming finally block) by
  // bumping a tick — that way users editing CLAUDE.md mid-session see
  // the indicator come/go without restarting.
  useEffect(() => {
    if (!root || !wsActive) {
      if (!root) {
        setRulesSource(null);
        setRulesPath(null);
      }
      return;
    }
    let cancelled = false;
    void loadWorkspaceRules(root)
      .then((r) => {
        if (cancelled) return;
        setRulesSource(r?.source ?? null);
        setRulesPath(r?.absolutePath ?? null);
        setRulesBytes(r?.bytes ?? 0);
      })
      .catch(() => {
        if (cancelled) return;
        setRulesSource(null);
        setRulesPath(null);
        setRulesBytes(0);
      });
    return () => {
      cancelled = true;
    };
  }, [root, wsActive]);

  // Auto-grow the prompt textarea up to ~8 lines so multi-paragraph
  // questions don't get cropped behind a tiny scrollbar. Falls back to
  // the rows={2} baseline when empty.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    const max = 8 * 18 + 16; // ~8 rows of line-height 18px + padding
    el.style.height = Math.min(el.scrollHeight, max) + "px";
  }, [input]);

  const applyDiscoverySnapshot = useCallback((snap: ModelDiscoverySnapshot) => {
    setAllModels(snap.allModels);
    setAllCloudCatalog(snap.cloudCatalog);
    setClaudeCodeAvailable(snap.claudeCodeAvailable);
    setCursorCliAvailable(snap.cursorCliAvailable);
    setOpenCodeAvailable(snap.openCodeAvailable);
    const aggregate = snap.allModels;
    if (aggregate.length > 0) {
      setStatus("ready");
      const stored = lsGetString(STORAGE_KEY);
      const isPresent = (q: string) =>
        aggregate.some(
          (m) => makeQualifiedModel(m.providerId, m.modelId) === q,
        );
      const migrateClaudeCode = (q: string): string => {
        if (!q.startsWith("claude-code:")) return q;
        const id = q.slice("claude-code:".length);
        if (
          id.startsWith("claude-opus") ||
          id.startsWith("claude-sonnet") ||
          id.startsWith("claude-haiku")
        ) {
          return "claude-code:default";
        }
        return q;
      };
      setSelected((cur) => {
        const migrated = cur ? migrateClaudeCode(cur) : cur;
        if (migrated && isPresent(migrated)) return migrated;
        let preferred: string | null = null;
        if (stored) {
          const qualified = parseQualifiedModel(stored)
            ? stored
            : makeQualifiedModel("ollama", stored);
          const migratedStored = migrateClaudeCode(qualified);
          if (isPresent(migratedStored)) preferred = migratedStored;
        }
        if (!preferred) {
          const first = aggregate[0];
          preferred = makeQualifiedModel(first.providerId, first.modelId);
        }
        return preferred;
      });
      return;
    }
    if (snap.ollamaUp) setStatus("no-models");
    else setStatus("missing");
  }, []);

  const refreshLiveCliModels = useCallback(async (force = false) => {
    const snap = getModelDiscovery();
    if (!snap) return;
    const wantCc = snap.claudeCodeAvailable;
    const wantCursor = snap.cursorCliAvailable;
    const wantOc = snap.openCodeAvailable;
    if (wantCc) {
      void import("../providers/claudeCode")
        .then(({ refreshClaudeCodeModelsLive }) =>
          refreshClaudeCodeModelsLive(force),
        )
        .then((ccModels) => {
          if (ccModels.length > 0) {
            mergeLiveCliModelsIntoDiscovery([], [], ccModels);
            const next = getModelDiscovery();
            if (next) applyDiscoverySnapshot(next);
          }
        })
        .catch(() => {});
    }
    if (!wantCursor && !wantOc) return;
    try {
      const [{ refreshOpenCodeModelsLive }, { refreshCursorModelsLive }] =
        await Promise.all([
          import("../providers/openCode"),
          import("../providers/cursorCode"),
        ]);
      const [ocModels, cursorModels] = await Promise.all([
        wantOc
          ? refreshOpenCodeModelsLive(force).catch(
              () => [] as ProviderModel[],
            )
          : Promise.resolve([] as ProviderModel[]),
        wantCursor
          ? refreshCursorModelsLive(force).catch(
              () => [] as ProviderModel[],
            )
          : Promise.resolve([] as ProviderModel[]),
      ]);
      if (ocModels.length === 0 && cursorModels.length === 0) return;
      mergeLiveCliModelsIntoDiscovery(ocModels, cursorModels);
      const next = getModelDiscovery();
      if (next) applyDiscoverySnapshot(next);
    } catch {
      /* keep lightweight startup catalog */
    }
  }, [applyDiscoverySnapshot]);

  const refresh = async (options?: { showChecking?: boolean; force?: boolean }) => {
    const force = options?.force ?? true;
    if (options?.showChecking) setStatus("checking");
    const snap = await ensureModelDiscovery({ force });
    applyDiscoverySnapshot(snap);
  };

  useEffect(() => {
    const warm = getModelDiscovery();
    if (warm) applyDiscoverySnapshot(warm);
    const unsub = subscribeModelDiscovery(() => {
      const snap = getModelDiscovery();
      if (snap) applyDiscoverySnapshot(snap);
      else void refresh({ force: true });
      setCatalogWarming(isPickerCatalogLoading());
    });
    setCatalogWarming(isPickerCatalogLoading());
    return unsub;
  }, [applyDiscoverySnapshot]);

  useEffect(() => {
    if (!wsActive) return;
    const warm = getModelDiscovery();
    void refresh({ showChecking: !warm, force: false });
  }, [wsActive, applyDiscoverySnapshot]);

  useEffect(() => {
    if (!browserOpen && !manageModelsOpen) return;
    void ensureCloudCatalog().then((catalog) => setAllCloudCatalog(catalog));
    if (!browserOpen) return;
    void refreshLiveCliModels();
  }, [browserOpen, manageModelsOpen, refreshLiveCliModels]);

  // Auto-poll when Ollama isn't reachable or has no models so the
  // user doesn't have to keep clicking Refresh after installing.
  // Backs off aggressively — most Codetta users don't run Ollama
  // (they're on Claude Code or a cloud key), and a 4-second poll
  // floods their console with localhost:11434 ECONNREFUSED forever.
  // Strategy:
  //   - First 6 attempts: 4s interval (catches a fresh install)
  //   - Next 6 attempts: 30s interval
  //   - After that: stop entirely until the user clicks Refresh
  useEffect(() => {
    if (!wsActive) return;
    if (status === "ready" || status === "checking") return;
    if (isAnyPulling) return;
    // Don't keep probing localhost:11434 when the user isn't even on
    // Ollama — Claude Code / cloud-key users got a console full of
    // ECONNREFUSED for a runtime they never installed. One mount-time
    // probe (above) is enough to populate provider availability.
    const prov = parseQualifiedModel(selected ?? "")?.providerId;
    if (prov && prov !== "ollama") return;
    let attempt = 0;
    let timer: number | undefined;
    const tick = () => {
      attempt++;
      void refresh({ force: true });
      let next: number | null;
      if (attempt < 6) next = 4000;
      else if (attempt < 12) next = 30000;
      else next = null; // give up; user can click Refresh
      if (next != null) timer = window.setTimeout(tick, next);
    };
    timer = window.setTimeout(tick, 4000);
    return () => {
      if (timer != null) window.clearTimeout(timer);
    };
  }, [wsActive, status, isAnyPulling, selected]);

  // Expose workspace root globally so the Claude Code provider can spawn
  // its CLI subprocess with the right cwd. Stored via the typed
  // setWorkspaceRoot helper instead of an inline window cast so the
  // shape is declared in exactly one place.
  useEffect(() => {
    if (!wsActive) return;
    setWorkspaceRoot(root);
  }, [root, wsActive]);

  // Refresh-resume: on mount, ask Rust if there's an in-flight (or
  // recently-completed-since-app-start) Claude Code stream for this
  // chat session id. If yes, replay every buffered event so the user
  // sees the partial assistant text + active tool calls exactly as they
  // were before the page reload, then subscribe to live events going
  // forward. Without this, a refresh during a long agentic turn would
  // strand the user with an apparently-frozen UI while the subprocess
  // kept running invisibly in the background.
  // Latest messages for the attach guard below — the attach effect
  // runs once per chat and must not act on a stale mount-time array.
  const messagesRef = useRef<ChatMessage[]>(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  // True while THIS panel instance is driving a turn through the live
  // chatStream loop. The attach effect re-runs when sessionId settles
  // (hydration) — if that lands after a turn started, attaching would
  // subscribe a SECOND consumer to the same stream and double every
  // tool row and text delta.
  const liveTurnRef = useRef(false);
  const bgWakeRef = useRef<BackgroundWakeHandle | null>(null);

  const cancelBackgroundWake = useCallback(() => {
    bgWakeRef.current?.cancel();
    bgWakeRef.current = null;
  }, []);

  useEffect(() => () => cancelBackgroundWake(), [cancelBackgroundWake]);

  useEffect(() => {
    if (!sessionId) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;
    // Per-message flag: whether the in-flight assistant message has
    // had any text streamed via content_block_delta. Reset on
    // message_start; checked when the wrapping `assistant` event
    // arrives so we don't double-render the same text.
    let replayMsgGotDeltas = false;
    let replayContextTokens: TurnTokens | null = null;
    // Replay bookkeeping mirrors the live loop: a chronological blocks
    // log + tool calls/results so the resumed bubble renders the SAME
    // interleaved text → tool → text flow as a never-refreshed turn.
    // The old replay built one flat string (run-on sentences) and
    // dumped tools into the status strip below it.
    const replayBlocks: NonNullable<ChatMessage["blocks"]> = [];
    const replayCalls: ToolCall[] = [];
    const replayResults: Array<{
      tool_use_id: string;
      content: string;
      is_error?: boolean;
    }> = [];
    let replayAcc = "";
    // Start a fresh text block (= paragraph) for each new assistant
    // message so narration bursts don't glue mid-sentence.
    let breakNextText = false;
    const appendReplayText = (t: string) => {
      if (!t) return;
      const last = replayBlocks[replayBlocks.length - 1];
      if (last && last.kind === "text" && !breakNextText) {
        last.text += t;
      } else {
        replayBlocks.push({ kind: "text", text: t });
      }
      breakNextText = false;
      replayAcc += t;
      setStreamingBlocks([...replayBlocks]);
      setStreaming(replayAcc);
    };

    const replayLine = (line: { kind?: string; line?: string; code?: number }) => {
      if (line.kind === "end") {
        // Subprocess finished. Finalize: collect the replayed turn into
        // a real assistant message (with its blocks log) so it gets
        // persisted exactly like a live turn's commit.
        if (replayAcc.trim().length > 0 || replayBlocks.length > 0) {
          const msg: ChatMessage = {
            role: "assistant",
            content: replayAcc,
            tool_calls: replayCalls.length > 0 ? [...replayCalls] : undefined,
            tool_results:
              replayResults.length > 0 ? [...replayResults] : undefined,
            blocks: replayBlocks.length > 0 ? [...replayBlocks] : undefined,
          };
          setMessages((m) => [...m, msg]);
        }
        replayBlocks.length = 0;
        replayCalls.length = 0;
        replayResults.length = 0;
        replayAcc = "";
        setStreaming(null);
        setStreamingBlocks([]);
        setStreamingToolCalls([]);
        setStreamingToolResults([]);
        setRunningTools(false);
        setActiveToolLabels([]);
        return;
      }
      if (line.kind === "stderr" && line.line) {
        appendReplayText(`\n[claude] ${line.line}`);
        return;
      }
      if (line.kind !== "line" || !line.line) return;
      try {
        const obj = JSON.parse(line.line);
        if (
          obj.type === "system" &&
          obj.subtype === "init" &&
          typeof obj.session_id === "string"
        ) {
          setProviderSessionIds((prev) =>
            setProviderSessionId(prev, "claude-code", obj.session_id as string),
          );
        }
        // Token-level deltas via --include-partial-messages. Append
        // each text_delta straight to streaming. The wrapping
        // `assistant` event still fires later with the complete
        // text; per-message flag (reset on message_start) lets us
        // skip the duplicate.
        if (obj.type === "stream_event" && obj.event) {
          const ev = obj.event;
          if (ev.type === "message_start") {
            replayMsgGotDeltas = false;
            breakNextText = true;
            const snap = contextTokensFromApiUsage(
              (ev as { message?: { usage?: Record<string, unknown> } })
                .message?.usage,
            );
            if (snap) {
              replayContextTokens = snap;
              setLiveContextTokens(snap);
            }
          } else if (ev.type === "message_delta") {
            const snap = contextTokensFromApiUsage(
              (ev as { usage?: Record<string, unknown> }).usage,
              replayContextTokens ?? undefined,
            );
            if (snap) {
              replayContextTokens = snap;
              setLiveContextTokens(snap);
            }
          } else if (
            ev.type === "content_block_delta" &&
            ev.delta?.type === "text_delta" &&
            typeof ev.delta.text === "string"
          ) {
            appendReplayText(ev.delta.text);
            replayMsgGotDeltas = true;
          }
        }
        if (obj.type === "assistant" && obj.message?.content) {
          const alreadyStreamed = replayMsgGotDeltas;
          replayMsgGotDeltas = false;
          for (const block of obj.message.content) {
            if (block.type === "text" && typeof block.text === "string") {
              if (alreadyStreamed) continue;
              breakNextText = true;
              appendReplayText(block.text);
            } else if (block.type === "tool_use") {
              const args =
                block.input && typeof block.input === "object"
                  ? (block.input as Record<string, unknown>)
                  : {};
              const name = typeof block.name === "string" ? block.name : "tool";
              const detail = toolDetailFor(name, args);
              let preview: string | undefined;
              if (name === "Edit" && typeof args.new_string === "string") {
                preview = args.new_string;
              } else if (name === "Write" && typeof args.content === "string") {
                preview = args.content;
              } else if (name === "Bash" && typeof args.command === "string") {
                preview = args.command;
              }
              const id = typeof block.id === "string" ? block.id : undefined;
              // Mirror the live loop: tool calls join the chronological
              // blocks log so the bubble shows them inline where they
              // happened, not as a detached strip below all the text.
              const call: ToolCall = {
                id,
                function: { name, arguments: args },
              };
              replayCalls.push(call);
              setStreamingToolCalls([...replayCalls]);
              if (id) {
                replayBlocks.push({ kind: "tool_call", callId: id });
                setStreamingBlocks([...replayBlocks]);
              }
              setActiveToolLabels((labels) => {
                const next = labels.slice(-9);
                next.push({
                  id,
                  name,
                  detail,
                  preview,
                  status: "running" as const,
                });
                return next;
              });
              setRunningTools(true);
            }
          }
        }
        // Tool results during resume — flip the matching label to done
        // and record the result so the inline chip can show it.
        if (obj.type === "user" && obj.message?.content) {
          for (const block of obj.message.content) {
            if (
              block.type === "tool_result" &&
              typeof block.tool_use_id === "string"
            ) {
              const id = block.tool_use_id;
              const isError = block.is_error === true;
              const content =
                typeof block.content === "string"
                  ? block.content
                  : Array.isArray(block.content)
                    ? block.content
                        .map((c: { type?: string; text?: string }) =>
                          c?.type === "text" && typeof c.text === "string"
                            ? c.text
                            : "",
                        )
                        .join("")
                    : "";
              replayResults.push({
                tool_use_id: id,
                content,
                is_error: isError || undefined,
              });
              setStreamingToolResults([...replayResults]);
              setActiveToolLabels((labels) => {
                const match = labels.find((l) => l.id === id);
                const next = labels.map((l) =>
                  l.id === id
                    ? {
                        ...l,
                        status: (isError ? "error" : "done") as
                          | "error"
                          | "done"
                          | "running",
                      }
                    : l,
                );
                if (match) {
                  inspectBashToolResult({
                    wsId,
                    sessionId,
                    root,
                    toolName: match.name,
                    cmd: match.preview,
                    output: content,
                    isError,
                  });
                }
                return next;
              });
            }
          }
        }
      } catch {
        /* skip non-JSON */
      }
    };

    void invoke<{
      stream_id: string;
      lines: Array<{ kind?: string; line?: string; code?: number }>;
      ended: number | null;
    } | null>("claude_code_attach", { chatSessionId: sessionId })
      .then(async (att) => {
        if (cancelled || !att) return;
        // This instance is already consuming the stream through the
        // live loop — a second subscription would double every row.
        if (liveTurnRef.current) return;
        // A COMPLETED stream whose final answer already sits at the
        // end of this chat's history must NOT replay: the Rust buffer
        // survives until the next turn, so every page refresh was
        // re-committing (and persisting) another copy of the same
        // assistant message. Replay exists for the one real recovery
        // case — a refresh while the turn was mid-flight, where the
        // history still ends with the user's message.
        if (att.ended != null) {
          const cur = messagesRef.current;
          const last = cur[cur.length - 1];
          if (last && last.role === "assistant") return;
        }
        // Replay everything we missed.
        for (const ln of att.lines) replayLine(ln);
        // ALWAYS subscribe for live events — even when att.ended is
        // set, there can be a brief race where the watchdog/wait
        // thread emits an "end" line right after we read the buffer
        // but before we'd have noticed. A live listener is harmless
        // when the channel is silent (no events ever fire) and
        // critical when the channel is still active.
        try {
          const u = await listen<{
            kind?: string;
            line?: string;
            code?: number;
          }>(`claude-stream:${att.stream_id}`, (e) => replayLine(e.payload));
          if (cancelled) {
            u();
            return;
          }
          unlisten = u;
        } catch (e) {
          console.warn("resume listen failed", e);
        }
      })
      .catch((e) => console.warn("resume attach failed", e));

    return () => {
      cancelled = true;
      if (unlisten) unlisten();
    };
    // We deliberately depend ONLY on sessionId (the chat-tab id), not on
    // the message list — re-running this effect after every assistant
    // message would re-replay buffered events.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  useEffect(() => {
    if (selected) lsSetString(STORAGE_KEY, selected);
    // Mirror the selected model onto the chat descriptor so the AI
    // chats rail can render a per-chat provider badge without each rail
    // row mounting an AIChatPanel itself.
    if (selected && aiChatId) {
      useStore.getState().setAIChatModel(wsId, aiChatId, selected);
    }
    // Pre-warm Ollama models on selection so the first chat doesn't pay the
    // cold-start cost (often 20-60s for a 32B model).
    if (!selected) return;
    const parsed = parseQualifiedModel(selected);
    if (!parsed || parsed.providerId !== "ollama") return;
    setWarmingUp(true);
    void warmupOllamaModel(parsed.modelId).finally(() => {
      setWarmingUp(false);
    });
  }, [selected, aiChatId, wsId]);

  // Track whether the user is parked at the bottom (for tail-follow + jump chip).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      const sticky = isNearBottom(el);
      stickyBottomRef.current = sticky;
      setShowJumpToBottom((prev) => (prev === !sticky ? prev : !sticky));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);
  // Tail-follow only when the user was already at the bottom AND we are not
  // in a pinned turn (Cursor-style send pins the user message at the top).
  useEffect(() => {
    if (pinActiveRef.current) return;
    if (!stickyBottomRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    scrollToBottom(el);
  }, [messages, streaming, streamingBlocks, streamingToolCalls]);

  // Reset chat & restore appropriate session when workspace or bound
  // chat-tab changes.
  //
  // - With `aiChatId` set (tabbed mode): load THAT tab's stored sessionId
  //   from the workspace store. Each tab has its own conversation, so we
  //   must not fall back to "the most recent session in the workspace" —
  //   that would make every newly-opened tab show the same chat.
  // - Without `aiChatId` (singleton sidebar mode): keep the legacy
  //   behavior of restoring the most-recently-saved session.
  useEffect(() => {
    const list = loadSessions(wsId);
    setSessions(list);
    // Per-switch resets shared by every branch below. Previous code had
    // the lastUsage + todos clears only in the empty-list else branch,
    // so switching workspaces while either was populated left the
    // PREVIOUS workspace's usage card and TodoWrite checklist stuck
    // on the screen of the new chat.
    resetTurnTransients();
    setCumulativeTokensIn(0);
    setCumulativeTokensOut(0);
    setCumulativeCacheRead(0);
    setCumulativeTurns(0);
    setDiskSessionDurationMs(0);

    if (aiChatId) {
      const desc = useStore.getState().loaded[wsId]?.aiChats[aiChatId];
      const targetSid = desc?.sessionId ?? newSessionId();
      const found = list.find((s) => s.id === targetSid);
      setSessionId(targetSid);
      // Restore the Claude Code session id alongside the conversation
      // so the next turn resumes server-side context. If the chat is
      // empty / non-CC, this stays undefined.
      setProviderSessionIds(readProviderSessionIds(found ?? {}));
      setChatTotalCost(found?.totalCostUsd ?? 0);
      const knobs = sessionKnobsFrom(found);
      setCcEffort(knobs.effort);
      setCcThinking(knobs.thinking);
      setCcPermMode(knobs.permMode);
      applyComposerDraft(draftFromSession(found));
      if (found) {
        const msgs = cleanStaleToolMessages(found.messages);
        setMessages(msgs);
        rebuildChecklist(msgs);
        void hydrateAgentCommitFromMessages(wsId, targetSid, root, msgs);
        if (found.model) {
          const q = parseQualifiedModel(found.model)
            ? found.model
            : makeQualifiedModel("ollama", found.model);
          setSelected(q);
        }
        const gen = ++ccHydrateGenRef.current;
        void tryProviderRecover(found, gen);
      } else {
        setMessages([]);
      }
      if (onHydrated) {
        requestAnimationFrame(() => requestAnimationFrame(onHydrated));
      }
      return;
    }

    if (list.length > 0) {
      setSessionId(list[0].id);
      setProviderSessionIds(readProviderSessionIds(list[0]));
      setChatTotalCost(list[0].totalCostUsd ?? 0);
      const knobs = sessionKnobsFrom(list[0]);
      setCcEffort(knobs.effort);
      setCcThinking(knobs.thinking);
      setCcPermMode(knobs.permMode);
      applyComposerDraft(draftFromSession(list[0]));
      // Filter out stale "Unknown tool: X" result messages from older
      // sessions where we incorrectly tried to execute the agentic
      // provider's tool calls on our side. They're meaningless garbage.
      const msgs = cleanStaleToolMessages(list[0].messages);
      setMessages(msgs);
      rebuildChecklist(msgs);
      void hydrateAgentCommitFromMessages(wsId, list[0].id, root, msgs);
      if (list[0].model) {
        const q = parseQualifiedModel(list[0].model)
          ? list[0].model
          : makeQualifiedModel("ollama", list[0].model);
        setSelected(q);
      }
    } else {
      setSessionId(newSessionId());
      setProviderSessionIds({});
      setChatTotalCost(0);
      setMessages([]);
      const knobs = defaultSessionKnobs();
      setCcEffort(knobs.effort);
      setCcThinking(knobs.thinking);
      setCcPermMode(knobs.permMode);
      applyComposerDraft({});
    }
  }, [wsId, aiChatId, onHydrated, applyComposerDraft, tryProviderRecover]);

  // When sessionId changes inside a tabbed panel (e.g. via /new or the
  // history dropdown), persist it back to the descriptor so a reload
  // re-opens the same conversation.
  useEffect(() => {
    if (!aiChatId) return;
    useStore.getState().setAIChatSession(wsId, aiChatId, sessionId);
  }, [wsId, aiChatId, sessionId]);

  // Mirror the auto-derived chat title back to the tab label when in
  // tabbed mode. Cheap — only runs when messages or descriptor change.
  useEffect(() => {
    if (!aiChatId) return;
    if (messages.length === 0) return;
    const title = deriveTitle(messages);
    if (!title) return;
    const desc = useStore.getState().loaded[wsId]?.aiChats[aiChatId];
    if (!desc || desc.title === title) return;
    // Respect a hand-set title from the Agent Hub rename — don't clobber it.
    if (desc.titleLocked) return;
    useStore.getState().setAIChatTitle(wsId, aiChatId, title);
  }, [wsId, aiChatId, messages]);

  // Persist session whenever messages change. Used to be debounced
  // 400ms but a refresh during that window orphaned the chat — the
  // descriptor still pointed to a sessionId whose saved row had only
  // the old messages, so restore looked broken. Save immediately
  // (writes are localStorage-cheap) AND register a beforeunload
  // hook to flush one last time on page close.
  useLayoutEffect(() => {
    persistTranscriptRef.current = () => {
      const partial = streaming;
      let finalMessages = messages;
      if (partial !== null && partial.trim().length > 0) {
        finalMessages = [
          ...messages,
          { role: "assistant" as const, content: partial },
        ];
      }
      if (finalMessages.length === 0) return;
      const session: ChatSession = {
        id: sessionId,
        title: deriveTitle(finalMessages),
        messages: finalMessages,
        model: selected,
        updatedAt: Date.now(),
        ...writeProviderSessionIds(providerSessionIds),
        totalCostUsd: chatTotalCost > 0 ? chatTotalCost : undefined,
        ccEffort,
        ccThinking,
        ccPermMode,
        composer: draftFromComposerSnap(composerPersistRef.current),
        pinnedProviderId,
      };
      if (!saveSession(wsId, session)) warnSaveFailed();
    };
  });

  useEffect(() => {
    if (messages.length === 0) return;
    persistTranscriptRef.current();
    setSessions(loadSessions(wsId));
  }, [
    messages,
    sessionId,
    wsId,
    selected,
    providerSessionIds,
    chatTotalCost,
    ccEffort,
    ccThinking,
    ccPermMode,
    pinnedProviderId,
  ]);

  useEffect(() => {
    const key = `${wsId}:${aiChatId ?? sessionId}`;
    return registerChatPersist(key, wsId, () => persistTranscriptRef.current());
  }, [wsId, aiChatId, sessionId]);

  // Checkpoint partial assistant text while streaming (switch / crash).
  useEffect(() => {
    if (streaming === null) return;
    const t = window.setInterval(() => persistTranscriptRef.current(), 5000);
    return () => window.clearInterval(t);
  }, [streaming !== null]);

  // Last-resort flush: if the page is about to close (refresh, tab
  // close), write the current state synchronously even if a streaming
  // message hasn't fully accumulated. Captures partial assistant text
  // into a transient assistant message so refresh-resume has data to
  // re-attach to.
  useEffect(() => {
    if (!sessionId) return;
    const onBeforeUnload = () => {
      const assistantSoFar = streaming;
      const finalMessages =
        assistantSoFar !== null && assistantSoFar.trim().length > 0
          ? [
              ...messages,
              { role: "assistant" as const, content: assistantSoFar },
            ]
          : messages;
      if (finalMessages.length === 0) return;
      const session: ChatSession = {
        id: sessionId,
        title: deriveTitle(finalMessages),
        messages: finalMessages,
        model: selected,
        updatedAt: Date.now(),
        ...writeProviderSessionIds(providerSessionIds),
        totalCostUsd: chatTotalCost > 0 ? chatTotalCost : undefined,
        ccEffort,
        ccThinking,
        ccPermMode,
        composer: draftFromComposerSnap(composerPersistRef.current),
        pinnedProviderId,
      };
      if (!saveSession(wsId, session)) warnSaveFailed();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [
    messages,
    streaming,
    sessionId,
    wsId,
    selected,
    providerSessionIds,
    chatTotalCost,
    ccEffort,
    ccThinking,
    ccPermMode,
    pinnedProviderId,
  ]);

  // Empty chats still need their knobs persisted — the messages effect
  // above bails when messages.length === 0.
  useEffect(() => {
    if (!sessionId || messages.length > 0) return;
    const existing = loadSessions(wsId).find((s) => s.id === sessionId);
    patchSession(wsId, sessionId, {
      title: existing?.title ?? "Untitled",
      messages: existing?.messages ?? [],
      model: selected || existing?.model,
      ...writeProviderSessionIds(providerSessionIds),
      ccEffort,
      ccThinking,
      ccPermMode,
      composer: draftFromComposerSnap(composerPersistRef.current),
      pinnedProviderId,
    });
  }, [
    sessionId,
    wsId,
    messages.length,
    selected,
    providerSessionIds,
    ccEffort,
    ccThinking,
    ccPermMode,
    pinnedProviderId,
    input,
    queuedMessages,
    attachTree,
    attachTerminal,
    attachedAgents,
    attachedImages,
  ]);

  useLayoutEffect(() => {
    composerPersistRef.current = {
      sessionId,
      input,
      queue: queueRef.current,
      attachTree,
      attachTerminal,
      attachedAgents,
      attachedImages,
    };
    knobsPersistRef.current = { ccEffort, ccThinking, ccPermMode };
  });

  const prevSessionIdRef = useRef(sessionId);
  useEffect(() => {
    const prev = prevSessionIdRef.current;
    if (prev && prev !== sessionId) flushSessionState(prev);
    prevSessionIdRef.current = sessionId;
  }, [sessionId, flushSessionState]);

  useEffect(() => {
    if (!sessionId) return;
    const t = window.setTimeout(() => flushSessionState(sessionId), 400);
    return () => {
      window.clearTimeout(t);
      flushSessionState(sessionId);
    };
  }, [
    sessionId,
    flushSessionState,
    input,
    queuedMessages,
    attachTree,
    attachTerminal,
    attachedAgents,
    attachedImages,
    ccEffort,
    ccThinking,
    ccPermMode,
  ]);

  useLayoutEffect(() => {
    return () => {
      const snap = composerPersistRef.current;
      if (!snap.sessionId) return;
      mergeComposerDraft(
        wsId,
        snap.sessionId,
        draftFromComposerSnap(snap) ?? {},
      );
      mergeSessionKnobs(wsId, snap.sessionId, knobsPersistRef.current);
    };
  }, [wsId]);

  // drainQueue is a stable useCallback([]), so it MUST call the latest
  const pushQueue = useCallback(
    (text: string) => {
      queueRef.current.push(text);
      syncQueueUi();
    },
    [syncQueueUi],
  );
  const removeQueueAt = useCallback(
    (index: number) => {
      queueRef.current.splice(index, 1);
      syncQueueUi();
    },
    [syncQueueUi],
  );
  const clearQueue = useCallback(() => {
    queueRef.current = [];
    syncQueueUi();
  }, [syncQueueUi]);
  // drainQueue is a stable useCallback([]), so it MUST call the latest
  // sendUserText through a ref — the empty-deps closure captured the
  // very first render's sendUserText, whose stale `messages`/`selected`
  // silently dropped queued follow-ups.
  const sendUserTextRef = useRef<((text: string) => Promise<void>) | null>(
    null,
  );
  const drainQueue = useCallback(async () => {
    if (queueRef.current.length === 0) return;
    const next = queueRef.current.shift();
    syncQueueUi();
    if (!next) return;
    // One message per drain — the turn's `finally` re-schedules drain
    // for the rest. A `while` here spun forever when sendUserText
    // re-queued defensively (stale `streaming === ""` closure) and
    // immediately returned, pegging WebKit at 100% CPU + GB of RAM.
    await sendUserTextRef.current?.(next);
  }, [syncQueueUi]);
  // Keep the ref pointing at this render's sendUserText (defined
  // further down; the effect runs post-render so the binding exists).
  useEffect(() => {
    sendUserTextRef.current = (t: string) => sendUserText(t);
  });

  // Stage image attachments from a Cmd+V paste or a Finder drop. Compresses
  // each (client-side) and persists it to disk; caps at MAX_ATTACHED_IMAGES.
  // Agentic providers (Claude Code, Cursor CLI, OpenCode) consume paths or
  // file parts — other providers no-op with a hint.
  const appendImages = useCallback(
    async (
      sources: Array<
        | { kind: "blob"; blob: Blob; name: string }
        | { kind: "path"; path: string }
      >,
    ) => {
      const providerId = parseQualifiedModel(selected)?.providerId ?? "ollama";
      if (!providerAcceptsImages(providerId)) {
        toastInfo("Images attach only with Claude Code, Cursor CLI, or OpenCode");
        return;
      }
      const room = MAX_ATTACHED_IMAGES - attachedImages.length;
      if (room <= 0) {
        toastError(`Maximum ${MAX_ATTACHED_IMAGES} images per message`);
        return;
      }
      const slice = sources.slice(0, room);
      if (sources.length > room) {
        toastInfo(`Attached ${room} images (limit ${MAX_ATTACHED_IMAGES})`);
      }
      for (const s of slice) {
        try {
          const att =
            s.kind === "blob"
              ? await attachFromBlob(s.blob, s.name)
              : await attachFromPath(s.path);
          // Guard the cap again inside the loop — awaits interleave.
          setAttachedImages((cur) =>
            cur.length >= MAX_ATTACHED_IMAGES ? cur : [...cur, att],
          );
        } catch (err) {
          toastError(
            `Immagine non caricata: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    },
    [selected, attachedImages.length],
  );

  const removeImage = (id: string) =>
    setAttachedImages((cur) => cur.filter((a) => a.id !== id));

  // Open the full-quality version of an attachment in the zoom modal. We
  // keep full bytes off localStorage, so re-read from disk on click.
  const openZoom = async (att: { path: string; thumb: string }) => {
    try {
      setZoomImage(await fs.readImageDataUrl(att.path));
    } catch {
      // File gone (temp cleanup / old session) — fall back to the thumb.
      setZoomImage(att.thumb);
    }
  };

  // Register this panel as the chat drop-zone so App.tsx routes image drops
  // landing over it to appendImages instead of opening them as editor tabs.
  useEffect(() => {
    return registerChatDropZone({
      getRect: () => panelRef.current?.getBoundingClientRect() ?? null,
      onPaths: (paths) =>
        void appendImages(paths.map((path) => ({ kind: "path", path }))),
    });
  }, [appendImages]);

  // Esc closes the image zoom modal (click-outside also closes it).
  useEffect(() => {
    if (!zoomImage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomImage(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomImage]);

  const send = async () => {
    const text = input.trim();
    const imgs = attachedImages;
    if (!text && imgs.length === 0) return;
    if (streaming !== null || runningTools) {
      // Active turn — queue the text. The queue is text-only, so hold
      // images back rather than silently dropping them.
      if (imgs.length > 0) {
        toastInfo("Attendi la fine del turno per inviare le immagini");
        return;
      }
      setInput("");
      setHistoryIdx(null);
      historyDraftRef.current = "";
      pushQueue(text);
      return;
    }
    setInput("");
    setHistoryIdx(null);
    historyDraftRef.current = "";
    setAttachedImages([]);
    // A message that's images-only still needs a prompt for the model.
    const prompt =
      text || (imgs.length > 0 ? "Guarda le immagini allegate." : text);
    await sendUserText(prompt, messages, imgs);
  };

  // Option clicked on the docked AskUserQuestion card — the selection
  // goes out as a regular user message, which resumes the session.
  const answerQuestion = (text: string) => {
    if (!text) return;
    if (streaming !== null || runningTools) {
      pushQueue(text);
      return;
    }
    void sendUserText(text);
  };

  const sendQueuedNow = () => {
    if (queueRef.current.length === 0) return;
    abortRef.current?.abort();
  };

  const multitaskQueued = () => {
    const text = queueRef.current.shift();
    syncQueueUi();
    if (!text) return;
    const newChatId = addNewAIChat(wsId, "editor", defaultNewChatAnchor());
    queueMicrotask(() => {
      requestAIPrompt({ wsId, chatId: newChatId, text, send: true });
    });
  };

  // Claude Code slash commands: the CLI expands custom commands
  // (.claude/commands/*.md in the workspace) and several built-ins
  // server-side when they arrive as the prompt text. Discover the
  // custom ones so the slash dropdown can offer them; selecting one
  // sends it straight through instead of running a local action.
  const [ccCommands, setCcCommands] = useState<
    Array<{ name: string; hint: string }>
  >([]);
  const [modeMenuOpen, setModeMenuOpen] = useState(false);
  // Persist defaults for brand-new chats + publish mode to the overlay bridge.
  useEffect(() => {
    lsSetString(PERM_MODE_KEY, ccPermMode ?? "");
    setPermMode({ sessionId: claudeSessionId, cwd: root }, ccPermMode);
  }, [ccPermMode, claudeSessionId, root]);
  useEffect(() => {
    lsSetString(EFFORT_KEY, ccEffort);
  }, [ccEffort]);

  // Argument submenu for /effort, /mode and /thinking: once the command
  // name is complete ("/effort "), the slash window switches to the
  // VALUE list — click or Enter applies it directly, no typing needed.
  const slashArgMenu = ():
    | Array<{ name: string; hint: string; run: () => void }>
    | null => {
    if (!input.startsWith("/") || !input.includes(" ")) return null;
    const parts = input.split(/\s+/);
    const fw = parts[0].toLowerCase();
    const partial = (parts[1] ?? "").toLowerCase();
    if (fw === "/effort") {
      const opts: Array<[string, string]> = [
        ["low", "Fastest — minimal reasoning"],
        ["medium", "Balanced (default)"],
        ["high", "More reasoning"],
        ["xhigh", "Heavy reasoning"],
        ["max", "Maximum reasoning"],
      ];
      return opts
        .filter(([o]) => o.startsWith(partial))
        .map(([o, h]) => ({
          name: `/effort ${o}`,
          hint: h + (ccEffort === o ? "  ✓ current" : ""),
          run: () => applyCcEffort(o as CcEffort),
        }));
    }
    if (fw === "/mode") {
      const opts: Array<[string, string | null, string]> = [
        ["ask", null, "Confirm each edit / command"],
        ["plan", "plan", "Plan only — no edits"],
        ["auto-edit", "acceptEdits", "Auto-accept file edits, ask for the rest"],
        ["auto", "auto", "Run everything without asking (privacy guard stays)"],
        ["bypass", "bypassPermissions", "Skip all checks — no cards, no guard"],
      ];
      return opts
        .filter(([o]) => o.startsWith(partial))
        .map(([o, v, h]) => ({
          name: `/mode ${o}`,
          hint: h + (ccPermMode === v ? "  ✓ current" : ""),
          run: () => {
            setCcPermMode(v);
            toastInfo(`Mode: ${o} (applies from the next message)`);
          },
        }));
    }
    if (fw === "/thinking") {
      const opts: Array<[string, boolean | null, string]> = [
        ["on", true, "Force extended thinking on every turn"],
        ["off", false, "Disable extended thinking"],
        ["default", null, "Let Claude Code decide"],
      ];
      return opts
        .filter(([o]) => o.startsWith(partial))
        .map(([o, v, h]) => ({
          name: `/thinking ${o}`,
          hint: h + (ccThinking === v ? "  ✓ current" : ""),
          run: () => {
            setCcThinking(v);
            toastInfo(
              `Extended thinking: ${o} (applies from the next message)`,
            );
          },
        }));
    }
    return null;
  };
  const selectedIsCC =
    parseQualifiedModel(selected)?.providerId === "claude-code";
  useEffect(() => {
    if (!selectedIsCC || !root) {
      setCcCommands([]);
      return;
    }
    let cancelled = false;
    // Built-ins that meaningfully work through -p (prompt-expanding
    // commands, not interactive-UI ones like /login or /model).
    const builtins = [
      { name: "/compact", hint: "Claude Code — compact session context" },
      { name: "/init", hint: "Claude Code — generate CLAUDE.md" },
      { name: "/review", hint: "Claude Code — review a pull request" },
      {
        name: "/security-review",
        hint: "Claude Code — security review of current changes",
      },
      {
        name: "/pr-comments",
        hint: "Claude Code — fetch this branch's PR comments",
      },
    ];
    const scan = async () => {
      // Project commands win name collisions over user-level ones.
      const sources: Array<{ dir: string; hint: string }> = [
        { dir: `${root}/.claude/commands`, hint: "Claude Code — project command" },
      ];
      try {
        const { homeDir } = await import("@tauri-apps/api/path");
        const home = (await homeDir()).replace(/[\\/]+$/, "");
        sources.push({
          dir: `${home}/.claude/commands`,
          hint: "Claude Code — user command",
        });
      } catch {
        /* home dir unavailable — project scan still works */
      }
      const seen = new Set<string>();
      const custom: Array<{ name: string; hint: string }> = [];
      for (const src of sources) {
        try {
          const entries = await fs.listDir(src.dir);
          for (const e of entries) {
            if (e.is_dir || !e.name.endsWith(".md")) continue;
            const name = `/${e.name.replace(/\.md$/, "")}`;
            if (seen.has(name)) continue;
            seen.add(name);
            custom.push({ name, hint: src.hint });
          }
        } catch {
          /* directory doesn't exist — fine */
        }
      }
      if (!cancelled) setCcCommands([...custom, ...builtins]);
    };
    void scan();
    return () => {
      cancelled = true;
    };
  }, [selectedIsCC, root]);

  // Subagent catalog for @-mentions. Only Claude Code can dispatch
  // subagents (via its Task tool), so we skip the scan for other
  // providers and clear any stale list.
  useEffect(() => {
    if (!selectedIsCC || !root) {
      setAgents([]);
      setSkills([]);
      return;
    }
    let cancelled = false;
    void (async () => {
      let home: string | null = null;
      try {
        const { homeDir } = await import("@tauri-apps/api/path");
        home = (await homeDir()).replace(/[\\/]+$/, "");
      } catch {
        /* home unavailable — project agents/skills still load */
      }
      const [agentList, skillList] = await Promise.all([
        loadSubagents(root, home),
        loadSkills(root, home),
      ]);
      if (cancelled) return;
      setAgents(agentList);
      setSkills(skillList);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedIsCC, root]);

  // Combined slash matches: local commands first, then Claude Code
  // passthroughs. Used by both the dropdown render and the keyboard
  // navigation so they can't disagree.
  const slashMatchesFor = (q: string) => {
    const local = SLASH_COMMANDS.filter((c) =>
      c.name.slice(1).toLowerCase().startsWith(q),
    ).map((c) => ({
      kind: "local" as const,
      name: c.name,
      // /thinking's row IS the toggle — show the live state.
      hint:
        c.action === "thinking"
          ? `Extended thinking: ${
              ccThinking === null ? "CLI default" : ccThinking ? "ON" : "OFF"
            } — Enter toggles`
          : c.hint,
      cmd: c,
    }));
    const cc = ccCommands
      .filter(
        (c) =>
          c.name.slice(1).toLowerCase().startsWith(q) &&
          !local.some((l) => l.name === c.name),
      )
      .map((c) => ({
        kind: "cc" as const,
        name: c.name,
        hint: c.hint,
        cmd: undefined,
      }));
    // Skills (`/skill-name`) come last so the built-in commands stay on top.
    // Invoked exactly like a CC command — sent as the prompt → the CLI runs
    // the skill. Tagged "skill" so the row gets its own icon + colour.
    const sk = skills
      .filter((s) => {
        const name = `/${s.name}`;
        return (
          s.name.toLowerCase().startsWith(q) &&
          !local.some((l) => l.name === name) &&
          !cc.some((c) => c.name === name)
        );
      })
      .map((s) => ({
        kind: "skill" as const,
        name: `/${s.name}`,
        hint: s.description || "Skill",
        cmd: undefined,
      }));
    return [...local, ...cc, ...sk];
  };

  // Send a Claude Code slash command through as the prompt — the CLI
  // expands it. Keeps any arguments the user typed after the name.
  const sendCcCommand = (name: string) => {
    const text = input.trim().toLowerCase().startsWith(name.toLowerCase())
      ? input.trim()
      : name;
    setInput("");
    answerQuestion(text);
  };

  // A question is "pending" when the turn is over and the LAST message
  // is the assistant's with an AskUserQuestion call — answering (or
  // typing anything) appends a user message, which clears this. The
  // interactive card docks above the composer; the transcript shows a
  // compact one-line record. Retries produce identical calls — the
  // last one wins.
  // Keyed by call id so dismissing one question doesn't suppress the
  // next one Claude asks.
  const [dismissedAskId, setDismissedAskId] = useState<string | null>(null);
  const pendingAskCall = useMemo(() => {
    if (streaming !== null || runningTools) return null;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant" || !last.tool_calls) return null;
    const asks = last.tool_calls.filter(
      (c) => c.function.name === "AskUserQuestion",
    );
    const call = asks.length > 0 ? asks[asks.length - 1] : null;
    if (call && (call.id ?? "ask") === dismissedAskId) return null;
    return call;
  }, [messages, streaming, runningTools, dismissedAskId]);

  // @-mention candidates: subagents first (short, high-signal list),
  // then workspace files. Agents only appear with Claude Code (the
  // `agents` catalog is empty otherwise). Files match on the workspace-
  // relative path; the whole popover is capped at 8 rows.
  const mentionMatches = useMemo<MentionItem[]>(() => {
    if (!mentionState) return [];
    const q = mentionState.query.toLowerCase();
    const out: MentionItem[] = [];
    for (const a of agents) {
      if (q === "" || a.name.toLowerCase().includes(q)) {
        out.push({ type: "agent", agent: a });
        if (out.length >= 4) break;
      }
    }
    if (mentionFiles && root) {
      for (const f of mentionFiles) {
        const rel = relPath(f, root);
        if (q === "" || rel.toLowerCase().includes(q)) {
          out.push({ type: "file", abs: f, rel });
          if (out.length >= 8) break;
        }
      }
    }
    return out;
  }, [mentionState, mentionFiles, root, agents]);

  const acceptMention = (pick: MentionItem) => {
    if (!mentionState) return;
    // Splice the chosen token in place of the @query, leave a trailing
    // space so the user can keep typing without closing the segment.
    const token = pick.type === "agent" ? pick.agent.name : pick.rel;
    const before = input.slice(0, mentionState.start);
    const after = input.slice(mentionState.end);
    const next = `${before}@${token}${after.startsWith(" ") ? "" : " "}${after}`;
    setInput(next);
    setMentionState(null);
    setMentionIndex(0);
    if (pick.type === "agent") {
      setAttachedAgents((prev) =>
        prev.includes(pick.agent.name) ? prev : [...prev, pick.agent.name],
      );
    } else {
      addAttachedFile(pick.abs, root);
    }
    // Restore focus + place cursor after the inserted token so the
    // user can keep typing without clicking back into the textarea.
    requestAnimationFrame(() => {
      const el = inputRef.current;
      if (!el) return;
      const cursor = mentionState.start + 1 + token.length + 1;
      el.focus();
      try {
        el.setSelectionRange(cursor, cursor);
      } catch {
        /* ignore */
      }
    });
  };

  const citeFileFromDrop = useCallback(
    (absPath: string) => {
      const rel = relPath(absPath, root);
      if (!rel) return;
      const el = inputRef.current;
      const cursor = el?.selectionStart ?? input.length;
      const before = input.slice(0, cursor);
      const after = input.slice(cursor);
      const needsSpace = before.length > 0 && !/\s$/.test(before);
      const prefix = needsSpace ? " " : "";
      const token = `@${rel} `;
      setInput(`${before}${prefix}${token}${after}`);
      addAttachedFile(absPath, root);
      requestAnimationFrame(() => {
        const target = inputRef.current;
        if (!target) return;
        const pos = cursor + prefix.length + token.length;
        target.focus();
        try {
          target.setSelectionRange(pos, pos);
        } catch {
          /* ignore */
        }
      });
    },
    [input, root, addAttachedFile],
  );

  useEffect(() => registerComposerFileDrop({ onFile: citeFileFromDrop }), [
    citeFileFromDrop,
  ]);

  useEffect(() => subscribeComposerFileDropHover(setFileDropHover), []);

  // The subagent pill's "active" target is DERIVED from attachedAgents (the
  // delegation source of truth) — no parallel state. The last-added agent is
  // the one shown; null means the message goes to Jack (the default).
  const activeAgent =
    attachedAgents.length > 0
      ? (agents.find(
          (a) => a.name === attachedAgents[attachedAgents.length - 1],
        ) ?? null)
      : null;
  const selectAgent = (agent: SubagentDef | null) => {
    if (!agent) {
      setAttachedAgents([]);
      return;
    }
    setAttachedAgents((prev) =>
      prev.includes(agent.name) ? prev : [...prev, agent.name],
    );
  };

  // Editor right-click "Ask AI to …" actions land here. The bus
  // delivers a pre-composed prompt; we drop it into the composer,
  // focus, and optionally fire it. Held in a ref so the subscription
  // sees the latest sendUserText / queue state on every event without
  // having to re-subscribe each render.
  const handleExternalPromptRef = useRef<(text: string, immediate: boolean) => void>(() => {});
  handleExternalPromptRef.current = (text: string, immediate: boolean) => {
    if (!immediate) {
      setInput(text);
      // Wait a frame so React has rendered the textarea before we focus.
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    setInput("");
    if (streaming !== null || runningTools) {
      pushQueue(text);
      return;
    }
    void sendUserText(text);
  };

  useEffect(() => {
    return onAIPromptRequest((req) => {
      if (req.wsId !== wsId) return;
      if (req.chatId && req.chatId !== aiChatId) return;
      handleExternalPromptRef.current(req.text, req.send);
    });
  }, [wsId, aiChatId]);

  const sendUserText = async (
    text: string,
    baseMessages: ChatMessage[] = messages,
    images: ImageAttachment[] = [],
  ) => {
    if ((!text && images.length === 0) || !selected) return;
    // `liveTurnRef` is cleared synchronously in `finally` before
    // drainQueue runs — unlike React `streaming` state, which can still
    // read `""` (between tool rounds) or `null` (stale) in the
    // closure and re-queue forever inside drainQueue's old `while`.
    if (liveTurnRef.current) {
      pushQueue(text);
      return;
    }
    cancelBackgroundWake();
    // Mark the live loop as the stream's owner so the attach effect
    // can't subscribe a duplicate consumer (cleared in the finally).
    liveTurnRef.current = true;

    // Cross-chat hard-cap check. Per-workspace budget takes precedence
    // (if one is set on this workspace), then the global cap. The
    // permission overlay's privacy gate runs separately.
    const cap = wouldExceedHardCap(0, wsId);
    if (cap.exceeds) {
      const scope =
        cap.scope === "workspace"
          ? "Workspace AI cap"
          : "Monthly AI hard cap";
      toastError(
        `🛑 ${scope} reached: $${cap.current.toFixed(2)} / $${cap.cap.toFixed(2)}. Raise it in Settings → AI Usage Dashboard to send.`,
      );
      return;
    }

    // Compose context: active file path + (when reasonable) its content.
    const ws = useStore.getState().loaded[wsId];
    const ap = ws?.layout.activePaneId
      ? findPaneById(ws.layout.editorRoot, ws.layout.activePaneId)
      : null;
    const activeKey = ap && ap.kind === "tabs" ? ap.active : null;
    const parsed = activeKey ? parseKey(activeKey) : null;
    const sysParts: string[] = [
      [
        // Jack = il PM-papero, persona con cui Alek dialoga (Quack v1 identity)
        "You are Jack, the project manager and coding agent embedded in Quack, a desktop code editor.",
        "Speak as Jack — warm, direct, hands-on. When you greet or introduce yourself, do so as Jack (never invent another name).",
        "The user has a workspace open and you are running with the workspace root as the current working directory.",
        "",
        "OPERATING PRINCIPLES",
        "- Investigate before answering. Ground every claim in real code — never guess at file paths, function names, or APIs.",
        "- Read enough context to be useful. For non-trivial questions read 5+ relevant files before responding; for quick questions one file is fine.",
        "- Run tools in parallel whenever they're independent (multiple reads, multiple greps in one turn).",
        "- When changing code, keep edits minimal and focused on what the user asked. Don't refactor surrounding code, don't add speculative features, don't invent new abstractions.",
        "- Default to no comments. Add a comment only when WHY is non-obvious.",
        "- If something isn't in the codebase or you don't know it, say so — don't fabricate.",
        "",
        "COMMUNICATION",
        "- Reply in concise prose with markdown formatting. Reference files using `path:line` format so they're clickable.",
        "- Match response length to the question: a one-line question gets a one-line answer, not headers and sections.",
        "- For multi-step work, give brief progress updates between tool batches.",
        "- End with what changed and what's next, in 1-2 sentences. Skip long recaps.",
        "",
        "BRAIN (Pinky)",
        "- Pre-turn [Pinky Brain] hits may already answer — Read documentation/<path> before broad Explore/Grep.",
        "- After non-trivial discovery (many greps, scattered config, infra gotcha) not well documented, propose saving for next time at the END of your reply:",
        "",
        "[Brain save]",
        "title: Short title",
        "type: gotcha|pattern|decision|note|guide",
        "tags: comma, separated",
        "reason: Why this was hard to find (one line)",
        "---",
        "## Title",
        "Markdown body",
        "[/Brain save]",
        "",
        "The UI shows Save/Dismiss — do not write the file yourself unless the user asks.",
        "",
        "SAFETY",
        "- Confirm before destructive actions (rm, dropping branches, force-push, deleting data).",
        "- Don't push, deploy, or send messages to external systems without explicit user approval.",
      ].join("\n"),
    ];
    // Auto-attach the project tree when:
    //   1. The user explicitly typed /tree (attachTree flag), OR
    //   2. This is the first message of a new chat (so the model gets oriented), OR
    //   3. The user's text mentions the codebase/project at a high level.
    const isFirstMessage = baseMessages.length === 0;
    const codebaseRegex =
      /\b(codebase|project|repo|repository|files?|folders?|directories|directory|structure|architecture|layout)\b/i;
    const mentionsCodebase = codebaseRegex.test(text);
    const shouldAttachTree =
      attachTree || isFirstMessage || mentionsCodebase;
    // Provider-aware context strategy:
    //   - claude-code: skip inlining entirely. Claude Code has its own
    //     filesystem tools (Read/Glob/Grep) and reads what it needs. It
    //     also runs in the workspace cwd, so it can navigate without help.
    //   - openai/anthropic API: skip inlining the tree. Frontier models
    //     reliably call list_files when they need it. Saves tokens.
    //   - ollama: inline the tree (small models often won't tool-call).
    const selectedParsed = parseQualifiedModel(selected);
    const selectedProvider = selectedParsed?.providerId ?? "ollama";
    const isFirstUserTurn = !baseMessages.some((m) => m.role === "user");
    if (
      isAgenticProviderId(selectedProvider) &&
      isFirstUserTurn &&
      !pinnedProviderId
    ) {
      setPinnedProviderId(selectedProvider);
    }
    if (
      images.length > 0 &&
      selectedProvider === "opencode-cli" &&
      selectedParsed
    ) {
      const meta =
        allModels.find(
          (m) =>
            m.providerId === "opencode-cli" &&
            m.modelId === selectedParsed.modelId,
        ) ??
        allCloudCatalog.find(
          (m) =>
            m.providerId === "opencode-cli" &&
            m.modelId === selectedParsed.modelId,
        );
      if (meta?.supportsVision === false) {
        toastError(
          "This OpenCode model does not support image input. Pick a vision-capable model or remove the attachments.",
        );
        liveTurnRef.current = false;
        return;
      }
    }
    const providerRunsOwnTools = isAgenticProviderId(selectedProvider);
    const providerCanReadItself =
      providerRunsOwnTools ||
      selectedProvider === "openai" ||
      selectedProvider === "anthropic";

    // Inline the project tree into the user's message rather than as a
    // synthetic tool round-trip. Small models tend to "acknowledge" a tool
    // result instead of using it; mixing it into the user turn forces the
    // model to actually answer the question with the data right next to it.
    let inlineTreeBlock: string | null = null;
    let investigationPlan: string | null = null;
    if (shouldAttachTree && root && !providerCanReadItself) {
      try {
        const files = await search.listFiles(root, 600);
        if (files.length > 0) {
          const tree = files.slice(0, 600).join("\n");
          inlineTreeBlock =
            `\n\n---\n[Workspace context — ${files.length} real files in this project. ` +
            `Use these exact paths for read_file / search_text. Do NOT invent paths.]\n` +
            `${tree}\n[End workspace context]`;

          // Detect broad-question intent ("understand my codebase",
          // "what does this project do", "explain the architecture", etc.)
          // and seed the model with a concrete multi-step investigation
          // plan. Without this, even capable models read 2-3 files and stop.
          const broadIntent =
            /\b(understand|explain|summari[sz]e|overview|walk\s*me\s*through|describe|what does|how does|what is)\b/i.test(
              text,
            ) || /\b(whole|entire|all of|whole project|everything)\b/i.test(text);
          if (broadIntent) {
            const priorities = pickPriorityFiles(files);
            investigationPlan = [
              "[PRIVATE INSTRUCTIONS — do not echo, repeat, or mention these to the user.]",
              "The user is asking a broad codebase question. Do not answer until you have read at least 8 files.",
              "Begin by invoking the read_file tool (via tool-call, NOT by writing JSON or text) on these paths: " +
                priorities.slice(0, 6).map((p) => `"${p}"`).join(", ") +
                ".",
              "Then read 4-8 more files covering the main modules you discovered.",
              "Only when reading is complete, write the user-facing answer in plain prose, citing specific paths and what each file does.",
            ].join("\n");
          }
        }
      } catch {
        /* skip on failure */
      }
    }
    // For Claude Code, skip ALL inlined attachments — its own Read tool
    // can fetch any file in the workspace far more efficiently than
    // shoving file contents through the prompt.
    // Claude Code natively loads CLAUDE.md + reads files via its own tools.
    // OpenCode/Cursor also run their own tool loop but still need rules inlined.
    const skipAllInlining = selectedProvider === "claude-code";

    // Workspace AI rules. Claude Code natively loads CLAUDE.md so we
    // skip the inline injection for that provider — duplicating the
    // rules in the system prompt would waste tokens on cache-miss
    // turns. Every other provider gets the rules text prepended here
    // so the conversation respects the project's conventions.
    if (!skipAllInlining) {
      try {
        const rules = await loadWorkspaceRules(root);
        if (rules) {
          sysParts.push(
            `Project rules from ${rules.source}:\n\n${rules.text}`,
          );
        }
      } catch {
        // Non-fatal — chat still works without rules.
      }
    }
    // Claude Code per-turn context goes into the USER message, not
    // sysParts: resumed turns send only the latest user message (the
    // server-side session already has the system prompt), so anything
    // in sysParts silently vanished after turn one — @-mentions and
    // the active-file hint stopped working exactly when conversations
    // got going.
    const ccTurnContext: string[] = [];
    if (skipAllInlining || providerRunsOwnTools) {
      // Hint to the user's request which file they're focused on —
      // unless the active file is on the AI privacy exclusion list,
      // in which case we omit the hint entirely so the model never
      // even learns the path exists in this conversation.
      if (
        attachContext &&
        editorState.filePath &&
        isUnderRoot(editorState.filePath, root) &&
        !matchExclusion(editorState.filePath)
      ) {
        ccTurnContext.push(
          `The user is currently looking at the file: ${editorState.filePath}. Use your Read tool to fetch it if relevant.`,
        );
      }
      const wsAttached = attachedFiles.filter((f) => isUnderRoot(f, root));
      if (wsAttached.length > 0) {
        ccTurnContext.push(
          `The user wants you to look at: ${wsAttached.join(", ")}. Use your Read tool on these.`,
        );
      }
      // Image attachments — provider-specific delivery:
      // CC/Cursor: paths in turn context (Read / file tools).
      // OpenCode: FilePart via HTTP API (see openCodeProvider.chat).
      if (images.length > 0) {
        const paths = images.map((i) => i.path).join(", ");
        if (selectedProvider === "claude-code") {
          ccTurnContext.push(
            `The user attached ${images.length} image${images.length === 1 ? "" : "s"} to this message. ` +
              `View ${images.length === 1 ? "it" : "them"} with your Read tool: ${paths}.`,
          );
        } else if (selectedProvider === "cursor-cli") {
          ccTurnContext.push(
            `The user attached ${images.length} image${images.length === 1 ? "" : "s"}. ` +
              `Analyze ${images.length === 1 ? "it" : "them"} using your tools: ${paths}.`,
          );
        } else if (selectedProvider === "opencode-cli") {
          ccTurnContext.push(
            `The user attached ${images.length} image${images.length === 1 ? "" : "s"} to this message.`,
          );
        }
      }
      // @-mentioned subagents: instruct Claude Code to delegate this turn
      // to them via the Task tool. Only CC reaches this branch, and the
      // agent catalog is CC-only, so attachedAgents is empty elsewhere.
      if (attachedAgents.length > 0) {
        ccTurnContext.push(
          `Delegate this task to the following subagent(s): ${attachedAgents.join(", ")}. ` +
            `Use your Task tool with the matching subagent_type for each — prefer them over handling it yourself.`,
        );
      }
      // /terminal for Claude Code: it can't see Codetta's terminal
      // scrollback through its own Bash tool (different PTY), so this
      // is the one piece of context that must be inlined.
      if (attachTerminal) {
        const wsLatest = useStore.getState().loaded[wsId];
        const terms = wsLatest ? Object.values(wsLatest.terminals) : [];
        const t = terms[terms.length - 1];
        if (t?.ptyId) {
          try {
            const buf = await pty.getBuffer(t.ptyId);
            const trimmed = buf.length > 8000 ? buf.slice(-8000) : buf;
            ccTurnContext.push(
              `Recent output from the editor terminal "${t.title ?? "Terminal"}":\n\`\`\`\n${trimmed}\n\`\`\``,
            );
          } catch {
            /* skip */
          }
        }
      }
    }
    // /file <path> attaches the contents of the named file.
    // Skip files that match the AI privacy exclusion list — never
    // inline excluded contents into the prompt, even when the user
    // explicitly typed /file (defence-in-depth: a typo or muscle-
    // memory shouldn't leak secrets).
    const wsAttached = attachedFiles.filter((f) => isUnderRoot(f, root));
    for (const filePath of skipAllInlining ? [] : wsAttached) {
      try {
        const abs =
          filePath.includes(":") || filePath.startsWith("/")
            ? filePath
            : `${root}/${filePath}`.replace(/\\/g, "/");
        const matched = matchExclusion(abs);
        if (matched) {
          toastError(
            `🛡 Skipped ${filePath} — matches privacy exclusion "${matched}"`,
          );
          continue;
        }
        const content = await fs.readFile(abs);
        const trimmed =
          content.length > 12000
            ? content.slice(0, 12000) + "\n…[truncated]"
            : content;
        sysParts.push(`Contents of ${filePath}:\n\`\`\`\n${trimmed}\n\`\`\``);
      } catch {
        /* skip files that don't exist */
      }
    }
    // /terminal attaches the active terminal's recent output.
    if (attachTerminal && !skipAllInlining) {
      const wsLatest = useStore.getState().loaded[wsId];
      const terms = wsLatest ? Object.values(wsLatest.terminals) : [];
      const t = terms[terms.length - 1];
      if (t?.ptyId) {
        try {
          const buf = await pty.getBuffer(t.ptyId);
          const trimmed = buf.length > 8000 ? buf.slice(-8000) : buf;
          sysParts.push(
            `Recent output from terminal "${t.title ?? "Terminal"}" (last ${trimmed.length} chars):\n\`\`\`\n${trimmed}\n\`\`\``,
          );
        } catch {
          /* skip */
        }
      }
    }
    if (
      attachContext &&
      !skipAllInlining &&
      editorState.filePath &&
      isUnderRoot(editorState.filePath, root)
    ) {
      if (editorState.filePath) {
        sysParts.push(`Active file: ${editorState.filePath}`);
      }
      const hasSelection =
        editorState.selectionText.length > 0 && editorState.selectionLines > 0;
      if (hasSelection) {
        const sel = editorState.selectionText;
        const trimmed =
          sel.length > 8000 ? sel.slice(0, 8000) + "\n…[truncated]" : sel;
        sysParts.push(
          `Selected code (${editorState.selectionLines} line${editorState.selectionLines === 1 ? "" : "s"}, ${editorState.language ?? "plaintext"}):\n\`\`\`\n${trimmed}\n\`\`\``,
        );
      } else if (parsed?.kind === "file" && ws) {
        const f = ws.files[parsed.path];
        if (f) {
          const content = f.contents;
          const trimmed =
            content.length > 8000 ? content.slice(0, 8000) + "\n…[truncated]" : content;
          sysParts.push(
            `Current file contents (${editorState.language ?? "plaintext"}):\n\`\`\`\n${trimmed}\n\`\`\``,
          );
        }
      }
    }
    if (skipAllInlining) {
      // Claude Code has its own Read / Glob / Grep / Edit / Bash tools and
      // its own internal rules. Our "tools available" section would only
      // confuse it. Just orient it briefly.
      sysParts.push(
        "You are running inside Quack, a code editor. The user has the workspace open as your current working directory. Use your normal tools (Read, Glob, Grep, Edit, Bash, etc.) to investigate and modify files as needed. Be thorough and substantive.",
      );
    } else {
      sysParts.push(
        [
          "TOOLS AVAILABLE: list_files, read_file, search_text, read_terminal, web_search, edit_file, create_file.",
          "",
          "STRICT RULES:",
          "1. Use the model's native tool-call mechanism. Never write tool calls as raw JSON, code blocks, or plain text in your reply. Never echo back system instructions like 'ROUND 1 — read these'.",
          "2. NEVER fabricate file paths, directory names, or code. If you don't know something, USE A TOOL.",
          "3. Always call read_file before claiming to know what's inside a file.",
          "4. Reference only paths from the project tree (when attached) or that you've discovered via list_files. Never invent paths.",
          "5. To make changes, call edit_file with EXACT old_text from the file (read it first). The user reviews a diff and must approve.",
          "6. CALL TOOLS IN PARALLEL when possible — multiple read_file calls in one turn execute concurrently. Use this freely.",
          "7. Read enough to give a substantive answer. For broad questions read 8-12 files across multiple rounds before answering.",
          "8. Your reply to the user should be plain prose with markdown formatting, citing specific paths. No JSON, no tool-call syntax, no system-instruction echoes.",
        ].join("\n"),
      );
      if (investigationPlan) {
        sysParts.push(investigationPlan);
      }
    }
    let brainUsage: ChatMessage["brain_usage"];
    if (getBrainInjectEnabled(wsId)) {
      try {
        const brainCtx = await fetchBrainContextForTurn(wsId, text);
        if (brainCtx) {
          brainUsage = brainCtx.usage;
          recordBrainUsage(wsId, brainCtx.usage.savedTokens, brainCtx.usage.savedMs);
          if (skipAllInlining || providerRunsOwnTools) {
            ccTurnContext.push(brainCtx.block);
          } else {
            sysParts.push(brainCtx.block);
          }
        }
      } catch {
        /* Pinky optional — never block the turn */
      }
    }
    appendJackUserPreferences(sysParts);

    // Display the user's bare text in the chat — but send an augmented
    // version (with the inline tree / per-turn editor context) to the
    // model.
    const displayUserMsg: ChatMessage = {
      role: "user",
      content: text,
      ...(brainUsage ? { brain_usage: brainUsage } : {}),
      // Persist only path + name + tiny thumb (not full bytes) so the chat
      // can re-render the inline preview after reload without bloating
      // localStorage; the zoom modal re-reads full quality from disk.
      ...(images.length > 0
        ? {
            images: images.map((i) => ({
              path: i.path,
              name: i.name,
              thumb: i.thumb,
            })),
          }
        : {}),
    };
    const ccPrefix =
      ccTurnContext.length > 0
        ? `[Editor context]\n${ccTurnContext.join("\n\n")}\n[/Editor context]\n\n`
        : "";
    const sentUserMsg: ChatMessage = {
      role: "user",
      content: ccPrefix + (inlineTreeBlock ? text + inlineTreeBlock : text),
    };
    const conversation: ChatMessage[] = [
      { role: "system", content: sysParts.join("\n\n") },
      ...baseMessages,
      sentUserMsg,
    ];
    pinActiveRef.current = true;
    stickyBottomRef.current = false;
    flushSync(() => {
      setMessages([...baseMessages, displayUserMsg]);
      setStreaming("");
    });
    const scroller = scrollRef.current;
    if (scroller) {
      pinUserTurnToTop(scroller);
      stickyBottomRef.current = isNearBottom(scroller);
      setShowJumpToBottom(!stickyBottomRef.current);
    }
    abortRef.current = new AbortController();

    // Claude Code runs its own internal tool loop (Read/Glob/Edit/Bash/etc.).
    // The tool_use blocks it streams are informational — they show what it
    // ALREADY did, not requests for us to execute. So for that provider we
    // skip our N-round tool-execution loop and just stream once.
    const isAgenticProvider = providerRunsOwnTools;
    const MAX_ROUNDS = isAgenticProvider ? 1 : 8;

    // Snapshot every open buffer's contents BEFORE the turn fires so
    // the ComposeCard's "Revert all" button can roll back changes if
    // the user doesn't like them. Keyed by the index where the next
    // assistant message will land (= current messages length, since
    // we just pushed the user message).
    if (isAgenticProvider) {
      const wsState = useStore.getState().loaded[wsId];
      if (wsState?.files) {
        // Pending assistant message lands at baseMessages.length + 1
        // (user msg pushed in this turn + assistant about to land).
        captureSnapshot(
          wsId,
          aiChatId,
          baseMessages.length + 1,
          wsState.files,
        );
      }
    }
    try {
      const knownToolNames = new Set(TOOLS.map((t) => t.function.name));
      for (let round = 0; round < MAX_ROUNDS; round++) {
        let acc = "";
        const toolCallsThisRound: ToolCall[] = [];
        // Ordered chronological log of "what arrived when," used by
        // the renderer to show text → tool → text → tool in real
        // sequence instead of the legacy "all text first, all tools
        // second." Text deltas merge with the previous text block
        // when adjacent so 200 deltas don't become 200 markdown
        // bubbles.
        const blocksThisRound: NonNullable<ChatMessage["blocks"]> = [];
        // Some providers (Claude Code stream-json) surface the same
        // tool_use twice — once in a partial message, once in the final.
        // Processing it twice double-rendered every Edit row AND ran
        // TaskCreate/TaskUpdate twice (the duplicated checklist). Track
        // ids we've already handled this round and skip repeats.
        const seenToolCallIds = new Set<string>();
        const appendTextBlock = (text: string) => {
          if (!text) return;
          const last = blocksThisRound[blocksThisRound.length - 1];
          if (last && last.kind === "text") {
            last.text += text;
          } else {
            blocksThisRound.push({ kind: "text", text });
          }
          // Mirror to React state so the live bubble re-renders.
          setStreamingBlocks([...blocksThisRound]);
        };
        // Tool results emitted by an agentic provider (Claude Code) for
        // calls it executed itself. Paired with toolCallsThisRound by
        // tool_use_id at the end of the round and attached to the
        // assistant message so the chat UI can render them.
        const toolResultsThisRound: Array<{
          tool_use_id: string;
          content: string;
          is_error?: boolean;
        }> = [];
        let firstTokenAt: number | null = null;
        const startedAt = performance.now();
        // Reset on each new round so the "still working" timer doesn't
        // anchor to a previous turn.
        setLastStreamEventAt(Date.now());
        for await (const ev of chatStream(
          selected,
          conversation,
          abortRef.current.signal,
          TOOLS,
          // Only pass resumeSessionId when we're on Claude Code AND we
          // already have one captured from a prior turn in this chat.
          // Other providers ignore this param.
          providerSessionIds[selectedProvider],
          // chatSessionId tags the in-flight stream in the Rust buffer
          // so a frontend refresh can re-attach via attachToChat().
          selectedProvider === "claude-code" ? sessionId : undefined,
          // THIS chat's workspace root — not whichever workspace is
          // active when the turn fires (multi-workspace isolation).
          root,
          // Per-chat /effort, /mode and /thinking knobs (Claude Code only).
          selectedProvider === "claude-code" ? ccEffort : undefined,
          selectedProvider === "claude-code"
            ? (ccPermMode ?? undefined)
            : undefined,
          selectedProvider === "claude-code"
            ? (ccThinking ?? undefined)
            : undefined,
          selectedProvider === "opencode-cli" && images.length > 0
            ? images.map((i) => ({ path: i.path, name: i.name }))
            : undefined,
        )) {
          // Any event from the provider is a sign of life — reset the
          // staleness timer so the "still working" badge only fires
          // when the stream really has gone quiet for a while.
          setLastStreamEventAt(Date.now());
          if (ev.kind === "session") {
            // Captured the Claude Code session id — store it so the next
            // turn passes --resume <id> and avoids re-flattening history.
            setProviderSessionIds((prev) =>
              setProviderSessionId(prev, selectedProvider, ev.id),
            );
            continue;
          }
          if (ev.kind === "usage") {
            setLastUsage({
              cost: ev.cost,
              durationMs: ev.durationMs,
              model: ev.model,
              tokens: ev.tokens,
              contextTokens: ev.contextTokens,
            });
            if (ev.contextTokens) setLiveContextTokens(ev.contextTokens);
            // Append to the cross-chat usage log so the dashboard +
            // monthly hard cap have data to work with. Skipped if
            // the turn was free (Ollama, subscription Claude Code).
            // The prompt itself is only persisted when the user has
            // opted in via Settings → AI Usage → "Log prompt text".
            recordUsage({
              provider: selectedProvider,
              model: ev.model ?? selected,
              costUsd: typeof ev.cost === "number" ? ev.cost : 0,
              tokensIn:
                (ev.tokens?.input ?? 0) + (ev.tokens?.cacheRead ?? 0),
              tokensOut: ev.tokens?.output ?? 0,
              wsId,
              chatId: aiChatId,
              prompt: text,
            });
            // Roll into the per-chat running total. Triggers a
            // budget-warning toast the first time we cross the
            // user's configured threshold (resets per chat).
            if (typeof ev.cost === "number" && ev.cost > 0) {
              setChatTotalCost((prev) => {
                const next = prev + ev.cost!;
                const budget = readBudgetUsd();
                if (
                  budget > 0 &&
                  prev < budget &&
                  next >= budget &&
                  !budgetWarned
                ) {
                  setBudgetWarned(true);
                  toastError(
                    `Chat budget reached: $${next.toFixed(4)} / $${budget.toFixed(2)}. Future turns will keep adding cost — start a new chat or stop to cap spend.`,
                  );
                }
                return next;
              });
            }
            // Roll cumulative token counters for the session drawer.
            if (ev.tokens) {
              setCumulativeTokensIn((p) => p + (ev.tokens?.input ?? 0));
              setCumulativeTokensOut((p) => p + (ev.tokens?.output ?? 0));
              setCumulativeCacheRead((p) => p + (ev.tokens?.cacheRead ?? 0));
            }
            setCumulativeTurns((p) => p + 1);
            continue;
          }
          if (ev.kind === "context_snapshot") {
            setLiveContextTokens(ev.tokens);
            continue;
          }
          if (ev.kind === "content") {
            // Empty content events are keep-alive pings (e.g. extended-
            // thinking deltas in the Claude Code provider). They keep
            // the staleness watchdog at the top of the loop fed but
            // don't represent visible tokens — skip the rest of the
            // accounting so they don't anchor firstTokenAt to the
            // wrong moment and tank the t/s display.
            if (ev.text.length === 0) continue;
            if (firstTokenAt === null) {
              firstTokenAt = performance.now();
            }
            acc += ev.text;
            appendTextBlock(ev.text);
            setStreaming(acc);
            // Approximate tokens/sec: ~4 chars per token on average.
            const elapsedSec = (performance.now() - firstTokenAt) / 1000;
            if (elapsedSec > 0.5) {
              setTokensPerSec(acc.length / 4 / elapsedSec);
            }
          } else if (ev.kind === "tool_call") {
            // Skip a re-emitted tool_use: same id already handled this
            // round. Prevents double rows + double TaskCreate/TaskUpdate.
            if (ev.call.id && seenToolCallIds.has(ev.call.id)) {
              continue;
            }
            if (ev.call.id) seenToolCallIds.add(ev.call.id);
            toolCallsThisRound.push(ev.call);
            setStreamingToolCalls([...toolCallsThisRound]);
            if (ev.call.id) {
              blocksThisRound.push({ kind: "tool_call", callId: ev.call.id });
              setStreamingBlocks([...blocksThisRound]);
            }
            // Snapshot TodoWrite into the sticky checklist state so the
            // user gets a live planning view as the agent progresses.
            if (
              ev.call.function.name === "TodoWrite" &&
              Array.isArray(ev.call.function.arguments.todos)
            ) {
              const raw = ev.call.function.arguments.todos as unknown[];
              const cleaned = raw
                .filter(
                  (t): t is Record<string, unknown> =>
                    !!t && typeof t === "object",
                )
                .map((t) => ({
                  content:
                    typeof t.content === "string" ? t.content : "(untitled)",
                  status:
                    t.status === "in_progress" || t.status === "completed"
                      ? (t.status as "in_progress" | "completed")
                      : ("pending" as const),
                  activeForm:
                    typeof t.activeForm === "string" ? t.activeForm : undefined,
                }));
              setTodos(cleaned);
            }
            // TaskCreate / TaskUpdate drive the same sticky checklist:
            // created tasks appear as pending checkboxes the moment the
            // call streams in, updates flip their status live.
            if (ev.call.function.name === "TaskCreate") {
              const a = ev.call.function.arguments;
              const subject =
                typeof a.subject === "string" && a.subject
                  ? a.subject
                  : typeof a.description === "string" && a.description
                    ? a.description
                    : "(task)";
              const taskId = String(++taskCounterRef.current);
              setTodos((prev) => {
                const next = [...(prev ?? [])];
                taskIndexRef.current.set(taskId, next.length);
                next.push({
                  content: subject,
                  status: "pending" as const,
                  activeForm:
                    typeof a.activeForm === "string"
                      ? a.activeForm
                      : undefined,
                });
                return next;
              });
            }
            if (ev.call.function.name === "TaskUpdate") {
              const a = ev.call.function.arguments;
              const taskId =
                typeof a.taskId === "string"
                  ? a.taskId
                  : typeof a.task_id === "string"
                    ? a.task_id
                    : a.taskId != null
                      ? String(a.taskId)
                      : "";
              const idx = taskIndexRef.current.get(taskId);
              if (idx !== undefined) {
                setTodos((prev) => {
                  if (!prev || !prev[idx]) return prev;
                  const next = [...prev];
                  const cur = { ...next[idx] };
                  const st = a.status;
                  if (
                    st === "pending" ||
                    st === "in_progress" ||
                    st === "completed"
                  ) {
                    cur.status = st;
                  } else if (st === "cancelled" || st === "deleted") {
                    // The 3-state checklist has no cancelled lane;
                    // checked-off is the closest honest rendering.
                    cur.status = "completed";
                  }
                  if (typeof a.subject === "string" && a.subject) {
                    cur.content = a.subject;
                  }
                  next[idx] = cur;
                  return next;
                });
              }
            }
            // Live-surface the tool call in the status strip so the user
            // sees what's happening during long agentic streams (Claude
            // Code may emit many tool_use blocks before any text content).
            const args = ev.call.function.arguments;
            const name = ev.call.function.name;
            const detail = toolDetailFor(name, args);
            // Preview: short snippet of the change so the user sees what's
            // landing without scrolling. For Edit/MultiEdit show the new
            // text, for Write show the content, for Bash echo the command.
            let preview: string | undefined;
            if (name === "Edit" && typeof args.new_string === "string") {
              preview = args.new_string;
            } else if (
              name === "MultiEdit" &&
              Array.isArray(args.edits) &&
              args.edits.length > 0
            ) {
              const first = args.edits[0] as Record<string, unknown>;
              if (typeof first.new_string === "string") preview = first.new_string;
            } else if (name === "Write" && typeof args.content === "string") {
              preview = args.content;
            } else if (name === "Bash" && typeof args.command === "string") {
              preview = args.command;
            }
            const entry = {
              id: ev.call.id,
              name,
              detail,
              preview,
              status: "running" as const,
            };
            setActiveToolLabels((labels) => {
              const next = labels.slice(-9);
              next.push(entry);
              return next;
            });
            setRunningTools(true);
          } else if (ev.kind === "tool_result") {
            // Agentic providers (Claude Code) ran the tool themselves
            // and report the result. Flip the matching activeToolLabels
            // entry to "done" so the user can see WHICH calls actually
            // finished (was a misleading 10-spinners-forever otherwise).
            setActiveToolLabels((labels) => {
              const match = labels.find(
                (l) => l.id && l.id === ev.tool_use_id,
              );
              const next = labels.map((l) =>
                l.id && l.id === ev.tool_use_id
                  ? {
                      ...l,
                      status: (ev.is_error ? "error" : "done") as
                        | "error"
                        | "done"
                        | "running",
                    }
                  : l,
              );
              if (match) {
                inspectBashToolResult({
                  wsId,
                  sessionId,
                  root,
                  toolName: match.name,
                  cmd: match.preview,
                  output: ev.content,
                  isError: ev.is_error === true,
                });
              }
              return next;
            });
            // Stash for attachment to the assistant message at end of round.
            toolResultsThisRound.push({
              tool_use_id: ev.tool_use_id,
              content: ev.content,
              is_error: ev.is_error,
            });
            setStreamingToolResults([...toolResultsThisRound]);
          }
        }
        // Record final speed for the slow-model banner heuristic.
        if (firstTokenAt !== null) {
          const elapsedSec = (performance.now() - firstTokenAt) / 1000;
          if (elapsedSec > 1 && acc.length > 40) {
            const tps = acc.length / 4 / elapsedSec;
            setRecentTps((prev) =>
              prev === null ? tps : prev * 0.5 + tps * 0.5,
            );
          }
        }
        void startedAt;
        // Fallback: some models emit tool calls as JSON inside the content
        // stream instead of using Ollama's native tool_calls field. Detect
        // and lift them out before showing the message to the user.
        let visibleContent = acc;
        if (toolCallsThisRound.length === 0 && acc.includes("{")) {
          const parsed = parseInlineToolCalls(acc, knownToolNames);
          if (parsed.calls.length > 0) {
            toolCallsThisRound.push(...parsed.calls);
            visibleContent = parsed.remaining;
          }
        }
        const assistantMsg: ChatMessage = {
          role: "assistant",
          content: visibleContent,
          tool_calls:
            toolCallsThisRound.length > 0 ? toolCallsThisRound : undefined,
          tool_results:
            toolResultsThisRound.length > 0
              ? toolResultsThisRound
              : undefined,
          // Persist the chronological log if we collected one this
          // round. Renderer prefers this over content+tool_calls when
          // present (for new messages); old saved sessions without
          // blocks fall back to the legacy combined render.
          blocks: blocksThisRound.length > 0 ? blocksThisRound : undefined,
        };
        conversation.push(assistantMsg);
        setMessages((m) => [...m, assistantMsg]);
        setStreaming(null);
        setStreamingBlocks([]);
        setStreamingToolCalls([]);
        setStreamingToolResults([]);
        setRunningTools(false);
        setActiveToolLabels([]);

        if (toolCallsThisRound.length === 0) break;
        if (abortRef.current?.signal.aborted) break;
        // Agentic providers (Claude Code) ran their own internal tool loop
        // while streaming — the tool_use blocks we collected are display-
        // only. Don't try to "execute" them on our side; just end here.
        if (isAgenticProvider) break;

        // Run independent reads in parallel; serialize writes so their
        // confirm dialogs don't all fire at once.
        const WRITE_TOOLS = new Set(["edit_file", "create_file"]);
        const reads = toolCallsThisRound.filter(
          (c) => !WRITE_TOOLS.has(c.function.name),
        );
        const writes = toolCallsThisRound.filter((c) =>
          WRITE_TOOLS.has(c.function.name),
        );

        setRunningTools(true);
        setActiveToolLabels(
          toolCallsThisRound.map((c) => {
            const args = c.function.arguments;
            const detail = toolDetailFor(c.function.name, args);
            let preview: string | undefined;
            if (c.function.name === "edit_file" && typeof args.new_text === "string") {
              preview = args.new_text;
            } else if (c.function.name === "create_file" && typeof args.content === "string") {
              preview = args.content;
            }
            return {
              id: c.id,
              name: c.function.name,
              detail,
              preview,
              status: "running" as const,
            };
          }),
        );
        const finishToolCall = (call: ToolCall, result: string) => {
          // Mark this label as done so the UI flips its spinner to a
          // checkmark (only really matters for parallel reads where
          // some finish before others; sequential writes look the
          // same either way).
          setActiveToolLabels((labels) =>
            labels.map((l) =>
              l.id && l.id === call.id ? { ...l, status: "done" as const } : l,
            ),
          );
          const trimmed =
            result.length > 16000
              ? result.slice(0, 16000) + "\n…[truncated]"
              : result;
          const toolMsg: ChatMessage = {
            role: "tool",
            content: trimmed,
            tool_call_id: call.id,
          };
          conversation.push(toolMsg);
          setMessages((m) => [...m, toolMsg]);
        };

        const runWithPermission = async (call: ToolCall): Promise<string> => {
          const perm = permissionFor(call.function.name, call.function.arguments);
          if (perm === "deny") {
            return `User has disabled the ${call.function.name} tool in Settings → Tool Permissions.`;
          }
          if (perm === "ask") {
            // Render an inline permission card in the chat and await the
            // user's decision. The card's buttons may also persist a
            // remember-this rule (via rememberToolAlways / rememberToolPath
            // before resolving), so the next call gets "allow" instantly.
            const decision = await new Promise<"allow" | "deny">((resolve) => {
              setPendingPermission({ call, resolve });
            });
            setPendingPermission(null);
            if (decision !== "allow") {
              return `User denied permission for ${call.function.name}.`;
            }
          }
          return executeTool(call, { wsId, root });
        };

        // Parallel reads (each may hit an Ask dialog, queued in series via
        // the dialog manager — the API allows concurrent Promise dispatch).
        const readResults = await Promise.all(reads.map(runWithPermission));
        for (let i = 0; i < reads.length; i++) {
          finishToolCall(reads[i], readResults[i]);
        }

        if (abortRef.current?.signal.aborted) {
          setRunningTools(false);
          break;
        }

        // Sequential writes (each shows a confirm dialog inside executeTool too).
        for (const call of writes) {
          if (abortRef.current?.signal.aborted) break;
          const result = await runWithPermission(call);
          finishToolCall(call, result);
        }
        setRunningTools(false);
        setActiveToolLabels([]);

        if (abortRef.current?.signal.aborted) break;
        // Restart streaming UI for the next round.
        setStreaming("");
      }
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        toastError(`Chat failed: ${errMsg(e)}`);
      }
    } finally {
      setStreaming(null);
      setStreamingBlocks([]);
      setStreamingToolCalls([]);
      setStreamingToolResults([]);
      setRunningTools(false);
      setActiveToolLabels([]);
      setTokensPerSec(null);
      setLastStreamEventAt(null);
      // If a permission card was awaiting a decision when the turn
      // aborted, resolve it as deny so the parent promise unblocks
      // and clear the card so the user doesn't see a stale prompt
      // for a tool call that's no longer in flight.
      setPendingPermission((cur) => {
        if (cur) {
          try {
            cur.resolve("deny");
          } catch {
            /* ignore */
          }
        }
        return null;
      });
      abortRef.current = null;
      liveTurnRef.current = false;
      // One-shot attach flags reset after the message goes out.
      setAttachTree(false);
      clearAttachedFiles();
      setAttachedAgents([]);
      setAttachTerminal(false);
      // Claude Code `-p` kills background Bash ~5s after stdin closes.
      // If the model said it would "wake up" but the subprocess already
      // exited, nudge a --resume continuation once the harness is idle.
      if (
        selectedProvider === "claude-code" &&
        sessionId &&
        text !== BACKGROUND_WAKE_PROMPT
      ) {
        const last = conversation[conversation.length - 1];
        if (lastTurnLaunchedBackgroundBash(last)) {
          cancelBackgroundWake();
          bgWakeRef.current = scheduleBackgroundWake({
            chatSessionId: sessionId,
            onWake: () => {
              bgWakeRef.current = null;
              void sendUserTextRef.current?.(BACKGROUND_WAKE_PROMPT);
            },
          });
        }
      }
      // Drain any messages the user typed while this turn was in
      // flight. Fires after a microtask so the React state from the
      // finally block has settled.
      if (queueRef.current.length > 0) {
        setTimeout(() => void drainQueue(), 0);
      }
    }
  };

  const stop = () => {
    // Stop also clears the queue — Stop should mean "I want to
    // change direction now," not "process my queued follow-ups
    // anyway with whatever the agent half-finished."
    clearQueue();
    cancelBackgroundWake();
    abortRef.current?.abort();
    liveTurnRef.current = false;
    // Immediate UI reset — don't wait for the tool-execution loop or
    // provider generator to unwind (OpenCode could sit in runningTools).
    setStreaming(null);
    setStreamingBlocks([]);
    setStreamingToolCalls([]);
    setStreamingToolResults([]);
    setRunningTools(false);
    setActiveToolLabels([]);
    setTokensPerSec(null);
    setLastStreamEventAt(null);
  };

  // Archive / done / close tab kills CLI subprocesses on the Rust side and
  // pings this bus so HTTP-stream providers abort locally too.
  const stopRef = useRef(stop);
  stopRef.current = stop;
  useEffect(() => {
    if (!aiChatId) return;
    return onChatStopRequest((id) => {
      if (id === aiChatId) stopRef.current();
    });
  }, [aiChatId]);

  // Make the "Stop (Esc)" tooltip honest — Esc previously only worked
  // when the chat textarea was focused, so a user reading the streamed
  // output (focus on chat scroll area) couldn't actually use the
  // documented shortcut. Now a window-level listener fires when the
  // turn is in flight AND the user isn't typing in some other input
  // elsewhere in the app (don't steal Esc from the file dialog, the
  // settings modal, etc.). The textarea-bound handler still wins
  // when its own slash-menu / attachment paths apply.
  //
  // Dependency note: condense `streaming !== null || runningTools` into
  // a boolean before the deps array. Listing the raw `streaming` string
  // re-attached the listener on every content delta (i.e. dozens of
  // times per second during a streaming response) — the only event the
  // effect cares about is the active/inactive flip, not the text.
  const turnActive = streaming !== null || runningTools;
  const editorInWorkspace =
    !!editorState.filePath && !!root && isUnderRoot(editorState.filePath, root);
  const hasWsAttached = attachedFiles.some((f) => isUnderRoot(f, root));
  const showComposerDock = turnActive || editorInWorkspace || hasWsAttached;
  useEffect(() => {
    if (!turnActive || !chatVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const t = e.target as HTMLElement | null;
      // Skip if focus is in OUR chat input — its onKeyDown owns Esc
      // there (slash-menu close, etc.). Also skip text fields in
      // unrelated overlays (settings, dialog) so we don't steal.
      if (t) {
        if (t.tagName === "TEXTAREA" || t.tagName === "INPUT") return;
        if (t.isContentEditable) return;
      }
      e.preventDefault();
      stop();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turnActive, chatVisible]);

  // Clear the four bits of per-turn transient UI state that aren't
  // tied to a specific session — the last-turn usage card, the
  // TodoWrite checklist, the budget-warning latch, and the
  // history-scrub index. Six call sites (chat-restore, /clear,
  // regenerate, branchOrigin, startNewChat, openSession, removeSession)
  // were repeating these four lines and drifting in subtle ways
  // (one branch missed setLastUsage, another missed setTodos…).
  const resetTurnTransients = () => {
    pinnedContextRef.current = null;
    setLastUsage(null);
    setLiveContextTokens(null);
    setDiskContextTokens(null);
    setTodos(null);
    // Task-id mapping follows the checklist's lifetime — stale indices
    // from a previous chat would mis-route TaskUpdate calls.
    taskIndexRef.current.clear();
    taskCounterRef.current = 0;
    setBudgetWarned(false);
    setScrubIndex(null);
    pinActiveRef.current = false;
  };

  const regenerateFrom = async (index: number) => {
    if (streaming !== null || runningTools) return;
    const target = messages[index];
    if (!target || target.role !== "user") return;
    // Wipe this message + everything after, then re-send with the same text.
    const truncated = messages.slice(0, index);
    setMessages(truncated);
    setExpandedMsgIdx(new Set());
    // Force a fresh Claude Code session — the existing CC session has
    // turns we just truncated, so resuming it would feed the model
    // context the user explicitly wiped. Next turn will get a new id.
    const parsed = parseQualifiedModel(selected);
    const provider = parsed?.providerId ?? "ollama";
    setProviderSessionIds((prev) =>
      setProviderSessionId(prev, provider, undefined),
    );
    setChatTotalCost(0);
    resetTurnTransients();
    await sendUserText(target.content, truncated);
  };

  const branchFromHere = (index: number) => {
    if (streaming !== null || runningTools) return;
    const target = messages[index];
    if (!target || target.role !== "user") return;
    // Keep the prefix up THROUGH this user message (inclusive). The
    // user can then edit the prompt or just hit send to retry.
    // No assistant turn after — the new chat is queued at the user's
    // message ready for them to send.
    const prefix = messages.slice(0, index + 1);
    // Open a new tab — addAIChat auto-assigns desc.sessionId = chat
    // id. Save the branched session under THAT same id so the new
    // panel's mount effect finds it on first load. Using a fresh
    // newSessionId() and re-binding via setAIChatSession would race
    // the panel mount: the load effect only re-runs on aiChatId
    // change, so it'd pick up the old (auto-assigned) id and find
    // nothing. The new tab would then open empty.
    const newChatId = useStore.getState().addAIChat(wsId, "editor");
    const branchTitle = deriveTitle(prefix) + " (branch)";
    useStore.getState().renameAIChat(wsId, newChatId, branchTitle);
    useStore.getState().focusAIChat(wsId, newChatId);
    const branchedSession: ChatSession = {
      id: newChatId,
      title: branchTitle,
      messages: prefix,
      model: selected,
      updatedAt: Date.now(),
      ccEffort,
      ccThinking,
      ccPermMode,
      composer: draftFromComposerSnap(composerPersistRef.current),
      // No claudeSessionId — branching forks the conversation, so
      // we want a fresh Claude Code session not a resumed one.
    };
    saveSession(wsId, branchedSession) || warnSaveFailed();
    toastInfo(
      "Branched into a new chat tab — the original is untouched",
    );
  };

  const goDeeper = async () => {
    if (streaming !== null || runningTools) return;
    if (messages.length === 0) return;
    await sendUserText(
      "Go deeper. Read more files (5+ more) and expand your answer with concrete details: specific file paths, what each module does, how data flows, and any concerns or improvements you'd suggest. Reference exact paths and code patterns you observe.",
      messages,
    );
  };

  const startNewChat = () => {
    if (streaming !== null) return;
    clearAgentCommit(commitKey(wsId, sessionId));
    setSessionId(newSessionId());
    // Forget the prior Claude Code session so the next turn spawns a
    // fresh server-side session instead of resuming an unrelated one.
    const parsed = parseQualifiedModel(selected);
    const provider = parsed?.providerId ?? "ollama";
    setProviderSessionIds((prev) =>
      setProviderSessionId(prev, provider, undefined),
    );
    setPinnedProviderId(undefined);
    setChatTotalCost(0);
    resetTurnTransients();
    setMessages([]);
    applyComposerDraft({});
    const knobs = defaultSessionKnobs();
    setCcEffort(knobs.effort);
    setCcThinking(knobs.thinking);
    setCcPermMode(knobs.permMode);
    setHistoryOpen(false);
  };

  const openSession = (id: string) => {
    if (streaming !== null) return;
    const list = loadSessions(wsId);
    const s = list.find((x) => x.id === id);
    if (!s) return;
    setSessionId(s.id);
    // Restore the Claude Code session id alongside the conversation so
    // resuming this chat picks up the server-side context where it left
    // off. If the chat predates this feature it'll be undefined and the
    // first turn will start a fresh CC session — the next stream-init
    // event will populate it.
    setProviderSessionIds(readProviderSessionIds(s));
    setPinnedProviderId(
      s.pinnedProviderId ??
        resolvePinnedPlatform({
          pinnedProviderId: s.pinnedProviderId,
          model: s.model,
          messages: s.messages,
          providerSessionIds: s.providerSessionIds,
        }) ??
        undefined,
    );
    // The cumulative cost IS persisted across reloads, so restore it
    // from the session — the running total in the footer should reflect
    // the chat's full history of spend, not reset to 0. Everything else
    // (last-turn usage card, TodoWrite list, budget-warn latch, scrub
    // index) clears via the shared transient-reset helper.
    setChatTotalCost(s.totalCostUsd ?? 0);
    const knobs = sessionKnobsFrom(s);
    setCcEffort(knobs.effort);
    setCcThinking(knobs.thinking);
    setCcPermMode(knobs.permMode);
    resetTurnTransients();
    const msgs = cleanStaleToolMessages(s.messages);
    setMessages(msgs);
    rebuildChecklist(msgs);
    applyComposerDraft(draftFromSession(s));
    setHistoryOpen(false);
    void hydrateAgentCommitFromMessages(wsId, s.id, root, msgs);
    if (s.model) setSelected(s.model);
    const gen = ++ccHydrateGenRef.current;
    void tryProviderRecover(s, gen);
  };

  const runInActiveTerminal = async (text: string) => {
    const wsLatest = useStore.getState().loaded[wsId];
    const terms = wsLatest ? Object.values(wsLatest.terminals) : [];
    const t = terms[terms.length - 1];
    if (!t?.ptyId) {
      toastError("No active terminal — open one first");
      return;
    }
    try {
      // Strip leading "$" or ">" prompts the model often adds.
      const cleaned = text
        .split("\n")
        .map((l) => l.replace(/^[$>]\s*/, ""))
        .join("\n");
      // Send each non-empty line followed by Enter.
      for (const line of cleaned.split("\n")) {
        if (line.trim().length === 0) continue;
        await pty.write(t.ptyId, line + "\r");
      }
      toastSuccess(`Sent to terminal "${t.title ?? "Terminal"}"`);
    } catch (e) {
      toastError(`Failed to send to terminal: ${errMsg(e)}`);
    }
  };

  // /usage — modal report, NOT injected into the chat. The CLI's
  // interactive /usage panel (plan-window limit bars) isn't reachable
  // headlessly, but the CLI keeps per-model lifetime/daily stats in
  // ~/.claude/stats-cache.json, and Codetta's own usage log covers
  // API-billed spend. Combine both.
  const [usageReport, setUsageReport] = useState<{
    cli: {
      sessions?: number;
      messages?: number;
      models: Array<{
        model: string;
        tokIn: number;
        tokOut: number;
        cost?: number;
      }>;
      today: Array<{ model: string; tokens: number }>;
    } | null;
    local: { chat: number; wsMonth: number; month: number; today: number };
    account: {
      name?: string;
      email?: string;
      plan?: string;
    } | null;
    limits: Array<{
      label: string;
      pct: number;
      resetsAt: string | null;
    }>;
    extra: {
      used: number;
      limit: number;
      pct: number;
      currency: string;
    } | null;
    limitsError: string | null;
  } | null>(null);

  // ── Live session usage (polled for the ProgressCircle + drawer) ──
  const [sessionUsage, setSessionUsage] = useState<SessionUsageData | null>(
    null,
  );
  const [sessionLimitsError, setSessionLimitsError] = useState<string | null>(
    null,
  );
  // Cache the five_hour pct + resetsAt separately for the circle (avoids
  // re-parsing the full SessionUsageData on every 30s tick).
  const [sessionPct, setSessionPct] = useState(0);
  const [sessionResetsAt, setSessionResetsAt] = useState<string | null>(null);
  const [_sdOpen, setSessionDrawerOpen] = useState(false);

  usageMetricsRef.current = {
    wsId,
    selected,
    allModels,
    chatTotalCost,
    cumulativeTokensIn,
    cumulativeTokensOut,
    cumulativeCacheRead,
    cumulativeTurns,
    assistantTurns: messages.filter((m) => m.role === "assistant").length,
    lastUsage,
    liveContextTokens,
    diskContextTokens,
    diskSessionDurationMs,
    sessionStartTs,
  };

  const resolveContextTokens = (): TurnTokens | undefined =>
    usageMetricsRef.current.liveContextTokens ??
    usageMetricsRef.current.lastUsage?.contextTokens ??
    usageMetricsRef.current.diskContextTokens ??
    undefined;

  const buildUsageFromMetrics = () => {
    const m = usageMetricsRef.current;
    const durationMs =
      m.diskSessionDurationMs > 0
        ? m.diskSessionDurationMs
        : Date.now() - m.sessionStartTs;
    return buildSessionUsageLocal({
      wsId: m.wsId,
      chat: {
        cost: m.chatTotalCost,
        tokensIn: m.cumulativeTokensIn,
        tokensOut: m.cumulativeTokensOut,
        cacheRead: m.cumulativeCacheRead,
        turns: m.cumulativeTurns || m.assistantTurns,
        model: m.lastUsage?.model ?? null,
        durationMs,
      },
      selectedQualified: m.selected,
      models: m.allModels,
      contextTokens: resolveContextTokens(),
    });
  };

  // Hydrate drawer + ring from CC JSONL when stream usage is absent.
  const diskHydrateGenRef = useRef(0);
  const assistantTurnCount = messages.filter((m) => m.role === "assistant").length;

  useEffect(() => {
    if (!selectedIsCC) {
      setDiskContextTokens(null);
      setDiskSessionDurationMs(0);
      return;
    }
    if (!wsActive) return;
    const gen = ++diskHydrateGenRef.current;
    let cancelled = false;

    const poll = async () => {
      if (cancelled || gen !== diskHydrateGenRef.current) return;
      let sid = claudeSessionId;
      if (!sid && assistantTurnCount > 0) {
        sid = await guessClaudeSessionId(root, assistantTurnCount);
        if (sid && !cancelled && gen === diskHydrateGenRef.current) {
          setProviderSessionIds((prev) =>
            setProviderSessionId(prev, "claude-code", sid!),
          );
        }
      }
      if (!sid) return;
      try {
        const stats = await claudeCode.drawerStats(root, sid);
        if (!stats || cancelled || gen !== diskHydrateGenRef.current) return;
        if (!liveContextTokens) {
          const ctx = contextTokensFromDisk(stats);
          if (ctx) setDiskContextTokens(ctx);
        }
        const m = usageMetricsRef.current;
        const merged = mergeDiskBilling(
          {
            tokensIn: m.cumulativeTokensIn,
            tokensOut: m.cumulativeTokensOut,
            cacheRead: m.cumulativeCacheRead,
            turns: m.cumulativeTurns,
            cost: m.chatTotalCost,
          },
          stats,
        );
        if (streaming === null) {
          setCumulativeTokensIn(merged.tokensIn);
          setCumulativeTokensOut(merged.tokensOut);
          setCumulativeCacheRead(merged.cacheRead);
          setCumulativeTurns(merged.turns);
          if (merged.cost > m.chatTotalCost) setChatTotalCost(merged.cost);
          if (merged.durationMs > 0) setDiskSessionDurationMs(merged.durationMs);
        }
        if (merged.model) {
          setLastUsage((prev) => {
            if (prev?.model) return prev;
            const ctx = contextTokensFromDisk(stats);
            return {
              cost: merged.cost,
              durationMs: merged.durationMs,
              model: merged.model!,
              tokens: {
                input: merged.tokensIn,
                output: merged.tokensOut,
                cacheRead: merged.cacheRead,
                cacheCreate: stats.cache_creation_tokens,
              },
              contextTokens: ctx ?? undefined,
            };
          });
        }
      } catch {
        /* session file not written yet */
      }
    };

    void poll();
    const t = window.setInterval(poll, 12_000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [
    selectedIsCC,
    wsActive,
    claudeSessionId,
    root,
    liveContextTokens,
    assistantTurnCount,
    streaming,
  ]);

  // Refresh local drawer/circle data when chat metrics change — no API.
  useEffect(() => {
    if (!selectedIsCC) {
      setSessionUsage(null);
      setSessionLimitsError(null);
      setSessionPct(0);
      setSessionResetsAt(null);
      planCacheRef.current = null;
      return;
    }
    const cache = planCacheRef.current;
    setSessionUsage({
      ...buildUsageFromMetrics(),
      limits: cache?.limits ?? [],
      extra: cache?.extra ?? null,
    });
  }, [
    selectedIsCC,
    wsId,
    selected,
    allModels,
    chatTotalCost,
    cumulativeTokensIn,
    cumulativeTokensOut,
    cumulativeCacheRead,
    cumulativeTurns,
    lastUsage,
    liveContextTokens,
    diskContextTokens,
    diskSessionDurationMs,
    messages.length,
    sessionStartTs,
  ]);

  // Poll plan limits every 30s — deps stay minimal so we don't 429.
  useEffect(() => {
    if (!selectedIsCC || !wsActive) return;

    const poll = async () => {
      const local = buildUsageFromMetrics();
      try {
        const res = await invoke<{ usage?: Record<string, unknown> }>(
          "claude_usage_limits",
        );
        const u = (res.usage ?? {}) as Parameters<typeof parseUsageLimits>[0];
        const limits = parseUsageLimits(u);
        const extra = parseUsageExtra(u);
        const fh = u.five_hour;
        let pct = 0;
        let resetsAt: string | null = null;
        if (fh && typeof fh.utilization === "number") {
          pct = normUsagePct(fh.utilization);
          resetsAt = fh.resets_at ?? null;
        }
        planCacheRef.current = { sessionPct: pct, sessionResetsAt: resetsAt, limits, extra };
        setSessionPct(pct);
        setSessionResetsAt(resetsAt);
        setSessionLimitsError(null);
        setSessionUsage({ ...local, limits, extra });
      } catch (e) {
        const msg = errMsg(e);
        const cache = planCacheRef.current;
        // The claude.ai usage endpoint rate-limits aggressively (HTTP 429) and
        // fails transiently — that's not a user-facing problem. Keep the last
        // known limits and only surface an error when we have nothing to show
        // AND it isn't a transient rate-limit/network blip. Prevents the scary
        // "Plan limits: request failed" box from flashing at session start.
        const transient = /\b429\b|rate.?limit|timed? ?out|network|connection/i.test(
          msg,
        );
        setSessionLimitsError(cache || transient ? null : msg);
        if (cache) {
          setSessionPct(cache.sessionPct);
          setSessionResetsAt(cache.sessionResetsAt);
        }
        setSessionUsage({
          ...local,
          limits: cache?.limits ?? [],
          extra: cache?.extra ?? null,
        });
      }
    };

    poll();
    const t = window.setInterval(poll, 30_000);
    return () => window.clearInterval(t);
  }, [selectedIsCC, wsActive, wsId]);

  // Probe Claude Code OAuth without hitting the rate-limited usage API.
  useEffect(() => {
    if (!selectedIsCC || !claudeCodeAvailable || !wsActive) {
      if (!selectedIsCC || !claudeCodeAvailable) setClaudeAuth(null);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      const probe = await probeClaudeAuth();
      if (!cancelled) setClaudeAuth(probe);
    };
    void refresh();
    const t = window.setInterval(() => void refresh(), 60_000);
    const unsub = subscribeClaudeAuth((probe) => {
      if (!cancelled) setClaudeAuth(probe);
    });
    return () => {
      cancelled = true;
      window.clearInterval(t);
      unsub();
    };
  }, [selectedIsCC, claudeCodeAvailable, wsActive, wsId]);

  const showUsageReport = async () => {
    let cli: NonNullable<typeof usageReport>["cli"] = null;
    try {
      const { homeDir } = await import("@tauri-apps/api/path");
      const home = (await homeDir()).replace(/[\\/]+$/, "");
      const raw = await fs.readFile(`${home}/.claude/stats-cache.json`);
      const st = JSON.parse(raw) as {
        modelUsage?: Record<
          string,
          { inputTokens?: number; outputTokens?: number; costUSD?: number }
        >;
        dailyModelTokens?: Array<{
          date: string;
          tokensByModel: Record<string, number>;
        }>;
        totalSessions?: number;
        totalMessages?: number;
      };
      const todayKey = new Date().toISOString().slice(0, 10);
      const todayRow = (st.dailyModelTokens ?? []).find(
        (d) => d.date === todayKey,
      );
      cli = {
        sessions: st.totalSessions,
        messages: st.totalMessages,
        models: Object.entries(st.modelUsage ?? {}).map(([model, u]) => ({
          model,
          tokIn: u.inputTokens ?? 0,
          tokOut: u.outputTokens ?? 0,
          cost: u.costUSD || undefined,
        })),
        today: todayRow
          ? Object.entries(todayRow.tokensByModel).map(([model, tokens]) => ({
              model,
              tokens,
            }))
          : [],
      };
    } catch {
      cli = null;
    }
    // Live plan-limit windows — same endpoint the CLI's /usage panel
    // and the official extension use, via our Rust command (the OAuth
    // token never reaches the frontend).
    let account: NonNullable<typeof usageReport>["account"] = null;
    let limits: NonNullable<typeof usageReport>["limits"] = [];
    let extra: NonNullable<typeof usageReport>["extra"] = null;
    let limitsError: string | null = null;
    try {
      const res = await invoke<{
        usage?: Record<
          string,
          { utilization?: number; resets_at?: string | null } | null
        > & {
          extra_usage?: {
            is_enabled?: boolean;
            monthly_limit?: number;
            used_credits?: number;
            utilization?: number;
            currency?: string;
          } | null;
        };
        profile?: {
          account?: { full_name?: string; email?: string };
        } | null;
        subscriptionType?: string | null;
        rateLimitTier?: string | null;
      }>("claude_usage_limits");
      const u = res.usage ?? {};
      const windows: Array<[string, string]> = [
        ["five_hour", "Session (5hr)"],
        ["seven_day", "Weekly (7 day)"],
        ["seven_day_sonnet", "Weekly Sonnet"],
        ["seven_day_opus", "Weekly Opus"],
      ];
      for (const [key, label] of windows) {
        const w = u[key];
        if (w && typeof w.utilization === "number") {
          limits.push({
            label,
            pct: w.utilization,
            resetsAt: w.resets_at ?? null,
          });
        }
      }
      const ex = u.extra_usage;
      if (ex?.is_enabled && typeof ex.used_credits === "number") {
        extra = {
          used: ex.used_credits,
          limit: ex.monthly_limit ?? 0,
          pct: ex.utilization ?? 0,
          currency: ex.currency ?? "USD",
        };
      }
      const tier = (res.rateLimitTier ?? "").match(/_(\d+x)$/)?.[1];
      const planBase = res.subscriptionType
        ? res.subscriptionType.charAt(0).toUpperCase() +
          res.subscriptionType.slice(1)
        : undefined;
      account = {
        name: res.profile?.account?.full_name,
        email: res.profile?.account?.email,
        plan: planBase ? (tier ? `${planBase} ${tier}` : planBase) : undefined,
      };
    } catch (e) {
      limitsError = errMsg(e);
    }
    const records = loadUsage();
    const todayKey = new Date().toDateString();
    setUsageReport({
      cli,
      local: {
        chat: chatTotalCost,
        wsMonth: thisMonthWorkspaceTotal(wsId, records),
        month: thisMonthTotal(records),
        today: records
          .filter((r) => new Date(r.ts).toDateString() === todayKey)
          .reduce((a, r) => a + r.costUsd, 0),
      },
      account,
      limits,
      extra,
      limitsError,
    });
  };

  // Esc closes the usage modal.
  useEffect(() => {
    if (!usageReport) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setUsageReport(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [usageReport]);

  const runSlashCommand = (cmd: SlashCommand) => {
    if (cmd.action === "new") {
      startNewChat();
      return;
    }
    if (cmd.action === "usage") {
      setInput("");
      void showUsageReport();
      return;
    }
    if (cmd.action === "effort") {
      const arg = input.split(/\s+/)[1]?.toLowerCase() ?? "";
      setInput("");
      const levels = [...CC_EFFORTS];
      if (!arg) {
        // No argument — reopen as the value submenu so the user picks
        // from a list instead of reading a syntax toast.
        setInput("/effort ");
        setSlashIndex(0);
        inputRef.current?.focus();
        return;
      }
      if (arg === "off" || arg === "default") {
        setCcEffort(CC_EFFORT_DEFAULT);
        toastInfo(`Effort: ${CC_EFFORT_DEFAULT} (applies from the next message)`);
        return;
      }
      if (!levels.includes(arg as (typeof levels)[number])) {
        toastError(`Unknown effort "${arg}" — use ${levels.join("|")}`);
        return;
      }
      setCcEffort(arg);
      toastInfo(`Effort: ${arg} (applies from the next message)`);
      return;
    }
    if (cmd.action === "mode") {
      const arg = input.split(/\s+/)[1]?.toLowerCase() ?? "";
      setInput("");
      // Friendly aliases → permission-mode values. "bypass" maps to Claude
      // Code's real bypassPermissions: the backend runs it with the hook
      // OFF — zero cards, no privacy gate. Everything else keeps the hook.
      const map: Record<string, string> = {
        ask: "default",
        default: "default",
        plan: "plan",
        "auto-edit": "acceptEdits",
        "accept-edits": "acceptEdits",
        acceptedits: "acceptEdits",
        auto: "auto",
        bypass: "bypassPermissions",
        yolo: "bypassPermissions",
      };
      if (!arg) {
        setInput("/mode ");
        setSlashIndex(0);
        inputRef.current?.focus();
        return;
      }
      if (arg === "off") {
        setCcPermMode(null);
        toastInfo("Permission mode reset to Ask");
        return;
      }
      const mode = map[arg];
      if (!mode) {
        toastError(
          `Unknown mode "${arg}" — use ask, plan, auto-edit, auto, or bypass`,
        );
        return;
      }
      setCcPermMode(mode === "default" ? null : mode);
      toastInfo(
        `Mode: ${mode}${mode === "plan" ? " — Claude will plan without editing" : ""} (applies from the next message)`,
      );
      return;
    }
    if (cmd.action === "thinking") {
      const arg = input.split(/\s+/)[1]?.toLowerCase() ?? "";
      setInput("");
      let next: boolean | null;
      if (arg === "on") next = true;
      else if (arg === "off") next = false;
      else if (arg === "default") next = null;
      // Bare /thinking is a toggle — the slash row doubles as the
      // on/off switch.
      else next = ccThinking !== true;
      setCcThinking(next);
      toastInfo(
        `Extended thinking: ${next === null ? "CLI default" : next ? "ON" : "OFF"} (applies from the next message)`,
      );
      return;
    }
    if (cmd.action === "clear") {
      setMessages([]);
      clearAgentCommit(commitKey(wsId, sessionId));
      // Wipe Claude Code session context too — /clear means "forget what
      // we were talking about", and resuming an old CC session would
      // contradict that even if the local message list is empty.
      setProviderSessionIds({});
      setChatTotalCost(0);
      resetTurnTransients();
      setInput("");
      return;
    }
    if (cmd.action === "tree") {
      setAttachTree(true);
      setInput("");
      toastInfo("Project tree will attach to your next message");
      return;
    }
    if (cmd.action === "terminal") {
      setAttachTerminal(true);
      setInput("");
      toastInfo("Active terminal output will attach to your next message");
      return;
    }
    if (cmd.action === "file") {
      // Parse trailing path from current input ("/file src/foo.ts" -> "src/foo.ts")
      const rest = input.replace(/^\/file\s*/i, "").trim();
      if (!rest) {
        // Don't have a path yet — just complete the command and wait for the user.
        setInput("/file ");
        return;
      }
      addAttachedFile(rest, root);
      setInput("");
      toastInfo(`Attached ${rest} to next message`);
      return;
    }
    if (cmd.prompt) {
      setInput(cmd.prompt);
      setSlashIndex(0);
    }
  };

  const removeSession = async (id: string) => {
    const list = loadSessions(wsId);
    const s = list.find((x) => x.id === id);
    if (!s) return;
    const ok = await dialogConfirm(
      `Delete chat "${s.title}"?`,
      { title: "Delete chat", okLabel: "Delete", danger: true },
    );
    if (!ok) return;
    deleteSession(wsId, id);
    setSessions(loadSessions(wsId));
    if (id === sessionId) {
      // Active chat deleted — start a fully fresh one. Reset every bit
      // of derived state we track per-chat: a leftover claudeSessionId
      // would --resume the deleted server-side session on the next turn
      // (still works, but the UI lies about it being a continued chat),
      // and a leftover totalCost / todos / usage card would render
      // values that no longer relate to anything visible.
      setSessionId(newSessionId());
      setMessages([]);
      setProviderSessionIds({});
      setChatTotalCost(0);
      const knobs = defaultSessionKnobs();
      setCcEffort(knobs.effort);
      setCcThinking(knobs.thinking);
      setCcPermMode(knobs.permMode);
      applyComposerDraft({});
      resetTurnTransients();
    }
  };

  const pullSpecific = async (name: string) => {
    if (!name) return;
    // Already pulling this same model? No-op.
    if (pullProgressMap[name]) return;
    setPullProgressMap((m) => ({ ...m, [name]: `Pulling ${name}…` }));
    try {
      for await (const ev of pullStream(name)) {
        const pct =
          ev.total && ev.completed
            ? Math.round((ev.completed / ev.total) * 100)
            : null;
        const line =
          pct != null
            ? `${name} — ${ev.status} (${pct}%)`
            : `${name} — ${ev.status}`;
        setPullProgressMap((m) => ({ ...m, [name]: line }));
      }
      toastSuccess(`Pulled ${name}`);
      await refresh();
    } catch (e) {
      toastError(`Pull failed: ${errMsg(e)}`);
    } finally {
      setPullProgressMap((m) => {
        const { [name]: _drop, ...rest } = m;
        void _drop;
        return rest;
      });
    }
  };

  const pullModel = () => {
    setBrowserOpen(true);
  };

  const providerMeta: Record<string, { label: string; color: string }> = {
    ollama: { label: "ollama", color: "#4ade80" },
    "claude-code": { label: "claude code", color: "#b18cf0" },
    "cursor-cli": { label: "cursor cli", color: "#6b9bd1" },
    "opencode-cli": { label: "opencode", color: "#8b7fd4" },
    openai: { label: "openai", color: "#10a37f" },
    anthropic: { label: "anthropic", color: "#d97757" },
  };

  const providerLinkedTitles = useMemo(
    () => allProviderLinkedTitles(sessions),
    [sessions],
  );

  const renderHeader = () => {
    const parsed = parseQualifiedModel(selected);
    const providerSid =
      parsed && isAgenticProviderId(parsed.providerId)
        ? providerSessionIds[parsed.providerId]
        : undefined;
    return (
      <div className="ai-header">
        {rulesSource && rulesPath && (() => {
          // ~4 chars/token. Color the dot by weight so a bloated CLAUDE.md
          // (which taxes every turn) is visible at a glance.
          const tok = Math.round(rulesBytes / 4);
          const level = tok > 6000 ? "heavy" : tok > 2500 ? "warn" : "ok";
          const tokLabel =
            tok >= 1000 ? `${(tok / 1000).toFixed(1)}k` : `${tok}`;
          return (
            <button
              className={`ai-rules-indicator level-${level}`}
              onClick={() => void useStore.getState().openFile(wsId, rulesPath)}
              title={
                `${rulesSource} · ~${tokLabel} tokens` +
                (level === "heavy"
                  ? " — heavy, taxes every turn. Consider trimming."
                  : level === "warn"
                    ? " — getting large."
                    : "") +
                (parsed?.providerId === "claude-code"
                  ? " · loaded by Claude Code natively. Click to open."
                  : " · loaded into the system prompt. Click to open.")
              }
            >
              <span className="ai-rules-dot" aria-hidden="true" />
              <span>{rulesSource}</span>
              <span className="ai-rules-tokens">{tokLabel}</span>
            </button>
          );
        })()}
        <div className="ai-header-spacer" />
        {providerSid && parsed && (
          <ProviderSessionChip
            providerId={parsed.providerId}
            sessionId={providerSid}
            wsId={wsId}
            cwd={root}
          />
        )}
        {parsed && isAgenticProviderId(parsed.providerId) && (
          <ProviderSessionsButton
            cwd={root}
            activeProvider={parsed.providerId}
            currentIds={providerSessionIds}
            linkedTitles={providerLinkedTitles}
            onOpenInTerminal={(p, id) =>
              resumeProviderInTerminal(wsId, root, p, id)
            }
            onResume={async (provider, id) => {
              setProviderSessionIds((prev) =>
                setProviderSessionId(prev, provider, id),
              );
              resetTurnTransients();
              if (provider === "opencode-cli") {
                setMessages([]);
                toastInfo(
                  "Resumed OpenCode session — your next message continues the ses_* thread",
                );
                return;
              }
              try {
                const loaded = await providerSessions.loadSession(
                  root,
                  provider,
                  id,
                );
                const hydrated: ChatMessage[] = loaded.map((m) => ({
                  role: m.role as ChatMessage["role"],
                  content: m.content,
                  tool_calls: m.tool_calls,
                  tool_results: m.tool_results,
                }));
                setMessages(hydrated);
                toastInfo(
                  `Resumed ${provider} session — ${hydrated.length} message${hydrated.length === 1 ? "" : "s"} restored`,
                );
              } catch (err) {
                console.warn("provider loadSession failed", err);
                setMessages([]);
                toastInfo(
                  `Resumed ${provider} session — your next message continues from where you left off`,
                );
              }
            }}
          />
        )}
        {/* Tabbed chats get "new chat" from the tab strip / rail —
            a third button INSIDE the panel was clutter. The singleton
            sidebar has no tab strip, so it keeps a compact + icon. */}
        {!aiChatId && (
          <button
            className="ai-header-iconbtn"
            onClick={startNewChat}
            title="New chat (current is saved to history)"
            disabled={streaming !== null || runningTools}
            aria-label="New chat"
          >
            <Icon name="plus" size={14} />
          </button>
        )}
        <HeaderMenu
          historyCount={sessions.length}
          onHistory={() => setHistoryOpen((v) => !v)}
          historyActive={historyOpen}
          onRefresh={() => void refresh()}
          onSettings={() => openSettings()}
          onBrowseModels={() => pullModel()}
        />
      </div>
    );
  };

  const ollamaModels = useMemo(
    () => allModels.filter((m) => m.providerId === "ollama"),
    [allModels],
  );

  // Composer picker lists live/available providers from discovery — NOT the
  // deferred full cloud catalog (that's for Model Browser / Manage models).
  const pickerCloudModels = useMemo(
    () => allModels.filter((m) => m.providerId !== "ollama"),
    [allModels],
  );

  // Model browser / visibility modal: full deferred catalog + live discovery.
  const browserCloudModels = useMemo(() => {
    const byKey = new Map<string, ProviderModel>();
    for (const m of allCloudCatalog) {
      byKey.set(makeQualifiedModel(m.providerId, m.modelId), m);
    }
    for (const m of pickerCloudModels) {
      byKey.set(makeQualifiedModel(m.providerId, m.modelId), m);
    }
    return [...byKey.values()];
  }, [allCloudCatalog, pickerCloudModels]);

  const modelHasKey = useMemo(
    () => ({
      ollama: true,
      "claude-code": claudeCodeAvailable,
      "cursor-cli": cursorCliAvailable,
      "opencode-cli": openCodeAvailable,
      openai: hasApiKey("openai"),
      anthropic: hasApiKey("anthropic"),
    }),
    [claudeCodeAvailable, cursorCliAvailable, openCodeAvailable],
  );

  const handlePickerOpen = useCallback(() => {
    setCatalogWarming(true);
    warmPickerCatalogs();
  }, []);

  const handlePickerPrefetch = useCallback(() => {
    warmPickerCatalogs();
  }, []);

  const pinnedPlatform = useMemo(
    () =>
      resolvePinnedPlatform({
        pinnedProviderId,
        model: selected,
        messages,
        providerSessionIds,
      }),
    [pinnedProviderId, selected, messages, providerSessionIds],
  );

  const renderModelChip = () => {
    const parsed = parseQualifiedModel(selected);
    const dotColor = parsed
      ? (providerMeta[parsed.providerId]?.color ?? "var(--fg-muted)")
      : undefined;
    return (
      <ModelPickerPopover
        selectedQualified={selected}
        dotColor={dotColor}
        onSelect={(q) => setSelected(q)}
        cloudModels={pickerCloudModels}
        ollamaModels={ollamaModels}
        hasKey={modelHasKey}
        onOpen={handlePickerOpen}
        onPrefetch={handlePickerPrefetch}
        loading={catalogWarming}
        onConfigureProviders={() => openSettings("ai-providers")}
        onOpenFullBrowser={() => setBrowserOpen(true)}
        pinnedProviderId={pinnedPlatform}
        onNewChat={startNewChat}
      />
    );
  };

  const renderHistoryDropdown = () => {
    if (!historyOpen) return null;
    return (
      <div className="ai-history-dropdown">
        {sessions.length === 0 && (
          <div className="ai-history-empty">No saved chats yet</div>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`ai-history-item ${s.id === sessionId ? "active" : ""}`}
          >
            <button
              className="ai-history-open"
              onClick={() => openSession(s.id)}
              title={`${s.messages.length} messages · ${new Date(s.updatedAt).toLocaleString()}`}
            >
              <span className="ai-history-title">{s.title}</span>
              <span className="ai-history-meta">
                {new Date(s.updatedAt).toLocaleString()} · {s.messages.length} msg
              </span>
            </button>
            <button
              className="ai-history-delete"
              onClick={() => void removeSession(s.id)}
              title="Delete this chat"
              aria-label={`Delete chat: ${s.title || "Untitled"}`}
            >
              <Icon name="x" size={12} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  const display = useMemo(() => {
    // System messages are infrastructure: they're rebuilt fresh per turn
    // and shouldn't appear as chat bubbles. Hide them defensively in case
    // any path (old session, future bug) leaves one in `messages`.
    const arr: ChatMessage[] = messages.filter((m) => m.role !== "system");
    // Only render the in-progress assistant bubble once there's actual
    // content to show. While the stream is empty (model is still
    // thinking, or running tools), skip the bubble — the inline status
    // strip below already conveys "working on it" without a giant
    // empty whitespace block in the conversation.
    const hasStreamingText =
      streaming !== null && streaming.trim().length > 0;
    const hasStreamingBlocks = streamingBlocks.length > 0;
    if (streaming !== null && (hasStreamingText || hasStreamingBlocks)) {
      arr.push({
        role: "assistant",
        content: streaming ?? "",
        tool_calls:
          streamingToolCalls.length > 0 ? streamingToolCalls : undefined,
        tool_results:
          streamingToolResults.length > 0 ? streamingToolResults : undefined,
        blocks: hasStreamingBlocks ? streamingBlocks : undefined,
      });
    }
    return arr;
  }, [
    messages,
    streaming,
    streamingBlocks,
    streamingToolCalls,
    streamingToolResults,
  ]);

  // No early-return for "checking" — render the normal panel and let
  // model discovery populate the dropdown when it finishes. The previous
  // "Checking for Ollama…" splash was misleading for users who don't
  // run Ollama at all.

  if (status === "missing") {
    return (
      <div className={`ai-panel${compact ? " compact" : ""}`}>
        <div className="ai-empty">
          <p>
            <strong>Ollama isn't reachable on localhost:11434.</strong>
          </p>
          <p>
            <strong>If Ollama is already installed:</strong> launch the Ollama
            app (Windows tray / macOS menu bar). The panel will auto-detect
            within a few seconds. Or click <em>Try to start Ollama</em> below —
            we'll attempt to spawn the server in a hidden terminal.
          </p>
          <p>
            <strong>If Ollama isn't installed:</strong> get it from{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                void openUrl(OLLAMA_DOWNLOAD);
              }}
            >
              ollama.com/download
            </a>
            .
          </p>
          <p>
            <strong>Or skip Ollama entirely:</strong> add an OpenAI / Anthropic
            API key in{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                openSettings("ai-providers");
              }}
            >
              Settings → AI Providers
            </a>
            .
          </p>
          <div className="ai-actions">
            <button
              className="primary"
              onClick={async () => {
                try {
                  // Spawn a hidden Ollama server in a workspace terminal.
                  // The user can see / kill it from the terminal panel.
                  useStore.getState().addTerminal(wsId, "bottom", {
                    path: "ollama",
                    args: ["serve"],
                    label: "Ollama Server",
                  });
                  toastInfo(
                    "Spawning Ollama in a terminal. Will auto-detect within a few seconds.",
                  );
                  // Recheck shortly after.
                  setTimeout(() => void refresh(), 2500);
                } catch (e) {
                  toastError(`Could not start Ollama: ${errMsg(e)}`);
                }
              }}
            >
              <Icon name="play" size={12} />
              <span>Try to start Ollama</span>
            </button>
            <button
              onClick={() => {
                void openUrl(OLLAMA_DOWNLOAD);
                toastInfo("Opened ollama.com/download.");
              }}
            >
              Download Ollama…
            </button>
            <button onClick={() => void refresh()}>Check now</button>
          </div>
          <p className="ai-auto-hint">
            <span className="ai-spinner" /> Auto-checking every 4 s…
          </p>
        </div>
      </div>
    );
  }

  if (status === "no-models") {
    return (
      <div className={`ai-panel${compact ? " compact" : ""}`}>
        <div className="ai-empty">
          <p>
            <strong>Ollama is running.</strong> Pull a model to start chatting,
            or add a cloud provider key in <a href="#" onClick={(e) => { e.preventDefault(); openSettings("ai-providers"); }}>Settings</a>.
          </p>
          <ul className="ai-suggested">
            {SUGGESTED_MODELS.map((m) => (
              <li key={m}>
                <button
                  className="ai-pull-btn"
                  onClick={() => void pullSpecific(m)}
                  disabled={!!pullProgressMap[m]}
                >
                  ↓ <code>{m}</code>
                </button>
                <span className="ai-pull-hint">
                  {m.startsWith("qwen2.5-coder:7b")
                    ? "best for coding · ~4.7 GB"
                    : m.startsWith("qwen2.5-coder:3b")
                      ? "smaller coding model · ~1.9 GB"
                      : m.startsWith("llama3.2")
                        ? "general-purpose · ~2 GB"
                        : "tiny, fast · ~2.4 GB"}
                </span>
              </li>
            ))}
          </ul>
          <div className="ai-actions">
            <button className="primary" onClick={() => pullModel()}>
              Browse all models…
            </button>
            <button onClick={() => void refresh()}>Refresh</button>
          </div>
          {aggregatedPullProgress && (
            <p className="ai-progress">{aggregatedPullProgress}</p>
          )}
        </div>
      </div>
    );
  }

  // Open a Task subagent's transcript in a read-only tab. Needs the live
  // Claude Code session id (the on-disk jsonl name); until it's captured
  // the run is too early to inspect.
  const openSubagentTab = (toolUseId: string, agentType: string) => {
    if (!claudeSessionId) {
      toastInfo("Subagent transcript isn't ready yet — try again once it finishes.");
      return;
    }
    useStore.getState().openSubagent(wsId, claudeSessionId, toolUseId, agentType);
  };

  const openHtmlPreviewHandler = (
    previewId: string,
    html: string,
    title: string,
  ) => {
    openHtmlPreviewTab(wsId, aiChatId, previewId, html, title);
  };

  // Clicking a file-targeted tool row opens that file in a new editor tab.
  // In compact (agent) mode AgentModeShell already provides a handler (the
  // file popup) — forward it so we don't clobber it; in docked chat we open
  // a real tab via the store.
  const fileOpenHandler = compact
    ? parentFileOpen
      ? (path: string) => parentFileOpen(resolveChatFilePath(root, path))
      : null
    : (path: string) =>
        void useStore.getState().openFile(wsId, resolveChatFilePath(root, path));

  const openChatFile = (path: string) => {
    void useStore.getState().openFile(wsId, resolveChatFilePath(root, path));
  };

  // Format a resetsAt ISO timestamp into a human-friendly countdown
  // (e.g. "2h 14m", "35m", "4d"). Used by SessionUsageCircle.
  const fmtResetsIn = (resetsAt: string | null): string => {
    if (!resetsAt) return "—";
    const ms = new Date(resetsAt).getTime() - Date.now();
    if (ms <= 0) return "—";
    const h = ms / 3_600_000;
    if (h < 1) return `${Math.ceil(ms / 60_000)}m`;
    if (h < 48) return `${Math.floor(h)}h ${Math.ceil((h % 1) * 60)}m`;
    return `${Math.ceil(h / 24)}d`;
  };

  const contextSnap = useMemo(() => {
    const window = resolveContextWindow(selected, allModels);
    const { used, estimate } = estimateContextUsed(
      liveContextTokens ?? lastUsage?.contextTokens ?? diskContextTokens ?? undefined,
      cumulativeTokensIn,
    );
    return {
      pct: contextFillPct(used, window),
      used,
      window,
      estimate,
    };
  }, [
    selected,
    allModels,
    liveContextTokens,
    diskContextTokens,
    lastUsage,
    cumulativeTokensIn,
  ]);

  const displayContextSnap = useMemo(() => {
    if (contextSnap.pct > 0 || contextSnap.used > 0) {
      pinnedContextRef.current = contextSnap;
      return contextSnap;
    }
    return pinnedContextRef.current ?? contextSnap;
  }, [contextSnap]);

  const displayRingPct = useMemo(() => {
    if (displayContextSnap.pct > 0) {
      pinnedRingRef.current = displayContextSnap.pct;
      return displayContextSnap.pct;
    }
    if (displayContextSnap.used > 0) {
      const pct = contextFillPct(
        displayContextSnap.used,
        displayContextSnap.window,
      );
      if (pct > 0) {
        pinnedRingRef.current = pct;
        return pct;
      }
    }
    return pinnedRingRef.current ?? 0;
  }, [displayContextSnap]);

  return (
    <SubagentOpen.Provider value={openSubagentTab}>
    <HtmlPreviewOpen.Provider value={openHtmlPreviewHandler}>
    <ChatFileOpen.Provider value={openChatFile}>
    <AgentFileOpen.Provider value={fileOpenHandler}>
    <div
      className={`ai-panel${mentionState && mentionMatches.length > 0 && streaming === null ? " ai-mention-open" : ""}`}
      ref={panelRef}
    >
      {zoomImage && (
        <div
          className="ai-image-modal"
          onClick={() => setZoomImage(null)}
          role="dialog"
          aria-modal="true"
        >
          <img src={zoomImage} alt="" className="ai-image-modal-img" />
        </div>
      )}
      {renderHeader()}
      {renderHistoryDropdown()}
      <PrivacyBanner activeFilePath={editorState.filePath} />
      {messages.length >= 4 && streaming === null && !runningTools && (
        <TimelineScrubber
          totalMessages={messages.length}
          scrubIndex={scrubIndex}
          onScrub={(i) => setScrubIndex(i)}
          onReset={() => setScrubIndex(null)}
          onBranch={
            scrubIndex !== null && aiChatId
              ? () => {
                  // Find the LATEST user message at or before
                  // scrubIndex — branch from there so the new chat
                  // ends with a user prompt ready to send.
                  for (let i = scrubIndex; i >= 0; i--) {
                    if (messages[i].role === "user") {
                      branchFromHere(i);
                      setScrubIndex(null);
                      return;
                    }
                  }
                }
              : undefined
          }
        />
      )}
      <div className="ai-messages-wrap">
      <ChatNavRail scrollRef={scrollRef} version={display.length} />
      {showJumpToBottom && (
        <button
          className="ai-jump-to-bottom"
          onClick={() => {
            const el = scrollRef.current;
            if (!el) return;
            scrollToBottom(el);
            pinActiveRef.current = false;
            stickyBottomRef.current = true;
            setShowJumpToBottom(false);
          }}
          title="Jump to latest"
          aria-label="Jump to latest message"
        >
          <Icon name="chevron-down" size={14} />
        </button>
      )}
      <div className="ai-messages" ref={scrollRef}>
        {display.length === 0 && (
          <>
            <div className="ai-welcome">
              <div className="ai-welcome-title">What's on your mind?</div>
              <div className="ai-welcome-sub">
                Ask anything about the active file — its contents are sent
                as context. Or pick a starter:
              </div>
            </div>
            <div className="ai-quick-prompts">
              {[
                {
                  label: "Explain this code",
                  desc: "Walk through what it does",
                  prompt: "Explain what this file does, in simple terms.",
                },
                {
                  label: "Find bugs",
                  desc: "Spot logic errors and edge cases",
                  prompt:
                    "Are there bugs or logic errors in this file? Be specific.",
                },
                {
                  label: "Suggest refactor",
                  desc: "Improve readability or correctness",
                  prompt:
                    "Suggest a refactor that would improve readability or correctness. Show the proposed change.",
                },
                {
                  label: "Write tests",
                  desc: "Generate unit tests",
                  prompt:
                    "Suggest unit tests for the functions in this file.",
                },
                {
                  label: "Add types",
                  desc: "Improve type annotations",
                  prompt:
                    "Suggest type annotations or improvements to existing types.",
                },
                {
                  label: "Summarize",
                  desc: "Key responsibilities in 3–5 bullets",
                  prompt:
                    "Summarize the key responsibilities of this file in 3-5 bullets.",
                },
              ].map((q) => (
                <button
                  key={q.label}
                  className="ai-quick-card"
                  onClick={() => setInput(q.prompt)}
                >
                  <span className="ai-quick-card-title">{q.label}</span>
                  <span className="ai-quick-card-desc">{q.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}
        {(() => {
          // Build a lookup of tool results by call id so each tool_call
          // row can render its result inline (Claude-Code-style). Two
          // sources to merge:
          //   1. Standalone `tool` role messages (Ollama / OpenAI flow,
          //      where Codetta itself runs the tool and posts the result
          //      back as the next message).
          //   2. The `tool_results` array on assistant messages (Claude
          //      Code flow, where the agent ran the tool internally and
          //      we received its result via the same stream).
          const toolResultsById = new Map<string, string>();
          for (const msg of display) {
            if (msg.role === "tool" && msg.tool_call_id) {
              toolResultsById.set(msg.tool_call_id, msg.content);
            }
            if (msg.role === "assistant" && msg.tool_results) {
              for (const tr of msg.tool_results) {
                if (tr.tool_use_id) {
                  toolResultsById.set(tr.tool_use_id, tr.content);
                }
              }
            }
          }
          const userTurnByIdx = new Map<number, number>();
          let userTurn = 0;
          for (let j = 0; j < display.length; j++) {
            if (display[j].role === "user") {
              userTurnByIdx.set(j, ++userTurn);
            }
          }
          const renderAt = (i: number) => {
          const m = display[i];
          const isAssistant = m.role === "assistant";
          const isStreamingThis = isAssistant && i === display.length - 1 && streaming !== null;
          const bodyForRender = isAssistant
            ? stripBrainSaveBlocks(m.content)
            : m.content;
          const brainProposal =
            isAssistant && !isStreamingThis
              ? (m.brain_save ?? parseBrainSaveProposal(m.content))
              : null;
          const blocks = isAssistant ? extractCodeBlocks(bodyForRender) : [];
          const insertText = blocks.length > 0 ? blocks.join("\n\n") : bodyForRender;
          const taggedBlocks = isAssistant
            ? extractTaggedCodeBlocks(bodyForRender)
            : [];
          const shellBlocks = taggedBlocks.filter((b) => isShellLang(b.lang));
          const shellText = shellBlocks.map((b) => b.code).join("\n");
          const split = isAssistant
            ? splitThinking(bodyForRender)
            : { thinking: "", visible: m.content };
          const showThinking =
            isStreamingThis && m.content.length === 0 && !m.tool_calls;
          // Collapse long, older assistant messages by default. Keep the most
          // recent one + currently-streaming one fully visible.
          const isLatest = i === display.length - 1;
          const COLLAPSE_THRESHOLD = 600;
          const COLLAPSE_PREVIEW = 320;
          const expanded = expandedMsgIdx.has(i);
          const shouldCollapse =
            isAssistant &&
            !isLatest &&
            !isStreamingThis &&
            !expanded &&
            split.visible.length > COLLAPSE_THRESHOLD;
          const visibleContent = shouldCollapse
            ? split.visible.slice(0, COLLAPSE_PREVIEW) + "…"
            : split.visible;
          // While streaming, the model may be emitting raw tool-call JSON or
          // echoing the investigation plan. Hide that ugliness behind a
          // placeholder until streaming finishes (the parser cleans it up).
          const trimmedStream = visibleContent.trim();
          const looksLikeToolJunk =
            isStreamingThis &&
            trimmedStream.length > 0 &&
            (trimmedStream.startsWith("{") ||
              trimmedStream.startsWith("[") ||
              trimmedStream.startsWith("ROUND ") ||
              /\{\s*"name"\s*:/.test(trimmedStream) ||
              /\{\s*"arguments"/.test(trimmedStream) ||
              /<tool_call>/i.test(trimmedStream));
          if (m.role === "tool") {
            // Tool results are now rendered inline, attached to their
            // matching tool_call row in the parent assistant message.
            // Only show standalone if the result has no matching call
            // (orphan / safety net).
            if (m.tool_call_id && toolResultsById.has(m.tool_call_id)) {
              return null;
            }
            if (/^Unknown tool:/i.test(m.content)) return null;
            return (
              <details key={i} className="ai-msg ai-msg-tool">
                <summary className="ai-tool-summary">
                  <span className="ai-tool-icon">
                    <Icon name="file-text" size={12} />
                  </span>
                  Tool result
                  <span className="ai-tool-meta">
                    {m.content.length} chars
                  </span>
                </summary>
                <pre className="ai-tool-body">{m.content}</pre>
              </details>
            );
          }
          const dimmedByScrub = scrubIndex !== null && i > scrubIndex;
          if (m.role === "user") return null;
          const composeFileCalls =
            m.role === "assistant" && m.tool_calls
              ? m.tool_calls.filter((c) => extractEditDiffs(c) !== null)
              : [];
          const showComposeCard = composeFileCalls.length >= 1;
          const msgHasBlocks = !!(m.blocks && m.blocks.length > 0);
          return (
            <div
              key={i}
              className={`ai-msg ai-msg-${m.role}${dimmedByScrub ? " ai-msg-scrubbed-past" : ""}`}
              data-anchor-idx={i}
              data-anchor-role={m.role}
              data-anchor-preview={undefined}
            >
              <span className="ai-msg-role">
                {
                  // Jack: il PM-papero con cui Alek dialoga (Quack v1 identity)
                  <>
                    <img
                      className="ai-msg-avatar"
                      src="/jack.jpeg"
                      alt=""
                      aria-hidden="true"
                    />
                    <span className="ai-msg-identity">
                      <span className="ai-msg-name">Jack</span>
                      <span className="ai-msg-title">Project Manager</span>
                    </span>
                  </>
                }
              </span>
              {m.tool_calls && m.tool_calls.length > 0 && (() => {
                if (msgHasBlocks && !showComposeCard) return null;
                const otherCalls = m.tool_calls.filter(
                  (c) => extractEditDiffs(c) === null,
                );
                const rows = msgHasBlocks
                  ? []
                  : showComposeCard
                    ? otherCalls
                    : m.tool_calls;
                if (rows.length === 0) return null;
                return (
                  <div className="ai-tcalls">
                    {rows.map((c, j) => (
                      <ToolCallRow
                        key={c.id ?? j}
                        call={c}
                        result={c.id ? toolResultsById.get(c.id) : undefined}
                      />
                    ))}
                  </div>
                );
              })()}
              {/* InterleavedBlocks renders reasoning inline — skip the outer
                  duplicate when a blocks log exists (was only gated on compact). */}
              {!(m.blocks && m.blocks.length > 0) &&
                isAssistant &&
                split.thinking.length > 0 && (
                  <ReasoningTurnChip text={split.thinking} />
                )}
              <div className="ai-msg-body">
                {m.images && m.images.length > 0 && (
                  <div className="ai-msg-images">
                    {m.images.map((img, idx) => (
                      <img
                        key={idx}
                        className="ai-msg-image"
                        src={img.thumb}
                        alt={img.name}
                        title={img.name}
                        onClick={() => void openZoom(img)}
                      />
                    ))}
                  </div>
                )}
                {showThinking ? (
                  <span className="ai-thinking">
                    <span className="ai-spinner" /> Thinking…
                  </span>
                ) : looksLikeToolJunk ? (
                  <span className="ai-thinking">
                    <span className="ai-spinner" /> Preparing tool call…
                  </span>
                ) : isAssistant && m.blocks && m.blocks.length > 0 ? (
                  // Chronological render so narration stays attached to the
                  // action it introduces. Tool runs collapse into Conductor-
                  // style `.ai-iarow` chips in every surface (editor + agent).
                  <InterleavedBlocks
                    blocks={m.blocks}
                    hideEdits={showComposeCard}
                    onFileOpen={openChatFile}
                    callsById={
                      new Map(
                        (m.tool_calls ?? [])
                          .filter((c): c is ToolCall & { id: string } =>
                            typeof c.id === "string",
                          )
                          .map((c) => [c.id, c]),
                      )
                    }
                    resultsById={(() => {
                      const out = new Map<string, string>();
                      for (const tr of m.tool_results ?? []) {
                        if (tr.tool_use_id) out.set(tr.tool_use_id, tr.content);
                      }
                      return out;
                    })()}
                    erroredIds={(() => {
                      const out = new Set<string>();
                      for (const tr of m.tool_results ?? []) {
                        if (tr.tool_use_id && tr.is_error)
                          out.add(tr.tool_use_id);
                      }
                      return out;
                    })()}
                    streaming={isStreamingThis}
                  />
                ) : isAssistant ? (
                  <>
                    <MarkdownPreview
                      content={balanceFences(visibleContent)}
                      onFileOpen={openChatFile}
                    />
                    {shouldCollapse && (
                      <button
                        className="ai-show-more"
                        onClick={() => {
                          setExpandedMsgIdx((s) => new Set(s).add(i));
                        }}
                      >
                        Show {split.visible.length - COLLAPSE_PREVIEW} more chars
                      </button>
                    )}
                    {!shouldCollapse &&
                      isAssistant &&
                      !isLatest &&
                      !isStreamingThis &&
                      split.visible.length > COLLAPSE_THRESHOLD && (
                        <button
                          className="ai-show-more"
                          onClick={() => {
                            setExpandedMsgIdx((s) => {
                              const next = new Set(s);
                              next.delete(i);
                              return next;
                            });
                          }}
                        >
                          Show less
                        </button>
                      )}
                  </>
                ) : (
                  m.content
                )}
              </div>
              {brainProposal && brainProposal.status !== "dismissed" && (
                <BrainSaveChip
                  wsId={wsId}
                  proposal={brainProposal}
                  onChange={(next) => {
                    setMessages((msgs) =>
                      msgs.map((msg, j) =>
                        j === i ? { ...msg, brain_save: next } : msg,
                      ),
                    );
                  }}
                />
              )}
              {showComposeCard && isAssistant && (
                <div className="ai-compose-foot">
                  <ComposeCard
                    wsId={wsId}
                    chatId={aiChatId}
                    msgIndex={i}
                    calls={composeFileCalls}
                    streaming={isStreamingThis}
                  />
                </div>
              )}
              {isAssistant && !isStreamingThis && m.content.length > 0 && (
                <div className="ai-msg-actions">
                  <button
                    className="ai-msg-action"
                    onClick={() => {
                      void navigator.clipboard.writeText(m.content);
                      toastSuccess("Copied to clipboard");
                    }}
                    title="Copy message"
                  >
                    <Icon name="copy" size={12} />
                    <span>Copy</span>
                  </button>
                  {blocks.length > 0 && (
                    <button
                      className="ai-msg-action"
                      onClick={() => {
                        void navigator.clipboard.writeText(blocks.join("\n\n"));
                        toastSuccess(
                          `Copied ${blocks.length} code block${blocks.length === 1 ? "" : "s"}`,
                        );
                      }}
                      title="Copy code blocks only"
                    >
                      <Icon name="code" size={12} />
                      <span>Copy code</span>
                    </button>
                  )}
                  <button
                    className="ai-msg-action"
                    onClick={() => {
                      const ok = insertIntoActiveEditor(insertText);
                      if (ok) toastSuccess("Inserted at cursor");
                      else toastError("No active editor");
                    }}
                    title="Insert at cursor / replace selection"
                  >
                    <Icon name="arrow-down-right" size={12} />
                    <span>Insert</span>
                  </button>
                  {shellBlocks.length > 0 && (
                    <button
                      className="ai-msg-action ai-msg-action-run"
                      onClick={async () => {
                        const ok = await dialogConfirm(
                          `Run ${shellBlocks.length} shell command${shellBlocks.length === 1 ? "" : "s"} in the active terminal?\n\n${shellText.slice(0, 800)}${shellText.length > 800 ? "\n…" : ""}`,
                          {
                            title: "Run in terminal",
                            okLabel: "Run",
                            cancelLabel: "Cancel",
                          },
                        );
                        if (ok) await runInActiveTerminal(shellText);
                      }}
                      title="Run the shell command(s) in the active terminal"
                    >
                      <Icon name="play" size={12} />
                      <span>Run</span>
                    </button>
                  )}
                  {isLatest && (
                    <button
                      className="ai-msg-action"
                      onClick={() => void goDeeper()}
                      title="Ask the model to investigate further and expand the answer"
                      disabled={streaming !== null || runningTools}
                    >
                      <Icon name="arrow-down-circle" size={12} />
                      <span>Go deeper</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
          };
          const turns = groupChatTurns(display);
          return turns.map((turn) => (
            <div
              key={turn.userIdx ?? `lead-${turn.followIdxs[0] ?? 0}`}
              className="ai-turn"
            >
              {turn.userIdx !== null && (() => {
                const i = turn.userIdx;
                const m = display[i];
                const dimmed = scrubIndex !== null && i > scrubIndex;
                return (
                  <>
                    <UserTurnBar
                      key={i}
                      zIndex={userTurnByIdx.get(i) ?? 1}
                      anchorIdx={i}
                      dimmed={dimmed}
                      content={m.content}
                      images={m.images}
                      actionsDisabled={streaming !== null || runningTools}
                      showBranch={!!aiChatId}
                      onCopy={() => {
                        void navigator.clipboard.writeText(m.content);
                        toastSuccess("Copied to clipboard");
                      }}
                      onRegen={() => void regenerateFrom(i)}
                      onBranch={() => branchFromHere(i)}
                      onImageClick={(img) => void openZoom(img)}
                    />
                    {m.brain_usage && (
                      <BrainTurnChip wsId={wsId} root={root} usage={m.brain_usage} />
                    )}
                  </>
                );
              })()}
              {turn.followIdxs.map((i) => renderAt(i))}
            </div>
          ));
        })()}
        {pendingPermission && (
          <PermissionCard
            call={pendingPermission.call}
            onResolve={(decision) => pendingPermission.resolve(decision)}
          />
        )}
      </div>
      </div>
      {attachTree && (
        <div
          className="ai-context-indicator"
          title="Project file tree will be attached to your next message — click to cancel"
          onClick={() => setAttachTree(false)}
          role="button"
        >
          <span className="ai-context-dot" />
          Project file tree attached (one-shot)
          <span className="ai-context-toggle">cancel</span>
        </div>
      )}
      {attachTerminal && (
        <div
          className="ai-context-indicator"
          title="Active terminal output will be attached to your next message — click to cancel"
          onClick={() => setAttachTerminal(false)}
          role="button"
        >
          <span className="ai-context-dot" />
          Terminal output attached (one-shot)
          <span className="ai-context-toggle">cancel</span>
        </div>
      )}
      {attachedAgents.length > 0 && (
        <div className="ai-agent-chips" role="status">
          {attachedAgents.map((name) => {
            const def = agents.find((a) => a.name === name);
            return (
              <span key={name} className="ai-agent-chip" title={def?.description}>
                {def && (
                  <img
                    className="ai-agent-chip-avatar"
                    src={def.avatar}
                    alt=""
                    aria-hidden="true"
                  />
                )}
                {name}
                <button
                  className="ai-agent-chip-x"
                  onClick={() =>
                    setAttachedAgents((prev) => prev.filter((n) => n !== name))
                  }
                  title={`Don't delegate to ${name}`}
                  aria-label={`Remove ${name}`}
                >
                  <Icon name="x" size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      {mentionState && mentionMatches.length > 0 && streaming === null && (
        <MentionSuggestions
          matches={mentionMatches}
          activeIndex={mentionIndex}
          onPick={acceptMention}
          onHover={setMentionIndex}
        />
      )}
      {(() => {
        const isSlash = input.startsWith("/");
        if (!isSlash || streaming !== null) return null;
        // Value submenu ("/effort " → pick low/medium/…) wins over the
        // command list once the command name is complete.
        const argMenu = slashArgMenu();
        if (argMenu) {
          if (argMenu.length === 0) return null;
          const aidx = Math.max(0, Math.min(slashIndex, argMenu.length - 1));
          return (
            <div className="ai-slash-suggestions">
              {argMenu.map((c, i) => (
                <button
                  key={c.name}
                  className={`ai-slash-item ${i === aidx ? "active" : ""}`}
                  onMouseEnter={() => setSlashIndex(i)}
                  onClick={() => {
                    setInput("");
                    c.run();
                  }}
                >
                  <span className="ai-slash-name">{c.name}</span>
                  <span className="ai-slash-hint">{c.hint}</span>
                </button>
              ))}
            </div>
          );
        }
        const q = input.split(/\s+/)[0].slice(1).toLowerCase();
        const matches = slashMatchesFor(q);
        if (matches.length === 0) return null;
        const idx = Math.max(0, Math.min(slashIndex, matches.length - 1));
        return (
          <div className="ai-slash-suggestions">
            {matches.map((c, i) => (
              <button
                key={c.name}
                className={`ai-slash-item ${i === idx ? "active" : ""} ${
                  c.kind === "skill" ? "ai-slash-item-skill" : ""
                }`}
                onMouseEnter={() => setSlashIndex(i)}
                onClick={() =>
                  c.kind === "local"
                    ? runSlashCommand(c.cmd)
                    : sendCcCommand(c.name)
                }
              >
                {c.kind === "skill" && (
                  <span className="ai-slash-skill-ico" aria-hidden="true">
                    <Icon name="zap" size={14} />
                  </span>
                )}
                <span className="ai-slash-name">{c.name}</span>
                {c.kind !== "skill" && (
                  <span className="ai-slash-hint">{c.hint}</span>
                )}
              </button>
            ))}
          </div>
        );
      })()}
      {/* /usage report modal — chat stays untouched. */}
      {usageReport &&
        (() => {
          const fmtTok = (n: number) =>
            n >= 1_000_000
              ? `${(n / 1_000_000).toFixed(1)}M`
              : n >= 1_000
                ? `${(n / 1_000).toFixed(1)}k`
                : String(n);
          const r = usageReport;
          return (
            <div
              className="settings-backdrop"
              onMouseDown={() => setUsageReport(null)}
            >
              <div
                className="usage-modal"
                role="dialog"
                aria-label="AI usage"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <div className="usage-head">
                  <strong>Account &amp; Usage</strong>
                  <button
                    className="usage-close"
                    onClick={() => setUsageReport(null)}
                    title="Close (Esc)"
                  >
                    ✕
                  </button>
                </div>
                <div className="usage-body">
                  {r.account && (
                    <>
                      <div className="usage-section-title">Account</div>
                      <div className="usage-kv">
                        {r.account.name && (
                          <div className="usage-kv-row">
                            <span>Name</span>
                            <span>{r.account.name}</span>
                          </div>
                        )}
                        {r.account.email && (
                          <div className="usage-kv-row">
                            <span>Email</span>
                            <span>{r.account.email}</span>
                          </div>
                        )}
                        {r.account.plan && (
                          <div className="usage-kv-row">
                            <span>Plan</span>
                            <span>{r.account.plan}</span>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                  {r.limits.length > 0 && (
                    <>
                      <div className="usage-section-title">
                        Plan limits — live
                      </div>
                      {r.limits.map((w) => {
                        const resetsIn = (() => {
                          if (!w.resetsAt) return null;
                          const ms =
                            new Date(w.resetsAt).getTime() - Date.now();
                          if (ms <= 0) return null;
                          const h = ms / 3_600_000;
                          if (h < 1) return `${Math.ceil(ms / 60_000)}m`;
                          if (h < 48) return `${Math.ceil(h)}h`;
                          return `${Math.ceil(h / 24)}d`;
                        })();
                        const hot = w.pct >= 80;
                        return (
                          <div key={w.label} className="usage-window">
                            <div className="usage-window-head">
                              <span>{w.label}</span>
                              <span className="usage-window-pct">
                                {Math.round(w.pct)}%
                              </span>
                            </div>
                            <div className="usage-bar">
                              <div
                                className={`usage-bar-fill ${hot ? "hot" : ""}`}
                                style={{
                                  width: `${Math.min(100, Math.max(0, w.pct))}%`,
                                }}
                              />
                            </div>
                            {resetsIn && (
                              <div className="usage-window-reset">
                                Resets in {resetsIn}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {r.extra && (
                        <div className="usage-window">
                          <div className="usage-window-head">
                            <span>Extra usage (monthly)</span>
                            {/* used_credits / monthly_limit arrive in
                                CENTS (4720/10000 + utilization 47.2%
                                = $47.20 of $100). */}
                            <span className="usage-window-pct">
                              ${(r.extra.used / 100).toFixed(2)} / $
                              {(r.extra.limit / 100).toFixed(2)}{" "}
                              {r.extra.currency}
                            </span>
                          </div>
                          <div className="usage-bar">
                            <div
                              className={`usage-bar-fill ${r.extra.pct >= 80 ? "hot" : ""}`}
                              style={{
                                width: `${Math.min(100, Math.max(0, r.extra.pct))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                  {r.limitsError && (
                    <div className="usage-meta">
                      Live plan limits unavailable: {r.limitsError}
                    </div>
                  )}
                  <div className="usage-section-title">
                    Quack — API-billed spend
                  </div>
                  <div className="usage-cards">
                    <div className="usage-card">
                      <span className="usage-card-num">
                        ${r.local.chat.toFixed(4)}
                      </span>
                      <span className="usage-card-label">this chat</span>
                    </div>
                    <div className="usage-card">
                      <span className="usage-card-num">
                        ${r.local.today.toFixed(2)}
                      </span>
                      <span className="usage-card-label">today</span>
                    </div>
                    <div className="usage-card">
                      <span className="usage-card-num">
                        ${r.local.wsMonth.toFixed(2)}
                      </span>
                      <span className="usage-card-label">
                        workspace · month
                      </span>
                    </div>
                    <div className="usage-card">
                      <span className="usage-card-num">
                        ${r.local.month.toFixed(2)}
                      </span>
                      <span className="usage-card-label">all · month</span>
                    </div>
                  </div>
                  <div className="usage-section-title">
                    Claude Code CLI — all projects, lifetime
                  </div>
                  {r.cli ? (
                    <>
                      {(r.cli.sessions != null ||
                        r.cli.messages != null) && (
                        <div className="usage-meta">
                          {r.cli.sessions ?? "?"} sessions ·{" "}
                          {r.cli.messages ?? "?"} messages
                        </div>
                      )}
                      <table className="usage-table">
                        <thead>
                          <tr>
                            <th>Model</th>
                            <th className="num">In</th>
                            <th className="num">Out</th>
                            <th className="num">Today</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.cli.models.map((m) => {
                            const today = r.cli!.today.find(
                              (t) => t.model === m.model,
                            );
                            return (
                              <tr key={m.model}>
                                <td title={m.model}>
                                  {m.model.replace(/^claude-/, "")}
                                </td>
                                <td className="num">{fmtTok(m.tokIn)}</td>
                                <td className="num">{fmtTok(m.tokOut)}</td>
                                <td className="num">
                                  {today ? fmtTok(today.tokens) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </>
                  ) : (
                    <div className="usage-meta">
                      No CLI stats cache found (~/.claude/stats-cache.json).
                    </div>
                  )}
                </div>
                <div className="usage-foot">
                  <span>
                    Plan limits are live from your claude.ai account.
                    Subscription turns bill $0 in the spend cards.
                  </span>
                  <button
                    className="usage-dash-btn"
                    onClick={() => {
                      setUsageReport(null);
                      openSettings("ai-usage-cross-chat-dashboard");
                    }}
                  >
                    Full dashboard
                  </button>
                </div>
              </div>
            </div>
          );
        })()}
      {/* Docked question card: when Claude's turn ended on an
          AskUserQuestion, the interactive radio/checkbox card sits
          right above the composer where the user is already looking —
          not floating over the conversation. */}
      {pendingAskCall && (
        <div className="ai-ask-dock">
          <AskQuestionCard
            key={pendingAskCall.id ?? "ask"}
            call={pendingAskCall}
            onAnswer={answerQuestion}
            onOther={() => inputRef.current?.focus()}
            onDismiss={() => setDismissedAskId(pendingAskCall.id ?? "ask")}
          />
        </div>
      )}
      {/* Plan chip above the composer (astronave-style): collapsed by default,
          expands upward on click. In compact (agent) mode the checklist lives
          in the sidebar Tasks section, so we skip the duplicate here. */}
      {!compact && todos && todos.length > 0 && (
        <div className="ai-todos-bar">
          <TodosCard items={todos} />
        </div>
      )}
      {selectedIsCC &&
        claudeCodeAvailable &&
        claudeAuth &&
        claudeAuth.status !== "signed_in" && <ClaudeLoginBanner />}
      {/* Live turn status + per-project context files — docked above composer. */}
      {showComposerDock && (
        <div className="ai-status-dock" aria-live="polite">
          <div className="ai-status-dock-row">
            <div className="ai-inline-status">
              {turnActive && (
                <TurnStreamStatus
                  runningTools={runningTools}
                  streaming={streaming}
                  streamingBlocks={streamingBlocks}
                  activeToolLabels={activeToolLabels}
                  tokensPerSec={tokensPerSec}
                  warmingUp={warmingUp}
                  lastStreamEventAt={lastStreamEventAt}
                  onStop={() => stop()}
                />
              )}
            </div>
            <ContextFilesDock wsId={wsId} root={root} />
          </div>
        </div>
      )}
      {/* Cursor-style composer: one pill. CSS `order` puts the textarea
          row on top and the controls (model/effort/thinking) below;
          permission/queue cards float to the top when present. */}
      {sessionId ? (
        <AgentCommitDock wsId={wsId} sessionId={sessionId} root={root} />
      ) : null}
      <div
        className={`ai-composer-shell${dictating ? " dictating" : ""}${fileDropHover ? " file-drop-over" : ""}`}
        ref={composerShellRef}
        {...{ [COMPOSER_FILE_DROP_ATTR]: "" }}
      >
      <ComposerContextBar wsId={wsId} root={root} />
      <ComposerGitActions
        wsId={wsId}
        root={root}
        suggestedMessage={input.trim() || undefined}
      />
      {selectedIsCC && (
        <div className="ai-context-ring-dock">
          <SessionUsageCircle
            pct={displayRingPct}
            contextPct={displayContextSnap.pct}
            contextUsed={displayContextSnap.used}
            contextWindow={displayContextSnap.window}
            contextEstimate={displayContextSnap.estimate}
            planPct={sessionPct}
            planResetsIn={fmtResetsIn(sessionResetsAt)}
            onClick={() => setSessionDrawerOpen(true)}
          />
        </div>
      )}
      <div className="ai-composer-meta">
        <button
          type="button"
          className="ai-attach-btn"
          onClick={() => attachInputRef.current?.click()}
          title="Attach images"
          aria-label="Attach images"
        >
          <Icon name="plus" size={16} />
        </button>
        <SubagentPill
          agents={agents}
          active={activeAgent}
          onSelect={selectAgent}
          disabled={!selectedIsCC}
        />
        <div className="ai-composer-spacer" />
        {renderModelChip()}
        {parseQualifiedModel(selected)?.providerId === "claude-code" && (
          <EffortPopover
            effort={ccEffort}
            pulseToken={effortPulseToken}
            onEffort={(v) => applyCcEffort(v)}
            thinking={ccThinking}
            onThinking={(v) => {
              setCcThinking(v);
              toastInfo(
                v === null
                  ? "Extended thinking: auto"
                  : v
                    ? "Extended thinking: on (from your next message)"
                    : "Extended thinking: off (from your next message)",
              );
            }}
          />
        )}
        {selectedIsCC && (
          <div className="ai-mode-wrap">
            {modeMenuOpen && (
              <>
                <div
                  className="ai-mode-backdrop"
                  onClick={() => setModeMenuOpen(false)}
                />
                <div className="ai-mode-menu" role="menu">
                  {(
                    [
                      {
                        v: null,
                        label: "Ask",
                        desc: "Confirm each edit / command",
                      },
                      {
                        v: "plan",
                        label: "Plan",
                        desc: "Plan only — no edits",
                      },
                      {
                        v: "acceptEdits",
                        label: "Auto-edit",
                        desc: "Auto-accept file edits, ask for the rest",
                      },
                      {
                        v: "auto",
                        label: "Auto",
                        desc: "Run everything without asking (privacy guard stays)",
                      },
                      {
                        v: "bypassPermissions",
                        label: "Bypass",
                        desc: "Skip all permission checks — no cards, no guard",
                      },
                    ] as Array<{ v: string | null; label: string; desc: string }>
                  ).map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      className={`ai-mode-item ${ccPermMode === o.v ? "active" : ""}`}
                      onClick={() => {
                        setCcPermMode(o.v);
                        setModeMenuOpen(false);
                        toastInfo(
                          `Mode: ${o.label} (applies from the next message)`,
                        );
                      }}
                    >
                      <span className="ai-mode-item-label">
                        {ccPermMode === o.v ? "● " : ""}
                        {o.label}
                      </span>
                      <span className="ai-mode-item-desc">{o.desc}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            <button
              type="button"
              className="ai-mode-btn"
              onClick={() => setModeMenuOpen((v) => !v)}
              title="Claude Code permission mode (also /mode)"
            >
              {ccPermMode === "plan"
                ? "Plan"
                : ccPermMode === "acceptEdits"
                  ? "Auto-edit"
                  : ccPermMode === "auto"
                    ? "Auto"
                    : ccPermMode === "bypassPermissions"
                      ? "Bypass"
                      : "Ask"}{" "}
              ▾
            </button>
          </div>
        )}
        <ComposerMic
          onStart={(capture) => {
            dictationCaptureRef.current = capture;
            setDictating(true);
          }}
          disabled={dictating}
        />
        {streaming !== null || runningTools ? (
          <button
            className="ai-send-btn ai-stop-btn"
            onClick={stop}
            title="Stop (Esc)"
            aria-label="Stop"
          >
            <Icon name="stop" size={16} />
          </button>
        ) : (
          <button
            className="primary ai-send-btn"
            onClick={() => void send()}
            disabled={!input.trim() || !selected}
            title="Send (Enter)"
            aria-label="Send"
          >
            <Icon name="arrow-up" size={16} />
          </button>
        )}
      </div>
      {/* Inline permission card — replaces the old full-window overlay.
          Renders nothing when there are no pending requests; otherwise
          shows the request just above the input where the user is
          already focused, instead of dimming the whole window. */}
      <ClaudePermissionOverlay
        ownerRoot={root}
        ownerSessionId={claudeSessionId}
        ownerStreaming={streaming !== null || runningTools}
        onAllowAll={() => setCcPermMode("auto")}
      />
      <ComposerQueue
        messages={queuedMessages}
        turnActive={turnActive}
        onSendNow={sendQueuedNow}
        onMultitask={multitaskQueued}
        onRemove={removeQueueAt}
      />
      {attachedImages.length > 0 && (
        <div className="ai-attach-strip">
          {attachedImages.map((att) => (
            <div key={att.id} className="ai-attach-thumb" title={att.name}>
              <img
                src={att.thumb}
                alt={att.name}
                onClick={() => void openZoom(att)}
              />
              <button
                className="ai-attach-remove"
                aria-label="Rimuovi immagine"
                title="Rimuovi"
                onClick={() => removeImage(att.id)}
              >
                <Icon name="x" size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="ai-input-row">
        {dictating && dictationCaptureRef.current ? (
          <ComposerDictationBar
            capturePromise={dictationCaptureRef.current}
            onConfirm={(text) => {
              dictationCaptureRef.current = null;
              setDictating(false);
              if (!text) return;
              setInput((v) =>
                v.trim() ? `${v.replace(/\s+$/, "")} ${text}` : text,
              );
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            onCancel={() => {
              dictationCaptureRef.current = null;
              setDictating(false);
            }}
          />
        ) : (
        <>
        <textarea
          ref={inputRef}
          className="ai-input"
          rows={2}
          placeholder={
            streaming !== null || runningTools
              ? "Send follow-up"
              : `Message ${activeAgent ? activeAgent.name : "Jack"}…`
          }
          value={input}
          onPaste={(e) => {
            // Image paste (Cmd+V): pull any image items out of the
            // clipboard before the text-fence logic runs. Attaching wins
            // over pasting their (usually empty) text representation.
            const imageItems = Array.from(e.clipboardData.items).filter((it) =>
              it.type.startsWith("image/"),
            );
            if (imageItems.length > 0) {
              e.preventDefault();
              const blobs = imageItems
                .map((it) => it.getAsFile())
                .filter((f): f is File => f !== null);
              void appendImages(
                blobs.map((b) => ({
                  kind: "blob" as const,
                  blob: b,
                  name: b.name || "pasted",
                })),
              );
              return;
            }
            // Auto-fence multi-line code paste so the model sees a
            // properly-delimited code block instead of free-form text
            // that breaks markdown rendering. Heuristic: 4+ lines AND
            // either visible indentation, common code punctuation, or
            // a recognisable language keyword. Skipped when the cursor
            // is already inside an unclosed fence — the user is
            // continuing an existing block.
            const pasted = e.clipboardData.getData("text/plain");
            const lines = pasted.split(/\r?\n/);
            if (lines.length < 4) return;
            const hasIndent = lines.filter((l) => /^[ \t]/.test(l)).length >= 2;
            const hasCodePunct = /[{};]|=>|::/.test(pasted);
            const hasKeyword =
              /\b(?:function|class|interface|import|export|const|let|var|def|fn|impl|struct|enum|public|private|return|if|else|for|while|async|await)\b/.test(
                pasted,
              );
            if (!(hasIndent || hasCodePunct || hasKeyword)) return;
            // Don't double-fence inside an already-open fence. Count
            // ``` markers in the input up to the cursor — odd means
            // we're inside one.
            const target = e.currentTarget;
            const cursor = target.selectionStart ?? input.length;
            const before = input.slice(0, cursor);
            const fenceCount = (before.match(/```/g) ?? []).length;
            if (fenceCount % 2 === 1) return;
            e.preventDefault();
            const after = input.slice(target.selectionEnd ?? cursor);
            // Newlines around the fence so it stays in its own
            // paragraph regardless of where the cursor was.
            const prefix = before.length === 0 || before.endsWith("\n") ? "" : "\n";
            const suffix = after.length === 0 || after.startsWith("\n") ? "" : "\n";
            const block = `${prefix}\`\`\`\n${pasted}\n\`\`\`${suffix}`;
            const next = before + block + after;
            setInput(next);
            // Drop cursor after the closing fence so the user can
            // continue typing without manually moving past the block.
            requestAnimationFrame(() => {
              const el = inputRef.current;
              if (!el) return;
              const pos = before.length + block.length;
              el.focus();
              try {
                el.setSelectionRange(pos, pos);
              } catch {
                /* ignore */
              }
            });
          }}
          onChange={(e) => {
            const v = e.target.value;
            const cursor = e.target.selectionStart ?? v.length;
            if (selectedIsCC && input.length === 0 && v.length > 0) {
              bumpEffortPulse();
            }
            setInput(v);
            setSlashIndex(0);
            // Any user-driven change (typing, paste) takes us out of
            // history mode so the next ArrowUp starts a fresh walk
            // from the most recent message instead of resuming a
            // stale cursor.
            if (historyIdx !== null) setHistoryIdx(null);
            // @-mention detection. Lazy-load the workspace file list
            // the first time we see one, then keep it cached for the
            // session — the user's working set rarely changes mid-chat
            // and a stale entry just means an extra second to find it.
            const m = parseMention(v, cursor);
            setMentionState(m);
            setMentionIndex(0);
            if (m && mentionFiles === null && root) {
              void search
                .listFiles(root, 5000)
                .then((list) => setMentionFiles(list))
                .catch(() => setMentionFiles([]));
            }
          }}
          onKeyDown={(e) => {
            // Esc while a request is in flight = stop. Always wins so the
            // user can bail out of long generations without reaching for
            // the mouse. (Escape with empty input also clears any pending
            // attachments — see below.)
            if (
              e.key === "Escape" &&
              (streaming !== null || runningTools)
            ) {
              e.preventDefault();
              stop();
              return;
            }
            // Escape on an empty composer clears staged image attachments.
            if (
              e.key === "Escape" &&
              input.length === 0 &&
              attachedImages.length > 0
            ) {
              e.preventDefault();
              setAttachedImages([]);
              return;
            }
            if (
              selectedIsCC &&
              e.ctrlKey &&
              !e.metaKey &&
              !e.altKey &&
              !e.shiftKey
            ) {
              const slot = Number(e.key);
              if (slot >= 1 && slot <= CC_EFFORTS.length) {
                e.preventDefault();
                applyCcEffort(CC_EFFORTS[slot - 1]);
                bumpEffortPulse();
                return;
              }
            }
            // @-mention popover navigation takes precedence over the
            // slash-command popover (they can't both be active — slash
            // requires the input to start with /).
            if (mentionState && mentionMatches.length > 0) {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setMentionIndex((i) => Math.min(mentionMatches.length - 1, i + 1));
                return;
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setMentionIndex((i) => Math.max(0, i - 1));
                return;
              }
              if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                e.preventDefault();
                const idx = Math.max(
                  0,
                  Math.min(mentionIndex, mentionMatches.length - 1),
                );
                acceptMention(mentionMatches[idx]);
                return;
              }
              if (e.key === "Escape") {
                e.preventDefault();
                setMentionState(null);
                return;
              }
            }
            const isSlash = input.startsWith("/");
            const firstWord = isSlash ? input.split(/\s+/)[0] : "";
            const exactCmd = isSlash
              ? SLASH_COMMANDS.find(
                  (c) => c.name.toLowerCase() === firstWord.toLowerCase(),
                )
              : undefined;
            // Exact Claude Code passthrough ("/compact", "/mycmd args")
            // typed in full — send it through on Enter even when the
            // suggestion list isn't showing.
            const exactCc =
              isSlash && !exactCmd
                ? ccCommands.find(
                    (c) => c.name.toLowerCase() === firstWord.toLowerCase(),
                  )
                : undefined;
            if (isSlash) {
              // Value submenu has priority — arrows pick a value,
              // Enter/Tab applies it immediately.
              const argMenu = slashArgMenu();
              if (argMenu && argMenu.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSlashIndex((i) => Math.min(i + 1, argMenu.length - 1));
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSlashIndex((i) => Math.max(i - 1, 0));
                  return;
                }
                if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
                  e.preventDefault();
                  const aidx = Math.max(
                    0,
                    Math.min(slashIndex, argMenu.length - 1),
                  );
                  setInput("");
                  argMenu[aidx].run();
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setInput("");
                  return;
                }
              }
              const q = firstWord.slice(1).toLowerCase();
              const matches = slashMatchesFor(q);
              if (matches.length > 0) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setSlashIndex((i) =>
                    Math.min(matches.length - 1, i + 1),
                  );
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setSlashIndex((i) => Math.max(0, i - 1));
                  return;
                }
                const idx = Math.max(
                  0,
                  Math.min(slashIndex, matches.length - 1),
                );
                const m = matches[idx];
                // Tab = autocomplete the command/skill name into the input
                // (keeping any args already typed) so the user can keep
                // typing the skill's argument — it does NOT run.
                if (e.key === "Tab") {
                  e.preventDefault();
                  const after = input.slice(firstWord.length).trimStart();
                  setInput(after ? `${m.name} ${after}` : `${m.name} `);
                  setSlashIndex(0);
                  return;
                }
                // Enter = run it (local action / prompt) or send it (cc / skill).
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (m.kind === "local") runSlashCommand(m.cmd);
                  else sendCcCommand(m.name);
                  return;
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setInput("");
                  return;
                }
              }
              // Exact-match command typed with arguments (e.g. "/file foo.ts")
              if (
                exactCmd &&
                (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey))
              ) {
                e.preventDefault();
                runSlashCommand(exactCmd);
                return;
              }
              if (exactCc && e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendCcCommand(exactCc.name);
                return;
              }
            }
            // Shell-style prompt history. ArrowUp on empty input or
            // already in history mode steps backward through past
            // user messages; ArrowDown steps forward and restores the
            // original draft when we walk past the most-recent entry.
            // Modifier keys skip it so we don't fight selection-
            // extending shortcuts.
            const noMods =
              !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey;
            if (e.key === "ArrowUp" && noMods) {
              const userMessages = messages.filter((m) => m.role === "user");
              if (userMessages.length === 0) {
                // Nothing to recall — fall through to the textarea's
                // native cursor-up movement.
              } else if (historyIdx === null && input.length > 0) {
                // Don't grab ArrowUp away from a user mid-edit. Same
                // rule as before: a non-empty draft means the user is
                // navigating within their text.
              } else {
                e.preventDefault();
                if (historyIdx === null) {
                  // Entering history mode — snapshot the current draft.
                  historyDraftRef.current = input;
                }
                const next = (historyIdx ?? -1) + 1;
                const clamped = Math.min(next, userMessages.length - 1);
                setHistoryIdx(clamped);
                // userMessages[length-1] is the most recent; idx 0
                // means "go one step back," so we walk from the end.
                setInput(userMessages[userMessages.length - 1 - clamped].content);
                return;
              }
            }
            if (e.key === "ArrowDown" && noMods && historyIdx !== null) {
              e.preventDefault();
              const userMessages = messages.filter((m) => m.role === "user");
              if (historyIdx <= 0) {
                // Walked back past the most recent — restore the draft
                // and exit history mode.
                setHistoryIdx(null);
                setInput(historyDraftRef.current);
                historyDraftRef.current = "";
              } else {
                const next = historyIdx - 1;
                setHistoryIdx(next);
                setInput(userMessages[userMessages.length - 1 - next].content);
              }
              return;
            }
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        {input.trim().length === 0 &&
          streaming === null &&
          !runningTools && (
            <div className="ai-composer-hint" aria-hidden="true">
              <span>@ mentions</span>
              <span>/ commands</span>
              {selectedIsCC && <span>Ctrl+1–5 effort</span>}
              <span>Shift+Enter for newline</span>
              <span>↑ to recall</span>
            </div>
          )}
        </>
        )}
        {/* Hidden picker driven by the composer "+" button. */}
        <input
          ref={attachInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) {
              void appendImages(
                files.map((f) => ({
                  kind: "blob" as const,
                  blob: f,
                  name: f.name || "image",
                })),
              );
            }
            e.target.value = "";
          }}
        />
      </div>
      </div>
      {aggregatedPullProgress && (
        <div className="ai-status-strip">
          <span className="ai-status-item ai-status-pull">
            {aggregatedPullProgress}
          </span>
        </div>
      )}
      {(lastUsage || chatTotalCost > 0) &&
        streaming === null &&
        !runningTools && (
          <div
            className="ai-usage-strip"
            title={
              lastUsage?.model
                ? `Last turn — ${lastUsage.model}`
                : "Chat usage"
            }
          >
            {lastUsage && <UsageChip usage={lastUsage} />}
            {chatTotalCost > 0 && (
              <span className="ai-usage-total">
                · chat total{" "}
                <strong>${chatTotalCost.toFixed(4)}</strong>
                {(() => {
                  const budget = readBudgetUsd();
                  if (budget <= 0) return null;
                  const pct = Math.min(
                    100,
                    Math.round((chatTotalCost / budget) * 100),
                  );
                  return (
                    <span
                      className={`ai-usage-budget ${pct >= 100 ? "over" : pct >= 80 ? "warn" : ""}`}
                      title={`Budget: $${budget.toFixed(2)}`}
                    >
                      {" "}({pct}% of ${budget.toFixed(2)})
                    </span>
                  );
                })()}
              </span>
            )}
          </div>
        )}
      {recentTps !== null && recentTps < 8 && streaming === null && !runningTools && (() => {
        // The slow-generation banner is meaningful only for LOCAL models
        // (Ollama). Cloud / agentic providers (Claude Code, OpenAI,
        // Anthropic) are not VRAM-bound, and the "smaller model" /
        // "cloud key" remediations don't apply — Claude Code IS the
        // cloud key, OpenAI/Anthropic are already cloud. Hide the
        // banner entirely for those providers.
        const p = parseQualifiedModel(selected ?? "")?.providerId ?? "ollama";
        if (p !== "ollama") return null;
        return (
          <div className="ai-slow-banner">
            Slow generation ({recentTps.toFixed(1)} t/s). Likely VRAM bound.{" "}
            <button
              className="ai-slow-banner-btn"
              onClick={() => {
                setBrowserOpen(true);
                setRecentTps(null);
              }}
            >
              Smaller model
            </button>{" "}
            ·{" "}
            <button
              className="ai-slow-banner-btn"
              onClick={() => {
                openSettings("ai-providers");
                setRecentTps(null);
              }}
            >
              Cloud key
            </button>
          </div>
        );
      })()}
      <ModelBrowser
        open={browserOpen}
        installedNames={
          new Set(
            allModels
              .filter((m) => m.providerId === "ollama")
              .map((m) => m.modelId),
          )
        }
        cloudModels={browserCloudModels}
        hasKey={modelHasKey}
        claudeCodeSignedIn={claudeAuth?.status === "signed_in"}
        onClaudeLogin={() => runCommand("terminal.claude_login")}
        selectedQualified={selected}
        pullProgressByName={pullProgressMap}
        onClose={() => setBrowserOpen(false)}
        onManageVisibility={() => {
          setBrowserOpen(false);
          setManageModelsOpen(true);
        }}
        onSelect={(q) => setSelected(q)}
        onPull={(name) => void pullSpecific(name)}
        onConfigureKey={() => {
          setBrowserOpen(false);
          openSettings("ai-providers");
        }}
        onInstallClaudeCode={async () => {
          const termId = useStore
            .getState()
            .addTerminal(wsId, "bottom", undefined);
          setTimeout(() => {
            const ws = useStore.getState().loaded[wsId];
            const t = ws?.terminals[termId];
            if (!t?.ptyId) return;
            void pty.write(
              t.ptyId,
              "npm install -g @anthropic-ai/claude-code\r",
            );
          }, 800);
          toastInfo(
            "Installing Claude Code via npm — when it finishes, run `claude /login`.",
          );
          setBrowserOpen(false);
          setTimeout(() => void refresh(), 15000);
          setTimeout(() => void refresh(), 30000);
        }}
        onInstallCursorCli={() => {
          void openUrl("https://cursor.com/docs/cli/overview");
          setBrowserOpen(false);
        }}
      />
      <ManageModelsModal
        open={manageModelsOpen}
        onClose={() => setManageModelsOpen(false)}
        cloudModels={browserCloudModels}
        ollamaModels={ollamaModels}
        hasKey={modelHasKey}
        onConfigureProviders={() => openSettings("ai-providers")}
      />
    </div>
    {/* Live session usage drawer (click on the ProgressCircle). */}
    <SessionUsageDrawer
      open={_sdOpen}
      data={sessionUsage}
      limitsError={sessionLimitsError}
      onClose={() => setSessionDrawerOpen(false)}
      onOpenDashboard={() => {
        setSessionDrawerOpen(false);
        openSettings("ai-usage-cross-chat-dashboard");
      }}
    />
    </AgentFileOpen.Provider>
    </ChatFileOpen.Provider>
    </HtmlPreviewOpen.Provider>
    </SubagentOpen.Provider>
  );
}

