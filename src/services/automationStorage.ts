/**
 * Automation Storage Service
 *
 * Persists automation jobs and run history to Tauri Store.
 * Follows the same pattern as unifiedAgentStorage.ts.
 *
 * @module automationStorage
 */

import { Store } from '@tauri-apps/plugin-store';
import { getTestModeStoreName } from '../utils/testModeStorage';
import type { AutomationJob, AutomationRunHistory } from '../types';

const STORAGE_FILE = 'quack-automations.json';
const JOBS_KEY = 'jobs';
const HISTORY_KEY = 'history';

const MAX_HISTORY_ENTRIES = 500;

// ─── Store Access ───────────────────────────────────────────────────

async function getStore(): Promise<Store> {
  return Store.load(getTestModeStoreName(STORAGE_FILE));
}

// ─── Jobs CRUD ──────────────────────────────────────────────────────

export async function loadAutomationJobs(): Promise<AutomationJob[]> {
  try {
    const store = await getStore();
    const jobs = await store.get<AutomationJob[]>(JOBS_KEY);
    return jobs ?? [];
  } catch (err) {
    console.error('[automationStorage] Failed to load jobs:', err);
    return [];
  }
}

export async function saveAutomationJobs(jobs: AutomationJob[]): Promise<void> {
  try {
    const store = await getStore();
    await store.set(JOBS_KEY, jobs);
    await store.save();
  } catch (err) {
    console.error('[automationStorage] Failed to save jobs:', err);
  }
}

// ─── History CRUD ───────────────────────────────────────────────────

export async function loadAutomationHistory(): Promise<AutomationRunHistory[]> {
  try {
    const store = await getStore();
    const history = await store.get<AutomationRunHistory[]>(HISTORY_KEY);
    return history ?? [];
  } catch (err) {
    console.error('[automationStorage] Failed to load history:', err);
    return [];
  }
}

export async function saveAutomationHistory(history: AutomationRunHistory[]): Promise<void> {
  try {
    // Enforce retention limit
    const trimmed = history.length > MAX_HISTORY_ENTRIES
      ? history.slice(-MAX_HISTORY_ENTRIES)
      : history;
    const store = await getStore();
    await store.set(HISTORY_KEY, trimmed);
    await store.save();
  } catch (err) {
    console.error('[automationStorage] Failed to save history:', err);
  }
}
