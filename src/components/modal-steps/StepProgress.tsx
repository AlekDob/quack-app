/**
 * Step Progress Indicator - Compact Codex Style
 * Shows current step and completed steps in the agent creation flow
 * 2-step flow: project → agent
 */

import type { StepProgressProps, ModalStep } from './types';

// SVG icons for each step (compact, no emoji)
const StepIcons: Record<ModalStep, React.ReactNode> = {
  project: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  starters: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  agent: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="10" rx="2" />
      <circle cx="12" cy="5" r="2" />
      <path d="M12 7v4" />
      <line x1="8" y1="16" x2="8" y2="16" />
      <line x1="16" y1="16" x2="16" y2="16" />
    </svg>
  ),
};

// 2-step flow: project → agent
const STEPS: Array<{ id: ModalStep; label: string }> = [
  { id: 'project', label: 'Project' },
  { id: 'agent', label: 'Agent' },
];

export function StepProgress({ currentStep, completedSteps, isEditing }: StepProgressProps) {
  // Filter out Step 1 & 2 (project + agent) when editing externally
  const stepsToShow = isEditing
    ? STEPS.filter(s => s.id !== 'project' && s.id !== 'agent')
    : STEPS;

  const currentIndex = stepsToShow.findIndex(s => s.id === currentStep);

  return (
    <div className="step-progress">
      {stepsToShow.map((step, index) => {
        const isCompleted = completedSteps.includes(step.id);
        const isCurrent = step.id === currentStep;
        const isPending = index > currentIndex;

        return (
          <div
            key={step.id}
            className={`step-item ${isCurrent ? 'current' : ''} ${isCompleted ? 'completed' : ''} ${isPending ? 'pending' : ''}`}
          >
            <div className="step-indicator">
              <span className="step-icon">{StepIcons[step.id]}</span>
              {isCompleted && (
                <svg className="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              )}
            </div>
            <span className="step-label">{step.label}</span>
            {index < stepsToShow.length - 1 && (
              <svg className="step-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
