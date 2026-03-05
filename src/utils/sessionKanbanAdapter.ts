/**
 * Session-Kanban Adapter
 * 
 * Converts AgentSession objects to KanbanTask format for unified display.
 * Part of the Sessions-First architecture refactor.
 * 
 * @module sessionKanbanAdapter
 */

import type { AgentSession, KanbanTask, KanbanAssignedAgent } from '../types';

/**
 * Converts an AgentSession to a KanbanTask for display in Kanban board
 * 
 * Maps session fields to task fields:
 * - id, title, status → direct mapping
 * - projectPath, projectName → direct mapping
 * - claudeSessionId → sessionId
 * - agentId → terminalId
 * - timestamps → direct mapping
 * - tokens → direct mapping
 * 
 * @param session - The AgentSession to convert
 * @param agentInfo - Optional agent information (name, avatar, color) for card display
 * @returns KanbanTask representation of the session
 */
export function sessionToKanbanTask(
  session: AgentSession,
  agentInfo?: {
    name?: string;
    avatar?: string;
    color?: string;
  }
): KanbanTask {
  const assignedAgent: KanbanAssignedAgent | undefined = agentInfo
    ? {
        id: session.agentId,
        name: agentInfo.name || `Agent ${session.agentId.slice(0, 8)}`,
        avatar: agentInfo.avatar,
        color: agentInfo.color || '#00D4FF',
        projectPath: session.projectPath,
        projectName: session.projectName,
      }
    : undefined;

  return {
    id: session.id,
    title: session.title || 'Untitled Session',
    prompt: session.initialPrompt || '', // Initial prompt from Kanban task creation
    status: session.status,
    assignedAgent,
    type: 'agent', // All sessions are agent tasks
    projectPath: session.projectPath,
    projectName: session.projectName,
    sessionId: session.claudeSessionId,
    terminalId: session.agentId,
    createdAt: session.createdAt,
    startedAt: session.status === 'in_progress' || session.status === 'done' ? session.createdAt : undefined,
    completedAt: session.completedAt,
    inputTokens: session.inputTokens,
    outputTokens: session.outputTokens,
    cacheCreationTokens: session.cacheCreationTokens,
    cacheReadTokens: session.cacheReadTokens,
    totalCost: session.totalCost,
    attachments: session.initialAttachments, // Initial attachments from Kanban task creation
  };
}

/**
 * Converts an array of AgentSessions to KanbanTasks
 * 
 * @param sessions - Array of sessions to convert
 * @param agentInfoMap - Optional map of agentId → agent info for card display
 * @returns Array of KanbanTask representations
 */
function sessionsToKanbanTasks(
  sessions: AgentSession[],
  agentInfoMap?: Map<string, { name?: string; avatar?: string; color?: string }>
): KanbanTask[] {
  return sessions.map((session) => {
    const agentInfo = agentInfoMap?.get(session.agentId);
    return sessionToKanbanTask(session, agentInfo);
  });
}

/**
 * Checks if a KanbanTask is session-based (vs legacy shell/watch task)
 * 
 * @param task - The task to check
 * @returns true if task is a session-based agent task
 */
function isSessionTask(task: KanbanTask): boolean {
  return task.type === 'agent';
}
