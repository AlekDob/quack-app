import { sessionDotColor } from './officeLayout';
import type { TerminalInfo, AgentSession, ChatMessage } from '../../../types';
import type { DuckViewModel } from './OfficeRoomCard';

interface Inputs {
  terminals: TerminalInfo[];
  sessions: AgentSession[];
  chatLoadingMap: Map<string, boolean>;
  pendingQuestionsMap: Map<string, Set<string>>;
  chatSessions: Map<string, ChatMessage[]>;
}

interface SessionDotFlags {
  awaiting: boolean;
  working: boolean;
  ready: boolean;
}

function deriveSessionFlags(
  sessionId: string,
  chatLoadingMap: Map<string, boolean>,
  pendingQuestionsMap: Map<string, Set<string>>,
  chatSessions: Map<string, ChatMessage[]>,
): SessionDotFlags {
  const awaiting = (pendingQuestionsMap.get(sessionId)?.size ?? 0) > 0;
  const messages = chatSessions.get(sessionId) ?? [];
  const last = messages[messages.length - 1];
  const isStreaming = last?.role === 'assistant' && last.status === 'streaming';
  const working = (chatLoadingMap.get(sessionId) ?? false) || isStreaming;
  const hasUser = messages.some(m => m.role === 'user');
  const ready =
    hasUser &&
    last?.role === 'assistant' &&
    (last.status === 'complete' || last.status === undefined);
  return { awaiting, working, ready };
}

export function buildViewModels(inputs: Inputs) {
  const ducksByProject = new Map<string, DuckViewModel[]>();
  const doorPlateByProject = new Map<string, string>();
  const busyRatioByProject = new Map<string, number>();
  const countsByProject = new Map<string, { busy: number; idle: number; dormant: number }>();

  const byPath = new Map<string, TerminalInfo[]>();
  for (const t of inputs.terminals) {
    const arr = byPath.get(t.cwd) ?? [];
    arr.push(t);
    byPath.set(t.cwd, arr);
  }

  for (const [projectPath, agents] of byPath.entries()) {
    const ducks: DuckViewModel[] = [];
    let busy = 0, idle = 0, dormant = 0;
    let worstAwaiting = false, worstWorking = false, worstReady = false;

    for (const agent of agents) {
      const agentSessions = inputs.sessions.filter(s => s.agentId === agent.id);
      const sessionDots: SessionDotFlags[] = agentSessions.slice(0, 5).map(s =>
        deriveSessionFlags(s.id, inputs.chatLoadingMap, inputs.pendingQuestionsMap, inputs.chatSessions)
      );

      const isBusy = sessionDots.some(d => d.working);
      const isAwaiting = sessionDots.some(d => d.awaiting);
      const isReady = sessionDots.some(d => d.ready);

      const status: 'busy' | 'idle' | 'waiting' = isBusy ? 'busy' : isAwaiting ? 'waiting' : 'idle';
      if (isBusy) busy++;
      else if (agentSessions.length === 0) dormant++;
      else idle++;
      worstAwaiting = worstAwaiting || isAwaiting;
      worstWorking = worstWorking || isBusy;
      worstReady = worstReady || isReady;

      ducks.push({
        agentId: agent.id,
        color: agent.color,
        avatarUrl: agent.avatar,
        initial: (agent.label?.[0] ?? '?').toUpperCase(),
        status,
        sessionDots,
      });
    }

    ducksByProject.set(projectPath, ducks);
    doorPlateByProject.set(
      projectPath,
      sessionDotColor({ awaiting: worstAwaiting, working: worstWorking, ready: worstReady })
    );
    busyRatioByProject.set(projectPath, agents.length ? busy / agents.length : 0);
    countsByProject.set(projectPath, { busy, idle, dormant });
  }

  return { ducksByProject, doorPlateByProject, busyRatioByProject, countsByProject };
}
