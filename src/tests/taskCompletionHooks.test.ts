/**
 * Task Completion Hooks Test Suite
 *
 * Tests for the Task Documentation Generator service that creates markdown
 * documentation from completed Kanban tasks.
 */

import { describe, it, expect } from 'vitest';
import {
  generateTaskSummary,
  generateDocMarkdown,
  slugify,
  getDocFilePath,
  type TaskSummary,
} from '../services/taskDocGenerator';
import type { KanbanTask, ChatMessage, ChatToolCall } from '../types';

// ============================================================================
// MOCK DATA
// ============================================================================

const mockTask: KanbanTask = {
  id: 'kanban-test-123',
  title: 'Fix sidebar scrolling bug',
  prompt: 'Fix the sidebar scrolling issue that causes content to overflow',
  status: 'done',
  type: 'agent',
  projectPath: '/Users/test/project',
  projectName: 'test-project',
  branch: 'feature/fix-sidebar',
  assignedAgent: {
    id: 'agent-1',
    name: 'Agent Magnus',
    color: '#FF6B35',
    avatar: 'magnus.png',
    projectPath: '/Users/test/project',
    projectName: 'test-project',
  },
  createdAt: Date.now() - 3600000, // 1 hour ago
  startedAt: Date.now() - 3000000, // 50 minutes ago
  completedAt: Date.now(),
  inputTokens: 1500,
  outputTokens: 800,
  cacheCreationTokens: 200,
  cacheReadTokens: 500,
  totalCost: 0.0123,
};

const mockMessagesWithDecisions: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Fix the sidebar scrolling issue',
    timestamp: Date.now() - 3000000,
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: "I've decided to use flexbox for the layout fix. This will provide better control over the scrolling behavior.",
    timestamp: Date.now() - 2900000,
    toolCalls: [
      {
        id: 'tool-1',
        name: 'Read',
        input: { file_path: '/src/components/Sidebar.tsx' },
      },
    ],
  },
  {
    id: 'msg-3',
    role: 'assistant',
    content: "I will implement overflow-auto on the container and choosing to add a max-height constraint.",
    timestamp: Date.now() - 2800000,
    toolCalls: [
      {
        id: 'tool-2',
        name: 'Write',
        input: { file_path: '/src/components/Sidebar.css' },
      },
      {
        id: 'tool-3',
        name: 'Edit',
        input: { file_path: '/src/components/Sidebar.tsx' },
      },
    ],
  },
];

const mockMessagesWithBashPaths: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Run tests',
    timestamp: Date.now(),
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'Running tests now',
    timestamp: Date.now(),
    toolCalls: [
      {
        id: 'tool-1',
        name: 'Bash',
        input: {
          command: 'npm test -- /path/to/test.spec.ts && echo "Done" > /output/results.txt',
        },
      },
    ],
  },
];

const mockMessagesEmpty: ChatMessage[] = [];

const mockMessagesNoTools: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'user',
    content: 'Hello',
    timestamp: Date.now(),
  },
  {
    id: 'msg-2',
    role: 'assistant',
    content: 'Hi there! How can I help?',
    timestamp: Date.now(),
  },
];

// ============================================================================
// TESTS: generateTaskSummary
// ============================================================================

