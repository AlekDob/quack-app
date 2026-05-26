import { useEffect, useState } from 'react';

// Singleton minute-tick: ONE setInterval shared by all subscribers.
// Replaces per-component intervals used to refresh relative timestamps
// (e.g. "5m ago"). With N agent cards we used to spawn N timers — now 1.

let globalTick = 0;
const subscribers = new Set<(t: number) => void>();
let intervalId: ReturnType<typeof setInterval> | null = null;

function startTicker() {
  if (intervalId !== null) return;
  intervalId = setInterval(() => {
    globalTick += 1;
    subscribers.forEach((cb) => cb(globalTick));
  }, 60_000);
}

function maybeStopTicker() {
  if (subscribers.size === 0 && intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function useMinuteTick(): number {
  const [tick, setTick] = useState(globalTick);
  useEffect(() => {
    subscribers.add(setTick);
    startTicker();
    return () => {
      subscribers.delete(setTick);
      maybeStopTicker();
    };
  }, []);
  return tick;
}
