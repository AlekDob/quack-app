/**
 * Agent Storage Service
 *
 * Manages saved agents in localStorage for reuse across projects.
 * Each agent includes personality, avatar, color, and other settings.
 */

import type { AgentPersonality } from '../types';
import { migrateRulePaths } from './rulePathUtils';

interface SavedAgent {
  id: string;
  name: string;
  avatar: string;
  color: string;
  workingOn?: string;
  personality: Partial<AgentPersonality>;
  createdAt: number;
  lastUsed: number;
  usageCount: number; // Track how many times this agent has been used
}

const STORAGE_KEY = 'quack-saved-agents';
const MAX_AGENTS = 50; // Reasonable limit to prevent storage issues

/**
 * Get all saved agents from localStorage
 * Automatically migrates legacy absolute rule paths to normalized format
 */
export function getSavedAgents(): SavedAgent[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const agents = JSON.parse(stored) as SavedAgent[];

    // Validate structure and filter out corrupted entries
    const validAgents = agents.filter(agent =>
      agent.id &&
      agent.name &&
      typeof agent.createdAt === 'number' &&
      typeof agent.lastUsed === 'number'
    );

    // Silently migrate legacy rule paths to normalized format
    let needsSave = false;
    const migratedAgents = validAgents.map(agent => {
      if (agent.personality?.selectedRules && agent.personality.selectedRules.length > 0) {
        const originalPaths = agent.personality.selectedRules;
        const normalizedPaths = migrateRulePaths(originalPaths);

        // Check if any path was actually changed
        const wasChanged = originalPaths.some((path, i) => path !== normalizedPaths[i]);
        if (wasChanged) {
          needsSave = true;
          console.log(`[agentStorage] Migrated rule paths for agent "${agent.name}"`);
          return {
            ...agent,
            personality: {
              ...agent.personality,
              selectedRules: normalizedPaths,
            },
          };
        }
      }
      return agent;
    });

    // Save migrated data back to storage (silently)
    if (needsSave) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(migratedAgents));
        console.log('[agentStorage] Saved migrated agents to storage');
      } catch (saveError) {
        console.warn('[agentStorage] Failed to save migrated agents:', saveError);
      }
    }

    return migratedAgents;
  } catch (error) {
    console.error('Failed to load saved agents:', error);
    return [];
  }
}

/**
 * Save a new agent or update existing one
 * @param agent - Agent data to save
 * @param existingId - If provided, update agent with this ID (for edit mode)
 */
