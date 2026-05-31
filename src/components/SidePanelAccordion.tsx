import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { normalizeToForwardSlash } from "../utils/platform";
import ChangesPanel from "./ChangesPanel";
import FileExplorer from "./FileExplorer";
import AgentsPanel from "./AgentsPanel";
import SkillsPanel from "./SkillsPanel";
import MCPPanel from "./MCPPanel";
import HooksPanel from "./HooksPanel";
import { CommandsPanel } from "./CommandsPanel";
import { RulesPanel } from "./RulesPanel";
import { SessionsPanel } from "./SessionsPanel";
import FeaturesPanel from "./FeaturesPanel";
import AgentTokenStatsPanel from "./AgentTokenStatsPanel";
import { useRules } from "../hooks/useRules";
import { useSlashCommands } from "../hooks/useSlashCommands";
import { useMCPServers } from "../hooks/useMCPServers";
import AgentContextPanel from "./AgentContextPanel";
import WorkstreamsPanel from "./WorkstreamsPanel";
import WorkstreamStatusPanel from "./WorkstreamStatusPanel";
import TaskHubView, { computeTaskHubBadge } from "./TaskHubView";
import { useSessionStore } from "../stores/sessionStore";
import { useChatStore } from "../stores/chatStore";
import type { DirectoryEntry, AgentInfo, AgentDetails, SkillInfo, TerminalInfo, SessionInfo, AgentPersonality, HookConfig, SearchResult } from "../types";
import type { SlashCommand } from "../hooks/useSlashCommands";
import "./SidePanelAccordion.css";

/**
 * Side Panel with Accordion layout (Codex-inspired)
 * All sections visible, collapsible individually
 */

// Category-specific colors matching Quack Store
const CATEGORY_COLORS: Record<string, string> = {
  taskhub: '#a855f7',     // Purple - matches P1 'Needs attention' accent
  changes: '#34d399',     // Green - git changes
  skills: 'var(--accent-color)',      // Orange - main accent
  agents: 'var(--accent-color)',      // Orange - personas
  droids: '#4ecdc4',      // Teal - automation
  rules: '#60a5fa',       // Blue - governance
  hooks: '#a78bfa',       // Purple - events
  brain: '#e879f9',       // Fuchsia - knowledge/brain
  features: '#FFD700',    // Gold - feature map
  sessions: '#00d9ff',    // Cyan - sessions
  mcp: '#34d399',         // Green - servers
  commands: '#f472b6',    // Pink - commands
  context: 'var(--accent-color)',     // Orange - file explorer
  'agent-context': 'var(--accent-color)', // Orange - personality
  workstreams: '#fbbf24', // Amber - project-ops workstreams
  status: '#84cc16',      // Lime - current focus status
  'token-stats': '#22d3ee',      // Sky cyan - metrics / analytics
  default: 'var(--accent-color)',     // Orange fallback
};

// Accordion Section Component
interface AccordionSectionProps {
  id: string;
  title: string;
  icon: ReactNode;
  badge?: number;
  badgeLabel?: ReactNode;
  isExpanded: boolean;
  isFocused?: boolean;
  order?: number;
  category?: string;
  onToggle: () => void;
  onHoverEnter?: () => void;
  onHoverLeave?: () => void;
  children: ReactNode;
}

function AccordionSection({ id, title, icon, badge, badgeLabel, isExpanded, isFocused = false, order = 0, category, onToggle, onHoverEnter, onHoverLeave, children }: AccordionSectionProps) {
  const color = CATEGORY_COLORS[category || id] || CATEGORY_COLORS.default;

  return (
    <div
      className={`accordion-section ${isExpanded ? 'expanded' : ''} ${isFocused ? 'focused' : ''}`}
      data-section={id}
      data-category={category || id}
      style={{ order, '--category-color': color } as React.CSSProperties}
      onMouseEnter={onHoverEnter}
      onMouseLeave={onHoverLeave}
    >
      <button
        type="button"
        className="accordion-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
        aria-controls={`accordion-content-${id}`}
      >
        <svg
          className="accordion-chevron"
          viewBox="0 0 24 24"
          width="12"
          height="12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
        <span className="accordion-icon">{icon}</span>
        <span className="accordion-title">{title}</span>
        {badgeLabel ? (
          <span className="accordion-badge-label">{badgeLabel}</span>
        ) : typeof badge === "number" && badge > 0 ? (
          <span className="accordion-badge">{badge}</span>
        ) : null}
      </button>
      <div
        className={`accordion-content ${isExpanded ? 'accordion-content--open' : 'accordion-content--closed'}`}
        id={`accordion-content-${id}`}
      >
        {children}
      </div>
    </div>
  );
}

