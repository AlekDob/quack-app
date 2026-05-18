// Mirror of src-tauri/src/agents/events.rs. Keep in sync.
export type AgentBackendKind = 'claude' | 'codex';

export type QuackAgentEvent =
  | { kind: 'session_started'; backend_session_id: string; model: string | null; backend: AgentBackendKind }
  | { kind: 'text_delta'; content: string }
  | { kind: 'tool_call_start'; id: string; name: string; args: unknown }
  | { kind: 'tool_call_end'; id: string; output: string; error: string | null }
  | { kind: 'usage'; input_tokens: number; output_tokens: number; cached_tokens: number; cost_usd: number | null }
  | { kind: 'error'; code: string; message: string; recoverable: boolean }
  | { kind: 'session_ended'; reason: string };
