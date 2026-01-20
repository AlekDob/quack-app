/**
 * Kanban Tools V2 - Comprehensive Test Suite
 *
 * Tests the Multi-Project Agent Architecture with:
 * 1. Multi-Project Agents - One agent can work on multiple projects
 * 2. Auto-Create Agents - Sessions auto-create agents if they don't exist
 * 3. Session = Sacred & Isolated - Sessions are independent work units
 *
 * Test Coverage:
 * - Happy Paths: Normal usage scenarios
 * - Edge Cases: Duplicates, orphaned sessions, validation, empty filters
 * - Integration Tests: Full workflows with multiple operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, rmdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

// Test storage paths (unique per test run)
const TEST_DIR = join(tmpdir(), 'quack-test-kanban-v2-' + Date.now());
const TEST_AGENTS_PATH = join(TEST_DIR, 'quack-agents.json');
const TEST_SESSIONS_PATH = join(TEST_DIR, 'quack-agent-sessions.json');

/**
 * Note: These tests simulate the Node SDK kanban-tools-v2.js behavior.
 * The actual MCP tools are in src-tauri/node-sdk/kanban-tools-v2.js
 *
 * We replicate the storage logic here to test the tool behavior in isolation.
 */

// ============================================================
// TYPE DEFINITIONS
// ============================================================

interface Agent {
  id: string;
  name: string;
  color: string;
  avatar: string;
  personality?: {
    role?: string;
    communicationStyle?: string;
    notes?: string;
  };
  createdAt: number;
  lastActiveAt: number;
  defaultProjectPath?: string;
}

interface Session {
  id: string;
  title: string;
  agentId: string;
  projectPath: string;
  projectName: string;
  status: 'todo' | 'in_progress' | 'done';
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  initialPrompt?: string;
  completedAt?: number;
}

// ============================================================
// TEST STORAGE UTILITIES (mirrors kanban-tools-v2.js)
// ============================================================

function loadAgents(): Agent[] {
  try {
    if (!existsSync(TEST_AGENTS_PATH)) {
      return [];
    }
    const data = JSON.parse(readFileSync(TEST_AGENTS_PATH, 'utf8'));
    return data.agents || [];
  } catch (error) {
    return [];
  }
}

