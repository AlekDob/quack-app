import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';
import type { MarketplaceResource, MarketplaceCategory, MarketplaceFilters, MarketplaceLibrary, AgentTemplate } from '../types';
import { createAgent, type UnifiedAgent } from '../services/unifiedAgentStorage';
import { getRandomGenderedName, getRandomName } from '../utils/agentNames';
import {
  loadRegistry, markInstalled, markUninstalled,
  compareVersions, type InstalledEntry,
} from '../services/marketplaceRegistryService';

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

interface McpServerConfig {
  command: string;
  args?: string[];
  env?: Record<string, string>;
  type?: string;
}

interface PluginJson {
  name: string;
  version: string;
  description: string;
  longDescription?: string;
  author?: { name: string; url?: string };
  repository?: string;
  license?: string;
  keywords?: string[];
  skills?: string[];
  commands?: string[];
  agents?: string[];
  rules?: string[];
  mcpServers?: Record<string, McpServerConfig>;
  agentTemplate?: AgentTemplate;
}

// GitHub Contents API types for full directory download
interface GitHubContentEntry {
  name: string;
  type: 'file' | 'dir';
  download_url: string | null;
  url: string;
  path: string;
}

const GITHUB_API_BASE = 'https://api.github.com/repos/AlekDob/quack-marketplace/contents';

