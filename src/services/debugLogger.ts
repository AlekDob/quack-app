/**
 * 🦆 Debug Logger Service
 *
 * Persistent logging system for production debugging.
 * Stores logs in localStorage for inspection even without console access.
 */

export interface DebugLogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error';
  category: 'deduplication' | 'rendering' | 'events' | 'general';
  message: string;
  data?: any;
  stackTrace?: string;
}

const MAX_LOGS = 500; // Keep last 500 logs
const STORAGE_KEY = 'quack_debug_logs';
const ENABLED_KEY = 'quack_debug_enabled';

class DebugLogger {
  private logs: DebugLogEntry[] = [];
  private enabled: boolean = false;

  constructor() {
    // Load enabled state from localStorage
    const savedEnabled = localStorage.getItem(ENABLED_KEY);
    this.enabled = savedEnabled === 'true';

    // Load existing logs
    this.loadLogs();
  }

  /**
   * Check if debug logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Enable/disable debug logging
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem(ENABLED_KEY, enabled.toString());

    if (enabled) {
      this.log('info', 'general', '🦆 Debug logging ENABLED');
    } else {
      this.log('info', 'general', '🦆 Debug logging DISABLED');
    }
  }

  /**
   * Log a debug message
   */
  log(
    level: DebugLogEntry['level'],
    category: DebugLogEntry['category'],
    message: string,
    data?: any
  ): void {
    if (!this.enabled) return;

    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data: data ? this.sanitizeData(data) : undefined,
      stackTrace: level === 'error' ? new Error().stack : undefined,
    };

    this.logs.push(entry);

    // Keep only last MAX_LOGS entries
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(-MAX_LOGS);
    }

    // Save to localStorage
    this.saveLogs();

    // Also log to console for development
    const consoleMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[consoleMethod](`[DebugLogger] [${category}] ${message}`, data || '');
  }

  /**
   * Log info message
   */
  info(category: DebugLogEntry['category'], message: string, data?: any): void {
    this.log('info', category, message, data);
  }

  /**
   * Log warning message
   */
  warn(category: DebugLogEntry['category'], message: string, data?: any): void {
    this.log('warn', category, message, data);
  }

  /**
   * Log error message
   */
  error(category: DebugLogEntry['category'], message: string, data?: any): void {
    this.log('error', category, message, data);
  }

  /**
   * Get all logs
   */
  getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  /**
   * Get logs by category
   */
  getLogsByCategory(category: DebugLogEntry['category']): DebugLogEntry[] {
    return this.logs.filter(log => log.category === category);
  }

  /**
   * Get logs by level
   */
  getLogsByLevel(level: DebugLogEntry['level']): DebugLogEntry[] {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = [];
    this.saveLogs();
    console.log('[DebugLogger] All logs cleared');
  }

  /**
   * Export logs as JSON
   */
  exportLogs(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      totalLogs: this.logs.length,
      logs: this.logs,
    }, null, 2);
  }

  /**
   * Get statistics about logs
   */
  getStats() {
    const byCategory = this.logs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byLevel = this.logs.reduce((acc, log) => {
      acc[log.level] = (acc[log.level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      total: this.logs.length,
      byCategory,
      byLevel,
      oldestLog: this.logs[0]?.timestamp,
      newestLog: this.logs[this.logs.length - 1]?.timestamp,
    };
  }

  /**
   * Load logs from localStorage
   */
  private loadLogs(): void {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        this.logs = JSON.parse(saved);
      }
    } catch (error) {
      console.error('[DebugLogger] Failed to load logs from localStorage:', error);
      this.logs = [];
    }
  }

  /**
   * Save logs to localStorage
   */
  private saveLogs(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.logs));
    } catch (error) {
      console.error('[DebugLogger] Failed to save logs to localStorage:', error);
    }
  }

  /**
   * Sanitize data to avoid circular references and large objects
   */
  private sanitizeData(data: any): any {
    try {
      // If it's a primitive, return as-is
      if (data === null || typeof data !== 'object') {
        return data;
      }

      // If it's an array, sanitize each element
      if (Array.isArray(data)) {
        return data.slice(0, 10).map(item => this.sanitizeData(item)); // Limit to 10 items
      }

      // If it's an object, sanitize each property
      const sanitized: any = {};
      let count = 0;
      for (const [key, value] of Object.entries(data)) {
        if (count >= 20) break; // Limit to 20 properties

        // Skip functions and symbols
        if (typeof value === 'function' || typeof value === 'symbol') {
          sanitized[key] = '[Function]';
          continue;
        }

        // Recursively sanitize nested objects (max depth 3)
        if (typeof value === 'object' && value !== null) {
          sanitized[key] = '[Object]'; // Simplified for now
        } else {
          sanitized[key] = value;
        }

        count++;
      }

      return sanitized;
    } catch (error) {
      return '[Unserializable]';
    }
  }
}

// Singleton instance
const debugLogger = new DebugLogger();

// Export for use in hooks and components
export default debugLogger;
