/**
 * Supertag Configuration Service
 *
 * Manages supertag configurations (colors, properties) stored as MCP entities.
 * Entity format: { name: "supertag_config_{tagName}", entityType: "supertag_config", observations: ["config:{...}"] }
 */

import { invoke } from '@tauri-apps/api/core';

// Property type definitions
export type SupertagPropertyType = 'text' | 'date' | 'select' | 'entity' | 'image';

export interface SupertagPropertyOption {
  value: string;
  label: string;
}

export interface SupertagProperty {
  id: string;
  name: string;
  type: SupertagPropertyType;
  options?: SupertagPropertyOption[]; // For 'select' type
}

export interface SupertagConfig {
  name: string;
  color: string;
  properties: SupertagProperty[];
  createdAt?: number;
  updatedAt?: number;
}

// Default colors for built-in supertags (fallback when no config exists)
export const DEFAULT_SUPERTAG_COLORS: Record<string, string> = {
  preference: '#3b82f6',
  fact: '#10b981',
  decision: '#8b5cf6',
  pattern: '#f97316',
  mistake: '#ef4444',
  context: '#6b7280',
  person: '#E84A7F',
  project: '#E84A7F',
  technology: '#00d9ff',
  tool: '#00d9ff',
  task: '#f59e0b',
  note: '#8b5cf6',
  idea: '#10b981',
  diary: '#f97316',
  meeting: '#3b82f6',
  bug: '#ef4444',
  feature: '#10b981',
  question: '#f59e0b',
  answer: '#10b981',
  resource: '#8b5cf6',
  bookmark: '#00d9ff',
  quote: '#6b7280',
  goal: '#E84A7F',
  habit: '#3b82f6',
  review: '#f97316',
  document: '#14b8a6', // teal - for linked documentation files
};

// Color palette for picker
export const COLOR_PALETTE = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#10b981', // emerald
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#00d9ff', // sky (brand)
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#E84A7F', // rose (brand)
  '#6b7280', // gray
];

// In-memory cache for configs
let configCache: Map<string, SupertagConfig> = new Map();
let cacheInitialized = false;

/**
 * Get the entity name for a supertag config
 */
function getConfigEntityName(tagName: string): string {
  return `supertag_config_${tagName.toLowerCase()}`;
}

/**
 * Parse a supertag config from MCP entity observations
 */
function parseConfigFromObservations(observations: string[]): SupertagConfig | null {
  for (const obs of observations) {
    if (obs.startsWith('config:')) {
      try {
        const jsonStr = obs.substring(7); // Remove "config:" prefix
        return JSON.parse(jsonStr);
      } catch (e) {
        console.error('Failed to parse supertag config:', e);
      }
    }
  }
  return null;
}

/**
 * Serialize a supertag config to MCP observation format
 */
function serializeConfigToObservation(config: SupertagConfig): string {
  return `config:${JSON.stringify(config)}`;
}

/**
 * Load all supertag configs from MCP memory
 */
export async function loadSupertagConfigs(): Promise<Map<string, SupertagConfig>> {
  try {
    const result = await invoke<{ entities: Array<{ name: string; entityType: string; observations: string[] }> }>('read_mcp_memory');

    const configs = new Map<string, SupertagConfig>();

    for (const entity of result.entities) {
      if (entity.entityType === 'supertag_config') {
        const config = parseConfigFromObservations(entity.observations);
        if (config) {
          configs.set(config.name.toLowerCase(), config);
        }
      }
    }

    configCache = configs;
    cacheInitialized = true;

    return configs;
  } catch (error) {
    console.error('Failed to load supertag configs:', error);
    return new Map();
  }
}

/**
 * Get a specific supertag config (with fallback to defaults)
 */
export function getSupertagConfig(tagName: string): SupertagConfig {
  const normalizedName = tagName.toLowerCase();

  // Check cache first
  const cached = configCache.get(normalizedName);
  if (cached) {
    return cached;
  }

  // Return default config
  return {
    name: normalizedName,
    color: DEFAULT_SUPERTAG_COLORS[normalizedName] || '#6b7280',
    properties: [],
  };
}

/**
 * Get color for a supertag (with fallback to defaults)
 */
export function getSupertagColor(tagName: string): string {
  const normalizedName = tagName.toLowerCase();

  // Check cache first
  const cached = configCache.get(normalizedName);
  if (cached) {
    return cached.color;
  }

  // Return default color
  return DEFAULT_SUPERTAG_COLORS[normalizedName] || '#6b7280';
}

/**
 * Save/update a supertag config to MCP memory
 */
export async function saveSupertagConfig(config: SupertagConfig): Promise<boolean> {
  try {
    const entityName = getConfigEntityName(config.name);
    const normalizedConfig = {
      ...config,
      name: config.name.toLowerCase(),
      updatedAt: Date.now(),
      createdAt: config.createdAt || Date.now(),
    };

    // Check if config entity already exists
    const existingConfig = configCache.get(normalizedConfig.name);

    if (existingConfig) {
      // Update existing entity's observations
      const observation = serializeConfigToObservation(normalizedConfig);
      await invoke<boolean>('update_mcp_memory_observations', {
        entityName,
        observations: [observation],
      });
    } else {
      // Create new entity
      const entity = {
        name: entityName,
        entityType: 'supertag_config',
        observations: [serializeConfigToObservation(normalizedConfig)],
      };
      await invoke<boolean>('write_mcp_memory_entity', { entity });
    }

    // Update cache
    configCache.set(normalizedConfig.name, normalizedConfig);

    // Emit event for UI refresh
    window.dispatchEvent(new CustomEvent('SUPERTAG_CONFIG_UPDATED', {
      detail: { tagName: normalizedConfig.name }
    }));

    return true;
  } catch (error) {
    console.error('Failed to save supertag config:', error);
    return false;
  }
}

/**
 * Delete a supertag config from MCP memory
 */
export async function deleteSupertagConfig(tagName: string): Promise<boolean> {
  try {
    const entityName = getConfigEntityName(tagName);
    const normalizedName = tagName.toLowerCase();

    await invoke<boolean>('delete_mcp_memory_entity', { entityName });

    // Update cache
    configCache.delete(normalizedName);

    // Emit event for UI refresh
    window.dispatchEvent(new CustomEvent('SUPERTAG_CONFIG_UPDATED', {
      detail: { tagName: normalizedName, deleted: true }
    }));

    return true;
  } catch (error) {
    console.error('Failed to delete supertag config:', error);
    return false;
  }
}

/**
 * Check if configs have been loaded
 */
export function isConfigCacheInitialized(): boolean {
  return cacheInitialized;
}

/**
 * Get all cached configs
 */
export function getAllCachedConfigs(): Map<string, SupertagConfig> {
  return new Map(configCache);
}

/**
 * Generate a unique ID for a property
 */
export function generatePropertyId(): string {
  return `prop_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}