/** Download an entire skill directory (SKILL.md + scripts/ + references/ + assets/ etc.) */
async function downloadSkillDirectory(
  pluginSource: string,
  skillPath: string,
  targetDir: string
): Promise<void> {
  const apiUrl = `${GITHUB_API_BASE}/${pluginSource}/${skillPath}`;
  try {
    const res = await fetch(apiUrl, {
      headers: { 'Accept': 'application/vnd.github.v3+json' },
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const entries: GitHubContentEntry[] = await res.json();
    await downloadDirectoryEntries(entries, targetDir);
  } catch {
    // Fallback: download only SKILL.md (rate limit or API error)
    const skillMdUrl = `${GITHUB_RAW_BASE}/${pluginSource}/${skillPath}/SKILL.md`;
    const res = await fetch(skillMdUrl);
    if (!res.ok) throw new Error(`Failed to download skill: ${res.status}`);
    const content = await res.text();
    try { await invoke('create_directory', { path: targetDir }); } catch { /* exists */ }
    // Brain: bug-marketplace-install-windows-path-separators
    await invoke('write_file_content', {
      path: await join(targetDir, 'SKILL.md'),
      content,
    });
  }
}

async function downloadDirectoryEntries(
  entries: GitHubContentEntry[],
  targetDir: string
): Promise<void> {
  try { await invoke('create_directory', { path: targetDir }); } catch { /* exists */ }
  for (const entry of entries) {
    if (entry.type === 'file' && entry.download_url) {
      try {
        const fileRes = await fetch(entry.download_url);
        if (!fileRes.ok) continue;
        const content = await fileRes.text();
        // Brain: bug-marketplace-install-windows-path-separators
        await invoke('write_file_content', {
          path: await join(targetDir, entry.name),
          content,
        });
      } catch {
        // Skip individual file failures
      }
    } else if (entry.type === 'dir') {
      try {
        const subRes = await fetch(entry.url, {
          headers: { 'Accept': 'application/vnd.github.v3+json' },
        });
        if (!subRes.ok) continue;
        const subEntries: GitHubContentEntry[] = await subRes.json();
        // Brain: bug-marketplace-install-windows-path-separators
        await downloadDirectoryEntries(subEntries, await join(targetDir, entry.name));
      } catch {
        // Skip subdirectory failures
      }
    }
  }
}

type InstalledVersionMap = Record<string, string>;

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
  const [installedVersions, setInstalledVersions] = useState<InstalledVersionMap>({});

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

        // Create resources for each command
        if (pluginData.commands) {
          discoveredCategories.add('commands');
          for (const cmdPath of pluginData.commands) {
            const cmdName = cmdPath.split('/').pop()?.replace('.md', '') || cmdPath;
            allResources.push({
              id: `${plugin.name}--command--${cmdName}`,
              name: `/${cmdName}`,
              description: `Command from ${plugin.name} plugin`,
              category: 'commands',
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
              _commandPath: cmdPath,
            } as MarketplaceResource & { _pluginSource: string; _commandPath: string });
          }
        }

        // Create agent bundle resource if template exists
        if (pluginData.agentTemplate) {
          discoveredCategories.add('agent-bundles');
          allResources.push({
            id: `${plugin.name}--bundle`,
            name: pluginData.agentTemplate.suggestedName,
            description: plugin.description,
            longDescription: pluginData.longDescription,
            category: 'agent-bundles',
            author,
            installCount: 0,
            tags: pluginData.keywords || plugin.tags || [],
            version: pluginData.version,
            installCommand: '',
            repository: pluginData.repository,
            icon: pluginData.agentTemplate.suggestedAvatar,
            verified: true,
            featured: (pluginData.keywords || plugin.tags || []).includes('starter'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            _agentTemplate: pluginData.agentTemplate,
            _pluginSource: pluginSource,
          } as MarketplaceResource & { _agentTemplate: AgentTemplate; _pluginSource: string });
        }

        // Create resources for each MCP server
        if (pluginData.mcpServers) {
          discoveredCategories.add('mcp');
          for (const [serverName, serverConfig] of Object.entries(pluginData.mcpServers)) {
            allResources.push({
              id: `${plugin.name}--mcp--${serverName}`,
              name: formatName(serverName),
              description: plugin.description,
              longDescription: pluginData.longDescription,
              category: 'mcp',
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
              _mcpServerName: serverName,
              _mcpServerConfig: serverConfig,
            } as MarketplaceResource & { _pluginSource: string; _mcpServerName: string; _mcpServerConfig: McpServerConfig });
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

  // Enrich resource descriptions by fetching their .md files
  const enrichSkillDescriptions = async (resources: MarketplaceResource[]) => {
    const enrichable = resources.filter(r =>
      r.category === 'skills' || r.category === 'commands' ||
      r.category === 'agents' || r.category === 'droids' || r.category === 'rules'
    );
    const fetchPromises = enrichable.map(async (resource) => {
      const ext = resource as MarketplaceResource & {
        _pluginSource?: string; _skillPath?: string; _commandPath?: string;
        _agentPath?: string; _rulePath?: string;
      };
      if (!ext._pluginSource) return;

      let mdUrl: string;
      if (ext._skillPath) {
        mdUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._skillPath}/SKILL.md`;
      } else if (ext._commandPath) {
        mdUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._commandPath}`;
      } else if (ext._agentPath) {
        mdUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._agentPath}`;
      } else if (ext._rulePath) {
        mdUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._rulePath}`;
      } else {
        return;
      }

      try {
        const res = await fetch(mdUrl);
        if (!res.ok) return;
        const content = await res.text();
        // Extract description from frontmatter
        const fmDescMatch = content.match(/^---[\s\S]*?description:\s*([^\n]+)[\s\S]*?---/);
        if (fmDescMatch) {
          resource.description = fmDescMatch[1].trim().slice(0, 200);
        }
        // Extract long description: everything after the title line
        const bodyMatch = content.match(/^---[\s\S]*?---\s*\n\s*#[^\n]*\n\s*\n([\s\S]+)/);
        if (bodyMatch) {
          resource.longDescription = bodyMatch[1].trim().slice(0, 2000);
        }
      } catch {
        // Silent fail - keep default description
      }
    });
    await Promise.allSettled(fetchPromises);
  };

  // Check which resources are installed locally (registry first, then filesystem fallback)
  const checkInstalledResources = async (allResources: MarketplaceResource[]) => {
    try {
      const home = await homeDir();
      const registry = await loadRegistry();
      const installed: MarketplaceResource[] = [];
      const versions: InstalledVersionMap = {};

      for (const resource of allResources) {
        const ext = resource as MarketplaceResource & {
          _pluginSource?: string;
          _skillPath?: string;
          _agentPath?: string;
          _rulePath?: string;
          _commandPath?: string;
        };

        // Check registry first (fast, single file already loaded)
        const registryEntry = registry.resources[resource.id];
        if (registryEntry) {
          installed.push(resource);
          versions[resource.id] = registryEntry.version;
          continue;
        }

        // Fallback: check filesystem for pre-registry installations
        let checkPath = '';
        if (ext._skillPath) {
          const skillName = ext._skillPath.split('/').pop() || '';
          checkPath = await join(home, '.claude', 'skills', skillName, 'SKILL.md');
        } else if (ext._commandPath) {
          const cmdFile = ext._commandPath.split('/').pop() || '';
          checkPath = await join(home, '.claude', 'commands', cmdFile);
        } else if (ext._agentPath) {
          const agentFile = ext._agentPath.split('/').pop() || '';
          checkPath = await join(home, '.claude', 'agents', agentFile);
        } else if (ext._rulePath) {
          const ruleFile = ext._rulePath.split('/').pop() || '';
          checkPath = await join(home, '.claude', 'rules', ruleFile);
        }

        if (checkPath) {
          try {
            await invoke<string>('read_file_content', { path: checkPath });
            installed.push(resource);
            versions[resource.id] = 'unknown'; // Pre-registry install, version unknown
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
      setInstalledVersions(versions);
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
      _commandPath?: string;
      _agentPath?: string;
      _rulePath?: string;
      _mcpServerName?: string;
      _mcpServerConfig?: McpServerConfig;
    };

    try {
      // Determine base path based on scope
      let basePath: string;
      if (scope === 'project' && projectPath) {
        basePath = await join(projectPath, '.claude');
      } else {
        const home = await homeDir();
        basePath = await join(home, '.claude');
      }

      if (ext._skillPath && ext._pluginSource) {
        // Download full skill directory (SKILL.md + scripts/ + references/ + assets/ etc.)
        const skillName = ext._skillPath.split('/').pop() || '';
        const targetDir = await join(basePath, 'skills', skillName);
        await downloadSkillDirectory(ext._pluginSource, ext._skillPath, targetDir);
      } else if (ext._commandPath && ext._pluginSource) {
        // Download the command .md file
        const cmdFile = ext._commandPath.split('/').pop() || '';
        const cmdUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${ext._commandPath}`;

        const res = await fetch(cmdUrl);
        if (!res.ok) throw new Error(`Failed to download command: ${res.status}`);
        const content = await res.text();

        // Write to {basePath}/commands/{cmdFile}
        const targetDir = await join(basePath, 'commands');
        const targetPath = await join(targetDir, cmdFile);

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
        const targetDir = await join(basePath, 'agents');
        const targetPath = await join(targetDir, agentFile);

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
        const targetDir = await join(basePath, 'rules');
        const targetPath = await join(targetDir, ruleFile);

        try {
          await invoke('create_directory', { path: targetDir });
        } catch {
          // Directory may already exist, continue
        }
        await invoke('write_file_content', { path: targetPath, content });
      } else if (ext._mcpServerName && ext._mcpServerConfig) {
        // Add MCP server to .mcp.json in the target scope
        const mcpJsonPath = scope === 'project' && projectPath
          ? await join(projectPath, '.mcp.json')
          : await join(await homeDir(), '.mcp.json');

        let mcpConfig: { mcpServers: Record<string, McpServerConfig> } = { mcpServers: {} };
        try {
          const existing = await invoke<string>('read_file_content', { path: mcpJsonPath });
          mcpConfig = JSON.parse(existing);
        } catch {
          // File doesn't exist yet, use default
        }

        mcpConfig.mcpServers[ext._mcpServerName] = ext._mcpServerConfig;
        await invoke('write_file_content', {
          path: mcpJsonPath,
          content: JSON.stringify(mcpConfig, null, 2) + '\n',
        });

        // Also install bundled rules from the same plugin
        if (ext._pluginSource) {
          const pluginJsonUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/.claude-plugin/plugin.json${cacheBust()}`;
          try {
            const pRes = await fetch(pluginJsonUrl);
            if (pRes.ok) {
              const pData: PluginJson = await pRes.json();
              if (pData.rules) {
                for (const rulePath of pData.rules) {
                  const ruleFile = rulePath.split('/').pop() || '';
                  const ruleUrl = `${GITHUB_RAW_BASE}/${ext._pluginSource}/${rulePath}`;
                  const rRes = await fetch(ruleUrl);
                  if (rRes.ok) {
                    const ruleContent = await rRes.text();
                    const ruleDir = await join(basePath, 'rules');
                    try { await invoke('create_directory', { path: ruleDir }); } catch { /* exists */ }
                    await invoke('write_file_content', {
                      path: await join(ruleDir, ruleFile),
                      content: ruleContent,
                    });
                  }
                }
              }
            }
          } catch { /* non-critical: rules are optional */ }
        }
      } else {
        throw new Error('Unknown resource type');
      }

      // Track in registry and update state
      await markInstalled(resource.id, resource.version, scope, projectPath);
      setLibrary(prev => ({
        ...prev,
        installedResources: [...prev.installedResources.filter(r => r.id !== resource.id), resource],
      }));
      setInstalledVersions(prev => ({ ...prev, [resource.id]: resource.version }));

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
      _commandPath?: string;
      _agentPath?: string;
      _rulePath?: string;
      _mcpServerName?: string;
    };

    try {
      const home = await homeDir();

      if (ext._skillPath) {
        const skillName = ext._skillPath.split('/').pop() || '';
        const targetDir = await join(home, '.claude', 'skills', skillName);
        await invoke('remove_directory', { path: targetDir });
      } else if (ext._commandPath) {
        const cmdFile = ext._commandPath.split('/').pop() || '';
        const targetPath = await join(home, '.claude', 'commands', cmdFile);
        await invoke('remove_file', { path: targetPath });
      } else if (ext._agentPath) {
        const agentFile = ext._agentPath.split('/').pop() || '';
        const targetPath = await join(home, '.claude', 'agents', agentFile);
        await invoke('remove_file', { path: targetPath });
      } else if (ext._rulePath) {
        const ruleFile = ext._rulePath.split('/').pop() || '';
        const targetPath = await join(home, '.claude', 'rules', ruleFile);
        await invoke('remove_file', { path: targetPath });
      } else if (ext._mcpServerName) {
        // Remove MCP server from .mcp.json (check both project and global)
        for (const mcpPath of ['.mcp.json', await join(home, '.mcp.json')]) {
          try {
            const existing = await invoke<string>('read_file_content', { path: mcpPath });
            const mcpConfig = JSON.parse(existing);
            if (mcpConfig.mcpServers?.[ext._mcpServerName]) {
              delete mcpConfig.mcpServers[ext._mcpServerName];
              await invoke('write_file_content', {
                path: mcpPath,
                content: JSON.stringify(mcpConfig, null, 2) + '\n',
              });
            }
          } catch { /* file doesn't exist or parse error, skip */ }
        }
      }

      await markUninstalled(resourceId);
      setLibrary(prev => ({
        ...prev,
        installedResources: prev.installedResources.filter(r => r.id !== resourceId),
      }));
      setInstalledVersions(prev => {
        const next = { ...prev };
        delete next[resourceId];
        return next;
      });

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
    const installedSkillNames: string[] = []; // Track installed skill names

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

                const home = await homeDir();
                const targetDir = await join(home, '.claude', 'skills', skillName);
                const targetPath = await join(targetDir, 'SKILL.md');

                try {
                  await invoke('create_directory', { path: targetDir });
                } catch {
                  // Directory may already exist
                }
                await invoke('write_file_content', { path: targetPath, content });

                // Track installed skill names
                installedSkillNames.push(skillName);
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

                const home = await homeDir();
                const targetDir = await join(home, '.claude', 'rules');
                const targetPath = await join(targetDir, ruleFile);

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
          selectedSkills: installedSkillNames.length > 0 ? installedSkillNames : undefined,
        },
        lastActiveAt: Date.now(),
      });

      return agent;
    } catch (err) {
      console.error('Failed to install agent bundle:', err);
      throw err;
    }
  }, []);

  // Install only the skills and rules from an agent bundle globally (no project required)
  const installBundleSkills = useCallback(async (
    resource: MarketplaceResource
  ): Promise<{ skillCount: number; ruleCount: number; installedSkills: string[]; installedRules: string[] }> => {
    const ext = resource as MarketplaceResource & { _agentTemplate?: AgentTemplate };
    if (!ext._agentTemplate) {
      throw new Error('Resource is not an agent bundle');
    }

    const template = ext._agentTemplate;
    const installedSkills: string[] = [];
    const installedRules: string[] = [];

    const bundledSkills = template.skills || template.bundledPlugins;
    if (!bundledSkills || bundledSkills.length === 0) {
      throw new Error('Agent bundle has no skills to install');
    }

    const fetchOpts: RequestInit = { cache: 'no-store' };
    const marketplaceRes = await fetch(MARKETPLACE_JSON_URL + cacheBust(), fetchOpts);
    if (!marketplaceRes.ok) {
      throw new Error(`Failed to fetch marketplace: ${marketplaceRes.status}`);
    }
    const marketplace: MarketplaceJson = await marketplaceRes.json();
    const home = await homeDir();
    const basePath = await join(home, '.claude');

    for (const pluginName of bundledSkills) {
      const pluginEntry = marketplace.plugins.find(p => p.name === pluginName);
      if (!pluginEntry) continue;

      const pluginSource = pluginEntry.source.replace('./', '');
      const pluginJsonUrl = `${GITHUB_RAW_BASE}/${pluginSource}/.claude-plugin/plugin.json${cacheBust()}`;
      const pluginRes = await fetch(pluginJsonUrl, fetchOpts);
      if (!pluginRes.ok) continue;

      const pluginData: PluginJson = await pluginRes.json();

      if (pluginData.skills) {
        for (const skillPath of pluginData.skills) {
          const skillName = skillPath.split('/').pop() || '';
          const skillMdUrl = `${GITHUB_RAW_BASE}/${pluginSource}/${skillPath}/SKILL.md`;
          try {
            const res = await fetch(skillMdUrl);
            if (!res.ok) continue;
            const content = await res.text();
            const targetDir = await join(basePath, 'skills', skillName);
            try { await invoke('create_directory', { path: targetDir }); } catch { /* exists */ }
            await invoke('write_file_content', { path: await join(targetDir, 'SKILL.md'), content });
            installedSkills.push(skillName);
          } catch (err) {
            console.warn(`Failed to install skill ${skillName}:`, err);
          }
        }
      }

      if (pluginData.rules) {
        for (const rulePath of pluginData.rules) {
          const ruleFile = rulePath.split('/').pop() || '';
          const ruleUrl = `${GITHUB_RAW_BASE}/${pluginSource}/${rulePath}`;
          try {
            const res = await fetch(ruleUrl);
            if (!res.ok) continue;
            const content = await res.text();
            const targetDir = await join(basePath, 'rules');
            try { await invoke('create_directory', { path: targetDir }); } catch { /* exists */ }
            await invoke('write_file_content', { path: await join(targetDir, ruleFile), content });
            installedRules.push(ruleFile);
          } catch (err) {
            console.warn(`Failed to install rule ${ruleFile}:`, err);
          }
        }
      }
    }

    // Mark as installed
    setLibrary(prev => ({
      ...prev,
      installedResources: [...prev.installedResources, resource],
    }));

    return {
      skillCount: installedSkills.length,
      ruleCount: installedRules.length,
      installedSkills,
      installedRules,
    };
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

  // Check if a resource has an update available
  const hasUpdate = useCallback((resourceId: string): boolean => {
    const installedVersion = installedVersions[resourceId];
    if (!installedVersion || installedVersion === 'unknown') return false;
    const resource = resources.find(r => r.id === resourceId);
    if (!resource) return false;
    return compareVersions(resource.version, installedVersion) > 0;
  }, [installedVersions, resources]);

  // Update = reinstall with new version (overwrites all files)
  const updateResource = useCallback(async (
    resource: MarketplaceResource,
    scope: 'global' | 'project' = 'global',
    projectPath?: string
  ): Promise<boolean> => {
    return installResource(resource, scope, projectPath);
  }, [installResource]);

  // Count resources with available updates
  const updateCount = Object.keys(installedVersions).filter(id => {
    const r = resources.find(x => x.id === id);
    return r && installedVersions[id] !== 'unknown' &&
      compareVersions(r.version, installedVersions[id]) > 0;
  }).length;

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
    installBundleSkills,
    getStarterBundles,
    toggleFavorite,
    isInstalled,
    isFavorite,
    installedVersions,
    hasUpdate,
    updateResource,
    updateCount,
  };
}

/** Convert kebab-case to Title Case, preserving known acronyms */
const ACRONYMS: Record<string, string> = {
  ios: 'iOS', api: 'API', ui: 'UI', ux: 'UX', css: 'CSS', html: 'HTML',
  mcp: 'MCP', sdk: 'SDK', cli: 'CLI', ai: 'AI', pdf: 'PDF', seo: 'SEO',
  ci: 'CI', cd: 'CD', aws: 'AWS', gcp: 'GCP', sql: 'SQL', ssh: 'SSH',
};

function formatName(slug: string): string {
  return slug
    .replace(/\.md$/, '')
    .split('-')
    .map(word => ACRONYMS[word.toLowerCase()] || (word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}
