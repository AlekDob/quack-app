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

// Gender-specific name pools for avatar-matched agent names
const MALE_NAMES = [
  'Agent Jack', 'Agent Mike', 'Agent John', 'Agent Scott', 'Agent Giuseppe',
  'Agent Charlie', 'Agent Oliver', 'Agent James', 'Agent William',
  'Agent Marco', 'Agent Leonardo', 'Agent Alessandro', 'Agent Matteo', 'Agent Lorenzo', 'Agent Luca',
  'Agent Pierre', 'Agent Antoine', 'Agent Lucas', 'Agent Thomas', 'Agent Hugo',
  'Agent Carlos', 'Agent Diego', 'Agent Pablo', 'Agent Javier', 'Agent Miguel',
  'Agent Hans', 'Agent Felix', 'Agent Lukas', 'Agent Maximilian',
  'Agent Lars', 'Agent Daan', 'Agent Finn',
  'Agent Erik', 'Agent Magnus', 'Agent Sven',
  'Agent Dmitri', 'Agent Ivan', 'Agent Alexei',
  'Agent Hiroshi', 'Agent Kenji',
  'Agent Omar', 'Agent Ali', 'Agent Arjun', 'Agent Rohan',
];

const FEMALE_NAMES = [
  'Agent Julie', 'Agent Roberta',
  'Agent Emma', 'Agent Sophie', 'Agent Grace',
  'Agent Sofia', 'Agent Giulia', 'Agent Francesca', 'Agent Chiara', 'Agent Valentina', 'Agent Elena',
  'Agent Marie', 'Agent Camille', 'Agent Chloé', 'Agent Léa', 'Agent Manon',
  'Agent María', 'Agent Carmen', 'Agent Ana', 'Agent Isabel', 'Agent Laura',
  'Agent Anna', 'Agent Lisa', 'Agent Sophia',
  'Agent Eva',
  'Agent Astrid', 'Agent Freya', 'Agent Ingrid',
  'Agent Natasha', 'Agent Katya', 'Agent Svetlana',
  'Agent Sakura', 'Agent Yui', 'Agent Aiko',
  'Agent Layla', 'Agent Fatima', 'Agent Priya', 'Agent Aisha',
];

/**
 * Get a random gender-appropriate agent name
 * @param gender - 'male' or 'female'
 * @param usedNames - Names already assigned (to avoid duplicates)
 * @returns Gender-matched random agent name
 */
export function getRandomGenderedName(
  gender: 'male' | 'female',
  usedNames?: Set<string>
): string {
  const pool = gender === 'male' ? MALE_NAMES : FEMALE_NAMES;
  const available = usedNames
    ? pool.filter(n => !usedNames.has(n))
    : pool;
  if (available.length > 0) {
    return available[Math.floor(Math.random() * available.length)];
  }
  return pool[Math.floor(Math.random() * pool.length)];
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
