import { useEffect, useMemo } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import ChatSettingsMenu from './ChatSettingsMenu';
import TokenUsageIndicator from './TokenUsageIndicator';
import EditSummaryBar from './EditSummaryBar';
import KanbanTasksBar from './KanbanTasksBar';
import AgentRulesBanner from './AgentRulesBanner';
import { useKanbanStore, type KanbanNotification } from '../stores/kanbanStore';
import { useKanbanTaskCounts } from '../hooks/useKanbanTaskCounts';
import { useAgentRules } from '../hooks/useAgentRules';
import type { ChatMessage, AgentInfo, ChatAttachment } from '../types';
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
  onSelectAgent?: (agent: AgentInfo) => void;
  onFilePathClick?: (path: string, lineChanges?: LineChange[]) => void;
  onSessionIdClick?: (sessionId: string) => void;
  onDiffClick?: (filePath: string, status: 'created' | 'modified' | 'deleted') => void; // NEW: Diff drawer handler
  onEditsChange?: (edits: FileEdit[], deletes: FileDeleted[]) => void; // NEW: Notify parent when edits change
  pendingAgentMention?: AgentInfo | null;
  onMentionInserted?: () => void;
  pendingFileMention?: { name: string; path: string; relativePath: string } | null;
  onFileMentionInserted?: () => void;
  pendingSlashCommand?: { name: string; description: string } | null;
  onCommandInserted?: () => void;
  basePath?: string;
  // Agent Chat Settings - controlled from parent
  inputDraft?: string;
  onInputDraftChange?: (draft: string) => void;
  model?: 'opus' | 'sonnet' | 'haiku';
  onModelChange?: (model: 'opus' | 'sonnet' | 'haiku') => void;
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
  // Hide the KanbanTasksBar (for use inside Kanban drawer)
  hideKanbanTasksBar?: boolean;
  // Callback to open Kanban view (passed from App.tsx)
  onOpenKanban?: () => void;
}

