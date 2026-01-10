import JSZip from 'jszip';
import type {
  AgentBundle,
  AgentBundleManifest,
  SavedAgent,
  PowerRatingBreakdown,
} from '../types';
import { calculatePowerRating } from '../utils/powerRating';

/**
 * Bundle Service
 *
 * Handles export and import of Quack Agent Bundles.
 * Bundles include:
 * - manifest.json (metadata + equipment)
 * - skills/ (Claude Code skills .md)
 * - droids/ (subagents .md)
 * - rules/ (rules .md)
 * - commands/ (slash commands .md)
 * - assets/ (avatar, icons)
 */

/**
 * Create manifest from agent data
 */
function createManifest(
  agent: SavedAgent,
  skills: string[],
  droids: string[],
  rules: string[],
  commands: string[]
): AgentBundleManifest {
  return {
    $schema: 'https://quack.dev/schemas/agent-bundle-v1.json',
    id: agent.id,
    version: '1.0.0',
    name: agent.name,
    displayName: agent.name,
    description: agent.personality?.role || 'Custom Agent',
    author: {
      name: 'User',
      github: '',
      email: '',
    },
    license: 'MIT',
    repository: '',
    personality: {
      role: agent.personality?.role || 'Agent',
      class: 'custom',
      communicationStyle: agent.personality?.communicationStyle || 'professional',
      quirks: agent.personality?.quirks || '',
      avatar: agent.avatar,
      color: agent.color,
    },
    equipment: {
      skills: skills.map(id => ({ id, required: true })),
      droids: droids.map(id => ({ id, required: true })),
      rules: rules.map(id => ({ id, required: true })),
      commands: commands.map(id => ({ id, required: true })),
    },
    compatibility: {
      quackVersion: '>=1.0.0',
      claudeCodeVersion: '>=0.2.0',
    },
    marketplace: {
      category: 'custom',
      tags: [],
      featured: false,
      verified: false,
      downloads: 0,
    },
  };
}

/**
 * Export an agent as a bundle (.zip file)
 */
export async function exportAgentBundle(
  agent: SavedAgent,
  skills: string[],
  droids: string[],
  rules: string[],
  commands: string[]
): Promise<AgentBundle> {
  const manifest = createManifest(agent, skills, droids, rules, commands);

  const bundle: AgentBundle = {
    manifest,
    skillsFiles: [],
    droidsFiles: [],
    rulesFiles: [],
    commandsFiles: [],
    assetsFiles: [],
  };

  return bundle;
}

/**
 * Export agent bundle as ZIP file (Uint8Array)
 */
export async function exportAgentBundleAsZip(
  agent: SavedAgent,
  skills: Array<{ id: string; content: string }>,
  droids: Array<{ id: string; content: string }>,
  rules: Array<{ id: string; content: string }>,
  commands: Array<{ id: string; content: string }>,
  avatarData?: Uint8Array
): Promise<Uint8Array> {
  const zip = new JSZip();

  // Create manifest
  const manifest = createManifest(
    agent,
    skills.map(s => s.id),
    droids.map(d => d.id),
    rules.map(r => r.id),
    commands.map(c => c.id)
  );

  // Add manifest.json
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Add skills
  const skillsFolder = zip.folder('skills');
  for (const skill of skills) {
    skillsFolder?.file(`${skill.id}.md`, skill.content);
  }

  // Add droids
  const droidsFolder = zip.folder('droids');
  for (const droid of droids) {
    droidsFolder?.file(`${droid.id}.md`, droid.content);
  }

  // Add rules
  const rulesFolder = zip.folder('rules');
  for (const rule of rules) {
    rulesFolder?.file(`${rule.id}.md`, rule.content);
  }

  // Add commands
  const commandsFolder = zip.folder('commands');
  for (const command of commands) {
    commandsFolder?.file(`${command.id}.md`, command.content);
  }

  // Add assets (avatar)
  if (avatarData) {
    const assetsFolder = zip.folder('assets');
    assetsFolder?.file(agent.avatar || 'avatar.png', avatarData);
  }

  // Generate ZIP
  const zipData = await zip.generateAsync({ type: 'uint8array' });
  return zipData;
}

