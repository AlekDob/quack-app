import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import {
  useMaxPlanTracking,
  formatTimeRemaining,
  formatTime,
  getPlanDisplayName,
  type MaxPlanType,
} from './useMaxPlanTracking';

describe('useMaxPlanTracking', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    // Reset timers
    vi.clearAllTimers();
  });

  describe('Hook initialization', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useMaxPlanTracking());

      expect(result.current.stats.messageCount).toBe(0);
      expect(result.current.stats.planType).toBe('max5x');
      expect(result.current.stats.messageLimit).toBe(225);
      expect(result.current.config.tokenLimit).toBe(88000);
    });

    it('should load saved plan type from localStorage', () => {
      localStorage.setItem('quack_max_plan_type', 'max20x');

      const { result } = renderHook(() => useMaxPlanTracking());

      expect(result.current.stats.planType).toBe('max20x');
      expect(result.current.stats.messageLimit).toBe(900);
    });

    it('should load saved session from localStorage', () => {
      const savedSession = {
        startTime: Date.now() - 3600000, // 1 hour ago
        messageCount: 50,
        totalTokens: 10000,
      };
      localStorage.setItem('quack_max_plan_session', JSON.stringify(savedSession));

      const { result } = renderHook(() => useMaxPlanTracking());

      expect(result.current.stats.messageCount).toBe(50);
      expect(result.current.stats.sessionDuration).toBeGreaterThan(3500000); // ~1 hour
    });

    it('should reset expired session (> 5 hours old)', () => {
      const savedSession = {
        startTime: Date.now() - 6 * 60 * 60 * 1000, // 6 hours ago
        messageCount: 100,
        totalTokens: 20000,
      };
      localStorage.setItem('quack_max_plan_session', JSON.stringify(savedSession));

      const { result } = renderHook(() => useMaxPlanTracking());

      expect(result.current.stats.messageCount).toBe(0); // Should reset
    });
  });

  describe('Plan type management', () => {
    it('should change plan type and update limits', () => {
      const { result } = renderHook(() => useMaxPlanTracking());

      act(() => {
        result.current.setPlanType('pro');
      });

      expect(result.current.stats.planType).toBe('pro');
      expect(result.current.stats.messageLimit).toBe(45);
      expect(result.current.config.tokenLimit).toBe(44000);
    });

    it('should persist plan type to localStorage', () => {
      const { result } = renderHook(() => useMaxPlanTracking());

      act(() => {
        result.current.setPlanType('max20x');
      });

      expect(localStorage.getItem('quack_max_plan_type')).toBe('max20x');
    });
  });

  describe('Message count tracking', () => {
    it('should increment message count', () => {
      const { result } = renderHook(() => useMaxPlanTracking());

      act(() => {
        result.current.incrementMessageCount();
      });

      expect(result.current.stats.messageCount).toBe(1);

      act(() => {
        result.current.incrementMessageCount();
      });

      expect(result.current.stats.messageCount).toBe(2);
    });

    it('should calculate message percentage correctly', () => {
      const { result } = renderHook(() => useMaxPlanTracking());

      act(() => {
        // Max5x has 225 message limit
        // Add 112 messages = 50% (rounded)
        for (let i = 0; i < 112; i++) {
          result.current.incrementMessageCount();
        }
      });

      expect(Math.round(result.current.stats.messagePercentage)).toBe(50);
    });

    it('should mark as near limit at 75%', () => {
      const { result } = renderHook(() => useMaxPlanTracking());

      act(() => {
        // Max5x has 225 message limit
        // 75% = 169 messages
        for (let i = 0; i < 169; i++) {
          result.current.incrementMessageCount();
        }
      });

      expect(result.current.stats.isNearLimit).toBe(true);
      expect(result.current.stats.isCritical).toBe(false);
    });

    it('should mark as critical at 90%', () => {
      const { result } = renderHook(() => useMaxPlanTracking());

      act(() => {
        // Max5x has 225 message limit
        // 90% = 203 messages
        for (let i = 0; i < 203; i++) {
          result.current.incrementMessageCount();
        }
      });

      expect(result.current.stats.isNearLimit).toBe(true);
      expect(result.current.stats.isCritical).toBe(true);
    });
  });

  describe('Burn rate calculation', () => {
    it('should calculate burn rate per hour', () => {
      const { result, rerender } = renderHook(() => useMaxPlanTracking());

      const startTime = Date.now();
      const oneHourLater = startTime + 3600000; // 1 hour

      // Mock Date.now() to simulate time passing
      vi.spyOn(Date, 'now').mockReturnValue(startTime);

      act(() => {
        result.current.incrementMessageCount();
      });

      // Fast-forward 1 hour
      vi.spyOn(Date, 'now').mockReturnValue(oneHourLater);

      act(() => {
        for (let i = 0; i < 19; i++) {
          result.current.incrementMessageCount();
        }
      });

      rerender();

      // 20 messages in 1 hour = 20/hr burn rate
      expect(result.current.stats.burnRatePerHour).toBeCloseTo(20, 0);

      vi.restoreAllMocks();
    });

    it('should estimate time until limit based on burn rate', () => {
      const { result, rerender } = renderHook(() => useMaxPlanTracking());

      const startTime = Date.now();

      // Increment first message to set start time
      act(() => {
        result.current.incrementMessageCount();
      });

      // Fast-forward 1 hour
      const oneHourLater = startTime + 3600000;
      vi.spyOn(Date, 'now').mockReturnValue(oneHourLater);

      act(() => {
        // Send 44 more messages (total 45)
        for (let i = 0; i < 44; i++) {
          result.current.incrementMessageCount();
        }
      });

      rerender();

      // Burn rate: 45 msg/hr (45 messages in 1 hour)
      // Remaining: 225 - 45 = 180 messages
      // Estimated time: 180 / 45 = 4 hours = 14,400,000 ms
      expect(result.current.stats.burnRatePerHour).toBeGreaterThan(40); // Allow some variance
      expect(result.current.stats.estimatedTimeUntilLimit).toBeGreaterThan(13000000); // ~4 hours

      vi.restoreAllMocks();
    });
  });

  describe('Session reset', () => {
    it('should reset session manually', () => {
      const { result } = renderHook(() => useMaxPlanTracking());

      act(() => {
        for (let i = 0; i < 50; i++) {
          result.current.incrementMessageCount();
        }
      });

      expect(result.current.stats.messageCount).toBe(50);

      act(() => {
        result.current.resetSession();
      });

      expect(result.current.stats.messageCount).toBe(0);
    });
  });

  describe('Time window tracking', () => {
    it('should calculate time remaining in window', () => {
      const { result } = renderHook(() => useMaxPlanTracking());

      const fiveHoursInMs = 5 * 60 * 60 * 1000;
      const timeRemaining = result.current.stats.timeRemaining;

      expect(timeRemaining).toBeLessThanOrEqual(fiveHoursInMs);
      expect(timeRemaining).toBeGreaterThan(fiveHoursInMs - 1000); // Allow 1s variance
    });

    it('should calculate window end time correctly', () => {
      const { result } = renderHook(() => useMaxPlanTracking());

      const now = Date.now();
      const fiveHoursLater = now + 5 * 60 * 60 * 1000;

      expect(result.current.stats.windowEndsAt).toBeCloseTo(fiveHoursLater, -3); // Within seconds
    });
  });
});

