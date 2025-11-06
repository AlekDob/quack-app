/**
 * Agent Names Collection
 *
 * International collection of agent names from various countries and cultures.
 * Used for random agent name generation throughout the application.
 */

import type { AgentInfo } from '../types';

// International agent names collection
export const AGENT_NAMES = [
  // Original Quack Team
  'Agent Jack',
  'Agent Mike',
  'Agent Julie',
  'Agent John',
  'Agent Scott',
  'Agent Carmelo',
  'Agent Giuseppe',
  'Agent Roberta',

  // English names
  'Agent Charlie',
  'Agent Alex',
  'Agent Sam',
  'Agent Jordan',
  'Agent Taylor',
  'Agent Morgan',
  'Agent Casey',
  'Agent Riley',
  'Agent Quinn',
  'Agent Avery',
  'Agent Parker',
  'Agent Skylar',
  'Agent Oliver',
  'Agent Emma',
  'Agent James',
  'Agent Sophie',
  'Agent William',
  'Agent Grace',

  // Italian names
  'Agent Marco',
  'Agent Sofia',
  'Agent Leonardo',
  'Agent Giulia',
  'Agent Alessandro',
  'Agent Francesca',
  'Agent Matteo',
  'Agent Chiara',
  'Agent Lorenzo',
  'Agent Valentina',
  'Agent Luca',
  'Agent Elena',

  // French names
  'Agent Pierre',
  'Agent Marie',
  'Agent Antoine',
  'Agent Camille',
  'Agent Lucas',
  'Agent Chloé',
  'Agent Thomas',
  'Agent Léa',
  'Agent Hugo',
  'Agent Manon',

  // Spanish names
  'Agent Carlos',
  'Agent María',
  'Agent Diego',
  'Agent Carmen',
  'Agent Pablo',
  'Agent Ana',
  'Agent Javier',
  'Agent Isabel',
  'Agent Miguel',
  'Agent Laura',

  // German names
  'Agent Hans',
  'Agent Anna',
  'Agent Felix',
  'Agent Emma',
  'Agent Lukas',
  'Agent Lisa',
  'Agent Maximilian',
  'Agent Sophia',

  // Portuguese names
  'Agent João',
  'Agent Maria',
  'Agent Pedro',
  'Agent Ana',
  'Agent Tiago',
  'Agent Beatriz',

  // Dutch names
  'Agent Lars',
  'Agent Eva',
  'Agent Daan',
  'Agent Emma',
  'Agent Finn',
  'Agent Sophie',

  // Scandinavian names
  'Agent Erik',
  'Agent Astrid',
  'Agent Magnus',
  'Agent Freya',
  'Agent Sven',
  'Agent Ingrid',

  // Russian names
  'Agent Dmitri',
  'Agent Natasha',
  'Agent Ivan',
  'Agent Katya',
  'Agent Alexei',
  'Agent Svetlana',

  // Japanese names
  'Agent Yuki',
  'Agent Sakura',
  'Agent Hiroshi',
  'Agent Yui',
  'Agent Kenji',
  'Agent Aiko',

  // Korean names
  'Agent Min-jun',
  'Agent Ji-woo',
  'Agent Seo-jun',
  'Agent Soo-yeon',

  // Chinese names
  'Agent Wei',
  'Agent Lin',
  'Agent Chen',
  'Agent Mei',

  // Arabic names
  'Agent Omar',
  'Agent Layla',
  'Agent Ali',
  'Agent Fatima',

  // Indian names
  'Agent Arjun',
  'Agent Priya',
  'Agent Rohan',
  'Agent Aisha',
];

/**
 * Get random agent name that doesn't exist in the provided list
 * @param existingAgents - Array of existing agents to avoid duplicates
 * @param scope - Optional scope filter ('global' | 'project')
 * @returns Unique agent name
 */
export function getRandomAgentName(
  existingAgents?: AgentInfo[],
  scope?: 'global' | 'project'
): string {
  // Filter existing agents by scope (only check project agents for duplicates)
  const projectAgents = existingAgents?.filter(a => a.scope === scope) || [];
  const existingNames = new Set(projectAgents.map(a => a.name.toLowerCase()));

  // Try to find a unique name
  const availableNames = AGENT_NAMES.filter(name => !existingNames.has(name.toLowerCase()));

  if (availableNames.length > 0) {
    return availableNames[Math.floor(Math.random() * availableNames.length)];
  }

  // If all names are taken, append a number
  let counter = 2;
  let baseName = AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
  while (existingNames.has(`${baseName} ${counter}`.toLowerCase())) {
    counter++;
  }
  return `${baseName} ${counter}`;
}

/**
 * Get a random agent name from the list (without uniqueness check)
 * @returns Random agent name
 */
export function getRandomName(): string {
  return AGENT_NAMES[Math.floor(Math.random() * AGENT_NAMES.length)];
}

/**
 * Get all available agent names
 * @returns Array of all agent names
 */
export function getAllAgentNames(): string[] {
  return [...AGENT_NAMES];
}

/**
 * Search for agent names matching a query
 * @param query - Search query string
 * @returns Array of matching agent names
 */
export function searchAgentNames(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  return AGENT_NAMES.filter(name =>
    name.toLowerCase().includes(lowerQuery)
  );
}
