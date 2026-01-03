import { describe, it, expect } from 'vitest';

/**
 * Test for slash command alphabetical sorting and deduplication
 *
 * Bug 1: /background command was always appearing first because global commands
 * had priority over project commands in the sorting logic.
 * Fix: Changed sorting to be purely alphabetical, ignoring scope.
 *
 * Bug 2: Commands were duplicated when the same command existed in both
 * global (~/.claude/commands/) and project (.claude/commands/) directories.
 * Fix: Project commands override global commands with the same name.
 */

interface SlashCommand {
  name: string;
  scope: 'global' | 'project';
}

// Simulate the OLD sorting logic (scope priority)
function sortCommandsOld(commands: SlashCommand[]): SlashCommand[] {
  return [...commands].sort((a, b) => {
    if (a.scope === 'global' && b.scope === 'project') {
      return -1; // global comes first
    }
    if (a.scope === 'project' && b.scope === 'global') {
      return 1; // project comes after
    }
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
  });
}

// Simulate the NEW sorting logic (purely alphabetical)
function sortCommandsNew(commands: SlashCommand[]): SlashCommand[] {
  return [...commands].sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );
}

describe('Slash Command Sorting', () => {
  const testCommands: SlashCommand[] = [
    { name: 'feature', scope: 'project' },
    { name: 'background', scope: 'global' },
    { name: 'commit', scope: 'project' },
    { name: 'diary', scope: 'project' },
    { name: 'bug', scope: 'project' },
  ];

  describe('OLD sorting (scope priority) - demonstrates the bug', () => {
    it('puts global commands first regardless of alphabetical order', () => {
      const sorted = sortCommandsOld(testCommands);

      // OLD: background (global) always comes first
      expect(sorted[0].name).toBe('background');
      expect(sorted[0].scope).toBe('global');
    });

    it('background appears before bug even though b-u-g < b-a-c-k alphabetically', () => {
      const sorted = sortCommandsOld(testCommands);
      const backgroundIndex = sorted.findIndex(c => c.name === 'background');
      const bugIndex = sorted.findIndex(c => c.name === 'bug');

      // OLD: background (global) comes before bug (project)
      expect(backgroundIndex).toBeLessThan(bugIndex);
    });
  });

  describe('NEW sorting (alphabetical only) - the fix', () => {
    it('sorts all commands alphabetically regardless of scope', () => {
      const sorted = sortCommandsNew(testCommands);

      // NEW: alphabetical order - background, bug, commit, diary, feature
      expect(sorted.map(c => c.name)).toEqual([
        'background',
        'bug',
        'commit',
        'diary',
        'feature',
      ]);
    });

    it('background and bug are adjacent in alphabetical order', () => {
      const sorted = sortCommandsNew(testCommands);
      const backgroundIndex = sorted.findIndex(c => c.name === 'background');
      const bugIndex = sorted.findIndex(c => c.name === 'bug');

      // NEW: background (0) followed by bug (1) - alphabetical
      expect(backgroundIndex).toBe(0);
      expect(bugIndex).toBe(1);
    });

    it('scope is ignored in sorting', () => {
      const commandsWithMixedScopes: SlashCommand[] = [
        { name: 'zebra', scope: 'global' },
        { name: 'apple', scope: 'project' },
        { name: 'banana', scope: 'global' },
      ];

      const sorted = sortCommandsNew(commandsWithMixedScopes);

      // Sorted purely by name, scope is irrelevant
      expect(sorted.map(c => c.name)).toEqual(['apple', 'banana', 'zebra']);
    });
  });

  describe('Edge cases', () => {
    it('handles case-insensitive sorting', () => {
      const commands: SlashCommand[] = [
        { name: 'Zebra', scope: 'project' },
        { name: 'apple', scope: 'project' },
        { name: 'BANANA', scope: 'global' },
      ];

      const sorted = sortCommandsNew(commands);

      expect(sorted.map(c => c.name)).toEqual(['apple', 'BANANA', 'Zebra']);
    });

    it('handles empty array', () => {
      const sorted = sortCommandsNew([]);
      expect(sorted).toEqual([]);
    });

    it('handles single command', () => {
      const sorted = sortCommandsNew([{ name: 'only', scope: 'project' }]);
      expect(sorted.length).toBe(1);
      expect(sorted[0].name).toBe('only');
    });
  });
});

