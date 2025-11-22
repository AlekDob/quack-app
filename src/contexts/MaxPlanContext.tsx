import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import type { MaxPlanStats, MaxPlanType, MaxPlanConfig, MaxPlanHistoryData } from '../hooks/maxPlanTypes';
import { useMaxPlanTracking } from '../hooks/useMaxPlanTracking';
import { useMaxPlanNotifications } from '../hooks/useMaxPlanNotifications';
import { useMaxPlanHistory } from '../hooks/useMaxPlanHistory';

interface MaxPlanContextValue {
  stats: MaxPlanStats;
  config: MaxPlanConfig;
  planType: MaxPlanType;
  history: MaxPlanHistoryData;
  setPlanType: (type: MaxPlanType) => void;
  incrementMessageCount: () => void;
  updateTokens: (tokens: number) => void;
  resetSession: () => void;
  clearHistory: () => void;
  exportHistory: () => string;
}

const MaxPlanContext = createContext<MaxPlanContextValue | null>(null);

export function MaxPlanProvider({ children }: { children: ReactNode }) {
  const maxPlanTracking = useMaxPlanTracking();
  const {
    history,
    recordUsage,
    clearHistory,
    exportHistory,
  } = useMaxPlanHistory();

  // Automatic notification system for limit warnings
  useMaxPlanNotifications(maxPlanTracking.stats);

  // Record usage to history whenever message count changes
  useEffect(() => {
    if (maxPlanTracking.stats.messageCount > 0) {
      const totalTokens = 0; // We can add token tracking later if needed
      recordUsage(
        maxPlanTracking.stats.messageCount,
        totalTokens,
        maxPlanTracking.planType
      );
    }
  }, [maxPlanTracking.stats.messageCount, maxPlanTracking.planType, recordUsage]);

  return (
    <MaxPlanContext.Provider
      value={{
        ...maxPlanTracking,
        history,
        clearHistory,
        exportHistory,
      }}
    >
      {children}
    </MaxPlanContext.Provider>
  );
}

export function useMaxPlan() {
  const context = useContext(MaxPlanContext);
  if (!context) {
    throw new Error('useMaxPlan must be used within MaxPlanProvider');
  }
  return context;
}
