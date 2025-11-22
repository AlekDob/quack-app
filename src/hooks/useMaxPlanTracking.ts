import { useState, useEffect, useMemo, useCallback } from 'react';
import type { MaxPlanType, MaxPlanConfig, MaxPlanSession, MaxPlanStats } from './maxPlanTypes';

/**
 * Claude Max Plan Configuration
 * Based on official limits (5-hour rolling window)
 */
export type { MaxPlanType, MaxPlanConfig, MaxPlanSession, MaxPlanStats };

const PLAN_CONFIGS: Record<MaxPlanType, MaxPlanConfig> = {
  pro: {
    planType: 'pro',
    messageLimit: 45,
    tokenLimit: 44000,
    windowHours: 5,
  },
  max5x: {
    planType: 'max5x',
    messageLimit: 225,
    tokenLimit: 88000,
    windowHours: 5,
  },
  max20x: {
    planType: 'max20x',
    messageLimit: 900,
    tokenLimit: 220000,
    windowHours: 5,
  },
};

/**
 * Hook to track Claude Max plan usage limits
 *
 * Features:
 * - Tracks message count in 5-hour rolling window
 * - Calculates burn rate (messages/hour)
 * - Estimates time until limit reached
 * - Persists session data in localStorage
 * - Auto-resets after 5 hours from first message
 */
export function useMaxPlanTracking() {
  // Load plan type from localStorage (default: max5x) - INLINE
  const [planType, setPlanType] = useState<MaxPlanType>(() => {
    const saved = localStorage.getItem('quack_max_plan_type');
    return (saved as MaxPlanType) || 'max5x';
  });

  // Load session from localStorage - INLINE
  const [session, setSession] = useState<MaxPlanSession>(() => {
    const saved = localStorage.getItem('quack_max_plan_session');
    if (!saved) {
      return {
        startTime: Date.now(),
        messageCount: 0,
        totalTokens: 0,
      };
    }

    try {
      const parsed = JSON.parse(saved) as MaxPlanSession;
      const now = Date.now();
      const sessionAge = now - parsed.startTime;
      const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

      // Check if session is expired
      if (sessionAge > FIVE_HOURS_MS) {
        console.log('[useMaxPlanTracking] Session expired on load, creating fresh session');
        return {
          startTime: Date.now(),
          messageCount: 0,
          totalTokens: 0,
        };
      }

      return parsed;
    } catch (e) {
      console.error('[useMaxPlanTracking] Failed to parse session:', e);
      return {
        startTime: Date.now(),
        messageCount: 0,
        totalTokens: 0,
      };
    }
  });

  // Get config for current plan type
  const config = useMemo(() => PLAN_CONFIGS[planType], [planType]);

  // Persist session to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('quack_max_plan_session', JSON.stringify(session));
  }, [session]);

  // Persist plan type to localStorage
  useEffect(() => {
    localStorage.setItem('quack_max_plan_type', planType);
  }, [planType]);

  // Reset session (manual reset or after 5 hours)
  const resetSession = useCallback(() => {
    console.log('[useMaxPlanTracking] Resetting session');
    setSession({
      startTime: Date.now(),
      messageCount: 0,
      totalTokens: 0,
    });
  }, []);

  // Increment message count (call this when Claude responds)
  const incrementMessageCount = useCallback(() => {
    setSession((prev) => {
      const now = Date.now();

      // If first message, set start time
      if (prev.messageCount === 0) {
        return {
          ...prev,
          startTime: now,
          messageCount: 1,
        };
      }

      return {
        ...prev,
        messageCount: prev.messageCount + 1,
      };
    });
  }, []);

  // Update tokens (optional, for advanced tracking)
  const updateTokens = useCallback((tokens: number) => {
    setSession((prev) => ({
      ...prev,
      totalTokens: prev.totalTokens + tokens,
    }));
  }, []);

  // Auto-reset after 5 hours
  useEffect(() => {
    const checkExpiration = () => {
      if (session.messageCount > 0) {
        const now = Date.now();
        const sessionAge = now - session.startTime;
        const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;

        if (sessionAge > FIVE_HOURS_MS) {
          console.log('[useMaxPlanTracking] Session expired, auto-resetting...');
          resetSession();
        }
      }
    };

    // Check every minute
    const interval = setInterval(checkExpiration, 60 * 1000);

    // Also check immediately on mount
    checkExpiration();

    return () => clearInterval(interval);
  }, [session, resetSession]);

  // Calculate stats
  const stats = useMemo<MaxPlanStats>(() => {
    const now = Date.now();
    const sessionDuration = now - session.startTime;
    const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
    const windowEndsAt = session.startTime + FIVE_HOURS_MS;
    const timeRemaining = Math.max(0, windowEndsAt - now);

    // Calculate burn rate (messages per hour)
    const hoursElapsed = sessionDuration / (60 * 60 * 1000);
    const burnRatePerHour = hoursElapsed > 0 ? session.messageCount / hoursElapsed : 0;

    // Estimate time until limit (if burn rate continues)
    const messagesRemaining = config.messageLimit - session.messageCount;
    const estimatedTimeUntilLimit = burnRatePerHour > 0
      ? (messagesRemaining / burnRatePerHour) * 60 * 60 * 1000
      : Infinity;

    // Message percentage
    const messagePercentage = (session.messageCount / config.messageLimit) * 100;

    return {
      messageCount: session.messageCount,
      messageLimit: config.messageLimit,
      messagePercentage,
      sessionStartTime: session.startTime,
      sessionDuration,
      windowEndsAt,
      timeRemaining,
      burnRatePerHour: Math.round(burnRatePerHour * 10) / 10, // Round to 1 decimal
      estimatedTimeUntilLimit,
      planType,
      isNearLimit: messagePercentage >= 75,
      isCritical: messagePercentage >= 90,
    };
  }, [session, config, planType]);

  return {
    stats,
    config,
    planType,
    setPlanType,
    incrementMessageCount,
    updateTokens,
    resetSession,
  };
}

/**
 * Format milliseconds to human-readable time
 * Examples: "2h 34m", "45m", "12s"
 */
export function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return '0s';
  if (ms === Infinity) return '∞';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

/**
 * Format timestamp to time string
 * Example: "10:30 AM"
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get plan display name
 */
export function getPlanDisplayName(planType: MaxPlanType): string {
  switch (planType) {
    case 'pro':
      return 'Pro';
    case 'max5x':
      return 'Max 5x';
    case 'max20x':
      return 'Max 20x';
    default:
      return planType;
  }
}
