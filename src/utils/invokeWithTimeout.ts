/**
 * Invoke Tauri command with timeout to prevent UI freeze
 *
 * CRITICAL FIX: Prevents app freeze when Tauri commands hang or take too long
 * Especially important in production builds where I/O operations can block
 */

import { invoke } from '@tauri-apps/api/core';

class TimeoutError extends Error {
  constructor(command: string, timeout: number) {
    super(`Command "${command}" timed out after ${timeout}ms`);
    this.name = 'TimeoutError';
  }
}

/**
 * Wrapper around Tauri invoke with configurable timeout
 *
 * @param command - The Tauri command to invoke
 * @param args - Arguments for the command
 * @param timeout - Timeout in milliseconds (default: 5000ms)
 * @returns Promise that resolves with command result or rejects on timeout/error
 *
 * @example
 * try {
 *   const result = await invokeWithTimeout('update_terminal', { id, label }, 3000);
 * } catch (error) {
 *   if (error instanceof TimeoutError) {
 *     console.error('Command timed out!');
 *   }
 * }
 */
export async function invokeWithTimeout<T>(
  command: string,
  args?: Record<string, unknown>,
  timeout: number = 5000
): Promise<T> {
  return Promise.race([
    invoke<T>(command, args),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new TimeoutError(command, timeout)), timeout)
    )
  ]);
}

/**
 * Fire-and-forget invoke - runs command in background without blocking UI
 *
 * Use this for non-critical operations that shouldn't block user interaction
 * (e.g., saving personality, logging, analytics)
 *
 * @param command - The Tauri command to invoke
 * @param args - Arguments for the command
 * @param onError - Optional error handler
 *
 * @example
 * fireAndForget('save_agent_personality', { personality }, (error) => {
 *   console.error('Personality save failed:', error);
 *   toast.warning('Personality save failed but terminal updated');
 * });
 */
export function fireAndForget(
  command: string,
  args?: Record<string, unknown>,
  onError?: (error: Error) => void
): void {
  invoke(command, args).catch((error) => {
    console.error(`Fire-and-forget command "${command}" failed:`, error);
    if (onError) {
      onError(error instanceof Error ? error : new Error(String(error)));
    }
  });
}