export default function ChatView({
  messages,
  isLoading,
  onSendMessage,
  activeAgent,
  onClearAgent,
  agents,
  onSelectAgent,
  onFilePathClick,
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
  model = 'sonnet',
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
  onCompactConversation,
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
  // Hide the KanbanTasksBar (for use inside Kanban drawer)
  hideKanbanTasksBar = false,
  // Callback to open Kanban view
  onOpenKanban,
}: ChatViewProps) {
  // Load active rules using the hook (automatic, zero config)
  const { activeRules, hasRules } = useAgentRules(selectedRules, basePath || '');

  // Kanban task counts for the tasks bar
  const { todoCount, inProgressCount } = useKanbanTaskCounts(basePath);

  const handleSend = async (content: string, options?: ChatSendOptions) => {
    if (!content.trim() || isLoading) return;

    // Check if message starts with a slash command
    const trimmedContent = content.trim();
    const slashCommandMatch = trimmedContent.match(/^\/(\w+)(?:\s+(.*))?$/s);

    if (slashCommandMatch) {
      const [, commandName, commandArgs] = slashCommandMatch;
      console.log('[ChatView] Detected slash command:', commandName, 'with args:', commandArgs);

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
        const agentMatch = args.match(/^@(\w+)\s+(.+)$/s);

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
          toast.success(`Kanban task created: Agent ${agentName}`);
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
        // Fall through to send raw content if expansion fails
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

  // Track file edits and deletions from the LAST assistant message only
  const { currentFileEdits, currentFileDeletes } = useMemo(() => {
    // Find the last assistant message (most recent AI response)
    const lastAssistantMessage = [...messages]
      .reverse()
      .find(msg => msg.role === 'assistant');

    if (!lastAssistantMessage) return { currentFileEdits: [], currentFileDeletes: [] };

    // Collect file edits and deletions from tool calls in the last message
    const fileEdits: Map<string, FileEdit> = new Map();
    const fileDeletes: Set<string> = new Set();

    // Check if message has events (ClaudeEvent[] format)
    if (lastAssistantMessage.events && Array.isArray(lastAssistantMessage.events)) {
      lastAssistantMessage.events.forEach((event: any) => {
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

                  // Determine status: Edit tool = modified, Write tool = likely created
                  const status: 'created' | 'modified' = toolName === 'write' ? 'created' : 'modified';

                  if (!fileEdits.has(filePath)) {
                    fileEdits.set(filePath, {
                      filePath,
                      editCount: 0,
                      lineNumbers: [],
                      lineChanges: [], // Initialize empty array for line-by-line changes
                      status, // NEW: Track file creation vs modification
                    });
                  } else {
                    // If file already tracked and we see an Edit tool, mark as modified
                    if (toolName === 'edit') {
                      fileEdits.get(filePath)!.status = 'modified';
                    }
                  }

                  const edit = fileEdits.get(filePath)!;
                  edit.editCount++;

                  // Compute line changes for Edit tool (has old_string and new_string)
                  if (toolName === 'edit' && input.old_string && input.new_string) {
                    const changes = computeLineChanges(input.old_string, input.new_string);

                    // Debug: log the changes
                    console.log('[ChatView] Computed line changes for', filePath, ':', changes);

                    edit.lineChanges!.push(...changes);
                  }
                  // For Write tool, we don't have old_string, so we can't compute precise diffs
                  // The Write tool creates or overwrites entire files
                }

                // Track Bash commands with rm
                if (toolName === 'bash' && input?.command) {
                  const command = input.command as string;
                  // Match rm commands: rm file.txt, rm -rf dir/, rm *.txt, etc.
                  const rmMatch = command.match(/\brm\s+(?:-[^\s]*\s+)?(.+)/);
                  if (rmMatch) {
                    const filePaths = rmMatch[1].split(/\s+/).filter(p => p && !p.startsWith('-'));
                    filePaths.forEach(path => {
                      // Clean up the path (remove quotes, wildcards for display)
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
      currentFileEdits: Array.from(fileEdits.values()),
      currentFileDeletes: Array.from(fileDeletes).map(filePath => ({ filePath }))
    };
  }, [messages]);

  // Notify parent when edits change (for FileExplorer indicators)
  useEffect(() => {
    if (onEditsChange) {
      onEditsChange(currentFileEdits, currentFileDeletes);
    }
  }, [currentFileEdits, currentFileDeletes, onEditsChange]);

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

        console.log(`Switched to ${modes[nextIndex]} thinking mode`);
      }

      // Shift+Tab to cycle permission modes
      if (e.key === 'Tab' && e.shiftKey && !isLoading && onPermissionModeChange) {
        e.preventDefault();

        // Cycle through permission modes
        const modes: PermissionMode[] = ['plan', 'bypass'];
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
      <MessageList
        messages={messages}
        loading={isLoading}
        onFilePathClick={onFilePathClick}
        onSessionIdClick={onSessionIdClick}
        agentName={agentName}
        agentAvatar={agentAvatar}
        projectName={projectName}
        gitBranch={gitBranch}
      />
      {(currentFileEdits.length > 0 || currentFileDeletes.length > 0) && (
        <EditSummaryBar
          edits={currentFileEdits}
          deletes={currentFileDeletes}
          onFileClick={onFilePathClick}
          onDiffClick={onDiffClick} // NEW: Pass diff handler
          onClear={() => {
            // The edits are derived from messages, so to "clear" them
            // we would need to modify the messages array (not recommended)
            // Instead, just hide the bar by doing nothing
            console.log('Edits are automatically cleared when a new message arrives');
          }}
        />
      )}
      {!hideKanbanTasksBar && onOpenKanban && (
        <KanbanTasksBar
          todoCount={todoCount}
          inProgressCount={inProgressCount}
          onOpenKanban={onOpenKanban}
        />
      )}
      <div className="chat-view-footer">
        <div className="chat-view-footer-controls">
          <ChatSettingsMenu
            model={model}
            thinkingMode={thinkingMode}
            permissionMode={permissionMode}
            effort={effort}
            onModelChange={(m) => onModelChange?.(m as 'opus' | 'sonnet' | 'haiku')}
            onThinkingModeChange={(mode) => onThinkingModeChange?.(mode)}
            onPermissionModeChange={(mode) => onPermissionModeChange?.(mode)}
            onEffortChange={(e) => onEffortChange?.(e)}
            disabled={isLoading}
          />
          <TokenUsageIndicator
            inputTokens={sessionTokens.inputTokens}
            outputTokens={sessionTokens.outputTokens}
            cacheCreationTokens={sessionTokens.cacheCreationTokens}
            cacheReadTokens={sessionTokens.cacheReadTokens}
            totalCost={sessionTokens.totalCost}
            overhead={sessionTokens.overhead}
            onCompact={onCompactConversation}
            onClear={onClearConversation}
          />
          {isLoading && onAbortStream && (
            <button
              className="chat-stop-btn"
              onClick={onAbortStream}
              title="Stop Stream (ESC)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
              <span>Stop</span>
            </button>
          )}
          {messages.length > 0 && onCompactConversation && (
            <button
              className="chat-compact-btn"
              onClick={onCompactConversation}
              disabled={isLoading}
              title="Compact Conversation (summarize older messages)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="7.5 4.21 12 6.81 16.5 4.21" />
                <polyline points="7.5 19.79 7.5 14.6 3 12" />
                <polyline points="21 12 16.5 14.6 16.5 19.79" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </button>
          )}
          {messages.length > 0 && onOpenSessionInTerminal && (
            <button
              className="chat-terminal-btn"
              onClick={onOpenSessionInTerminal}
              disabled={isLoading}
              title="Open session in Terminal (claude --resume)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
            </button>
          )}
          {messages.length > 0 && onClearConversation && (
            <button
              className="chat-clear-btn"
              onClick={onClearConversation}
              disabled={isLoading}
              title="Clear Conversation"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
        </div>
        <ChatInput
          onSend={handleSend}
          disabled={isLoading}
          placeholder="Ask Claude about your code, commands, or project..."
          agents={agents}
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
          // Streaming control
          isStreaming={isLoading}
          onAbort={onAbortStream}
          lastPrompt={lastPrompt}
          // OpenAI API key for Whisper
          openaiApiKey={openaiApiKey}
          // Open Prompt Engineer
          onOpenPromptEngineer={onOpenPromptEngineer}
          // Working on field
          workingOn={workingOn}
          onWorkingOnChange={onWorkingOnChange}
          // Initial attachments (from Kanban task)
          initialAttachments={initialAttachments}
        />
      </div>
    </div>
  );
}
