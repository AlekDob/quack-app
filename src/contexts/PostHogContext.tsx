import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import posthog from 'posthog-js';

// PostHog configuration from environment
// Supports both VITE_PUBLIC_ (PostHog convention) and VITE_ prefixes
const POSTHOG_KEY = import.meta.env.VITE_PUBLIC_POSTHOG_KEY || import.meta.env.VITE_POSTHOG_KEY;
const POSTHOG_HOST = import.meta.env.VITE_PUBLIC_POSTHOG_HOST || import.meta.env.VITE_POSTHOG_HOST || 'https://eu.i.posthog.com';

// Check if analytics should be enabled
const isAnalyticsEnabled = (): boolean => {
  // Disable in development unless explicitly enabled
  const devEnabled = import.meta.env.VITE_PUBLIC_POSTHOG_DEV_ENABLED || import.meta.env.VITE_POSTHOG_DEV_ENABLED;
  if (import.meta.env.DEV && !devEnabled) {
    return false;
  }
  // Disable if no key is configured
  if (!POSTHOG_KEY) {
    console.warn('[Analytics] PostHog key not configured');
    return false;
  }
  return true;
};

// Analytics event types for type-safety
export interface AnalyticsEvents {
  // App lifecycle
  app_opened: { version: string };
  app_closed: Record<string, never>;

  // Terminal events
  terminal_created: { type: 'native' | 'claude' };
  terminal_closed: { type: 'native' | 'claude'; sessionDuration?: number };
  command_executed: { commandType: string };

  // AI Assistant events
  ai_message_sent: { hasContext?: boolean; contextFilesCount?: number };
  ai_response_received: { responseTime?: number; tokensUsed?: number };
  ai_error: { errorType: string };

  // File operations
  file_opened: { fileType: string };
  file_saved: { fileType: string };

  // Git operations
  git_commit: { filesCount: number };
  git_push: Record<string, never>;
  git_pull: Record<string, never>;
  git_branch_created: Record<string, never>;

  // Features usage
  feature_used: { feature: string; context?: string };

  // UI interactions
  tab_switched: { tabType: string };
  panel_toggled: { panel: string; isOpen: boolean };
  settings_changed: { setting: string };

  // Marketplace
  plugin_installed: { pluginId: string; pluginName: string };
  plugin_uninstalled: { pluginId: string };

  // Errors and performance
  error_occurred: { errorType: string; errorMessage: string; component?: string };
  performance_metric: { metric: string; value: number; unit: string };
}

// User properties for identification
export interface UserProperties {
  plan?: 'free' | 'pro';
  deviceId?: string;
  appVersion?: string;
  platform?: string;
  terminalCount?: number;
}

interface PostHogContextValue {
  isInitialized: boolean;
  isEnabled: boolean;

  // Core tracking methods
  track: <K extends keyof AnalyticsEvents>(
    event: K,
    properties?: AnalyticsEvents[K]
  ) => void;

  // User identification
  identify: (userId: string, properties?: UserProperties) => void;
  reset: () => void;

  // User properties
  setUserProperties: (properties: UserProperties) => void;

  // Feature flags
  isFeatureEnabled: (flag: string) => boolean;
  getFeatureFlag: (flag: string) => boolean | string | undefined;

  // Page views (useful for SPA)
  capturePageView: (pageName: string) => void;

  // Opt-out management
  optOut: () => void;
  optIn: () => void;
  hasOptedOut: () => boolean;
}

const PostHogContext = createContext<PostHogContextValue | null>(null);

