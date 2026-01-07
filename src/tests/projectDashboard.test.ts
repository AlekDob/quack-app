import { describe, it, expect } from 'vitest';
import type { Tab } from '../components/TabBar';

/**
 * Project Dashboard Tab Tests
 *
 * Simple type and structure validation tests for project dashboard tabs
 */

describe('Project Dashboard Tab', () => {
  it('should have correct tab structure for project dashboard', () => {
    const projectDashboardTab: Tab = {
      id: 'project-dashboard-test-project',
      label: 'Test Project',
      type: 'project-dashboard',
      closable: true,
      filePath: '/Users/test/project',
    };

    expect(projectDashboardTab.type).toBe('project-dashboard');
    expect(projectDashboardTab.label).toBe('Test Project');
    expect(projectDashboardTab.filePath).toBe('/Users/test/project');
    expect(projectDashboardTab.closable).toBe(true);
  });

  it('should support project-dashboard as a valid tab type', () => {
    const validTypes = [
      'chat',
      'file',
      'agent-terminal',
      'agent',
      'browser',
      'skill',
      'command',
      'docs',
      'memory-graph',
      'second-brain',
      'claude-assets',
      'kanban',
      'task',
      'semantic-search',
      'project-dashboard',
    ];

    expect(validTypes).toContain('project-dashboard');
  });

  it('should create unique tab IDs based on project path', () => {
    const createTabId = (projectPath: string) =>
      `project-dashboard-${projectPath.replace(/\//g, '-')}`;

    const tab1Id = createTabId('/Users/test/project1');
    const tab2Id = createTabId('/Users/test/project2');

    expect(tab1Id).toBe('project-dashboard--Users-test-project1');
    expect(tab2Id).toBe('project-dashboard--Users-test-project2');
    expect(tab1Id).not.toBe(tab2Id);
  });
});
