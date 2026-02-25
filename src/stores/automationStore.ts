/**
 * Automation Store
 *
 * Zustand store for managing automation jobs and execution history.
 * Handles CRUD, scheduling state, and history tracking.
 *
 * @module automationStore
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { AutomationJob, AutomationRunHistory, AutomationRunStatus } from '../types';
import {
  loadAutomationJobs,
  saveAutomationJobs,
  loadAutomationHistory,
  saveAutomationHistory,
} from '../services/automationStorage';
import {
  generateAutomationId,
  generateRunId,
  getNextFireTime,
} from '../services/cronUtils';

// ─── Store Interface ────────────────────────────────────────────────

interface AutomationState {
  jobs: AutomationJob[];
  history: AutomationRunHistory[];
  isLoading: boolean;
  activeView: 'jobs' | 'history';

  // Lifecycle
  initialize: () => Promise<void>;

  // Job CRUD
  addJob: (job: Omit<AutomationJob, 'id' | 'createdAt' | 'updatedAt' | 'nextRunAt'>) => Promise<AutomationJob>;
  updateJob: (id: string, updates: Partial<AutomationJob>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  toggleJob: (id: string) => Promise<void>;

  // Execution
  markJobRunning: (jobId: string) => Promise<AutomationRunHistory>;
  markRunComplete: (runId: string, status: AutomationRunStatus, sessionId?: string, error?: string) => Promise<void>;

  // UI
  setActiveView: (view: 'jobs' | 'history') => void;
  getRunningJobCount: () => number;
}

// ─── Store Implementation ───────────────────────────────────────────

export const useAutomationStore = create<AutomationState>()(
  devtools(
    (set, get) => ({
      jobs: [],
      history: [],
      isLoading: false,
      activeView: 'jobs',

      initialize: async () => {
        set({ isLoading: true });
        const [jobs, history] = await Promise.all([
          loadAutomationJobs(),
          loadAutomationHistory(),
        ]);
        // Recalculate nextRunAt only if missing or in the past (preserve future timestamps)
        const now = Date.now();
        const updatedJobs = jobs.map(job => {
          if (!job.enabled) return job;
          if (job.nextRunAt && job.nextRunAt > now) return job; // Already scheduled in the future
          const nextRunAt = getNextFireTime(job.cronExpression, undefined, true) ?? undefined;
          return { ...job, nextRunAt };
        });
        set({ jobs: updatedJobs, history, isLoading: false });
        await saveAutomationJobs(updatedJobs);
      },

      addJob: async (jobData) => {
        const now = Date.now();
        const newJob: AutomationJob = {
          ...jobData,
          id: generateAutomationId(),
          createdAt: now,
          updatedAt: now,
          nextRunAt: jobData.enabled
            ? getNextFireTime(jobData.cronExpression, undefined, true) ?? undefined
            : undefined,
        };
        const jobs = [...get().jobs, newJob];
        set({ jobs });
        await saveAutomationJobs(jobs);
        return newJob;
      },

      updateJob: async (id, updates) => {
        const jobs = get().jobs.map(job => {
          if (job.id !== id) return job;
          const updated = { ...job, ...updates, updatedAt: Date.now() };
          // Recalculate nextRunAt if cron or enabled changed (inclusive: may fire this minute)
          if (updates.cronExpression !== undefined || updates.enabled !== undefined) {
            updated.nextRunAt = updated.enabled
              ? getNextFireTime(updated.cronExpression, undefined, true) ?? undefined
              : undefined;
          }
          return updated;
        });
        set({ jobs });
        await saveAutomationJobs(jobs);
      },

      deleteJob: async (id) => {
        const jobs = get().jobs.filter(j => j.id !== id);
        set({ jobs });
        await saveAutomationJobs(jobs);
      },

      toggleJob: async (id) => {
        const job = get().jobs.find(j => j.id === id);
        if (!job) return;
        await get().updateJob(id, { enabled: !job.enabled });
      },

      markJobRunning: async (jobId) => {
        const job = get().jobs.find(j => j.id === jobId);
        const run: AutomationRunHistory = {
          id: generateRunId(),
          jobId,
          jobName: job?.name ?? 'Unknown',
          startedAt: Date.now(),
          status: 'running',
        };
        const history = [...get().history, run];
        set({ history });
        await saveAutomationHistory(history);
        // Update job status
        await get().updateJob(jobId, {
          lastRunAt: run.startedAt,
          lastRunStatus: 'running',
        });
        return run;
      },

      markRunComplete: async (runId, status, sessionId, error) => {
        const now = Date.now();
        const history = get().history.map(run => {
          if (run.id !== runId) return run;
          return {
            ...run,
            completedAt: now,
            status,
            durationMs: now - run.startedAt,
            sessionId,
            error,
          };
        });
        set({ history });
        await saveAutomationHistory(history);
        // Update parent job status
        const run = history.find(r => r.id === runId);
        if (run) {
          await get().updateJob(run.jobId, { lastRunStatus: status });
        }
      },

      setActiveView: (view) => set({ activeView: view }),

      getRunningJobCount: () => {
        return get().history.filter(r => r.status === 'running').length;
      },
    }),
    { name: 'automation-store' }
  )
);
