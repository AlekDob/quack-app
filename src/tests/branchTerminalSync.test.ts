/**
 * Branch-Terminal Sync Tests
 *
 * Tests for the fix: when a session has an explicit branch,
 * the terminal's branch field must be updated so the sidebar
 * (RepositoryGroup) displays the correct branch grouping.
 *
 * Brain: bug-stale-branch-indicator-after-checkout
 *
 * @module branchTerminalSync.test
 */

import { describe, it, expect } from 'vitest';

// --- Minimal type replicas (decoupled from real imports) ---

interface TerminalInfo {
  id: string;
  label: string;
  cwd: string;
  branch?: string;
}

interface AgentSession {
  id: string;
  agentId: string;
  branch?: string;
}

// --- Pure logic extracted from App.tsx and RepositoryGroup.tsx ---

/**
 * Simulate the setTerminals updater that propagates a session's
 * branch to the matching terminal (Fix 2 in App.tsx useEffect).
 */
function propagateSessionBranchToTerminals(
  terminals: TerminalInfo[],
  session: AgentSession
): TerminalInfo[] {
  if (!session.branch) return terminals;
  return terminals.map((t) =>
    t.id === session.agentId ? { ...t, branch: session.branch } : t
  );
}

/**
 * Simulate the setTerminals updater from the git:branch-changed
 * event listener (existing code in App.tsx).
 */
function applyGitBranchChangedEvent(
  terminals: TerminalInfo[],
  projectPath: string,
  branch: string
): TerminalInfo[] {
  return terminals.map((t) =>
    t.cwd === projectPath ? { ...t, branch } : t
  );
}

/**
 * Simulate RepositoryGroup's branch grouping logic (line ~1828).
 * Groups agents by their branch field, defaulting to "main".
 */
function groupAgentsByBranch(
  agents: TerminalInfo[]
): Map<string, TerminalInfo[]> {
  const groups = new Map<string, TerminalInfo[]>();
  agents.forEach((agent) => {
    const branchName = agent.branch || 'main';
    if (!groups.has(branchName)) {
      groups.set(branchName, []);
    }
    groups.get(branchName)!.push(agent);
  });
  return groups;
}

// --- Tests ---

