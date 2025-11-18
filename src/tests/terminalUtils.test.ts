import { describe, it, expect, vi } from 'vitest';
import {
  TERMINAL_COLORS,
  ANSI_REGEX,
  OSC_REGEX,
  PROMPT_REGEX,
  normalizeKey,
  slugify,
  stripAnsi,
  chunkContainsPrompt,
  debounce,
  getRandomTerminalColor,
  getTerminalColorByIndex,
} from '../utils/terminalUtils';

describe('terminalUtils', () => {
  describe('Constants', () => {
    it('should export terminal color palette', () => {
      expect(TERMINAL_COLORS).toBeDefined();
      expect(TERMINAL_COLORS).toHaveLength(7);
      expect(TERMINAL_COLORS[0]).toBe('#f28c52');
    });

    it('should export regex patterns', () => {
      expect(ANSI_REGEX).toBeInstanceOf(RegExp);
      expect(OSC_REGEX).toBeInstanceOf(RegExp);
      expect(PROMPT_REGEX).toBeInstanceOf(RegExp);
    });
  });

  describe('normalizeKey', () => {
    it('should trim and lowercase strings', () => {
      expect(normalizeKey('  Hello World  ')).toBe('hello world');
    });

    it('should handle empty strings', () => {
      expect(normalizeKey('')).toBe('');
      expect(normalizeKey('   ')).toBe('');
    });

    it('should handle special characters', () => {
      expect(normalizeKey('USER@123')).toBe('user@123');
    });

    it('should handle unicode', () => {
      expect(normalizeKey('  Привет  ')).toBe('привет');
    });
  });

  describe('slugify', () => {
    it('should create URL-safe slugs', () => {
      expect(slugify('Hello World')).toBe('hello-world');
      expect(slugify('User@123')).toBe('user-123');
    });

    it('should remove consecutive special chars', () => {
      expect(slugify('Hello!!!World')).toBe('hello-world');
      expect(slugify('test---slug')).toBe('test-slug');
    });

    it('should handle empty strings', () => {
      expect(slugify('')).toBe('');
    });

    it('should handle only special chars', () => {
      expect(slugify('!!!')).toBe('-');
    });

    it('should handle leading/trailing special chars', () => {
      expect(slugify('!!!test!!!')).toBe('-test-');
    });
  });

  describe('stripAnsi', () => {
    it('should remove ANSI color codes', () => {
      const input = '\x1B[31mRed Text\x1B[0m';
      const expected = 'Red Text';
      expect(stripAnsi(input)).toBe(expected);
    });

    it('should remove OSC sequences', () => {
      const input = '\x1B]0;Window Title\x07';
      const expected = '';
      expect(stripAnsi(input)).toBe(expected);
    });

    it('should handle text without ANSI codes', () => {
      const input = 'Plain text';
      expect(stripAnsi(input)).toBe(input);
    });

    it('should handle empty strings', () => {
      expect(stripAnsi('')).toBe('');
    });

    it('should handle multiple ANSI sequences', () => {
      const input = '\x1B[31mRed\x1B[0m and \x1B[32mGreen\x1B[0m';
      const expected = 'Red and Green';
      expect(stripAnsi(input)).toBe(expected);
    });

    it('should handle mixed OSC and ANSI', () => {
      const input = '\x1B]0;Title\x07\x1B[31mText\x1B[0m';
      const expected = 'Text';
      expect(stripAnsi(input)).toBe(expected);
    });
  });

  describe('chunkContainsPrompt', () => {
    it('should detect dollar sign prompt', () => {
      expect(chunkContainsPrompt('user@host:~$ ')).toBe(true);
      expect(chunkContainsPrompt('$ ')).toBe(true);
    });

    it('should detect hash prompt (root)', () => {
      expect(chunkContainsPrompt('root@host:~# ')).toBe(true);
      expect(chunkContainsPrompt('# ')).toBe(true);
    });

    it('should detect percent prompt (zsh)', () => {
      expect(chunkContainsPrompt('user@host ~% ')).toBe(true);
      expect(chunkContainsPrompt('% ')).toBe(true);
    });

    it('should detect arrow prompts', () => {
      expect(chunkContainsPrompt('> ')).toBe(true);
      expect(chunkContainsPrompt('❯ ')).toBe(true);
      expect(chunkContainsPrompt('| ')).toBe(true);
    });

    it('should handle ANSI codes in prompt', () => {
      const input = '\x1B[32muser@host\x1B[0m:~$ ';
      expect(chunkContainsPrompt(input)).toBe(true);
    });

    it('should handle multiline output with prompt', () => {
      const input = 'command output\nmore output\nuser@host:~$ ';
      expect(chunkContainsPrompt(input)).toBe(true);
    });

    it('should not detect prompt in middle of line', () => {
      expect(chunkContainsPrompt('$ some text after')).toBe(false);
    });

    it('should not detect non-prompt text', () => {
      expect(chunkContainsPrompt('regular output')).toBe(false);
      expect(chunkContainsPrompt('command output\n')).toBe(false);
    });

    it('should handle empty string', () => {
      expect(chunkContainsPrompt('')).toBe(false);
    });

    it('should handle only whitespace', () => {
      expect(chunkContainsPrompt('   \n  ')).toBe(false);
    });

    it('should handle carriage returns', () => {
      const input = 'line1\r\nline2\r\nuser@host:~$ ';
      expect(chunkContainsPrompt(input)).toBe(true);
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced();
      debounced();

      expect(fn).not.toHaveBeenCalled();

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should pass arguments to debounced function', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 50);

      debounced('arg1', 'arg2');

      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('should cancel pending execution', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      debounced.cancel();

      await new Promise((resolve) => setTimeout(resolve, 150));
      expect(fn).not.toHaveBeenCalled();
    });

    it('should reset timer on subsequent calls', async () => {
      const fn = vi.fn();
      const debounced = debounce(fn, 100);

      debounced();
      await new Promise((resolve) => setTimeout(resolve, 50));
      debounced(); // Reset timer
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(fn).not.toHaveBeenCalled(); // Still waiting

      await new Promise((resolve) => setTimeout(resolve, 60));
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('getRandomTerminalColor', () => {
    it('should return a color from the palette', () => {
      const color = getRandomTerminalColor();
      expect(TERMINAL_COLORS).toContain(color);
    });

    it('should return hex color format', () => {
      const color = getRandomTerminalColor();
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });

    it('should potentially return different colors (randomness check)', () => {
      // Generate 20 colors, expect at least 2 different ones (99.9% chance)
      const colors = new Set();
      for (let i = 0; i < 20; i++) {
        colors.add(getRandomTerminalColor());
      }
      expect(colors.size).toBeGreaterThan(1);
    });
  });

  describe('getTerminalColorByIndex', () => {
    it('should return first color for index 0', () => {
      expect(getTerminalColorByIndex(0)).toBe(TERMINAL_COLORS[0]);
    });

    it('should return colors sequentially', () => {
      expect(getTerminalColorByIndex(0)).toBe(TERMINAL_COLORS[0]);
      expect(getTerminalColorByIndex(1)).toBe(TERMINAL_COLORS[1]);
      expect(getTerminalColorByIndex(2)).toBe(TERMINAL_COLORS[2]);
    });

    it('should wrap around when index exceeds palette size', () => {
      expect(getTerminalColorByIndex(7)).toBe(TERMINAL_COLORS[0]); // Wraps
      expect(getTerminalColorByIndex(8)).toBe(TERMINAL_COLORS[1]); // Wraps
    });

    it('should handle large indices', () => {
      expect(getTerminalColorByIndex(100)).toBe(TERMINAL_COLORS[100 % 7]);
    });

    it('should return hex color format', () => {
      const color = getTerminalColorByIndex(0);
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    });
  });
});