function saveAgents(agents: Agent[]): boolean {
  try {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    const data = { agents, version: 2 };
    writeFileSync(TEST_AGENTS_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

function loadSessions(): Session[] {
  try {
    if (!existsSync(TEST_SESSIONS_PATH)) {
      return [];
    }
    const data = JSON.parse(readFileSync(TEST_SESSIONS_PATH, 'utf8'));
    return data.agentSessions || [];
  } catch (error) {
    return [];
  }
}

function saveSessions(sessions: Session[]): boolean {
  try {
    if (!existsSync(TEST_DIR)) {
      mkdirSync(TEST_DIR, { recursive: true });
    }
    const data = { agentSessions: sessions };
    writeFileSync(TEST_SESSIONS_PATH, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (error) {
    return false;
  }
}

function generateAgentId(): string {
  return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function generateColor(): string {
  const colors = ['#FF6B35', '#004E89', '#F7931E', '#00D9FF', '#A239EA', '#00C49A'];
  return colors[Math.floor(Math.random() * colors.length)];
}

function findAgent(idOrName: string): Agent | null {
  if (!idOrName) return null;

  const agents = loadAgents();
  const query = idOrName.toLowerCase();

  // Try exact ID match first
  const exactMatch = agents.find(a => a.id === idOrName);
  if (exactMatch) return exactMatch;

  // Try exact name match
  const exactNameMatch = agents.find(a => a.name.toLowerCase() === query);
  if (exactNameMatch) return exactNameMatch;

  // Try partial match
  const partialMatch = agents.find(a =>
    a.name.toLowerCase().includes(query) || query.includes(a.name.toLowerCase())
  );
  if (partialMatch) return partialMatch;

  return null;
}

function getProjectsForAgent(agentId: string): string[] {
  const sessions = loadSessions();
  const projectPaths = sessions
    .filter(s => s.agentId === agentId)
    .map(s => s.projectPath);

  return [...new Set(projectPaths)];
}

function getAgentsForProject(projectPath: string): Agent[] {
  const sessions = loadSessions();
  const agentIds = sessions
    .filter(s => s.projectPath === projectPath)
    .map(s => s.agentId);

  const uniqueAgentIds = [...new Set(agentIds)];
  const agents = loadAgents();

  return agents.filter(a => uniqueAgentIds.includes(a.id));
}

// ============================================================
// TEST HELPERS - Simulate MCP Tool Invocations
// ============================================================

async function createAgent({ name, avatar, personality }) {
  const agents = loadAgents();

  // Check for duplicate name
  const existing = agents.find(a => a.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return {
      success: false,
      error: `Agent with name "${name}" already exists`,
      agentId: existing.id,
    };
  }

  const newAgent = {
    id: generateAgentId(),
    name,
    color: generateColor(),
    avatar: avatar || 'duck1.jpeg',
    personality,
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
  };

  agents.push(newAgent);
  const saved = saveAgents(agents);

  if (!saved) {
    return { success: false, error: 'Failed to save agent' };
  }

  return { success: true, agent: newAgent };
}

async function createSession({ projectPath, projectName, agentName, title, description, status = 'todo' }) {
  // Find or create agent
  let agent = findAgent(agentName);

  if (!agent) {
    // Auto-create agent
    const agents = loadAgents();
    agent = {
      id: generateAgentId(),
      name: agentName,
      color: generateColor(),
      avatar: 'duck1.jpeg',
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
      defaultProjectPath: projectPath,
    };
    agents.push(agent);
    saveAgents(agents);
  }

  const sessions = loadSessions();

  const newSession = {
    id: generateSessionId(),
    title,
    agentId: agent.id,
    projectPath,
    projectName,
    status,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
    initialPrompt: description,
  };

  sessions.push(newSession);
  const saved = saveSessions(sessions);

  if (!saved) {
    return { success: false, error: 'Failed to save session' };
  }

  // Update agent lastActiveAt
  const agents = loadAgents();
  const agentIndex = agents.findIndex(a => a.id === agent.id);
  if (agentIndex !== -1) {
    agents[agentIndex].lastActiveAt = Date.now();
    saveAgents(agents);
  }

  return { success: true, session: newSession, agent };
}

async function listAgents({ projectPath } = {}) {
  let agents = loadAgents();

  if (projectPath) {
    const agentsInProject = getAgentsForProject(projectPath);
    const agentIds = agentsInProject.map(a => a.id);
    agents = agents.filter(a => agentIds.includes(a.id));
  }

  const agentsWithProjects = agents.map(agent => {
    const projects = getProjectsForAgent(agent.id);
    return {
      id: agent.id,
      name: agent.name,
      color: agent.color,
      avatar: agent.avatar,
      projectCount: projects.length,
      projects: projects.map(p => p.split('/').pop()),
      lastActiveAt: agent.lastActiveAt,
    };
  });

  return {
    total: agentsWithProjects.length,
    agents: agentsWithProjects,
  };
}

async function listSessions({ agentId, projectPath, status, includeCompleted = true } = {}) {
  let sessions = loadSessions();

  sessions = sessions.filter(session => {
    if (agentId && session.agentId !== agentId) return false;
    if (projectPath && session.projectPath !== projectPath) return false;
    if (status && session.status !== status) return false;
    if (!includeCompleted && session.status === 'done') return false;
    return true;
  });

  sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return {
    total: sessions.length,
    byStatus: {
      todo: sessions.filter(s => s.status === 'todo').length,
      in_progress: sessions.filter(s => s.status === 'in_progress').length,
      done: sessions.filter(s => s.status === 'done').length,
    },
    sessions,
  };
}

async function moveSession({ sessionId, newStatus, completionNote }) {
  const sessions = loadSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex === -1) {
    return { success: false, error: `Session with ID "${sessionId}" not found` };
  }

  const session = sessions[sessionIndex];
  const previousStatus = session.status;

  session.status = newStatus;
  session.updatedAt = Date.now();

  if (newStatus === 'done') {
    session.completedAt = Date.now();
  }

  sessions[sessionIndex] = session;
  const saved = saveSessions(sessions);

  if (!saved) {
    return { success: false, error: 'Failed to save session update' };
  }

  return {
    success: true,
    session,
    previousStatus,
    newStatus,
    completionNote,
  };
}

async function updateSession({ sessionId, title, notes }) {
  const sessions = loadSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex === -1) {
    return { success: false, error: `Session with ID "${sessionId}" not found` };
  }

  const session = sessions[sessionIndex];
  const updates = [];

  if (title !== undefined) {
    session.title = title;
    updates.push('title');
  }

  if (notes !== undefined) {
    session.initialPrompt = notes;
    updates.push('notes');
  }

  session.updatedAt = Date.now();
  sessions[sessionIndex] = session;
  const saved = saveSessions(sessions);

  if (!saved) {
    return { success: false, error: 'Failed to save session update' };
  }

  return { success: true, session, updates };
}

async function deleteAgent({ agentId, deleteMode = 'archive' }) {
  const agents = loadAgents();
  const agentIndex = agents.findIndex(a => a.id === agentId);

  if (agentIndex === -1) {
    return { success: false, error: `Agent with ID "${agentId}" not found` };
  }

  const agent = agents[agentIndex];
  const sessions = loadSessions();
  const agentSessions = sessions.filter(s => s.agentId === agentId);

  let updatedSessions = [];
  if (deleteMode === 'archive') {
    updatedSessions = sessions.map(s => {
      if (s.agentId === agentId) {
        return {
          ...s,
          status: 'done',
          title: `[Archived] ${s.title}`,
          completedAt: Date.now(),
          updatedAt: Date.now(),
        };
      }
      return s;
    });
  } else {
    updatedSessions = sessions.filter(s => s.agentId !== agentId);
  }

  agents.splice(agentIndex, 1);

  const agentsSaved = saveAgents(agents);
  const sessionsSaved = saveSessions(updatedSessions);

  if (!agentsSaved || !sessionsSaved) {
    return { success: false, error: 'Failed to save after deletion' };
  }

  return {
    success: true,
    agent,
    sessionsAffected: agentSessions.length,
    deleteMode,
  };
}

async function deleteSession({ sessionId, reason }) {
  const sessions = loadSessions();
  const sessionIndex = sessions.findIndex(s => s.id === sessionId);

  if (sessionIndex === -1) {
    return { success: false, error: `Session with ID "${sessionId}" not found` };
  }

  const deletedSession = sessions[sessionIndex];
  sessions.splice(sessionIndex, 1);

  const saved = saveSessions(sessions);

  if (!saved) {
    return { success: false, error: 'Failed to save after deletion' };
  }

  return {
    success: true,
    deletedSession,
    reason,
  };
}

// ============================================================
// TEST SETUP & TEARDOWN
// ============================================================

beforeEach(() => {
  // Create test directory
  if (!existsSync(TEST_DIR)) {
    mkdirSync(TEST_DIR, { recursive: true });
  }

  // Initialize empty storage
  saveAgents([]);
  saveSessions([]);
});

afterEach(() => {
  // Clean up test files
  try {
    if (existsSync(TEST_AGENTS_PATH)) unlinkSync(TEST_AGENTS_PATH);
    if (existsSync(TEST_SESSIONS_PATH)) unlinkSync(TEST_SESSIONS_PATH);
    if (existsSync(TEST_DIR)) rmdirSync(TEST_DIR);
  } catch (error) {
    // Ignore cleanup errors
  }
});

// ============================================================
// TEST SUITE: kanban_create_agent
// ============================================================

describe('kanban_create_agent', () => {
  it('should create agent successfully with minimal args', async () => {
    const result = await createAgent({ name: 'Sophie' });

    expect(result.success).toBe(true);
    expect(result.agent).toBeDefined();
    expect(result.agent.id).toMatch(/^agent-\d+-[a-z0-9]+$/);
    expect(result.agent.name).toBe('Sophie');
    expect(result.agent.color).toMatch(/^#[A-F0-9]{6}$/);
    expect(result.agent.avatar).toBe('duck1.jpeg');
    expect(result.agent.createdAt).toBeGreaterThan(0);
    expect(result.agent.lastActiveAt).toBe(result.agent.createdAt);
  });

  it('should create agent with custom avatar and personality', async () => {
    const result = await createAgent({
      name: 'Magnus',
      avatar: 'duck5.jpeg',
      personality: {
        role: 'Rust Engineer',
        communicationStyle: 'technical',
        notes: 'Specializes in Tauri development',
      },
    });

    expect(result.success).toBe(true);
    expect(result.agent.avatar).toBe('duck5.jpeg');
    expect(result.agent.personality).toEqual({
      role: 'Rust Engineer',
      communicationStyle: 'technical',
      notes: 'Specializes in Tauri development',
    });
  });

  it('should reject duplicate agent names (case-insensitive)', async () => {
    await createAgent({ name: 'Sophie' });

    const result = await createAgent({ name: 'sophie' }); // lowercase

    expect(result.success).toBe(false);
    expect(result.error).toContain('already exists');
  });
});

// ============================================================
// TEST SUITE: kanban_create_session
// ============================================================

describe('kanban_create_session', () => {
  it('should create session with existing agent', async () => {
    // First create agent
    const agentResult = await createAgent({ name: 'Sophie' });

    // Then create session
    const result = await createSession({
      projectPath: '/Users/test/quack-app',
      projectName: 'quack-app',
      agentName: 'Sophie',
      title: 'Fix bug in terminal',
      description: 'Terminal crashes on large outputs',
      status: 'todo',
    });

    expect(result.success).toBe(true);
    expect(result.session).toBeDefined();
    expect(result.session.id).toMatch(/^session-\d+-[a-z0-9]+$/);
    expect(result.session.title).toBe('Fix bug in terminal');
    expect(result.session.agentId).toBe(agentResult.agent.id);
    expect(result.session.projectPath).toBe('/Users/test/quack-app');
    expect(result.session.projectName).toBe('quack-app');
    expect(result.session.status).toBe('todo');
    expect(result.session.messageCount).toBe(0);
    expect(result.session.initialPrompt).toBe('Terminal crashes on large outputs');
  });

  it('should auto-create agent if not found', async () => {
    const result = await createSession({
      projectPath: '/Users/test/quack-app',
      projectName: 'quack-app',
      agentName: 'NewAgent', // Doesn't exist yet
      title: 'Implement feature',
      status: 'in_progress',
    });

    expect(result.success).toBe(true);
    expect(result.agent).toBeDefined();
    expect(result.agent.name).toBe('NewAgent');
    expect(result.agent.defaultProjectPath).toBe('/Users/test/quack-app');
    expect(result.session.agentId).toBe(result.agent.id);
  });

  it('should default status to "todo" if not provided', async () => {
    const result = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'New task',
    });

    expect(result.success).toBe(true);
    expect(result.session.status).toBe('todo');
  });

  it('should update agent lastActiveAt when creating session', async () => {
    const agentResult = await createAgent({ name: 'Sophie' });
    const originalLastActive = agentResult.agent.lastActiveAt;

    // Wait a bit to ensure timestamp changes
    await new Promise(resolve => setTimeout(resolve, 10));

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task',
    });

    const agents = loadAgents();
    const updatedAgent = agents.find(a => a.id === agentResult.agent.id);

    expect(updatedAgent.lastActiveAt).toBeGreaterThan(originalLastActive);
  });
});

// ============================================================
// TEST SUITE: kanban_list_agents
// ============================================================

describe('kanban_list_agents', () => {
  it('should list all agents when no filter is provided', async () => {
    await createAgent({ name: 'Sophie' });
    await createAgent({ name: 'Magnus' });
    await createAgent({ name: 'Kaori' });

    const result = await listAgents();

    expect(result.total).toBe(3);
    expect(result.agents).toHaveLength(3);
    expect(result.agents.map(a => a.name)).toEqual(
      expect.arrayContaining(['Sophie', 'Magnus', 'Kaori'])
    );
  });

  it('should show project count for each agent', async () => {
    const agentResult = await createAgent({ name: 'Sophie' });

    // Create sessions in 3 different projects
    await createSession({
      projectPath: '/Users/test/project1',
      projectName: 'project1',
      agentName: 'Sophie',
      title: 'Task 1',
    });

    await createSession({
      projectPath: '/Users/test/project2',
      projectName: 'project2',
      agentName: 'Sophie',
      title: 'Task 2',
    });

    await createSession({
      projectPath: '/Users/test/project3',
      projectName: 'project3',
      agentName: 'Sophie',
      title: 'Task 3',
    });

    const result = await listAgents();

    const sophie = result.agents.find(a => a.name === 'Sophie');
    expect(sophie.projectCount).toBe(3);
    expect(sophie.projects).toEqual(['project1', 'project2', 'project3']);
  });

  it('should filter agents by project', async () => {
    await createAgent({ name: 'Sophie' });
    await createAgent({ name: 'Magnus' });

    // Sophie works on project1
    await createSession({
      projectPath: '/Users/test/project1',
      projectName: 'project1',
      agentName: 'Sophie',
      title: 'Task 1',
    });

    // Magnus works on project2
    await createSession({
      projectPath: '/Users/test/project2',
      projectName: 'project2',
      agentName: 'Magnus',
      title: 'Task 2',
    });

    const result = await listAgents({ projectPath: '/Users/test/project1' });

    expect(result.total).toBe(1);
    expect(result.agents[0].name).toBe('Sophie');
  });

  it('should return empty list when no agents exist', async () => {
    const result = await listAgents();

    expect(result.total).toBe(0);
    expect(result.agents).toEqual([]);
  });

  it('should handle agents with no projects (no sessions)', async () => {
    await createAgent({ name: 'Idle Agent' });

    const result = await listAgents();

    expect(result.total).toBe(1);
    expect(result.agents[0].projectCount).toBe(0);
    expect(result.agents[0].projects).toEqual([]);
  });
});

// ============================================================
// TEST SUITE: kanban_list_sessions
// ============================================================

describe('kanban_list_sessions', () => {
  it('should list all sessions when no filter is provided', async () => {
    await createSession({
      projectPath: '/Users/test/project1',
      projectName: 'project1',
      agentName: 'Sophie',
      title: 'Task 1',
    });

    await createSession({
      projectPath: '/Users/test/project2',
      projectName: 'project2',
      agentName: 'Magnus',
      title: 'Task 2',
    });

    const result = await listSessions();

    expect(result.total).toBe(2);
    expect(result.sessions).toHaveLength(2);
  });

  it('should filter sessions by agent ID', async () => {
    const agent1 = await createAgent({ name: 'Sophie' });
    await createAgent({ name: 'Magnus' });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Sophie Task 1',
    });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Sophie Task 2',
    });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Magnus',
      title: 'Magnus Task',
    });

    const result = await listSessions({ agentId: agent1.agent.id });

    expect(result.total).toBe(2);
    expect(result.sessions.every(s => s.agentId === agent1.agent.id)).toBe(true);
  });

  it('should filter sessions by project path', async () => {
    await createSession({
      projectPath: '/Users/test/project1',
      projectName: 'project1',
      agentName: 'Sophie',
      title: 'Task 1',
    });

    await createSession({
      projectPath: '/Users/test/project2',
      projectName: 'project2',
      agentName: 'Sophie',
      title: 'Task 2',
    });

    const result = await listSessions({ projectPath: '/Users/test/project1' });

    expect(result.total).toBe(1);
    expect(result.sessions[0].projectPath).toBe('/Users/test/project1');
  });

  it('should filter sessions by status', async () => {
    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 1',
      status: 'todo',
    });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 2',
      status: 'in_progress',
    });

    const result = await listSessions({ status: 'in_progress' });

    expect(result.total).toBe(1);
    expect(result.sessions[0].status).toBe('in_progress');
  });

  it('should exclude completed sessions when includeCompleted=false', async () => {
    const session1 = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 1',
      status: 'todo',
    });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 2',
      status: 'in_progress',
    });

    // Move one to done
    await moveSession({ sessionId: session1.session.id, newStatus: 'done' });

    const result = await listSessions({ includeCompleted: false });

    expect(result.total).toBe(1);
    expect(result.sessions[0].status).toBe('in_progress');
  });

  it('should provide status breakdown', async () => {
    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 1',
      status: 'todo',
    });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 2',
      status: 'in_progress',
    });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 3',
      status: 'done',
    });

    const result = await listSessions();

    expect(result.byStatus.todo).toBe(1);
    expect(result.byStatus.in_progress).toBe(1);
    expect(result.byStatus.done).toBe(1);
  });

  it('should sort sessions by createdAt descending (newest first)', async () => {
    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 1',
    });

    await new Promise(resolve => setTimeout(resolve, 10));

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 2',
    });

    const result = await listSessions();

    expect(result.sessions[0].title).toBe('Task 2'); // Newest first
    expect(result.sessions[1].title).toBe('Task 1');
  });
});