// Icons
const icons = {
  changes: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M4 5h12M4 10h12M4 15h12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M15 3l2 2-2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5 13l-2 2 2 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  workspace: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path
        d="M3 5a2 2 0 0 1 2-2h3.5l1.5 1.5h5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  agentContext: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <circle cx="10" cy="7" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 17a5 5 0 0 1 10 0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  rules: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M4 3h8l4 4v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 10l1.5 1.5L9 9M5 14l1.5 1.5L9 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  context: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M5 4h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 8h8M6 11h8M6 14h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  agents: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <rect x="4" y="4" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="10" y1="2" x2="10" y2="4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7.5" cy="9" r="1.3" fill="currentColor" />
      <circle cx="12.5" cy="9" r="1.3" fill="currentColor" />
      <line x1="7.5" y1="13" x2="12.5" y2="13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  skills: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M10 2l2 4 4.5 0.5-3.25 3 1 4.5-4.25-2.5-4.25 2.5 1-4.5L3.5 6.5 8 6z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  commands: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 7l2 2-2 2M10 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  mcp: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="7" cy="8" r="1.5" fill="currentColor" />
      <circle cx="13" cy="8" r="1.5" fill="currentColor" />
      <path d="M7 12h6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  hooks: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M10 3v7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M10 10c0 2.5-2 4-4 4s-4-1.5-4-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="10" cy="3" r="1.5" fill="currentColor" />
    </svg>
  ),
  explorer: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M3 5a2 2 0 0 1 2-2h3.5l1.5 1.5h5a2 2 0 0 1 2 2V15a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  workstreams: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <rect x="3" y="4" width="14" height="3" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="9" width="10" height="3" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="3" y="14" width="12" height="3" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  ),
  status: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="10" cy="10" r="2.5" fill="currentColor" />
    </svg>
  ),
  features: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <circle cx="10" cy="10" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="5" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="5" cy="15" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="15" cy="15" r="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="7.5" y1="8" x2="6.5" y2="6.5" stroke="currentColor" strokeWidth="1" />
      <line x1="12.5" y1="8" x2="13.5" y2="6.5" stroke="currentColor" strokeWidth="1" />
      <line x1="7.5" y1="12" x2="6.5" y2="13.5" stroke="currentColor" strokeWidth="1" />
      <line x1="12.5" y1="12" x2="13.5" y2="13.5" stroke="currentColor" strokeWidth="1" />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4l3 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  brain: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M10 3c-2 0-3.5 1-4.2 2.5C4.3 6 3 7.5 3 9.5c0 1.5.8 2.8 2 3.5.2 1.8 1.8 3 4 3h2c2.2 0 3.8-1.2 4-3 1.2-.7 2-2 2-3.5 0-2-1.3-3.5-2.8-4C13.5 4 12 3 10 3z" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M10 5v11M7.5 8c.8-.8 1.5-.8 2.5 0s1.7.8 2.5 0" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  ),
  'token-stats': (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M3 3v14h14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M6 13l3-3 3 3 5-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  taskhub: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <line x1="7" y1="5" x2="17" y2="5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="7" y1="10" x2="17" y2="10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="7" y1="15" x2="17" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="3.5" cy="5" r="1.1" fill="currentColor" />
      <circle cx="3.5" cy="10" r="1.1" fill="currentColor" />
      <circle cx="3.5" cy="15" r="1.1" fill="currentColor" />
    </svg>
  ),
};

interface SidePanelAccordionProps {
  // FileExplorer props
  rootPath: string | null;
  tree: Record<string, DirectoryEntry[]>;
  loading: boolean;
  error: string | null;
  activePath: string;
  activeFilePath: string | null;
  modifiedFiles?: Map<string, 'created' | 'modified' | 'deleted'>;
  onOpenFile: (entry: DirectoryEntry) => void;
  onLoadChildren: (path: string) => Promise<DirectoryEntry[]>;
  onMentionFile?: (filePath: string, fileName: string, isDirectory: boolean) => void;

