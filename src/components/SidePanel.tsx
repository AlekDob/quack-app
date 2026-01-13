import { useState, useEffect, type ReactNode } from "react";
import FileExplorer from "./FileExplorer";
import AgentsPanel from "./AgentsPanel";
import SkillsPanel from "./SkillsPanel";
import MCPPanel from "./MCPPanel";
import HooksPanel from "./HooksPanel";
import { CommandsPanel } from "./CommandsPanel";
import { RulesPanel } from "./RulesPanel";
import MemoryPanel from "./memory/MemoryPanel";
import KanbanMiniPanel from "./kanban/KanbanMiniPanel";
import { useRules } from "../hooks/useRules";
import { useSlashCommands } from "../hooks/useSlashCommands";
import { useMCPServers } from "../hooks/useMCPServers";
import { useKanbanStore } from "../stores/kanbanStore";
import AgentContextPanel from "./AgentContextPanel";
import TerminalToolBar from "./TerminalToolBar";
import UsagePanel from "./UsagePanel";
import { SessionsPanel } from "./SessionsPanel";
import type { DirectoryEntry, GitStatusEntry, AgentInfo, AgentDetails, SkillInfo, TerminalInfo, SessionUsage, SessionInfo, AgentPersonality, HookConfig, ChatMessage } from "../types";
import type { SlashCommand } from "../hooks/useSlashCommands";

/**
 * Side Panel with tab navigation
 * Tabs: Agent Context, File Explorer, Agents, Skills, MCP, Commands, Sessions, Terminal, Usage
 * Note: Marketplace is now a drawer (not a tab)
 */

type TabId = "agent-context" | "explorer" | "agents" | "skills" | "mcp" | "hooks" | "commands" | "rules" | "sessions" | "terminal" | "usage" | "memory" | "kanban";

// Tab icons - SVG icons matching the app style
const icons: Record<string, ReactNode> = {
  agentContext: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle
        cx="10"
        cy="7"
        r="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M5 17a5 5 0 0 1 10 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M14 5l2-2M6 5L4 3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  folder: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
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
  agents: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      {/* Robot head */}
      <rect
        x="4"
        y="4"
        width="12"
        height="12"
        rx="2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      {/* Antenna */}
      <line
        x1="10"
        y1="2"
        x2="10"
        y2="4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="2" r="1" fill="currentColor" />
      {/* Eyes */}
      <circle cx="7.5" cy="9" r="1.3" fill="currentColor" />
      <circle cx="12.5" cy="9" r="1.3" fill="currentColor" />
      {/* Mouth */}
      <line
        x1="7.5"
        y1="13"
        x2="12.5"
        y2="13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  mcp: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M3 4a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="7" cy="8" r="1.5" fill="currentColor" />
      <circle cx="13" cy="8" r="1.5" fill="currentColor" />
      <path
        d="M7 12h6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  commands: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 7l2 2-2 2M10 11h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="14"
        cy="7"
        r="1.5"
        fill="currentColor"
      />
    </svg>
  ),
  context: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M5 4h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 8h8M6 11h8M6 14h5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  skills: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M10 2l2 4 4.5 0.5-3.25 3 1 4.5-4.25-2.5-4.25 2.5 1-4.5L3.5 6.5 8 6z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 11v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  ),
  terminal: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 8l2 2-2 2M10 12h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  terminalWindows: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M3 5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M6 8l2 2-2 2M10 12h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  usage: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path
        d="M3 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 10h6M7 13h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="7" r="0.5" fill="currentColor" />
      <path
        d="M12 6l1 2-1 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <circle
        cx="10"
        cy="10"
        r="7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M10 6v4l3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  hooks: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      {/* Hook/anchor shape */}
      <path
        d="M10 3v7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M10 10c0 2.5-2 4-4 4s-4-1.5-4-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle
        cx="10"
        cy="3"
        r="1.5"
        fill="currentColor"
      />
      {/* Connection dots */}
      <circle cx="15" cy="7" r="1.5" fill="currentColor" />
      <circle cx="17" cy="11" r="1.5" fill="currentColor" />
      <path
        d="M10 6l5 1M10 8l7 3"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="2 1"
      />
    </svg>
  ),
  rules: (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      {/* Document with lines */}
      <path
        d="M4 3h8l4 4v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 3v4h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Check marks for rules */}
      <path
        d="M5 10l1.5 1.5L9 9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 14l1.5 1.5L9 13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  memory: (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* Lucide Brain icon */}
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  ),
  kanban: (
    <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* List view icon - like task board */}
      <rect x="3" y="3" width="14" height="3" rx="1" />
      <rect x="3" y="8" width="14" height="3" rx="1" />
      <rect x="3" y="13" width="14" height="3" rx="1" />
    </svg>
  ),
};