// ============================================================
// TEST SUITE: kanban_move_session
// ============================================================

describe('kanban_move_session', () => {
  it('should move session from todo to in_progress', async () => {
    const sessionResult = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task',
      status: 'todo',
    });

    // Small delay to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 5));

    const result = await moveSession({
      sessionId: sessionResult.session.id,
      newStatus: 'in_progress',
    });

    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('todo');
    expect(result.newStatus).toBe('in_progress');
    expect(result.session.status).toBe('in_progress');
    expect(result.session.updatedAt).toBeGreaterThanOrEqual(sessionResult.session.createdAt);
  });

  it('should set completedAt when moving to done', async () => {
    const sessionResult = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task',
      status: 'in_progress',
    });

    const result = await moveSession({
      sessionId: sessionResult.session.id,
      newStatus: 'done',
      completionNote: 'Successfully completed the task',
    });

    expect(result.success).toBe(true);
    expect(result.newStatus).toBe('done');
    expect(result.session.completedAt).toBeDefined();
    expect(result.session.completedAt).toBeGreaterThan(0);
    expect(result.completionNote).toBe('Successfully completed the task');
  });

  it('should reject invalid session ID', async () => {
    const result = await moveSession({
      sessionId: 'invalid-session-id',
      newStatus: 'done',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should allow moving session back from done to in_progress', async () => {
    const sessionResult = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task',
      status: 'done',
    });

    const result = await moveSession({
      sessionId: sessionResult.session.id,
      newStatus: 'in_progress',
    });

    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('done');
    expect(result.newStatus).toBe('in_progress');
  });
});

