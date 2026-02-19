#!/usr/bin/env node

/**
 * Quack MCP Server (stdio-based)
 *
 * Exposes Quack's agent capabilities to external AI tools via MCP protocol.
 * Any MCP-compatible AI can: list projects/agents, create sessions,
 * send prompts, read responses, and have multi-turn conversations.
 *
 * Architecture: Spawns stream-claude.js as subprocess per session,
 * manages stdin/stdout exactly like the Rust backend does.
 *
 * Tools provided:
 * - quack_list_projects: Discover registered Quack projects
 * - quack_list_agents: List agents for a project
 * - quack_get_agent: Get agent details
 * - quack_list_sessions: List active/recent sessions
 * - quack_create_session: Create session and send first prompt
 * - quack_read_response: Poll for agent response (streaming/complete)
 * - quack_send_message: Continue conversation (resume session)
 * - quack_abort_session: Stop a streaming session
 * - quack_answer_question: Reply to agent's AskUserQuestion
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, basename, dirname } from 'path';
import { homedir, platform } from 'os';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// CONSTANTS
// =============================================================================

const MAX_CONCURRENT_SESSIONS = 5;
const MAX_EVENTS_PER_SESSION = 500;
const MAX_TOOL_CALLS_PER_SESSION = 200;
const MAX_STDIN_PAYLOAD_BYTES = 64 * 1024; // 64 KB
const ZOMBIE_TIMEOUT_MS = 10 * 60 * 1000; // 10 min
const DEFAULT_POLL_TIMEOUT_MS = 120_000;   // 2 min
const MAX_POLL_TIMEOUT_MS = 300_000;       // 5 min
const STREAM_SCRIPT = join(__dirname, 'stream-claude.js');

// =============================================================================
// CROSS-PLATFORM PATHS
// =============================================================================

function getTauriStorePath() {
  const os = platform();
  const home = homedir();
  if (os === 'darwin') {
    return join(home, 'Library', 'Application Support', 'com.quack.terminal');
  } else if (os === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'com.quack.terminal');
  }
  return join(home, '.local', 'share', 'com.quack.terminal');
}

// =============================================================================
// INPUT VALIDATION
// =============================================================================

/** Reject IDs containing path traversal sequences or separators. */
function sanitizeId(id) {
  if (!id || typeof id !== 'string') {
    throw new Error('ID must be a non-empty string');
  }
  if (id.includes('/') || id.includes('\\') || id.includes('..') || id.includes('\0')) {
    throw new Error(`Invalid ID (path traversal detected): ${id}`);
  }
  return id;
}

/** Cache of registered project paths (refreshed on each call). */
let _registeredPaths = null;
let _registeredPathsTs = 0;

/** Validate that projectPath is a registered Quack project. */
function validateProjectPath(projectPath) {
  if (!projectPath || typeof projectPath !== 'string') {
    throw new Error('projectPath must be a non-empty string');
  }
  // Refresh cache every 30 seconds
  const now = Date.now();
  if (!_registeredPaths || now - _registeredPathsTs > 30_000) {
    _registeredPaths = new Set(discoverProjects().map(p => p.path));
    _registeredPathsTs = now;
  }
  if (!_registeredPaths.has(projectPath)) {
    throw new Error(`projectPath is not a registered Quack project: ${projectPath}`);
  }
}

// =============================================================================
// DATA ACCESS LAYER
// =============================================================================

/**
 * Load Quack agents store from Tauri plugin-store JSON.
 * Returns { agents: [], sessions: [], version: number }
 */
function loadQuackStore() {
  const storePath = join(getTauriStorePath(), 'quack-agents.json');
  if (!existsSync(storePath)) return { agents: [], sessions: [], version: 1 };
  try {
    return JSON.parse(readFileSync(storePath, 'utf8'));
  } catch {
    return { agents: [], sessions: [], version: 1 };
  }
}

/**
 * Load agent IDs for a project.
 * Checks .quack/active-agents.json first, falls back to Tauri store.
 * Returns string[] of agent IDs.
 */