export const PostHogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const isEnabled = isAnalyticsEnabled();

  // Initialize PostHog
  useEffect(() => {
    if (!isEnabled) {
      console.log('[Analytics] PostHog disabled');
      return;
    }

    try {
      posthog.init(POSTHOG_KEY!, {
        api_host: POSTHOG_HOST,
        // Privacy-friendly defaults
        persistence: 'localStorage',
        autocapture: false, // We'll manually track important events
        capture_pageview: false, // Manual page view tracking for SPA
        capture_pageleave: true,
        disable_session_recording: true, // Enable only if needed

        // Performance
        loaded: (ph) => {
          console.log('[Analytics] PostHog initialized');
          setIsInitialized(true);

          // Auto-identify with device ID if available
          const deviceId = localStorage.getItem('quack_device_id');
          if (deviceId) {
            ph.identify(deviceId);
          }

          // Track app opened event
          const appVersion = import.meta.env.PACKAGE_VERSION || '0.0.0';
          ph.capture('app_opened', {
            version: appVersion,
            platform: 'desktop',
            os: navigator.platform,
          });
        },

        // Privacy: mask sensitive data
        sanitize_properties: (properties) => {
          // Remove any file paths that might contain sensitive info
          const sanitized = { ...properties };
          Object.keys(sanitized).forEach(key => {
            if (typeof sanitized[key] === 'string' && sanitized[key].includes('/Users/')) {
              sanitized[key] = '[PATH_REDACTED]';
            }
          });
          return sanitized;
        },
      });
    } catch (error) {
      console.error('[Analytics] Failed to initialize PostHog:', error);
    }

    return () => {
      // Cleanup on unmount (app close)
      if (isInitialized) {
        posthog.capture('app_closed');
      }
    };
  }, [isEnabled]);

  // Track event
  const track = useCallback(<K extends keyof AnalyticsEvents>(
    event: K,
    properties?: AnalyticsEvents[K]
  ) => {
    if (!isEnabled || !isInitialized) return;

    try {
      posthog.capture(event, properties as Record<string, unknown>);
    } catch (error) {
      console.error('[Analytics] Failed to track event:', event, error);
    }
  }, [isEnabled, isInitialized]);

  // Identify user
  const identify = useCallback((userId: string, properties?: UserProperties) => {
    if (!isEnabled || !isInitialized) return;

    try {
      posthog.identify(userId, properties as Record<string, unknown>);
    } catch (error) {
      console.error('[Analytics] Failed to identify user:', error);
    }
  }, [isEnabled, isInitialized]);

  // Reset user (logout)
  const reset = useCallback(() => {
    if (!isEnabled || !isInitialized) return;
    posthog.reset();
  }, [isEnabled, isInitialized]);

  // Set user properties
  const setUserProperties = useCallback((properties: UserProperties) => {
    if (!isEnabled || !isInitialized) return;
    posthog.people.set(properties as Record<string, unknown>);
  }, [isEnabled, isInitialized]);

  // Feature flags
  const isFeatureEnabled = useCallback((flag: string): boolean => {
    if (!isEnabled || !isInitialized) return false;
    return posthog.isFeatureEnabled(flag) ?? false;
  }, [isEnabled, isInitialized]);

  const getFeatureFlag = useCallback((flag: string) => {
    if (!isEnabled || !isInitialized) return undefined;
    return posthog.getFeatureFlag(flag);
  }, [isEnabled, isInitialized]);

  // Page view tracking
  const capturePageView = useCallback((pageName: string) => {
    if (!isEnabled || !isInitialized) return;
    posthog.capture('$pageview', { page: pageName });
  }, [isEnabled, isInitialized]);

  // Opt-out management
  const optOut = useCallback(() => {
    posthog.opt_out_capturing();
    localStorage.setItem('quack_analytics_opted_out', 'true');
  }, []);

  const optIn = useCallback(() => {
    posthog.opt_in_capturing();
    localStorage.removeItem('quack_analytics_opted_out');
  }, []);

  const hasOptedOut = useCallback(() => {
    return posthog.has_opted_out_capturing() ||
           localStorage.getItem('quack_analytics_opted_out') === 'true';
  }, []);

  const value = useMemo<PostHogContextValue>(() => ({
    isInitialized,
    isEnabled,
    track,
    identify,
    reset,
    setUserProperties,
    isFeatureEnabled,
    getFeatureFlag,
    capturePageView,
    optOut,
    optIn,
    hasOptedOut,
  }), [
    isInitialized,
    isEnabled,
    track,
    identify,
    reset,
    setUserProperties,
    isFeatureEnabled,
    getFeatureFlag,
    capturePageView,
    optOut,
    optIn,
    hasOptedOut
  ]);

  return (
    <PostHogContext.Provider value={value}>
      {children}
    </PostHogContext.Provider>
  );
};

// Custom hook for using analytics
export const useAnalytics = (): PostHogContextValue => {
  const context = useContext(PostHogContext);

  if (!context) {
    // Return a no-op implementation if used outside provider
    return {
      isInitialized: false,
      isEnabled: false,
      track: () => {},
      identify: () => {},
      reset: () => {},
      setUserProperties: () => {},
      isFeatureEnabled: () => false,
      getFeatureFlag: () => undefined,
      capturePageView: () => {},
      optOut: () => {},
      optIn: () => {},
      hasOptedOut: () => false,
    };
  }

  return context;
};

// Export the raw posthog instance for advanced usage
export { posthog };
