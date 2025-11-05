import { type MouseEvent, useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import TerminalActivityBar from './TerminalActivityBar';
import MetroLine from './MetroLine';
import CommitHistoryModal from './CommitHistoryModal';
import RevealInFinderButton from './RevealInFinderButton';
import type { TerminalInfo, ChatMessage, GitPullResult, GitStatusSummary } from '../types';

interface RepositoryGroupProps {
  repoPath: string;
  repoName: string;
  mainAgents: TerminalInfo[];
  worktreeAgents: TerminalInfo[];
  isCollapsed: boolean;
  activeId: string | null;
  chatSessions?: Map<string, ChatMessage[]>;
  onToggle: () => void;
  onSelect: (terminal: TerminalInfo) => void;
  onClose: (id: string) => void;
  onContextMenu: (event: MouseEvent, terminal: TerminalInfo) => void;
  onGitOperation?: (operation: string, terminal: TerminalInfo) => void;
  onOpenGitPanel?: () => void; // NEW: Function to open Git Panel drawer
}

// Helper to extract repository name from path
function getRepoDisplayName(path: string): string {
  const parts = path.split('/');
  const lastPart = parts[parts.length - 1];
  if (lastPart.includes('-worktree-')) {
    return lastPart.split('-worktree-')[0];
  }
  return lastPart;
}

// Helper to extract branch name from worktree path or terminal info
function getBranchName(terminal: TerminalInfo): string {
  if (terminal.branch) return terminal.branch;
  const pathParts = terminal.cwd.split('/');
  const lastPart = pathParts[pathParts.length - 1];
  if (lastPart.includes('-worktree-')) {
    const branchPart = lastPart.split('-worktree-')[1];
    return branchPart.replace(/-/g, '/');
  }
  return 'main';
}

export default function RepositoryGroup({
  repoPath,
  repoName,
  mainAgents,
  worktreeAgents,
  isCollapsed,
  activeId,
  chatSessions,
  onToggle,
  onSelect,
  onClose,
  onContextMenu,
  onGitOperation,
  onOpenGitPanel,
}: RepositoryGroupProps) {
  const [hoveredAgentId, setHoveredAgentId] = useState<string | null>(null);
  const [showGitMenu, setShowGitMenu] = useState<string | null>(null);
  const [commitHistoryModal, setCommitHistoryModal] = useState<{
    branchName: string;
    rootPath: string;
  } | null>(null);
  const [branchModifiedFiles, setBranchModifiedFiles] = useState<Map<string, number>>(new Map());
  const displayName = getRepoDisplayName(repoName);
  const hasWorktrees = worktreeAgents.length > 0;

  // Intelligent Git Operations Handler
  const handleGitOperation = async (operation: string, terminal: TerminalInfo) => {
    const rootPath = terminal.worktreePath || terminal.cwd;
    const branchName = terminal.branch || 'main';

    try {
      // Operations that need uncommitted changes check
      const needsCheck = ['pull', 'push', 'merge-to-main'];

      if (needsCheck.includes(operation)) {
        // Check for uncommitted changes
        const hasUncommitted = await invoke<boolean>('git_has_uncommitted_changes', { rootPath });

        if (hasUncommitted) {
          // Show alert and ask to open Git Panel
          const userConfirmed = window.confirm(
            `⚠️ Modifiche Non Committate\n\n` +
            `Hai modifiche non committate nel branch "${branchName}".\n\n` +
            `Vuoi aprire il Git Panel per committare le modifiche prima di procedere?`
          );

          if (userConfirmed && onOpenGitPanel) {
            onOpenGitPanel();
            return;
          } else {
            // User cancelled
            return;
          }
        }
      }

      // Handle different operations
      switch (operation) {
        case 'pull': {
          const result = await invoke<GitPullResult>('git_pull', {
            branchName,
            rootPath,
          });

          if (result.hasConflicts) {
            alert(`Pull has conflicts in ${result.conflictedFiles.length} file(s):\n${result.conflictedFiles.join('\n')}`);
          } else {
            console.log(`✅ Pull successful: ${result.message}`);
          }
          break;
        }

        case 'push': {
          const result = await invoke<string>('git_push', {
            branchName,
            force: false,
            rootPath,
          });
          console.log(`✅ Push successful: ${result}`);
          break;
        }

        case 'merge-to-main': {
          const confirmed = window.confirm(
            `Vuoi mergeare il branch "${branchName}" in main?\n\n` +
            `Questa operazione:\n` +
            `1. Switcha a main\n` +
            `2. Mergia ${branchName} in main\n\n` +
            `Continua?`
          );

          if (!confirmed) return;

          await invoke('git_switch_branch', {
            branchName: 'main',
            rootPath,
          });

          const result = await invoke<{
            success: boolean;
            hasConflicts: boolean;
            conflictedFiles: string[];
            message: string;
          }>('git_merge_branch', {
            branchName,
            rootPath,
          });

          if (result.hasConflicts) {
            alert(`Merge has conflicts in ${result.conflictedFiles.length} file(s):\n${result.conflictedFiles.join('\n')}`);
          } else {
            console.log(`✅ Merge successful: ${result.message}`);
          }
          break;
        }

        case 'create-pr': {
          const prUrl = await generatePRUrl(rootPath, branchName);
          if (prUrl) {
            window.open(prUrl, '_blank');
          } else {
            alert('Could not generate PR URL. Make sure the repository has a remote configured.');
          }
          break;
        }

        case 'view-commits': {
          setCommitHistoryModal({
            branchName,
            rootPath,
          });
          break;
        }

        case 'delete-worktree': {
          const confirmed = window.confirm(
            `Sei sicuro di voler eliminare il worktree per "${branchName}"?\n\n` +
            `Questo rimuoverà:\n` +
            `- ${rootPath}\n\n` +
            `Il branch continuerà ad esistere nel repository.`
          );

          if (confirmed) {
            await invoke('git_remove_worktree', {
              path: rootPath,
              force: false,
              rootPath: terminal.cwd,
            });
            console.log(`✅ Worktree deleted: ${rootPath}`);
            onClose(terminal.id);
          }
          break;
        }

        default:
          console.warn(`Unknown git operation: ${operation}`);
      }

      // Refresh git status after operation completes (only for active terminal)
      fetchActiveTerminalGitStatus();
    } catch (error) {
      console.error(`Git operation failed:`, error);
      alert(`Git operation failed: ${error}`);
    }
  };

  // Helper to generate PR URL
  const generatePRUrl = async (rootPath: string, branchName: string): Promise<string | null> => {
    try {
      const remoteUrl = await invoke<string>('git_get_remote_url', { rootPath });

      if (remoteUrl.includes('github.com')) {
        const match = remoteUrl.match(/github\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
        if (match) {
          const [, owner, repo] = match;
          return `https://github.com/${owner}/${repo}/compare/${branchName}?expand=1`;
        }
      } else if (remoteUrl.includes('gitlab.com')) {
        const match = remoteUrl.match(/gitlab\.com[:/]([^/]+)\/(.+?)(\.git)?$/);
        if (match) {
          const [, owner, repo] = match;
          return `https://gitlab.com/${owner}/${repo}/-/merge_requests/new?merge_request[source_branch]=${branchName}`;
        }
      }

      return null;
    } catch (error) {
      console.error('Failed to generate PR URL:', error);
      return null;
    }
  };

  // Fetch git status for the ACTIVE terminal's branch ONLY (performance optimization)
  const fetchActiveTerminalGitStatus = async () => {
    if (!activeId) {
      // No active terminal, clear badge
      setBranchModifiedFiles(new Map());
      return;
    }

    // Find the active terminal from main agents or worktrees
    const activeTerminal = [...mainAgents, ...worktreeAgents].find(a => a.id === activeId);
    if (!activeTerminal) {
      setBranchModifiedFiles(new Map());
      return;
    }

    const branchName = activeTerminal.branch || getBranchName(activeTerminal);
    const rootPath = activeTerminal.worktreePath || activeTerminal.cwd;

    try {
      // Fetch ONLY for the active terminal's branch
      const count = await invoke<number>('git_uncommitted_files_count', { rootPath });
      // Store ONLY this branch in the map - badge will show only here!
      setBranchModifiedFiles(new Map([[branchName, count]]));
    } catch (error) {
      console.error(`Failed to fetch git status for active terminal:`, error);
      setBranchModifiedFiles(new Map([[branchName, 0]]));
    }
  };

  // Fetch git status when active terminal changes (no more polling!)
  useEffect(() => {
    fetchActiveTerminalGitStatus();
  }, [activeId, mainAgents, worktreeAgents]);

  // Group agents by branch
  const agentsByBranch = new Map<string, TerminalInfo[]>();

  // Process main repository agents
  mainAgents.forEach(agent => {
    const branchName = agent.branch || 'main';
    if (!agentsByBranch.has(branchName)) {
      agentsByBranch.set(branchName, []);
    }
    agentsByBranch.get(branchName)!.push(agent);
  });

  // Sort branches: main first, then others alphabetically
  const sortedBranches = Array.from(agentsByBranch.entries()).sort(([a], [b]) => {
    if (a === 'main') return -1;
    if (b === 'main') return 1;
    return a.localeCompare(b);
  });

  return (
    <div className="repository-group">
      {/* Repository Header - Minimal and clean */}
      <div
        className="repository-header"
        onClick={onToggle}
        style={{
          cursor: 'pointer',
          padding: '10px 12px',
          marginBottom: '8px',
          background: 'rgba(255, 255, 255, 0.02)',
          borderRadius: '6px',
          transition: 'background 0.2s ease',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
        }}
      >
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-2">
            <svg
              className={`w-4 h-4 transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            <span className="font-semibold text-sm text-white/90">
              {displayName}
            </span>
            <span className="text-xs text-white/40 font-mono">
              ({mainAgents.length + worktreeAgents.length} agents)
            </span>
          </div>

          {/* Reveal in Finder button */}
          <div onClick={(e) => e.stopPropagation()}>
            <RevealInFinderButton
              path={repoPath}
              iconOnly={true}
              className="opacity-60 hover:opacity-100 transition-opacity"
            />
          </div>
        </div>
      </div>

      {/* Expanded Content with Metro Map Design */}
      {!isCollapsed && (
        <div className="repository-content relative" style={{ marginLeft: '8px', position: 'relative' }}>

          {/* SINGLE CONTINUOUS LINE for entire repository */}
          <div
            className="continuous-metro-line"
            style={{
              position: 'absolute',
              left: '20px',
              top: '40px', // Start from first agent position
              bottom: '0',
              width: '2px',
              background: mainAgents[0]?.color || worktreeAgents[0]?.color || '#10b981',
              opacity: 0.3,
              zIndex: 1,
            }}
          />

          {/* Branch Groups */}
          {sortedBranches.map(([branchName, agents], branchIndex) => (
            <div key={branchName} className="branch-group relative" style={{ marginBottom: '24px' }}>
              {/* Branch Header */}
              <div
                className="branch-header mb-3"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginLeft: '32px',
                }}
              >
                <span
                  className="text-white/60 font-mono"
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
                  }}
                >
                  {branchName} ({agents.length} agent{agents.length !== 1 ? 's' : ''})
                </span>
                {/* Modified Files Badge - Clickable to open Git Panel */}
                {(branchModifiedFiles.get(branchName) || 0) > 0 && (
                  <div
                    className="modified-files-badge"
                    title={`${branchModifiedFiles.get(branchName)} files to commit - Click to open Git Panel`}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onOpenGitPanel) onOpenGitPanel();
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#d97706';  // Darker orange on hover
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f59e0b';  // Back to amber
                    }}
                    style={{
                      background: '#f59e0b',
                      color: '#fff',
                      borderRadius: '8px',
                      padding: '1px 6px',
                      fontSize: '9px',
                      fontWeight: 600,
                      cursor: 'pointer',  // Changed from 'default' to 'pointer'
                      userSelect: 'none',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    {branchModifiedFiles.get(branchName)}
                  </div>
                )}
              </div>

              {/* Agents in this branch */}
              {agents.map((agent, index) => {
                const isActive = agent.id === activeId;
                const isHovered = agent.id === hoveredAgentId;

                return (
                  <div
                    key={agent.id}
                    className="relative"
                    style={{ marginBottom: '8px' }}
                  >
                    {/* Metro Station Dot - Circle for main branches */}
                    <div
                      className="metro-station-dot"
                      style={{
                        position: 'absolute',
                        left: '16px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',  // Circle for main branches
                        background: agent.color,
                        border: `2px solid ${agent.color}`,
                        boxShadow: `0 0 8px ${agent.color}66`,
                        zIndex: 10,
                      }}
                    />

                    {/* Agent Card - Now without branch name since it's in the header */}
                    <div
                      className={`agent-card`}
                      onClick={() => onSelect(agent)}
                      onContextMenu={(e) => onContextMenu(e, agent)}
                      onMouseEnter={() => setHoveredAgentId(agent.id)}
                      onMouseLeave={() => setHoveredAgentId(null)}
                      style={{
                        marginLeft: '36px',
                        padding: '8px 12px',
                        background: isActive
                          ? `${agent.color}15`  // Use agent color for active background
                          : isHovered
                          ? 'rgba(255, 255, 255, 0.03)'
                          : 'transparent',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      <div className="flex w-full items-center justify-between">
                        <div className="flex w-full items-center gap-2 flex-1">
                          <TerminalActivityBar
                            terminal={agent}
                            chatSessions={chatSessions}
                            hideBranch={true}  // Hide branch badge since it's in the header
                          />
                        </div>

                        {/* Action buttons wrapper - NO GAP between icons */}
                        <div
                          className="icons-wrapper"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',  // Small custom gap between icons, NOT inheriting parent gap
                            marginLeft: 'auto',
                          }}
                        >
                          {/* Git Branch Icon - shown on hover */}
                          {agent.branch && (
                            <div
                              className="git-branch-icon"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowGitMenu(showGitMenu === agent.id ? null : agent.id);
                              }}
                              style={{
                                opacity: isHovered ? 1 : 0,  // FIXED: Now truly only shows on hover
                                visibility: isHovered ? 'visible' : 'hidden',  // Double protection
                                transition: 'opacity 0.2s ease, visibility 0.2s ease',
                                cursor: 'pointer',
                                padding: '6px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'transparent',
                                pointerEvents: isHovered ? 'auto' : 'none',  // Prevent clicks when invisible
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(78, 205, 196, 0.15)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {/* SVG Git Branch Icon - Original from GitSidebar */}
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#4ecdc4"
                                strokeWidth="2"
                              >
                                <line x1="6" y1="3" x2="6" y2="15" />
                                <circle cx="18" cy="6" r="3" />
                                <circle cx="6" cy="18" r="3" />
                                <path d="M18 9a9 9 0 0 1-9 9" />
                              </svg>
                            </div>
                          )}

                          {/* Close button */}
                          <button
                            type="button"
                            className="terminal-close"
                            onClick={(e) => {
                              e.stopPropagation();
                              onClose(agent.id);
                            }}
                            style={{
                              opacity: isHovered ? 1 : 0,
                              transition: 'opacity 0.2s ease',
                              background: 'transparent',
                              border: 'none',
                              color: '#e74c3c',
                              cursor: 'pointer',
                              fontSize: '18px',
                              padding: '4px 8px',
                              borderRadius: '4px',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(231, 76, 60, 0.15)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Git Operations Menu - High z-index dropdown */}
                    {showGitMenu === agent.id && (
                      <div
                        className="git-operations-menu"
                        style={{
                          position: 'absolute',
                          top: '100%',
                          right: '8px',
                          marginTop: '4px',
                          background: 'rgba(20, 22, 28, 0.98)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: '8px',
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                          minWidth: '200px',
                          zIndex: 9999,
                          overflow: 'hidden',
                        }}
                      >
                        <div className="menu-items" style={{ padding: '4px' }}>
                          {/* Pull Latest */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGitOperation('pull', agent);
                              setShowGitMenu(null);
                            }}
                            className="menu-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              width: '100%',
                              padding: '10px 12px',
                              background: 'transparent',
                              border: 'none',
                              color: 'rgba(255, 255, 255, 0.9)',
                              fontSize: '13px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                              <path d="M8 12L4 8h3V2h2v6h3l-4 4zm-6 2h12v2H2v-2z"/>
                            </svg>
                            Pull latest
                          </button>

                          {/* Push to Remote */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGitOperation('push', agent);
                              setShowGitMenu(null);
                            }}
                            className="menu-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              width: '100%',
                              padding: '10px 12px',
                              background: 'transparent',
                              border: 'none',
                              color: 'rgba(255, 255, 255, 0.9)',
                              fontSize: '13px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                              <path d="M8 4L4 8h3v6h2V8h3L8 4zM2 2h12v2H2V2z"/>
                            </svg>
                            Push to remote
                          </button>

                          {/* Create PR */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGitOperation('create-pr', agent);
                              setShowGitMenu(null);
                            }}
                            className="menu-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              width: '100%',
                              padding: '10px 12px',
                              background: 'transparent',
                              border: 'none',
                              color: 'rgba(255, 255, 255, 0.9)',
                              fontSize: '13px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                              <path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346z"/>
                            </svg>
                            Create PR
                          </button>

                          {/* Separator */}
                          <div style={{
                            height: '1px',
                            background: 'rgba(255, 255, 255, 0.1)',
                            margin: '4px 8px',
                          }} />

                          {/* View Commits */}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleGitOperation('view-commits', agent);
                              setShowGitMenu(null);
                            }}
                            className="menu-item"
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              width: '100%',
                              padding: '10px 12px',
                              background: 'transparent',
                              border: 'none',
                              color: 'rgba(255, 255, 255, 0.9)',
                              fontSize: '13px',
                              cursor: 'pointer',
                              borderRadius: '4px',
                              transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                              <path d="M10.5 7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z"/>
                            </svg>
                            View commits
                          </button>

                          {/* Delete Worktree - only for worktrees */}
                          {!true && (
                            <>
                              <div style={{
                                height: '1px',
                                background: 'rgba(255, 255, 255, 0.1)',
                                margin: '4px 8px',
                              }} />
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGitOperation('delete-worktree', agent);
                                  setShowGitMenu(null);
                                }}
                                className="menu-item"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  width: '100%',
                                  padding: '10px 12px',
                                  background: 'transparent',
                                  border: 'none',
                                  color: 'rgba(231, 76, 60, 0.9)',
                                  fontSize: '13px',
                                  cursor: 'pointer',
                                  borderRadius: '4px',
                                  transition: 'background 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                }}
                              >
                                <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                  <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"/>
                                </svg>
                                Delete worktree
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          {/* Worktree Section - Separate section for worktrees */}
          {worktreeAgents.length > 0 && (
            <div
              className="worktree-section"
              style={{
                marginTop: '32px',
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
              }}
            >
              {/* WORKTREES Label */}
              <div
                className="text-xs font-medium text-white/30 uppercase tracking-widest mb-4"
                style={{ fontSize: '10px', letterSpacing: '0.1em', marginLeft: '32px' }}
              >
                WORKTREES
              </div>

              {/* Group worktree agents by branch */}
              {(() => {
                const worktreeByBranch = new Map<string, TerminalInfo[]>();
                worktreeAgents.forEach(agent => {
                  const branchName = getBranchName(agent);
                  if (!worktreeByBranch.has(branchName)) {
                    worktreeByBranch.set(branchName, []);
                  }
                  worktreeByBranch.get(branchName)!.push(agent);
                });

                return Array.from(worktreeByBranch.entries()).map(([branchName, agents]) => (
                  <div key={`worktree-${branchName}`} className="branch-group relative" style={{ marginBottom: '24px' }}>
                    {/* Branch Header */}
                    <div
                      className="branch-header mb-3"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginLeft: '32px',
                      }}
                    >
                      <span
                        className="text-white/60 font-mono"
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          fontFamily: "'SF Mono', 'Monaco', 'Consolas', monospace",
                        }}
                      >
                        {branchName} ({agents.length} agent{agents.length !== 1 ? 's' : ''})
                      </span>
                      {/* Modified Files Badge - Clickable to open Git Panel */}
                      {(branchModifiedFiles.get(branchName) || 0) > 0 && (
                        <div
                          className="modified-files-badge"
                          title={`${branchModifiedFiles.get(branchName)} files to commit - Click to open Git Panel`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onOpenGitPanel) onOpenGitPanel();
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = '#d97706';  // Darker orange on hover
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = '#f59e0b';  // Back to amber
                          }}
                          style={{
                            background: '#f59e0b',
                            color: '#fff',
                            borderRadius: '8px',
                            padding: '1px 6px',
                            fontSize: '9px',
                            fontWeight: 600,
                            cursor: 'pointer',  // Changed from 'default' to 'pointer'
                            userSelect: 'none',
                            transition: 'background 0.2s ease',
                          }}
                        >
                          {branchModifiedFiles.get(branchName)}
                        </div>
                      )}
                    </div>

                    {/* Worktree Agents */}
                    {agents.map((agent) => {
                      const isActive = agent.id === activeId;
                      const isHovered = agent.id === hoveredAgentId;

                      return (
                        <div
                          key={agent.id}
                          className="relative"
                          style={{ marginBottom: '8px' }}
                        >
                          {/* Metro Station DIAMOND for worktrees! */}
                          <div
                            className="metro-station-diamond"
                            style={{
                              position: 'absolute',
                              left: '16px',
                              top: '50%',
                              width: '10px',
                              height: '10px',
                              transform: 'translateY(-50%) rotate(45deg)',  // DIAMOND shape!
                              background: agent.color,
                              border: `2px solid ${agent.color}`,
                              boxShadow: `0 0 8px ${agent.color}66`,
                              zIndex: 10,
                            }}
                          />

                          {/* Agent Card */}
                          <div
                            className={`agent-card`}
                            onClick={() => onSelect(agent)}
                            onContextMenu={(e) => onContextMenu(e, agent)}
                            onMouseEnter={() => setHoveredAgentId(agent.id)}
                            onMouseLeave={() => setHoveredAgentId(null)}
                            style={{
                              marginLeft: '36px',
                              padding: '8px 12px',
                              background: isActive
                                ? `${agent.color}15`  // Use agent color for active
                                : isHovered
                                ? 'rgba(255, 255, 255, 0.03)'
                                : 'transparent',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'background 0.2s ease',
                            }}
                          >
                            <div className="flex w-full items-center justify-between">
                              <div className="flex w-full items-center gap-2 flex-1">
                                <TerminalActivityBar
                                  terminal={agent}
                                  chatSessions={chatSessions}
                                  hideBranch={true}  // Hide branch badge
                                />
                              </div>

                              {/* Action buttons wrapper - NO GAP between icons */}
                              <div
                                className="icons-wrapper"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',  // Small custom gap between icons, NOT inheriting parent gap
                                  marginLeft: 'auto',
                                }}
                              >
                                {/* Git Branch Icon - shown on hover */}
                                <div
                                  className="git-branch-icon"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setShowGitMenu(showGitMenu === agent.id ? null : agent.id);
                                  }}
                                  style={{
                                    opacity: isHovered ? 1 : 0,  // FIXED: Now truly only shows on hover
                                    visibility: isHovered ? 'visible' : 'hidden',  // Double protection
                                    transition: 'opacity 0.2s ease, visibility 0.2s ease',
                                    cursor: 'pointer',
                                    padding: '6px',
                                    borderRadius: '4px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: 'transparent',
                                    pointerEvents: isHovered ? 'auto' : 'none',  // Prevent clicks when invisible
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(78, 205, 196, 0.15)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  {/* SVG Git Branch Icon - Original from GitSidebar */}
                                  <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="#4ecdc4"
                                    strokeWidth="2"
                                  >
                                    <line x1="6" y1="3" x2="6" y2="15" />
                                    <circle cx="18" cy="6" r="3" />
                                    <circle cx="6" cy="18" r="3" />
                                    <path d="M18 9a9 9 0 0 1-9 9" />
                                  </svg>
                                </div>

                                {/* Close button */}
                                <button
                                  type="button"
                                  className="terminal-close"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onClose(agent.id);
                                  }}
                                  style={{
                                    opacity: isHovered ? 1 : 0,
                                    transition: 'opacity 0.2s ease',
                                    background: 'transparent',
                                    border: 'none',
                                    color: '#e74c3c',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    padding: '4px 8px',
                                    borderRadius: '4px',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(231, 76, 60, 0.15)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          </div>

                          {/* Git Operations Menu for Worktrees - High z-index dropdown */}
                          {showGitMenu === agent.id && (
                            <div
                              className="git-operations-menu"
                              style={{
                                position: 'absolute',
                                top: '100%',
                                right: '8px',
                                marginTop: '4px',
                                background: 'rgba(20, 22, 28, 0.98)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                borderRadius: '8px',
                                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                                minWidth: '200px',
                                zIndex: 9999,
                                overflow: 'hidden',
                              }}
                            >
                              <div className="menu-items" style={{ padding: '4px' }}>
                                {/* Pull Latest */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitOperation('pull', agent);
                                    setShowGitMenu(null);
                                  }}
                                  className="menu-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                    <path d="M8 12L4 8h3V2h2v6h3l-4 4zm-6 2h12v2H2v-2z"/>
                                  </svg>
                                  Pull latest
                                </button>

                                {/* Push to Remote */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitOperation('push', agent);
                                    setShowGitMenu(null);
                                  }}
                                  className="menu-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                    <path d="M8 4L4 8h3v6h2V8h3L8 4zM2 2h12v2H2V2z"/>
                                  </svg>
                                  Push to remote
                                </button>

                                {/* Create PR */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitOperation('create-pr', agent);
                                    setShowGitMenu(null);
                                  }}
                                  className="menu-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                    <path d="M5 3.254V3.25v.005a.75.75 0 110-.005v.004zm.45 1.9a2.25 2.25 0 10-1.95.218v5.256a2.25 2.25 0 101.5 0V7.123A5.735 5.735 0 009.25 9h1.378a2.251 2.251 0 100-1.5H9.25a4.25 4.25 0 01-3.8-2.346z"/>
                                  </svg>
                                  Create PR
                                </button>

                                {/* Separator */}
                                <div style={{
                                  height: '1px',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  margin: '4px 8px',
                                }} />

                                {/* View Commits */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitOperation('view-commits', agent);
                                    setShowGitMenu(null);
                                  }}
                                  className="menu-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(255, 255, 255, 0.9)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(78, 205, 196, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                    <path d="M10.5 7.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zm1.43.75a4.002 4.002 0 01-7.86 0H.75a.75.75 0 110-1.5h3.32a4.001 4.001 0 017.86 0h3.32a.75.75 0 110 1.5h-3.32z"/>
                                  </svg>
                                  View commits
                                </button>

                                {/* Delete Worktree - only for worktrees */}
                                <div style={{
                                  height: '1px',
                                  background: 'rgba(255, 255, 255, 0.1)',
                                  margin: '4px 8px',
                                }} />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleGitOperation('delete-worktree', agent);
                                    setShowGitMenu(null);
                                  }}
                                  className="menu-item"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '12px',
                                    width: '100%',
                                    padding: '10px 12px',
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'rgba(231, 76, 60, 0.9)',
                                    fontSize: '13px',
                                    cursor: 'pointer',
                                    borderRadius: '4px',
                                    transition: 'background 0.2s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(231, 76, 60, 0.1)';
                                  }}
                                  onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" opacity="0.7">
                                    <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM4.496 6.675a.75.75 0 10-1.492.15l.66 6.6A1.75 1.75 0 005.405 15h5.19c.9 0 1.652-.681 1.741-1.576l.66-6.6a.75.75 0 00-1.492-.149l-.66 6.6a.25.25 0 01-.249.225h-5.19a.25.25 0 01-.249-.225l-.66-6.6z"/>
                                  </svg>
                                  Delete worktree
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      )}

      {/* Commit History Modal */}
      {commitHistoryModal && (
        <CommitHistoryModal
          branchName={commitHistoryModal.branchName}
          rootPath={commitHistoryModal.rootPath}
          onClose={() => setCommitHistoryModal(null)}
        />
      )}
    </div>
  );
}