import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';
import type { MarketplaceResource, MarketplaceCategory, MarketplaceFilters, MarketplaceLibrary, AgentTemplate } from '../types';
import { createAgent, type UnifiedAgent } from '../services/unifiedAgentStorage';
import { getRandomGenderedName, getRandomName } from '../utils/agentNames';

const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/AlekDob/quack-marketplace/main';
const cacheBust = () => `?t=${Date.now()}`;
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
  rules?: string[];
  agentTemplate?: AgentTemplate;
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
      const fetchOpts: RequestInit = { cache: 'no-store' };
      const marketplaceRes = await fetch(MARKETPLACE_JSON_URL + cacheBust(), fetchOpts);
      if (!marketplaceRes.ok) {
        throw new Error(`Failed to fetch marketplace: ${marketplaceRes.status}`);
      }
      const marketplace: MarketplaceJson = await marketplaceRes.json();

      const allResources: MarketplaceResource[] = [];
      const discoveredCategories = new Set<MarketplaceCategory>();

      // Step 2: For each plugin, fetch its plugin.json
      for (const plugin of marketplace.plugins) {
        const pluginSource = plugin.source.replace('./', '');
        const pluginJsonUrl = `${GITHUB_RAW_BASE}/${pluginSource}/.claude-plugin/plugin.json${cacheBust()}`;

        const pluginRes = await fetch(pluginJsonUrl, fetchOpts);
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
              installCommand: '',
              repository: pluginData.repository,
              verified: true,
              featured: skillName === 'quack-brain',
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              _pluginSource: pluginSource,
              _skillPath: skillPath,
            } as MarketplaceResource & { _pluginSource: string; _skillPath: string });
          }
        }

        // Create resources for each agent
        if (pluginData.agents) {
          for (const agentPath of pluginData.agents) {
            const agentName = agentPath.split('/').pop()?.replace('.md', '') || agentPath;
            const formattedName = formatName(agentName);
            // Distinguish droids from agents: names containing Manager, Worker, Factory, Helper, Orchestrator = droids
            const isDroid = /manager|worker|factory|helper|orchestrator|processor|handler/i.test(formattedName);
            const category: MarketplaceCategory = isDroid ? 'droids' : 'agents';
            discoveredCategories.add(category);
            allResources.push({
              id: `${plugin.name}--agent--${agentName}`,
              name: formattedName,
              description: `${isDroid ? 'Droid' : 'Agent'} from ${plugin.name} plugin`,
              category,
              author,
              installCount: 0,
              tags: pluginData.keywords || plugin.tags || [],
              version: pluginData.version,
              installCommand: '',
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

        // Create resources for each rule
        if (pluginData.rules) {
          discoveredCategories.add('rules');
          for (const rulePath of pluginData.rules) {
            const ruleName = rulePath.split('/').pop()?.replace('.md', '') || rulePath;
            allResources.push({
              id: `${plugin.name}--rule--${ruleName}`,
              name: formatName(ruleName),
              description: `Rule from ${plugin.name} plugin`,
              category: 'rules',
              author,
              installCount: 0,
              tags: pluginData.keywords || plugin.tags || [],
              version: pluginData.version,
              installCommand: '',
              repository: pluginData.repository,
              verified: true,
              featured: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              _pluginSource: pluginSource,
              _rulePath: rulePath,
            } as MarketplaceResource & { _pluginSource: string; _rulePath: string });
          }
        }

        // Create agent bundle resource if template exists
        if (pluginData.agentTemplate) {
          discoveredCategories.add('agent-bundles');
          allResources.push({
            id: `${plugin.name}--bundle`,
            name: pluginData.agentTemplate.suggestedName,
            description: plugin.description,
            category: 'agent-bundles',
            author,
            installCount: 0,
            tags: pluginData.keywords || plugin.tags || [],
            version: pluginData.version,
            installCommand: '',
            repository: pluginData.repository,
            verified: true,
            featured: (pluginData.keywords || plugin.tags || []).includes('starter'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _agentTemplate: pluginData.agentTemplate,
            _pluginSource: pluginSource,
          } as MarketplaceResource & { _agentTemplate: AgentTemplate; _pluginSource: string });
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
      let home = await homeDir();
      if (!home.endsWith('/')) home += '/';
      const installed: MarketplaceResource[] = [];

      for (const resource of allResources) {
        const ext = resource as MarketplaceResource & {
          _pluginSource?: string;
          _skillPath?: string;
          _agentPath?: string;
          _rulePath?: string;
        };

        let checkPath = '';
        if (ext._skillPath) {
          const skillName = ext._skillPath.split('/').pop() || '';
          checkPath = `${home}.claude/skills/${skillName}/SKILL.md`;
        } else if (ext._agentPath) {
          const agentFile = ext._agentPath.split('/').pop() || '';
          checkPath = `${home}.claude/agents/${agentFile}`;
        } else if (ext._rulePath) {
          const ruleFile = ext._rulePath.split('/').pop() || '';
          checkPath = `${home}.claude/rules/${ruleFile}`;
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
  const installResource = useCallback(async (
    resource: MarketplaceResource,
    scope: 'global' | 'project' = 'global',
    projectPath?: string
  ): Promise<boolean> => {
    const ext = resource as MarketplaceResource & {
      _pluginSource?: string;
      _skillPath?: string;
      _agentPath?: string;
      _rulePath?: string;
    };

    try {
      // Determine base path based on scope
      let basePath: string;
      if (scope === 'project' && projectPath) {
        basePath = projectPath.endsWith('/') ? `${projectPath}.claude` : `${projectPath}/.claude`;
      } else {
        let home = await homeDir();
        if (!home.endsWith('/')) home += '/';
        basePath = `${home}.claude`;
      }

      if (ext._skillPath && ext._pluginSource) {
        // Download the skill SKILL.md file
        const skillName = ext._skillPath.split('/').pop() || '';
        const skillMdUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._skillPath}/SKILL.md`;

        const res = await fetch(skillMdUrl);
        if (!res.ok) throw new Error(`Failed to download skill: ${res.status}`);
        const content = await res.text();

        // Write to {basePath}/skills/{skillName}/SKILL.md
        const targetDir = `${basePath}/skills/${skillName}`;
        const targetPath = `${targetDir}/SKILL.md`;

        try {
          await invoke('create_directory', { path: targetDir });
        } catch {
          // Directory may already exist, continue
        }
        await invoke('write_file_content', { path: targetPath, content });
      } else if (ext._agentPath && ext._pluginSource) {
        // Download the agent .md file
        const agentFile = ext._agentPath.split('/').pop() || '';
        const agentUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._agentPath}`;

        const res = await fetch(agentUrl);
        if (!res.ok) throw new Error(`Failed to download agent: ${res.status}`);
        const content = await res.text();

        // Write to {basePath}/agents/{agentFile}
        const targetDir = `${basePath}/agents`;
        const targetPath = `${targetDir}/${agentFile}`;

        try {
          await invoke('create_directory', { path: targetDir });
        } catch {
          // Directory may already exist, continue
        }
        await invoke('write_file_content', { path: targetPath, content });
      } else if (ext._rulePath && ext._pluginSource) {
        // Download the rule .md file
        const ruleFile = ext._rulePath.split('/').pop() || '';
        const ruleUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._rulePath}`;

        const res = await fetch(ruleUrl);
        if (!res.ok) throw new Error(`Failed to download rule: ${res.status}`);
        const content = await res.text();

        // Write to {basePath}/rules/{ruleFile}
        const targetDir = `${basePath}/rules`;
        const targetPath = `${targetDir}/${ruleFile}`;

        try {
          await invoke('create_directory', { path: targetDir });
        } catch {
          // Directory may already exist, continue
        }
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
      _rulePath?: string;
    };

    try {
      let home = await homeDir();
      if (!home.endsWith('/')) home += '/';

      if (ext._skillPath) {
        const skillName = ext._skillPath.split('/').pop() || '';
        const targetDir = `${home}.claude/skills/${skillName}`;
        await invoke('remove_directory', { path: targetDir });
      } else if (ext._agentPath) {
        const agentFile = ext._agentPath.split('/').pop() || '';
        const targetPath = `${home}.claude/agents/${agentFile}`;
        await invoke('remove_file', { path: targetPath });
      } else if (ext._rulePath) {
        const ruleFile = ext._rulePath.split('/').pop() || '';
        const targetPath = `${home}.claude/rules/${ruleFile}`;
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

  // Install an agent bundle with all its bundled plugins (skills and rules)
  const installAgentBundle = useCallback(async (
    resource: MarketplaceResource,
    projectPath: string,
    projectName: string,
    usedNames?: Set<string>
  ): Promise<UnifiedAgent> => {
    const ext = resource as MarketplaceResource & { _agentTemplate?: AgentTemplate };
    if (!ext._agentTemplate) {
      throw new Error('Resource is not an agent bundle');
    }

    const template = ext._agentTemplate;
    const installedRulePaths: string[] = [];

    try {
      // Install bundled skills (new field) or legacy bundledPlugins
      const bundledSkills = template.skills || template.bundledPlugins;
      if (bundledSkills && bundledSkills.length > 0) {
        // Re-fetch marketplace.json to get plugin sources
        const fetchOpts: RequestInit = { cache: 'no-store' };
        const marketplaceRes = await fetch(MARKETPLACE_JSON_URL + cacheBust(), fetchOpts);
        if (!marketplaceRes.ok) {
          throw new Error(`Failed to fetch marketplace: ${marketplaceRes.status}`);
        }
        const marketplace: MarketplaceJson = await marketplaceRes.json();

        for (const pluginName of bundledSkills) {
          // Find the plugin in marketplace
          const pluginEntry = marketplace.plugins.find(p => p.name === pluginName);
          if (!pluginEntry) {
            console.warn(`Plugin ${pluginName} not found in marketplace`);
            continue;
          }

          const pluginSource = pluginEntry.source.replace('./', '');
          const pluginJsonUrl = `${GITHUB_RAW_BASE}/${pluginSource}/.claude-plugin/plugin.json${cacheBust()}`;

          const pluginRes = await fetch(pluginJsonUrl, fetchOpts);
          if (!pluginRes.ok) {
            console.warn(`Failed to fetch plugin.json for ${pluginName}`);
            continue;
          }

          const pluginData: PluginJson = await pluginRes.json();

          // Install all skills from this plugin
          if (pluginData.skills) {
            for (const skillPath of pluginData.skills) {
              const skillName = skillPath.split('/').pop() || '';
              const skillMdUrl = `${GITHUB_RAW_BASE}/${pluginSource}/${skillPath}/SKILL.md`;

              try {
                const res = await fetch(skillMdUrl);
                if (!res.ok) continue;
                const content = await res.text();

                let home = await homeDir();
                if (!home.endsWith('/')) home += '/';
                const targetDir = `${home}.claude/skills/${skillName}`;
                const targetPath = `${targetDir}/SKILL.md`;

                try {
                  await invoke('create_directory', { path: targetDir });
                } catch {
                  // Directory may already exist
                }
                await invoke('write_file_content', { path: targetPath, content });
              } catch (err) {
                console.warn(`Failed to install skill ${skillName}:`, err);
              }
            }
          }

          // Install all rules from this plugin
          if (pluginData.rules) {
            for (const rulePath of pluginData.rules) {
              const ruleFile = rulePath.split('/').pop() || '';
              const ruleUrl = `${GITHUB_RAW_BASE}/${pluginSource}/${rulePath}`;

              try {
                const res = await fetch(ruleUrl);
                if (!res.ok) continue;
                const content = await res.text();

                let home = await homeDir();
                if (!home.endsWith('/')) home += '/';
                const targetDir = `${home}.claude/rules`;
                const targetPath = `${targetDir}/${ruleFile}`;

                try {
                  await invoke('create_directory', { path: targetDir });
                } catch {
                  // Directory may already exist
                }
                await invoke('write_file_content', { path: targetPath, content });

                // Track installed rule paths
                installedRulePaths.push(ruleFile);
              } catch (err) {
                console.warn(`Failed to install rule ${ruleFile}:`, err);
              }
            }
          }
        }
      }

      // Use the suggested name from the template (e.g., "Agent Jack")
      const agentName = template.suggestedName;

      // Create the unified agent
      const agent = await createAgent({
        name: agentName,
        projectPath,
        projectName,
        color: template.suggestedColor,
        avatar: template.suggestedAvatar,
        personality: {
          id: '',
          name: agentName,
          role: template.role,
          communicationStyle: template.communicationStyle,
          customNotes: template.customNotes,
          selectedRules: installedRulePaths,
        },
        lastActiveAt: Date.now(),
      });

      return agent;
    } catch (err) {
      console.error('Failed to install agent bundle:', err);
      throw err;
    }
  }, []);

  // Get all starter bundles (agent templates tagged as "starter")
  const getStarterBundles = useCallback((): MarketplaceResource[] => {
    return resources.filter(r =>
      r.category === 'agent-bundles' &&
      r.tags.includes('starter')
    );
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
    installAgentBundle,
    getStarterBundles,
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
