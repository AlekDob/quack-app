// NativeTerminal: Semplice entry per terminale nativo Mac
// Rappresenta un terminale che viene aperto nell'app Terminal.app del Mac
export interface NativeTerminal {
  id: string;
  name: string;
  app: NativeTerminalApp;
  color: string;
  directory: string;
  isOpen: boolean; // Se la finestra del terminale è aperta
  pid?: number; // Process ID del terminale (se disponibile)
  createdAt: number;
}

export type NativeTerminalApp = "Terminal" | "iTerm" | "iTerm2" | "Warp" | "WezTerm" | "Hyper" | "Alacritty" | "Kitty" | "Tabby" | "Termius";

// Info about an installed terminal application
export interface TerminalAppInfo {
  name: string;           // Internal name (e.g., "iTerm", "Warp")
  displayName: string;    // Display name (e.g., "iTerm.app", "Warp.app")
  path: string;           // Full path to the application bundle
}

// AgentChat: Container for multiple terminal tabs
// Represents a workspace/project with its own directory and terminals
export interface AgentChat {
  id: string;
  name: string;
  color: string;
  cwd: string;
  createdAt: number;
  avatar?: string;
  personality?: any;
  sessionId?: string; // Claude Agent SDK session ID for resume & message persistence
  // Token usage for stamina preservation
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalCost?: number; // total_cost_usd from Claude SDK (authoritative)
}

export interface TerminalInfo {
  id: string;
  label: string;
  color: string;
  cwd: string;
  alive: boolean;
  // NO agentChatId - terminals are independent, only grouped by cwd in UI
  status?: "idle" | "busy";
  needsAttention?: boolean;
  hasResponded?: boolean;           // Ha già risposto alla richiesta corrente?
  responseStartTime?: number | null; // Timestamp inizio risposta
  waitingForResponse?: boolean;      // Chat is idle and waiting for user input
  workingOn?: string;                // What the agent is working on (max 5 words)
  avatar?: string;                   // Avatar filename (e.g., "mike.png")
  branch?: string;                   // Git branch this agent is working on
  useWorktree?: boolean;             // Whether this agent uses Git worktree
  worktreePath?: string;             // Path to worktree if different from cwd
  personality?: Partial<AgentPersonality>; // Agent personality traits
}

// ProjectTerminal: Integrated XTerm terminal associated with a project
// Terminals are now project-scoped, not agent-scoped
export interface ProjectTerminal {
  id: string;
  name: string;
  projectPath: string;  // Project directory (working directory)
  color: string;
  cwd: string;
  alive: boolean;
  status?: "idle" | "busy";
  createdAt: number;
}

// DEPRECATED: Legacy type for backwards compatibility
export type AgentTerminal = ProjectTerminal;

export type SavedCommandCategory = "dev" | "build" | "test" | "custom";

export interface SavedCommand {
  id: string;
  name: string;
  command: string;
  cwd?: string;
  color: string;
  category: SavedCommandCategory;
}

export interface ProcessInfo {
  terminalId: string;
  terminalLabel: string;
  command?: string;
  pid?: number;
  port?: number;
  uptimeSeconds: number;
  status: "running" | "idle";
}

export interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
}

export interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
}

export interface SearchResult {
  name: string;
  path: string;
  relative_path: string;
  is_dir: boolean;
  is_symlink: boolean;
  score: number;
  depth: number;
}

export interface GitStatusEntry {
  path: string;
  original_path: string | null;
  staged_status: string | null;
  unstaged_status: string | null;
  is_untracked: boolean;
  additions: number | null;
  deletions: number | null;
}

export interface GitStatusSummary {
  branch: string;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  entries: GitStatusEntry[];
  clean: boolean;
}

export interface GitCommitEntry {
  hash: string;
  summary: string;
  author: string;
  relativeTime: string;
  timestamp?: number;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  hasRemote: boolean;
  upstream?: string;
  behind?: number;
}

export interface GitMergeResult {
  success: boolean;
  hasConflicts: boolean;
  conflictedFiles: string[];
  message: string;
}

export interface GitPullResult {
  success: boolean;
  hasConflicts: boolean;
  conflictedFiles: string[];
  message: string;
  isFastForward: boolean;
}

export interface GitConflictFile {
  path: string;
  status: string;
}

export interface GitWorktree {
  path: string;
  branch: string;
  commitHash: string;
  isBare: boolean;
  isDetached: boolean;
}

export interface TerminalDataEvent {
  id: string;
  data: string;
}

export interface TerminalExitEvent {
  id: string;
  code: number;
  success: boolean;
  message: string | null;
}

// AI Assistant types
export interface AISuggestion {
  command: string;
  explanation: string;
  confidence: number;
  alternative?: string;
}

export interface AISettings {
  apiKey: string;
  model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo';
  enableCommandAssistant: boolean;
  enableErrorAnalyzer: boolean;
}

export interface TokenStats {
  totalTokensUsed: number;
  estimatedCost: number;
  requestCount: number;
}

export interface TerminalContext {
  os: string;
  shell: string;
  cwd: string;
  recentCommands: string[];
  errorOutput?: string;
}

export interface AIRequest {
  intent: string;
  context: TerminalContext;
  requestType: 'command' | 'error' | 'prompt-engineer';
}

// Prompt Engineering types
export interface AIQuestion {
  question: string;
  questionNumber: number;
  totalQuestions: number;
}

export interface AIAnswer {
  questionNumber: number;
  answer: string;
}

