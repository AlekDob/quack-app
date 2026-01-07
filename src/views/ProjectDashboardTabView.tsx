import ProjectDashboard from '../components/project-dashboard/ProjectDashboard';
import type { Tab } from '../components/TabBar';

interface ProjectDashboardTabViewProps {
  tab: Tab;
  isActive: boolean;
  onOpenKanban?: () => void;
  onOpenGitPanel?: () => void;
  onNewTask?: () => void;
  onLoadingChange?: (loading: boolean) => void;
}

/**
 * Wrapper component for project dashboard tab content
 * Renders the ProjectDashboard component when active
 */
export default function ProjectDashboardTabView({
  tab,
  isActive,
  onOpenKanban,
  onOpenGitPanel,
  onNewTask,
  onLoadingChange,
}: ProjectDashboardTabViewProps) {
  if (!isActive || tab.type !== 'project-dashboard') {
    return null;
  }

  const projectPath = tab.filePath || '';
  const projectName = tab.label;

  return (
    <div
      className="project-dashboard-tab-view"
      style={{
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <ProjectDashboard
        projectPath={projectPath}
        projectName={projectName}
        onOpenKanban={onOpenKanban}
        onOpenGitPanel={onOpenGitPanel}
        onNewTask={onNewTask}
        onLoadingChange={onLoadingChange}
      />
    </div>
  );
}
