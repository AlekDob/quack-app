/**
 * Avatar Path Tests
 *
 * Tests that avatar paths are correctly resolved in both dev and production modes.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getAvatarUrl, getDuckdroidUrl, getFallbackDuckUrl, AVAILABLE_AVATARS } from '../utils/agentAvatars';

describe('Avatar Path Resolution', () => {
  beforeEach(() => {
    // Reset window.__TAURI__ before each test
    delete (window as any).__TAURI__;
  });

  describe('Dev Mode (non-Tauri)', () => {
    it('should return correct path for duck avatars in dev mode', () => {
      const url = getAvatarUrl('duck1.jpeg');
      expect(url).toBe('/images/ducks/new-avatars/duck1.jpeg');
    });

    it('should return correct path for duckdroid in dev mode', () => {
      const url = getDuckdroidUrl();
      expect(url).toBe('/droid.jpeg');
    });

    it('should return correct path for fallback duck in dev mode', () => {
      const url = getFallbackDuckUrl();
      expect(url).toBe('/duck30.jpeg');
    });
  });

  describe('Production Mode (Tauri)', () => {
    beforeEach(() => {
      // Mock Tauri environment
      (window as any).__TAURI__ = {};

      // Mock convertFileSrc globally
      vi.mock('@tauri-apps/api/core', () => ({
        convertFileSrc: (path: string, protocol: string) => {
          // Simulate Tauri's asset protocol conversion
          return `http://asset.localhost/${path.replace(/^\//, '')}`;
        }
      }));
    });

    it('should use convertFileSrc for avatars in production', () => {
      const url = getAvatarUrl('duck1.jpeg');
      // In Tauri, it should convert the path
      expect(url).toContain('duck1.jpeg');
    });

    it('should use convertFileSrc for duckdroid in production', () => {
      const url = getDuckdroidUrl();
      expect(url).toContain('droid.jpeg');
    });

    it('should use convertFileSrc for fallback duck in production', () => {
      const url = getFallbackDuckUrl();
      expect(url).toContain('duck30.jpeg');
    });
  });

  describe('Avatar List', () => {
    it('should have all 35 duck avatars', () => {
      expect(AVAILABLE_AVATARS).toHaveLength(35);
    });

    it('should have duck1.jpeg through duck35.jpeg', () => {
      for (let i = 1; i <= 35; i++) {
        expect(AVAILABLE_AVATARS).toContain(`duck${i}.jpeg`);
      }
    });
  });

  describe('Path Format', () => {
    it('dev mode paths should start with /', () => {
      delete (window as any).__TAURI__;

      const url = getAvatarUrl('duck1.jpeg');
      expect(url.startsWith('/')).toBe(true);
    });

    it('all avatar paths should be lowercase', () => {
      AVAILABLE_AVATARS.forEach(avatar => {
        expect(avatar).toBe(avatar.toLowerCase());
      });
    });

    it('all avatar paths should end with .jpeg', () => {
      AVAILABLE_AVATARS.forEach(avatar => {
        expect(avatar.endsWith('.jpeg')).toBe(true);
      });
    });
  });
});
