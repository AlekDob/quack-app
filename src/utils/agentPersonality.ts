/**
 * Agent Personality Helpers
 *
 * Centralizes the "inject persona into CLAUDE.md before daemon spawn" pattern.
 *
 * WHY: The Claude Agent SDK daemon reads CLAUDE.md at startup from its cwd to
 * establish identity (agent name, role, rules, communication style). Before
 * spawning a session for a specific agent we MUST rewrite the CLAUDE.md
 * personality block so the daemon identifies itself correctly.
 *
 * Used by:
 *  - Sidebar agent click (handleSelectTerminal)
 *  - Automation fire job (manual + scheduler tick)
 *  - Remote execute / `@team` delegation (remote-execute listener)
 *
 * Brain: 025-team-delegation-footer
 *   Fix: `@team` delegation was spawning a teammate daemon in a cwd whose
 *   CLAUDE.md still held the LEAD agent's persona — so the teammate
 *   identified as the lead. Centralizing the injection and calling it before
 *   createSession in the remote-execute listener closes the gap.
 */

import { invoke } from "@tauri-apps/api/core";
import type { AgentPersonality, TerminalInfo } from "../types";

export type AgentWithPersonality = Pick<TerminalInfo, "personality" | "cwd">;

/**
 * Inject an agent's personality into CLAUDE.md at the given project path.
 *
 * Best-effort: failures are logged (console.warn) but never thrown — a failed
 * injection should NOT abort session creation or job firing. The daemon will
 * still start; at worst the identity block is stale.
 *
 * No-op when:
 *   - agent is undefined
 *   - agent.personality is missing
 *   - resolved target path is empty
 *
 * @param agent       terminal/agent carrying the personality blob in memory
 * @param projectPath explicit override; falls back to `agent.cwd`
 */
export async function injectAgentPersonality(
  agent: AgentWithPersonality | undefined,
  projectPath?: string,
): Promise<void> {
  if (!agent?.personality) return;
  const target = projectPath || agent.cwd;
  if (!target) return;

  try {
    await invoke("inject_personality_to_claude_md", {
      projectPath: target,
      personality: agent.personality as Partial<AgentPersonality>,
    });
  } catch (err) {
    console.warn("[injectAgentPersonality] Failed to inject personality:", err);
  }
}
