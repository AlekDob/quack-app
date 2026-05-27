import type { AgentPersonality } from '../types';
import type { JackAgentSnapshot, JackProjectSnapshot } from '../stores/jackStore';

export const JACK_AGENT_ID = 'jack-supervisor';
export const JACK_EVENT_NAME = `claude-event:${JACK_AGENT_ID}`;
export const JACK_AVATAR = 'duck23.jpeg';

const JACK_SKILLS = ['quack-remote', 'whiteboard', 'project-ops'];

export function getJackPersonality(): AgentPersonality {
  return {
    id: JACK_AGENT_ID,
    name: 'Jack',
    role: 'Project Manager — Supervisor cross-project',
    communicationStyle: 'professional',
    technicalContext: '',
    customNotes: 'Supervisor agent with visibility on all projects and agents.',
    selectedRules: [],
    selectedSkills: JACK_SKILLS,
    toolkit: {
      skills: JACK_SKILLS,
      droids: [],
      commands: [],
    },
  };
}

export function buildJackSystemPrompt(
  agents: JackAgentSnapshot[],
  projects: JackProjectSnapshot[]
): string {
  const lines: string[] = [];

  lines.push('## Cross-Project Status Snapshot\n');

  if (projects.length > 0) {
    lines.push('### Projects');
    for (const p of projects) {
      const badge = `${p.agentCount} agents, ${p.activeSessionCount} active`;
      lines.push(`- **${p.name}** (${badge})`);
    }
    lines.push('');
  }

  if (agents.length > 0) {
    lines.push('### Agents');
    for (const a of agents) {
      const status = a.status === 'busy' ? '[BUSY]' : '[idle]';
      lines.push(`- ${status} **${a.name}** @ ${a.projectName} (${a.activeSessions} sessions)`);
    }
    lines.push('');
  }

  if (agents.length === 0 && projects.length === 0) {
    lines.push('No agents or projects currently active.\n');
  }

  return lines.join('\n');
}
