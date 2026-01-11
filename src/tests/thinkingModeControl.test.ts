/**
 * Tests for thinking mode control via prompt parsing
 *
 * Bug: User cannot exit thinking mode by saying "esci dal thinking"
 * Fix: Parse prompt BEFORE sending to detect control patterns
 */

import { describe, it, expect } from 'vitest';
import { parseThinkingControl, ThinkingMode } from '../hooks/useClaudeChat';

describe('parseThinkingControl', () => {
  describe('disable thinking patterns (Italian)', () => {
    it('should disable thinking with "esci dal thinking"', () => {
      const result = parseThinkingControl('esci dal thinking', 'think');
      expect(result).toBe('auto');
    });

    it('should disable thinking with "esci thinking"', () => {
      const result = parseThinkingControl('esci thinking', 'hard');
      expect(result).toBe('auto');
    });

    it('should disable thinking with "disattiva thinking"', () => {
      const result = parseThinkingControl('disattiva thinking', 'ultra');
      expect(result).toBe('auto');
    });
  });

  describe('disable thinking patterns (English)', () => {
    it('should disable thinking with "no thinking"', () => {
      const result = parseThinkingControl('no thinking please', 'think');
      expect(result).toBe('auto');
    });

    it('should disable thinking with "stop thinking"', () => {
      const result = parseThinkingControl('stop thinking', 'harder');
      expect(result).toBe('auto');
    });

    it('should disable thinking with "disable thinking"', () => {
      const result = parseThinkingControl('disable thinking', 'think');
      expect(result).toBe('auto');
    });

    it('should disable thinking with "turn off thinking"', () => {
      const result = parseThinkingControl('turn off thinking', 'think');
      expect(result).toBe('auto');
    });

    it('should disable thinking with "standard mode"', () => {
      const result = parseThinkingControl('use standard mode', 'ultra');
      expect(result).toBe('auto');
    });

    it('should disable thinking with "normal mode"', () => {
      const result = parseThinkingControl('switch to normal mode', 'think');
      expect(result).toBe('auto');
    });
  });

  describe('disable thinking slash commands', () => {
    it('should disable thinking with "/thinking off"', () => {
      const result = parseThinkingControl('/thinking off', 'think');
      expect(result).toBe('auto');
    });

    it('should disable thinking with "/thinking disable"', () => {
      const result = parseThinkingControl('/thinking disable', 'hard');
      expect(result).toBe('auto');
    });

    it('should disable thinking with "/thinking no"', () => {
      const result = parseThinkingControl('/thinking no', 'think');
      expect(result).toBe('auto');
    });

    it('should disable thinking with "/thinking 0"', () => {
      const result = parseThinkingControl('/thinking 0', 'ultra');
      expect(result).toBe('auto');
    });
  });

  describe('enable thinking patterns (Italian)', () => {
    it('should enable thinking with "attiva thinking"', () => {
      const result = parseThinkingControl('attiva thinking', 'auto');
      expect(result).toBe('think');
    });

    it('should enable thinking with "usa thinking"', () => {
      const result = parseThinkingControl('usa thinking per questo', 'auto');
      expect(result).toBe('think');
    });
  });

  describe('enable thinking patterns (English)', () => {
    it('should enable thinking with "start thinking"', () => {
      const result = parseThinkingControl('start thinking', 'auto');
      expect(result).toBe('think');
    });

    it('should enable thinking with "enable thinking"', () => {
      const result = parseThinkingControl('enable thinking', 'auto');
      expect(result).toBe('think');
    });

    it('should enable thinking with "turn on thinking"', () => {
      const result = parseThinkingControl('turn on thinking', 'auto');
      expect(result).toBe('think');
    });

    it('should enable thinking with "think mode"', () => {
      const result = parseThinkingControl('use think mode', 'auto');
      expect(result).toBe('think');
    });
  });

  describe('enable thinking slash commands', () => {
    it('should enable thinking with "/thinking on"', () => {
      const result = parseThinkingControl('/thinking on', 'auto');
      expect(result).toBe('think');
    });

    it('should enable thinking with "/thinking enable"', () => {
      const result = parseThinkingControl('/thinking enable', 'auto');
      expect(result).toBe('think');
    });

    it('should enable thinking with "/thinking 1"', () => {
      const result = parseThinkingControl('/thinking 1', 'auto');
      expect(result).toBe('think');
    });
  });

  describe('no control pattern - keep current mode', () => {
    it('should keep current mode when no pattern matches', () => {
      const result = parseThinkingControl('Hello, how are you?', 'think');
      expect(result).toBe('think');
    });

    it('should keep auto mode when no pattern matches', () => {
      const result = parseThinkingControl('Write some code', 'auto');
      expect(result).toBe('auto');
    });

    it('should keep ultra mode when no pattern matches', () => {
      const result = parseThinkingControl('Analyze this complex problem', 'ultra');
      expect(result).toBe('ultra');
    });

    it('should not match partial words like "thinking about"', () => {
      // "thinking about" should NOT trigger because patterns require
      // specific phrases like "thinking on/off/enable/disable"
      const result = parseThinkingControl('I was thinking about this', 'auto');
      expect(result).toBe('auto');
    });
  });

  describe('case insensitivity', () => {
    it('should work with uppercase', () => {
      const result = parseThinkingControl('ESCI DAL THINKING', 'think');
      expect(result).toBe('auto');
    });

    it('should work with mixed case', () => {
      const result = parseThinkingControl('Disable Thinking', 'hard');
      expect(result).toBe('auto');
    });
  });

  describe('embedded in longer text', () => {
    it('should detect pattern at start of sentence', () => {
      const result = parseThinkingControl('esci dal thinking, voglio risposte veloci', 'think');
      expect(result).toBe('auto');
    });

    it('should detect pattern at end of sentence', () => {
      const result = parseThinkingControl('per favore stop thinking', 'think');
      expect(result).toBe('auto');
    });

    it('should detect pattern in middle of sentence', () => {
      const result = parseThinkingControl('ok now disable thinking please', 'hard');
      expect(result).toBe('auto');
    });
  });
});
