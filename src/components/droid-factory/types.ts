export type FactoryMode = 'droid' | 'skill';

export interface DroidSpec {
  name: string; // lowercase-with-hyphens
  displayName: string; // Human-readable name
  description: string; // Clear, concise purpose
  personality: 'professional' | 'friendly' | 'efficient' | 'creative' | 'mentor';
  tools: string[]; // Tool permissions
  model: 'sonnet' | 'opus' | 'haiku' | 'inherit';
  specialization: string; // Area of expertise
  icon?: string; // Emoji icon
}

export interface SkillSpec {
  name: string; // lowercase-with-hyphens
  displayName: string; // Human-readable name
  description: string; // Clear, concise purpose when to use this skill
  category: 'workflow' | 'tool-integration' | 'domain-expertise' | 'bundled-resources';
  hasScripts: boolean; // Will include executable scripts
  hasReferences: boolean; // Will include reference documentation
  hasAssets: boolean; // Will include template files/assets
  icon?: string; // Emoji icon
}

export interface UserStats {
  droidsCreated: number;
  droidsUsed: number;
  achievements: Achievement[];
  favoriteTemplate: string;
  creationDates: Record<string, string>;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  unlockedAt: string;
}

export const TOOL_LEVELS = {
  READ_ONLY: {
    level: 1,
    name: 'Read-Only',
    tools: ['Read', 'Grep', 'Glob'],
    description: 'Safest - Research, analysis, exploration',
  },
  READ_WEB: {
    level: 2,
    name: 'Read + Web',
    tools: ['Read', 'Grep', 'Glob', 'WebFetch', 'WebSearch'],
    description: 'Moderate - Web research, content extraction',
  },
  READ_EXECUTE: {
    level: 3,
    name: 'Read + Execute',
    tools: ['Read', 'Grep', 'Glob', 'Bash'],
    description: 'Elevated - Code analysis, testing, builds',
  },
  READ_WRITE: {
    level: 4,
    name: 'Read + Write',
    tools: ['Read', 'Grep', 'Glob', 'Write', 'Edit'],
    description: 'High - Documentation, code generation',
  },
  FULL_ACCESS: {
    level: 5,
    name: 'Full Access',
    tools: ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'WebFetch', 'WebSearch', 'Task'],
    description: 'Maximum - Complex multi-step tasks, orchestration',
  },
} as const;

export const DROID_TEMPLATES: DroidSpec[] = [
  {
    name: 'web-explorer',
    displayName: 'Web Explorer',
    description: 'Browse and analyze web content with intelligent extraction',
    personality: 'professional',
    tools: [...TOOL_LEVELS.READ_WEB.tools],
    model: 'sonnet',
    specialization: 'Web research and content analysis',
    icon: '🌐',
  },
  {
    name: 'code-explorer',
    displayName: 'Code Explorer',
    description: 'Navigate and analyze existing codebase with deep understanding',
    personality: 'efficient',
    tools: [...TOOL_LEVELS.READ_EXECUTE.tools],
    model: 'sonnet',
    specialization: 'Code analysis and architecture understanding',
    icon: '🔍',
  },
  {
    name: 'doc-writer',
    displayName: 'Documentation Writer',
    description: 'Create comprehensive documentation from code and context',
    personality: 'friendly',
    tools: [...TOOL_LEVELS.READ_WRITE.tools],
    model: 'sonnet',
    specialization: 'Technical writing and documentation',
    icon: '📝',
  },
  {
    name: 'bug-hunter',
    displayName: 'Bug Hunter',
    description: 'Identify and analyze bugs with detailed debugging support',
    personality: 'efficient',
    tools: [...TOOL_LEVELS.READ_EXECUTE.tools],
    model: 'sonnet',
    specialization: 'Debugging and error analysis',
    icon: '🐛',
  },
  {
    name: 'test-generator',
    displayName: 'Test Generator',
    description: 'Generate comprehensive test suites with edge cases',
    personality: 'professional',
    tools: [...TOOL_LEVELS.READ_WRITE.tools],
    model: 'sonnet',
    specialization: 'Test automation and quality assurance',
    icon: '🧪',
  },
];

export const SKILL_TEMPLATES: SkillSpec[] = [
  {
    name: 'api-client',
    displayName: 'API Client',
    description: 'Create skills for integrating with specific APIs and web services',
    category: 'tool-integration',
    hasScripts: true,
    hasReferences: true,
    hasAssets: false,
  },
  {
    name: 'data-processor',
    displayName: 'Data Processor',
    description: 'Build skills for specialized data transformation and processing tasks',
    category: 'workflow',
    hasScripts: true,
    hasReferences: false,
    hasAssets: false,
  },
  {
    name: 'report-generator',
    displayName: 'Report Generator',
    description: 'Generate custom reports with templates and formatting',
    category: 'bundled-resources',
    hasScripts: false,
    hasReferences: true,
    hasAssets: true,
  },
  {
    name: 'workflow-automation',
    displayName: 'Workflow Automation',
    description: 'Automate multi-step business processes and workflows',
    category: 'workflow',
    hasScripts: true,
    hasReferences: true,
    hasAssets: false,
  },
  {
    name: 'domain-expert',
    displayName: 'Domain Expert',
    description: 'Package specialized knowledge for specific industries or domains',
    category: 'domain-expertise',
    hasScripts: false,
    hasReferences: true,
    hasAssets: false,
  },
];

export const ACHIEVEMENTS_CONFIG: Record<string, Omit<Achievement, 'id' | 'unlockedAt'>> = {
  FIRST_STEPS: {
    name: 'First Steps',
    icon: '🦆',
    description: 'Create your first droid',
  },
  DROID_COMMANDER: {
    name: 'Droid Commander',
    icon: '🤖',
    description: 'Create 5 droids',
  },
  WEB_MASTER: {
    name: 'Web Master',
    icon: '🌐',
    description: 'Create Web Explorer droid',
  },
  CODE_ARCHAEOLOGIST: {
    name: 'Code Archaeologist',
    icon: '🔍',
    description: 'Create Code Explorer droid',
  },
  QUALITY_GUARDIAN: {
    name: 'Quality Guardian',
    icon: '🧪',
    description: 'Create Test Generator droid',
  },
  SKILL_MASTER: {
    name: 'Skill Master',
    icon: '⚡',
    description: 'Create your first skill',
  },
};