export function saveAgent(
  agent: Omit<SavedAgent, 'id' | 'createdAt' | 'lastUsed' | 'usageCount'>,
  existingId?: string
): SavedAgent {
  const agents = getSavedAgents();

  // Check if agent exists - first by ID (edit mode), then by name (backwards compat)
  let existingIndex = -1;
  if (existingId) {
    existingIndex = agents.findIndex(a => a.id === existingId);
  }
  if (existingIndex < 0) {
    existingIndex = agents.findIndex(a => a.name === agent.name);
  }

  const now = Date.now();
  let savedAgent: SavedAgent;

  if (existingIndex >= 0) {
    // Update existing agent
    savedAgent = {
      ...agents[existingIndex],
      ...agent,
      lastUsed: now,
      usageCount: agents[existingIndex].usageCount + 1,
    };
    agents[existingIndex] = savedAgent;
  } else {
    // Create new agent
    savedAgent = {
      ...agent,
      id: `agent-${now}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: now,
      lastUsed: now,
      usageCount: 1,
    };

    // Add to beginning of array (most recent first)
    agents.unshift(savedAgent);

    // Enforce max agents limit
    if (agents.length > MAX_AGENTS) {
      agents.splice(MAX_AGENTS);
    }
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  } catch (error) {
    console.error('Failed to save agent:', error);
    throw new Error('Failed to save agent to storage');
  }

  return savedAgent;
}

/**
 * Update an existing agent's properties
 */
function updateAgent(id: string, updates: Partial<Omit<SavedAgent, 'id' | 'createdAt'>>): SavedAgent | null {
  const agents = getSavedAgents();
  const index = agents.findIndex(a => a.id === id);

  if (index === -1) {
    console.warn(`Agent with id ${id} not found`);
    return null;
  }

  const updatedAgent = {
    ...agents[index],
    ...updates,
    lastUsed: Date.now(),
  };

  agents[index] = updatedAgent;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  } catch (error) {
    console.error('Failed to update agent:', error);
    throw new Error('Failed to update agent in storage');
  }

  return updatedAgent;
}

/**
 * Delete an agent by ID
 */
export function deleteAgent(id: string): boolean {
  const agents = getSavedAgents();
  const filteredAgents = agents.filter(a => a.id !== id);

  if (filteredAgents.length === agents.length) {
    console.warn(`Agent with id ${id} not found`);
    return false;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredAgents));
    return true;
  } catch (error) {
    console.error('Failed to delete agent:', error);
    return false;
  }
}

/**
 * Get most recently used agents
 */
export function getRecentAgents(limit: number = 5): SavedAgent[] {
  const agents = getSavedAgents();

  // Sort by lastUsed descending
  return agents
    .sort((a, b) => b.lastUsed - a.lastUsed)
    .slice(0, limit);
}

/**
 * Get most frequently used agents
 */
export function getFrequentAgents(limit: number = 5): SavedAgent[] {
  const agents = getSavedAgents();

  // Sort by usageCount descending, then by lastUsed
  return agents
    .sort((a, b) => {
      if (b.usageCount === a.usageCount) {
        return b.lastUsed - a.lastUsed;
      }
      return b.usageCount - a.usageCount;
    })
    .slice(0, limit);
}

/**
 * Search agents by name
 */
export function searchAgents(query: string): SavedAgent[] {
  if (!query.trim()) {
    return getSavedAgents();
  }

  const agents = getSavedAgents();
  const lowerQuery = query.toLowerCase();

  return agents.filter(agent =>
    agent.name.toLowerCase().includes(lowerQuery) ||
    agent.personality?.role?.toLowerCase().includes(lowerQuery) ||
    agent.workingOn?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Mark an agent as used (updates lastUsed and usageCount)
 */
export function markAgentAsUsed(id: string): SavedAgent | null {
  const agents = getSavedAgents();
  const index = agents.findIndex(a => a.id === id);

  if (index === -1) {
    return null;
  }

  const updatedAgent = {
    ...agents[index],
    lastUsed: Date.now(),
    usageCount: agents[index].usageCount + 1,
  };

  agents[index] = updatedAgent;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(agents));
  } catch (error) {
    console.error('Failed to mark agent as used:', error);
  }

  return updatedAgent;
}

/**
 * Clear all saved agents (for debugging/reset)
 */
function clearAllAgents(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Failed to clear agents:', error);
  }
}

/**
 * Export agents as JSON (for backup)
 */
function exportAgents(): string {
  const agents = getSavedAgents();
  return JSON.stringify(agents, null, 2);
}

/**
 * Import agents from JSON (for restore)
 */
function importAgents(json: string): number {
  try {
    const importedAgents = JSON.parse(json) as SavedAgent[];

    if (!Array.isArray(importedAgents)) {
      throw new Error('Invalid format: expected array of agents');
    }

    // Validate each agent
    const validAgents = importedAgents.filter(agent =>
      agent.id &&
      agent.name &&
      typeof agent.createdAt === 'number'
    );

    // Merge with existing agents (avoid duplicates by name)
    const existingAgents = getSavedAgents();
    const existingNames = new Set(existingAgents.map(a => a.name));

    const newAgents = validAgents.filter(a => !existingNames.has(a.name));
    const mergedAgents = [...existingAgents, ...newAgents];

    // Enforce max limit
    const finalAgents = mergedAgents.slice(0, MAX_AGENTS);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(finalAgents));

    return newAgents.length;
  } catch (error) {
    console.error('Failed to import agents:', error);
    throw new Error('Failed to import agents: ' + (error as Error).message);
  }
}
