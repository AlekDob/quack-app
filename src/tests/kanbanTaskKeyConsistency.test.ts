/**
 * Test: Kanban Task Storage Key Consistency
 *
 * Ensures all kanban-related code uses the correct storage key 'kanbanTasks'
 * for accessing tasks from quack-kanban-tasks.json store.
 *
 * Bug Fixed: usePopoutKanbanChat.ts was using 'tasks' instead of 'kanbanTasks',
 * causing tasks to not be found and projectPath to fallback to '/', which made
 * the Claude agent think it was in the wrong project.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const KANBAN_TASKS_KEY = 'kanbanTasks';
const KANBAN_STORE_FILENAME = 'quack-kanban-tasks.json';

/**
 * Find all TypeScript files that reference the kanban store
 */
function findKanbanStoreReferences(): { file: string; content: string }[] {
  const srcDir = path.join(__dirname, '..');
  const results: { file: string; content: string }[] = [];

  function walkDir(dir: string) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        walkDir(fullPath);
      } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
        const content = fs.readFileSync(fullPath, 'utf8');
        // Check if file references the kanban store
        if (content.includes(KANBAN_STORE_FILENAME)) {
          results.push({ file: fullPath, content });
        }
      }
    }
  }

  walkDir(srcDir);
  return results;
}

describe('Kanban Task Storage Key Consistency', () => {
  it('all code accessing quack-kanban-tasks.json should use "kanbanTasks" key', () => {
    const files = findKanbanStoreReferences();
    const errors: string[] = [];

    for (const { file, content } of files) {
      // Skip test files and the storage service itself (which defines the key)
      const relativePath = path.relative(path.join(__dirname, '..'), file);
      if (relativePath.includes('.test.') || relativePath.includes('kanbanStorage.ts')) {
        continue;
      }

      // Pattern to find store.get calls with wrong key
      // Look for patterns like: .get<...>('tasks') or .get('tasks') near kanban store usage
      const lines = content.split('\n');
      let inKanbanStoreContext = false;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Track if we're in a context where kanban store was loaded
        if (line.includes(KANBAN_STORE_FILENAME)) {
          inKanbanStoreContext = true;
        }

        // Check for incorrect key usage in store.get calls
        // Allow 'kanbanTasks' but flag 'tasks' as incorrect
        if (inKanbanStoreContext) {
          // Match patterns like .get<...>('tasks') or .get('tasks')
          const wrongKeyPattern = /\.get\s*<[^>]*>\s*\(\s*['"]tasks['"]\s*\)|\.get\s*\(\s*['"]tasks['"]\s*\)/;
          if (wrongKeyPattern.test(line)) {
            errors.push(
              `${relativePath}:${i + 1}: Uses incorrect key 'tasks' instead of '${KANBAN_TASKS_KEY}'\n` +
              `  Line: ${line.trim()}`
            );
          }

          // Reset context after a reasonable window (15 lines)
          if (i > 15) {
            const contextStart = Math.max(0, i - 15);
            const recentLines = lines.slice(contextStart, i).join('\n');
            if (!recentLines.includes(KANBAN_STORE_FILENAME)) {
              inKanbanStoreContext = false;
            }
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `Found ${errors.length} file(s) using incorrect kanban storage key:\n\n${errors.join('\n\n')}\n\n` +
        `All access to ${KANBAN_STORE_FILENAME} should use key '${KANBAN_TASKS_KEY}'`
      );
    }
  });

  it('kanbanStorage.ts should define KANBAN_TASKS_KEY as "kanbanTasks"', () => {
    const storageServicePath = path.join(__dirname, '..', 'services', 'kanbanStorage.ts');
    const content = fs.readFileSync(storageServicePath, 'utf8');

    // Check that the constant is defined correctly
    expect(content).toContain(`const KANBAN_TASKS_KEY = "${KANBAN_TASKS_KEY}"`);
  });

  it('MCP server should use same key as frontend', () => {
    const mcpServerPath = path.join(__dirname, '..', '..', 'src-tauri', 'node-sdk', 'kanban-mcp-server.js');
    const content = fs.readFileSync(mcpServerPath, 'utf8');

    // MCP server uses 'kanbanTasks' in the data structure
    expect(content).toContain('kanbanTasks');

    // And should not use wrong key for task storage
    expect(content).not.toMatch(/\.tasks\s*\|\|/);
  });
});
