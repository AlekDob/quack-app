/**
 * Performance optimization utilities for Quack
 * Provides debouncing, throttling, and memoization helpers
 */

/**
 * Debounce function - delays execution until after wait milliseconds have elapsed
 * since the last time the debounced function was invoked
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function debounced(...args: Parameters<T>) {
    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(() => {
      func(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Throttle function - ensures a function doesn't get called more than once
 * in a specified time period
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  let lastArgs: Parameters<T> | null = null;
  let lastContext: any = null;

  return function throttled(this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          throttled.apply(lastContext, lastArgs);
          lastArgs = null;
          lastContext = null;
        }
      }, limit);
    } else {
      lastArgs = args;
      lastContext = this;
    }
  };
}

/**
 * Request Animation Frame throttle - for smooth animations
 */
export function rafThrottle<T extends (...args: any[]) => any>(
  func: T
): (...args: Parameters<T>) => void {
  let rafId: number | null = null;
  let lastArgs: Parameters<T> | null = null;

  return function rafThrottled(...args: Parameters<T>) {
    lastArgs = args;

    if (!rafId) {
      rafId = requestAnimationFrame(() => {
        if (lastArgs) {
          func(...lastArgs);
        }
        rafId = null;
        lastArgs = null;
      });
    }
  };
}

/**
 * Memoize function results with LRU cache
 */
export function memoize<T extends (...args: any[]) => any>(
  func: T,
  options: {
    maxSize?: number;
    keyGenerator?: (...args: any[]) => string;
  } = {}
): T {
  const { maxSize = 100, keyGenerator = JSON.stringify } = options;
  const cache = new Map<string, ReturnType<T>>();

  return ((...args: Parameters<T>): ReturnType<T> => {
    // @ts-expect-error - TypeScript struggles with rest parameter spreading
    const key = keyGenerator(...args);

    if (cache.has(key)) {
      // Move to end (LRU)
      const value = cache.get(key)!;
      cache.delete(key);
      cache.set(key, value);
      return value;
    }

    // @ts-ignore - TypeScript spread args issue
    const result = func(...args);

    // Evict oldest if at capacity
    if (cache.size >= maxSize) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) {
        cache.delete(firstKey);
      }
    }

    cache.set(key, result);
    return result;
  }) as T;
}

/**
 * Batch updates to avoid multiple renders
 */
export function batchUpdates<T>(
  updateFn: (batch: T[]) => void,
  wait: number = 16 // ~1 frame at 60fps
): (item: T) => void {
  let batch: T[] = [];
  let timeout: NodeJS.Timeout | null = null;

  return (item: T) => {
    batch.push(item);

    if (!timeout) {
      timeout = setTimeout(() => {
        const currentBatch = [...batch];
        batch = [];
        timeout = null;
        updateFn(currentBatch);
      }, wait);
    }
  };
}

/**
 * Check if component should update based on shallow comparison
 */
export function shallowEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;

  if (!obj1 || !obj2) return false;

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (obj1[key] !== obj2[key]) return false;
  }

  return true;
}

/**
 * Deep comparison for complex objects
 */
export function deepEqual(obj1: any, obj2: any): boolean {
  if (obj1 === obj2) return true;

  if (!obj1 || !obj2) return false;

  if (typeof obj1 !== 'object' || typeof obj2 !== 'object') {
    return obj1 === obj2;
  }

  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);

  if (keys1.length !== keys2.length) return false;

  for (const key of keys1) {
    if (!deepEqual(obj1[key], obj2[key])) return false;
  }

  return true;
}