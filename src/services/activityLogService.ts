/**
 * Activity Log Service
 *
 * Append-only JSONL event log for tracking project activities.
 * Feeds the Brain timeline view.
 *
 * @module services/activityLogService
 */

import { invoke } from '@tauri-apps/api/core';
import { normalizePath } from '../utils/platform';
import { getProjectDocPath } from './brainFileService';
import type { ActivityEvent } from '../types/activity';

const ACTIVITY_FILE = 'activity.jsonl';
const MAX_FILE_SIZE = 1_048_576; // 1MB

/**
 * Append an activity event to the project log
 */
export async function appendActivity(
  projectRoot: string,
  event: Omit<ActivityEvent, 'ts'>
): Promise<void> {
  const docPath = getProjectDocPath(projectRoot);
  const filePath = normalizePath(`${docPath}/${ACTIVITY_FILE}`);

  const fullEvent: ActivityEvent = {
    ts: new Date().toISOString(),
    ...event,
  };

  const line = JSON.stringify(fullEvent) + '\n';

  try {
    let existing = '';
    try {
      existing = await invoke<string>('read_file_content', { path: filePath });
    } catch {
      // File doesn't exist yet
    }

    // Rotate if too large
    if (existing.length > MAX_FILE_SIZE) {
      const date = new Date().toISOString().split('T')[0];
      const archivePath = normalizePath(`${docPath}/activity-${date}.jsonl`);
      await invoke('write_file_content', { path: archivePath, content: existing });
      existing = '';
    }

    await invoke('write_file_content', {
      path: filePath,
      content: existing + line,
    });
  } catch (err) {
    console.error('Failed to append activity:', err);
  }
}

/**
 * Read activity events from a project log
 */
export async function readActivities(
  projectRoot: string,
  options: {
    since?: string;
    limit?: number;
    type?: string;
  } = {}
): Promise<ActivityEvent[]> {
  const docPath = getProjectDocPath(projectRoot);
  const filePath = normalizePath(`${docPath}/${ACTIVITY_FILE}`);

  try {
    const raw = await invoke<string>('read_file_content', { path: filePath });
    const lines = raw.trim().split('\n').filter(Boolean);

    let events: ActivityEvent[] = lines
      .map(line => {
        try { return JSON.parse(line) as ActivityEvent; }
        catch { return null; }
      })
      .filter((e): e is ActivityEvent => e !== null);

    if (options.since) {
      events = events.filter(e => e.ts >= options.since!);
    }
    if (options.type) {
      events = events.filter(e => e.type === options.type);
    }

    // Most recent first
    events.reverse();

    if (options.limit) {
      events = events.slice(0, options.limit);
    }

    return events;
  } catch {
    return [];
  }
}
