import { invoke } from '@tauri-apps/api/core';
import type { AgentSession, RemoteApiConfig } from '../types';

/**
 * Notify the lead agent that a team member has completed their task.
 * Sends a formatted message to the lead's active session via Remote API.
 * Brain: 025-team-delegation-footer
 */
export async function notifyLeadAgent(
  leadSessionId: string,
  session: AgentSession,
): Promise<void> {
  const config = await invoke<RemoteApiConfig>('get_remote_config');
  if (!config.enabled || !config.token) {
    console.warn('[Team] Remote API not enabled, skipping lead notification');
    return;
  }

  const taskSummary = session.title?.replace(/^\[(Team|Remote)\]\s*/, '') ?? 'task';
  const message = [
    `🦆 [Team Complete] Agent ${session.agentId} ha completato il task assegnato.`,
    '',
    `Task: ${taskSummary}`,
    `Status: Completato`,
  ].join('\n');

  const res = await fetch(
    `http://127.0.0.1:${config.port}/api/sessions/${leadSessionId}/send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    },
  );

  if (!res.ok) {
    console.warn(`[Team] Lead notification failed: ${res.status} ${res.statusText}`);
  }
}

/** Fetch all agents from the Remote API */
export async function fetchRemoteAgents(): Promise<Array<{
  id: string;
  label: string;
  cwd: string;
  status: string;
  avatar?: string;
}>> {
  const config = await invoke<RemoteApiConfig>('get_remote_config');
  if (!config.enabled || !config.token) return [];

  const res = await fetch(`http://127.0.0.1:${config.port}/api/agents`, {
    headers: { 'Authorization': `Bearer ${config.token}` },
  });

  if (!res.ok) return [];
  const data = await res.json();
  return data.agents ?? [];
}

/** Execute a task on a remote agent */
export async function executeRemoteTask(params: {
  agentId: string;
  prompt: string;
  leadSessionId?: string;
  projectPath?: string;
  model?: string;
}): Promise<{ success: boolean; sessionId?: string; error?: string }> {
  const config = await invoke<RemoteApiConfig>('get_remote_config');
  if (!config.enabled || !config.token) {
    return { success: false, error: 'Remote API non abilitata' };
  }

  const res = await fetch(`http://127.0.0.1:${config.port}/api/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId: params.agentId,
      prompt: params.prompt,
      leadSessionId: params.leadSessionId,
      projectPath: params.projectPath,
      model: params.model,
    }),
  });

  if (!res.ok) {
    return { success: false, error: `HTTP ${res.status}` };
  }
  return res.json();
}
