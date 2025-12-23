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
}

export default function ClaudeAssetsTabView({
  tab,
  isActive,
  terminals,
  onOpenFile,
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
        onOpenFile={onOpenFile}
      />
    </div>
  );
}
