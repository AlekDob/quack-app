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

// AgentTerminal: NEW - Terminale integrato XTerm associato ad un agente
// Separato da TerminalInfo (vecchio sistema) per evitare confusione
export interface AgentTerminal {
  id: string;
  name: string;
  agentId: string;  // ID dell'agente a cui appartiene questo terminale
  color: string;
  cwd: string;
  alive: boolean;
  status?: "idle" | "busy";
  createdAt: number;
}

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
export interface AgentPersonality {
  id: string;
  name: string;
  role: string;
  personality: string;
  quirks: string;
  communicationStyle: string;
  specialties: string[];
  skills: string[];
  expressions: string[];
  intro?: string;
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

// Claude CLI Event types (matching Rust backend)
export interface ClaudeEventBase {
  type: 'system' | 'assistant' | 'user' | 'result';
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
  type: 'text' | 'tool_use';
  text?: string;
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
}

export type ClaudeEvent = ClaudeSystemEvent | ClaudeAssistantEvent | ClaudeUserEvent | ClaudeResultEvent;

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

export interface MCPServer {
  id: string;
  name: string;
  type: MCPServerType;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status: MCPServerStatus;
  error?: string;
  scope: 'global' | 'project'; // Indicates where the MCP is configured
}

export interface MCPServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

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
