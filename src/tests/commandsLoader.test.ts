/**
 * Test suite for loadAvailableCommands function
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadAvailableCommands } from '../utils/skillsAndDroidsLoader';
import { invoke } from '@tauri-apps/api/core';

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('loadAvailableCommands', () => {
  const mockInvoke = vi.mocked(invoke);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should load project and global commands', async () => {
    // Mock home directory
    mockInvoke.mockImplementation(async (command: string, args?: any) => {
      if (command === 'get_home_directory') {
        return '/Users/testuser';
      }
      if (command === 'list_directory_files') {
        if (args.path.includes('.claude/commands')) {
          // Return different files based on path
          if (args.path.includes('testproject')) {
            return ['commit.md', 'code-review.md'];
          } else {
            return ['feature.md', 'hotfix.md'];
          }
        }
      }
      return [];
    });

    const commands = await loadAvailableCommands('/path/to/testproject');

    expect(commands).toContain('commit');
    expect(commands).toContain('code-review');
    expect(commands).toContain('feature');
    expect(commands).toContain('hotfix');
    expect(commands.length).toBe(4);
  });

  it('should handle missing directories gracefully', async () => {
    mockInvoke.mockImplementation(async (command: string) => {
      if (command === 'get_home_directory') {
        return '/Users/testuser';
      }
      if (command === 'list_directory_files') {
        throw new Error('Directory not found');
      }
      return [];
    });

    const commands = await loadAvailableCommands('/path/to/empty-project');

    expect(commands).toEqual([]);
  });

  it('should avoid duplicate command names (project takes precedence)', async () => {
    mockInvoke.mockImplementation(async (command: string, args?: any) => {
      if (command === 'get_home_directory') {
        return '/Users/testuser';
      }
      if (command === 'list_directory_files') {
        // Both project and global have 'commit.md'
        return ['commit.md', 'custom.md'];
      }
      return [];
    });

    const commands = await loadAvailableCommands('/path/to/testproject');

    // Should only have 'commit' once
    const commitCount = commands.filter(c => c === 'commit').length;
    expect(commitCount).toBe(1);
    expect(commands).toContain('custom');
  });

  it('should remove .md extension from command names', async () => {
    mockInvoke.mockImplementation(async (command: string, args?: any) => {
      if (command === 'get_home_directory') {
        return '/Users/testuser';
      }
      if (command === 'list_directory_files') {
        return ['my-custom-command.md'];
      }
      return [];
    });

    const commands = await loadAvailableCommands('/path/to/testproject');

    expect(commands).toContain('my-custom-command');
    expect(commands).not.toContain('my-custom-command.md');
  });
});
