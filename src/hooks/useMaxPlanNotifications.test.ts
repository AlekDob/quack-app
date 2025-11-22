import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMaxPlanNotifications } from './useMaxPlanNotifications';
import type { MaxPlanStats } from './maxPlanTypes';
import { toast } from 'sonner';

// Mock Tauri notification API
vi.mock('@tauri-apps/plugin-notification', () => ({
  sendNotification: vi.fn(),
  isPermissionGranted: vi.fn().mockResolvedValue(true),
  requestPermission: vi.fn().mockResolvedValue('granted'),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    warning: vi.fn(),
    error: vi.fn(),
  },
}));

describe('useMaxPlanNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const createMockStats = (percentage: number, messageCount: number): MaxPlanStats => ({
    messageCount,
    messageLimit: 225,
    messagePercentage: percentage,
    sessionStartTime: Date.now() - 3600000,
    sessionDuration: 3600000,
    windowEndsAt: Date.now() + 14400000,
    timeRemaining: 14400000,
    burnRatePerHour: 25,
    estimatedTimeUntilLimit: 3600000,
    planType: 'max5x',
    isNearLimit: percentage >= 75,
    isCritical: percentage >= 90,
  });

  describe('Warning threshold (75%)', () => {
    it('should show warning notification at 75% limit', () => {
      const stats = createMockStats(75, 169);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.warning).toHaveBeenCalledWith(
        '⚠️ Approaching Message Limit',
        expect.objectContaining({
          description: expect.stringContaining('75%'),
        })
      );
    });

    it('should NOT show warning notification below 75%', () => {
      const stats = createMockStats(74, 166);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.warning).not.toHaveBeenCalled();
    });

    it('should show warning only once per session', () => {
      const stats75 = createMockStats(75, 169);
      const { rerender } = renderHook(
        ({ stats }) => useMaxPlanNotifications(stats),
        { initialProps: { stats: stats75 } }
      );

      expect(toast.warning).toHaveBeenCalledTimes(1);

      // Increase to 80% - should NOT trigger another warning
      const stats80 = createMockStats(80, 180);
      rerender({ stats: stats80 });

      expect(toast.warning).toHaveBeenCalledTimes(1); // Still just once
    });
  });

  describe('Critical threshold (90%)', () => {
    it('should show critical notification at 90% limit', () => {
      const stats = createMockStats(90, 203);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.error).toHaveBeenCalledWith(
        '🚨 Critical: Message Limit',
        expect.objectContaining({
          description: expect.stringContaining('90%'),
        })
      );
    });

    it('should NOT show critical notification below 90%', () => {
      const stats = createMockStats(89, 200);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.error).not.toHaveBeenCalled();
    });

    it('should show critical only once per session', () => {
      const stats90 = createMockStats(90, 203);
      const { rerender } = renderHook(
        ({ stats }) => useMaxPlanNotifications(stats),
        { initialProps: { stats: stats90 } }
      );

      expect(toast.error).toHaveBeenCalledTimes(1);

      // Increase to 95% - should NOT trigger another critical
      const stats95 = createMockStats(95, 214);
      rerender({ stats: stats95 });

      expect(toast.error).toHaveBeenCalledTimes(1); // Still just once
    });
  });

  describe('Session reset', () => {
    it('should reset notification flags when session resets (low message count)', () => {
      const stats90 = createMockStats(90, 203);
      const { rerender } = renderHook(
        ({ stats }) => useMaxPlanNotifications(stats),
        { initialProps: { stats: stats90 } }
      );

      expect(toast.error).toHaveBeenCalledTimes(1);

      // Session reset (message count drops to 2)
      const statsReset = createMockStats(1, 2);
      rerender({ stats: statsReset });

      // Now increase to 90% again - should trigger notification again
      const statsNew90 = createMockStats(90, 203);
      rerender({ stats: statsNew90 });

      expect(toast.error).toHaveBeenCalledTimes(2); // New notification after reset
    });

    it('should reset warning flag when session resets', () => {
      const stats75 = createMockStats(75, 169);
      const { rerender } = renderHook(
        ({ stats }) => useMaxPlanNotifications(stats),
        { initialProps: { stats: stats75 } }
      );

      expect(toast.warning).toHaveBeenCalledTimes(1);

      // Session reset
      const statsReset = createMockStats(1, 2);
      rerender({ stats: statsReset });

      // Reach 75% again
      const statsNew75 = createMockStats(75, 169);
      rerender({ stats: statsNew75 });

      expect(toast.warning).toHaveBeenCalledTimes(2); // New warning after reset
    });
  });

  describe('Progression through thresholds', () => {
    it('should show warning first, then critical as percentage increases', () => {
      const stats70 = createMockStats(70, 158);
      const { rerender } = renderHook(
        ({ stats }) => useMaxPlanNotifications(stats),
        { initialProps: { stats: stats70 } }
      );

      // No notifications at 70%
      expect(toast.warning).not.toHaveBeenCalled();
      expect(toast.error).not.toHaveBeenCalled();

      // Warning at 75%
      const stats75 = createMockStats(75, 169);
      rerender({ stats: stats75 });
      expect(toast.warning).toHaveBeenCalledTimes(1);
      expect(toast.error).not.toHaveBeenCalled();

      // Critical at 90% (warning should not be called again)
      const stats90 = createMockStats(90, 203);
      rerender({ stats: stats90 });
      expect(toast.warning).toHaveBeenCalledTimes(1); // Still just once
      expect(toast.error).toHaveBeenCalledTimes(1);
    });
  });

  describe('Notification content', () => {
    it('should include message count and limit in warning notification', () => {
      const stats = createMockStats(75, 169);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.warning).toHaveBeenCalledWith(
        '⚠️ Approaching Message Limit',
        expect.objectContaining({
          description: expect.stringContaining('169/225'),
        })
      );
    });

    it('should include message count and limit in critical notification', () => {
      const stats = createMockStats(90, 203);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.error).toHaveBeenCalledWith(
        '🚨 Critical: Message Limit',
        expect.objectContaining({
          description: expect.stringContaining('203/225'),
        })
      );
    });

    it('should include action suggestion in warning notification', () => {
      const stats = createMockStats(75, 169);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.warning).toHaveBeenCalledWith(
        '⚠️ Approaching Message Limit',
        expect.objectContaining({
          description: expect.stringContaining('Consider compacting'),
        })
      );
    });

    it('should include window reset time in critical notification', () => {
      const stats = createMockStats(90, 203);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.error).toHaveBeenCalledWith(
        '🚨 Critical: Message Limit',
        expect.objectContaining({
          description: expect.stringMatching(/Window resets at/),
        })
      );
    });
  });

  describe('Toast action buttons', () => {
    it('should include "View Details" action in warning toast', () => {
      const stats = createMockStats(75, 169);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.warning).toHaveBeenCalledWith(
        '⚠️ Approaching Message Limit',
        expect.objectContaining({
          action: expect.objectContaining({
            label: 'View Details',
          }),
        })
      );
    });

    it('should include "View Details" action in critical toast', () => {
      const stats = createMockStats(90, 203);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.error).toHaveBeenCalledWith(
        '🚨 Critical: Message Limit',
        expect.objectContaining({
          action: expect.objectContaining({
            label: 'View Details',
          }),
        })
      );
    });
  });

  describe('Toast duration', () => {
    it('should show warning toast for 8 seconds', () => {
      const stats = createMockStats(75, 169);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.warning).toHaveBeenCalledWith(
        '⚠️ Approaching Message Limit',
        expect.objectContaining({
          duration: 8000,
        })
      );
    });

    it('should show critical toast for 12 seconds (longer)', () => {
      const stats = createMockStats(90, 203);
      renderHook(() => useMaxPlanNotifications(stats));

      expect(toast.error).toHaveBeenCalledWith(
        '🚨 Critical: Message Limit',
        expect.objectContaining({
          duration: 12000,
        })
      );
    });
  });
});