export interface AIPromptImprovement {
  originalPrompt: string;
  improvedPrompt: string;
  improvements: string[];
  confidence: number;
}

export interface AIPromptEngineerResponse {
  type: 'questions' | 'improvement';
  questions?: AIQuestion[];
  improvement?: AIPromptImprovement;
}

// Quack Agency types
export interface AgentInfo {
  name: string;
  description: string;
  model: string;
  color: string;
  file_path: string;
  scope: string; // "global" or "project"
  workingOn?: string; // What the agent is working on (max 5 words)
  avatar?: string; // Avatar filename (e.g., "24d6c816fe40a284f2451b1469c5e6d63d236e53.png")
}

export interface AgentDetails extends AgentInfo {
  content: string;
}

// Agent Personality types (for dynamic CLAUDE.md generation)
// REDESIGNED: More practical and focused on actual development needs
export interface AgentPersonality {
  id: string;
  name: string;
  role: string; // Mission/Role (e.g., "Backend Performance Specialist")
  technicalContext?: string; // Free-form technical context about current project
  rules?: string[]; // Rules & best practices (e.g., "Max 3s timeout for Tauri calls")
  communicationStyle: string; // How the agent communicates (friendly, professional, etc.)
  customNotes?: string; // Additional free-form notes

  // Selected Claude Code rules (file paths from .claude/rules/)
  selectedRules?: string[]; // Array of rule file paths to follow

  // Quick-access tools for this agent (shown in chat EquipBar)
  toolkit?: AgentToolkit;

  // Legacy fields (kept for backwards compatibility during migration)
  personality?: string;
  quirks?: string;
  specialties?: string[];
  skills?: string[];
  expressions?: string[];
  intro?: string;
}

/** Agent toolkit - quick-access tools shown in chat EquipBar */
export interface AgentToolkit {
  skills: string[];
  droids: string[];
  commands: string[];
}

// Saved Agent types (for agent reusability across projects)
export interface SavedAgent {
  id: string;
  name: string;
  avatar: string;
  color: string;
  workingOn?: string;
  personality: Partial<AgentPersonality>;
  createdAt: number;
  lastUsed: number;
  usageCount: number; // Track how many times this agent has been used
}

// Skills types (similar to Agents)
export interface SkillInfo {
  name: string;
  description: string;
  file_path: string;
  scope: string; // "global" or "project"
}

export interface SkillDetails extends SkillInfo {
  content: string;
}

// Quack Agency Setup Wizard types
export interface SetupWizardData {
  userName: string;
  userLanguage: string;
  description: string;
  techStack: string;
  features: string[];
  initGit: boolean;
  createAgents: boolean;
}

export interface SetupResult {
  success: boolean;
  message: string;
  agentsCreated: number;
  filesCreated: string[];
}

// Claude Chat types
export type ChatRole = "user" | "assistant" | "system";
export type ChatMessageStatus = "sending" | "streaming" | "complete" | "error";

export interface DiffLine {
  type: 'added' | 'removed' | 'unchanged';
  content: string;
  lineNumber?: number;
}

export interface ToolDiff {
  fileName?: string;
  lines: DiffLine[];
}

export interface ChatToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status?: 'running' | 'completed' | 'error';
  result?: string;
  diff?: ToolDiff;
  timestamp?: number;
}

export interface ChatToolResult {
  toolCallId: string;
  output: string;
  error?: string;
}

export interface ChatAttachment {
  id: string;
  name: string;
  path: string;
  size: number;
  mimeType?: string;
  previewUrl?: string;
}

// Settings metadata stored with each assistant message for UI display
export interface MessageSettingsMetadata {
  model?: 'opus' | 'sonnet' | 'haiku';
  effort?: EffortLevel;
  thinkingMode?: string; // 'auto' | 'think' | 'hard' | 'harder' | 'ultra'
  hasThinkingBlocks?: boolean; // True if response contained thinking blocks
}

export interface ChatMessage {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: number;
  status?: ChatMessageStatus;
  toolCalls?: ChatToolCall[];
  toolResults?: ChatToolResult[];
  error?: string;
  attachments?: ChatAttachment[];
  events?: ClaudeEvent[]; // Claude CLI events for streaming visualization
  metadata?: Record<string, unknown>; // Additional metadata for special messages
  settings?: MessageSettingsMetadata; // Settings used for this message (SDK 0.1.54+)
  thinkingContent?: string; // Extracted thinking block content for display
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
  workingDirectory?: string;
  claudeSessionId?: string; // Claude Agent SDK session ID for resume
}

/**
 * AgentSession - Represents a chat session owned by an agent
 * Replaces KanbanTask for the sessions-first architecture
 */
export interface AgentSession {
  id: string;                      // UUID generato da Quack
  claudeSessionId?: string;        // ID reale Claude Code (ff919cb3-...)
  title: string;                   // Nome dato dall'utente o ID Claude Code
  agentId: string;                 // TerminalInfo.id dell'agente
  projectPath: string;             // /Users/.../quack-app
  projectName: string;             // "quack-app"
  status: AgentSessionStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  messageCount: number;
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalCost?: number;

  // Initial prompt and attachments from Kanban task creation
  // These are pre-populated in ChatInput when opening the session for the first time
  initialPrompt?: string;
  initialAttachments?: ChatAttachment[];
  initialPromptConsumed?: boolean;  // Flag to avoid re-population on re-open
}

export type AgentSessionStatus = 'todo' | 'in_progress' | 'done';

