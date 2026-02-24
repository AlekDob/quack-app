import { useEffect, useState, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { useAutomationStore } from '../../stores/automationStore';
import AutomationJobCard from './AutomationJobCard';
import AutomationJobForm from './AutomationJobForm';
import AutomationHistoryList from './AutomationHistoryList';
import type { TerminalInfo, AutomationJob } from '../../types';
import './AutomationView.css';

interface AutomationViewProps {
  terminals: TerminalInfo[];
  onSessionClick?: (sessionId: string) => void;
  onExitAutomation?: () => void;
  onFireJob?: (job: AutomationJob) => void;
}

export default function AutomationView({
  terminals,
  onSessionClick,
  onExitAutomation,
  onFireJob,
}: AutomationViewProps) {
  const {
    jobs,
    history,
    isLoading,
    activeView,
    initialize,
    deleteJob,
    toggleJob,
    setActiveView,
    markJobRunning,
    markRunComplete,
    getRunningJobCount,
  } = useAutomationStore();

  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<AutomationJob | null>(null);

  // Initialize store on mount
  useEffect(() => {
    initialize();
  }, [initialize]);

  // Start scheduler and listen for tick events
  useEffect(() => {
    invoke('start_automation_scheduler').catch(err =>
      console.error('[Automation] Failed to start scheduler:', err)
    );

    const unlistenTick = listen('automation-scheduler-tick', () => {
      handleSchedulerTick();
    });

    return () => {
      unlistenTick.then(fn => fn());
    };
  }, []);

  // Check jobs on tick
  const handleSchedulerTick = useCallback(() => {
    const { jobs } = useAutomationStore.getState();
    const now = Date.now();

    for (const job of jobs) {
      if (!job.enabled || !job.nextRunAt) continue;
      if (now < job.nextRunAt) continue;
      if (job.skipIfRunning && job.lastRunStatus === 'running') continue;

      fireJob(job);
    }
  }, []);

  // Fire a job — delegates to parent (App.tsx) for session creation
  const fireJob = useCallback(async (job: AutomationJob) => {
    try {
      const run = await markJobRunning(job.id);
      await invoke('mark_automation_job_running', { jobId: job.id });

      // Delegate to parent for actual session creation
      if (onFireJob) {
        onFireJob(job);
      } else {
        // Fallback: just fire via Rust event
        await invoke('fire_automation_job', { job });
      }

      // Mark as success after 5s (parent may update sooner)
      setTimeout(async () => {
        const currentRun = useAutomationStore.getState().history.find(r => r.id === run.id);
        if (currentRun?.status === 'running') {
          await markRunComplete(run.id, 'success');
          await invoke('mark_automation_job_completed', { jobId: job.id });
        }
      }, 5000);
    } catch (err) {
      console.error('[Automation] Failed to fire job:', err);
    }
  }, [markJobRunning, markRunComplete, onFireJob]);

  const handleEdit = useCallback((job: AutomationJob) => {
    setEditingJob(job);
    setShowForm(true);
  }, []);

  const handleFormClose = useCallback(() => {
    setShowForm(false);
    setEditingJob(null);
  }, []);

  const handleFireNow = useCallback((job: AutomationJob) => {
    fireJob(job);
  }, [fireJob]);

  const runningCount = getRunningJobCount();

  if (isLoading) {
    return (
      <div className="automation-view">
        <div className="automation-loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="automation-view">
      {/* Header */}
      <div className="automation-header">
        <div className="automation-header-left">
          <h2 className="automation-title">Automation</h2>
          {runningCount > 0 && (
            <span className="automation-running-badge">{runningCount} running</span>
          )}
        </div>
        <div className="automation-header-right">
          <div className="automation-tab-switcher">
            <button
              className={`automation-tab-btn ${activeView === 'jobs' ? 'active' : ''}`}
              onClick={() => setActiveView('jobs')}
            >
              Jobs
            </button>
            <button
              className={`automation-tab-btn ${activeView === 'history' ? 'active' : ''}`}
              onClick={() => setActiveView('history')}
            >
              History
            </button>
          </div>
          {activeView === 'jobs' && (
            <button
              className="automation-add-btn"
              onClick={() => { setEditingJob(null); setShowForm(true); }}
            >
              + New Job
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="automation-content">
        {activeView === 'jobs' && (
          <div className="automation-jobs-list">
            {jobs.length === 0 ? (
              <div className="automation-empty">
                <div className="automation-empty-icon">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.3">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <p>No scheduled jobs</p>
                <p className="automation-empty-hint">
                  Create your first automation job to have agents work on a schedule.
                </p>
                <button
                  className="automation-add-btn"
                  onClick={() => setShowForm(true)}
                >
                  + New Job
                </button>
              </div>
            ) : (
              jobs.map(job => (
                <AutomationJobCard
                  key={job.id}
                  job={job}
                  terminals={terminals}
                  onToggle={() => toggleJob(job.id)}
                  onEdit={() => handleEdit(job)}
                  onDelete={() => deleteJob(job.id)}
                  onFireNow={() => handleFireNow(job)}
                />
              ))
            )}
          </div>
        )}

        {activeView === 'history' && (
          <AutomationHistoryList
            history={history}
            onSessionClick={onSessionClick}
          />
        )}
      </div>

      {/* Job Form Modal */}
      {showForm && (
        <AutomationJobForm
          terminals={terminals}
          editingJob={editingJob}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
