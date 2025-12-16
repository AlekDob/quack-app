import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildMemoryObserverPrompt, MEMORY_OBSERVER_SYSTEM_PROMPT } from '../services/memoryObserverPrompt';
import type { ClaudeEvent } from '../types';

/**
 * Memory Tool Extraction Tests
 *
 * Tests for the tool-based memory extraction system that analyzes
 * Write/Edit/Bash tool executions and extracts memories via LLM.
 */

describe('buildMemoryObserverPrompt', () => {
  it('should build a prompt with single tool execution', () => {
    const toolExecutions = [
      {
        name: 'Write',
        input: {
          file_path: '/src/auth/login.ts',
          content: 'export const login = () => { /* JWT auth */ }',
        },
      },
    ];

    const prompt = buildMemoryObserverPrompt(toolExecutions);

    // Should include the system prompt
    expect(prompt).toContain('You are a Memory Observer agent for Quack');

    // Should include tool info
    expect(prompt).toContain('Tool: Write');
    expect(prompt).toContain('file_path');
    expect(prompt).toContain('/src/auth/login.ts');

    // Should include reminder
    expect(prompt).toContain('Return ONLY valid JSON');
  });

  it('should build a prompt with multiple tool executions', () => {
    const toolExecutions = [
      {
        name: 'Edit',
        input: {
          file_path: '/package.json',
          old_string: '"dependencies": {',
          new_string: '"dependencies": {\n    "react-query": "^5.0.0",',
        },
      },
      {
        name: 'Bash',
        input: {
          command: 'npm install',
        },
      },
    ];

    const prompt = buildMemoryObserverPrompt(toolExecutions);

    // Should include both tools
    expect(prompt).toContain('Tool: Edit');
    expect(prompt).toContain('Tool: Bash');

    // Should include separator between tools
    expect(prompt).toContain('---');

    // Should include inputs
    expect(prompt).toContain('package.json');
    expect(prompt).toContain('npm install');
  });

  it('should handle empty tool executions', () => {
    const toolExecutions: Array<{ name: string; input: unknown }> = [];

    const prompt = buildMemoryObserverPrompt(toolExecutions);

    // Should still include system prompt
    expect(prompt).toContain('You are a Memory Observer agent for Quack');

    // Should include reminder
    expect(prompt).toContain('Return ONLY valid JSON');
  });

  it('should include all memory categories in system prompt', () => {
    expect(MEMORY_OBSERVER_SYSTEM_PROMPT).toContain('preference');
    expect(MEMORY_OBSERVER_SYSTEM_PROMPT).toContain('fact');
    expect(MEMORY_OBSERVER_SYSTEM_PROMPT).toContain('decision');
    expect(MEMORY_OBSERVER_SYSTEM_PROMPT).toContain('pattern');
    expect(MEMORY_OBSERVER_SYSTEM_PROMPT).toContain('mistake');
    expect(MEMORY_OBSERVER_SYSTEM_PROMPT).toContain('context');
  });

  it('should properly serialize complex input objects', () => {
    const toolExecutions = [
      {
        name: 'Write',
        input: {
          file_path: '/src/complex.ts',
          content: 'const obj = { nested: { deep: "value" } }',
          metadata: {
            author: 'user',
            timestamp: 1234567890,
          },
        },
      },
    ];

    const prompt = buildMemoryObserverPrompt(toolExecutions);

    // Should include nested structure
    expect(prompt).toContain('nested');
    expect(prompt).toContain('deep');
    expect(prompt).toContain('author');
  });
});