// Simplified ClaudeSession for Telegram integration
export interface ClaudeSession {
  id: string;
  name: string;
  isStreaming: boolean;
}

export interface ClaudeSettings {
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  enableTools: boolean;
  enableStreaming: boolean;
}

export interface StreamChunk {
  type: "text" | "tool_use" | "tool_result";
  content: string;
  toolCall?: ChatToolCall;
}

// Structured Outputs types (Claude API beta feature)
// Guarantees JSON schema compliance in Claude responses
export interface StructuredOutputSchema {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean';
  properties?: Record<string, StructuredOutputSchema>;
  items?: StructuredOutputSchema;
  required?: string[];
  description?: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
  minItems?: number;
  maxItems?: number;
}

export interface StructuredOutputFormat {
  type: 'json_schema';
  schema: StructuredOutputSchema;
}

// Effort parameter for controlling response quality vs speed/cost tradeoff
export type EffortLevel = 'low' | 'medium' | 'high';

// Thinking mode for controlling reasoning depth
export type ThinkingMode = 'auto' | 'think' | 'hard' | 'harder' | 'ultra';

// Mode preset configuration for Bypass/Plan modes
export interface ModePreset {
  model: 'opus' | 'sonnet' | 'haiku';
  thinkingMode: ThinkingMode;
  effort: EffortLevel;
}

// Agent mode presets stored in settings
export interface AgentModePresets {
  bypass: ModePreset;
  plan: ModePreset;
}

// Claude CLI Event types (matching Rust backend + Claude Agent SDK)
export interface ClaudeEventBase {
  type: 'system' | 'assistant' | 'user' | 'result' | 'agent' | 'error' | 'message_start' | 'message_delta' | 'message_stop' | 'content_block_start' | 'content_block_delta' | 'content_block_stop';
}

export interface ClaudeSystemEvent extends ClaudeEventBase {
  type: 'system';
  subtype?: string;
  session_id?: string;
  model?: string;
  cwd?: string;
  tools?: string[];
}

export interface ClaudeContentBlock {
  type: 'text' | 'tool_use' | 'thinking';
  text?: string;
  thinking?: string; // Content of thinking block when type is 'thinking'
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

export interface ClaudeAssistantMessage {
  id: string;
  content: ClaudeContentBlock[];
  uuid?: string; // SDK message UUID (for file checkpointing)
}

export interface ClaudeAssistantEvent extends ClaudeEventBase {
  type: 'assistant';
  message: ClaudeAssistantMessage;
  session_id?: string;
}

export interface ClaudeUserEvent extends ClaudeEventBase {
  type: 'user';
  message: {
    content: Array<{
      type: 'text' | 'tool_result';
      text?: string;
      tool_use_id?: string;
      content?: string;
      is_error?: boolean;
    }>;
  };
  session_id?: string;
  uuid?: string; // SDK User message UUID (for file checkpointing rewind)
}

export interface ClaudeResultEvent extends ClaudeEventBase {
  type: 'result';
  result?: string;
  error?: string;
  is_error?: boolean;
  session_id?: string;
  total_cost_usd?: number;
  cost_usd?: number;
  duration_ms?: number;
  usage?: UsageStats;
  stop_reason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
}

// NEW SDK Events
export interface ClaudeAgentEvent extends ClaudeEventBase {
  type: 'agent';
  action: 'start' | 'stop';
  agent_name?: string;
  agent_type?: string;
  session_id?: string;
}

export interface ClaudeErrorEvent extends ClaudeEventBase {
  type: 'error';
  error: string;
  code?: string;
  session_id?: string;
}

export interface ClaudeMessageStartEvent extends ClaudeEventBase {
  type: 'message_start';
  session_id?: string;
}

export interface ClaudeMessageDeltaEvent extends ClaudeEventBase {
  type: 'message_delta';
  delta: {
    stop_reason?: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
    stop_sequence?: string;
  };
  usage?: UsageStats;
  session_id?: string;
}

export interface ClaudeMessageStopEvent extends ClaudeEventBase {
  type: 'message_stop';
  session_id?: string;
}

export interface ClaudeContentBlockStartEvent extends ClaudeEventBase {
  type: 'content_block_start';
  index: number;
  content_block: {
    type: 'text' | 'tool_use';
    id?: string;
    name?: string;
  };
  session_id?: string;
}

export interface ClaudeContentBlockDeltaEvent extends ClaudeEventBase {
  type: 'content_block_delta';
  index: number;
  delta: {
    type: 'text_delta' | 'input_json_delta';
    text?: string;
    partial_json?: string;
  };
  session_id?: string;
}

export interface ClaudeContentBlockStopEvent extends ClaudeEventBase {
  type: 'content_block_stop';
  index: number;
  session_id?: string;
}

export type ClaudeEvent =
  | ClaudeSystemEvent
  | ClaudeAssistantEvent
  | ClaudeUserEvent
  | ClaudeResultEvent
  | ClaudeAgentEvent
  | ClaudeErrorEvent
  | ClaudeMessageStartEvent
  | ClaudeMessageDeltaEvent
  | ClaudeMessageStopEvent
  | ClaudeContentBlockStartEvent
  | ClaudeContentBlockDeltaEvent
  | ClaudeContentBlockStopEvent;

// ============================================
// AskUserQuestion Types (SDK v0.1.71+)
// ============================================

/**
 * A single option in an AskUserQuestion
 */
export interface AskUserQuestionOption {
  /** Display text for this option (1-5 words) */
  label: string;
  /** Explanation of what this option means */
  description: string;
}

/**
 * A single question in AskUserQuestion
 */
export interface AskUserQuestion {
  /** The complete question to ask (ends with ?) */
  question: string;
  /** Short label displayed as chip/tag (max 12 chars) */
  header: string;
  /** Available choices (2-4 options) */
  options: AskUserQuestionOption[];
  /** true = checkbox (multi), false = radio (single) */
  multiSelect: boolean;
}

/**
 * Input for the AskUserQuestion tool
 */
export interface AskUserQuestionInput {
  /** Questions to ask (1-4) */
  questions: AskUserQuestion[];
}

/**
 * User's answers to AskUserQuestion
 * Keys are question headers, values are selected label(s)
 */
export interface AskUserQuestionAnswers {
  [questionHeader: string]: string | string[];
}

/**
 * State for a pending question waiting for user response
 */
export interface PendingUserQuestion {
  toolUseId: string;
  input: AskUserQuestionInput;
  timestamp: number;
  answered: boolean;
}

// Slash Commands types
export type SlashCommandScope = 'built-in' | 'project' | 'user' | 'plugin' | 'mcp';

export interface SlashCommandFrontmatter {
  'allowed-tools'?: string;
  'argument-hint'?: string;
  description?: string;
  model?: string;
  'disable-model-invocation'?: boolean;
}

export interface SlashCommand {
  name: string; // Command name without the leading "/"
  description: string;
  scope: SlashCommandScope;
  filePath?: string; // Path to .md file (for custom commands)
  frontmatter?: SlashCommandFrontmatter;
  content?: string; // Markdown content (for custom commands)
  argumentHint?: string; // Hint for command arguments
  namespace?: string; // Subdirectory namespace (e.g., "frontend", "backend")
  serverName?: string; // MCP server name (for MCP commands)
}

export interface SlashCommandsResponse {
  builtIn: SlashCommand[];
  custom: SlashCommand[];
}

export interface CreateSlashCommandParams {
  name: string;
  description: string;
  content: string;
  argumentHint?: string;
  frontmatter?: SlashCommandFrontmatter;
}

// TodoWrite types
export interface TodoItem {
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
  activeForm: string;
}

// Agent Chat Settings - persistent per-agent configuration
export interface AgentChatSettings {
  inputDraft: string; // Draft text being typed
  model: string; // Selected model (e.g., 'sonnet', 'opus')
  thinkingMode: string; // Thinking mode setting
  permissionMode: string; // Permission mode ('plan', 'act', 'bypass')
  effort?: EffortLevel; // SDK 0.1.54+ - Controls quality vs speed/cost tradeoff
}

// MCP (Model Context Protocol) Server types
export type MCPServerType =
  | 'filesystem'
  | 'github'
  | 'slack'
  | 'database'
  | 'puppeteer'
  | 'playwright'
  | 'custom';

export type MCPServerStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'error';

export type MCPTransportType = 'stdio' | 'http' | 'sse';

export interface MCPServer {
  id: string;
  name: string;
  type: MCPServerType;
  transport: MCPTransportType; // Transport protocol type