describe('taskDocGenerator - generateTaskSummary', () => {
  describe('Decision Extraction', () => {
    it('should extract decisions from assistant messages', () => {
      const summary = generateTaskSummary(mockMessagesWithDecisions);

      // The regex captures the text AFTER the decision keyword
      // "decided to use flexbox..." captures "use flexbox for the layout fix..."
      // "choosing to add..." captures "add a max-height constraint"
      expect(summary.keyDecisions.length).toBeGreaterThan(0);
      expect(summary.keyDecisions.some(d => d.includes('flexbox'))).toBe(true);
      expect(summary.keyDecisions.some(d => d.includes('max-height'))).toBe(true);
    });

    it('should filter out trivial decisions (< 10 chars)', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'I decided to use CSS for this task',
          timestamp: Date.now(),
        },
      ];

      const summary = generateTaskSummary(messages);

      // "use CSS" would be extracted, but it's < 10 chars so should be filtered
      expect(summary.keyDecisions.every((d) => d.length > 10)).toBe(true);
    });

    it('should not duplicate decisions', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'I decided to use flexbox for the layout',
          timestamp: Date.now(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'I decided to use flexbox for the layout', // Same decision
          timestamp: Date.now(),
        },
      ];

      const summary = generateTaskSummary(messages);

      expect(summary.keyDecisions).toHaveLength(1);
    });

    it('should extract decisions with different patterns', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Choosing TypeScript strict mode for better type safety',
          timestamp: Date.now(),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: 'Selected Redux Toolkit for state management',
          timestamp: Date.now(),
        },
        {
          id: 'msg-3',
          role: 'assistant',
          content: 'Using Vitest as the testing framework',
          timestamp: Date.now(),
        },
        {
          id: 'msg-4',
          role: 'assistant',
          content: "Let's create a custom hook for this logic",
          timestamp: Date.now(),
        },
        {
          id: 'msg-5',
          role: 'assistant',
          content: 'Approach: component composition pattern',
          timestamp: Date.now(),
        },
      ];

      const summary = generateTaskSummary(messages);

      expect(summary.keyDecisions.length).toBeGreaterThan(0);
      expect(summary.keyDecisions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('TypeScript'),
          expect.stringContaining('Redux'),
          expect.stringContaining('Vitest'),
          expect.stringContaining('custom hook'),
          expect.stringContaining('component composition'),
        ])
      );
    });
  });

  describe('File Path Extraction', () => {
    it('should extract file paths from tool calls', () => {
      const summary = generateTaskSummary(mockMessagesWithDecisions);

      expect(summary.filesModified).toContain('/src/components/Sidebar.tsx');
      expect(summary.filesModified).toContain('/src/components/Sidebar.css');
    });

    it('should extract file paths from Bash commands', () => {
      const summary = generateTaskSummary(mockMessagesWithBashPaths);

      expect(summary.filesModified).toEqual(
        expect.arrayContaining([
          expect.stringMatching(/\/path\/to\/test\.spec\.ts/),
          expect.stringMatching(/\/output\/results\.txt/),
        ])
      );
    });

    it('should extract paths from different parameter names', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Reading file',
          timestamp: Date.now(),
          toolCalls: [
            {
              id: 'tool-1',
              name: 'Read',
              input: { file_path: '/src/file1.ts' },
            },
            {
              id: 'tool-2',
              name: 'Custom',
              input: { path: '/src/file2.ts' },
            },
            {
              id: 'tool-3',
              name: 'Custom',
              input: { filePath: '/src/file3.ts' },
            },
            {
              id: 'tool-4',
              name: 'Notebook',
              input: { notebook_path: '/notebooks/nb1.ipynb' },
            },
          ],
        },
      ];

      const summary = generateTaskSummary(messages);

      expect(summary.filesModified).toContain('/src/file1.ts');
      expect(summary.filesModified).toContain('/src/file2.ts');
      expect(summary.filesModified).toContain('/src/file3.ts');
      expect(summary.filesModified).toContain('/notebooks/nb1.ipynb');
    });

    it('should sort file paths alphabetically', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Modifying files',
          timestamp: Date.now(),
          toolCalls: [
            {
              id: 'tool-1',
              name: 'Write',
              input: { file_path: '/src/z-file.ts' },
            },
            {
              id: 'tool-2',
              name: 'Write',
              input: { file_path: '/src/a-file.ts' },
            },
            {
              id: 'tool-3',
              name: 'Write',
              input: { file_path: '/src/m-file.ts' },
            },
          ],
        },
      ];

      const summary = generateTaskSummary(messages);

      expect(summary.filesModified).toEqual([
        '/src/a-file.ts',
        '/src/m-file.ts',
        '/src/z-file.ts',
      ]);
    });
  });

  describe('Tool Usage Tracking', () => {
    it('should collect unique tools used', () => {
      const summary = generateTaskSummary(mockMessagesWithDecisions);

      expect(summary.toolsUsed).toContain('Read');
      expect(summary.toolsUsed).toContain('Write');
      expect(summary.toolsUsed).toContain('Edit');
    });

    it('should sort tools alphabetically', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Using tools',
          timestamp: Date.now(),
          toolCalls: [
            {
              id: 'tool-1',
              name: 'Write',
              input: {},
            },
            {
              id: 'tool-2',
              name: 'Bash',
              input: {},
            },
            {
              id: 'tool-3',
              name: 'Read',
              input: {},
            },
          ],
        },
      ];

      const summary = generateTaskSummary(messages);

      expect(summary.toolsUsed).toEqual(['Bash', 'Read', 'Write']);
    });

    it('should not duplicate tool names', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: 'Reading files',
          timestamp: Date.now(),
          toolCalls: [
            {
              id: 'tool-1',
              name: 'Read',
              input: { file_path: '/file1.ts' },
            },
            {
              id: 'tool-2',
              name: 'Read',
              input: { file_path: '/file2.ts' },
            },
            {
              id: 'tool-3',
              name: 'Read',
              input: { file_path: '/file3.ts' },
            },
          ],
        },
      ];

      const summary = generateTaskSummary(messages);

      expect(summary.toolsUsed).toEqual(['Read']);
    });
  });

  describe('Summary Generation', () => {
    it('should generate summary from assistant messages', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: "I've implemented the authentication flow using JWT tokens and bcrypt for password hashing.",
          timestamp: Date.now(),
        },
      ];

      const summary = generateTaskSummary(messages);

      expect(summary.summary).toBeTruthy();
      expect(summary.summary.length).toBeGreaterThan(0);
    });

    it('should generate default summary for empty messages', () => {
      const summary = generateTaskSummary(mockMessagesEmpty);

      expect(summary.summary).toBe('Task completed successfully.');
    });

    it('should handle messages without tool calls', () => {
      const summary = generateTaskSummary(mockMessagesNoTools);

      expect(summary.summary).toBeTruthy();
      expect(summary.toolsUsed).toHaveLength(0);
      expect(summary.filesModified).toHaveLength(0);
    });

    it('should truncate long messages in fallback summary', () => {
      const longMessage = 'A'.repeat(250);
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: longMessage,
          timestamp: Date.now(),
        },
      ];

      const summary = generateTaskSummary(messages);

      expect(summary.summary.length).toBeLessThanOrEqual(203); // 200 chars + '...'
      expect(summary.summary).toMatch(/\.\.\.$/);
    });

    it('should limit action statements to 5', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: `
            I've created the authentication module with secure password hashing.
            I've implemented the JWT token generation and validation logic.
            I've added middleware for protected routes.
            I've refactored the user service to use async/await patterns.
            I've updated the database schema to include session tracking.
            I've created comprehensive tests for all auth flows.
            I've fixed the security vulnerability in the login endpoint.
          `,
          timestamp: Date.now(),
        },
      ];

      const summary = generateTaskSummary(messages);

      // Should extract max 5 action statements
      const statementCount = summary.summary.split('. ').length;
      expect(statementCount).toBeLessThanOrEqual(6); // 5 statements + potential empty string
    });
  });
});