describe('Tool Detection Logic', () => {
  /**
   * Simulates the tool detection logic from App.tsx
   * This helps us test the logic in isolation
   */
  function detectToolsFromEvents(events: ClaudeEvent[]): {
    hasFileModifications: boolean;
    toolExecutions: Array<{ name: string; input: unknown }>;
  } {
    let hasFileModifications = false;
    const toolExecutions: Array<{ name: string; input: unknown }> = [];

    events.forEach((evt) => {
      if (evt.type === 'assistant' && (evt as any).message?.content) {
        (evt as any).message.content.forEach((content: any) => {
          if (content.type === 'tool_use') {
            const toolName = content.name?.toLowerCase();
            const input = content.input;

            // Check if Write or Edit tools were used
            if (
              (toolName === 'write' && input?.file_path) ||
              (toolName === 'edit' && input?.file_path)
            ) {
              hasFileModifications = true;
            }

            // Collect tool executions for memory observer
            if (toolName && ['write', 'edit', 'bash'].includes(toolName)) {
              toolExecutions.push({ name: toolName, input });
            }
          }
        });
      }
    });

    return { hasFileModifications, toolExecutions };
  }

  it('should detect Write tool execution', () => {
    const events: ClaudeEvent[] = [
      {
        type: 'assistant',
        message: {
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'I will create the file now.',
            },
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Write',
              input: {
                file_path: '/src/newFile.ts',
                content: 'export const x = 1;',
              },
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
    ];

    const result = detectToolsFromEvents(events);

    expect(result.hasFileModifications).toBe(true);
    expect(result.toolExecutions).toHaveLength(1);
    expect(result.toolExecutions[0].name).toBe('write');
    expect((result.toolExecutions[0].input as any).file_path).toBe('/src/newFile.ts');
  });

  it('should detect Edit tool execution', () => {
    const events: ClaudeEvent[] = [
      {
        type: 'assistant',
        message: {
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Edit',
              input: {
                file_path: '/src/existing.ts',
                old_string: 'const x = 1;',
                new_string: 'const x = 2;',
              },
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
    ];

    const result = detectToolsFromEvents(events);

    expect(result.hasFileModifications).toBe(true);
    expect(result.toolExecutions).toHaveLength(1);
    expect(result.toolExecutions[0].name).toBe('edit');
  });

  it('should detect Bash tool execution', () => {
    const events: ClaudeEvent[] = [
      {
        type: 'assistant',
        message: {
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Bash',
              input: {
                command: 'npm install react-query',
              },
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
    ];

    const result = detectToolsFromEvents(events);

    // Bash doesn't trigger file modifications flag
    expect(result.hasFileModifications).toBe(false);

    // But it should be in tool executions
    expect(result.toolExecutions).toHaveLength(1);
    expect(result.toolExecutions[0].name).toBe('bash');
  });

  it('should detect multiple tools in sequence', () => {
    const events: ClaudeEvent[] = [
      {
        type: 'assistant',
        message: {
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Write',
              input: { file_path: '/src/a.ts', content: '// a' },
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 50, output_tokens: 25 },
        },
      },
      {
        type: 'user',
        message: {
          role: 'user',
          content: [
            { type: 'tool_result', tool_use_id: 'tool-1', content: 'File written' },
          ],
        },
      } as any,
      {
        type: 'assistant',
        message: {
          id: 'msg-2',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-2',
              name: 'Edit',
              input: { file_path: '/src/b.ts', old_string: 'x', new_string: 'y' },
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 50, output_tokens: 25 },
        },
      },
    ];

    const result = detectToolsFromEvents(events);

    expect(result.hasFileModifications).toBe(true);
    expect(result.toolExecutions).toHaveLength(2);
    expect(result.toolExecutions[0].name).toBe('write');
    expect(result.toolExecutions[1].name).toBe('edit');
  });

  it('should ignore Read/Grep/Glob tools', () => {
    const events: ClaudeEvent[] = [
      {
        type: 'assistant',
        message: {
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Read',
              input: { file_path: '/src/file.ts' },
            },
            {
              type: 'tool_use',
              id: 'tool-2',
              name: 'Grep',
              input: { pattern: 'TODO', path: '/src' },
            },
            {
              type: 'tool_use',
              id: 'tool-3',
              name: 'Glob',
              input: { pattern: '*.ts' },
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
    ];

    const result = detectToolsFromEvents(events);

    expect(result.hasFileModifications).toBe(false);
    expect(result.toolExecutions).toHaveLength(0);
  });

  it('should handle events with no tool_use', () => {
    const events: ClaudeEvent[] = [
      {
        type: 'assistant',
        message: {
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'text',
              text: 'Here is my response without any tools.',
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
    ];

    const result = detectToolsFromEvents(events);

    expect(result.hasFileModifications).toBe(false);
    expect(result.toolExecutions).toHaveLength(0);
  });

  it('should handle system events (no message)', () => {
    const events: ClaudeEvent[] = [
      {
        type: 'system',
        subtype: 'init',
        session_id: 'session-123',
      } as any,
      {
        type: 'result',
        session_id: 'session-123',
        usage: { input_tokens: 100, output_tokens: 50 },
      } as any,
    ];

    const result = detectToolsFromEvents(events);

    expect(result.hasFileModifications).toBe(false);
    expect(result.toolExecutions).toHaveLength(0);
  });

  it('should handle mixed text and tool_use content', () => {
    const events: ClaudeEvent[] = [
      {
        type: 'assistant',
        message: {
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          content: [
            { type: 'text', text: 'Let me create the file.' },
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'Write',
              input: { file_path: '/src/test.ts', content: 'test' },
            },
            { type: 'text', text: 'Done!' },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
    ];

    const result = detectToolsFromEvents(events);

    expect(result.hasFileModifications).toBe(true);
    expect(result.toolExecutions).toHaveLength(1);
  });

  it('should be case-insensitive for tool names', () => {
    const events: ClaudeEvent[] = [
      {
        type: 'assistant',
        message: {
          id: 'msg-1',
          type: 'message',
          role: 'assistant',
          content: [
            {
              type: 'tool_use',
              id: 'tool-1',
              name: 'WRITE', // Uppercase
              input: { file_path: '/src/test.ts', content: 'test' },
            },
            {
              type: 'tool_use',
              id: 'tool-2',
              name: 'bash', // Lowercase
              input: { command: 'echo hello' },
            },
          ],
          model: 'claude-sonnet-4-20250514',
          stop_reason: 'tool_use',
          stop_sequence: null,
          usage: { input_tokens: 100, output_tokens: 50 },
        },
      },
    ];

    const result = detectToolsFromEvents(events);

    expect(result.hasFileModifications).toBe(true);
    expect(result.toolExecutions).toHaveLength(2);
  });
});

describe('Memory Observer Response Parsing', () => {
  /**
   * Simulates parsing the memory observer response
   */
  function parseMemoryObserverResponse(response: string): Array<{
    content: string;
    category: string;
    confidence: string;
  }> {
    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/) ||
                      response.match(/\{[\s\S]*"memories"[\s\S]*\}/);

    if (!jsonMatch) {
      console.warn('[MemoryObserver] No JSON found in response');
      return [];
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];

    try {
      const parsed = JSON.parse(jsonStr);
      return parsed.memories || [];
    } catch (e) {
      console.error('[MemoryObserver] Failed to parse JSON:', e);
      return [];
    }
  }

  it('should parse JSON wrapped in markdown code block', () => {
    const response = `Here is my analysis:

\`\`\`json
{
  "memories": [
    {
      "content": "Created login.ts with JWT authentication",
      "category": "decision",
      "confidence": "high"
    }
  ]
}
\`\`\``;

    const memories = parseMemoryObserverResponse(response);

    expect(memories).toHaveLength(1);
    expect(memories[0].content).toBe('Created login.ts with JWT authentication');
    expect(memories[0].category).toBe('decision');
    expect(memories[0].confidence).toBe('high');
  });

  it('should parse raw JSON response', () => {
    const response = `{
  "memories": [
    {
      "content": "Added React Query dependency",
      "category": "fact",
      "confidence": "high"
    }
  ]
}`;

    const memories = parseMemoryObserverResponse(response);

    expect(memories).toHaveLength(1);
    expect(memories[0].content).toBe('Added React Query dependency');
    expect(memories[0].category).toBe('fact');
  });

  it('should handle empty memories array', () => {
    const response = `\`\`\`json
{
  "memories": []
}
\`\`\``;

    const memories = parseMemoryObserverResponse(response);
    expect(memories).toHaveLength(0);
  });

  it('should handle multiple memories', () => {
    const response = `\`\`\`json
{
  "memories": [
    {
      "content": "Created auth module",
      "category": "decision",
      "confidence": "high"
    },
    {
      "content": "Using JWT for authentication",
      "category": "fact",
      "confidence": "high"
    },
    {
      "content": "Working on user authentication feature",
      "category": "context",
      "confidence": "medium"
    }
  ]
}
\`\`\``;

    const memories = parseMemoryObserverResponse(response);

    expect(memories).toHaveLength(3);
    expect(memories[0].category).toBe('decision');
    expect(memories[1].category).toBe('fact');
    expect(memories[2].category).toBe('context');
  });

  it('should handle malformed response gracefully', () => {
    const response = 'This is not JSON at all';

    const memories = parseMemoryObserverResponse(response);
    expect(memories).toHaveLength(0);
  });

  it('should handle invalid JSON gracefully', () => {
    const response = `\`\`\`json
{
  "memories": [
    { broken json here }
  ]
}
\`\`\``;

    const memories = parseMemoryObserverResponse(response);
    expect(memories).toHaveLength(0);
  });
});

describe('Chat Session Message Structure', () => {
  /**
   * Tests that validate the expected structure of messages in chatSessions
   * This helps ensure tool detection code receives the expected data
   */

  interface MockChatMessage {
    id: string;
    role: string;
    status: string;
    events?: ClaudeEvent[];
    timestamp: number;
    content?: string;
  }

  it('should have events array on streaming messages', () => {
    const message: MockChatMessage = {
      id: 'msg-1',
      role: 'assistant',
      status: 'streaming',
      events: [],
      timestamp: Date.now(),
    };

    expect(message.events).toBeDefined();
    expect(Array.isArray(message.events)).toBe(true);
  });

  it('should accumulate events during streaming', () => {
    const message: MockChatMessage = {
      id: 'msg-1',
      role: 'assistant',
      status: 'streaming',
      events: [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-1',
        } as any,
      ],
      timestamp: Date.now(),
    };

    // Simulate adding more events
    const newEvent: ClaudeEvent = {
      type: 'assistant',
      message: {
        id: 'msg-1',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        model: 'claude-sonnet-4-20250514',
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: 50, output_tokens: 25 },
      },
    };

    message.events!.push(newEvent);

    expect(message.events).toHaveLength(2);
    expect(message.events![1].type).toBe('assistant');
  });

  it('should have complete events when status is complete', () => {
    const message: MockChatMessage = {
      id: 'msg-1',
      role: 'assistant',
      status: 'complete',
      events: [
        {
          type: 'system',
          subtype: 'init',
          session_id: 'session-1',
        } as any,
        {
          type: 'assistant',
          message: {
            id: 'msg-1',
            type: 'message',
            role: 'assistant',
            content: [
              { type: 'text', text: 'Creating file...' },
              {
                type: 'tool_use',
                id: 'tool-1',
                name: 'Write',
                input: { file_path: '/test.ts', content: 'test' },
              },
            ],
            model: 'claude-sonnet-4-20250514',
            stop_reason: 'tool_use',
            stop_sequence: null,
            usage: { input_tokens: 100, output_tokens: 50 },
          },
        },
        {
          type: 'result',
          session_id: 'session-1',
          usage: { input_tokens: 100, output_tokens: 50 },
        } as any,
      ],
      timestamp: Date.now(),
    };

    // Verify the structure matches what tool detection expects
    const events = message.events!;
    const assistantEvents = events.filter((e) => e.type === 'assistant');

    expect(assistantEvents.length).toBeGreaterThan(0);

    const assistantEvent = assistantEvents[0] as any;
    expect(assistantEvent.message).toBeDefined();
    expect(assistantEvent.message.content).toBeDefined();

    // Find tool_use in content
    const toolUse = assistantEvent.message.content.find(
      (c: any) => c.type === 'tool_use'
    );
    expect(toolUse).toBeDefined();
    expect(toolUse.name).toBe('Write');
  });
});
