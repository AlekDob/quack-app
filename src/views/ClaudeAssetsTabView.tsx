/**
 * ClaudeAssetsTabView - Tab view wrapper for Claude Assets Manager
 */

import { useMemo } from 'react';
import { ClaudeAssetsPanel } from '../components/claude-assets';
import type { Tab } from '../components/TabBar';
import type { TerminalInfo } from '../types';

interface ClaudeAssetsTabViewProps {
  tab: Tab;
  isActive: boolean;
  terminals: TerminalInfo[];
  onOpenFile?: (path: string) => void;
  onSelectCommand?: (commandName: string, commandScope: 'global' | 'project', isNew?: boolean, filePath?: string) => void;
  onSelectRule?: (ruleName: string, ruleScope: 'global' | 'project', isNew?: boolean, filePath?: string) => void;
  onSelectDroid?: (agentName: string, agentScope: 'global' | 'project', isNew?: boolean, filePath?: string) => void;
}

export default function ClaudeAssetsTabView({
  tab,
  isActive,
  terminals,
  onOpenFile,
  onSelectCommand,
  onSelectRule,
  onSelectDroid,
}: ClaudeAssetsTabViewProps) {
  // Don't render if not active or wrong tab type
  if (!isActive || tab.type !== 'claude-assets') return null;

  // Extract unique project paths from terminals
  const projectPaths = useMemo(() => {
    const paths = new Set<string>();
    terminals.forEach((t) => {
      if (t.cwd) {
        paths.add(t.cwd);
      }
      if (t.worktreePath) {
        paths.add(t.worktreePath);
      }
    });
    return Array.from(paths);
  }, [terminals]);

  return (
    <div className="claude-assets-tab-view" style={{ height: '100%' }}>
      <ClaudeAssetsPanel
        projectPaths={projectPaths}
        initialProjectPath={tab.initialProjectPath}
        onOpenFile={onOpenFile}
        onSelectCommand={onSelectCommand}
        onSelectRule={onSelectRule}
        onSelectDroid={onSelectDroid}
      />
    </div>
  );
}
