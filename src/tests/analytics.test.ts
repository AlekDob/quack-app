import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getFileType,
  createPerformanceMetric,
  createErrorEvent,
  createFeatureEvent,
  FeatureCategories,
  SessionTracker,
  createDebouncedTracker,
  withTiming,
} from '../utils/analytics';

describe('Analytics Utilities', () => {
  describe('getFileType', () => {
    it('should extract file extension from path', () => {
      expect(getFileType('/path/to/file.ts')).toBe('ts');
      expect(getFileType('/path/to/file.tsx')).toBe('tsx');
      expect(getFileType('/path/to/file.json')).toBe('json');
      expect(getFileType('file.md')).toBe('md');
    });

    it('should handle files without extension', () => {
      expect(getFileType('/path/to/Dockerfile')).toBe('dockerfile');
      expect(getFileType('README')).toBe('readme');
    });

    it('should handle multiple dots in filename', () => {
      expect(getFileType('/path/to/file.test.ts')).toBe('ts');
      expect(getFileType('component.spec.tsx')).toBe('tsx');
    });

    it('should return lowercase extension', () => {
      expect(getFileType('/path/to/FILE.TS')).toBe('ts');
      expect(getFileType('README.MD')).toBe('md');
    });
  });

  describe('createPerformanceMetric', () => {
    it('should create performance metric object', () => {
      const metric = createPerformanceMetric('api_response', 150, 'ms');

      expect(metric).toEqual({
        metric: 'api_response',
        value: 150,
        unit: 'ms',
      });
    });

    it('should default to ms unit', () => {
      const metric = createPerformanceMetric('load_time', 500);

      expect(metric.unit).toBe('ms');
    });
  });

  describe('createErrorEvent', () => {
    it('should create error event from Error object', () => {
      const error = new Error('Test error message');
      const event = createErrorEvent(error, 'TestComponent');

      expect(event.errorType).toBe('Error');
      expect(event.errorMessage).toBe('Test error message');
      expect(event.component).toBe('TestComponent');
    });

    it('should handle custom error types', () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = 'CustomError';
        }
      }

      const error = new CustomError('Custom error');
      const event = createErrorEvent(error);

      expect(event.errorType).toBe('CustomError');
    });

    it('should handle non-Error objects', () => {
      const event = createErrorEvent('String error');

      expect(event.errorType).toBe('Error');
      expect(event.errorMessage).toBe('String error');
    });

    it('should sanitize file paths in error messages', () => {
      const error = new Error('Failed to load /Users/johndoe/secret/file.ts');
      const event = createErrorEvent(error);

      expect(event.errorMessage).not.toContain('johndoe');
      expect(event.errorMessage).toContain('[USER]');
    });

    it('should redact potential API keys', () => {
      const error = new Error('API key: abc123def456ghi789jkl012mno345pqr');
      const event = createErrorEvent(error);

      expect(event.errorMessage).toContain('[REDACTED]');
    });

    it('should truncate long error messages', () => {
      const longMessage = 'x'.repeat(500);
      const error = new Error(longMessage);
      const event = createErrorEvent(error);

      expect(event.errorMessage.length).toBeLessThanOrEqual(203); // 200 + '...'
    });
  });

  describe('createFeatureEvent', () => {
    it('should create feature event with category', () => {
      const event = createFeatureEvent('open_file', FeatureCategories.FILE_EXPLORER);

      expect(event).toEqual({
        feature: 'open_file',
        context: 'file_explorer',
      });
    });

    it('should create feature event without category', () => {
      const event = createFeatureEvent('custom_action');

      expect(event).toEqual({
        feature: 'custom_action',
        context: undefined,
      });
    });
  });

  describe('FeatureCategories', () => {
    it('should have all expected categories', () => {
      expect(FeatureCategories.TERMINAL).toBe('terminal');
      expect(FeatureCategories.AI_ASSISTANT).toBe('ai_assistant');
      expect(FeatureCategories.FILE_EXPLORER).toBe('file_explorer');
      expect(FeatureCategories.GIT).toBe('git');
      expect(FeatureCategories.EDITOR).toBe('editor');
      expect(FeatureCategories.SETTINGS).toBe('settings');
      expect(FeatureCategories.MARKETPLACE).toBe('marketplace');
      expect(FeatureCategories.VOICE).toBe('voice');
      expect(FeatureCategories.PIP).toBe('pip');
    });
  });

  describe('SessionTracker', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should track session duration', () => {
      const tracker = new SessionTracker();

      vi.advanceTimersByTime(5000); // 5 seconds

      expect(tracker.getDuration()).toBe(5);
    });

    it('should record events', () => {
      const tracker = new SessionTracker();

      tracker.recordEvent('terminal_created');
      tracker.recordEvent('file_opened');
      tracker.recordEvent('git_commit');

      expect(tracker.getEventCount()).toBe(3);
    });

    it('should provide session summary', () => {
      const tracker = new SessionTracker();

      tracker.recordEvent('event1');
      tracker.recordEvent('event2');

      vi.advanceTimersByTime(10000); // 10 seconds

      const summary = tracker.getSummary();

      expect(summary.duration).toBe(10);
      expect(summary.eventCount).toBe(2);
      expect(summary.events).toContain('event1');
      expect(summary.events).toContain('event2');
    });
  });

  describe('createDebouncedTracker', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should debounce tracking calls', () => {
      const mockTrack = vi.fn();
      const debouncedTrack = createDebouncedTracker(
        mockTrack,
        'tab_switched',
        500
      );

      // Call multiple times quickly
      debouncedTrack({ tabType: 'terminal' });
      debouncedTrack({ tabType: 'editor' });
      debouncedTrack({ tabType: 'settings' });

      // Should not have been called yet
      expect(mockTrack).not.toHaveBeenCalled();

      // Advance time past debounce delay
      vi.advanceTimersByTime(500);

      // Should have been called once with last value
      expect(mockTrack).toHaveBeenCalledTimes(1);
      expect(mockTrack).toHaveBeenCalledWith('tab_switched', { tabType: 'settings' });
    });

    it('should reset timer on each call', () => {
      const mockTrack = vi.fn();
      const debouncedTrack = createDebouncedTracker(
        mockTrack,
        'feature_used',
        1000
      );

      debouncedTrack({ feature: 'first' });

      vi.advanceTimersByTime(500);

      debouncedTrack({ feature: 'second' });

      vi.advanceTimersByTime(500);

      // Still not called (timer was reset)
      expect(mockTrack).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      // Now it should be called
      expect(mockTrack).toHaveBeenCalledTimes(1);
      expect(mockTrack).toHaveBeenCalledWith('feature_used', { feature: 'second' });
    });
  });

  describe('withTiming', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should measure operation timing', async () => {
      const operation = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(() => resolve('result'), 100);
        });
      });

      const resultPromise = withTiming(operation, 'test_operation');

      vi.advanceTimersByTime(100);

      const { result, timing } = await resultPromise;

      expect(result).toBe('result');
      expect(timing.metric).toBe('test_operation');
      expect(timing.unit).toBe('ms');
      expect(typeof timing.value).toBe('number');
    });

    it('should return correct result from operation', async () => {
      const operation = vi.fn().mockResolvedValue({ data: 'test' });

      const { result } = await withTiming(operation, 'fetch_data');

      expect(result).toEqual({ data: 'test' });
    });
  });
});
