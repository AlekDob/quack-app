import { invoke } from '@tauri-apps/api/core';

export type CodexAuthState = 'ready' | 'needs_login' | 'unknown';

/** Probe Codex auth via a 1-token read-only exec (spike §4.4: parse stdout, not exit code). */
export async function getCodexAuthStatus(): Promise<CodexAuthState> {
  try {
    const ok = await invoke<boolean>('codex_auth_status');
    return ok ? 'ready' : 'needs_login';
  } catch {
    return 'unknown';
  }
}
