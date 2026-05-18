import { describe, it, expect } from 'vitest';
import { expandSlashCommands } from '../codexPromptComposer';
import type { SlashCommand } from '../../hooks/useSlashCommands';

const cmd = (name: string, content: string, description = ''): SlashCommand => ({
  name,
  description,
  content,
  isBuiltin: false,
  scope: 'project',
});

describe('expandSlashCommands (Codex prompt composer)', () => {
  it('returns the message untouched when no command is referenced', () => {
    const r = expandSlashCommands('just a normal message', [cmd('code', 'X')]);
    expect(r.commandsFound).toEqual([]);
    expect(r.expandedMessage).toBe('just a normal message');
  });

  it('expands a known command into a <command-context> block before the message', () => {
    const r = expandSlashCommands('/code do the thing', [
      cmd('code', 'CODE BODY', 'coding workflow'),
    ]);
    expect(r.commandsFound).toEqual(['code']);
    expect(r.expandedMessage).toContain('<command-context name="code" description="coding workflow">');
    expect(r.expandedMessage).toContain('CODE BODY');
    expect(r.expandedMessage).toContain('</command-context>');
    expect(r.expandedMessage.trimEnd().endsWith('/code do the thing')).toBe(true);
  });

  it('ignores unknown commands (no matching definition)', () => {
    const r = expandSlashCommands('/unknown hello', [cmd('code', 'X')]);
    expect(r.commandsFound).toEqual([]);
    expect(r.expandedMessage).toBe('/unknown hello');
  });

  it('deduplicates a command referenced multiple times', () => {
    const r = expandSlashCommands('/code a\n/code b', [cmd('code', 'BODY')]);
    expect(r.commandsFound).toEqual(['code']);
    expect(r.expandedMessage.match(/<command-context/g)?.length).toBe(1);
  });

  it('only matches a command at the start of a line (multiline regex)', () => {
    const r = expandSlashCommands('text /code inline', [cmd('code', 'BODY')]);
    expect(r.commandsFound).toEqual([]);
  });

  it('is stateless across calls (regex lastIndex reset)', () => {
    const cmds = [cmd('code', 'BODY')];
    expandSlashCommands('/code first', cmds);
    const r = expandSlashCommands('/code second', cmds);
    expect(r.commandsFound).toEqual(['code']);
  });
});
