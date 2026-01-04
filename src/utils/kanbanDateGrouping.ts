/**
 * Kanban Date Grouping Utility
 *
 * Groups completed tasks by date for the Done column.
 * Provides localized date labels (Today, Yesterday, date format).
 *
 * @module utils/kanbanDateGrouping
 */

import type { KanbanTask } from '../types';

/**
 * Date bucket types for grouping
 */
export type DateBucket = 'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'older';

/**
 * Grouped tasks structure
 */
export interface DateGroup {
  bucket: DateBucket;
  label: string;
  tasks: KanbanTask[];
}

/**
 * Get start of day in local timezone
 */
function getStartOfDay(date: Date): Date {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  return start;
}

/**
 * Get the date bucket for a given timestamp
 */
export function getDateBucket(timestamp: number, now: Date = new Date()): DateBucket {
  const taskDate = new Date(timestamp);
  const today = getStartOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const twoWeeksAgo = new Date(today);
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

  const taskDay = getStartOfDay(taskDate);

  if (taskDay.getTime() >= today.getTime()) {
    return 'today';
  }
  if (taskDay.getTime() >= yesterday.getTime()) {
    return 'yesterday';
  }
  if (taskDay.getTime() >= weekAgo.getTime()) {
    return 'thisWeek';
  }
  if (taskDay.getTime() >= twoWeeksAgo.getTime()) {
    return 'lastWeek';
  }
  return 'older';
}

/**
 * Get localized label for date bucket
 */
export function getDateBucketLabel(bucket: DateBucket): string {
  switch (bucket) {
    case 'today':
      return 'Today';
    case 'yesterday':
      return 'Yesterday';
    case 'thisWeek':
      return 'This Week';
    case 'lastWeek':
      return 'Last Week';
    case 'older':
      return 'Older';
    default:
      return bucket;
  }
}

/**
 * Format a specific date as a human-readable string
 * Used for tasks with specific dates (e.g., "2 Gen 2026")
 */
export function formatCompletionDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Group tasks by completion date buckets
 * Returns groups sorted by recency (today first, older last)
 * Tasks within each group are sorted by completedAt (most recent first)
 *
 * @param tasks - Array of tasks to group
 * @param now - Reference date for bucket calculation (defaults to current date)
 */
export function groupTasksByCompletionDate(tasks: KanbanTask[], now: Date = new Date()): DateGroup[] {

  // Initialize buckets
  const buckets: Record<DateBucket, KanbanTask[]> = {
    today: [],
    yesterday: [],
    thisWeek: [],
    lastWeek: [],
    older: [],
  };

  // Group tasks by bucket
  tasks.forEach((task) => {
    // Only group tasks that have completedAt
    if (task.completedAt) {
      const bucket = getDateBucket(task.completedAt, now);
      buckets[bucket].push(task);
    } else {
      // Tasks without completedAt go to "older" bucket
      buckets.older.push(task);
    }
  });

  // Sort tasks within each bucket (most recent first)
  Object.keys(buckets).forEach((key) => {
    const bucket = key as DateBucket;
    buckets[bucket].sort((a, b) => {
      const aTime = a.completedAt || a.createdAt || 0;
      const bTime = b.completedAt || b.createdAt || 0;
      return bTime - aTime; // Descending (most recent first)
    });
  });

  // Build result array with non-empty groups
  const bucketOrder: DateBucket[] = ['today', 'yesterday', 'thisWeek', 'lastWeek', 'older'];

  return bucketOrder
    .filter((bucket) => buckets[bucket].length > 0)
    .map((bucket) => ({
      bucket,
      label: getDateBucketLabel(bucket),
      tasks: buckets[bucket],
    }));
}

/**
 * Get the total count of tasks across all groups
 */
export function getTotalTaskCount(groups: DateGroup[]): number {
  return groups.reduce((sum, group) => sum + group.tasks.length, 0);
}
