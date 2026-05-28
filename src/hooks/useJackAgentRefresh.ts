import { useEffect, useCallback, useRef } from 'react';
import { listen } from '@tauri-apps/api/event';
import { Store } from '@tauri-apps/plugin-store';
import { useJackStore } from '../stores/jackStore';
import type { JackAgentSnapshot, JackProjectSnapshot } from '../stores/jackStore';

interface StoredAgent {
  id: string;
  name: string;
  projectPath: string;
  projectName: string;
  color: string;
  avatar?: string;
}

interface StoredSession {
  agentId: string;
  status: string;
}

interface RepoOrderData {
  order: string[];
  colors: Record<string, string>;
}

function extractProjectName(path: string): string {
  return path.split('/').pop() || path;
}

function repoKey(path: string): string {
  return `repo-${extractProjectName(path)}`;
}

function buildSnapshots(
  agents: StoredAgent[],
  sessions: StoredSession[],
  colorMap: Record<string, string>,
): { agents: JackAgentSnapshot[]; projects: JackProjectSnapshot[] } {
  const activeByAgent = new Map<string, number>();
  for (const s of sessions) {
    if (!s?.agentId) continue;
    if (s.status === 'done' || s.status === 'completed') continue;
    activeByAgent.set(s.agentId, (activeByAgent.get(s.agentId) || 0) + 1);
  }

  const projectMap = new Map<string, JackProjectSnapshot>();
  const agentSnapshots: JackAgentSnapshot[] = [];

  for (const agent of agents) {
    if (!agent?.id || !agent?.name) continue;
    const pPath = agent.projectPath || '';
    const pName = agent.projectName || extractProjectName(pPath);
    const pColor = colorMap[repoKey(pPath)] || agent.color || '#666';
    const activeSessions = activeByAgent.get(agent.id) || 0;

    agentSnapshots.push({
      id: agent.id, name: agent.name,
      projectPath: pPath, projectName: pName,
      color: pColor, avatar: agent.avatar,
      status: activeSessions > 0 ? 'busy' : 'idle',
      activeSessions,
    });

    if (pPath && !projectMap.has(pPath)) {
      projectMap.set(pPath, {
        path: pPath, name: pName, color: pColor,
        agentCount: 0, activeSessionCount: 0,
      });
    }
    const proj = projectMap.get(pPath);
    if (proj) {
      proj.agentCount++;
      proj.activeSessionCount += activeSessions;
    }
  }

  return { agents: agentSnapshots, projects: Array.from(projectMap.values()) };
}

export function useJackAgentRefresh(): void {
  const setAgents = useJackStore((s) => s.setAgents);
  const setProjects = useJackStore((s) => s.setProjects);
  const agentsStoreRef = useRef<Store | null>(null);
  const orderStoreRef = useRef<Store | null>(null);

  useEffect(() => {
    Store.load('quack-agents.json').then((s) => { agentsStoreRef.current = s; });
    Store.load('.quack-repo-order.dat').then((s) => { orderStoreRef.current = s; });
  }, []);

  const refresh = useCallback(async () => {
    try {
      const store = agentsStoreRef.current ?? await Store.load('quack-agents.json');
      agentsStoreRef.current = store;
      // Brain: quack-agents.json schema is { agents: UnifiedAgent[], sessions: AgentSession[], version }
      // NOT a flat map of id -> agent. Iterating entries() returns 2 keys, not agents.
      const agentsRaw = (await store.get<StoredAgent[]>('agents')) || [];
      const sessionsRaw = (await store.get<StoredSession[]>('sessions')) || [];

      const orderStore = orderStoreRef.current ?? await Store.load('.quack-repo-order.dat');
      orderStoreRef.current = orderStore;
      const orderData = await orderStore.get<RepoOrderData>('repository-order');
      const colorMap = orderData?.colors || {};

      const { agents, projects } = buildSnapshots(agentsRaw, sessionsRaw, colorMap);
      setAgents(agents);
      setProjects(projects);
    } catch (err) {
      console.error('Jack: failed to refresh agent data', err);
    }
  }, [setAgents, setProjects]);

  useEffect(() => {
    refresh();
    const u1 = listen('sessions-updated', () => refresh());
    const u2 = listen('external-terminal-status', () => refresh());
    return () => { u1.then((fn) => fn()); u2.then((fn) => fn()); };
  }, [refresh]);
}