function loadActiveAgents(projectPath) {
  // Try active-agents.json first
  const filePath = join(projectPath, '.quack', 'active-agents.json');
  if (existsSync(filePath)) {
    try {
      const data = JSON.parse(readFileSync(filePath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) return data;
    } catch { /* fall through */ }
  }
  // Fallback: get agents from Tauri store filtered by projectPath
  const store = loadQuackStore();
  return (store.agents || [])
    .filter(a => a.projectPath === projectPath)
    .map(a => a.id);
}

/**
 * Load agent personality from .quack/agent-personalities/{id}.json
 */
function loadAgentPersonality(projectPath, agentId) {
  const safeId = sanitizeId(agentId);
  const filePath = join(projectPath, '.quack', 'agent-personalities', `${safeId}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Load all project groups from ~/.quack/groups/
 */
function loadProjectGroups() {
  const groupsDir = join(homedir(), '.quack', 'groups');
  if (!existsSync(groupsDir)) return [];
  try {
    const dirs = readdirSync(groupsDir, { withFileTypes: true })
      .filter(d => d.isDirectory());
    const groups = [];
    for (const dir of dirs) {
      const groupFile = join(groupsDir, dir.name, 'group.json');
      if (!existsSync(groupFile)) continue;
      try {
        groups.push(JSON.parse(readFileSync(groupFile, 'utf8')));
      } catch { /* skip malformed */ }
    }
    return groups;
  } catch {
    return [];
  }
}

/**
 * Discover all projects registered in Quack.
 * Combines: project groups + agents store for unique project paths.
 */
function discoverProjects() {
  const projectMap = new Map(); // path → { path, name, group, agentCount }

  // From groups
  const groups = loadProjectGroups();
  for (const group of groups) {
    for (const proj of (group.projects || [])) {
      if (!projectMap.has(proj.path)) {
        projectMap.set(proj.path, {
          path: proj.path,
          name: basename(proj.path),
          group: group.name,
          agentCount: 0,
        });
      }
    }
  }

  // From agents store
  const store = loadQuackStore();
  for (const agent of (store.agents || [])) {
    if (!projectMap.has(agent.projectPath)) {
      projectMap.set(agent.projectPath, {
        path: agent.projectPath,
        name: agent.projectName || basename(agent.projectPath),
        agentCount: 0,
      });
    }
  }

  // Count agents per project
  for (const agent of (store.agents || [])) {
    const proj = projectMap.get(agent.projectPath);
    if (proj) proj.agentCount++;
  }

  return Array.from(projectMap.values());
}

// =============================================================================
// SESSION MANAGER
// =============================================================================

/** @type {Map<string, object>} */
const activeSessions = new Map();

function generateSessionId() {
  const ts = Date.now();
  const rand = Math.random().toString(36).substring(2, 9);
  return `mcp-${ts}-${rand}`;
}

/**
 * Spawn a new agent session via stream-claude.js subprocess.
 * Returns sessionId immediately; events accumulate in background.
 */
function spawnAgentSession({ projectPath, agentId, prompt, model, sessionId: resumeSessionId }) {
  if (activeSessions.size >= MAX_CONCURRENT_SESSIONS) {
    throw new Error(`Max concurrent sessions (${MAX_CONCURRENT_SESSIONS}) reached. Abort an existing session first.`);
  }

  const sessionId = generateSessionId();

  // Build config matching stream-claude.js expected format
  const config = {
    prompt,
    model: model || 'sonnet',
    cwd: projectPath,
    // Omit permissionMode to let SDK auto-approve (bypass)
    ...(resumeSessionId ? { sessionId: resumeSessionId } : {}),
  };

  const configStr = JSON.stringify(config);
  console.error(`[quack-mcp] Spawning session ${sessionId}: ${configStr.substring(0, 200)}...`);

  const proc = spawn('node', [STREAM_SCRIPT, configStr], {
    cwd: dirname(STREAM_SCRIPT),
    stdio: ['pipe', 'pipe', 'pipe'],
    // QUACK_MCP_CHILD prevents recursive quack-tools registration in child sessions
    env: { ...process.env, QUACK_MCP_CHILD: '1' },
  });

  const session = {
    process: proc,
    rl: null,
    stderrRl: null,
    eventCount: 0,
    text: '',
    status: 'streaming',
    claudeSessionId: null,
    pendingQuestions: [],
    toolCalls: [],
    tokenUsage: null,
    projectPath,
    agentId,
    error: null,
    createdAt: Date.now(),
    lastActivity: Date.now(),
  };

  activeSessions.set(sessionId, session);

  // Read stdout line by line — JSON events from stream-claude.js
  const rl = createInterface({ input: proc.stdout, terminal: false });
  session.rl = rl;

  rl.on('line', (line) => {
    session.lastActivity = Date.now();
    try {
      const event = JSON.parse(line);
      // Cap event buffer to prevent OOM (events are not exposed to callers)
      if (session.eventCount < MAX_EVENTS_PER_SESSION) session.eventCount++;

      // Capture Claude SDK session ID for resume
      if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
        session.claudeSessionId = event.session_id;
      }

      // Accumulate assistant text
      if (event.type === 'assistant' && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === 'text') {
            session.text += block.text;
          }
          if (block.type === 'tool_use' && session.toolCalls.length < MAX_TOOL_CALLS_PER_SESSION) {
            session.toolCalls.push({
              name: block.name,
              id: block.id,
            });
          }
        }
        // Capture token usage from assistant events (per-step, most accurate)
        if (event.message?.usage) {
          session.tokenUsage = event.message.usage;
        }
      }

      // AskUserQuestion events from canUseTool callback
      if (event.type === 'ask_user_question') {
        session.pendingQuestions.push({
          requestId: event.requestId,
          questions: event.questions,
        });
      }

      // Result = session complete
      if (event.type === 'result') {
        session.status = 'complete';
        if (event.usage) session.tokenUsage = event.usage;
      }

      // Complete event = stream done
      if (event.type === 'complete') {
        session.status = 'complete';
      }

      // Error event
      if (event.type === 'error') {
        session.status = 'error';
        session.error = event.error || 'Unknown error';
      }
    } catch {
      // Non-JSON line from stream-claude.js (debug output) — ignore
    }
  });

  // Stderr is debug output — log it
  const stderrRl = createInterface({ input: proc.stderr, terminal: false });
  session.stderrRl = stderrRl;
  stderrRl.on('line', (line) => {
    console.error(`[session:${sessionId}] ${line}`);
  });

  proc.on('exit', (code, signal) => {
    console.error(`[quack-mcp] Session ${sessionId} exited: code=${code}, signal=${signal}`);
    // Cleanup readline interfaces
    session.rl?.close();
    session.stderrRl?.close();
    if (session.status === 'streaming') {
      if (signal === 'SIGTERM' || signal === 'SIGKILL') {
        session.status = 'aborted';
      } else if (code !== 0) {
        session.status = 'error';
        session.error = `Process exited with code ${code}`;
      } else {
        session.status = 'complete';
      }
    }
  });

  return sessionId;
}

/**
 * Read session buffer for polling.
 */
function readSessionBuffer(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return null;

  return {
    status: session.status,
    text: session.text,
    toolCalls: session.toolCalls.length > 0 ? session.toolCalls : undefined,
    tokenUsage: session.tokenUsage || undefined,
    pendingQuestions: session.pendingQuestions.length > 0 ? session.pendingQuestions : undefined,
    error: session.error || undefined,
    claudeSessionId: session.claudeSessionId || undefined,
  };
}

/**
 * Wait for session to complete or timeout.
 */
function waitForCompletion(sessionId, timeoutMs) {
  return new Promise((resolve) => {
    const session = activeSessions.get(sessionId);
    if (!session || session.status !== 'streaming') {
      resolve(readSessionBuffer(sessionId));
      return;
    }

    const timeout = Math.min(timeoutMs || DEFAULT_POLL_TIMEOUT_MS, MAX_POLL_TIMEOUT_MS);
    const startTime = Date.now();

    const interval = setInterval(() => {
      if (session.status !== 'streaming' || Date.now() - startTime > timeout) {
        clearInterval(interval);
        const buffer = readSessionBuffer(sessionId);
        resolve(buffer ?? { status: 'expired', error: 'Session was cleaned up while waiting.' });
      }
    }, 500);
  });
}

/**
 * Kill session subprocess.
 */
function killSession(sessionId) {
  const session = activeSessions.get(sessionId);
  if (!session) return false;
  try {
    session.process.kill('SIGTERM');
    session.status = 'aborted';
    return true;
  } catch {
    return false;
  }
}

/**
 * Send data to session stdin (for AskUserQuestion answers).
 */
function sendToSession(sessionId, data) {
  const session = activeSessions.get(sessionId);
  if (!session || !session.process.stdin.writable) return false;
  try {
    const serialized = JSON.stringify(data);
    if (serialized.length > MAX_STDIN_PAYLOAD_BYTES) return false;
    session.process.stdin.write(serialized + '\n');
    return true;
  } catch {
    return false;
  }
}

/**
 * Cleanup zombie sessions (10 min inactivity).
 */
function cleanupZombieSessions() {
  const now = Date.now();
  for (const [id, session] of activeSessions) {
    if (session.status === 'streaming' && now - session.lastActivity > ZOMBIE_TIMEOUT_MS) {
      console.error(`[quack-mcp] Killing zombie session ${id} (${Math.round((now - session.lastActivity) / 1000)}s inactive)`);
      killSession(id);
    }
    // Remove completed/error sessions older than 30 min
    if (session.status !== 'streaming' && now - session.lastActivity > ZOMBIE_TIMEOUT_MS * 3) {
      activeSessions.delete(id);
    }
  }
}

// Run cleanup every 2 minutes (.unref so it doesn't prevent clean process exit)
const cleanupTimer = setInterval(cleanupZombieSessions, 2 * 60 * 1000);
cleanupTimer.unref();

// Kill all sessions on exit
process.on('exit', () => {
  for (const [id] of activeSessions) {
    killSession(id);
  }
});

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
  // --- DISCOVERY ---
  {
    name: 'quack_list_projects',
    description: 'List all projects registered in Quack with their agent counts. Use this first to discover available projects before interacting with agents.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'quack_list_agents',
    description: 'List all active agents for a specific project. Returns agent names, roles, and communication styles. Use quack_list_projects first to find valid project paths.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Absolute path to the project directory' },
      },
      required: ['projectPath'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'quack_get_agent',
    description: 'Get full details of a specific agent including personality, skills, and rules. Use quack_list_agents first to find valid agent IDs.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Absolute path to the project directory' },
        agentId: { type: 'string', description: 'Agent ID from quack_list_agents' },
      },
      required: ['projectPath', 'agentId'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'quack_list_sessions',
    description: 'List active and recent agent sessions. Can filter by project path, agent ID, or status.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Filter by project path (optional)' },
        agentId: { type: 'string', description: 'Filter by agent ID (optional)' },
        status: { type: 'string', enum: ['todo', 'in_progress', 'done', 'streaming', 'complete', 'error', 'aborted'], description: 'Filter by session status. Stored sessions use todo/in_progress/done. MCP sessions use streaming/complete/error/aborted.' },
      },
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },

  // --- SESSION MANAGEMENT ---
  {
    name: 'quack_create_session',
    description: 'Create a new session with a Quack agent and send the first prompt. The agent starts processing immediately. Use quack_read_response to poll for the result.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string', description: 'Absolute path to the project directory' },
        agentId: { type: 'string', description: 'Agent ID to create session with' },
        prompt: { type: 'string', description: 'The prompt/message to send to the agent' },
        model: { type: 'string', description: 'Model to use: "haiku", "sonnet", or "opus" (default: "sonnet")' },
        title: { type: 'string', description: 'Optional session title for display' },
      },
      required: ['projectPath', 'agentId', 'prompt'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },
  {
    name: 'quack_read_response',
    description: 'Read the agent\'s response from an active session. Use waitForCompletion=true to block until the agent finishes (recommended for simple queries). For long tasks, poll periodically with waitForCompletion=false.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID from quack_create_session' },
        waitForCompletion: { type: 'boolean', description: 'Wait for the agent to finish before returning (default: false). Set to true for simple queries.' },
        timeoutMs: { type: 'number', description: 'Max wait time in ms when waitForCompletion=true (default: 120000, max: 300000)' },
      },
      required: ['sessionId'],
    },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'quack_send_message',
    description: 'Continue a conversation by sending a follow-up message to an existing session. The session must be in "complete" status. Creates a new streaming round — use quack_read_response to poll.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to continue' },
        prompt: { type: 'string', description: 'Follow-up message to send' },
      },
      required: ['sessionId', 'prompt'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
  },

  // --- SESSION CONTROL ---
  {
    name: 'quack_abort_session',
    description: 'Stop a streaming session immediately. The agent will be terminated.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID to abort' },
      },
      required: ['sessionId'],
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
  {
    name: 'quack_answer_question',
    description: 'Reply to an AskUserQuestion from the agent. Check quack_read_response pendingQuestions for the requestId and available options.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string', description: 'Session ID with the pending question' },
        requestId: { type: 'string', description: 'Request ID from the pending question' },
        answers: { type: 'object', description: 'Answers map: question index → selected answer text' },
      },
      required: ['sessionId', 'requestId', 'answers'],
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
];

// =============================================================================
// TOOL HANDLERS
// =============================================================================

async function handleListProjects() {
  const projects = discoverProjects();
  if (projects.length === 0) {
    return 'No projects found. Quack may not have any agents configured yet.';
  }
  return JSON.stringify(projects, null, 2);
}

async function handleListAgents(args) {
  const { projectPath } = args;
  try { validateProjectPath(projectPath); } catch (e) { return `Error: ${e.message}`; }
  if (!existsSync(projectPath)) {
    return `Error: Project path does not exist: ${projectPath}`;
  }

  const activeIds = loadActiveAgents(projectPath);
  if (activeIds.length === 0) {
    return `No active agents found for project: ${projectPath}`;
  }

  // Also get agent info from store for extra metadata (color, name)
  const store = loadQuackStore();
  const storeAgents = new Map();
  for (const agent of (store.agents || [])) {
    storeAgents.set(agent.id, agent);
  }

  const agents = [];
  for (const id of activeIds) {
    const personality = loadAgentPersonality(projectPath, id);
    const storeAgent = storeAgents.get(id);

    agents.push({
      id,
      name: personality?.name || storeAgent?.name || id,
      role: personality?.role || 'Agent',
      communicationStyle: personality?.communicationStyle || 'professional',
      color: storeAgent?.color || '#666',
    });
  }

  return JSON.stringify(agents, null, 2);
}

async function handleGetAgent(args) {
  const { projectPath, agentId } = args;
  try { validateProjectPath(projectPath); sanitizeId(agentId); } catch (e) { return `Error: ${e.message}`; }
  if (!existsSync(projectPath)) {
    return `Error: Project path does not exist: ${projectPath}`;
  }

  const personality = loadAgentPersonality(projectPath, agentId);
  if (!personality) {
    return `Error: Agent personality not found for ID: ${agentId}. Use quack_list_agents to see available agents.`;
  }

  // Get store data for extra metadata
  const store = loadQuackStore();
  const storeAgent = (store.agents || []).find(a => a.id === agentId);

  return JSON.stringify({
    id: personality.id,
    name: personality.name,
    role: personality.role,
    communicationStyle: personality.communicationStyle,
    technicalContext: personality.technicalContext || undefined,
    customNotes: personality.customNotes || undefined,
    rules: personality.rules || personality.selectedRules || [],
    skills: personality.selectedSkills || personality.skills || [],
    toolkit: personality.toolkit || undefined,
    color: storeAgent?.color || '#666',
    lastActiveAt: storeAgent?.lastActiveAt || undefined,
  }, null, 2);
}

async function handleListSessions(args) {
  const store = loadQuackStore();
  let sessions = store.sessions || [];

  // Apply filters
  if (args.projectPath) {
    sessions = sessions.filter(s => s.projectPath === args.projectPath);
  }
  if (args.agentId) {
    sessions = sessions.filter(s => s.agentId === args.agentId);
  }
  if (args.status) {
    sessions = sessions.filter(s => s.status === args.status);
  }

  // Sort by most recent first, limit to 20
  sessions = sessions
    .sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))
    .slice(0, 20);

  // Also include currently active MCP sessions
  const mcpSessions = [];
  for (const [id, session] of activeSessions) {
    if ((!args.projectPath || session.projectPath === args.projectPath) &&
        (!args.agentId || session.agentId === args.agentId)) {
      mcpSessions.push({
        id,
        title: `MCP Session (${session.status})`,
        agentId: session.agentId,
        status: session.status,
        createdAt: session.createdAt,
        source: 'mcp',
      });
    }
  }

  return JSON.stringify({
    storedSessions: sessions.map(s => ({
      id: s.id,
      claudeSessionId: s.claudeSessionId,
      title: s.title,
      agentId: s.agentId,
      projectPath: s.projectPath,
      status: s.status,
      createdAt: s.createdAt,
      messageCount: s.messageCount,
    })),
    activeMcpSessions: mcpSessions,
  }, null, 2);
}

async function handleCreateSession(args) {
  const { projectPath, agentId, prompt, model, title } = args;

  // Validate inputs: whitelist projectPath and sanitize agentId
  try { validateProjectPath(projectPath); sanitizeId(agentId); } catch (e) { return `Error: ${e.message}`; }
  if (!existsSync(projectPath)) {
    return `Error: Project path does not exist: ${projectPath}`;
  }

  // Validate agent exists
  const activeIds = loadActiveAgents(projectPath);
  if (!activeIds.includes(agentId)) {
    return `Error: Agent "${agentId}" is not active in project ${projectPath}. Use quack_list_agents to see available agents.`;
  }

  try {
    const sessionId = spawnAgentSession({
      projectPath,
      agentId,
      prompt,
      model: model || 'sonnet',
    });

    return JSON.stringify({
      sessionId,
      status: 'streaming',
      message: `Session created. Use quack_read_response with sessionId="${sessionId}" to poll for the agent's response.`,
    }, null, 2);
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

async function handleReadResponse(args) {
  const { sessionId, waitForCompletion: shouldWait, timeoutMs } = args;

  if (!activeSessions.has(sessionId)) {
    return `Error: Session "${sessionId}" not found. It may have expired or been aborted.`;
  }

  if (shouldWait) {
    const result = await waitForCompletion(sessionId, timeoutMs);
    return JSON.stringify(result, null, 2);
  }

  const buffer = readSessionBuffer(sessionId);
  return JSON.stringify(buffer, null, 2);
}

async function handleSendMessage(args) {
  const { sessionId, prompt } = args;

  const session = activeSessions.get(sessionId);
  if (!session) {
    return `Error: Session "${sessionId}" not found.`;
  }

  if (session.status === 'streaming') {
    return `Error: Session is still streaming. Wait for completion or abort first.`;
  }

  if (!session.claudeSessionId) {
    return `Error: No Claude SDK session ID available for resume. The original session may not have initialized properly.`;
  }

  // Spawn a new subprocess with resume
  try {
    // Save resume data, then delete old session to free the slot
    const { projectPath, agentId, claudeSessionId } = session;

    // Remove old session BEFORE spawning (fixes max-session race condition)
    activeSessions.delete(sessionId);

    const newSessionId = spawnAgentSession({
      projectPath,
      agentId,
      prompt,
      sessionId: claudeSessionId,
    });

    // Transfer the Claude session ID to the new session
    const newSession = activeSessions.get(newSessionId);
    if (newSession) {
      newSession.claudeSessionId = claudeSessionId;
    }

    return JSON.stringify({
      sessionId: newSessionId,
      status: 'streaming',
      message: `Conversation resumed. Use quack_read_response with sessionId="${newSessionId}" to poll.`,
    }, null, 2);
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

async function handleAbortSession(args) {
  const { sessionId } = args;

  if (!activeSessions.has(sessionId)) {
    return `Error: Session "${sessionId}" not found.`;
  }

  const killed = killSession(sessionId);
  return JSON.stringify({
    aborted: killed,
    message: killed ? 'Session aborted.' : 'Failed to abort session.',
  }, null, 2);
}

async function handleAnswerQuestion(args) {
  const { sessionId, requestId, answers } = args;

  const session = activeSessions.get(sessionId);
  if (!session) {
    return `Error: Session "${sessionId}" not found.`;
  }

  // Find and remove the pending question
  const questionIdx = session.pendingQuestions.findIndex(q => q.requestId === requestId);
  if (questionIdx === -1) {
    return `Error: No pending question with requestId "${requestId}" found.`;
  }

  session.pendingQuestions.splice(questionIdx, 1);

  // Send answer to subprocess stdin
  const sent = sendToSession(sessionId, { requestId, answers });
  if (!sent) {
    return `Error: Failed to send answer to session. The process may have terminated.`;
  }

  return JSON.stringify({
    answered: true,
    message: 'Answer sent to agent. Continue polling with quack_read_response.',
  }, null, 2);
}

// =============================================================================
// SERVER SETUP
// =============================================================================

const server = new Server(
  { name: 'quack-tools', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;
    switch (name) {
      case 'quack_list_projects':
        result = await handleListProjects();
        break;
      case 'quack_list_agents':
        result = await handleListAgents(args);
        break;
      case 'quack_get_agent':
        result = await handleGetAgent(args);
        break;
      case 'quack_list_sessions':
        result = await handleListSessions(args);
        break;
      case 'quack_create_session':
        result = await handleCreateSession(args);
        break;
      case 'quack_read_response':
        result = await handleReadResponse(args);
        break;
      case 'quack_send_message':
        result = await handleSendMessage(args);
        break;
      case 'quack_abort_session':
        result = await handleAbortSession(args);
        break;
      case 'quack_answer_question':
        result = await handleAnswerQuestion(args);
        break;
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return { content: [{ type: 'text', text: result }] };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[quack-mcp] Quack MCP Server started — agent interaction tools ready');
}

main().catch(console.error);
