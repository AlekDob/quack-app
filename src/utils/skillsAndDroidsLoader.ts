/**
 * Utilities to load skills and droids from filesystem
 */

import { invoke } from '@tauri-apps/api/core';
import type { SkillMetadata, DroidMetadata } from '../components/modal-steps/types';
import type { SkillInfo } from '../types';

/**
 * Parse frontmatter from markdown file to extract metadata
 */
function parseFrontmatter(content: string): Record<string, string> {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---/;
  const match = content.match(frontmatterRegex);

  if (!match) return {};

  const frontmatter: Record<string, string> = {};
  const lines = match[1].split('\n');

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':');
    if (key && valueParts.length > 0) {
      const value = valueParts.join(':').trim();
      // Remove quotes if present
      frontmatter[key.trim()] = value.replace(/^["']|["']$/g, '');
    }
  }

  return frontmatter;
}

/**
 * Load all available skills from project and global directories
 * Uses the same Tauri command as the Skills tab for consistency
 */
export async function loadAvailableSkills(projectPath: string): Promise<SkillMetadata[]> {
  try {
    console.log('[loadAvailableSkills] Loading skills for path:', projectPath);

    // Use the same command as the Skills tab
    const skillsList = await invoke<SkillInfo[]>('list_skills', {
      workingDir: projectPath
    });

    console.log('[loadAvailableSkills] Raw skills from Tauri:', skillsList);

    // Convert SkillInfo to SkillMetadata format
    const skills: SkillMetadata[] = skillsList.map((skill) => ({
      id: `${skill.scope}-${skill.name}`,
      name: skill.name.replace(/-/g, ' '), // Format name nicely
      description: skill.description || 'No description available',
      path: skill.file_path, // SkillInfo uses file_path, not path
      isGlobal: skill.scope === 'global'
    }));

    console.log('[loadAvailableSkills] Converted skills:', skills);

    return skills;
  } catch (err) {
    console.error('[loadAvailableSkills] Failed to load skills:', err);
    return [];
  }
}

/**
 * Load all available droids from project and global directories
 */
export async function loadAvailableDroids(projectPath: string): Promise<DroidMetadata[]> {
  const droids: DroidMetadata[] = [];

  try {
    // Load project droids from .claude/agents/
    const projectDroidsPath = `${projectPath}/.claude/agents`;
    try {
      const projectFiles = await invoke<string[]>('list_directory_files', {
        path: projectDroidsPath,
        extension: 'md'
      });

      for (const file of projectFiles) {
        const fullPath = `${projectDroidsPath}/${file}`;
        try {
          const content = await invoke<string>('read_file_content', { path: fullPath });
          const frontmatter = parseFrontmatter(content);

          const droidId = file.replace('.md', '');
          droids.push({
            id: droidId,
            name: frontmatter.name || droidId,
            description: frontmatter.description || frontmatter.role || 'No description available',
            specialization: frontmatter.specialization || frontmatter.role || 'General',
            path: fullPath,
            isGlobal: false
          });
        } catch (err) {
          console.warn(`Failed to read droid file ${file}:`, err);
        }
      }
    } catch (err) {
      console.warn('No project droids directory found:', err);
    }

    // Load global droids from ~/.claude/agents/
    try {
      const homeDir = await invoke<string>('get_home_directory');
      const globalDroidsPath = `${homeDir}/.claude/agents`;

      const globalFiles = await invoke<string[]>('list_directory_files', {
        path: globalDroidsPath,
        extension: 'md'
      });

      for (const file of globalFiles) {
        const fullPath = `${globalDroidsPath}/${file}`;
        try {
          const content = await invoke<string>('read_file_content', { path: fullPath });
          const frontmatter = parseFrontmatter(content);

          const droidId = file.replace('.md', '');
          droids.push({
            id: `global-${droidId}`,
            name: frontmatter.name || droidId,
            description: frontmatter.description || frontmatter.role || 'No description available',
            specialization: frontmatter.specialization || frontmatter.role || 'General',
            path: fullPath,
            isGlobal: true
          });
        } catch (err) {
          console.warn(`Failed to read global droid file ${file}:`, err);
        }
      }
    } catch (err) {
      console.warn('No global droids directory found:', err);
    }
  } catch (err) {
    console.error('Failed to load droids:', err);
  }

  return droids;
}

/**
 * Format skills list for CLAUDE.md
 */
export function formatSkillsForClaudeMd(skills: SkillMetadata[], selectedIds: string[]): string {
  const selectedSkills = skills.filter(s => selectedIds.includes(s.id));

  if (selectedSkills.length === 0) {
    return 'No skills selected';
  }

  return selectedSkills.map(s => `- skill: ${s.path}`).join('\n');
}

/**
 * Format droids list for CLAUDE.md
 */
export function formatDroidsForClaudeMd(droids: DroidMetadata[], selectedIds: string[]): string {
  const selectedDroids = droids.filter(d => selectedIds.includes(d.id));

  if (selectedDroids.length === 0) {
    return 'No protocol droids selected';
  }

  return selectedDroids.map(d => `- droid: ${d.path}`).join('\n');
}

/**
 * Load all available slash commands from project and global directories
 */
export async function loadAvailableCommands(projectPath: string): Promise<string[]> {
  const commands: string[] = [];

  try {
    // Load project commands from .claude/commands/
    const projectCommandsPath = `${projectPath}/.claude/commands`;
    try {
      const projectFiles = await invoke<string[]>('list_directory_files', {
        path: projectCommandsPath,
        extension: 'md'
      });

      for (const file of projectFiles) {
        // Remove .md extension to get command name
        const commandName = file.replace('.md', '');
        commands.push(commandName);
      }
    } catch (err) {
      console.warn('No project commands directory found:', err);
    }

    // Load global commands from ~/.claude/commands/
    try {
      const homeDir = await invoke<string>('get_home_directory');
      const globalCommandsPath = `${homeDir}/.claude/commands`;

      const globalFiles = await invoke<string[]>('list_directory_files', {
        path: globalCommandsPath,
        extension: 'md'
      });

      for (const file of globalFiles) {
        // Remove .md extension to get command name
        const commandName = file.replace('.md', '');
        // Avoid duplicates (project commands take precedence)
        if (!commands.includes(commandName)) {
          commands.push(commandName);
        }
      }
    } catch (err) {
      console.warn('No global commands directory found:', err);
    }
  } catch (err) {
    console.error('Failed to load commands:', err);
  }

  return commands;
}
