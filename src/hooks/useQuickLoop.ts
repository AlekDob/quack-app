import { useState, useCallback, useRef, useEffect } from 'react';

export type QuickLoopStatus = 'idle' | 'running' | 'paused' | 'stopped';

interface QuickLoopConfig {
  prompt: string;
  intervalMs: number;
  maxRuns?: number;
}

interface QuickLoopState {
  status: QuickLoopStatus;
  currentRun: number;
  prompt: string;
  intervalMs: number;
  maxRuns: number | undefined;
  startedAt: number | undefined;
  lastRunAt: number | undefined;
  nextRunAt: number | undefined;
}

interface UseQuickLoopReturn extends QuickLoopState {
  startLoop: (config: QuickLoopConfig) => void;
  stopLoop: () => void;
  pauseLoop: () => void;
  resumeLoop: () => void;
}

const MINIMUM_INTERVAL_MS = 10_000;
const WARN_INTERVAL_MS = 30_000;

const buildInitialState = (): QuickLoopState => ({
  status: 'idle',
  currentRun: 0,
  prompt: '',
  intervalMs: 60_000,
  maxRuns: undefined,
  startedAt: undefined,
  lastRunAt: undefined,
  nextRunAt: undefined,
});

export function useQuickLoop(onTick: (prompt: string, runNumber: number) => void): UseQuickLoopReturn {
  const [state, setState] = useState<QuickLoopState>(buildInitialState);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stateRef = useRef<QuickLoopState>(state);

  // Keep stateRef in sync so interval callback always reads fresh state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearActiveInterval = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const executeTick = useCallback((prompt: string, maxRuns: number | undefined, intervalMs: number) => {
    setState(prev => {
      const nextRun = prev.currentRun + 1;
      const now = Date.now();
      onTick(prompt, nextRun);

      const shouldAutoStop = maxRuns !== undefined && nextRun >= maxRuns;

      if (shouldAutoStop) {
        clearActiveInterval();
        return { ...prev, status: 'stopped', currentRun: nextRun, lastRunAt: now, nextRunAt: undefined };
      }

      return { ...prev, currentRun: nextRun, lastRunAt: now, nextRunAt: now + intervalMs };
    });
  }, [onTick, clearActiveInterval]);

  const startInterval = useCallback((prompt: string, intervalMs: number, maxRuns: number | undefined) => {
    clearActiveInterval();
    intervalRef.current = setInterval(() => {
      executeTick(prompt, maxRuns, intervalMs);
    }, intervalMs);
  }, [clearActiveInterval, executeTick]);

  const validateInterval = (intervalMs: number): number => {
    if (intervalMs < MINIMUM_INTERVAL_MS) {
      console.warn(`[QuickLoop] Interval ${intervalMs}ms is below minimum ${MINIMUM_INTERVAL_MS}ms. Clamping.`);
      return MINIMUM_INTERVAL_MS;
    }
    if (intervalMs < WARN_INTERVAL_MS) {
      console.warn(`[QuickLoop] Interval ${intervalMs}ms is below recommended ${WARN_INTERVAL_MS}ms.`);
    }
    return intervalMs;
  };

  const startLoop = useCallback((config: QuickLoopConfig) => {
    const safeInterval = validateInterval(config.intervalMs);
    const now = Date.now();

    setState({
      status: 'running',
      currentRun: 0,
      prompt: config.prompt,
      intervalMs: safeInterval,
      maxRuns: config.maxRuns,
      startedAt: now,
      lastRunAt: undefined,
      nextRunAt: now + safeInterval,
    });

    startInterval(config.prompt, safeInterval, config.maxRuns);
  }, [startInterval]);

  const stopLoop = useCallback(() => {
    clearActiveInterval();
    setState(buildInitialState);
  }, [clearActiveInterval]);

  const pauseLoop = useCallback(() => {
    clearActiveInterval();
    setState(prev => ({ ...prev, status: 'paused', nextRunAt: undefined }));
  }, [clearActiveInterval]);

  const resumeLoop = useCallback(() => {
    const { prompt, intervalMs, maxRuns } = stateRef.current;
    const now = Date.now();

    setState(prev => ({ ...prev, status: 'running', nextRunAt: now + intervalMs }));
    startInterval(prompt, intervalMs, maxRuns);
  }, [startInterval]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { clearActiveInterval(); };
  }, [clearActiveInterval]);

  return { ...state, startLoop, stopLoop, pauseLoop, resumeLoop };
}
