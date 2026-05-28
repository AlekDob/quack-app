export interface WorkstreamItem {
  ws: number;
  title: string;
  status: string;
  focus: 'current' | 'active' | 'background' | 'completed' | 'candidate' | 'superseded';
  warning?: string;
  feature?: string;
}

export interface WorkstreamBoardData {
  workstreams: WorkstreamItem[];
}

export interface TaskSuggestion {
  title: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  agent?: string;
  workstream?: number;
}

export interface TaskSuggestData {
  tasks: TaskSuggestion[];
}

export interface AgentGridItem {
  name: string;
  project: string;
  status: 'busy' | 'idle';
  activeSessions: number;
  color: string;
}

export interface AgentGridData {
  agents: AgentGridItem[];
}

export interface BriefingSection {
  title: string;
  items: string[];
}

export interface DailyBriefingData {
  date: string;
  sections: BriefingSection[];
}

export const FOCUS_COLORS: Record<string, string> = {
  current: '#FF6B35',
  active: '#00D9FF',
  background: '#6b7280',
  completed: '#22c55e',
  candidate: '#fbbf24',
  superseded: '#4b5563',
};

export const PRIORITY_COLORS: Record<string, string> = {
  high: '#EF4444',
  medium: '#EAB308',
  low: '#10B981',
};
