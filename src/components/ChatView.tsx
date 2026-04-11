import { useEffect, useMemo, useState, useRef, useCallback, lazy, Suspense } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import MessageList from './MessageList';

// Brain: 005-performance-critical-refactor
// Lazy-load virtualized list to avoid bundling react-window upfront
const MessageListVirtualized = lazy(() => import('./MessageListVirtualized'));
import ChatInput from './ChatInput';
import { useSettingsStore } from '../stores/settingsStore';
import TokenUsageIndicator from './TokenUsageIndicator';
import StaminaBarBorder from './StaminaBarBorder';
import EditSummaryBar from './EditSummaryBar';
import ToolPermissionBanner from './ToolPermissionBanner';
import TodoProgressBar from './TodoProgressBar';
import type { TodoItem } from './TodoProgressBar';
import AgentRulesBanner from './AgentRulesBanner';
import BrainContextBanner from './BrainContextBanner';
import BTWDrawer from './btw/BTWDrawer';
import { useBTW } from '../hooks/useBTW';
import { useQuickLoop } from '../hooks/useQuickLoop';
import { useKanbanStore, type KanbanNotification } from '../stores/kanbanStore';
import { createBackgroundTask } from '../services/backgroundAgentService';
import { useChatStore } from '../stores/chatStore';
import { useAgentRules } from '../hooks/useAgentRules';
import { RemoteTeamWidget } from './RemoteTeamWidget';
import { useTeamStore } from '../stores/teamStore';
import { useSessionStore } from '../stores/sessionStore';
import type { ChatMessage, AgentInfo, ChatAttachment, AskUserQuestionAnswers, TerminalInfo } from '../types';
import type {
  ChatSendOptions,
  ThinkingMode,
  PermissionMode,
} from '../hooks/useClaudeChat';
import type { EffortLevel } from '../types';
import './ChatView.css';

export interface LineChange {
  line: number;
  type: 'added' | 'modified' | 'removed';
}

export interface FileEdit {
  filePath: string;
  editCount: number;
  lineNumbers: number[];
  lineChanges?: LineChange[]; // Detailed line-by-line changes for diff highlighting
  status?: 'created' | 'modified'; // NEW: Track if file was created or modified
}

export interface FileDeleted {
  filePath: string;
}

interface ChatViewProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onSendMessage: (content: string, options?: ChatSendOptions) => Promise<void>;
  activeAgent?: AgentInfo | null;
  onClearAgent?: () => void;
  agents?: AgentInfo[];
  projectTerminals?: TerminalInfo[];
  onSelectAgent?: (agent: AgentInfo) => void;
  onFilePathClick?: (path: string, lineChanges?: LineChange[]) => void;
  onOpenInIDE?: (path: string) => void;
  onSessionIdClick?: (sessionId: string) => void;
  onDiffClick?: (filePath: string, status: 'created' | 'modified' | 'deleted') => void; // NEW: Diff drawer handler
  onEditsChange?: (edits: FileEdit[], deletes: FileDeleted[]) => void; // NEW: Notify parent when edits change
  pendingAgentMention?: AgentInfo | null;
  onMentionInserted?: () => void;
  pendingFileMention?: { name: string; path: string; relativePath: string; isDirectory: boolean } | null;
  onFileMentionInserted?: () => void;
  pendingSlashCommand?: { name: string; description: string } | null;
  onCommandInserted?: () => void;
  basePath?: string;
  // Agent Chat Settings - controlled from parent
  inputDraft?: string;
  onInputDraftChange?: (draft: string) => void;
  model?: string;
  onModelChange?: (model: string) => void;
  thinkingMode?: ThinkingMode;
  onThinkingModeChange?: (mode: ThinkingMode) => void;
  permissionMode?: PermissionMode;
  onPermissionModeChange?: (mode: PermissionMode) => void;
  effort?: EffortLevel;
  onEffortChange?: (effort: EffortLevel) => void;
  // Streaming control
  onAbortStream?: () => void;
  lastPrompt?: string;
  // Conversation management
  onClearConversation?: () => void;
  onCompactConversation?: () => void;
  onOpenSessionInTerminal?: () => void;
  // Token usage tracking
  sessionTokens?: {
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    totalCost: number; // total_cost_usd from Claude SDK (authoritative)
    overhead?: number; // Dynamic overhead calculated from project files
    contextWindow?: number; // Context window size from SDK (200k or 1M)
    contextUsageBreakdown?: { name: string; tokens: number; color: string; isDeferred?: boolean }[];
  };
  // OpenAI API key for Whisper
  openaiApiKey?: string;
  // Open Prompt Engineer
  onOpenPromptEngineer?: () => void;
  // Agent display info
  agentName?: string;
  agentAvatar?: string;
  // Project context
  projectName?: string;
  gitBranch?: string;
  // Working on field
  workingOn?: string;
  onWorkingOnChange?: (value: string) => void;
  // Agent Rules - automatically loaded from personality
  selectedRules?: string[];
  onEditRules?: () => void;
  // Initial attachments (from Kanban task)
  initialAttachments?: ChatAttachment[];
  // Callback to open Kanban view (passed from App.tsx)
  onOpenKanban?: () => void;
  // AskUserQuestion support
  onUserQuestionAnswer?: (toolUseId: string, answers: AskUserQuestionAnswers, sessionKey?: string) => void;
  pendingQuestionIds?: Set<string>;
  answeredQuestions?: Map<string, AskUserQuestionAnswers>;
  // Current session ID for display (Claude Code session ID)
  currentSessionId?: string;
  // Internal session ID for state management (AgentSession.id)
  internalSessionId?: string;
  // Agent toolkit - quick-access tools from agent personality
  agentToolkit?: {
    skills: string[];
    droids: string[];
    commands: string[];
  };
  // Handler for inserting text at cursor in ChatInput
  onInsertAtCursor?: (text: string) => void;
  // Fullscreen mode - hides side panel and expands chat
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  // File Checkpointing (SDK 0.2.7+)
  onRewindFiles?: (userMessageId: string) => void;
  onOpenImageTab?: (filePath: string, imageData: string, mediaType: string) => void;
  // Open Agent Personality panel in sidebar
  onOpenPersonality?: () => void;
  // Plan approval
  pendingPlanApprovalIds?: Set<string>;
  onPlanApprovalResponse?: (requestId: string, approved: boolean, feedback?: string) => void;
  // Tool permission (Ask mode)
  pendingToolPermissions?: import('../types').PendingToolPermission[];
  onToolPermissionResponse?: (requestId: string, approved: boolean, feedback?: string) => void;
  onAllowAlwaysTool?: (requestId: string) => void;
  // Teammate stream drill-down
  onTeammateDrillDown?: (sessionId: string, name: string) => void;
  // Agent commit detection — called when agent runs `git commit` in a Bash tool
  onAgentCommitDetected?: () => void;
}

