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

  // Legacy fields (kept for backwards compatibility during migration)
  personality?: string;
  quirks?: string;
  specialties?: string[];
  skills?: string[];
  expressions?: string[];
  intro?: string;
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
  installCommand: string; // Full npx command (e.g., "npx claude-code-templates@latest --agent=...")
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
