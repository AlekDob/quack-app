import { describe, it, expect } from 'vitest';
import { quackEventToClaudeEvents } from '../codexEventAdapter';

describe('quackEventToClaudeEvents', () => {
  // --- session_started ---

  it('maps session_started to a system/init event with session_id and model', () => {
    const result = quackEventToClaudeEvents({
      kind: 'session_started',
      backend_session_id: 'bsid-001',
      model: 'codex-mini',
      backend: 'codex',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'system',
      subtype: 'init',
      session_id: 'bsid-001',
      model: 'codex-mini',
    });
  });

  it('maps session_started with null model — omits model field', () => {
    const result = quackEventToClaudeEvents({
      kind: 'session_started',
      backend_session_id: 'bsid-002',
      model: null,
      backend: 'codex',
    });

    expect(result).toHaveLength(1);
    const ev = result[0] as { type: string; model?: string };
    expect(ev.type).toBe('system');
    expect(ev.model).toBeUndefined();
  });

  // --- text_delta ---

  it('maps text_delta to an assistant event with a text content block', () => {
    const result = quackEventToClaudeEvents(
      { kind: 'text_delta', content: 'Hello world' },
      0,
    );

    expect(result).toHaveLength(1);
    const ev = result[0] as { type: string; message: { id: string; content: unknown[] } };
    expect(ev.type).toBe('assistant');
    expect(ev.message.content).toEqual([{ type: 'text', text: 'Hello world' }]);
    expect(typeof ev.message.id).toBe('string');
    expect(ev.message.id.length).toBeGreaterThan(0);
  });

  it('text_delta produces deterministic id given same seq', () => {
    const a = quackEventToClaudeEvents({ kind: 'text_delta', content: 'Hi' }, 3);
    const b = quackEventToClaudeEvents({ kind: 'text_delta', content: 'Hi' }, 3);
    const msgA = a[0] as { message: { id: string } };
    const msgB = b[0] as { message: { id: string } };
    expect(msgA.message.id).toBe(msgB.message.id);
  });

  it('text_delta with different seq produces different ids', () => {
    const a = quackEventToClaudeEvents({ kind: 'text_delta', content: 'Same text' }, 1);
    const b = quackEventToClaudeEvents({ kind: 'text_delta', content: 'Same text' }, 2);
    const msgA = a[0] as { message: { id: string } };
    const msgB = b[0] as { message: { id: string } };
    expect(msgA.message.id).not.toBe(msgB.message.id);
  });

  // --- tool_call_start ---

  it('maps tool_call_start to an assistant event with tool_use content block', () => {
    const result = quackEventToClaudeEvents({
      kind: 'tool_call_start',
      id: 'tool-xyz',
      name: 'Bash',
      args: { command: 'ls -la' },
    });

    expect(result).toHaveLength(1);
    const ev = result[0] as {
      type: string;
      message: { id: string; content: Array<{ type: string; id: string; name: string; input: unknown }> };
    };
    expect(ev.type).toBe('assistant');
    expect(ev.message.content).toEqual([
      { type: 'tool_use', id: 'tool-xyz', name: 'Bash', input: { command: 'ls -la' } },
    ]);
    expect(ev.message.id).toBe('tool-xyz');
  });

  it('tool_call_start with non-object args coerces to {}', () => {
    const result = quackEventToClaudeEvents({
      kind: 'tool_call_start',
      id: 'tool-abc',
      name: 'ReadFile',
      args: 'invalid-string-args',
    });

    const ev = result[0] as { message: { content: Array<{ input: unknown }> } };
    expect(ev.message.content[0].input).toEqual({});
  });

  it('tool_call_start with null args coerces to {}', () => {
    const result = quackEventToClaudeEvents({
      kind: 'tool_call_start',
      id: 'tool-def',
      name: 'ReadFile',
      args: null,
    });

    const ev = result[0] as { message: { content: Array<{ input: unknown }> } };
    expect(ev.message.content[0].input).toEqual({});
  });

  // --- tool_call_end ---

  it('maps tool_call_end (no error) to a user event with tool_result', () => {
    const result = quackEventToClaudeEvents({
      kind: 'tool_call_end',
      id: 'tool-xyz',
      output: 'file.txt\nfoo.rs',
      error: null,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'user',
      message: {
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool-xyz',
            content: 'file.txt\nfoo.rs',
            is_error: false,
          },
        ],
      },
    });
  });

  it('maps tool_call_end with error to is_error:true', () => {
    const result = quackEventToClaudeEvents({
      kind: 'tool_call_end',
      id: 'tool-fail',
      output: '',
      error: 'command not found',
    });

    const ev = result[0] as { message: { content: Array<{ is_error: boolean }> } };
    expect(ev.message.content[0].is_error).toBe(true);
  });

  // --- usage ---

  it('maps usage to a result event with UsageStats and cost', () => {
    const result = quackEventToClaudeEvents({
      kind: 'usage',
      input_tokens: 100,
      output_tokens: 50,
      cached_tokens: 30,
      cost_usd: 0.002,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'result',
      usage: {
        input_tokens: 100,
        output_tokens: 50,
        cache_read_input_tokens: 30,
        cache_creation_input_tokens: 0,
      },
      cost_usd: 0.002,
      total_cost_usd: 0.002,
    });
  });

  it('maps usage with null cost_usd — omits cost fields', () => {
    const result = quackEventToClaudeEvents({
      kind: 'usage',
      input_tokens: 10,
      output_tokens: 5,
      cached_tokens: 0,
      cost_usd: null,
    });

    const ev = result[0] as { cost_usd?: number; total_cost_usd?: number };
    expect(ev.cost_usd).toBeUndefined();
    expect(ev.total_cost_usd).toBeUndefined();
  });

  // --- error ---

  it('maps error to a ClaudeErrorEvent', () => {
    const result = quackEventToClaudeEvents({
      kind: 'error',
      code: 'TIMEOUT',
      message: 'Request timed out',
      recoverable: false,
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'error',
      error: 'Request timed out',
      code: 'TIMEOUT',
    });
  });

  // --- session_ended ---

  it('maps session_ended to a synthesized result event (end-of-turn marker)', () => {
    const result = quackEventToClaudeEvents({
      kind: 'session_ended',
      reason: 'completed',
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      type: 'result',
      is_error: false,
    });
  });
});