// ============================================================
// TEST SUITE: kanban_update_session
// ============================================================

describe('kanban_update_session', () => {
  it('should update session title', async () => {
    const sessionResult = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Old Title',
    });

    const result = await updateSession({
      sessionId: sessionResult.session.id,
      title: 'New Title',
    });

    expect(result.success).toBe(true);
    expect(result.session.title).toBe('New Title');
    expect(result.updates).toContain('title');
  });

  it('should update session notes', async () => {
    const sessionResult = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task',
      description: 'Old notes',
    });

    const result = await updateSession({
      sessionId: sessionResult.session.id,
      notes: 'Updated notes with more details',
    });

    expect(result.success).toBe(true);
    expect(result.session.initialPrompt).toBe('Updated notes with more details');
    expect(result.updates).toContain('notes');
  });

  it('should update both title and notes', async () => {
    const sessionResult = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task',
    });

    const result = await updateSession({
      sessionId: sessionResult.session.id,
      title: 'Updated Task',
      notes: 'Updated description',
    });

    expect(result.success).toBe(true);
    expect(result.session.title).toBe('Updated Task');
    expect(result.session.initialPrompt).toBe('Updated description');
    expect(result.updates).toEqual(expect.arrayContaining(['title', 'notes']));
  });

  it('should update updatedAt timestamp', async () => {
    const sessionResult = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task',
    });

    const originalUpdatedAt = sessionResult.session.updatedAt;

    await new Promise(resolve => setTimeout(resolve, 10));

    const result = await updateSession({
      sessionId: sessionResult.session.id,
      title: 'Updated',
    });

    expect(result.session.updatedAt).toBeGreaterThan(originalUpdatedAt);
  });

  it('should reject invalid session ID', async () => {
    const result = await updateSession({
      sessionId: 'invalid-id',
      title: 'New Title',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ============================================================
// TEST SUITE: kanban_delete_agent
// ============================================================

describe('kanban_delete_agent', () => {
  it('should delete agent and archive sessions (default mode)', async () => {
    const agentResult = await createAgent({ name: 'Sophie' });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 1',
      status: 'todo',
    });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 2',
      status: 'in_progress',
    });

    const result = await deleteAgent({
      agentId: agentResult.agent.id,
      deleteMode: 'archive',
    });

    expect(result.success).toBe(true);
    expect(result.sessionsAffected).toBe(2);
    expect(result.deleteMode).toBe('archive');

    // Verify agent is deleted
    const agents = loadAgents();
    expect(agents.find(a => a.id === agentResult.agent.id)).toBeUndefined();

    // Verify sessions are archived
    const sessions = loadSessions();
    const archivedSessions = sessions.filter(s => s.title.startsWith('[Archived]'));
    expect(archivedSessions).toHaveLength(2);
    expect(archivedSessions.every(s => s.status === 'done')).toBe(true);
  });

  it('should delete agent and delete sessions when deleteMode=delete', async () => {
    const agentResult = await createAgent({ name: 'Sophie' });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 1',
    });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 2',
    });

    const result = await deleteAgent({
      agentId: agentResult.agent.id,
      deleteMode: 'delete',
    });

    expect(result.success).toBe(true);
    expect(result.deleteMode).toBe('delete');

    // Verify sessions are deleted (not archived)
    const sessions = loadSessions();
    expect(sessions).toHaveLength(0);
  });

  it('should not affect other agents sessions', async () => {
    const agent1 = await createAgent({ name: 'Sophie' });
    await createAgent({ name: 'Magnus' });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Sophie Task',
    });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Magnus',
      title: 'Magnus Task',
    });

    await deleteAgent({
      agentId: agent1.agent.id,
      deleteMode: 'delete',
    });

    // Magnus's session should still exist
    const sessions = loadSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('Magnus Task');
  });

  it('should reject invalid agent ID', async () => {
    const result = await deleteAgent({
      agentId: 'invalid-id',
      deleteMode: 'archive',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ============================================================
// TEST SUITE: kanban_delete_session
// ============================================================

describe('kanban_delete_session', () => {
  it('should delete session successfully', async () => {
    const sessionResult = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task to delete',
    });

    const result = await deleteSession({
      sessionId: sessionResult.session.id,
      reason: 'Duplicate task',
    });

    expect(result.success).toBe(true);
    expect(result.deletedSession.title).toBe('Task to delete');
    expect(result.reason).toBe('Duplicate task');

    // Verify session is deleted
    const sessions = loadSessions();
    expect(sessions.find(s => s.id === sessionResult.session.id)).toBeUndefined();
  });

  it('should not affect other sessions', async () => {
    const session1 = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 1',
    });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 2',
    });

    await deleteSession({ sessionId: session1.session.id });

    const sessions = loadSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('Task 2');
  });

  it('should reject invalid session ID', async () => {
    const result = await deleteSession({ sessionId: 'invalid-id' });

    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });
});

