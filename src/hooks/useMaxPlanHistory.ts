import { useState, useEffect } from 'react';
import type { MaxPlanType, DailyUsage, WeeklyUsage, MaxPlanHistoryData } from './maxPlanTypes';

const HISTORY_STORAGE_KEY = 'maxplan-history';
const MAX_HISTORY_DAYS = 30; // Keep 30 days of history

// Re-export types for backward compatibility
export type { DailyUsage, WeeklyUsage, MaxPlanHistoryData };

/**
 * Hook to track and manage historical Max Plan usage data.
 * Stores daily/weekly consumption in localStorage.
 */
export function useMaxPlanHistory() {
  const [history, setHistory] = useState<MaxPlanHistoryData>(() => loadHistory());

  // Save history to localStorage whenever it changes
  useEffect(() => {
    saveHistory(history);
  }, [history]);

  /**
   * Record today's usage (called when message count increments)
   */
  const recordUsage = (messageCount: number, tokensUsed: number, planType: MaxPlanType) => {
    const today = getTodayDateString();

    setHistory((prev) => {
      const dailyUsage = [...prev.dailyUsage];
      const existingDayIndex = dailyUsage.findIndex(d => d.date === today);

      if (existingDayIndex >= 0) {
        // Update existing day
        dailyUsage[existingDayIndex] = { date: today, messageCount, totalTokens: tokensUsed, planType };
      } else {
        // Add new day
        dailyUsage.push({ date: today, messageCount, totalTokens: tokensUsed, planType });
      }

      // Sort by date (newest first) and limit to MAX_HISTORY_DAYS
      dailyUsage.sort((a, b) => b.date.localeCompare(a.date));
      const trimmedDaily = dailyUsage.slice(0, MAX_HISTORY_DAYS);

      // Aggregate weekly usage
      const weeklyUsage = aggregateWeeklyUsage(trimmedDaily);

      // Calculate stats
      const totalMessages = trimmedDaily.reduce((sum, d) => sum + d.messageCount, 0);
      const totalTokens = trimmedDaily.reduce((sum, d) => sum + d.totalTokens, 0);
      const daysWithData = trimmedDaily.length;
      const averageMessagesPerDay = daysWithData > 0 ? totalMessages / daysWithData : 0;
      const averageTokensPerDay = daysWithData > 0 ? totalTokens / daysWithData : 0;

      const peakDay = trimmedDaily.length > 0
        ? trimmedDaily.reduce((max, d) => d.messageCount > max.messageCount ? d : max)
        : null;

      const peakWeek = weeklyUsage.length > 0
        ? weeklyUsage.reduce((max, w) => w.messageCount > max.messageCount ? w : max)
        : null;

      return {
        dailyUsage: trimmedDaily,
        weeklyUsage,
        totalMessages,
        totalTokens,
        averageMessagesPerDay,
        averageTokensPerDay,
        peakDay,
        peakWeek,
      };
    });
  };

  /**
   * Clear all historical data
   */
  const clearHistory = () => {
    setHistory({
      dailyUsage: [],
      weeklyUsage: [],
      totalMessages: 0,
      totalTokens: 0,
      averageMessagesPerDay: 0,
      averageTokensPerDay: 0,
      peakDay: null,
      peakWeek: null,
    });
  };

  /**
   * Export history as JSON for backup/analysis
   */
  const exportHistory = (): string => {
    return JSON.stringify(history, null, 2);
  };

  return {
    history,
    recordUsage,
    clearHistory,
    exportHistory,
  };
}

/**
 * Get today's date in YYYY-MM-DD format
 */
function getTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Get week number from date (ISO 8601 week)
 */
function getWeekString(dateStr: string): string {
  const date = new Date(dateStr);
  const year = date.getFullYear();
  const weekNumber = getISOWeek(date);
  return `${year}-W${String(weekNumber).padStart(2, '0')}`;
}

/**
 * Get ISO week number (1-53)
 */
function getISOWeek(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNumber = (date.getDay() + 6) % 7; // Monday = 0
  target.setDate(target.getDate() - dayNumber + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

/**
 * Aggregate daily usage into weekly buckets
 */
function aggregateWeeklyUsage(dailyUsage: DailyUsage[]): WeeklyUsage[] {
  const weekMap = new Map<string, WeeklyUsage>();

  dailyUsage.forEach((day) => {
    const week = getWeekString(day.date);

    if (!weekMap.has(week)) {
      weekMap.set(week, {
        week,
        messageCount: 0,
        totalTokens: 0,
        planType: day.planType,
      });
    }

    const weekData = weekMap.get(week)!;
    weekData.messageCount += day.messageCount;
    weekData.totalTokens += day.totalTokens;
  });

  return Array.from(weekMap.values()).sort((a, b) => b.week.localeCompare(a.week));
}

/**
 * Load history from localStorage
 */
function loadHistory(): MaxPlanHistoryData {
  try {
    const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.warn('[Max Plan History] Failed to load history from localStorage:', error);
  }

  // Return empty history
  return {
    dailyUsage: [],
    weeklyUsage: [],
    totalMessages: 0,
    totalTokens: 0,
    averageMessagesPerDay: 0,
    averageTokensPerDay: 0,
    peakDay: null,
    peakWeek: null,
  };
}

/**
 * Save history to localStorage
 */
function saveHistory(history: MaxPlanHistoryData) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
  } catch (error) {
    console.warn('[Max Plan History] Failed to save history to localStorage:', error);
  }
}