  // Stdio fields (optional, only for stdio transport)
  command?: string;
  args?: string[];

  // HTTP/SSE fields (optional, only for http/sse transport)
  url?: string;
  headers?: Record<string, string>;
  method?: string; // HTTP method (default: POST)

  // Common fields
  env?: Record<string, string>;
  enabled: boolean;
  status: MCPServerStatus;
  error?: string;
  scope: 'global' | 'project'; // Indicates where the MCP is configured
}

// Discriminated union for MCP server configurations
export type MCPServerConfig =
  | {
      type: 'stdio';
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  | {
      type: 'http';
      url: string;
      headers?: Record<string, string>;
      method?: string;
      env?: Record<string, string>;
    }
  | {
      type: 'sse';
      url: string;
      headers?: Record<string, string>;
      env?: Record<string, string>;
    };

export interface MCPConfigFile {
  mcpServers: Record<string, MCPServerConfig>;
}

export interface MCPTemplate {
  id: string;
  name: string;
  description: string;
  type: MCPServerType;
  icon: string;
  config: MCPServerConfig;
}

// Plugin Marketplace types
export type PluginCategory = 'agent' | 'command' | 'hook' | 'setting' | 'mcp' | 'stack' | 'skill';
export type PluginSource = 'davila7' | 'aitmpl' | 'custom';
export type PluginScope = 'global' | 'project';

export interface PluginMetadata {
  icon?: string;
  tags: string[];
  dependencies?: string[];
}

export interface Plugin {
  id: string;
  name: string;
  description: string;
  category: PluginCategory;
  version: string;
  author: string;
  repository?: string;
  installed: boolean;
  source: PluginSource;
  metadata: PluginMetadata;
  scope?: PluginScope;
}

// Usage Tracking types (Claude Agent SDK cost tracking)
export interface UsageStats {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export interface SessionUsage {
  session_id: string;
  agent_name: string;
  started_at: number;
  last_updated: number;
  total_cost_usd: number;
  step_count: number;
  usage: UsageStats;
}

export interface AgentUsageSummary {
  agent_name: string;
  total_sessions: number;
  total_cost_usd: number;
  total_steps: number;
  usage: UsageStats;
  last_used: number;
}

export interface DailyUsageSummary {
  date: string; // YYYY-MM-DD
  total_cost_usd: number;
  total_steps: number;
  session_count: number;
  usage: UsageStats;
  agents: Record<string, AgentUsageSummary>;
}

// Plan Usage types (Pro/Team plan percentages via CLI parsing)
export interface PlanUsageData {
  current_session: SessionPlanUsage;
  current_week: WeeklyPlanUsage;
  reset_time?: string;
  last_updated: number;
}

export interface SessionPlanUsage {
  percentage: number;
  model?: string;
}

export interface WeeklyPlanUsage {
  all_models: number;
  opus?: number;
  sonnet?: number;
}

// PiP (Picture-in-Picture) Mode types
export type PipAgentStatus = 'idle' | 'thinking' | 'streaming' | 'executing' | 'completed' | 'error';

export interface PipAgentState {
  agentId: string;
  agentName: string;
  color: string;
  sessionId?: string;
  status: PipAgentStatus;
  lastMessage?: string;
  lastActivity?: number;
  toolsExecuted: number;
  currentTool?: string;
  progress?: number; // 0-100 for ongoing tasks
  error?: string;
}

export interface PipWindowState {
  agents: PipAgentState[];
  position?: { x: number; y: number };
  size?: { width: number; height: number };
}

// Claude Agent SDK Session types
export interface SessionHistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: number;
  tool_calls?: Array<{
    name: string;
    input: Record<string, unknown>;
  }>;
}

export interface SessionInfo {
  id: string; // Session ID (from file-history folder name)
  title: string; // First user message or derived title
  createdAt: number; // Timestamp from history.jsonl first entry
  updatedAt: number; // Timestamp from history.jsonl last entry
  messageCount: number; // Total messages in session
  totalTokens: number; // Sum of input + output tokens
  totalCost: number; // Total cost in USD
  status: 'active' | 'completed' | 'error';
  workingDirectory?: string; // CWD from first system event
  model?: string; // Model from first system event
  agentName?: string; // Agent name if available
}

export interface SessionDetails extends SessionInfo {
  messages: SessionHistoryMessage[]; // All messages from history.jsonl
  usage: UsageStats; // Detailed token usage stats
  events: ClaudeEvent[]; // All Claude events for detailed view
}

// Marketplace types
export type MarketplaceCategory = 'agents' | 'commands' | 'hooks' | 'settings' | 'mcp' | 'stacks' | 'skills';

export interface MarketplaceResource {
  id: string;
  name: string;
  description: string;
  category: MarketplaceCategory;
  author: string;
  authorAvatar?: string;
  installCount: number;
  rating?: number;
  tags: string[];
  version: string;
  installCommand?: string; // Legacy - now uses GitHub download
  repository?: string; // GitHub repo URL
  icon?: string;
  featured?: boolean;
  verified?: boolean;
  createdAt: string;
  updatedAt: string;
  dependencies?: string[];
  screenshots?: string[];
}

export interface MarketplaceStack {
  id: string;
  name: string;
  description: string;
  resources: MarketplaceResource[];
  author: string;
  public: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MarketplaceLibrary {
  installedResources: MarketplaceResource[];
  customStacks: MarketplaceStack[];
  favorites: string[]; // Resource IDs
  lastSync: number;
}

export interface MarketplaceFilters {
  category?: MarketplaceCategory;
  searchQuery?: string;
  tags?: string[];
  verified?: boolean;
  featured?: boolean;
  sortBy?: 'popular' | 'recent' | 'name' | 'rating';
  showFavoritesOnly?: boolean;
}

// ==========================================
// Hooks Types (Claude Agent SDK Hooks)
// ==========================================

/**
 * Available hook event types from Claude Agent SDK
 */
export type HookType = 'PreToolUse' | 'PostToolUse' | 'Notification' | 'Stop' | 'SubagentStop';

/**
 * Scope of the hook - project-level or global
 */
export type HookScope = 'project' | 'global';

/**
 * Hook configuration stored in .claude/settings.json
 */
export interface HookConfig {
  id: string;
  name: string;
  type: HookType;
  matcher: string;      // Tool name to match (e.g., "Write", "Read", "*" for all)
  command: string;      // Shell command to execute
  enabled: boolean;
  scope: HookScope;
  description?: string;
}

/**
 * Template for creating hooks from predefined patterns
 */
export interface HookTemplate {
  id: string;
  name: string;
  type: HookType;
  matcher: string;
  commandTemplate: string;  // May include placeholders like $WEBHOOK_URL
  description: string;
  icon: string;
  variables?: HookTemplateVariable[];
}

/**
 * Variable that can be configured when using a template
 */
export interface HookTemplateVariable {
  name: string;           // e.g., "WEBHOOK_URL"
  label: string;          // Display label
  placeholder?: string;
  required: boolean;
  type: 'text' | 'url' | 'path';
}

/**
 * Event emitted when a hook is triggered during execution
 */
export interface HookExecutionEvent {
  hookId: string;
  hookName: string;
  hookType: HookType;
  toolName?: string;
  timestamp: number;
  success: boolean;
  output?: string;
  error?: string;
}

// ==========================================
// Prompt Snippets Types
// ==========================================

/**
 * A prompt snippet that can be triggered by a tag
 * Supports dynamic variables like {date}, {clipboard}, {time}
 */
export interface Snippet {
  id: string;
  name: string;
  content: string;
  tag: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dynamic variable that can be used in snippets
 */
export type SnippetVariable =
  | '{date}'        // Current date (YYYY-MM-DD)
  | '{time}'        // Current time (HH:MM)
  | '{datetime}'    // Current date and time
  | '{clipboard}'   // Clipboard content
  | '{selection}'   // Selected text (if any)
  | '{cursor}'      // Cursor position marker
  | '{project}'     // Current project name
  | '{branch}'      // Current git branch
  | '{file}'        // Current file path (if in editor)
  | '{username}'    // System username
  | string;         // Custom variable

/**
 * Snippet form data for create/edit
 */
export interface SnippetFormData {
  name: string;
  content: string;
  tag: string;
}

// ==========================================
// Background Agents Types (SDK 0.1.62+)
// ==========================================

/**
 * Priority levels for background tasks
 * Higher priority tasks are executed first in the queue
 */
export type BackgroundTaskPriority = 'high' | 'medium' | 'low';

/**
 * Status of a background task
 */
export type BackgroundTaskStatus =
  | 'queued'      // Waiting in queue
  | 'running'     // Currently executing
  | 'paused'      // Manually paused by user
  | 'completed'   // Successfully completed
  | 'failed'      // Failed with error
  | 'cancelled';  // Cancelled by user

/**
 * Type of background task
 */
export type BackgroundTaskType =
  | 'agent'       // Droid/Agent execution
  | 'build'       // Build process (npm build, cargo build, etc.)
  | 'test'        // Test execution
  | 'analysis'    // Code analysis (security, lint, etc.)
  | 'watch'       // File watcher/monitor
  | 'custom';     // Custom user-defined task

/**
 * A single log entry from a background task
 */
export interface BackgroundTaskLogEntry {
  id: string;
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source?: string; // Tool name or process that generated the log
}

/**
 * Progress information for a background task
 */
export interface BackgroundTaskProgress {
  current: number;      // Current progress value
  total: number;        // Total expected value
  percentage: number;   // Calculated percentage (0-100)
  stage?: string;       // Current stage description
}

/**
 * Result of a completed background task
 */
export interface BackgroundTaskResult {
  success: boolean;
  output?: string;          // Final output/result text
  error?: string;           // Error message if failed
  artifacts?: string[];     // Generated files or outputs
  duration_ms: number;      // Total execution time
  usage?: UsageStats;       // Token usage if agent-based
  cost_usd?: number;        // Cost if agent-based
}

/**
 * Configuration for a background task
 */
export interface BackgroundTaskConfig {
  type: BackgroundTaskType;
  priority: BackgroundTaskPriority;
  name: string;
  description?: string;

  // Agent-specific config
  agentId?: string;           // Droid ID if type is 'agent'
  prompt?: string;            // Prompt for agent
  model?: 'opus' | 'sonnet' | 'haiku';
  workingDirectory?: string;

  // Build/Test specific config
  command?: string;           // Shell command to run
  args?: string[];            // Command arguments
  env?: Record<string, string>; // Environment variables

  // Watch specific config
  watchPatterns?: string[];   // Glob patterns to watch
  debounceMs?: number;        // Debounce time for file changes

  // Behavior config
  autoRetry?: boolean;        // Auto retry on failure
  maxRetries?: number;        // Max retry attempts
  timeout_ms?: number;        // Timeout in milliseconds
  showLogsInRealtime?: boolean; // Show logs as they come
  notifyOnComplete?: boolean;   // Show notification when done

  // Kanban integration
  kanbanTaskId?: string;      // Link to Kanban task for status sync
}

/**
 * A background task instance
 */
export interface BackgroundTask {
  id: string;
  config: BackgroundTaskConfig;
  status: BackgroundTaskStatus;

  // Timing
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  pausedAt?: number;

  // Progress tracking
  progress?: BackgroundTaskProgress;

  // Logs (kept in memory, can be limited)
  logs: BackgroundTaskLogEntry[];
  logsVisible: boolean;       // User preference for showing logs

  // Session info (for agent tasks)
  sessionId?: string;

  // Result (when completed)
  result?: BackgroundTaskResult;

  // Retry tracking
  retryCount: number;

  // Queue position (when queued)
  queuePosition?: number;

  // Dependencies (tasks that must complete first)
  dependsOn?: string[];       // Task IDs this task depends on

  // Chat integration
  chatId?: string;            // AgentChat ID to post results to
  resultMessageId?: string;   // ID of the chat message with results
}

/**
 * Queue statistics for the background task system
 */
export interface BackgroundTaskQueueStats {
  totalTasks: number;
  queued: number;
  running: number;
  paused: number;
  completed: number;
  failed: number;
  cancelled: number;
}

/**
 * State of the background agent system
 */
export interface BackgroundAgentState {
  tasks: BackgroundTask[];
  queueStats: BackgroundTaskQueueStats;
  maxConcurrent: number;      // Max concurrent running tasks
  isPaused: boolean;          // Global pause for the queue
  lastUpdated: number;
}

/**
 * Event emitted when a background task changes state
 */
export interface BackgroundTaskEvent {
  type: 'created' | 'started' | 'progress' | 'log' | 'paused' | 'resumed' | 'completed' | 'failed' | 'cancelled';
  taskId: string;
  timestamp: number;
  data?: {
    progress?: BackgroundTaskProgress;
    log?: BackgroundTaskLogEntry;
    result?: BackgroundTaskResult;
    error?: string;
  };
}

/**
 * Filters for viewing background tasks
 */
export interface BackgroundTaskFilters {
  status?: BackgroundTaskStatus[];
  type?: BackgroundTaskType[];
  priority?: BackgroundTaskPriority[];
  searchQuery?: string;
  showCompleted?: boolean;
  sortBy?: 'created' | 'priority' | 'status' | 'name';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Watch trigger configuration (for file monitoring)
 */
export interface WatchTrigger {
  id: string;
  name: string;
  patterns: string[];         // Glob patterns to watch
  excludePatterns?: string[]; // Patterns to exclude
  action: BackgroundTaskConfig; // Task to run when triggered
  debounceMs: number;
  enabled: boolean;
  lastTriggered?: number;
}

/**
 * Auto-trigger rule for droids
 */
export interface DroidAutoTrigger {
  droidId: string;
  triggerOn: 'file_change' | 'git_commit' | 'build_complete' | 'test_fail' | 'manual';
  patterns?: string[];        // File patterns for file_change trigger
  enabled: boolean;
  priority: BackgroundTaskPriority;
}

// ==========================================
// Rules Types (.claude/rules/ management)
// ==========================================

/**
 * Scope of the rule - project-level or global (user)
 */
export type RuleScope = 'project' | 'global';

/**
 * YAML frontmatter parsed from rule markdown files
 */
export interface RuleFrontmatter {
  description?: string;
  globs?: string[];      // Path patterns for scoped rules
  alwaysApply?: boolean; // If true, always apply regardless of path
}

/**
 * A Claude Code rule definition
 */
export interface Rule {
  id: string;
  name: string;           // Filename without extension
  content: string;        // Full markdown content including frontmatter
  filePath: string;       // Full path to the rule file
  scope: RuleScope;
  frontmatter?: RuleFrontmatter;
  createdAt: number;
  updatedAt: number;
}

/**
 * Response from listing rules
 */
export interface RulesResponse {
  project: Rule[];
  global: Rule[];
}

/**
 * Parameters for creating a new rule
 */
export interface CreateRuleParams {
  name: string;
  content: string;
  scope: RuleScope;
  description?: string;
  globs?: string[];
  alwaysApply?: boolean;
}

// ==========================================
// Kanban Board Types
// ==========================================

/**
 * Status of a Kanban task
 */
export type KanbanStatus = 'todo' | 'in_progress' | 'done';

/**
 * Type of Kanban task - determines card appearance and behavior
 */
export type KanbanTaskType = 'agent' | 'shell' | 'watch';

/**
 * Agent info for Kanban tasks - based on TerminalInfo (active agents in sidebar)
 * This represents the actual agent/terminal that will execute the task
 */
export interface KanbanAssignedAgent {
  // Core identity
  id: string;                         // Terminal/Agent ID
  name: string;                       // Agent name (e.g., "Agent Magnus")
  color: string;                      // Agent color
  avatar?: string;                    // Avatar filename or custom avatar UUID

  // Project context
  projectPath: string;                // Project directory
  projectName: string;                // Display name (e.g., "quack-app")
  branch?: string;                    // Git branch
  useWorktree?: boolean;              // Whether using Git worktree
  worktreePath?: string;              // Worktree path if different from cwd

  // Optional metadata
  workingOn?: string;                 // What the agent is working on
  personality?: Record<string, unknown>; // Agent personality traits
}

/**
 * A task on the Kanban board - supports agent tasks, shell commands, and file watchers
 */
export interface KanbanTask {
  id: string;
  title: string;                      // Short title for the card
  prompt: string;                     // Full chat prompt (for agent tasks)
  status: KanbanStatus;
  assignedAgent?: KanbanAssignedAgent;

  // Task type - determines card appearance and behavior
  type: KanbanTaskType;               // 'agent' | 'shell' | 'watch' (default: 'agent')

  // Project context (derived from assignedAgent or set manually)
  projectPath: string;                // Which project this task belongs to
  projectName: string;                // Display name for the project
  branch?: string;                    // Git branch for the task
  useWorktree?: boolean;              // Whether to use isolated Git worktree
  worktreePath?: string;              // Git worktree path for isolated task work
  targetBranch?: string;              // Branch to merge into when done (default: main)

  // Session management (for agent tasks)
  sessionId?: string;                 // Claude SDK session ID for resume
  terminalId?: string;                // Associated terminal ID (if started)

  // Shell task specific fields
  command?: string;                   // Shell command to run (e.g., "npm run build")
  exitCode?: number;                  // Process exit code when done
  pid?: number;                       // Process ID for kill functionality

  // Watch task specific fields
  watchPatterns?: string[];           // Glob patterns to watch (e.g., ["src/**/*.ts"])
  watchDebounceMs?: number;           // Debounce delay in ms (default: 300)
  watchCommand?: string;              // Command to run when files change
  lastTriggered?: number;             // Timestamp of last trigger

  // Timestamps
  createdAt: number;
  startedAt?: number;
  completedAt?: number;

  // Token tracking for cost display (agent tasks only)
  inputTokens?: number;
  outputTokens?: number;
  cacheCreationTokens?: number;
  cacheReadTokens?: number;
  totalCost?: number;

  // Attachments (images)
  attachments?: ChatAttachment[];

  // Subtask hierarchy (for task decomposition)
  parentTaskId?: string;              // ID of parent task if this is a subtask

  // Progress tracking (for update tool)
  progress?: number;                  // 0-100 percentage
  notes?: string;                     // Additional notes
  blockedBy?: string;                 // ID of blocking task
  completionNote?: string;            // Note when marked as done

  // Chat settings (persisted per task)
  chatModel?: 'opus' | 'sonnet' | 'haiku';
  chatThinkingMode?: 'auto' | 'think' | 'hard' | 'harder' | 'ultra';
  chatPermissionMode?: 'plan' | 'bypass';
  chatEffort?: 'low' | 'medium' | 'high';

  // Task completion tracking
  docFilePath?: string;               // Path to generated documentation
  memoryEntityId?: string;            // ID of memory entity in Second Brain
}

// ==========================================
// Keyboard Shortcuts Types
// ==========================================

/**
 * Available shortcut action IDs
 */
export type ShortcutActionId =
  | 'toggleKanban'
  | 'openTerminalWindow'
  | 'toggleSidePanel'
  | 'newAgent'
  | 'focusFileSearch'
  | 'newKanbanTask'
  | 'chatAttachFile'
  | 'chatMentionAgent'
  | 'chatToggleLock'
  | 'chatToggleFullscreen'
  | 'chatVoiceRecord'
  | 'chatSendMessage'
  | 'chatOpenSnippets'
  | 'chatOpenDroids'
  | 'chatOpenCommands'
  | 'chatInsertXml'
  | 'chatNewLine';

/**
 * Configuration for a single keyboard shortcut
 */
export interface ShortcutConfig {
  id: ShortcutActionId;
  label: string;
  description: string;
  defaultKeys: string; // e.g., "Meta+K" for Cmd+K
  currentKeys: string; // User's customized keys
}

/**
 * Initial values when creating a Kanban task from drag-drop or /background command
 */
export interface KanbanTaskInitialValues {
  projectPath?: string;
  projectName?: string;
  branch?: string;
  agentId?: string;
  agentName?: string;
  agentAvatar?: string;
  agentColor?: string;
  targetStatus?: 'todo' | 'in_progress' | 'done'; // Target column when creating task
  // New fields for shell/watch tasks
  type?: KanbanTaskType;              // Task type (default: 'agent')
  command?: string;                   // Shell command for shell/watch tasks
  watchPatterns?: string[];           // Patterns for watch tasks
  watchDebounceMs?: number;           // Debounce for watch tasks
}

// ============================================================================
// TASK COMPLETION HOOKS
// ============================================================================

/**
 * Context passed to task completion hooks
 */
export interface TaskCompletionContext {
  task: KanbanTask;
  chatMessages: ChatMessage[];
  options: TaskCompletionOptions;
}

/**
 * Options for task completion processing
 */
export interface TaskCompletionOptions {
  /** Skip documentation generation */
  skipDocumentation?: boolean;
  /** Source of the completion trigger */
  source?: 'user' | 'agent' | 'automation';
  /** Custom completion note */
  completionNote?: string;
}

/**
 * Result of task completion processing
 */
export interface TaskCompletionResult {
  /** ID of the created memory entity */
  memoryEntityId?: string;
  /** Path to the created documentation file */
  docFilePath?: string;
  /** Generated summary of the task */
  summary?: string;
  /** Whether documentation was skipped */
  skipped?: boolean;
  /** Error message if failed */
  error?: string;
}

/**
 * Summary extracted from task conversation
 */
export interface TaskSummary {
  /** Original objective from task prompt */
  objective: string;
  /** AI-generated summary of work done */
  summary: string;
  /** Key decisions made during the task */
  keyDecisions: string[];
  /** Files that were modified */
  filesModified: string[];
  /** Tools that were used */
  toolsUsed: string[];
  /** Duration in milliseconds */
  durationMs?: number;
}

// ==========================================
// Agent Bundle Types (Quack Agent System)
// ==========================================

/**
 * Equipment item reference in a bundle
 */
export interface BundleEquipment {
  id: string;
  required: boolean;
}

/**
 * Bundle manifest metadata
 */
export interface BundleAuthor {
  name: string;
  github?: string;
  email?: string;
}

/**
 * Agent personality configuration for bundle
 */
export interface BundlePersonality {
  role: string;
  class: string;
  communicationStyle: string;
  quirks?: string;
  avatar: string;
  color: string;
}

/**
 * Equipment configuration for bundle
 */
export interface BundleEquipmentConfig {
  skills: BundleEquipment[];
  droids: BundleEquipment[];
  rules: BundleEquipment[];
  commands: BundleEquipment[];
}

/**
 * Compatibility requirements for bundle
 */
export interface BundleCompatibility {
  quackVersion: string;
  claudeCodeVersion: string;
}

/**
 * Marketplace metadata for bundle
 */
export interface BundleMarketplaceMetadata {
  category: string;
  tags: string[];
  featured: boolean;
  verified: boolean;
  downloads?: number;
}

/**
 * Complete bundle manifest (manifest.json)
 */
export interface AgentBundleManifest {
  $schema: string;
  id: string;
  version: string;
  name: string;
  displayName: string;
  description: string;
  author: BundleAuthor;
  license: string;
  repository?: string;
  personality: BundlePersonality;
  equipment: BundleEquipmentConfig;
  compatibility: BundleCompatibility;
  marketplace: BundleMarketplaceMetadata;
}

/**
 * Complete agent bundle structure
 */
export interface AgentBundle {
  manifest: AgentBundleManifest;
  skillsFiles: { id: string; content: string; path: string }[];
  droidsFiles: { id: string; content: string; path: string }[];
  rulesFiles: { id: string; content: string; path: string }[];
  commandsFiles: { id: string; content: string; path: string }[];
  assetsFiles: { id: string; content: Uint8Array; path: string }[];
}

/**
 * Power rating breakdown for display
 */
export interface PowerRatingBreakdown {
  total: number;
  base: number;
  skills: number;
  droids: number;
  rules: number;
  commands: number;
  skillCount: number;
  droidCount: number;
  ruleCount: number;
  commandCount: number;
}
