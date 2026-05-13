// Brain: 037-anthropic-compatible-providers
// In-memory per-session provider overrides. NOT persisted — lives only
// while the app is running. Per-session override wins over the global default.

import { useSyncExternalStore } from 'react';

type ProviderId = string;

const overrides = new Map<string, ProviderId>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

export function setSessionProviderOverride(sessionId: string, providerId: ProviderId | null): void {
  if (!providerId) {
    overrides.delete(sessionId);
  } else {
    overrides.set(sessionId, providerId);
  }
  notify();
}

export function getSessionProviderOverride(sessionId: string | undefined | null): ProviderId | null {
  if (!sessionId) return null;
  return overrides.get(sessionId) ?? null;
}

export function clearSessionProviderOverride(sessionId: string): void {
  if (overrides.delete(sessionId)) notify();
}

export function useSessionProviderOverride(sessionId: string | undefined | null): ProviderId | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (sessionId ? overrides.get(sessionId) ?? null : null),
    () => null,
  );
}
