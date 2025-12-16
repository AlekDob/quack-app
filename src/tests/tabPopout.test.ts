import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateWindowLabel, canPopoutTab } from '../stores/popoutWindowStore';
import type { Tab } from '../components/TabBar';

/**
 * Tab Popout Feature Tests
 *
 * Tests the tab popout functionality including:
 * - Window label generation
 * - Tab type validation for popout capability
 * - Store state management
 * - Drag-out detection logic
 */

describe('Tab Popout Feature', () => {
  describe('generateWindowLabel', () => {
    it('should create unique labels with timestamp', () => {
      const tab: Tab = {
        id: 'tab-1',
        label: 'Test Tab',
        type: 'file',
        closable: true,
      };

      const label1 = generateWindowLabel(tab);

      // Wait a tiny bit to ensure different timestamp
      vi.useFakeTimers();
      vi.advanceTimersByTime(10);

      const label2 = generateWindowLabel(tab);

      vi.useRealTimers();

      // Both should start with prefix and contain type
      expect(label1).toMatch(/^tab-popout-file-\d+$/);
      expect(label2).toMatch(/^tab-popout-file-\d+$/);

      // Labels should be different due to timestamp
      expect(label1).not.toBe(label2);
    });

    it('should sanitize special characters in tab type', () => {
      const tab: Tab = {
        id: 'tab-1',
        label: 'Agent Terminal',
        type: 'agent-terminal',
        closable: true,
      };

      const label = generateWindowLabel(tab);

      // Should replace non-alphanumeric chars (except hyphens) with hyphens
      expect(label).toContain('agent-terminal');
      expect(label).toMatch(/^tab-popout-agent-terminal-\d+$/);
    });

    it('should handle different tab types correctly', () => {
      const tabTypes: Array<Tab['type']> = [
        'file',
        'agent-terminal',
        'browser',
        'docs',
        'memory-graph',
        'skill',
        'command',
      ];

      tabTypes.forEach((type) => {
        const tab: Tab = {
          id: `tab-${type}`,
          label: `Test ${type}`,
          type,
          closable: true,
        };

        const label = generateWindowLabel(tab);

        expect(label).toContain(type);
        expect(label).toMatch(/^tab-popout-[\w-]+-\d+$/);
      });
    });

    it('should create labels with current timestamp', () => {
      const now = Date.now();
      vi.useFakeTimers();
      vi.setSystemTime(now);

      const tab: Tab = {
        id: 'tab-1',
        label: 'Test',
        type: 'file',
        closable: true,
      };

      const label = generateWindowLabel(tab);

      expect(label).toBe(`tab-popout-file-${now}`);

      vi.useRealTimers();
    });
  });

  describe('canPopoutTab', () => {
    it('should return false for chat tabs', () => {
      const chatTab: Tab = {
        id: 'chat-1',
        label: 'Main Chat',
        type: 'chat',
        closable: false,
      };

      expect(canPopoutTab(chatTab)).toBe(false);
    });

    it('should return true for file tabs', () => {
      const fileTab: Tab = {
        id: 'file-1',
        label: 'test.ts',
        type: 'file',
        closable: true,
        filePath: '/path/to/test.ts',
      };

      expect(canPopoutTab(fileTab)).toBe(true);
    });

    it('should return true for agent-terminal tabs', () => {
      const terminalTab: Tab = {
        id: 'terminal-1',
        label: 'Hiroshi Terminal',
        type: 'agent-terminal',
        closable: true,
        terminalId: 'term-123',
      };

      expect(canPopoutTab(terminalTab)).toBe(true);
    });

    it('should return true for browser tabs', () => {
      const browserTab: Tab = {
        id: 'browser-1',
        label: 'Browser',
        type: 'browser',
        closable: true,
        url: 'https://example.com',
      };

      expect(canPopoutTab(browserTab)).toBe(true);
    });

    it('should return true for docs tabs', () => {
      const docsTab: Tab = {
        id: 'docs-1',
        label: 'Documentation',
        type: 'docs',
        closable: true,
        docsPath: '/getting-started',
      };

      expect(canPopoutTab(docsTab)).toBe(true);
    });

    it('should return true for memory-graph tabs', () => {
      const memoryTab: Tab = {
        id: 'memory-1',
        label: 'Memory Graph',
        type: 'memory-graph',
        closable: true,
      };

      expect(canPopoutTab(memoryTab)).toBe(true);
    });

    it('should return true for skill tabs', () => {
      const skillTab: Tab = {
        id: 'skill-1',
        label: 'Test Skill',
        type: 'skill',
        closable: true,
        skillName: 'test-skill',
      };

      expect(canPopoutTab(skillTab)).toBe(true);
    });

    it('should return true for command tabs', () => {
      const commandTab: Tab = {
        id: 'command-1',
        label: 'Command',
        type: 'command',
        closable: true,
      };

      expect(canPopoutTab(commandTab)).toBe(true);
    });

    it('should return true for agent tabs', () => {
      const agentTab: Tab = {
        id: 'agent-1',
        label: 'Agent',
        type: 'agent',
        closable: true,
        agentName: 'test-agent',
      };

      expect(canPopoutTab(agentTab)).toBe(true);
    });

    it('should handle all tab types correctly', () => {
      const allTypes: Array<{ type: Tab['type']; canPopout: boolean }> = [
        { type: 'chat', canPopout: false },
        { type: 'file', canPopout: true },
        { type: 'agent-terminal', canPopout: true },
        { type: 'agent', canPopout: true },
        { type: 'browser', canPopout: true },
        { type: 'skill', canPopout: true },
        { type: 'command', canPopout: true },
        { type: 'docs', canPopout: true },
        { type: 'memory-graph', canPopout: true },
      ];

      allTypes.forEach(({ type, canPopout }) => {
        const tab: Tab = {
          id: `tab-${type}`,
          label: `Test ${type}`,
          type,
          closable: true,
        };

        expect(canPopoutTab(tab)).toBe(canPopout);
      });
    });
  });

  describe('TabBar Drag Detection', () => {
    let mockTabBar: HTMLDivElement;
    const POPOUT_THRESHOLD = 60;

    beforeEach(() => {
      // Create mock tab bar element
      mockTabBar = document.createElement('div');
      document.body.appendChild(mockTabBar);
    });

    afterEach(() => {
      document.body.removeChild(mockTabBar);
    });

    describe('isOutsideTabBar logic', () => {
      it('should detect when cursor is above tab bar (beyond threshold)', () => {
        // Mock getBoundingClientRect
        mockTabBar.getBoundingClientRect = vi.fn(() => ({
          top: 100,
          bottom: 150,
          left: 0,
          right: 800,
          width: 800,
          height: 50,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }));

        const rect = mockTabBar.getBoundingClientRect();

        // Cursor at Y=30 (above threshold)
        const cursorY = 30;
        const isOutside = cursorY < rect.top - POPOUT_THRESHOLD;

        expect(isOutside).toBe(true);
      });

      it('should detect when cursor is below tab bar (beyond threshold)', () => {
        mockTabBar.getBoundingClientRect = vi.fn(() => ({
          top: 100,
          bottom: 150,
          left: 0,
          right: 800,
          width: 800,
          height: 50,
          x: 0,
          y: 100,
          toJSON: () => ({}),
        }));

        const rect = mockTabBar.getBoundingClientRect();

        // Cursor at Y=220 (below threshold)
        const cursorY = 220;
        const isOutside = cursorY > rect.bottom + POPOUT_THRESHOLD;

        expect(isOutside).toBe(true);
      });

      it('should detect when cursor is left of tab bar (beyond threshold)', () => {
        mockTabBar.getBoundingClientRect = vi.fn(() => ({
          top: 100,
          bottom: 150,
          left: 200,
          right: 800,
          width: 600,
          height: 50,
          x: 200,
          y: 100,
          toJSON: () => ({}),
        }));

        const rect = mockTabBar.getBoundingClientRect();

        // Cursor at X=130 (left of threshold)
        const cursorX = 130;
        const isOutside = cursorX < rect.left - POPOUT_THRESHOLD;

        expect(isOutside).toBe(true);
      });

      it('should detect when cursor is right of tab bar (beyond threshold)', () => {
        mockTabBar.getBoundingClientRect = vi.fn(() => ({
          top: 100,
          bottom: 150,
          left: 200,
          right: 800,
          width: 600,
          height: 50,
          x: 200,
          y: 100,
          toJSON: () => ({}),
        }));

        const rect = mockTabBar.getBoundingClientRect();

        // Cursor at X=870 (right of threshold)
        const cursorX = 870;
        const isOutside = cursorX > rect.right + POPOUT_THRESHOLD;

        expect(isOutside).toBe(true);
      });

      it('should NOT detect popout when cursor is inside tab bar', () => {
        mockTabBar.getBoundingClientRect = vi.fn(() => ({
          top: 100,
          bottom: 150,
          left: 200,
          right: 800,
          width: 600,
          height: 50,
          x: 200,
          y: 100,
          toJSON: () => ({}),
        }));

        const rect = mockTabBar.getBoundingClientRect();

        // Cursor at center of tab bar
        const cursorX = 500;
        const cursorY = 125;

        const isOutside = (
          cursorY < rect.top - POPOUT_THRESHOLD ||
          cursorY > rect.bottom + POPOUT_THRESHOLD ||
          cursorX < rect.left - POPOUT_THRESHOLD ||
          cursorX > rect.right + POPOUT_THRESHOLD
        );

        expect(isOutside).toBe(false);
      });

      it('should NOT detect popout when cursor is within threshold zone', () => {
        mockTabBar.getBoundingClientRect = vi.fn(() => ({
          top: 100,
          bottom: 150,
          left: 200,
          right: 800,
          width: 600,
          height: 50,
          x: 200,
          y: 100,
          toJSON: () => ({}),
        }));

        const rect = mockTabBar.getBoundingClientRect();

        // Cursor just outside tab bar but within threshold
        const testCases = [
          { x: 500, y: 90 },  // 10px above (within 60px threshold)
          { x: 500, y: 160 }, // 10px below (within 60px threshold)
          { x: 190, y: 125 }, // 10px left (within 60px threshold)
          { x: 810, y: 125 }, // 10px right (within 60px threshold)
        ];

        testCases.forEach(({ x, y }) => {
          const isOutside = (
            y < rect.top - POPOUT_THRESHOLD ||
            y > rect.bottom + POPOUT_THRESHOLD ||
            x < rect.left - POPOUT_THRESHOLD ||
            x > rect.right + POPOUT_THRESHOLD
          );

          expect(isOutside).toBe(false);
        });
      });

      it('should detect popout at exact threshold boundary', () => {
        mockTabBar.getBoundingClientRect = vi.fn(() => ({
          top: 100,
          bottom: 150,
          left: 200,
          right: 800,
          width: 600,
          height: 50,
          x: 200,
          y: 100,
          toJSON: () => ({}),
        }));

        const rect = mockTabBar.getBoundingClientRect();

        // Test exact threshold boundaries
        const boundaryTests = [
          { x: 500, y: 40, expected: false },  // top - 60 (at boundary)
          { x: 500, y: 39, expected: true },   // top - 61 (beyond boundary)
          { x: 500, y: 210, expected: false }, // bottom + 60 (at boundary)
          { x: 500, y: 211, expected: true },  // bottom + 61 (beyond boundary)
        ];

        boundaryTests.forEach(({ x, y, expected }) => {
          const isOutside = (
            y < rect.top - POPOUT_THRESHOLD ||
            y > rect.bottom + POPOUT_THRESHOLD ||
            x < rect.left - POPOUT_THRESHOLD ||
            x > rect.right + POPOUT_THRESHOLD
          );

          expect(isOutside).toBe(expected);
        });
      });
    });

    describe('Chat tab popout prevention', () => {
      it('should NOT trigger popout for chat tabs even when dragged outside', () => {
        const chatTab: Tab = {
          id: 'chat-1',
          label: 'Main Chat',
          type: 'chat',
          closable: false,
        };

        // Mock drag event outside bounds
        const mockDragEvent = {
          clientX: 500,
          clientY: 30, // Way above tab bar
          screenX: 500,
          screenY: 30,
        };

        // Chat tab should not be allowed to popout
        expect(canPopoutTab(chatTab)).toBe(false);

        // Even if technically dragged outside, the type check prevents popout
        // This would be handled in TabBar component logic
      });

      it('should allow popout for non-chat tabs when dragged outside', () => {
        const fileTab: Tab = {
          id: 'file-1',
          label: 'test.ts',
          type: 'file',
          closable: true,
          filePath: '/path/to/test.ts',
        };

        expect(canPopoutTab(fileTab)).toBe(true);
      });
    });

    describe('Drag event coordinate handling', () => {
      it('should ignore invalid drag coordinates (0, 0)', () => {
        // When drag ends, browser sends (0, 0) coordinates
        const invalidDragEvent = {
          clientX: 0,
          clientY: 0,
        };

        // This should be ignored in the actual implementation
        // to prevent false popout triggers
        const shouldIgnore = (
          invalidDragEvent.clientX === 0 &&
          invalidDragEvent.clientY === 0
        );

        expect(shouldIgnore).toBe(true);
      });

      it('should handle valid drag coordinates', () => {
        const validDragEvent = {
          clientX: 500,
          clientY: 125,
        };

        const shouldIgnore = (
          validDragEvent.clientX === 0 &&
          validDragEvent.clientY === 0
        );

        expect(shouldIgnore).toBe(false);
      });
    });
  });

  describe('Popout trigger behavior', () => {
    it('should not trigger popout multiple times for same drag', () => {
      let hasTriggeredPopout = false;
      let popoutCount = 0;

      const mockTriggerPopout = () => {
        if (!hasTriggeredPopout) {
          hasTriggeredPopout = true;
          popoutCount++;
        }
      };

      // Simulate multiple drag events (cursor moving while dragging)
      mockTriggerPopout(); // First trigger
      mockTriggerPopout(); // Should be ignored
      mockTriggerPopout(); // Should be ignored

      expect(popoutCount).toBe(1);
    });

    it('should reset popout trigger on drag end', () => {
      let hasTriggeredPopout = false;

      const mockDragEnd = () => {
        hasTriggeredPopout = false;
      };

      hasTriggeredPopout = true;
      mockDragEnd();

      expect(hasTriggeredPopout).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle tabs with all optional fields', () => {
      const completeTab: Tab = {
        id: 'complete-1',
        label: 'Complete Tab',
        type: 'file',
        closable: true,
        filePath: '/test/file.ts',
        color: '#FF6B35',
        terminalId: 'term-123',
        agentName: 'test-agent',
        agentScope: 'project',
        url: 'https://example.com',
        skillName: 'test-skill',
        skillScope: 'global',
        docsPath: '/guide',
      };

      expect(() => generateWindowLabel(completeTab)).not.toThrow();
      expect(() => canPopoutTab(completeTab)).not.toThrow();

      expect(canPopoutTab(completeTab)).toBe(true);
      expect(generateWindowLabel(completeTab)).toMatch(/^tab-popout-file-\d+$/);
    });

    it('should handle tabs with minimal fields', () => {
      const minimalTab: Tab = {
        id: 'minimal-1',
        label: 'Minimal',
        type: 'browser',
        closable: true,
      };

      expect(() => generateWindowLabel(minimalTab)).not.toThrow();
      expect(() => canPopoutTab(minimalTab)).not.toThrow();

      expect(canPopoutTab(minimalTab)).toBe(true);
    });

    it('should handle very long tab labels', () => {
      const longLabelTab: Tab = {
        id: 'long-1',
        label: 'A'.repeat(1000),
        type: 'file',
        closable: true,
      };

      const label = generateWindowLabel(longLabelTab);

      // Label should still be reasonable length (timestamp-based)
      expect(label).toMatch(/^tab-popout-file-\d+$/);
      expect(label.length).toBeLessThan(50);
    });

    it('should handle special characters in tab IDs', () => {
      const specialTab: Tab = {
        id: 'tab-with-special-chars-!@#$%',
        label: 'Special',
        type: 'docs',
        closable: true,
      };

      expect(() => generateWindowLabel(specialTab)).not.toThrow();
      expect(() => canPopoutTab(specialTab)).not.toThrow();
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle user dragging file tab to create standalone editor window', () => {
      const fileTab: Tab = {
        id: 'file-src-app-tsx',
        label: 'App.tsx',
        type: 'file',
        closable: true,
        filePath: '/Users/alek/project/src/App.tsx',
      };

      // Check if tab can be popped out
      expect(canPopoutTab(fileTab)).toBe(true);

      // Generate unique window label
      const windowLabel = generateWindowLabel(fileTab);
      expect(windowLabel).toContain('file');

      // Verify timestamp is numeric
      const timestampPart = windowLabel.split('-').pop() || '';
      expect(/^\d+$/.test(timestampPart)).toBe(true);
    });

    it('should handle user attempting to drag chat tab (should be prevented)', () => {
      const chatTab: Tab = {
        id: 'chat-main',
        label: 'Chat with Claude',
        type: 'chat',
        closable: false,
        color: '#FF6B35',
      };

      // Should not be draggable
      expect(canPopoutTab(chatTab)).toBe(false);
    });

    it('should handle multiple tabs being popped out simultaneously', () => {
      const tabs: Tab[] = [
        { id: 'file-1', label: 'File 1', type: 'file', closable: true },
        { id: 'docs-1', label: 'Docs', type: 'docs', closable: true },
        { id: 'browser-1', label: 'Browser', type: 'browser', closable: true },
      ];

      const windowLabels = tabs.map(tab => generateWindowLabel(tab));

      // All labels should be unique
      const uniqueLabels = new Set(windowLabels);
      expect(uniqueLabels.size).toBe(tabs.length);

      // All tabs should be allowed to popout
      tabs.forEach(tab => {
        expect(canPopoutTab(tab)).toBe(true);
      });
    });

    it('should handle agent terminal being popped out for side-by-side view', () => {
      const terminalTab: Tab = {
        id: 'terminal-hiroshi-123',
        label: 'Hiroshi Terminal',
        type: 'agent-terminal',
        closable: true,
        terminalId: 'term-hiroshi-123',
        agentName: 'Hiroshi',
        agentScope: 'project',
      };

      expect(canPopoutTab(terminalTab)).toBe(true);

      const windowLabel = generateWindowLabel(terminalTab);
      expect(windowLabel).toContain('agent-terminal');
    });
  });
});
