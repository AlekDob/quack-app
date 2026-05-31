import { describe, it, expect } from 'vitest';
import { detectClaudeScreenState } from '../utils/agentScreenDetect';

// Minimal renderings of Claude Code's TUI tail (what the xterm buffer holds).
const RULE = '─'.repeat(40);
const idleBox = ['Done.', RULE, '❯ ', RULE].join('\n');

describe('detectClaudeScreenState', () => {
  it('idle: prompt box visible, no activity', () => {
    expect(detectClaudeScreenState(idleBox)).toBe('idle');
  });

  it('working: "esc to interrupt" above the prompt box', () => {
    const screen = ['✻ Pouncing… (esc to interrupt)', RULE, '❯ ', RULE].join('\n');
    expect(detectClaudeScreenState(screen)).toBe('working');
  });

  it('working: spinner glyph + ellipsis verb', () => {
    const screen = ['✶ Processing…', RULE, '❯ ', RULE].join('\n');
    expect(detectClaudeScreenState(screen)).toBe('working');
  });

  it('blocked: plan approval prompt (would you like to proceed)', () => {
    const screen = [
      'Here is the plan.',
      'Would you like to proceed?',
      '❯ 1. Yes',
      '  2. No',
    ].join('\n');
    expect(detectClaudeScreenState(screen)).toBe('blocked');
  });

  it('blocked: bash permission prompt (do you want to proceed + tab to amend)', () => {
    const screen = [
      'Bash command',
      'Do you want to proceed?',
      '❯ 1. Yes',
      '  2. No',
      'tab to amend',
    ].join('\n');
    expect(detectClaudeScreenState(screen)).toBe('blocked');
  });

  it('blocked: yes/no numbered selection (caught by screen)', () => {
    const screen = ['Which option?', '❯ 1. yes, go', '  2. no, stop'].join('\n');
    expect(detectClaudeScreenState(screen)).toBe('blocked');
  });

  it('unknown: generic AskUserQuestion menu (non yes/no) → defer to PreToolUse hook', () => {
    // Same widget as a slash/settings menu — screen must NOT guess. The
    // PreToolUse(AskUserQuestion) hook supplies the blocked state instead.
    const screen = ['Which fruit?', '❯ 1. Apple', '  2. Banana', '  3. Cherry'].join('\n');
    expect(detectClaudeScreenState(screen)).toBe('unknown');
  });

  it('idle: search overlay is never working', () => {
    expect(detectClaudeScreenState('⌕ Search… foo')).toBe('idle');
  });

  it('unknown: empty screen → defer to hooks', () => {
    expect(detectClaudeScreenState('   ')).toBe('unknown');
  });

  it('unknown: foreign program (no Claude prompt box) → never forced to idle/done', () => {
    const codexLike = ['user@host:~/proj$ npm test', 'PASS  3 tests', 'user@host:~/proj$ '].join(
      '\n'
    );
    expect(detectClaudeScreenState(codexLike)).toBe('unknown');
  });
});