  // Agents props
  agents: AgentInfo[];
  selectedAgent: AgentDetails | null;
  loadingAgents: boolean;
  agentsError: string | null;
  agentsDirectoryExists: boolean;
  workingDir?: string;
  onSelectAgent: (agent: AgentInfo) => void;
  onUseAgent: (agent: AgentInfo) => void;
  onRefreshAgents: () => void;
  onCreateAgent: (
    name: string,
    description: string,
    model: string,
    color: string,
    content: string,
    scope: 'global' | 'project'
  ) => Promise<void>;

  // Skills props
  skills: SkillInfo[];
  loadingSkills: boolean;
  skillsError: string | null;
  skillsDirectoryExists: boolean;
  onSelectSkill: (skill: SkillInfo) => void;
  onRefreshSkills: () => void;

  // Commands props
  onSelectCommand?: (commandName: string, commandScope: 'global' | 'project', isNew?: boolean, filePath?: string) => void;

  // Rules props
  onSelectRule?: (ruleName: string, ruleScope: 'global' | 'project', isNew?: boolean, filePath?: string) => void;

  // Droids props
  onSelectDroid?: (agentName: string, agentScope: 'global' | 'project', isNew?: boolean, filePath?: string) => void;

  // Context props
  tauriAvailable: boolean;
  onOpenContextDrawer: (scope: string) => void;

  // Task Hub props
  terminals?: TerminalInfo[];
  onActiveSessionDone?: () => void;

  // Agent Context props
  activeAgentId?: string | null;
  activeAgentName?: string | null;
  activeAgentAvatar?: string | null;
  activeAgentWorkingOn?: string | null;
  activeAgentCwd?: string | null;
  activeAgentPersonality?: Partial<AgentPersonality> | null;
  activeAgentColor?: string | null;
  projectName?: string;
  gitBranch?: string;
  agentRefreshKey?: number;
  onEditAgent?: () => void;
  onSessionClick?: (sessionId: string) => void;
  activeSessionId?: string;

  // Hooks props
  hooks?: HookConfig[];
  loadingHooks?: boolean;
  hooksError?: string | null;
  onRefreshHooks?: () => void;
  onSaveHook?: (hook: HookConfig) => Promise<void>;
  onDeleteHook?: (hookId: string, scope: string) => Promise<void>;
  onToggleHook?: (hookId: string, enabled: boolean) => Promise<void>;

  // Collapse props
  isCollapsed?: boolean;
  userCollapsed?: boolean; // WHY: distinguish user toggle from auto-collapse (tab switch)
  onToggleCollapse?: () => void;

  // MCP props
  onOpenMcpConfig?: (filePath: string) => void;

  // Sessions props
  onSelectSession?: (session: SessionInfo) => void;

  // Changes panel props
  onRefreshGitStatus?: () => void;
  onClearModifiedFiles?: () => void;
  onRemoveModifiedFiles?: (paths: string[]) => void;
  onOpenInEditor?: (filePath: string) => void;
  onOpenDiff?: (filePath: string, status: 'created' | 'modified' | 'deleted') => void;
  // Changes panel — branch context + history
  branch?: string | null;
  isWorktree?: boolean;
  gitHistory?: import('../types').GitCommitEntry[];
  gitHistoryLoading?: boolean;
  // Agent commit detection — bumped when an agent runs `git commit`
  lastRefreshTs?: number;

  // Force expand a specific section (controlled from parent)
  forceExpandSection?: string | null;
  onForceExpandHandled?: () => void;
}

