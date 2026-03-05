/**
 * Analytics utility functions for Quack
 *
 * These utilities provide convenient wrappers for common analytics operations.
 * They're designed to be used alongside the useAnalytics hook for type-safe tracking.
 */

import type { AnalyticsEvents } from '../contexts/PostHogContext';

// App version from package.json (injected by Vite)
const APP_VERSION = import.meta.env.PACKAGE_VERSION || '0.0.0';

/**
 * Get common properties to include with all events
 */
function getCommonProperties(): Record<string, unknown> {
  return {
    app_version: APP_VERSION,
    platform: 'desktop',
    os: navigator.platform,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    window_width: window.innerWidth,
    window_height: window.innerHeight,
    language: navigator.language,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Extract file type from file path
 */
export function getFileType(filePath: string): string {
  const fileName = filePath.split('/').pop() || filePath;

  // Check if file has an extension (contains a dot that's not at the start)
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return fileName.slice(lastDotIndex + 1).toLowerCase();
  }

  // No extension - return filename itself (e.g., Dockerfile, README)
  return fileName.toLowerCase();
}

/**
 * Measure execution time and return analytics-ready data
 */
export async function withTiming<T>(
  operation: () => Promise<T>,
  metricName: string
): Promise<{ result: T; timing: { metric: string; value: number; unit: string } }> {
  const start = performance.now();
  const result = await operation();
  const duration = Math.round(performance.now() - start);

  return {
    result,
    timing: {
      metric: metricName,
      value: duration,
      unit: 'ms',
    },
  };
}

/**
 * Create a performance metric event payload
 */
export function createPerformanceMetric(
  metric: string,
  value: number,
  unit = 'ms'
): AnalyticsEvents['performance_metric'] {
  return { metric, value, unit };
}

/**
 * Create an error event payload with sanitized data
 */
export function createErrorEvent(
  error: Error | unknown,
  component?: string
): AnalyticsEvents['error_occurred'] {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  return {
    errorType: errorObj.name || 'UnknownError',
    errorMessage: sanitizeErrorMessage(errorObj.message),
    component,
  };
}

/**
 * Sanitize error messages to remove sensitive information
 */
function sanitizeErrorMessage(message: string): string {
  // Remove file paths
  let sanitized = message.replace(/\/Users\/[^/\s]+/g, '[USER]');

  // Remove potential API keys (long alphanumeric strings)
  sanitized = sanitized.replace(/[a-zA-Z0-9]{32,}/g, '[REDACTED]');

  // Truncate to reasonable length
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200) + '...';
  }

  return sanitized;
}

/**
 * Feature usage categories for organized tracking
 */
export const FeatureCategories = {
  TERMINAL: 'terminal',
  AI_ASSISTANT: 'ai_assistant',
  FILE_EXPLORER: 'file_explorer',
  GIT: 'git',
  EDITOR: 'editor',
  SETTINGS: 'settings',
  MARKETPLACE: 'marketplace',
  VOICE: 'voice',
  PIP: 'pip',
} as const;

type FeatureCategory = (typeof FeatureCategories)[keyof typeof FeatureCategories];

/**
 * Create a feature usage event payload
 */
export function createFeatureEvent(
  feature: string,
  category?: FeatureCategory
): AnalyticsEvents['feature_used'] {
  return {
    feature,
    context: category,
  };
}

/**
 * Session duration tracker
 */
export class SessionTracker {
  private startTime: number;
  private events: { event: string; timestamp: number }[] = [];

  constructor() {
    this.startTime = Date.now();
  }

  recordEvent(event: string): void {
    this.events.push({ event, timestamp: Date.now() });
  }

  getDuration(): number {
    return Math.round((Date.now() - this.startTime) / 1000); // seconds
  }

  getEventCount(): number {
    return this.events.length;
  }

  getSummary(): { duration: number; eventCount: number; events: string[] } {
    return {
      duration: this.getDuration(),
      eventCount: this.events.length,
      events: this.events.map((e) => e.event),
    };
  }
}

// Global session tracker instance
const sessionTracker = new SessionTracker();

/**
 * Debounced event tracker to avoid spamming similar events
 */
export function createDebouncedTracker<K extends keyof AnalyticsEvents>(
  track: (event: K, properties?: AnalyticsEvents[K]) => void,
  event: K,
  delay = 1000
): (properties?: AnalyticsEvents[K]) => void {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastProperties: AnalyticsEvents[K] | undefined;

  return (properties?: AnalyticsEvents[K]) => {
    lastProperties = properties;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      track(event, lastProperties);
      timeoutId = null;
    }, delay);
  };
}

/**
 * Batch event tracker for high-frequency events
 */
class BatchedEventTracker {
  private batch: Array<{ event: string; properties: Record<string, unknown> }> = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private batchSize: number;
  private flushDelay: number;
  private onFlush: (events: Array<{ event: string; properties: Record<string, unknown> }>) => void;

  constructor(
    onFlush: (events: Array<{ event: string; properties: Record<string, unknown> }>) => void,
    options: { batchSize?: number; flushDelay?: number } = {}
  ) {
    this.onFlush = onFlush;
    this.batchSize = options.batchSize || 10;
    this.flushDelay = options.flushDelay || 5000;

    this.startAutoFlush();
  }

  add(event: string, properties: Record<string, unknown>): void {
    this.batch.push({ event, properties });

    if (this.batch.length >= this.batchSize) {
      this.flush();
    }
  }

  flush(): void {
    if (this.batch.length === 0) return;

    const events = [...this.batch];
    this.batch = [];
    this.onFlush(events);
  }

  private startAutoFlush(): void {
    this.flushInterval = setInterval(() => this.flush(), this.flushDelay);
  }

  destroy(): void {
    this.flush();
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
  }
}
