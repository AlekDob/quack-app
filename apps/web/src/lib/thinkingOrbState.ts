// FILE: thinkingOrbState.ts
// Purpose: Map Synara work-log entries to the most appropriate thinking-orbs state.
// Layer: Web presentation helper

import type { OrbState } from "thinking-orbs";

import type { WorkLogEntry } from "../session-logic";

/**
 * Pick a thinking-orbs animation that matches the intent of a work-log entry.
 *
 * Only entries that read as "thinking" / live activity use an orb. The mapping
 * is intentionally conservative: a handful of entry kinds with a clear visual
 * verb get a dedicated state; everything else falls back to the generic
 * "solving" thinking animation so the UI stays predictable.
 */
export function thinkingOrbStateForWorkEntry(entry: WorkLogEntry): OrbState {
  // Searching the codebase or the web.
  if (entry.requestKind === "file-read" || entry.itemType === "web_search") {
    return "searching";
  }

  // Editing / shaping files.
  if (entry.requestKind === "file-change") {
    return "shaping";
  }

  // Running commands in the terminal.
  if (entry.itemType === "command_execution" || entry.command) {
    return "working";
  }

  // Calling out to external capability servers.
  if (entry.itemType === "mcp_tool_call") {
    return "weaving";
  }

  // Spawning / talking to subagents.
  if (entry.itemType === "collab_agent_tool_call") {
    return "connecting";
  }

  // Generic reasoning / thinking fallback.
  return "solving";
}