/**
 * Import an agent bundle from .zip file
 */
export async function importAgentBundle(bundleData: Uint8Array): Promise<{
  agent: SavedAgent;
  manifest: AgentBundleManifest;
  skills: Array<{ id: string; content: string }>;
  droids: Array<{ id: string; content: string }>;
  rules: Array<{ id: string; content: string }>;
  commands: Array<{ id: string; content: string }>;
}> {
  const zip = await JSZip.loadAsync(bundleData);

  // Read manifest
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Invalid bundle: missing manifest.json');
  }

  const manifestContent = await manifestFile.async('string');
  const manifest: AgentBundleManifest = JSON.parse(manifestContent);

  if (!validateBundleManifest(manifest)) {
    throw new Error('Invalid bundle: manifest validation failed');
  }

  // Read skills
  const skills: Array<{ id: string; content: string }> = [];
  const skillsFolder = zip.folder('skills');
  if (skillsFolder) {
    for (const [filename, file] of Object.entries(skillsFolder.files)) {
      if (filename.endsWith('.md') && !file.dir) {
        const content = await file.async('string');
        const id = filename.replace('skills/', '').replace('.md', '');
        skills.push({ id, content });
      }
    }
  }

  // Read droids
  const droids: Array<{ id: string; content: string }> = [];
  const droidsFolder = zip.folder('droids');
  if (droidsFolder) {
    for (const [filename, file] of Object.entries(droidsFolder.files)) {
      if (filename.endsWith('.md') && !file.dir) {
        const content = await file.async('string');
        const id = filename.replace('droids/', '').replace('.md', '');
        droids.push({ id, content });
      }
    }
  }

  // Read rules
  const rules: Array<{ id: string; content: string }> = [];
  const rulesFolder = zip.folder('rules');
  if (rulesFolder) {
    for (const [filename, file] of Object.entries(rulesFolder.files)) {
      if (filename.endsWith('.md') && !file.dir) {
        const content = await file.async('string');
        const id = filename.replace('rules/', '').replace('.md', '');
        rules.push({ id, content });
      }
    }
  }

  // Read commands
  const commands: Array<{ id: string; content: string }> = [];
  const commandsFolder = zip.folder('commands');
  if (commandsFolder) {
    for (const [filename, file] of Object.entries(commandsFolder.files)) {
      if (filename.endsWith('.md') && !file.dir) {
        const content = await file.async('string');
        const id = filename.replace('commands/', '').replace('.md', '');
        commands.push({ id, content });
      }
    }
  }

  // Create SavedAgent from manifest
  const agent: SavedAgent = {
    id: manifest.id,
    name: manifest.name,
    avatar: manifest.personality.avatar,
    color: manifest.personality.color,
    personality: {
      id: manifest.id,
      name: manifest.name,
      role: manifest.personality.role,
      communicationStyle: manifest.personality.communicationStyle,
      quirks: manifest.personality.quirks,
      skills: skills.map(s => s.id),
      selectedRules: rules.map(r => r.id),
    },
    createdAt: Date.now(),
    lastUsed: Date.now(),
    usageCount: 0,
  };

  return { agent, manifest, skills, droids, rules, commands };
}

/**
 * Calculate power rating from equipment counts
 */
export function calculateBundlePowerRating(
  skillCount: number,
  droidCount: number,
  ruleCount: number,
  commandCount: number
): PowerRatingBreakdown {
  return calculatePowerRating(skillCount, droidCount, ruleCount, commandCount);
}

/**
 * Validate bundle manifest structure
 */
export function validateBundleManifest(manifest: unknown): manifest is AgentBundleManifest {
  if (!manifest || typeof manifest !== 'object') return false;

  const m = manifest as Partial<AgentBundleManifest>;

  return !!(
    m.id &&
    m.version &&
    m.name &&
    m.personality &&
    m.equipment &&
    m.compatibility
  );
}