// ============================================================================
// TESTS: generateDocMarkdown
// ============================================================================

describe('taskDocGenerator - generateDocMarkdown', () => {
  const mockSummary: TaskSummary = {
    objective: 'Fix the sidebar scrolling issue',
    summary: "Implemented flexbox layout with overflow-auto to fix the scrolling behavior.",
    keyDecisions: [
      'use flexbox for the layout fix',
      'add a max-height constraint',
    ],
    filesModified: [
      '/src/components/Sidebar.tsx',
      '/src/components/Sidebar.css',
    ],
    toolsUsed: ['Read', 'Write', 'Edit'],
  };

  it('should include task title as header', () => {
    const markdown = generateDocMarkdown(mockTask, mockSummary);

    expect(markdown).toContain('# Fix sidebar scrolling bug');
    expect(markdown.startsWith('# Fix sidebar scrolling bug')).toBe(true);
  });

  it('should include metadata section', () => {
    const markdown = generateDocMarkdown(mockTask, mockSummary);

    expect(markdown).toContain('**Date**:');
    expect(markdown).toContain('**Project**: test-project');
    expect(markdown).toContain('**Branch**: feature/fix-sidebar');
    expect(markdown).toContain('**Agent**: Agent Magnus');
    expect(markdown).toContain('**Duration**:');
  });

  it('should include objective section', () => {
    const markdown = generateDocMarkdown(mockTask, mockSummary);

    expect(markdown).toContain('## Objective');
    expect(markdown).toContain(mockTask.prompt);
  });

  it('should include summary section if present', () => {
    const markdown = generateDocMarkdown(mockTask, mockSummary);

    expect(markdown).toContain('## Summary');
    expect(markdown).toContain(mockSummary.summary);
  });

  it('should omit summary section if empty', () => {
    const summaryWithoutSummary = { ...mockSummary, summary: '' };
    const markdown = generateDocMarkdown(mockTask, summaryWithoutSummary);

    expect(markdown).not.toContain('## Summary');
  });

  it('should include key decisions if present', () => {
    const markdown = generateDocMarkdown(mockTask, mockSummary);

    expect(markdown).toContain('## Key Decisions');
    expect(markdown).toContain('- use flexbox for the layout fix');
    expect(markdown).toContain('- add a max-height constraint');
  });

  it('should omit key decisions if empty', () => {
    const summaryWithoutDecisions = { ...mockSummary, keyDecisions: [] };
    const markdown = generateDocMarkdown(mockTask, summaryWithoutDecisions);

    expect(markdown).not.toContain('## Key Decisions');
  });

  it('should include files modified if present', () => {
    const markdown = generateDocMarkdown(mockTask, mockSummary);

    expect(markdown).toContain('## Files Modified');
    expect(markdown).toContain('- `/src/components/Sidebar.tsx`');
    expect(markdown).toContain('- `/src/components/Sidebar.css`');
  });

  it('should omit files modified if empty', () => {
    const summaryWithoutFiles = { ...mockSummary, filesModified: [] };
    const markdown = generateDocMarkdown(mockTask, summaryWithoutFiles);

    expect(markdown).not.toContain('## Files Modified');
  });

  it('should include tools used', () => {
    const markdown = generateDocMarkdown(mockTask, mockSummary);

    expect(markdown).toContain('## Tools Used');
    expect(markdown).toContain('Read, Write, Edit');
  });

  it('should include cost info if available', () => {
    const markdown = generateDocMarkdown(mockTask, mockSummary);

    expect(markdown).toContain('## Cost');
    expect(markdown).toContain('**Total Cost**: $0.0123');
    expect(markdown).toContain('**Token Usage**:');
    expect(markdown).toContain('- Input: 1,500');
    expect(markdown).toContain('- Output: 800');
    expect(markdown).toContain('- Cache Creation: 200');
    expect(markdown).toContain('- Cache Read: 500');
  });

  it('should omit cost section if not available', () => {
    const taskWithoutCost = { ...mockTask, totalCost: 0 };
    const markdown = generateDocMarkdown(taskWithoutCost, mockSummary);

    expect(markdown).not.toContain('## Cost');
  });

  it('should omit cost section if totalCost is undefined', () => {
    const taskWithoutCost = { ...mockTask, totalCost: undefined };
    const markdown = generateDocMarkdown(taskWithoutCost, mockSummary);

    expect(markdown).not.toContain('## Cost');
  });

  it('should include completion note if present', () => {
    const taskWithNote = {
      ...mockTask,
      completionNote: 'Fixed the issue by refactoring the CSS layout',
    };
    const markdown = generateDocMarkdown(taskWithNote, mockSummary);

    expect(markdown).toContain('## Notes');
    expect(markdown).toContain('Fixed the issue by refactoring the CSS layout');
  });

  it('should include footer', () => {
    const markdown = generateDocMarkdown(mockTask, mockSummary);

    expect(markdown).toContain('---');
    expect(markdown).toContain('*Generated by Quack Task Completion Hook*');
    expect(markdown.endsWith('*Generated by Quack Task Completion Hook*')).toBe(true);
  });

  it('should format duration correctly', () => {
    const task1 = { ...mockTask, startedAt: Date.now() - 45000, completedAt: Date.now() }; // 45s
    const task2 = { ...mockTask, startedAt: Date.now() - 300000, completedAt: Date.now() }; // 5m
    const task3 = { ...mockTask, startedAt: Date.now() - 7500000, completedAt: Date.now() }; // 2h 5m

    const md1 = generateDocMarkdown(task1, mockSummary);
    const md2 = generateDocMarkdown(task2, mockSummary);
    const md3 = generateDocMarkdown(task3, mockSummary);

    expect(md1).toMatch(/\*\*Duration\*\*:\s+\d+s/);
    expect(md2).toMatch(/\*\*Duration\*\*:\s+\d+m/);
    expect(md3).toMatch(/\*\*Duration\*\*:\s+\d+h\s+\d+m/);
  });

  it('should handle task without branch', () => {
    const taskWithoutBranch = { ...mockTask, branch: undefined };
    const markdown = generateDocMarkdown(taskWithoutBranch, mockSummary);

    expect(markdown).not.toContain('**Branch**:');
  });

  it('should handle task without assigned agent', () => {
    const taskWithoutAgent = { ...mockTask, assignedAgent: undefined };
    const markdown = generateDocMarkdown(taskWithoutAgent, mockSummary);

    expect(markdown).not.toContain('**Agent**:');
  });
});