export default function ChatView({
  messages,
  isLoading,
  onSendMessage,
  activeAgent,
  onClearAgent,
  agents,
  projectTerminals,
  onSelectAgent,
  onFilePathClick,
  onOpenInIDE,
  onSessionIdClick,
  onDiffClick, // NEW: Diff drawer handler
  onEditsChange, // NEW: Notify parent when edits change
  pendingAgentMention,
  onMentionInserted,
  pendingFileMention,
  onFileMentionInserted,
  pendingSlashCommand,
  onCommandInserted,
  basePath,
  // Agent Chat Settings - controlled from parent
  inputDraft = '',
  onInputDraftChange,
  model = 'opus46',
  onModelChange,
  thinkingMode = 'auto',
  onThinkingModeChange,
  permissionMode = 'bypass',
  onPermissionModeChange,
  effort = 'medium',
  onEffortChange,
  // Streaming control
  onAbortStream,
  lastPrompt,
  // Conversation management
  onClearConversation,
  // onCompactConversation — no longer used; /compact now flows through onSendMessage to the SDK
  onOpenSessionInTerminal,
  // Token usage tracking
  sessionTokens = { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, totalCost: 0 },
  // OpenAI API key for Whisper
  openaiApiKey,
  // Open Prompt Engineer
  onOpenPromptEngineer,
  // Agent display info
  agentName,
  agentAvatar,
  // Project context
  projectName,
  gitBranch,
  // Working on field
  workingOn,
  onWorkingOnChange,
  // Agent Rules
  selectedRules,
  onEditRules,
  // Initial attachments (from Kanban task)
  initialAttachments,
  // Callback to open Kanban view
  onOpenKanban,
  // AskUserQuestion support
  onUserQuestionAnswer,
  pendingQuestionIds,
  answeredQuestions,
  // Current session ID (Claude Code session ID for display)
  currentSessionId,
  // Internal session ID (AgentSession.id for state management)
  internalSessionId,
  // Agent toolkit
  agentToolkit,
  onInsertAtCursor,
  // Fullscreen mode
  isFullscreen = false,
  onToggleFullscreen,
  // File Checkpointing
  onOpenImageTab,
  onRewindFiles,
  onOpenPersonality,
  pendingPlanApprovalIds,
  onPlanApprovalResponse,
  pendingToolPermissions,
  onToolPermissionResponse,
  onAllowAlwaysTool,
  onTeammateDrillDown,
  onAgentCommitDetected,
}: ChatViewProps) {
  // Per-turn token stats toggle (from Settings → Chat Experience)
  const showTurnTokenStats = useSettingsStore((s) => s.general?.showTurnTokenStats ?? false);

  // Counter to reset ThinkingBlocks when thinking mode changes via Tab key
  const [thinkingModeResetCounter, setThinkingModeResetCounter] = useState(0);

  // State to show/hide existing ThinkingBlocks (toggle via footer icon)
  const [showThinkingBlocks, setShowThinkingBlocks] = useState(true);

  // Debug mode banner accordion state
  const [debugBannerExpanded, setDebugBannerExpanded] = useState(false);


  // Load active rules using the hook (automatic, zero config)
  const { activeRules, hasRules } = useAgentRules(selectedRules, basePath || '');

  // BTW Side-Chain Chat — context-aware (reads current session messages)
  // Brain: btw-context-aware
  const btw = useBTW({ messages });

  // Remote Team Widget
  const remoteTeam = useTeamStore(s => s.activeTeam);

  // Session title — reactive from store (updates on rename)
  const sessionTitle = useSessionStore(s => {
    if (!internalSessionId) return undefined;
    return s.sessions.find(sess => sess.id === internalSessionId)?.title;
  });

  // Quick Loop - recurring prompts
  // showLoopPopover moved to UnifiedActionBar
  const quickLoop = useQuickLoop((prompt) => {
    onSendMessage(prompt);
  });

  // Stable wrapper for onUserQuestionAnswer — avoids breaking memo() on MessageList/ChatMessage
  const stableOnUserQuestionAnswer = useCallback(
    (toolUseId: string, answers: AskUserQuestionAnswers, _sessionKey?: string) => {
      onUserQuestionAnswer?.(toolUseId, answers, internalSessionId || _sessionKey);
    },
    [onUserQuestionAnswer, internalSessionId]
  );

  // Persistent attachments via chat store
  const setStoreAttachments = useChatStore((state) => state.setAttachments);
  const clearStoreAttachments = useChatStore((state) => state.clearAttachments);
  const pendingAttachments = useChatStore((state) => state.pendingAttachments);

  // 🦆 SESSIONS-FIRST: Use internalSessionId (AgentSession.id) for attachments, fallback to currentSessionId
  const attachmentKey = internalSessionId || currentSessionId;

  // Derive current session attachments (reactive via pendingAttachments subscription)
  const sessionAttachments = useMemo(() => {
    if (!attachmentKey) return [];
    return pendingAttachments.get(attachmentKey) || [];
  }, [attachmentKey, pendingAttachments]);

  // Handler to update attachments in store
  const handleAttachmentsChange = useCallback((newAttachments: ChatAttachment[]) => {
    if (attachmentKey) {
      setStoreAttachments(attachmentKey, newAttachments);
    }
  }, [attachmentKey, setStoreAttachments]);

  const handleSend = async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || isLoading) return;

    // Check if message starts with a slash command
    const trimmedContent = content.trim();
    const slashCommandMatch = trimmedContent.match(/^\/(\w+)(?:\s+(.*))?$/s);

    if (slashCommandMatch) {
      const [, commandName, commandArgs] = slashCommandMatch;
      console.log('[ChatView] Detected slash command:', commandName, 'with args:', commandArgs);

      // /compact should flow through to the SDK as a regular message — the SDK's
      // slash command parser intercepts it and triggers native context compaction.
      // Previously this was intercepted here for a custom Haiku-based summarization,
      // but that only affected UI state without compacting the SDK's internal context.
      // Brain: fix-compact-not-triggering-sdk-native
      if (commandName === 'compact') {
        await onSendMessage(trimmedContent, {
          ...options,
          model,
          thinkingMode,
          permissionMode,
          effort,
        });
        return;
      }
      if (commandName === 'clear' && onClearConversation) {
        onClearConversation();
        return;
      }

      // /context should flow through to the SDK as a regular message —
      // the SDK handles it natively (like /compact).
      if (commandName === 'context') {
        await onSendMessage(trimmedContent, {
          ...options,
          model,
          thinkingMode,
          permissionMode,
          effort,
        });
        return;
      }

      // SDK built-in commands without native handlers — show a helpful toast
      // instead of sending them as regular prompts (which confuses Claude).
      const cliOnlyCommands = ['cost', 'diff', 'doctor', 'init', 'memory', 'mcp', 'model', 'permissions', 'review', 'status', 'undo'];
      if (cliOnlyCommands.includes(commandName)) {
        toast.info(`/${commandName} is a CLI-only command — use it in the Claude Code terminal.`);
        return;
      }

      // INTERCEPT /background command - create background task instead of sending message
      if (commandName === 'background') {
        if (!commandArgs || !commandArgs.trim()) {
          toast.error('Usage: /background <command> or /background @agent <prompt>');
          return;
        }

        const args = commandArgs.trim();
        const { addTask, showNotification, isKanbanViewActive } = useKanbanStore.getState();
        const projectPath = basePath || '/';
        const projectName = projectPath.split('/').pop() || 'Unknown';

        // Check if it's an agent invocation: @agentname prompt
        // Note: Agent names can contain hyphens (e.g., code-explorer, frontend-developer)
        const agentMatch = args.match(/^@([\w-]+)\s+(.+)$/s);

        if (agentMatch) {
          // Agent task: /background @code-reviewer Review this code
          const [, agentName, prompt] = agentMatch;
          const newTask = await addTask({
            title: `Agent: ${agentName}`,
            prompt: prompt,
            status: 'in_progress',
            projectPath,
            projectName,
            type: 'agent',
          });

          // Execute the agent task in background
          createBackgroundTask({
            type: 'agent',
            priority: 'medium',
            name: `Agent: ${agentName}`,
            description: prompt,
            agentId: agentName,
            prompt: prompt,
            model: 'opus46',
            workingDirectory: projectPath,
            notifyOnComplete: true,
            kanbanTaskId: newTask.id, // Link to Kanban for status sync
          });

          toast.success(`Background agent started: ${agentName}`);
          // Show notification bar if not already in Kanban view
          if (!isKanbanViewActive) {
            showNotification({
              taskId: newTask.id,
              taskTitle: `Agent: ${agentName}`,
              taskType: 'agent',
            });
          }
        } else {
          // Shell command task: /background npm run build
          // Create as shell task in Kanban
          const taskTitle = args.length > 40 ? args.substring(0, 40) + '...' : args;
          const newTask = await addTask({
            title: taskTitle,
            prompt: args,
            status: 'in_progress', // Auto-start shell tasks
            projectPath,
            projectName,
            type: 'shell',
            command: args,
          });
          toast.success(`Kanban shell task created: ${args.length > 30 ? args.substring(0, 30) + '...' : args}`);
          // Show notification bar if not already in Kanban view
          if (!isKanbanViewActive) {
            showNotification({
              taskId: newTask.id,
              taskTitle: taskTitle,
              taskType: 'shell',
            });
          }
        }
        return; // Don't send as normal message
      }

      try {
        // Try to expand the command via backend
        const expandedContent = await invoke<string>('expand_slash_command', {
          basePath: basePath || '',
          commandName,
          args: commandArgs || '',
        });

        console.log('[ChatView] Expanded slash command to:', expandedContent);

        // Send the expanded content instead of the raw command
        await onSendMessage(expandedContent, {
          ...options,
          model,
          thinkingMode,
          permissionMode,
          effort,
        });
        return;
      } catch (error) {
        console.error('[ChatView] Failed to expand slash command:', error);
        // Don't fall through — sending raw "/command" to the SDK causes it
        // to be processed as a built-in CLI command AND a Claude prompt,
        // producing a duplicate response.
        toast.error(`Unknown command: /${commandName}`);
        return;
      }
    }

    // Send raw content if no slash command or expansion failed
    await onSendMessage(content, {
      ...options,
      model,
      thinkingMode,
      permissionMode,
      effort,
    });
  };

  // Helper function to compute line-by-line diff
  const computeLineChanges = (oldString: string = '', newString: string = ''): LineChange[] => {
    const oldLines = oldString.split('\n');
    const newLines = newString.split('\n');
    const changes: LineChange[] = [];

    // Simple diff algorithm: compare line by line
    // This is a basic implementation - for production you might want a more sophisticated algorithm
    const maxLines = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLines; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined && newLine !== undefined) {
        // Line was added
        changes.push({ line: i + 1, type: 'added' });
      } else if (oldLine !== undefined && newLine === undefined) {
        // Line was removed
        changes.push({ line: i + 1, type: 'removed' });
      } else if (oldLine !== newLine) {
        // Line was modified
        changes.push({ line: i + 1, type: 'modified' });
      }
    }

    return changes;
  };

  // Brain: fix-changes-panel-all-messages
  // Dual edit tracking:
  // - allFileEdits/allFileDeletes: cumulative across ALL assistant messages → feeds ChangesPanel (sidebar)
  // - lastTurnFileEdits/lastTurnFileDeletes: LAST assistant message only → feeds EditSummaryBar (inline)
  // Previously only scanned lastAssistantMessage, losing edits from earlier turns
  // on session restore, tab switch, or component remount.
  const scanMessagesForEdits = (msgs: typeof messages) => {
    const fileEdits: Map<string, FileEdit> = new Map();
    const fileDeletes: Set<string> = new Set();

    for (const assistantMessage of msgs) {
      if (!assistantMessage.events || !Array.isArray(assistantMessage.events)) continue;

      assistantMessage.events.forEach((event: any) => {
        // Track Brain MCP tool results (mdFilePath is in the result, not input)
        if (event.type === 'user' && event.message?.content && Array.isArray(event.message.content)) {
          event.message.content.forEach((item: any) => {
            if (item.type === 'tool_result' && item.content) {
              try {
                const resultContent = typeof item.content === 'string'
                  ? JSON.parse(item.content)
                  : item.content;

                if (resultContent.mdFilePath && resultContent.mdFilePath.endsWith('.md')) {
                  const mdPath = resultContent.mdFilePath;
                  if (!fileEdits.has(mdPath)) {
                    fileEdits.set(mdPath, {
                      filePath: mdPath,
                      editCount: 1,
                      lineNumbers: [],
                      lineChanges: [],
                      status: 'created',
                    });
                  }
                }
              } catch {
                // Not JSON, skip
              }
            }
          });
        }

        if (event.type === 'assistant' && event.message?.content) {
          const content = event.message.content;
          if (Array.isArray(content)) {
            content.forEach((item: any) => {
              if (item.type === 'tool_use') {
                const toolName = item.name?.toLowerCase();
                const input = item.input;

                // Track Edit and Write tool calls
                if ((toolName === 'edit' || toolName === 'write') && input?.file_path) {
                  const filePath = input.file_path;
                  const status: 'created' | 'modified' = toolName === 'write' ? 'created' : 'modified';

                  if (!fileEdits.has(filePath)) {
                    fileEdits.set(filePath, {
                      filePath,
                      editCount: 0,
                      lineNumbers: [],
                      lineChanges: [],
                      status,
                    });
                  } else {
                    if (toolName === 'edit') {
                      fileEdits.get(filePath)!.status = 'modified';
                    }
                  }

                  const edit = fileEdits.get(filePath)!;
                  edit.editCount++;

                  if (toolName === 'edit' && input.old_string && input.new_string) {
                    const changes = computeLineChanges(input.old_string, input.new_string);
                    edit.lineChanges!.push(...changes);
                  }
                }

                // Track Bash commands with rm
                if (toolName === 'bash' && input?.command) {
                  const command = input.command as string;
                  const rmMatch = command.match(/\brm\s+(?:-[^\s]*\s+)?(.+)/);
                  if (rmMatch) {
                    const filePaths = rmMatch[1].split(/\s+/).filter(p => p && !p.startsWith('-'));
                    filePaths.forEach(path => {
                      const cleanPath = path.replace(/['"]/g, '').trim();
                      if (cleanPath) {
                        fileDeletes.add(cleanPath);
                      }
                    });
                  }
                }
              }
            });
          }
        }
      });
    }

    return {
      edits: Array.from(fileEdits.values()),
      deletes: Array.from(fileDeletes).map(filePath => ({ filePath })),
    };
  };

  const { allFileEdits, allFileDeletes, lastTurnFileEdits, lastTurnFileDeletes } = useMemo(() => {
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');

    if (assistantMessages.length === 0) {
      return { allFileEdits: [], allFileDeletes: [], lastTurnFileEdits: [], lastTurnFileDeletes: [] };
    }

    const all = scanMessagesForEdits(assistantMessages);
    const lastMsg = assistantMessages[assistantMessages.length - 1];
    const lastTurn = scanMessagesForEdits([lastMsg]);

    return {
      allFileEdits: all.edits,
      allFileDeletes: all.deletes,
      lastTurnFileEdits: lastTurn.edits,
      lastTurnFileDeletes: lastTurn.deletes,
    };
  }, [messages]);

  // Notify parent when edits change (for FileExplorer indicators)
  useEffect(() => {
    if (onEditsChange) {
      onEditsChange(allFileEdits, allFileDeletes);
    }
  }, [allFileEdits, allFileDeletes, onEditsChange]);

  // Detect agent `git commit` calls to trigger ChangesPanel reconciliation
  const lastAgentCommitTs = useMemo(() => {
    let lastTs = 0;
    const assistantMessages = messages.filter(msg => msg.role === 'assistant');
    for (const msg of assistantMessages) {
      if (!msg.events || !Array.isArray(msg.events)) continue;
      for (const event of msg.events as any[]) {
        if (event.type !== 'assistant' || !Array.isArray(event.message?.content)) continue;
        for (const item of event.message.content as any[]) {
          if (item.type === 'tool_use' && item.name?.toLowerCase() === 'bash') {
            const cmd = item.input?.command as string | undefined;
            if (cmd?.includes('git commit')) {
              lastTs = msg.timestamp || Date.now();
            }
          }
        }
      }
    }
    return lastTs;
  }, [messages]);

  // Brain: fix-changes-panel-cpu-loop
  const onAgentCommitDetectedRef = useRef(onAgentCommitDetected);
  useEffect(() => { onAgentCommitDetectedRef.current = onAgentCommitDetected; }, [onAgentCommitDetected]);

  useEffect(() => {
    if (lastAgentCommitTs > 0 && onAgentCommitDetectedRef.current) {
      onAgentCommitDetectedRef.current();
    }
  }, [lastAgentCommitTs]);

  // Detect if any messages have ThinkingBlocks (thinkingContent or thinking events)
  const hasThinkingBlocks = useMemo<boolean>(() => {
    for (const msg of messages) {
      // Check direct thinkingContent field
      if (msg.thinkingContent) return true;

      // Check events for thinking content
      if (msg.events && Array.isArray(msg.events)) {
        for (const event of msg.events as any[]) {
          if (event.type === 'assistant' && event.message?.content) {
            const content = event.message.content;
            if (Array.isArray(content)) {
              for (const item of content) {
                if (item.type === 'thinking' && item.thinking) {
                  return true;
                }
              }
            }
          }
        }
      }
    }
    return false;
  }, [messages]);

  // Extract todos from the LAST assistant message only (like EditSummaryBar)
  // If the last message has no TodoWrite, the bar disappears
  const currentTodos = useMemo<TodoItem[]>(() => {
    // Find the last assistant message
    const lastAssistantMessage = [...messages]
      .reverse()
      .find(msg => msg.role === 'assistant');

    if (!lastAssistantMessage || !lastAssistantMessage.events) return [];

    // Find the LAST TodoWrite in the last message (there could be multiple updates)
    let lastTodos: TodoItem[] = [];

    for (const event of lastAssistantMessage.events as any[]) {
      if (event.type === 'assistant' && event.message?.content) {
        const content = event.message.content;
        if (Array.isArray(content)) {
          for (const item of content) {
            if (item.type === 'tool_use') {
              const toolName = item.name?.toLowerCase();
              const input = item.input;

              // Update lastTodos every time we find a TodoWrite in the last message
              if (toolName === 'todowrite' && input?.todos && Array.isArray(input.todos)) {
                lastTodos = input.todos as TodoItem[];
              }
            }
          }
        }
      }
    }

    return lastTodos;
  }, [messages]);

  // Note: Tasks tab now reads directly from ~/.claude/tasks/ filesystem
  // No need to sync currentTodos to store - TasksPanel handles its own loading

  // Extract QuackBrain file info from the LAST assistant message
  // Shows a special bar to open the created brain entity in Obsidian

  // Keyboard shortcuts: Shift+Tab to cycle modes, ESC to abort
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ESC to abort operation
      if (e.key === 'Escape' && isLoading) {
        e.preventDefault();
        console.warn('ESC pressed - abort requested (not yet implemented in backend)');
        // TODO: Implement actual abort by killing Node.js process
        // For now, just log a warning
        alert('⚠️ ESC pressed. Abort functionality coming soon!\n\nNote: The backend process will continue, but you can close this tab or reload the page.');
        return;
      }

      // Tab to cycle thinking modes
      if (e.key === 'Tab' && !e.shiftKey && !isLoading && onThinkingModeChange) {
        e.preventDefault();

        // Cycle through thinking modes in order: Auto → Think → Think Hard → Think Harder → Ultra Think
        const modes: ThinkingMode[] = ['auto', 'think', 'hard', 'harder', 'ultra'];
        const currentIndex = modes.indexOf(thinkingMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        onThinkingModeChange(modes[nextIndex]);

        // Increment reset counter to re-expand all ThinkingBlocks
        setThinkingModeResetCounter(prev => prev + 1);

        console.log(`Switched to ${modes[nextIndex]} thinking mode`);
      }

      // Shift+Tab to cycle permission modes
      if (e.key === 'Tab' && e.shiftKey && !isLoading && onPermissionModeChange) {
        e.preventDefault();

        // Cycle through permission modes
        const modes: PermissionMode[] = ['plan', 'bypass', 'ask', 'debug', 'chat'];
        const currentIndex = modes.indexOf(permissionMode);
        const nextIndex = (currentIndex + 1) % modes.length;
        onPermissionModeChange(modes[nextIndex]);

        console.log(`Switched to ${modes[nextIndex]} mode`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [thinkingMode, permissionMode, isLoading, onThinkingModeChange, onPermissionModeChange]);

  return (
    <div className="chat-view">
      {/* Agent Rules Banner - shown when rules are active */}
      {hasRules && (
        <AgentRulesBanner
          rules={activeRules}
          onEditRules={onEditRules}
        />
      )}
      {/* Brain Context Banner - shown at session start when no messages yet */}
      {messages.length === 0 && (
        <BrainContextBanner
          basePath={basePath}
          sessionId={internalSessionId}
        />
      )}
      {/* Debug Mode Banner - accordion, shown when debug mode is active */}
      {permissionMode === 'debug' && (
        <div className={`debug-mode-banner ${debugBannerExpanded ? 'expanded' : ''}`}>
          <button
            type="button"
            className="debug-mode-banner-header"
            onClick={() => setDebugBannerExpanded(!debugBannerExpanded)}
          >
            <div className="debug-mode-banner-left">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
              </svg>
              <span className="debug-mode-banner-title">Debug Mode</span>
              {!debugBannerExpanded && (
                <span className="debug-mode-banner-desc">Brain lookup → Root cause → Hypothesis → Fix → Document</span>
              )}
            </div>
            <svg
              className={`debug-mode-chevron ${debugBannerExpanded ? 'rotated' : ''}`}
              width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {debugBannerExpanded && (
            <div className="debug-mode-banner-body">
              <div className="debug-mode-phase">
                <span className="debug-mode-phase-num">1</span>
                <div>
                  <strong>Brain Lookup</strong>
                  <p>Searches Quack Brain, documentation, and known gotchas before touching any code.</p>
                </div>
              </div>
              <div className="debug-mode-phase">
                <span className="debug-mode-phase-num">2</span>
                <div>
                  <strong>Root Cause Investigation</strong>
                  <p>Reads errors carefully, reproduces the issue, traces data flow backward from the failure point.</p>
                </div>
              </div>
              <div className="debug-mode-phase">
                <span className="debug-mode-phase-num">3</span>
                <div>
                  <strong>Hypothesis & Testing</strong>
                  <p>Forms a single hypothesis, tests it minimally, and verifies before making changes.</p>
                </div>
              </div>
              <div className="debug-mode-phase">
                <span className="debug-mode-phase-num">4</span>
                <div>
                  <strong>Fix & Document</strong>
                  <p>Fixes the root cause (not symptoms), adds Brain breadcrumbs in code, and saves findings for the future.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {/* Project Breadcrumb — liquid glass context indicator */}
      {projectName && (
        <div className="chat-breadcrumb">
          <span className="chat-breadcrumb-project">{projectName}</span>
          {gitBranch && (
            <>
              <span className="chat-breadcrumb-sep">/</span>
              <span className="chat-breadcrumb-branch">{gitBranch}</span>
            </>
          )}
          {sessionTitle && (
            <>
              <span className="chat-breadcrumb-sep">/</span>
              <span className="chat-breadcrumb-session">{sessionTitle}</span>
            </>
          )}
        </div>
      )}
      {/* Remote Team Widget — shown to lead agent when a team is active */}
      {remoteTeam && activeAgent?.name === remoteTeam.leadAgentId && (
        <RemoteTeamWidget
          teamName={remoteTeam.name}
          members={remoteTeam.members.map(m => ({ agentId: m.agentId, agentName: m.name, task: m.role || '', status: 'active' }))}
          teamStatus="active"
          onMemberClick={(agentId, sessionId) => {
            // Navigate to the teammate's session stream tab
            const member = remoteTeam.members.find(m => m.agentId === agentId);
            if (onTeammateDrillDown && sessionId) {
              onTeammateDrillDown(sessionId, member?.name || 'Teammate');
            }
          }}
        />
      )}
      {/* Brain: 005-performance-critical-refactor
          Use virtualized list for sessions with 100+ messages to avoid DOM bloat.
          Threshold at 100 (not 50) to avoid mid-session component swap during streaming.
          Once virtualized kicks in, the session stays virtualized (no swap back). */}
      {messages.length > 100 ? (
        <Suspense fallback={<div style={{ flex: 1 }} />}>
        <MessageListVirtualized
          messages={messages}
          loading={isLoading}
          onFilePathClick={onFilePathClick}
          onOpenInIDE={onOpenInIDE}
          onSessionIdClick={onSessionIdClick}
          agentName={agentName}
          agentAvatar={agentAvatar}
          projectName={projectName}
          gitBranch={gitBranch}
          thinkingModeResetKey={thinkingModeResetCounter}
          onUserQuestionAnswer={onUserQuestionAnswer ? stableOnUserQuestionAnswer : undefined}
          pendingQuestionIds={pendingQuestionIds}
          answeredQuestions={answeredQuestions}
          currentSessionId={currentSessionId}
          showThinkingBlocks={showThinkingBlocks}
          onRewindFiles={onRewindFiles}
          onOpenImageTab={onOpenImageTab}
          onOpenPersonality={onOpenPersonality}
          pendingPlanApprovalIds={pendingPlanApprovalIds}
          onPlanApprovalResponse={onPlanApprovalResponse}
          onTeammateDrillDown={onTeammateDrillDown}
          showTurnTokenStats={showTurnTokenStats}
        />
        </Suspense>
      ) : (
        <MessageList
          messages={messages}
          loading={isLoading}
          onFilePathClick={onFilePathClick}
          onOpenInIDE={onOpenInIDE}
          onSessionIdClick={onSessionIdClick}
          agentName={agentName}
          agentAvatar={agentAvatar}
          projectName={projectName}
          gitBranch={gitBranch}
          thinkingModeResetKey={thinkingModeResetCounter}
          onUserQuestionAnswer={onUserQuestionAnswer ? stableOnUserQuestionAnswer : undefined}
          pendingQuestionIds={pendingQuestionIds}
          answeredQuestions={answeredQuestions}
          currentSessionId={currentSessionId}
          showThinkingBlocks={showThinkingBlocks}
          onRewindFiles={onRewindFiles}
          onOpenImageTab={onOpenImageTab}
          onOpenPersonality={onOpenPersonality}
          pendingPlanApprovalIds={pendingPlanApprovalIds}
          onPlanApprovalResponse={onPlanApprovalResponse}
          onTeammateDrillDown={onTeammateDrillDown}
          showTurnTokenStats={showTurnTokenStats}
        />
      )}
      {(lastTurnFileEdits.length > 0 || lastTurnFileDeletes.length > 0) && (
        <EditSummaryBar
          edits={lastTurnFileEdits}
          deletes={lastTurnFileDeletes}
          onFileClick={onFilePathClick}
          onDiffClick={onDiffClick}
          onClear={() => {
            // The edits are derived from messages, so to "clear" them
            // we would need to modify the messages array (not recommended)
            // Instead, just hide the bar by doing nothing
            console.log('Edits are automatically cleared when a new message arrives');
          }}
        />
      )}
      {currentTodos.length > 0 && (
        <TodoProgressBar todos={currentTodos} />
      )}
      <div className="chat-view-footer">
        {/* Stamina bar as border-top replacement */}
        <StaminaBarBorder
          inputTokens={sessionTokens.inputTokens}
          outputTokens={sessionTokens.outputTokens}
          cacheCreationTokens={sessionTokens.cacheCreationTokens}
          cacheReadTokens={sessionTokens.cacheReadTokens}
          totalCost={sessionTokens.totalCost}
          maxTokens={sessionTokens.contextWindow}
          overhead={sessionTokens.overhead}
          model={model}
          onCompact={() => onSendMessage('/compact')}
          onClear={onClearConversation}
          contextUsageBreakdown={sessionTokens.contextUsageBreakdown}
        />
        {/* Footer controls moved to UnifiedActionBar inside ChatInput */}
        {/* 🛡️ Ask mode: tool permission banners */}
        {pendingToolPermissions && pendingToolPermissions.length > 0 && onToolPermissionResponse && (
          <div className="tool-permission-banners">
            {pendingToolPermissions.map((perm) => (
              <ToolPermissionBanner
                key={perm.requestId}
                permission={perm}
                onRespond={onToolPermissionResponse}
                onAllowAlways={onAllowAlwaysTool}
              />
            ))}
          </div>
        )}
        <ChatInput
          onSend={handleSend}
          placeholder="Ask Claude about your code, commands, or project..."
          agents={agents}
          projectTerminals={projectTerminals}
          onSelectAgent={onSelectAgent}
          activeAgent={activeAgent}
          onClearAgent={onClearAgent}
          pendingAgentMention={pendingAgentMention}
          onMentionInserted={onMentionInserted}
          pendingFileMention={pendingFileMention}
          onFileMentionInserted={onFileMentionInserted}
          pendingSlashCommand={pendingSlashCommand}
          onCommandInserted={onCommandInserted}
          basePath={basePath}
          // Controlled input draft
          inputValue={inputDraft}
          onInputChange={onInputDraftChange}
          // Controlled attachments (persist across tab switches)
          // 🦆 SESSIONS-FIRST: Use attachmentKey for consistency
          attachments={attachmentKey ? sessionAttachments : undefined}
          onAttachmentsChange={attachmentKey ? handleAttachmentsChange : undefined}
          // Streaming control
          isStreaming={isLoading}
          onAbort={onAbortStream}
          lastPrompt={lastPrompt}
          // OpenAI API key for Whisper
          openaiApiKey={openaiApiKey}
          // Open Prompt Engineer
          onOpenPromptEngineer={onOpenPromptEngineer}
          // Initial attachments (from Kanban task) - fallback for uncontrolled mode
          initialAttachments={initialAttachments}
          // Agent toolkit for EquipBar
          agentToolkit={agentToolkit}
          // Fullscreen mode
          isFullscreen={isFullscreen}
          onToggleFullscreen={onToggleFullscreen}
          // Unified Action Bar - session-level controls
          unifiedBarProps={{
            settingsProps: {
              model,
              thinkingMode,
              permissionMode,
              effort,
              onModelChange: (m) => onModelChange?.(m),
              onThinkingModeChange: (mode) => onThinkingModeChange?.(mode),
              onPermissionModeChange: (mode) => onPermissionModeChange?.(mode),
              onEffortChange: (e) => onEffortChange?.(e),
              disabled: isLoading,
            },
            hasMessages: messages.length > 0,
            isLoading,
            onBrainUpdate: () => handleSend('/brain'),
            onToggleBTW: btw.isOpen ? btw.closeBTW : btw.openBTW,
            btwIsOpen: btw.isOpen,
            quickLoop: {
              status: quickLoop.status,
              currentRun: quickLoop.currentRun,
              prompt: quickLoop.prompt,
              startLoop: quickLoop.startLoop,
              stopLoop: quickLoop.stopLoop,
            },
            onCompact: () => onSendMessage('/compact'),
            onOpenTerminal: onOpenSessionInTerminal,
            onClear: onClearConversation,
          }}
        />
      </div>
      {/* BTW Side-Chain Drawer */}
      <BTWDrawer
        isOpen={btw.isOpen}
        query={btw.query}
        response={btw.response}
        isLoading={btw.isLoading}
        error={btw.error}
        model={btw.model}
        onSendQuery={btw.sendQuery}
        onClose={btw.closeBTW}
      />
    </div>
  );
}