/**
 * Deduplication tests
 *
 * When a command exists in both global and project directories,
 * project should take precedence (override global).
 */

// Simulate the deduplication logic from the Rust backend
function deduplicateCommands(
  globalCommands: SlashCommand[],
  projectCommands: SlashCommand[]
): SlashCommand[] {
  const result = [...globalCommands];

  for (const projectCmd of projectCommands) {
    // Remove any existing global command with the same name (case-insensitive)
    const indexToRemove = result.findIndex(
      cmd => cmd.name.toLowerCase() === projectCmd.name.toLowerCase()
    );
    if (indexToRemove !== -1) {
      result.splice(indexToRemove, 1);
    }
    // Add the project command
    result.push(projectCmd);
  }

  // Sort alphabetically
  return result.sort((a, b) =>
    a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  );
}

describe('Slash Command Deduplication', () => {
  describe('project commands override global commands', () => {
    it('removes duplicate global command when project has same name', () => {
      const globalCommands: SlashCommand[] = [
        { name: 'background', scope: 'global' },
        { name: 'droid-factory', scope: 'global' },
      ];

      const projectCommands: SlashCommand[] = [
        { name: 'background', scope: 'project' },
        { name: 'feature', scope: 'project' },
      ];

      const result = deduplicateCommands(globalCommands, projectCommands);

      // Should have 3 commands: background (project), droid-factory (global), feature (project)
      expect(result.length).toBe(3);

      // background should be from project, not global
      const backgroundCmd = result.find(c => c.name === 'background');
      expect(backgroundCmd?.scope).toBe('project');

      // droid-factory should still be from global
      const droidCmd = result.find(c => c.name === 'droid-factory');
      expect(droidCmd?.scope).toBe('global');
    });

    it('handles case-insensitive deduplication', () => {
      const globalCommands: SlashCommand[] = [
        { name: 'Background', scope: 'global' },
      ];

      const projectCommands: SlashCommand[] = [
        { name: 'background', scope: 'project' },
      ];

      const result = deduplicateCommands(globalCommands, projectCommands);

      // Should have only 1 command
      expect(result.length).toBe(1);
      expect(result[0].scope).toBe('project');
    });

    it('keeps global commands when no project override exists', () => {
      const globalCommands: SlashCommand[] = [
        { name: 'global-only', scope: 'global' },
      ];

      const projectCommands: SlashCommand[] = [
        { name: 'project-only', scope: 'project' },
      ];

      const result = deduplicateCommands(globalCommands, projectCommands);

      expect(result.length).toBe(2);
      expect(result.map(c => c.name)).toEqual(['global-only', 'project-only']);
    });

    it('handles multiple duplicates correctly', () => {
      const globalCommands: SlashCommand[] = [
        { name: 'background', scope: 'global' },
        { name: 'droid-factory', scope: 'global' },
        { name: 'feature', scope: 'global' },
      ];

      const projectCommands: SlashCommand[] = [
        { name: 'background', scope: 'project' },
        { name: 'droid-factory', scope: 'project' },
        { name: 'diary', scope: 'project' },
      ];

      const result = deduplicateCommands(globalCommands, projectCommands);

      // Should have 4 unique commands
      expect(result.length).toBe(4);

      // All duplicates should be project scope
      expect(result.find(c => c.name === 'background')?.scope).toBe('project');
      expect(result.find(c => c.name === 'droid-factory')?.scope).toBe('project');

      // feature should still be global (no project override)
      expect(result.find(c => c.name === 'feature')?.scope).toBe('global');

      // diary is project-only
      expect(result.find(c => c.name === 'diary')?.scope).toBe('project');
    });
  });
});
