import { useState, useEffect, useRef, type ReactNode } from "react";
import ChangesPanel from "./ChangesPanel";
import FileExplorer from "./FileExplorer";
import AgentsPanel from "./AgentsPanel";
import SkillsPanel from "./SkillsPanel";
import MCPPanel from "./MCPPanel";
import HooksPanel from "./HooksPanel";
import { CommandsPanel } from "./CommandsPanel";
import { RulesPanel } from "./RulesPanel";
import { SessionsPanel } from "./SessionsPanel";
import { useRules } from "../hooks/useRules";
import { useSlashCommands } from "../hooks/useSlashCommands";
import { useMCPServers } from "../hooks/useMCPServers";
import AgentContextPanel from "./AgentContextPanel";
import ProjectContextPanel from "./ProjectContextPanel";
import type { DirectoryEntry, AgentInfo, AgentDetails, SkillInfo, TerminalInfo, SessionInfo, AgentPersonality, HookConfig, ChatMessage } from "../types";
import type { SlashCommand } from "../hooks/useSlashCommands";
import "./SidePanelAccordion.css";

/**
 * Side Panel with Accordion layout (Codex-inspired)
 * All sections visible, collapsible individually
 */

// Category-specific colors matching Quack Store
const CATEGORY_COLORS: Record<string, string> = {
  changes: '#34d399',     // Green - git changes
  skills: '#f28c52',      // Orange - main accent
  agents: '#f28c52',      // Orange - personas
  droids: '#4ecdc4',      // Teal - automation
  rules: '#60a5fa',       // Blue - governance
  hooks: '#a78bfa',       // Purple - events
  sessions: '#00d9ff',    // Cyan - sessions
  mcp: '#34d399',         // Green - servers
  commands: '#f472b6',    // Pink - commands
  context: '#f28c52',     // Orange - file explorer
  'agent-context': '#f28c52', // Orange - personality
  'project-context': '#60a5fa', // Blue - project notes
  default: '#f28c52',     // Orange fallback
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
  children: ReactNode;
}

function AccordionSection({ id, title, icon, badge, badgeLabel, isExpanded, isFocused = false, order = 0, category, onToggle, children }: AccordionSectionProps) {
  const color = CATEGORY_COLORS[category || id] || CATEGORY_COLORS.default;

  return (
    <div
      className={`accordion-section ${isExpanded ? 'expanded' : ''} ${isFocused ? 'focused' : ''}`}
      data-section={id}
      data-category={category || id}
      style={{ order, '--category-color': color } as React.CSSProperties}
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
      {isExpanded && (
        <div className="accordion-content" id={`accordion-content-${id}`}>
          {children}
        </div>
      )}
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
  projectContext: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <path d="M5 3h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M7 7h6M7 10h6M7 13h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  sessions: (
    <svg viewBox="0 0 20 20" width="14" height="14" aria-hidden="true">
      <circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10 6v4l3 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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
  onToggleCollapse?: () => void;

  // MCP props
  onOpenMcpConfig?: (filePath: string) => void;

  // Sessions props
  onSelectSession?: (session: SessionInfo) => void;

  // Changes panel props
  onRefreshGitStatus?: () => void;
  onClearModifiedFiles?: () => void;
  onRemoveModifiedFiles?: (paths: string[]) => void;

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
  onToggleCollapse,

  // MCP
  onOpenMcpConfig,

  // Sessions
  onSelectSession,

  // Changes panel
  onRefreshGitStatus,
  onClearModifiedFiles,
  onRemoveModifiedFiles,

  // Force expand
  forceExpandSection,
  onForceExpandHandled,
}: SidePanelAccordionProps) {
  // Track focused section (single accordion in focus mode)
  const [focusedSection, setFocusedSection] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load rules for badge counter
  const { rules } = useRules(rootPath || '');
  const rulesCount = rules.project.length + rules.global.length;

  // Load commands for badge counter
  const { commands } = useSlashCommands(rootPath || '');
  const commandsCount = commands.custom.length;

  // Load MCP servers for badge counter
  const { servers: mcpServers } = useMCPServers(workingDir);
  const mcpCount = mcpServers.length;

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

  // Scroll to top when a section is focused
  useEffect(() => {
    if (focusedSection && containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [focusedSection]);

  // Section IDs for reference (order is determined by DOM position, not dynamically)
  const sectionIds = ['changes', 'context', 'agent-context', 'project-context', 'rules', 'agents', 'skills', 'commands', 'mcp', 'hooks', 'sessions'];

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
    if (focusedSection === sectionId) {
      // Click on focused section -> unfocus (collapse all)
      setFocusedSection(null);
    } else {
      // Click on any section -> focus it
      setFocusedSection(sectionId);
    }
  };

  // Auto-hide panel when no agent is selected
  const shouldBeCollapsed = isCollapsed || !activeAgentId;

  return (
    <aside className={`side-panel-accordion ${shouldBeCollapsed ? 'collapsed' : ''}`}>
      {/* Toggle button */}
      {onToggleCollapse && (
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

      <div className={`accordion-container ${focusedSection ? 'has-focus' : ''}`} ref={containerRef}>
        {/* Changes - Codex-style diff panel */}
        {modifiedFiles && modifiedFiles.size > 0 && (
          <AccordionSection
            id="changes"
            title="Changes"
            icon={icons.changes}
            badge={modifiedFiles.size}
            isExpanded={focusedSection === "changes"}
            isFocused={focusedSection === "changes"}
            order={getOrder("changes")}
            category="changes"
            onToggle={() => toggleSection("changes")}
          >
            <ChangesPanel
              rootPath={rootPath}
              modifiedFiles={modifiedFiles}
              onRefreshGitStatus={onRefreshGitStatus || (() => {})}
              onClearModifiedFiles={onClearModifiedFiles}
              onRemoveModifiedFiles={onRemoveModifiedFiles}
            />
          </AccordionSection>
        )}

        {/* File Explorer */}
        <AccordionSection
          id="context"
          title="File Explorer"
          icon={icons.explorer}
          isExpanded={focusedSection === "context"}
          isFocused={focusedSection === "context"}
          order={getOrder("context")}
          onToggle={() => toggleSection("context")}
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

        {/* Agent Personality - Second accordion */}
        <AccordionSection
          id="agent-context"
          title="Agent Personality"
          icon={icons.agentContext}
          isExpanded={focusedSection === "agent-context"}
          isFocused={focusedSection === "agent-context"}
          order={getOrder("agent-context")}
          onToggle={() => toggleSection("agent-context")}
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

        {/* Project Context - Notes, Brain, Bookmarks */}
        <AccordionSection
          id="project-context"
          title="Context"
          icon={icons.projectContext}
          isExpanded={focusedSection === "project-context"}
          isFocused={focusedSection === "project-context"}
          order={getOrder("project-context")}
          category="project-context"
          onToggle={() => toggleSection("project-context")}
        >
          <ProjectContextPanel rootPath={rootPath || ''} />
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
        >
          <SessionsPanel
            onSelectSession={(session) => onSelectSession?.(session)}
          />
        </AccordionSection>
      </div>
    </aside>
  );
}
