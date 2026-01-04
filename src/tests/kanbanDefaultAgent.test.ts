/**
 * Tests for default agent assignment in Kanban task creation
 *
 * Verifies that when no agent is specified, the MCP server
 * automatically assigns a default agent based on project context.
 *
 * @module kanbanDefaultAgent.test
 */

import { describe, it, expect } from 'vitest';

// Test the logic of default agent selection
// Since the actual MCP server runs in Node.js separately,
// we test the selection algorithm here

interface Agent {
  id: string;
  name: string;
  projectPath: string | null;
  projectName: string | null;
  source: 'terminal' | 'personality';
}

/**
 * Simulates the default agent selection logic from kanban-mcp-server.js
 */
function selectDefaultAgent(
  agents: Agent[],
  projectPath: string | null
): Agent | null {
  let defaultAgent: Agent | null = null;

  if (projectPath) {
    // Try to find an agent for this specific project
    defaultAgent = agents.find(a => a.projectPath === projectPath) || null;
  }

  // Fallback to first available agent
  if (!defaultAgent && agents.length > 0) {
    defaultAgent = agents[0];
  }

  return defaultAgent;
}

describe('Kanban Default Agent Assignment', () => {
  describe('selectDefaultAgent', () => {
    const mockAgents: Agent[] = [
      {
        id: 'agent-1',
        name: 'Agent Alpha',
        projectPath: '/path/to/project-a',
        projectName: 'Project A',
        source: 'terminal',
      },
      {
        id: 'agent-2',
        name: 'Agent Beta',
        projectPath: '/path/to/project-b',
        projectName: 'Project B',
        source: 'terminal',
      },
      {
        id: 'agent-3',
        name: 'Agent Gamma',
        projectPath: null,
        projectName: null,
        source: 'personality',
      },
    ];

    it('should select agent matching projectPath when specified', () => {
      const result = selectDefaultAgent(mockAgents, '/path/to/project-b');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('agent-2');
      expect(result?.name).toBe('Agent Beta');
    });

    it('should fallback to first agent when projectPath does not match any agent', () => {
      const result = selectDefaultAgent(mockAgents, '/path/to/unknown-project');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('agent-1');
      expect(result?.name).toBe('Agent Alpha');
    });

    it('should use first agent when no projectPath specified', () => {
      const result = selectDefaultAgent(mockAgents, null);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('agent-1');
      expect(result?.name).toBe('Agent Alpha');
    });

    it('should return null when no agents available', () => {
      const result = selectDefaultAgent([], '/path/to/project-a');

      expect(result).toBeNull();
    });

    it('should return null when no agents and no projectPath', () => {
      const result = selectDefaultAgent([], null);

      expect(result).toBeNull();
    });

    it('should select personality agent as fallback if first in list', () => {
      const personalityFirst: Agent[] = [
        {
          id: 'agent-p1',
          name: 'Personality Agent',
          projectPath: null,
          projectName: null,
          source: 'personality',
        },
        ...mockAgents,
      ];

      const result = selectDefaultAgent(personalityFirst, '/unknown/path');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('agent-p1');
      expect(result?.source).toBe('personality');
    });

    it('should prefer project-specific agent over first agent', () => {
      // Project B agent is second, but should be selected for Project B
      const result = selectDefaultAgent(mockAgents, '/path/to/project-b');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('agent-2');
      // Even though agent-1 is first, agent-2 matches the project
    });
  });

  describe('Edge Cases', () => {
    it('should handle single agent', () => {
      const singleAgent: Agent[] = [
        {
          id: 'solo',
          name: 'Solo Agent',
          projectPath: '/some/path',
          projectName: 'Solo Project',
          source: 'terminal',
        },
      ];

      // Matching project
      expect(selectDefaultAgent(singleAgent, '/some/path')?.id).toBe('solo');

      // Non-matching project - still returns the only agent
      expect(selectDefaultAgent(singleAgent, '/other/path')?.id).toBe('solo');

      // No project specified
      expect(selectDefaultAgent(singleAgent, null)?.id).toBe('solo');
    });

    it('should handle agents with same projectPath', () => {
      const duplicatePaths: Agent[] = [
        {
          id: 'agent-dup-1',
          name: 'First Duplicate',
          projectPath: '/shared/path',
          projectName: 'Shared',
          source: 'terminal',
        },
        {
          id: 'agent-dup-2',
          name: 'Second Duplicate',
          projectPath: '/shared/path',
          projectName: 'Shared',
          source: 'terminal',
        },
      ];

      // Should return first match
      const result = selectDefaultAgent(duplicatePaths, '/shared/path');
      expect(result?.id).toBe('agent-dup-1');
    });
  });
});
