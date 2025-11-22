import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { sendNotification, isPermissionGranted, requestPermission } from '@tauri-apps/plugin-notification';
import type { MaxPlanStats } from './maxPlanTypes';

interface NotificationState {
  warningShown: boolean; // 75% threshold
  criticalShown: boolean; // 90% threshold
}

/**
 * Hook to manage proactive notifications for Max Plan limit warnings.
 * Shows toast and desktop notifications when approaching message limits.
 */
export function useMaxPlanNotifications(stats: MaxPlanStats) {
  const notificationStateRef = useRef<NotificationState>({
    warningShown: false,
    criticalShown: false,
  });

  useEffect(() => {
    const state = notificationStateRef.current;
    const percentage = stats.messagePercentage;

    // Reset notification flags when session resets (message count drops)
    if (stats.messageCount < 5) {
      state.warningShown = false;
      state.criticalShown = false;
      return;
    }

    // 🚨 CRITICAL: 90% threshold
    if (percentage >= 90 && !state.criticalShown) {
      state.criticalShown = true;
      showCriticalNotification(stats);
    }
    // ⚠️ WARNING: 75% threshold
    else if (percentage >= 75 && !state.warningShown) {
      state.warningShown = true;
      showWarningNotification(stats);
    }
  }, [stats.messagePercentage, stats.messageCount]);

  return null; // Hook doesn't return anything, just manages side effects
}

/**
 * Show warning notification at 75% limit
 */
async function showWarningNotification(stats: MaxPlanStats) {
  const message = `You've used ${Math.round(stats.messagePercentage)}% of your message limit (${stats.messageCount}/${stats.messageLimit}).`;
  const action = 'Consider compacting your conversation or waiting for window reset.';

  // Toast notification
  toast.warning('⚠️ Approaching Message Limit', {
    description: message + ' ' + action,
    duration: 8000,
    action: {
      label: 'View Details',
      onClick: () => {
        // Clicking will open the Token Usage Modal (handled by parent component)
        document.querySelector<HTMLElement>('.token-indicator')?.click();
      },
    },
  });

  // Desktop notification (if permitted)
  await sendDesktopNotification('⚠️ Max Plan Warning', message);
}

/**
 * Show critical notification at 90% limit
 */
async function showCriticalNotification(stats: MaxPlanStats) {
  const message = `You've used ${Math.round(stats.messagePercentage)}% of your message limit (${stats.messageCount}/${stats.messageLimit}).`;
  const action = `Window resets at ${formatTime(stats.windowEndsAt)}.`;

  // Toast notification (critical style)
  toast.error('🚨 Critical: Message Limit', {
    description: message + ' ' + action,
    duration: 12000, // Longer duration for critical alerts
    action: {
      label: 'View Details',
      onClick: () => {
        document.querySelector<HTMLElement>('.token-indicator')?.click();
      },
    },
  });

  // Desktop notification (if permitted)
  await sendDesktopNotification('🚨 Max Plan Critical', message);
}

/**
 * Send desktop notification if permission is granted
 */
async function sendDesktopNotification(title: string, body: string) {
  try {
    let permissionGranted = await isPermissionGranted();

    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }

    if (permissionGranted) {
      await sendNotification({ title, body });
    }
  } catch (error) {
    console.warn('[Max Plan Notifications] Failed to send desktop notification:', error);
  }
}

/**
 * Format timestamp to readable time
 */
function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
