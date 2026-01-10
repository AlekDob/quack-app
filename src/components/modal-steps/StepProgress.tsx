/**
 * Step Progress Indicator
 * Shows current step and completed steps in the agent creation flow
 * Project-first flow: project → agent → basics → rules → toolkit
 */

import type { StepProgressProps, ModalStep } from './types';

// Project-first 5-step flow: project → agent → basics → rules → toolkit
const STEPS: Array<{ id: ModalStep; label: string; icon: string }> = [
  { id: 'project', label: 'Project', icon: '📁' },
  { id: 'agent', label: 'Agent', icon: '🤖' },
  { id: 'basics', label: 'Basics', icon: '🎨' },
  { id: 'rules', label: 'Rules', icon: '📋' },
  { id: 'toolkit', label: 'Toolkit', icon: '🛠️' },
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
              <span className="step-icon">{step.icon}</span>
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