// ============================================================
// INTEGRATION TESTS - Full Workflows
// ============================================================

describe('Integration Tests - Full Workflows', () => {
  it('should handle complete agent lifecycle: create → sessions → move → delete', async () => {
    // 1. Create agent
    const agentResult = await createAgent({ name: 'Sophie' });
    expect(agentResult.success).toBe(true);

    // 2. Create multiple sessions
    const session1 = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 1',
      status: 'todo',
    });

    const session2 = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task 2',
      status: 'todo',
    });

    expect(session1.success).toBe(true);
    expect(session2.success).toBe(true);

    // 3. Move sessions through workflow
    await moveSession({
      sessionId: session1.session.id,
      newStatus: 'in_progress',
    });

    await moveSession({
      sessionId: session1.session.id,
      newStatus: 'done',
    });

    // 4. List sessions to verify
    const listResult = await listSessions({ agentId: agentResult.agent.id });
    expect(listResult.byStatus.todo).toBe(1);
    expect(listResult.byStatus.done).toBe(1);

    // 5. Delete agent (archive mode)
    const deleteResult = await deleteAgent({
      agentId: agentResult.agent.id,
      deleteMode: 'archive',
    });

    expect(deleteResult.success).toBe(true);
    expect(deleteResult.sessionsAffected).toBe(2);

    // 6. Verify all sessions archived
    const finalSessions = loadSessions();
    expect(finalSessions.every(s => s.status === 'done')).toBe(true);
  });

  it('should handle multi-project agent workflow', async () => {
    // 1. Create agent (no project binding)
    const agentResult = await createAgent({ name: 'Sophie' });

    // 2. Create sessions in 3 different projects
    await createSession({
      projectPath: '/Users/test/quack-app',
      projectName: 'quack-app',
      agentName: 'Sophie',
      title: 'Fix terminal bug',
    });

    await createSession({
      projectPath: '/Users/test/flow-erp',
      projectName: 'flow-erp',
      agentName: 'Sophie',
      title: 'Add inventory feature',
    });

    await createSession({
      projectPath: '/Users/test/personal-site',
      projectName: 'personal-site',
      agentName: 'Sophie',
      title: 'Update portfolio',
    });

    // 3. Verify agent appears in all 3 projects
    const projects = getProjectsForAgent(agentResult.agent.id);
    expect(projects).toHaveLength(3);

    // 4. List agents for each project
    const quackAgents = await listAgents({ projectPath: '/Users/test/quack-app' });
    const flowAgents = await listAgents({ projectPath: '/Users/test/flow-erp' });
    const siteAgents = await listAgents({ projectPath: '/Users/test/personal-site' });

    expect(quackAgents.agents[0].name).toBe('Sophie');
    expect(flowAgents.agents[0].name).toBe('Sophie');
    expect(siteAgents.agents[0].name).toBe('Sophie');

    // 5. Filter sessions by project
    const quackSessions = await listSessions({ projectPath: '/Users/test/quack-app' });
    expect(quackSessions.total).toBe(1);
    expect(quackSessions.sessions[0].title).toBe('Fix terminal bug');
  });

  it('should isolate sessions between different agents', async () => {
    // Create 2 agents
    await createAgent({ name: 'Sophie' });
    await createAgent({ name: 'Magnus' });

    // Create sessions for each on same project
    await createSession({
      projectPath: '/Users/test/quack-app',
      projectName: 'quack-app',
      agentName: 'Sophie',
      title: 'Sophie Task',
    });

    await createSession({
      projectPath: '/Users/test/quack-app',
      projectName: 'quack-app',
      agentName: 'Magnus',
      title: 'Magnus Task',
    });

    // Get Sophie's agent ID
    const sophieAgent = findAgent('Sophie');
    const magnusAgent = findAgent('Magnus');

    // Filter sessions by agent
    const sophieSessions = await listSessions({ agentId: sophieAgent.id });
    const magnusSessions = await listSessions({ agentId: magnusAgent.id });

    // Verify isolation
    expect(sophieSessions.total).toBe(1);
    expect(sophieSessions.sessions[0].title).toBe('Sophie Task');

    expect(magnusSessions.total).toBe(1);
    expect(magnusSessions.sessions[0].title).toBe('Magnus Task');
  });

  it('should handle orphaned sessions when agent is deleted', async () => {
    const agentResult = await createAgent({ name: 'Temporary Agent' });

    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Temporary Agent',
      title: 'Orphaned Task',
      status: 'in_progress',
    });

    // Delete agent (delete mode)
    await deleteAgent({
      agentId: agentResult.agent.id,
      deleteMode: 'delete',
    });

    // Verify sessions are deleted (not orphaned)
    const sessions = loadSessions();
    expect(sessions).toHaveLength(0);
  });
});