// ============================================================================
// TESTS: slugify
// ============================================================================

describe('taskDocGenerator - slugify', () => {
  it('should lowercase title', () => {
    expect(slugify('Fix SIDEBAR Bug')).toBe('fix-sidebar-bug');
  });

  it('should replace spaces with hyphens', () => {
    expect(slugify('fix sidebar bug')).toBe('fix-sidebar-bug');
  });

  it('should replace underscores with hyphens', () => {
    expect(slugify('fix_sidebar_bug')).toBe('fix-sidebar-bug');
  });

  it('should remove special characters', () => {
    expect(slugify('Fix sidebar bug! @#$%')).toBe('fix-sidebar-bug');
  });

  it('should handle multiple consecutive hyphens', () => {
    expect(slugify('fix    sidebar    bug')).toBe('fix-sidebar-bug');
    expect(slugify('fix---sidebar---bug')).toBe('fix-sidebar-bug');
  });

  it('should trim leading/trailing hyphens', () => {
    expect(slugify('---fix-sidebar-bug---')).toBe('fix-sidebar-bug');
  });

  it('should handle empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('should handle unicode characters', () => {
    expect(slugify('Fix café bug 🐛')).toBe('fix-caf-bug');
  });

  it('should handle mixed case with special characters', () => {
    expect(slugify('Fix: Sidebar (v2) - Scrolling Issue!')).toBe('fix-sidebar-v2-scrolling-issue');
  });

  it('should handle numbers', () => {
    expect(slugify('Fix bug 123 version 2')).toBe('fix-bug-123-version-2');
  });

  it('should handle strings with only special characters', () => {
    expect(slugify('@#$%^&*()')).toBe('');
  });

  it('should handle strings with spaces and special chars only', () => {
    expect(slugify('   @@@   ---   $$$   ')).toBe('');
  });
});