export default function SidePanelAccordion({
  // FileExplorer
  rootPath,
  tree,
  loading,
  error,
  activePath,
  activeFilePath,
  modifiedFiles,
  onOpenFile,
  onLoadChildren,
  onMentionFile,

  // Agents
  agents,
  selectedAgent,
  loadingAgents,
  agentsError,
  agentsDirectoryExists,
  workingDir,
  onSelectAgent,
  onUseAgent,
  onRefreshAgents,
  onCreateAgent,

  // Skills
  skills,
  loadingSkills,
  skillsError,
  skillsDirectoryExists,
  onSelectSkill,
  onRefreshSkills,

  // Commands
  onSelectCommand,

  // Rules
  onSelectRule,

  // Droids
  onSelectDroid,

  // Context
  tauriAvailable,
  onOpenContextDrawer,

  // Task Hub
  terminals = [],
  onActiveSessionDone,

  // Agent Context
  activeAgentId,
  activeAgentName,
  activeAgentAvatar,
  activeAgentWorkingOn,
  activeAgentCwd,
  activeAgentPersonality,
  activeAgentColor,
  projectName,
  gitBranch,
  agentRefreshKey,
  onEditAgent,
  onSessionClick,
  activeSessionId,

  // Hooks
  hooks = [],
  loadingHooks = false,
  hooksError = null,
  onRefreshHooks,
  onSaveHook,
  onDeleteHook,
  onToggleHook,

  // Collapse
  isCollapsed = false,
  userCollapsed = false,
  onToggleCollapse,

  // MCP
  onOpenMcpConfig,

  // Sessions
  onSelectSession,

  // Changes panel
  onRefreshGitStatus,
  onClearModifiedFiles,
  onRemoveModifiedFiles,
  onOpenInEditor,
  onOpenDiff,
  branch,
  isWorktree,
  gitHistory,
  gitHistoryLoading,
  lastRefreshTs,

  // Force expand
  forceExpandSection,
  onForceExpandHandled,
}: SidePanelAccordionProps) {
  // Track focused section (single accordion in focus mode)
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Peek expand state for compact icon-strip mode
  const [isPeekExpanded, setIsPeekExpanded] = useState(false);
  const peekTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hover-to-open debounce for accordion sections
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Task Hub badge — count of P1 (pending question) + P3 (agent done) sessions.
  // chatSessions comes from chatStore (single source of truth, same as the
  // sidebar + TaskHubView) so the badge sees the hook/screen "done" markers.
  const taskHubSessions = useSessionStore((s) => s.sessions);
  const pendingQuestionsMap = useChatStore((s) => s.pendingQuestionsMap);
  const chatSessions = useChatStore((s) => s.chatSessions);
  const taskHubBadge = useMemo(
    () => computeTaskHubBadge(taskHubSessions, chatSessions, pendingQuestionsMap),
    [taskHubSessions, chatSessions, pendingQuestionsMap],
  );

  // Load rules for badge counter
  const { rules } = useRules(rootPath || '');
  const rulesCount = rules.project.length + rules.global.length;

  // Load commands for badge counter
  const { commands } = useSlashCommands(rootPath || '');
  const commandsCount = commands.custom.length;

  // Load MCP servers for badge counter
  const { servers: mcpServers } = useMCPServers(workingDir);
  const mcpCount = mcpServers.length;

  // Brain section state (lazy-loaded documentation explorer)
  const [brainLoaded, setBrainLoaded] = useState(false);
  const [brainLoading, setBrainLoading] = useState(false);
  const [brainFileCount, setBrainFileCount] = useState(0);
  // Brain: gotcha-windows-path-separators — normalize before appending subpath
  const brainRootPath = rootPath ? normalizeToForwardSlash(`${rootPath}/documentation`) : null;

  // Auto-refresh when sections are focused
  useEffect(() => {
    if (focusedSection === "agents" && onRefreshAgents) {
      onRefreshAgents();
    }
  }, [focusedSection, onRefreshAgents]);

  useEffect(() => {
    if (focusedSection === "skills" && onRefreshSkills) {
      onRefreshSkills();
    }
  }, [focusedSection, onRefreshSkills]);

  useEffect(() => {
    if (focusedSection === "hooks" && onRefreshHooks) {
      onRefreshHooks();
    }
  }, [focusedSection, onRefreshHooks]);

  // Brain: load documentation/ on first expand + count .md/.mmd for badge
  useEffect(() => {
    if (focusedSection === 'brain' && !brainLoaded && brainRootPath) {
      setBrainLoading(true);
      onLoadChildren(brainRootPath)
        .then(() => {
          setBrainLoaded(true);
          setBrainLoading(false);
        })
        .catch(() => setBrainLoading(false));
      invoke<SearchResult[]>('search_files_recursive', {
        path: brainRootPath, query: '.md', maxResults: 500, maxDepth: 5,
      })
        .then((results) => {
          setBrainFileCount(results.filter(r => r.path.endsWith('.md') || r.path.endsWith('.mmd')).length);
        })
        .catch(() => {});
    }
  }, [focusedSection, brainLoaded, brainRootPath, onLoadChildren]);

  // Brain: reset when project changes
  useEffect(() => {
    setBrainLoaded(false);
    setBrainFileCount(0);
  }, [rootPath]);

  // Scroll to top when a section is focused
  useEffect(() => {
    if (focusedSection && containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [focusedSection]);

  // Section IDs for reference (order is determined by DOM position, not dynamically)
  const sectionIds = ['taskhub', 'changes', 'workstreams', 'status', 'context', 'brain', 'features', 'agent-context', 'rules', 'agents', 'skills', 'commands', 'mcp', 'hooks', 'sessions', 'token-stats'];

  // Handle forceExpandSection from parent
  useEffect(() => {
    if (forceExpandSection) {
      console.log('[SidePanelAccordion] forceExpandSection received:', forceExpandSection);
      setFocusedSection(forceExpandSection);
      // Notify parent that we handled it
      onForceExpandHandled?.();
    }
  }, [forceExpandSection, onForceExpandHandled]);

  // Simple fixed order - no reordering when focused
  const getOrder = (sectionId: string): number => {
    return sectionIds.indexOf(sectionId);
  };

  const toggleSection = (sectionId: string) => {
    // In compact mode, ensure peek expands on icon click
    if (isCompact && !isPeekExpanded) {
      if (peekTimeoutRef.current) clearTimeout(peekTimeoutRef.current);
      setIsPeekExpanded(true);
      setFocusedSection(sectionId);
      return;
    }
    if (focusedSection === sectionId) {
      setFocusedSection(null);
    } else {
      setFocusedSection(sectionId);
    }
  };

  // WHY: compact strip only when USER explicitly collapsed, not auto-collapse (tab switch)
  const isCompact = userCollapsed && !!activeAgentId;
  const shouldBeHidden = !activeAgentId || (isCollapsed && !userCollapsed);

  // WHY: debounced hover handlers for peek-expand overlay
  const handlePeekEnter = () => {
    if (!isCompact) return;
    if (peekTimeoutRef.current) clearTimeout(peekTimeoutRef.current);
    peekTimeoutRef.current = setTimeout(() => setIsPeekExpanded(true), 80);
  };

  const handlePeekLeave = () => {
    if (!isCompact) return;
    if (peekTimeoutRef.current) clearTimeout(peekTimeoutRef.current);
    peekTimeoutRef.current = setTimeout(() => setIsPeekExpanded(false), 300);
  };

  // Hover-to-open: only in compact mode (icon strip + peek overlay)
  const handleSectionHoverEnter = (sectionId: string) => {
    if (!isCompact) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setFocusedSection(sectionId);
    }, 500);
  };

  // Hover-to-close: only in compact mode
  const handleSectionHoverLeave = () => {
    if (!isCompact) return;
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setFocusedSection(null);
    }, 300);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (peekTimeoutRef.current) clearTimeout(peekTimeoutRef.current);
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  // Reset peek when leaving compact mode
  useEffect(() => {
    if (!isCompact) setIsPeekExpanded(false);
  }, [isCompact]);

  return (
    <aside
      className={`side-panel-accordion ${shouldBeHidden ? 'collapsed' : ''} ${isCompact ? 'compact' : ''} ${isPeekExpanded ? 'peek-expanded' : ''}`}
      onMouseEnter={handlePeekEnter}
      onMouseLeave={handlePeekLeave}
    >
      {/* Toggle button — hidden in compact mode (ActionIcons button used) */}
      {onToggleCollapse && !isCompact && (
        <button
          type="button"
          className="side-panel-toggle"
          onClick={onToggleCollapse}
          aria-label={shouldBeHidden ? "Expand side panel" : "Collapse side panel"}
        >
          <svg
            viewBox="0 0 20 20"
            width="16"
            height="16"
            aria-hidden="true"
            style={{
              transform: shouldBeHidden ? 'rotate(0deg)' : 'rotate(180deg)',
              transition: 'transform 0.3s ease'
            }}
          >
            <path
              d="M12 5l-5 5 5 5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      <div
        className={`accordion-container ${focusedSection ? 'has-focus' : ''}`}
        ref={containerRef}
        onMouseEnter={handlePeekEnter}
        onMouseLeave={handlePeekLeave}
      >
        {/* Task Hub — priority-grouped session triage (always available, badge surfaces P1+P3) */}
        <AccordionSection
          id="taskhub"
          title="Task Hub"
          icon={icons.taskhub}
          badge={taskHubBadge || undefined}
          isExpanded={focusedSection === "taskhub"}
          isFocused={focusedSection === "taskhub"}
          order={getOrder("taskhub")}
          category="taskhub"
          onToggle={() => toggleSection("taskhub")}
          onHoverEnter={() => handleSectionHoverEnter("taskhub")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <TaskHubView
            terminals={terminals}
            onSessionClick={onSessionClick}
            activeSessionId={activeSessionId}
            onActiveSessionDone={onActiveSessionDone}
          />
        </AccordionSection>

        {/* Changes - Codex-style diff panel (always visible, shows branch/history even without changes) */}
        <AccordionSection
          id="changes"
          title="Changes"
          icon={icons.changes}
          badge={modifiedFiles?.size || undefined}
          isExpanded={focusedSection === "changes"}
          isFocused={focusedSection === "changes"}
          order={getOrder("changes")}
          category="changes"
          onToggle={() => toggleSection("changes")}
          onHoverEnter={() => handleSectionHoverEnter("changes")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <ChangesPanel
            rootPath={rootPath}
            modifiedFiles={modifiedFiles || new Map()}
            onRefreshGitStatus={onRefreshGitStatus || (() => {})}
            onClearModifiedFiles={onClearModifiedFiles}
            onRemoveModifiedFiles={onRemoveModifiedFiles}
            onOpenInEditor={onOpenInEditor}
            onOpenDiff={onOpenDiff}
            branch={branch}
            isWorktree={isWorktree}
            projectName={projectName}
            history={gitHistory}
            historyLoading={gitHistoryLoading}
            lastRefreshTs={lastRefreshTs}
          />
        </AccordionSection>

        {/* File Explorer */}
        <AccordionSection
          id="context"
          title="File Explorer"
          icon={icons.explorer}
          isExpanded={focusedSection === "context"}
          isFocused={focusedSection === "context"}
          order={getOrder("context")}
          onToggle={() => toggleSection("context")}
          onHoverEnter={() => handleSectionHoverEnter("context")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <FileExplorer
            rootPath={rootPath}
            tree={tree}
            loading={loading}
            error={error}
            activePath={activePath}
            activeFilePath={activeFilePath}
            modifiedFiles={modifiedFiles}
            onOpenFile={onOpenFile}
            onLoadChildren={onLoadChildren}
            onMentionFile={onMentionFile}
          />
        </AccordionSection>

        {/* Brain — Documentation explorer */}
        <AccordionSection
          id="brain"
          title="Brain"
          icon={icons.brain}
          badge={brainFileCount || undefined}
          isExpanded={focusedSection === "brain"}
          isFocused={focusedSection === "brain"}
          order={getOrder("brain")}
          category="brain"
          onToggle={() => toggleSection("brain")}
          onHoverEnter={() => handleSectionHoverEnter("brain")}
          onHoverLeave={handleSectionHoverLeave}
        >
          {brainLoading ? (
            <div style={{ padding: '12px', opacity: 0.5, fontSize: '12px' }}>Loading documentation...</div>
          ) : brainRootPath ? (
            <FileExplorer
              rootPath={brainRootPath}
              tree={tree}
              loading={false}
              error={null}
              activePath={brainRootPath}
              activeFilePath={activeFilePath}
              onOpenFile={onOpenFile}
              onLoadChildren={onLoadChildren}
              onMentionFile={onMentionFile}
              modifiedFiles={modifiedFiles}
              sortBy="modified"
            />
          ) : (
            <div style={{ padding: '12px', opacity: 0.5, fontSize: '12px' }}>No documentation found</div>
          )}
        </AccordionSection>

        {/* Features — after File Explorer */}
        <AccordionSection
          id="features"
          title="Features"
          icon={icons.features}
          isExpanded={focusedSection === "features"}
          isFocused={focusedSection === "features"}
          order={getOrder("features")}
          category="features"
          onToggle={() => toggleSection("features")}
          onHoverEnter={() => handleSectionHoverEnter("features")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <FeaturesPanel projectPath={rootPath} onOpenInEditor={onOpenInEditor} />
        </AccordionSection>

        {/* Agent Personality - Second accordion */}
        <AccordionSection
          id="agent-context"
          title="Agent Personality"
          icon={icons.agentContext}
          isExpanded={focusedSection === "agent-context"}
          isFocused={focusedSection === "agent-context"}
          order={getOrder("agent-context")}
          onToggle={() => toggleSection("agent-context")}
          onHoverEnter={() => handleSectionHoverEnter("agent-context")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <AgentContextPanel
            tauriAvailable={tauriAvailable}
            activeAgentId={activeAgentId}
            activeAgentName={activeAgentName}
            activeAgentAvatar={activeAgentAvatar}
            activeAgentWorkingOn={activeAgentWorkingOn}
            activeAgentCwd={activeAgentCwd}
            activeAgentPersonality={activeAgentPersonality}
            activeAgentColor={activeAgentColor}
            onOpenFile={onOpenFile}
            onOpenContextDrawer={onOpenContextDrawer}
            onOpenRulesTab={() => toggleSection("rules")}
            projectName={projectName}
            gitBranch={gitBranch}
            refreshKey={agentRefreshKey}
            onEditAgent={onEditAgent}
            onSessionClick={onSessionClick}
            activeSessionId={activeSessionId}
          />
        </AccordionSection>

        {/* Workstreams - project-ops layer */}
        <AccordionSection
          id="workstreams"
          title="Workstreams"
          icon={icons.workstreams}
          isExpanded={focusedSection === "workstreams"}
          isFocused={focusedSection === "workstreams"}
          order={getOrder("workstreams")}
          category="workstreams"
          onToggle={() => toggleSection("workstreams")}
          onHoverEnter={() => handleSectionHoverEnter("workstreams")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <WorkstreamsPanel
            rootPath={rootPath}
            onOpenFile={(filePath, fileName) =>
              onOpenFile({ path: filePath, name: fileName, is_dir: false, is_symlink: false })
            }
          />
        </AccordionSection>

        {/* Status - current focus snapshot */}
        <AccordionSection
          id="status"
          title="Status"
          icon={icons.status}
          isExpanded={focusedSection === "status"}
          isFocused={focusedSection === "status"}
          order={getOrder("status")}
          category="status"
          onToggle={() => toggleSection("status")}
          onHoverEnter={() => handleSectionHoverEnter("status")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <WorkstreamStatusPanel
            rootPath={rootPath}
            onOpenFile={(filePath, fileName) =>
              onOpenFile({ path: filePath, name: fileName, is_dir: false, is_symlink: false })
            }
          />
        </AccordionSection>

        {/* Agent Rules */}
        <AccordionSection
          id="rules"
          title="Agent Rules"
          icon={icons.rules}
          badge={rulesCount}
          isExpanded={focusedSection === "rules"}
          isFocused={focusedSection === "rules"}
          order={getOrder("rules")}
          category="rules"
          onToggle={() => toggleSection("rules")}
          onHoverEnter={() => handleSectionHoverEnter("rules")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <RulesPanel
            basePath={rootPath || ''}
            onSelectRule={onSelectRule}
          />
        </AccordionSection>

        {/* Droids */}
        <AccordionSection
          id="agents"
          title="Droids"
          icon={icons.agents}
          badge={agents.length}
          isExpanded={focusedSection === "agents"}
          isFocused={focusedSection === "agents"}
          order={getOrder("agents")}
          category="droids"
          onToggle={() => toggleSection("agents")}
          onHoverEnter={() => handleSectionHoverEnter("agents")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <AgentsPanel
            agents={agents}
            selectedAgent={selectedAgent}
            loading={loadingAgents}
            error={agentsError}
            directoryExists={agentsDirectoryExists}
            workingDir={workingDir}
            onSelectAgent={onSelectAgent}
            onUseAgent={onUseAgent}
            onRefresh={onRefreshAgents}
            onCreateAgent={onCreateAgent}
            onSelectDroid={onSelectDroid}
          />
        </AccordionSection>

        {/* Skills */}
        <AccordionSection
          id="skills"
          title="Skills"
          icon={icons.skills}
          badge={skills.length}
          isExpanded={focusedSection === "skills"}
          isFocused={focusedSection === "skills"}
          order={getOrder("skills")}
          category="skills"
          onToggle={() => toggleSection("skills")}
          onHoverEnter={() => handleSectionHoverEnter("skills")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <SkillsPanel
            skills={skills}
            loading={loadingSkills}
            error={skillsError}
            directoryExists={skillsDirectoryExists}
            onSelectSkill={onSelectSkill}
            onRefresh={onRefreshSkills}
          />
        </AccordionSection>

        {/* Commands - Hidden for UI simplification */}
        {/* <AccordionSection
          id="commands"
          title="Commands"
          icon={icons.commands}
          badge={commandsCount}
          isExpanded={focusedSection === "commands"}
          isFocused={focusedSection === "commands"}
          order={getOrder("commands")}
          category="commands"
          onToggle={() => toggleSection("commands")}
        >
          <CommandsPanel
            basePath={rootPath || ''}
            onSelectCommand={onSelectCommand}
          />
        </AccordionSection> */}

        {/* MCP Servers */}
        <AccordionSection
          id="mcp"
          title="MCP Servers"
          icon={icons.mcp}
          badge={mcpCount}
          isExpanded={focusedSection === "mcp"}
          isFocused={focusedSection === "mcp"}
          order={getOrder("mcp")}
          category="mcp"
          onToggle={() => toggleSection("mcp")}
          onHoverEnter={() => handleSectionHoverEnter("mcp")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <MCPPanel workingDir={workingDir} onOpenMcpConfig={onOpenMcpConfig} />
        </AccordionSection>

        {/* Hooks */}
        <AccordionSection
          id="hooks"
          title="Hooks"
          icon={icons.hooks}
          badge={hooks.filter(h => h.enabled).length}
          isExpanded={focusedSection === "hooks"}
          isFocused={focusedSection === "hooks"}
          order={getOrder("hooks")}
          category="hooks"
          onToggle={() => toggleSection("hooks")}
          onHoverEnter={() => handleSectionHoverEnter("hooks")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <HooksPanel
            hooks={hooks}
            loading={loadingHooks}
            error={hooksError}
            workingDir={workingDir}
            onRefresh={onRefreshHooks}
            onSaveHook={onSaveHook}
            onDeleteHook={onDeleteHook}
            onToggleHook={onToggleHook}
          />
        </AccordionSection>

        {/* Sessions */}
        <AccordionSection
          id="sessions"
          title="Sessions"
          icon={icons.sessions}
          isExpanded={focusedSection === "sessions"}
          isFocused={focusedSection === "sessions"}
          order={getOrder("sessions")}
          category="sessions"
          onToggle={() => toggleSection("sessions")}
          onHoverEnter={() => handleSectionHoverEnter("sessions")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <SessionsPanel
            onSelectSession={(session) => onSelectSession?.(session)}
          />
        </AccordionSection>

        {/* 📊 Token Stats — per-agent breakdown for the current project */}
        {/* Brain: decision-project-token-stats-sqlite */}
        <AccordionSection
          id="token-stats"
          title="Token Stats"
          icon={icons['token-stats']}
          isExpanded={focusedSection === "token-stats"}
          isFocused={focusedSection === "token-stats"}
          order={getOrder("token-stats")}
          category="token-stats"
          onToggle={() => toggleSection("token-stats")}
          onHoverEnter={() => handleSectionHoverEnter("token-stats")}
          onHoverLeave={handleSectionHoverLeave}
        >
          <AgentTokenStatsPanel
            projectPath={rootPath}
            enabled={focusedSection === "token-stats"}
          />
        </AccordionSection>
      </div>
    </aside>
  );
}
