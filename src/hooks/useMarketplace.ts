import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';
import type { MarketplaceResource, MarketplaceCategory, MarketplaceFilters, MarketplaceLibrary } from '../types';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/AlekDob/quack-marketplace/main';
const MARKETPLACE_JSON_URL = `${GITHUB_RAW_BASE}/.claude-plugin/marketplace.json`;

interface MarketplaceJson {
  name: string;
  description: string;
  owner: { name: string; url?: string };
  plugins: Array<{
    name: string;
    source: string;
    description: string;
    version: string;
    tags?: string[];
  }>;
}

interface PluginJson {
  name: string;
  version: string;
  description: string;
  author?: { name: string; url?: string };
  repository?: string;
  license?: string;
  keywords?: string[];
  skills?: string[];
  agents?: string[];
}

/**
 * Fetches marketplace data from the quack-marketplace GitHub repo.
 * Dynamically discovers plugins and their contents without hardcoded data.
 */
export function useMarketplace() {
  const [resources, setResources] = useState<MarketplaceResource[]>([]);
  const [library, setLibrary] = useState<MarketplaceLibrary>({
    installedResources: [],
    customStacks: [],
    favorites: [],
    lastSync: Date.now(),
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<MarketplaceFilters>({
    sortBy: 'name',
  });
  const [categories, setCategories] = useState<MarketplaceCategory[]>([]);

  // Fetch marketplace.json and build resource list from GitHub
  const loadResources = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Step 1: Fetch the marketplace manifest
      const marketplaceRes = await fetch(MARKETPLACE_JSON_URL);
      if (!marketplaceRes.ok) {
        throw new Error(`Failed to fetch marketplace: ${marketplaceRes.status}`);
      }
      const marketplace: MarketplaceJson = await marketplaceRes.json();

      const allResources: MarketplaceResource[] = [];
      const discoveredCategories = new Set<MarketplaceCategory>();

      // Step 2: For each plugin, fetch its plugin.json
      for (const plugin of marketplace.plugins) {
        const pluginSource = plugin.source.replace('./', '');
        const pluginJsonUrl = `${GITHUB_RAW_BASE}/${pluginSource}/.claude-plugin/plugin.json`;

        const pluginRes = await fetch(pluginJsonUrl);
        if (!pluginRes.ok) continue;

        const pluginData: PluginJson = await pluginRes.json();
        const author = pluginData.author?.name || marketplace.owner.name;

        // Create resources for each skill
        if (pluginData.skills) {
          discoveredCategories.add('skills');
          for (const skillPath of pluginData.skills) {
            const skillName = skillPath.split('/').pop() || skillPath;
            allResources.push({
              id: `${plugin.name}--skill--${skillName}`,
              name: formatName(skillName),
              description: `Skill from ${plugin.name} plugin`,
              category: 'skills',
              author,
              installCount: 0,
              tags: pluginData.keywords || plugin.tags || [],
              version: pluginData.version,
              installCommand: '', // Will be handled by custom install
              repository: pluginData.repository,
              verified: true,
              featured: skillName === 'quack-brain',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              // Custom fields for installation
              _pluginSource: pluginSource,
              _skillPath: skillPath,
            } as MarketplaceResource & { _pluginSource: string; _skillPath: string });
          }
        }

        // Create resources for each agent
        if (pluginData.agents) {
          discoveredCategories.add('agents');
          for (const agentPath of pluginData.agents) {
            const agentName = agentPath.split('/').pop()?.replace('.md', '') || agentPath;
            allResources.push({
              id: `${plugin.name}--agent--${agentName}`,
              name: formatName(agentName),
              description: `Agent from ${plugin.name} plugin`,
              category: 'agents',
              author,
              installCount: 0,
              tags: pluginData.keywords || plugin.tags || [],
              version: pluginData.version,
              installCommand: '', // Will be handled by custom install
              repository: pluginData.repository,
              verified: true,
              featured: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              _pluginSource: pluginSource,
              _agentPath: agentPath,
            } as MarketplaceResource & { _pluginSource: string; _agentPath: string });
          }
        }
      }

      // Try to load skill descriptions from their skill.md files
      await enrichSkillDescriptions(allResources);

      setResources(allResources);
      setCategories(Array.from(discoveredCategories));

      // Check which resources are already installed
      await checkInstalledResources(allResources);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load marketplace');
    } finally {
      setLoading(false);
    }
  }, []);

  // Enrich skill descriptions by fetching skill.md files
  const enrichSkillDescriptions = async (resources: MarketplaceResource[]) => {
    const skills = resources.filter(r => r.category === 'skills');
    const fetchPromises = skills.map(async (resource) => {
      const ext = resource as MarketplaceResource & { _pluginSource?: string; _skillPath?: string };
      if (!ext._pluginSource || !ext._skillPath) return;

      const skillMdUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._skillPath}/SKILL.md`;
      try {
        const res = await fetch(skillMdUrl);
        if (!res.ok) return;
        const content = await res.text();
        // Extract description from first paragraph after frontmatter
        const descMatch = content.match(/^---[\s\S]*?---\s*\n\s*#[^\n]*\n\s*\n([^\n]+)/);
        if (descMatch) {
          resource.description = descMatch[1].trim().slice(0, 120);
        }
      } catch {
        // Silent fail - keep default description
      }
    });
    await Promise.allSettled(fetchPromises);
  };

  // Check which resources are installed locally
  const checkInstalledResources = async (allResources: MarketplaceResource[]) => {
    try {
      const home = await homeDir();
      const installed: MarketplaceResource[] = [];

      for (const resource of allResources) {
        const ext = resource as MarketplaceResource & {
          _pluginSource?: string;
          _skillPath?: string;
          _agentPath?: string;
        };

        let checkPath = '';
        if (ext._skillPath) {
          const skillName = ext._skillPath.split('/').pop() || '';
          checkPath = `${home}.claude/skills/${skillName}/SKILL.md`;
        } else if (ext._agentPath) {
          const agentFile = ext._agentPath.split('/').pop() || '';
          checkPath = `${home}.claude/agents/${agentFile}`;
        }

        if (checkPath) {
          try {
            await invoke<string>('read_file_content', { path: checkPath });
            installed.push(resource);
          } catch {
            // Not installed
          }
        }
      }

      setLibrary(prev => ({
        ...prev,
        installedResources: installed,
        lastSync: Date.now(),
      }));
    } catch {
      // Can't check installed status
    }
  };

  // Filter and sort resources
  const filteredResources = useCallback(() => {
    let result = [...resources];

    if (filters.category) {
      result = result.filter(r => r.category === filters.category);
    }

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      result = result.filter(r =>
        r.name.toLowerCase().includes(query) ||
        r.description.toLowerCase().includes(query) ||
        r.tags.some(tag => tag.toLowerCase().includes(query))
      );
    }

    if (filters.verified) {
      result = result.filter(r => r.verified);
    }

    switch (filters.sortBy) {
      case 'name':
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'recent':
        result.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
    }

    return result;
  }, [resources, filters]);

  // Install a resource by downloading from GitHub
  const installResource = useCallback(async (resource: MarketplaceResource): Promise<boolean> => {
    const ext = resource as MarketplaceResource & {
      _pluginSource?: string;
      _skillPath?: string;
      _agentPath?: string;
    };

    try {
      const home = await homeDir();

      if (ext._skillPath && ext._pluginSource) {
        // Download the skill folder (skill.md file)
        const skillName = ext._skillPath.split('/').pop() || '';
        const skillMdUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._skillPath}/SKILL.md`;

        const res = await fetch(skillMdUrl);
        if (!res.ok) throw new Error(`Failed to download skill: ${res.status}`);
        const content = await res.text();

        // Write to ~/.claude/skills/{skillName}/SKILL.md
        const targetDir = `${home}.claude/skills/${skillName}`;
        const targetPath = `${targetDir}/SKILL.md`;

        // Create directory and write file
        await invoke('create_directory', { path: targetDir });
        await invoke('write_file_content', { path: targetPath, content });
      } else if (ext._agentPath && ext._pluginSource) {
        // Download the agent .md file
        const agentFile = ext._agentPath.split('/').pop() || '';
        const agentUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._agentPath}`;

        const res = await fetch(agentUrl);
        if (!res.ok) throw new Error(`Failed to download agent: ${res.status}`);
        const content = await res.text();

        // Write to ~/.claude/agents/{agentFile}
        const targetDir = `${home}.claude/agents`;
        const targetPath = `${targetDir}/${agentFile}`;

        await invoke('create_directory', { path: targetDir });
        await invoke('write_file_content', { path: targetPath, content });
      } else {
        throw new Error('Unknown resource type');
      }

      // Add to installed
      setLibrary(prev => ({
        ...prev,
        installedResources: [...prev.installedResources, resource],
      }));

      return true;
    } catch (err) {
      console.error('Failed to install resource:', err);
      throw err;
    }
  }, []);

  // Uninstall a resource by removing its files
  const uninstallResource = useCallback(async (resourceId: string): Promise<boolean> => {
    const resource = resources.find(r => r.id === resourceId);
    if (!resource) return false;

    const ext = resource as MarketplaceResource & {
      _pluginSource?: string;
      _skillPath?: string;
      _agentPath?: string;
    };

    try {
      const home = await homeDir();

      if (ext._skillPath) {
        const skillName = ext._skillPath.split('/').pop() || '';
        const targetDir = `${home}.claude/skills/${skillName}`;
        await invoke('remove_directory', { path: targetDir });
      } else if (ext._agentPath) {
        const agentFile = ext._agentPath.split('/').pop() || '';
        const targetPath = `${home}.claude/agents/${agentFile}`;
        await invoke('remove_file', { path: targetPath });
      }

      setLibrary(prev => ({
        ...prev,
        installedResources: prev.installedResources.filter(r => r.id !== resourceId),
      }));

      return true;
    } catch (err) {
      console.error('Failed to uninstall resource:', err);
      throw err;
    }
  }, [resources]);

  // Toggle favorite
  const toggleFavorite = useCallback((resourceId: string) => {
    setLibrary(prev => ({
      ...prev,
      favorites: prev.favorites.includes(resourceId)
        ? prev.favorites.filter(id => id !== resourceId)
        : [...prev.favorites, resourceId],
    }));
  }, []);

  const isInstalled = useCallback((resourceId: string) => {
    return library.installedResources.some(r => r.id === resourceId);
  }, [library]);

  const isFavorite = useCallback((resourceId: string) => {
    return library.favorites.includes(resourceId);
  }, [library]);

  // Load on mount
  useEffect(() => {
    loadResources();
  }, [loadResources]);

  return {
    resources: filteredResources(),
    allResources: resources,
    library,
    loading,
    error,
    filters,
    setFilters,
    categories,
    loadResources,
    installResource,
    uninstallResource,
    toggleFavorite,
    isInstalled,
    isFavorite,
  };
}

/** Convert kebab-case to Title Case */
function formatName(slug: string): string {
  return slug
    .replace(/\.md$/, '')
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