interface SidePanelProps {
  // FileExplorer props
  rootPath: string | null;
  tree: Record<string, DirectoryEntry[]>;
  loading: boolean;
  error: string | null;
  activePath: string;
  activeFilePath: string | null;
  modifiedFiles?: Map<string, 'created' | 'modified' | 'deleted'>; // NEW: Track modified files
  onOpenFile: (entry: DirectoryEntry) => void;
  onLoadChildren: (path: string) => Promise<DirectoryEntry[]>;
  onMentionFile?: (filePath: string, fileName: string) => void;

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
  onTogglePip?: () => void;
  isPipOpen?: boolean;

  // Skills props
  skills: SkillInfo[];
  loadingSkills: boolean;
  skillsError: string | null;
  skillsDirectoryExists: boolean;
  onSelectSkill: (skill: SkillInfo) => void;
  onRefreshSkills: () => void;

  // Commands props
  onUseCommand: (command: SlashCommand) => void;
  onSelectCommand?: (commandName: string, commandScope: 'global' | 'project', isNew?: boolean) => void;

  // Rules props
  onSelectRule?: (ruleName: string, ruleScope: 'global' | 'project', isNew?: boolean) => void;

  // Droids props
  onSelectDroid?: (agentName: string, agentScope: 'global' | 'project', isNew?: boolean) => void;

  // Context props
  tauriAvailable: boolean;
  onOpenContextDrawer: (scope: string) => void;

  // Agent Context props
  activeAgentId?: string | null;
  activeAgentName?: string | null;
  activeAgentAvatar?: string | null;
  activeAgentWorkingOn?: string | null;
  activeAgentCwd?: string | null;
  activeAgentPersonality?: Partial<AgentPersonality> | null; // Added: personality from terminal state
  activeAgentColor?: string | null; // Added: agent color for bundles
  onImportAgent?: (agent: import('../types').SavedAgent) => void; // Callback after bundle import
  projectName?: string;
  gitBranch?: string;
  agentRefreshKey?: number; // Added: forces context panel refresh when agent is edited
  onEditAgent?: () => void; // Added: callback to edit current agent
  onSessionClick?: (sessionId: string) => void; // Navigate to session chat
  activeSessionId?: string; // Currently active session ID

  // Terminal props
  activeTerminalId: string | null;
  terminals: TerminalInfo[];
  onTerminalInput: (id: string, data: string) => void;
  onTerminalOutput: (id: string, data: string) => void;
  onUpdateRecentCommands: (commands: string[]) => void;
  onSelectTerminal: (id: string) => void;

  // TerminalToolBar props
  onExecuteCommand: (command: string, label: string, terminalId?: string) => void;
  onToggleSavedCommands: () => void;
  savedCommandsOpen: boolean;
  onCreateTerminal: () => void;

  // Usage props
  usageSessions: SessionUsage[];
  onClearUsage?: () => void;
  onCreateTerminalWithCommand?: (label: string, command: string, cwd?: string) => void;

  // Sessions props
  onSelectSession?: (session: SessionInfo) => void;
  sessionsRefreshKey?: number;

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
  onToggleCollapse?: () => void;
  isKanbanTabActive?: boolean; // Hide toggle when in Kanban tab

  // MCP props
  onOpenMcpConfig?: (filePath: string) => void; // NEW: Open .mcp.json in editor

  // Kanban Mini Panel props
  chatLoadingMap?: Map<string, boolean>;
  chatSessions?: Map<string, ChatMessage[]>;
  onKanbanTaskClick?: (taskId: string) => void;
  onOpenKanban?: () => void;
  showKanbanMiniPanel?: boolean; // Controls if Kanban tab is shown/active
}

