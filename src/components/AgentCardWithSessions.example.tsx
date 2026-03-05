/**
 * EXAMPLE: Integration of AgentSessionList with AgentPersonalityCard
 *
 * This shows how to use the AgentSessionList component with an agent card.
 * Place this code in your agent list view (e.g., SidePanel, AgentContextPanel).
 */

import AgentPersonalityCard from './AgentPersonalityCard';
import AgentSessionList from './AgentSessionList';
import type { AgentPersonality, TerminalInfo } from '../types';

interface AgentCardWithSessionsProps {
  agent: TerminalInfo;
  personality: AgentPersonality | null;
  projectPath: string;
  projectName: string;
  onSessionClick: (sessionId: string) => void;
  activeSessionId?: string;
}

export default function AgentCardWithSessions({
  agent,
  personality,
  projectPath,
  projectName,
  onSessionClick,
  activeSessionId,
}: AgentCardWithSessionsProps) {
  return (
    <div className="agent-card-container">
      {/* Agent personality card */}
      <AgentPersonalityCard
        personality={personality}
        agentName={agent.label}
        agentAvatar={agent.avatar}
        agentWorkingOn={agent.workingOn}
        agentColor={agent.color}
        agentId={agent.id}
      />

      {/* Sessions list - new session creation now handled via "+" button on agent card */}
      <AgentSessionList
        agentId={agent.id}
        agentColor={agent.color}
        onSessionClick={onSessionClick}
        activeSessionId={activeSessionId}
      />
    </div>
  );
}

/**
 * USAGE EXAMPLE IN SIDE PANEL:
 *
 * import AgentCardWithSessions from './AgentCardWithSessions.example';
 *
 * function AgentSidePanel() {
 *   const agents = useAgents(); // Your agent list
 *   const [activeSessionId, setActiveSessionId] = useState<string>();
 *
 *   function handleSessionClick(sessionId: string) {
 *     // Open chat with this session
 *     setActiveSessionId(sessionId);
 *     // Navigate to chat view or open drawer
 *   }
 *
 *   return (
 *     <div className="side-panel">
 *       {agents.map((agent) => (
 *         <AgentCardWithSessions
 *           key={agent.id}
 *           agent={agent}
 *           personality={agent.personality}
 *           projectPath={agent.cwd}
 *           projectName={extractProjectName(agent.cwd)}
 *           onSessionClick={handleSessionClick}
 *           activeSessionId={activeSessionId}
 *         />
 *       ))}
 *     </div>
 *   );
 * }
 */
