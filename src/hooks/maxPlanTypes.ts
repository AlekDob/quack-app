/**
 * Max Plan Types
 * Centralized type definitions for Max Plan tracking
 * (Separated to avoid circular dependencies)
 */

export type MaxPlanType = 'pro' | 'max5x' | 'max20x';

export interface MaxPlanConfig {
  planType: MaxPlanType;
  messageLimit: number;
  tokenLimit: number;
  windowHours: number;
}

export interface MaxPlanSession {
  startTime: number; // Timestamp when first message was sent
  messageCount: number;
  totalTokens: number;
}

export interface MaxPlanStats {
  // Current session
  messageCount: number;
  messageLimit: number;
  messagePercentage: number;

  // Time tracking
  sessionStartTime: number;
  sessionDuration: number; // milliseconds
  windowEndsAt: number; // timestamp
  timeRemaining: number; // milliseconds

  // Burn rate & predictions
  burnRatePerHour: number;
  estimatedTimeUntilLimit: number; // milliseconds

  // Status
  planType: MaxPlanType;
  isNearLimit: boolean; // > 75%
  isCritical: boolean; // > 90%
}

// History tracking types
export interface DailyUsage {
  date: string; // YYYY-MM-DD format
  messageCount: number;
  totalTokens: number;
  planType: MaxPlanType;
}

export interface WeeklyUsage {
  week: string; // YYYY-WW format (e.g., "2025-W03")
  messageCount: number;
  totalTokens: number;
  planType: MaxPlanType;
}

export interface MaxPlanHistoryData {
  dailyUsage: DailyUsage[];
  weeklyUsage: WeeklyUsage[];
  totalMessages: number;
  totalTokens: number;
  averageMessagesPerDay: number;
  averageTokensPerDay: number;
  peakDay: DailyUsage | null;
  peakWeek: WeeklyUsage | null;
}