describe('Branch-Terminal Sync', () => {
  const makeTerminal = (
    id: string,
    cwd: string,
    branch?: string
  ): TerminalInfo => ({
    id,
    label: `Agent ${id}`,
    cwd,
    branch,
  });

  const makeSession = (
    id: string,
    agentId: string,
    branch?: string
  ): AgentSession => ({
    id,
    agentId,
    branch,
  });

  describe('propagateSessionBranchToTerminals', () => {
    it('should update terminal branch when session has explicit branch', () => {
      const terminals = [
        makeTerminal('agent-1', '/projects/tubo'),
        makeTerminal('agent-2', '/projects/quack'),
      ];
      const session = makeSession('sess-1', 'agent-1', '001-mvp-youtube-wrapper');

      const updated = propagateSessionBranchToTerminals(terminals, session);

      expect(updated[0].branch).toBe('001-mvp-youtube-wrapper');
      expect(updated[1].branch).toBeUndefined(); // other agent untouched
    });

    it('should not modify terminals when session has no branch', () => {
      const terminals = [
        makeTerminal('agent-1', '/projects/tubo', 'main'),
      ];
      const session = makeSession('sess-1', 'agent-1'); // no branch

      const updated = propagateSessionBranchToTerminals(terminals, session);

      expect(updated[0].branch).toBe('main'); // unchanged
    });

    it('should override existing terminal branch with session branch', () => {
      const terminals = [
        makeTerminal('agent-1', '/projects/tubo', 'old-branch'),
      ];
      const session = makeSession('sess-1', 'agent-1', 'new-feature');

      const updated = propagateSessionBranchToTerminals(terminals, session);

      expect(updated[0].branch).toBe('new-feature');
    });

    it('should handle multiple agents on the same project', () => {
      const terminals = [
        makeTerminal('agent-1', '/projects/tubo'),
        makeTerminal('agent-2', '/projects/tubo'),
      ];
      const session = makeSession('sess-1', 'agent-1', 'feature-x');

      const updated = propagateSessionBranchToTerminals(terminals, session);

      // Only agent-1 gets updated (matched by agentId, not cwd)
      expect(updated[0].branch).toBe('feature-x');
      expect(updated[1].branch).toBeUndefined();
    });
  });

  describe('applyGitBranchChangedEvent', () => {
    it('should update ALL terminals with matching cwd', () => {
      const terminals = [
        makeTerminal('agent-1', '/projects/tubo'),
        makeTerminal('agent-2', '/projects/tubo'),
        makeTerminal('agent-3', '/projects/quack'),
      ];

      const updated = applyGitBranchChangedEvent(
        terminals,
        '/projects/tubo',
        '001-mvp-youtube-wrapper'
      );

      expect(updated[0].branch).toBe('001-mvp-youtube-wrapper');
      expect(updated[1].branch).toBe('001-mvp-youtube-wrapper');
      expect(updated[2].branch).toBeUndefined(); // different project
    });

    it('should not update terminals with different cwd', () => {
      const terminals = [
        makeTerminal('agent-1', '/projects/quack', 'main'),
      ];

      const updated = applyGitBranchChangedEvent(
        terminals,
        '/projects/tubo',
        'feature-x'
      );

      expect(updated[0].branch).toBe('main'); // unchanged
    });
  });

  describe('groupAgentsByBranch (RepositoryGroup sidebar)', () => {
    it('should group agent under "main" when branch is undefined', () => {
      const agents = [makeTerminal('agent-1', '/projects/tubo')];

      const groups = groupAgentsByBranch(agents);

      expect(groups.has('main')).toBe(true);
      expect(groups.get('main')!.length).toBe(1);
    });

    it('should group agent under correct branch when set', () => {
      const agents = [
        makeTerminal('agent-1', '/projects/tubo', '001-mvp-youtube-wrapper'),
      ];

      const groups = groupAgentsByBranch(agents);

      expect(groups.has('001-mvp-youtube-wrapper')).toBe(true);
      expect(groups.has('main')).toBe(false);
    });

    it('should separate agents on different branches', () => {
      const agents = [
        makeTerminal('agent-1', '/projects/tubo', 'main'),
        makeTerminal('agent-2', '/projects/tubo', 'feature-x'),
        makeTerminal('agent-3', '/projects/tubo'), // undefined → main
      ];

      const groups = groupAgentsByBranch(agents);

      expect(groups.get('main')!.length).toBe(2); // agent-1 + agent-3
      expect(groups.get('feature-x')!.length).toBe(1);
    });
  });

  describe('End-to-end: session creation → sidebar display', () => {
    it('should show correct branch in sidebar after session with branch is activated', () => {
      // BEFORE FIX: terminal.branch is undefined → sidebar shows "main"
      const terminals = [
        makeTerminal('agent-swift', '/projects/tubo'),
      ];

      // Session is created with explicit branch
      const session = makeSession('sess-fullmode', 'agent-swift', '001-mvp-youtube-wrapper');

      // Step 1: propagate session branch to terminal (our fix)
      const updatedTerminals = propagateSessionBranchToTerminals(terminals, session);

      // Step 2: sidebar groups agents
      const groups = groupAgentsByBranch(updatedTerminals);

      // AFTER FIX: agent shows under correct branch
      expect(groups.has('001-mvp-youtube-wrapper')).toBe(true);
      expect(groups.has('main')).toBe(false);
      expect(groups.get('001-mvp-youtube-wrapper')![0].id).toBe('agent-swift');
    });

    it('should show "main" in sidebar when session has no explicit branch', () => {
      const terminals = [
        makeTerminal('agent-jack', '/projects/tubo'),
      ];

      const session = makeSession('sess-work', 'agent-jack'); // no branch

      const updatedTerminals = propagateSessionBranchToTerminals(terminals, session);
      const groups = groupAgentsByBranch(updatedTerminals);

      // No branch on session → terminal stays undefined → groups under "main"
      expect(groups.has('main')).toBe(true);
      expect(groups.get('main')![0].id).toBe('agent-jack');
    });

    it('should update sidebar when git:branch-changed fires (watcher initial emit)', () => {
      // Simulates the Rust fix: watcher emits current branch on start
      const terminals = [
        makeTerminal('agent-swift', '/projects/tubo'),
        makeTerminal('agent-jack', '/projects/tubo'),
      ];

      // Watcher emits initial branch for the project
      const updatedTerminals = applyGitBranchChangedEvent(
        terminals,
        '/projects/tubo',
        '001-mvp-youtube-wrapper'
      );

      const groups = groupAgentsByBranch(updatedTerminals);

      // Both agents on same project get updated
      expect(groups.has('001-mvp-youtube-wrapper')).toBe(true);
      expect(groups.get('001-mvp-youtube-wrapper')!.length).toBe(2);
      expect(groups.has('main')).toBe(false);
    });
  });
});