export default function SidePanel({
  // FileExplorer
  rootPath,
  tree,
  loading,
  error,
  activePath,
  activeFilePath,
  modifiedFiles, // NEW: Track modified files
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
  onTogglePip: _onTogglePip,
  isPipOpen: _isPipOpen,

  // Skills
  skills,
  loadingSkills,
  skillsError,
  skillsDirectoryExists,
  onSelectSkill,
  onRefreshSkills,

  // Commands
  onUseCommand,
  onSelectCommand,

  // Rules
  onSelectRule,

  // Droids
  onSelectDroid,

  // Context
  tauriAvailable,
  onOpenContextDrawer,

  // Agent Context
  activeAgentId,
  activeAgentName,
  activeAgentAvatar,
  activeAgentWorkingOn,
  activeAgentCwd,
  activeAgentPersonality, // Added: personality from terminal state
  activeAgentColor, // Added: agent color for bundles
  onImportAgent, // Callback after bundle import
  projectName,
  gitBranch,
  agentRefreshKey, // Added: forces context panel refresh when agent is edited
  onEditAgent, // Added: callback to edit current agent
  onSessionClick, // Navigate to session chat
  activeSessionId, // Currently active session ID

  // Terminal
  activeTerminalId,
  terminals,
  onTerminalInput,
  onTerminalOutput,
  onUpdateRecentCommands,
  onSelectTerminal,

  // TerminalToolBar
  onExecuteCommand,
  onToggleSavedCommands,
  savedCommandsOpen,
  onCreateTerminal,

  // Usage
  usageSessions,
  onClearUsage,
  onCreateTerminalWithCommand,

  // Sessions
  onSelectSession,
  sessionsRefreshKey,

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
  onToggleCollapse,
  isKanbanTabActive = false, // Hide toggle when in Kanban tab

  // MCP
  onOpenMcpConfig,

  // Kanban Mini Panel
  chatLoadingMap = new Map(),
  chatSessions = new Map(),
  onKanbanTaskClick,
  onOpenKanban,
  showKanbanMiniPanel = false,
}: SidePanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>("agent-context");

  // Load rules for badge counter
  const { rules } = useRules(rootPath || '');
  const rulesCount = rules.project.length + rules.global.length;

  // Load commands for badge counter
  const { commands } = useSlashCommands(rootPath || '');
  const commandsCount = commands.custom.length;

  // Load MCP servers for badge counter
  const { servers: mcpServers } = useMCPServers(workingDir);
  const mcpCount = mcpServers.length;

  // 🦆 SESSIONS-FIRST: Load Kanban tasks count from sessions
  const { getTasksByStatus } = useKanbanStore();
  const kanbanInProgressCount = getTasksByStatus('in_progress').length;
  const kanbanTotalCount = getTasksByStatus('todo').length + kanbanInProgressCount + getTasksByStatus('done').length;

  // Auto-switch to Kanban tab when mini panel is shown
  useEffect(() => {
    if (showKanbanMiniPanel && activeTab !== 'kanban') {
      setActiveTab('kanban');
    }
  }, [showKanbanMiniPanel, activeTab]);

  // Auto-refresh agents and skills when their tabs are opened
  useEffect(() => {
    if (activeTab === "agents" && onRefreshAgents) {
      onRefreshAgents();
    }
  }, [activeTab, onRefreshAgents]);

  useEffect(() => {
    if (activeTab === "skills" && onRefreshSkills) {
      onRefreshSkills();
    }
  }, [activeTab, onRefreshSkills]);

  useEffect(() => {
    if (activeTab === "hooks" && onRefreshHooks) {
      onRefreshHooks();
    }
  }, [activeTab, onRefreshHooks]);

  // Tab configuration
  const tabs = [
    {
      id: "agent-context" as TabId,
      label: "Agent Context",
      icon: icons.agentContext,
    },
    {
      id: "explorer" as TabId,
      label: "File Explorer",
      icon: icons.folder,
    },
    {
      id: "rules" as TabId,
      label: "Rules",
      icon: icons.rules,
      badge: rulesCount,
      hasContent: rulesCount > 0,
    },
    {
      id: "memory" as TabId,
      label: "Memory",
      icon: icons.memory,
    },
    {
      id: "commands" as TabId,
      label: "Commands",
      icon: icons.commands,
      badge: commandsCount,
      hasContent: commandsCount > 0,
    },
    {
      id: "agents" as TabId,
      label: "Droids",
      icon: icons.agents,
      badge: agents.length,
      hasContent: agents.length > 0,
    },
    {
      id: "skills" as TabId,
      label: "Skills",
      icon: icons.skills,
      badge: skills.length,
      hasContent: skills.length > 0,
    },
    {
      id: "mcp" as TabId,
      label: "MCP Servers",
      icon: icons.mcp,
      badge: mcpCount,
      hasContent: mcpCount > 0,
    },
    {
      id: "hooks" as TabId,
      label: "Hooks",
      icon: icons.hooks,
      badge: hooks.filter(h => h.enabled).length,
      hasContent: hooks.length > 0,
    },
    {
      id: "sessions" as TabId,
      label: "Sessions",
      icon: icons.sessions,
    },
    // Kanban Mini Panel - shown only when enabled
    ...(showKanbanMiniPanel ? [{
      id: "kanban" as TabId,
      label: "Kanban Tasks",
      icon: icons.kanban,
      badge: kanbanInProgressCount > 0 ? kanbanInProgressCount : kanbanTotalCount,
      hasContent: kanbanTotalCount > 0,
    }] : []),
    // Terminal tab hidden - integrated into terminal-windows
    // {
    //   id: "terminal" as TabId,
    //   label: "Terminal",
    //   icon: icons.terminal,
    // },
    // Terminal Windows tab removed - merged into Agent Context
    // {
    //   id: "terminal-windows" as TabId,
    //   label: "Terminal Windows",
    //   icon: icons.terminalWindows,
    //   badge: nativeTerminals.length,
    //   hasContent: nativeTerminals.length > 0,
    // },
    // Usage tab removed - button moved to ToolBar
    // {
    //   id: "usage" as TabId,
    //   label: "Usage",
    //   icon: icons.usage,
    //   badge: usageSessions.length,
    //   hasContent: usageSessions.length > 0,
    // },
  ];

  // Auto-hide panel when no agent is selected
  const shouldBeCollapsed = isCollapsed || !activeAgentId;

  return (
    <aside className={`side-panel ${shouldBeCollapsed ? 'collapsed' : ''}`}>
      {/* Toggle button - hidden only when in Kanban mode AND panel is collapsed */}
      {onToggleCollapse && (!isKanbanTabActive || !shouldBeCollapsed) && (
        <button
          type="button"
          className="side-panel-toggle"
          onClick={onToggleCollapse}
          aria-label={shouldBeCollapsed ? "Expand side panel" : "Collapse side panel"}
        >
          <svg
            viewBox="0 0 20 20"
            width="16"
            height="16"
            aria-hidden="true"
            style={{
              transform: shouldBeCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
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
      <div className="side-panel-tabs">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const hasContent = tab.hasContent;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`side-panel-tab ${isActive ? "active" : ""}`}
              data-tooltip={tab.label}
              aria-label={tab.label}
            >
              <span className="tab-icon">{tab.icon}</span>
              {typeof tab.badge === "number" && tab.badge > 0 && (
                <span
                  className={`side-panel-tab-badge ${
                    hasContent ? "has-content" : ""
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="side-panel-content">
        {activeTab === "agent-context" && (
          <div className="side-panel-pane">
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
              onOpenRulesTab={() => setActiveTab("rules")}
              onImportAgent={onImportAgent}
              projectName={projectName}
              gitBranch={gitBranch}
              refreshKey={agentRefreshKey}
              onEditAgent={onEditAgent}
              onSessionClick={onSessionClick}
              activeSessionId={activeSessionId}
            />
          </div>
        )}

        {activeTab === "explorer" && (
          <div className="side-panel-pane">
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
          </div>
        )}

        {activeTab === "agents" && (
          <div className="side-panel-pane">
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
          </div>
        )}

        {activeTab === "skills" && (
          <div className="side-panel-pane">
            <SkillsPanel
              skills={skills}
              loading={loadingSkills}
              error={skillsError}
              directoryExists={skillsDirectoryExists}
              onSelectSkill={onSelectSkill}
              onRefresh={onRefreshSkills}
            />
          </div>
        )}

        {activeTab === "mcp" && (
          <div className="side-panel-pane">
            <MCPPanel workingDir={workingDir} onOpenMcpConfig={onOpenMcpConfig} />
          </div>
        )}

        {activeTab === "hooks" && (
          <div className="side-panel-pane">
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
          </div>
        )}

        {activeTab === "commands" && (
          <div className="side-panel-pane">
            <CommandsPanel
              basePath={rootPath || ''}
              onUseCommand={onUseCommand}
              onSelectCommand={onSelectCommand}
            />
          </div>
        )}

        {activeTab === "rules" && (
          <div className="side-panel-pane">
            <RulesPanel
              basePath={rootPath || ''}
              onSelectRule={onSelectRule}
            />
          </div>
        )}

        {activeTab === "sessions" && (
          <div className="side-panel-pane">
            <SessionsPanel
              key={sessionsRefreshKey}
              onSelectSession={(session) => onSelectSession?.(session)}
            />
          </div>
        )}

        {activeTab === "memory" && (
          <div className="side-panel-pane">
            <MemoryPanel />
          </div>
        )}

        {activeTab === "kanban" && showKanbanMiniPanel && (
          <div className="side-panel-pane">
            <KanbanMiniPanel
              chatLoadingMap={chatLoadingMap}
              chatSessions={chatSessions}
              onTaskClick={onKanbanTaskClick || (() => {})}
              onOpenKanban={onOpenKanban || (() => {})}
            />
          </div>
        )}

        {activeTab === "terminal" && (
          <div className="side-panel-pane terminal-panel-pane">
            <div className="terminal-placeholder">
              <p>Terminal tab deprecated</p>
              <p>Use the Terminals window instead (Cmd+T)</p>
            </div>
          </div>
        )}

        {activeTab === "usage" && (
          <div className="side-panel-pane">
            <UsagePanel
              sessions={usageSessions}
              onClearUsage={onClearUsage}
              onCreateTerminalWithCommand={onCreateTerminalWithCommand}
              isActive={activeTab === "usage"}
              currentCwd={workingDir}
            />
          </div>
        )}
      </div>
    </aside>
  );
}
