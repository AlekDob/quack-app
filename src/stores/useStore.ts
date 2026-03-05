import { useShallow } from 'zustand/react/shallow';
import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * Custom hook for efficient Zustand store subscriptions
 * Automatically applies shallow equality check to prevent unnecessary re-renders
 *
 * Usage:
 * ```typescript
 * // Instead of:
 * const { terminals, activeId } = useTerminalStore((state) => ({
 *   terminals: state.terminals,
 *   activeId: state.activeId,
 * }));
 *
 * // Use:
 * const { terminals, activeId } = useStore(useTerminalStore, (state) => ({
 *   terminals: state.terminals,
 *   activeId: state.activeId,
 * }));
 * ```
 */
export function useStore<T, U>(
  store: UseBoundStore<StoreApi<T>>,
  selector: (state: T) => U
): U {
  return store(useShallow(selector));
}

/**
 * Hook for subscribing to multiple stores at once
 *
 * Usage:
 * ```typescript
 * const { terminals, showModal, gitSummary } = useMultiStore({
 *   terminals: [useTerminalStore, (s) => s.terminals],
 *   showModal: [useUIStore, (s) => s.showNewTerminalModal],
 *   gitSummary: [useGitStore, (s) => s.gitSummary],
 * });
 * ```
 */
export function useMultiStore<T extends Record<string, [any, (state: any) => any]>>(
  selectors: T
): { [K in keyof T]: ReturnType<T[K][1]> } {
  const result = {} as { [K in keyof T]: ReturnType<T[K][1]> };

  for (const key in selectors) {
    const [store, selector] = selectors[key];
    result[key] = store(useShallow(selector));
  }

  return result;
}

/**
 * Hook for subscribing to a single value from a store
 * Optimized for primitive values that don't need shallow comparison
 *
 * Usage:
 * ```typescript
 * const activeId = useStoreValue(useTerminalStore, (s) => s.activeId);
 * const isLoading = useStoreValue(useGitStore, (s) => s.loadingGit);
 * ```
 */
export function useStoreValue<T, U>(
  store: UseBoundStore<StoreApi<T>>,
  selector: (state: T) => U
): U {
  return store(selector);
}

/**
 * Hook for subscribing only to store actions (no re-renders)
 *
 * Usage:
 * ```typescript
 * const { addTerminal, removeTerminal } = useStoreActions(useTerminalStore, (s) => ({
 *   addTerminal: s.addTerminal,
 *   removeTerminal: s.removeTerminal,
 * }));
 * ```
 */
export function useStoreActions<T, U extends Record<string, Function>>(
  store: UseBoundStore<StoreApi<T>>,
  selector: (state: T) => U
): U {
  // Actions don't change, so we can use a static selector
  return store(selector);
}