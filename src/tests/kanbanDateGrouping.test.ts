/**
 * Tests for Kanban Date Grouping Utility
 *
 * @module tests/kanbanDateGrouping
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDateBucket,
  getDateBucketLabel,
  groupTasksByCompletionDate,
  formatCompletionDate,
  getTotalTaskCount,
  type DateBucket,
} from '../utils/kanbanDateGrouping';
import type { KanbanTask } from '../types';

// Helper to create a mock task
function createMockTask(id: string, completedAt?: number): KanbanTask {
  return {
    id,
    title: `Task ${id}`,
    prompt: `Prompt for ${id}`,
    status: 'done',
    projectPath: '/test/project',
    projectName: 'Test Project',
    createdAt: Date.now() - 1000000,
    completedAt,
  };
}

// Helper to get timestamps for different time periods
function getTimestamps(now: Date) {
  const today = new Date(now);
  today.setHours(12, 0, 0, 0);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const threeDaysAgo = new Date(today);
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const tenDaysAgo = new Date(today);
  tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  return {
    today: today.getTime(),
    yesterday: yesterday.getTime(),
    threeDaysAgo: threeDaysAgo.getTime(),
    tenDaysAgo: tenDaysAgo.getTime(),
    thirtyDaysAgo: thirtyDaysAgo.getTime(),
  };
}

describe('kanbanDateGrouping', () => {
  const fixedNow = new Date('2026-01-02T12:00:00');
  let timestamps: ReturnType<typeof getTimestamps>;

  beforeEach(() => {
    timestamps = getTimestamps(fixedNow);
  });

  describe('getDateBucket', () => {
    it('should return "today" for tasks completed today', () => {
      const result = getDateBucket(timestamps.today, fixedNow);
      expect(result).toBe('today');
    });

    it('should return "yesterday" for tasks completed yesterday', () => {
      const result = getDateBucket(timestamps.yesterday, fixedNow);
      expect(result).toBe('yesterday');
    });

    it('should return "thisWeek" for tasks completed 3 days ago', () => {
      const result = getDateBucket(timestamps.threeDaysAgo, fixedNow);
      expect(result).toBe('thisWeek');
    });

    it('should return "lastWeek" for tasks completed 10 days ago', () => {
      const result = getDateBucket(timestamps.tenDaysAgo, fixedNow);
      expect(result).toBe('lastWeek');
    });

    it('should return "older" for tasks completed 30 days ago', () => {
      const result = getDateBucket(timestamps.thirtyDaysAgo, fixedNow);
      expect(result).toBe('older');
    });

    it('should handle midnight boundary correctly', () => {
      // Just before midnight of today
      const justBeforeMidnight = new Date(fixedNow);
      justBeforeMidnight.setHours(23, 59, 59, 999);

      // Just after midnight (should be yesterday)
      const justAfterMidnight = new Date(fixedNow);
      justAfterMidnight.setDate(justAfterMidnight.getDate() - 1);
      justAfterMidnight.setHours(23, 59, 59, 999);

      expect(getDateBucket(justBeforeMidnight.getTime(), fixedNow)).toBe('today');
      expect(getDateBucket(justAfterMidnight.getTime(), fixedNow)).toBe('yesterday');
    });
  });

  describe('getDateBucketLabel', () => {
    it('should return English labels', () => {
      expect(getDateBucketLabel('today')).toBe('Today');
      expect(getDateBucketLabel('yesterday')).toBe('Yesterday');
      expect(getDateBucketLabel('thisWeek')).toBe('This Week');
      expect(getDateBucketLabel('lastWeek')).toBe('Last Week');
      expect(getDateBucketLabel('older')).toBe('Older');
    });
  });

  describe('formatCompletionDate', () => {
    it('should format date in English', () => {
      const date = new Date('2026-01-02T12:00:00');
      const result = formatCompletionDate(date.getTime());
      expect(result).toMatch(/Jan.*2.*2026/i);
    });
  });

  describe('groupTasksByCompletionDate', () => {
    it('should group tasks by completion date', () => {
      const tasks: KanbanTask[] = [
        createMockTask('1', timestamps.today),
        createMockTask('2', timestamps.today),
        createMockTask('3', timestamps.yesterday),
        createMockTask('4', timestamps.threeDaysAgo),
        createMockTask('5', timestamps.thirtyDaysAgo),
      ];

      const groups = groupTasksByCompletionDate(tasks);

      expect(groups.length).toBe(4); // today, yesterday, thisWeek, older
      expect(groups[0].bucket).toBe('today');
      expect(groups[0].tasks.length).toBe(2);
      expect(groups[1].bucket).toBe('yesterday');
      expect(groups[1].tasks.length).toBe(1);
      expect(groups[2].bucket).toBe('thisWeek');
      expect(groups[2].tasks.length).toBe(1);
      expect(groups[3].bucket).toBe('older');
      expect(groups[3].tasks.length).toBe(1);
    });

    it('should sort tasks within groups by completedAt (most recent first)', () => {
      const tasks: KanbanTask[] = [
        createMockTask('1', timestamps.today - 1000), // Earlier today
        createMockTask('2', timestamps.today), // Later today
        createMockTask('3', timestamps.today - 500), // Middle
      ];

      const groups = groupTasksByCompletionDate(tasks);
      const todayGroup = groups.find((g) => g.bucket === 'today');

      expect(todayGroup).toBeDefined();
      expect(todayGroup!.tasks[0].id).toBe('2'); // Most recent first
      expect(todayGroup!.tasks[1].id).toBe('3');
      expect(todayGroup!.tasks[2].id).toBe('1');
    });

    it('should put tasks without completedAt in "older" bucket', () => {
      const tasks: KanbanTask[] = [
        createMockTask('1', timestamps.today),
        createMockTask('2', undefined), // No completedAt
      ];

      const groups = groupTasksByCompletionDate(tasks);
      const olderGroup = groups.find((g) => g.bucket === 'older');

      expect(olderGroup).toBeDefined();
      expect(olderGroup!.tasks.find((t) => t.id === '2')).toBeDefined();
    });

    it('should return empty array for empty task list', () => {
      const groups = groupTasksByCompletionDate([]);
      expect(groups).toEqual([]);
    });

    it('should not include empty buckets', () => {
      const tasks: KanbanTask[] = [
        createMockTask('1', timestamps.today),
        // No yesterday tasks
        createMockTask('2', timestamps.threeDaysAgo),
      ];

      const groups = groupTasksByCompletionDate(tasks);
      const buckets = groups.map((g) => g.bucket);

      expect(buckets).toContain('today');
      expect(buckets).not.toContain('yesterday');
      expect(buckets).toContain('thisWeek');
    });

    it('should maintain bucket order (today first, older last)', () => {
      const tasks: KanbanTask[] = [
        createMockTask('5', timestamps.thirtyDaysAgo), // older
        createMockTask('1', timestamps.today), // today
        createMockTask('4', timestamps.tenDaysAgo), // lastWeek
        createMockTask('2', timestamps.yesterday), // yesterday
        createMockTask('3', timestamps.threeDaysAgo), // thisWeek
      ];

      const groups = groupTasksByCompletionDate(tasks);
      const bucketOrder = groups.map((g) => g.bucket);

      expect(bucketOrder).toEqual(['today', 'yesterday', 'thisWeek', 'lastWeek', 'older']);
    });

    it('should use English labels', () => {
      const tasks: KanbanTask[] = [createMockTask('1', timestamps.today)];

      const groups = groupTasksByCompletionDate(tasks);
      expect(groups[0].label).toBe('Today');
    });
  });

  describe('getTotalTaskCount', () => {
    it('should return total count of tasks across all groups', () => {
      const tasks: KanbanTask[] = [
        createMockTask('1', timestamps.today),
        createMockTask('2', timestamps.today),
        createMockTask('3', timestamps.yesterday),
        createMockTask('4', timestamps.threeDaysAgo),
      ];

      const groups = groupTasksByCompletionDate(tasks);
      const total = getTotalTaskCount(groups);

      expect(total).toBe(4);
    });

    it('should return 0 for empty groups', () => {
      const total = getTotalTaskCount([]);
      expect(total).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle tasks at exactly midnight', () => {
      const midnight = new Date(fixedNow);
      midnight.setHours(0, 0, 0, 0);

      const result = getDateBucket(midnight.getTime(), fixedNow);
      expect(result).toBe('today');
    });

    it('should handle very old timestamps', () => {
      const veryOld = new Date('2020-01-01').getTime();
      const result = getDateBucket(veryOld, fixedNow);
      expect(result).toBe('older');
    });

    it('should handle future timestamps as today', () => {
      const future = new Date(fixedNow);
      future.setDate(future.getDate() + 1);

      const result = getDateBucket(future.getTime(), fixedNow);
      expect(result).toBe('today');
    });
  });
});