describe('Utility functions', () => {
  describe('formatTimeRemaining', () => {
    it('should format hours and minutes', () => {
      const twoHoursThirtyMin = 2 * 60 * 60 * 1000 + 30 * 60 * 1000;
      expect(formatTimeRemaining(twoHoursThirtyMin)).toBe('2h 30m');
    });

    it('should format minutes only', () => {
      const fortyFiveMin = 45 * 60 * 1000;
      expect(formatTimeRemaining(fortyFiveMin)).toBe('45m');
    });

    it('should format seconds only', () => {
      const thirtySeconds = 30 * 1000;
      expect(formatTimeRemaining(thirtySeconds)).toBe('30s');
    });

    it('should handle zero time', () => {
      expect(formatTimeRemaining(0)).toBe('0s');
    });

    it('should handle negative time', () => {
      expect(formatTimeRemaining(-1000)).toBe('0s');
    });

    it('should handle infinity', () => {
      expect(formatTimeRemaining(Infinity)).toBe('∞');
    });
  });

  describe('formatTime', () => {
    it('should format timestamp to 12-hour time', () => {
      const tenAM = new Date(2025, 0, 22, 10, 30, 0).getTime();
      const formatted = formatTime(tenAM);

      expect(formatted).toMatch(/10:30/);
      expect(formatted).toMatch(/AM/);
    });

    it('should format PM times correctly', () => {
      const threePM = new Date(2025, 0, 22, 15, 45, 0).getTime();
      const formatted = formatTime(threePM);

      expect(formatted).toMatch(/3:45/);
      expect(formatted).toMatch(/PM/);
    });
  });

  describe('getPlanDisplayName', () => {
    it('should return correct display names', () => {
      expect(getPlanDisplayName('pro')).toBe('Pro');
      expect(getPlanDisplayName('max5x')).toBe('Max 5x');
      expect(getPlanDisplayName('max20x')).toBe('Max 20x');
    });

    it('should return input for unknown plan', () => {
      expect(getPlanDisplayName('unknown' as MaxPlanType)).toBe('unknown');
    });
  });
});
