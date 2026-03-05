/**
 * ProjectToast Component
 *
 * Elegant toast notification with project context.
 * Shows avatar, project name badge, and message with
 * dynamic project color accent.
 */

import { toast } from 'sonner';
import './ProjectToast.css';

interface ProjectToastProps {
  projectName: string;
  projectColor: string;
  agentName?: string;
  agentAvatar?: string;
  message: string;
  type?: 'success' | 'info' | 'warning' | 'error';
}

function ProjectToast({
  projectName,
  projectColor,
  agentName,
  agentAvatar,
  message,
  type = 'success',
}: ProjectToastProps) {
  // Extract short project name (last part of path)
  const shortProjectName = projectName.split('/').pop() || projectName;

  return (
    <div
      className={`project-toast project-toast--${type}`}
      style={{ '--project-color': projectColor } as React.CSSProperties}
    >
      {/* Avatar */}
      {agentAvatar && (
        <div className="project-toast__avatar">
          <img src={agentAvatar} alt={agentName || 'Agent'} />
        </div>
      )}

      {/* Content */}
      <div className="project-toast__content">
        {/* Project Badge */}
        <div className="project-toast__header">
          <span className="project-toast__badge" style={{ backgroundColor: `${projectColor}20`, color: projectColor }}>
            {shortProjectName}
          </span>
          {agentName && (
            <span className="project-toast__agent">{agentName}</span>
          )}
        </div>

        {/* Message */}
        <p className="project-toast__message">{message}</p>
      </div>

      {/* Accent line */}
      <div className="project-toast__accent" style={{ backgroundColor: projectColor }} />
    </div>
  );
}

/**
 * Show a project-aware toast notification
 */
export function showProjectToast(props: ProjectToastProps, duration = 4000) {
  return toast.custom(
    (t) => (
      <div
        className="project-toast-wrapper"
        data-visible={t !== undefined}
        onClick={() => toast.dismiss(t)}
      >
        <ProjectToast {...props} />
      </div>
    ),
    {
      duration,
      position: 'bottom-right',
    }
  );
}

/**
 * Convenience methods for different toast types
 */
const projectToast = {
  success: (props: Omit<ProjectToastProps, 'type'>, duration?: number) =>
    showProjectToast({ ...props, type: 'success' }, duration),

  info: (props: Omit<ProjectToastProps, 'type'>, duration?: number) =>
    showProjectToast({ ...props, type: 'info' }, duration),

  warning: (props: Omit<ProjectToastProps, 'type'>, duration?: number) =>
    showProjectToast({ ...props, type: 'warning' }, duration),

  error: (props: Omit<ProjectToastProps, 'type'>, duration?: number) =>
    showProjectToast({ ...props, type: 'error' }, duration),
};