// ============================================================
// EDGE CASES
// ============================================================

describe('Edge Cases', () => {
  it('should handle agent with 5+ projects', async () => {
    const agentResult = await createAgent({ name: 'Polyglot' });

    const projects = [
      '/project1', '/project2', '/project3',
      '/project4', '/project5', '/project6'
    ];

    for (const projectPath of projects) {
      await createSession({
        projectPath,
        projectName: projectPath.split('/').pop(),
        agentName: 'Polyglot',
        title: `Task in ${projectPath}`,
      });
    }

    const agentProjects = getProjectsForAgent(agentResult.agent.id);
    expect(agentProjects).toHaveLength(6);
  });

  it('should handle empty filters correctly', async () => {
    await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: 'Task',
    });

    // Empty filters should return all
    const result = await listSessions({
      agentId: undefined,
      projectPath: undefined,
      status: undefined,
    });

    expect(result.total).toBe(1);
  });

  it('should handle special characters in agent names', async () => {
    const result = await createAgent({ name: 'Sophie 🦆' });

    expect(result.success).toBe(true);
    expect(result.agent.name).toBe('Sophie 🦆');
  });

  it('should handle very long session titles', async () => {
    const longTitle = 'A'.repeat(500);

    const result = await createSession({
      projectPath: '/Users/test/project',
      projectName: 'project',
      agentName: 'Sophie',
      title: longTitle,
    });

    expect(result.success).toBe(true);
    expect(result.session.title).toBe(longTitle);
  });

  it('should handle rapid session creation (race conditions)', async () => {
    // Create 10 sessions rapidly
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        createSession({
          projectPath: '/Users/test/project',
          projectName: 'project',
          agentName: 'Sophie',
          title: `Task ${i}`,
        })
      );
    }

    const results = await Promise.all(promises);

    // All should succeed
    expect(results.every(r => r.success)).toBe(true);

    // All should have unique IDs
    const sessionIds = results.map(r => r.session.id);
    const uniqueIds = new Set(sessionIds);
    expect(uniqueIds.size).toBe(10);
  });
});
