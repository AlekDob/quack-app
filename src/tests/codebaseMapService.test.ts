/**
 * Codebase Map Service Tests
 *
 * Tests for the codebase map generation and management service.
 * Tests YAML parsing, script installation, map generation, and hook management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  parseMapStats,
  getScriptPath,
  ensureScriptInstalled,
  readMapStats,
  generateMap,
  installHook,
  uninstallHook,
  getMapPath,
  type CodebaseMapStats,
} from '../services/codebaseMapService';

// Mock Tauri API modules
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  homeDir: vi.fn(),
}));

// Import mocked modules for type safety
import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';

describe('Codebase Map Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseMapStats', () => {
    it('should parse valid YAML frontmatter', () => {
      const content = `---
generated: 2026-02-01T10:30:00Z
files: 42
exports: 128
project: quack-app
---

# Codebase Map

Rest of the content...`;

      const stats = parseMapStats(content);

      expect(stats).toEqual({
        generated: '2026-02-01T10:30:00Z',
        files: 42,
        exports: 128,
        project: 'quack-app',
      });
    });

    it('should handle YAML with extra whitespace', () => {
      const content = `---
generated:  2026-02-01T10:30:00Z
files:  42
exports:  128
project:  quack-app
---

Content`;

      const stats = parseMapStats(content);

      expect(stats).not.toBeNull();
      expect(stats?.generated).toBe('2026-02-01T10:30:00Z');
      expect(stats?.files).toBe(42);
      expect(stats?.exports).toBe(128);
      expect(stats?.project).toBe('quack-app');
    });

    it('should return null for content without frontmatter', () => {
      const content = '# Just a regular markdown file\n\nNo frontmatter here.';

      const stats = parseMapStats(content);

      expect(stats).toBeNull();
    });

    it('should return null for incomplete frontmatter', () => {
      const content = `---
generated: 2026-02-01T10:30:00Z
files: 42
---

Missing exports field`;

      const stats = parseMapStats(content);

      expect(stats).toBeNull();
    });

    it('should return null for malformed YAML', () => {
      const content = `---
generated 2026-02-01T10:30:00Z
files 42
---

No colons`;

      const stats = parseMapStats(content);

      expect(stats).toBeNull();
    });

    it('should handle colons in values (timestamps)', () => {
      const content = `---
generated: 2026-02-01T10:30:00Z
files: 42
exports: 128
project: my:project:name
---

Content`;

      const stats = parseMapStats(content);

      expect(stats).not.toBeNull();
      expect(stats?.project).toBe('my:project:name');
    });

    it('should parse zero values correctly', () => {
      const content = `---
generated: 2026-02-01T10:30:00Z
files: 0
exports: 0
project: empty-project
---

Content`;

      const stats = parseMapStats(content);

      expect(stats).toEqual({
        generated: '2026-02-01T10:30:00Z',
        files: 0,
        exports: 0,
        project: 'empty-project',
      });
    });

    it('should return null for empty string', () => {
      const stats = parseMapStats('');
      expect(stats).toBeNull();
    });
  });

  describe('getScriptPath', () => {
    it('should return correct script path', async () => {
      vi.mocked(homeDir).mockResolvedValue('/Users/testuser/');

      const path = await getScriptPath();

      expect(path).toBe('/Users/testuser/.quack/scripts/generate-codebase-map.mjs');
      expect(homeDir).toHaveBeenCalledTimes(1);
    });

    it('should handle home directory without trailing slash', async () => {
      vi.mocked(homeDir).mockResolvedValue('/Users/testuser');

      const path = await getScriptPath();

      expect(path).toBe('/Users/testuser/.quack/scripts/generate-codebase-map.mjs');
    });
  });

  describe('ensureScriptInstalled', () => {
    it('should return existing script path if already installed', async () => {
      vi.mocked(homeDir).mockResolvedValue('/Users/testuser/');
      vi.mocked(invoke).mockResolvedValue('script content');

      const path = await ensureScriptInstalled('/project/path');

      expect(path).toBe('/Users/testuser/.quack/scripts/generate-codebase-map.mjs');
      expect(invoke).toHaveBeenCalledWith('read_file_content', {
        path: '/Users/testuser/.quack/scripts/generate-codebase-map.mjs',
      });
    });

    it('should install script if not present', async () => {
      vi.mocked(homeDir).mockResolvedValue('/Users/testuser/');
      vi.mocked(invoke)
        .mockRejectedValueOnce(new Error('File not found')) // read_file_content fails
        .mockResolvedValueOnce(undefined) // mkdir -p
        .mockResolvedValueOnce(undefined); // cp

      const path = await ensureScriptInstalled('/project/path');

      expect(path).toBe('/Users/testuser/.quack/scripts/generate-codebase-map.mjs');
      expect(invoke).toHaveBeenCalledWith('execute_command', {
        command: 'mkdir -p /Users/testuser/.quack/scripts',
        cwd: '/project/path',
      });
      expect(invoke).toHaveBeenCalledWith('execute_command', {
        command: 'cp /project/path/scripts/generate-codebase-map.mjs /Users/testuser/.quack/scripts/generate-codebase-map.mjs',
        cwd: '/project/path',
      });
    });

    it('should throw error if installation fails', async () => {
      vi.mocked(homeDir).mockResolvedValue('/Users/testuser/');
      vi.mocked(invoke)
        .mockRejectedValueOnce(new Error('File not found'))
        .mockRejectedValueOnce(new Error('Permission denied'));

      await expect(ensureScriptInstalled('/project/path')).rejects.toThrow('Permission denied');
    });
  });

  describe('readMapStats', () => {
    it('should read and parse map stats successfully', async () => {
      const mapContent = `---
generated: 2026-02-01T10:30:00Z
files: 42
exports: 128
project: quack-app
---

Content`;

      vi.mocked(invoke).mockResolvedValue(mapContent);

      const stats = await readMapStats('/project/path');

      expect(stats).toEqual({
        generated: '2026-02-01T10:30:00Z',
        files: 42,
        exports: 128,
        project: 'quack-app',
      });
      expect(invoke).toHaveBeenCalledWith('read_file_content', {
        path: '/project/path/.quack/codebase-map.md',
      });
    });

    it('should return null if map file does not exist', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('File not found'));

      const stats = await readMapStats('/project/path');

      expect(stats).toBeNull();
    });

    it('should return null if map file has invalid content', async () => {
      vi.mocked(invoke).mockResolvedValue('Invalid content without frontmatter');

      const stats = await readMapStats('/project/path');

      expect(stats).toBeNull();
    });
  });

  describe('generateMap', () => {
    it('should generate map successfully', async () => {
      vi.mocked(homeDir).mockResolvedValue('/Users/testuser/');
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await generateMap('/project/path');

      expect(result).toBe(true);
      expect(invoke).toHaveBeenCalledWith('execute_command', {
        command: 'node /Users/testuser/.quack/scripts/generate-codebase-map.mjs . .quack/codebase-map.md',
        cwd: '/project/path',
      });
    });

    it('should return false on error', async () => {
      vi.mocked(homeDir).mockResolvedValue('/Users/testuser/');
      vi.mocked(invoke).mockRejectedValue(new Error('Command failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await generateMap('/project/path');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to generate codebase map:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('installHook', () => {
    it('should install PostToolUse hook successfully', async () => {
      vi.mocked(homeDir).mockResolvedValue('/Users/testuser/');
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await installHook('/project/path');

      expect(result).toBe(true);
      expect(invoke).toHaveBeenCalledWith('save_hook', {
        workingDir: '/project/path',
        hook: {
          id: 'codebase-map-auto-update',
          name: 'Codebase Map Auto-Update',
          type: 'PostToolUse',
          matcher: 'Write',
          command: 'node /Users/testuser/.quack/scripts/generate-codebase-map.mjs --update-file "$TOOL_INPUT_FILE_PATH" . .quack/codebase-map.md',
          enabled: true,
          scope: 'project',
          description: 'Auto-updates codebase map when files are written by Claude',
        },
      });
    });

    it('should return false on error', async () => {
      vi.mocked(homeDir).mockResolvedValue('/Users/testuser/');
      vi.mocked(invoke).mockRejectedValue(new Error('Hook save failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await installHook('/project/path');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to install codebase map hook:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('uninstallHook', () => {
    it('should uninstall hook successfully', async () => {
      vi.mocked(invoke).mockResolvedValue(undefined);

      const result = await uninstallHook('/project/path');

      expect(result).toBe(true);
      expect(invoke).toHaveBeenCalledWith('delete_hook', {
        workingDir: '/project/path',
        hookId: 'codebase-map-auto-update',
        scope: 'project',
      });
    });

    it('should return false on error', async () => {
      vi.mocked(invoke).mockRejectedValue(new Error('Hook deletion failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await uninstallHook('/project/path');

      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to uninstall codebase map hook:',
        expect.any(Error)
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe('getMapPath', () => {
    it('should return correct map file path', () => {
      const path = getMapPath('/project/path');

      expect(path).toBe('/project/path/.quack/codebase-map.md');
    });

    it('should handle paths with trailing slash', () => {
      const path = getMapPath('/project/path/');

      expect(path).toBe('/project/path//.quack/codebase-map.md');
    });

    it('should handle root path', () => {
      const path = getMapPath('/');

      // Note: getMapPath just concatenates, so '/' + '/.quack/...' = '//.quack/...'
      // This is expected behavior as root paths are edge cases
      expect(path).toBe('//.quack/codebase-map.md');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow: install script -> generate map -> install hook', async () => {
      vi.mocked(homeDir).mockResolvedValue('/Users/testuser/');
      vi.mocked(invoke)
        .mockResolvedValueOnce('existing script') // ensureScriptInstalled check
        .mockResolvedValueOnce(undefined) // generateMap
        .mockResolvedValueOnce(undefined); // installHook

      const scriptPath = await ensureScriptInstalled('/project/path');
      const generateResult = await generateMap('/project/path');
      const hookResult = await installHook('/project/path');

      expect(scriptPath).toBe('/Users/testuser/.quack/scripts/generate-codebase-map.mjs');
      expect(generateResult).toBe(true);
      expect(hookResult).toBe(true);
    });

    it('should handle map read -> parse workflow', async () => {
      const mapContent = `---
generated: 2026-02-01T10:30:00Z
files: 42
exports: 128
project: quack-app
---

# Codebase Map`;

      vi.mocked(invoke).mockResolvedValue(mapContent);

      const stats = await readMapStats('/project/path');
      const mapPath = getMapPath('/project/path');

      expect(stats).toBeTruthy();
      expect(stats?.files).toBe(42);
      expect(mapPath).toBe('/project/path/.quack/codebase-map.md');
    });
  });
});