// ============================================================================
// TESTS: getDocFilePath
// ============================================================================

describe('taskDocGenerator - getDocFilePath', () => {
  it('should include project path', () => {
    const path = getDocFilePath(mockTask);

    expect(path).toContain('/Users/alekdob/Desktop/Dev/Personal/quack-app/docs/kanban-tasks/');
  });

  it('should include project slug in path', () => {
    const path = getDocFilePath(mockTask);

    expect(path).toContain('/test-project/');
  });

  it('should include date in filename', () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const path = getDocFilePath(mockTask);

    expect(path).toContain(dateStr);
  });

  it('should include slugified title', () => {
    const path = getDocFilePath(mockTask);

    expect(path).toContain('fix-sidebar-scrolling-bug');
  });

  it('should end with .md extension', () => {
    const path = getDocFilePath(mockTask);

    expect(path.endsWith('.md')).toBe(true);
  });

  it('should format path correctly', () => {
    const path = getDocFilePath(mockTask);
    const pattern = /^\/Users\/alekdob\/Desktop\/Dev\/Personal\/quack-app\/docs\/kanban-tasks\/[\w-]+\/\d{4}-\d{2}-\d{2}-[\w-]+\.md$/;

    expect(path).toMatch(pattern);
  });

  it('should handle project names with special characters', () => {
    const taskWithSpecialProject = {
      ...mockTask,
      projectName: 'Test Project @#$ v2.0',
    };

    const path = getDocFilePath(taskWithSpecialProject);

    expect(path).toContain('/test-project-v20/');
  });

  it('should use completedAt if available', () => {
    const completedDate = new Date('2024-12-15').getTime();
    const taskWithCompletedDate = {
      ...mockTask,
      completedAt: completedDate,
    };

    const path = getDocFilePath(taskWithCompletedDate);

    expect(path).toContain('2024-12-15');
  });

  it('should use createdAt if completedAt is not available', () => {
    const createdDate = new Date('2024-12-10').getTime();
    const taskWithoutCompletedDate = {
      ...mockTask,
      completedAt: undefined,
      createdAt: createdDate,
    };

    const path = getDocFilePath(taskWithoutCompletedDate);

    expect(path).toContain('2024-12-10');
  });
});

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('taskDocGenerator - Integration Tests', () => {
  it('should generate complete documentation flow', () => {
    // Generate summary from messages
    const summary = generateTaskSummary(mockMessagesWithDecisions);

    // Verify summary structure
    expect(summary.keyDecisions.length).toBeGreaterThan(0);
    expect(summary.filesModified.length).toBeGreaterThan(0);
    expect(summary.toolsUsed.length).toBeGreaterThan(0);
    expect(summary.summary).toBeTruthy();

    // Generate markdown
    const markdown = generateDocMarkdown(mockTask, summary);

    // Verify markdown structure
    expect(markdown).toContain('# Fix sidebar scrolling bug');
    expect(markdown).toContain('## Objective');
    expect(markdown).toContain('## Summary');
    expect(markdown).toContain('## Key Decisions');
    expect(markdown).toContain('## Files Modified');
    expect(markdown).toContain('## Tools Used');
    expect(markdown).toContain('## Cost');

    // Verify file path
    const filePath = getDocFilePath(mockTask);
    expect(filePath).toMatch(/\.md$/);
    expect(filePath).toContain('fix-sidebar-scrolling-bug');
  });

  it('should handle minimal task with no messages', () => {
    const minimalTask: KanbanTask = {
      id: 'minimal-task',
      title: 'Simple task',
      prompt: 'Do something',
      status: 'done',
      type: 'agent',
      projectPath: '/test',
      projectName: 'test',
      createdAt: Date.now(),
    };

    const summary = generateTaskSummary([]);
    const markdown = generateDocMarkdown(minimalTask, summary);
    const filePath = getDocFilePath(minimalTask);

    expect(summary.summary).toBe('Task completed successfully.');
    expect(markdown).toContain('# Simple task');
    expect(markdown).toContain('## Objective');
    expect(filePath).toContain('simple-task.md');
  });

  it('should handle task with all optional fields', () => {
    const fullTask: KanbanTask = {
      ...mockTask,
      completionNote: 'Successfully implemented the fix',
      inputTokens: 2000,
      outputTokens: 1000,
      cacheCreationTokens: 300,
      cacheReadTokens: 700,
      totalCost: 0.0456,
    };

    const summary = generateTaskSummary(mockMessagesWithDecisions);
    const markdown = generateDocMarkdown(fullTask, summary);

    expect(markdown).toContain('## Notes');
    expect(markdown).toContain('Successfully implemented the fix');
    expect(markdown).toContain('$0.0456');
    expect(markdown).toContain('Input: 2,000');
    expect(markdown).toContain('Output: 1,000');
  });
});
