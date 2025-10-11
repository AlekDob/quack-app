export type ThinkingMode = 'auto' | 'think' | 'think-hard' | 'think-harder' | 'ultra-think';

export interface ThinkingModeConfig {
  mode: ThinkingMode;
  keyword: string; // Keyword to prepend to prompts
  description: string;
  visualBars: number; // Number of bars to show (0-5)
  color: string; // Visual indicator color
}

export const THINKING_MODES: Record<ThinkingMode, ThinkingModeConfig> = {
  'auto': {
    mode: 'auto',
    keyword: '',
    description: 'Let model decide',
    visualBars: 0,
    color: '#64748b' // gray
  },
  'think': {
    mode: 'think',
    keyword: 'think',
    description: 'Step-by-step',
    visualBars: 1,
    color: '#3b82f6' // blue
  },
  'think-hard': {
    mode: 'think-hard',
    keyword: 'think hard',
    description: 'Deeper reasoning',
    visualBars: 2,
    color: '#8b5cf6' // purple
  },
  'think-harder': {
    mode: 'think-harder',
    keyword: 'think harder',
    description: 'Thorough reasoning',
    visualBars: 3,
    color: '#f59e0b' // orange
  },
  'ultra-think': {
    mode: 'ultra-think',
    keyword: 'Ultrathink.',
    description: 'Maximum deliberation',
    visualBars: 4,
    color: '#ef4444' // red
  },
};

export interface AgentOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  system_prompt?: string;
  thinking_enabled?: boolean; // Keep for backward compatibility
  thinking_mode?: ThinkingMode; // New: more granular thinking control
}

export interface ImageAttachment {
  data: string; // base64 encoded
  media_type: string; // e.g. "image/jpeg", "image/png"
}

export interface AgentResponse {
  result: string;
  thinking?: string;
  model: string;
  usage: AgentUsage;
}

export interface AgentUsage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens: number;
  cache_creation_input_tokens: number;
}

export interface ModelInfo {
  id: string;
  name: string;
  description: string;
  supports_vision: boolean;
  supports_thinking: boolean;
}

export type ChatMode = 'cli' | 'agent';

export interface AgentChatState {
  mode: ChatMode;
  options: AgentOptions;
  attachedImages: File[];
}
