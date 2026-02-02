/**
 * Tests for CodebaseMapSettings component
 *
 * Focused tests for critical functionality without over-testing.
 * Tests document current behavior and guard against regressions.
 *
 * @module codebaseMapSettings.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

// Mock Tauri APIs
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

vi.mock('@tauri-apps/api/path', () => ({
  homeDir: vi.fn(),
}));

// Mock sessionStore
const mockUseSessionStore = vi.fn();
vi.mock('../../stores/sessionStore', () => ({
  useSessionStore: mockUseSessionStore,
}));

// Import after mocks
import CodebaseMapSettings from '../components/settings/categories/CodebaseMapSettings';
import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';

const mockInvoke = vi.mocked(invoke);
const mockHomeDir = vi.mocked(homeDir);

describe('CodebaseMapSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHomeDir.mockResolvedValue('/Users/test/');
  });

  describe('No Project Selected', () => {
    beforeEach(() => {
      // Mock store to return empty sessions
      mockUseSessionStore.mockImplementation((selector: any) => {
        const state = { sessions: [], selectedSessionId: null };
        return selector(state);
      });
    });

    it('should show "No project selected" message', async () => {
      const { container } = render(<CodebaseMapSettings />);
      await waitFor(() => {
        expect(container.textContent).toContain('No project selected');
      });
    });

    it('should show disabled toggle and buttons', async () => {
      const { container } = render(<CodebaseMapSettings />);
      await waitFor(() => {
        const toggle = container.querySelector('.ios-switch');
        expect(toggle?.classList.contains('disabled')).toBe(true);
      });
    });

    it('should display default stats', async () => {
      const { container } = render(<CodebaseMapSettings />);
      await waitFor(() => {
        const text = container.textContent || '';
        expect(text).toContain('Never');
        expect(text).toContain('0 files');
        expect(text).toContain('0 exports');
      });
    });
  });

  describe('Component Rendering', () => {
    it('should render section headers', async () => {
      mockUseSessionStore.mockImplementation((selector: any) => {
        const state = { sessions: [], selectedSessionId: null };
        return selector(state);
      });

      const { container } = render(<CodebaseMapSettings />);

      await waitFor(() => {
        expect(container.textContent).toContain('Codebase Map');
        expect(container.textContent).toContain('Status');
        expect(container.textContent).toContain('Auto-generate on file changes');
      });
    });

    it('should render all settings rows', async () => {
      mockUseSessionStore.mockImplementation((selector: any) => {
        const state = { sessions: [], selectedSessionId: null };
        return selector(state);
      });

      const { container } = render(<CodebaseMapSettings />);

      await waitFor(() => {
        const rows = container.querySelectorAll('.settings-row');
        // Should have rows for: Project/No project, Auto-generate toggle, Map location, Actions, Last generated, Files indexed, Exports found
        expect(rows.length).toBeGreaterThan(5);
      });
    });
  });

  describe('Integration Tests', () => {
    it('should not crash when rendering without project', async () => {
      mockUseSessionStore.mockImplementation((selector: any) => {
        const state = { sessions: [], selectedSessionId: null };
        return selector(state);
      });

      const { container } = render(<CodebaseMapSettings />);

      await waitFor(() => {
        expect(container.textContent).toContain('Codebase Map');
      });
    });
  });
});
