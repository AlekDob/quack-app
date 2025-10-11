export interface TerminalInfo {
  id: string;
  label: string;
  color: string;
  cwd: string;
  alive: boolean;
  status?: "idle" | "busy";
  needsAttention?: boolean;
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
}

export interface AgentDetails extends AgentInfo {
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

export interface ChatToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
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
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
  systemPrompt?: string;
  workingDirectory?: string;
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
