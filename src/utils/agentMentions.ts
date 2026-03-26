/**
 * Agent Mentions Parser
 *
 * Parses @mentions from messages and extracts agent references.
 * Example: "@mike @julie vorrei un progetto..." → extracts ["mike", "julie"]
 */

import type { AgentInfo } from '../types';

export interface AgentMention {
  agentName: string;
  startIndex: number;
  endIndex: number;
  fullMatch: string;
}

/**
 * Parse @mentions from text and return array of mentions with positions
 * Matches patterns like: @mike, @julie-designer, @john-backend
 */
export function parseAgentMentions(text: string): AgentMention[] {
  const mentions: AgentMention[] = [];
  // Match @ followed by word characters and hyphens, but NOT inside emails
  // Brain: fix-mention-regex-email-false-positive
  const mentionRegex = /(?<!\w)@([\w-]+)/g;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push({
      agentName: match[1],
      startIndex: match.index,
      endIndex: match.index + match[0].length,
      fullMatch: match[0],
    });
  }

  return mentions;
}

/**
 * Extract agent names from @mentions in text
 * Example: "@mike @julie hello" → ["mike", "julie"]
 */
export function extractAgentNames(text: string): string[] {
  const mentions = parseAgentMentions(text);
  return mentions.map(m => m.agentName);
}

/**
 * Match mentioned agent names to actual AgentInfo objects
 * Fuzzy matching: "mike" matches "mike-project-manager"
 */
export function matchMentionsToAgents(
  text: string,
  availableAgents: AgentInfo[]
): AgentInfo[] {
  const mentionedNames = extractAgentNames(text);
  const matchedAgents: AgentInfo[] = [];

  for (const mentionedName of mentionedNames) {
    // Find agent where name contains the mentioned text
    const agent = availableAgents.find(a =>
      a.name.toLowerCase().includes(mentionedName.toLowerCase())
    );

    if (agent && !matchedAgents.find(a => a.name === agent.name)) {
      matchedAgents.push(agent);
    }
  }

  return matchedAgents;
}

/**
 * Remove @mentions from text
 * Example: "@mike @julie hello" → "hello"
 */
export function stripMentions(text: string): string {
  return text.replace(/(?<!\w)@[\w-]+/g, '').trim().replace(/\s+/g, ' ');
}

/**
 * Check if text contains any @mentions
 */
export function hasMentions(text: string): boolean {
  return /(?<!\w)@[\w-]+/.test(text);
}
