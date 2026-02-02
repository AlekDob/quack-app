import { invoke } from '@tauri-apps/api/core';
import { homeDir } from '@tauri-apps/api/path';

export interface CodebaseMapStats {
  generated: string;
  files: number;
  exports: number;
  project: string;
}

const HOOK_ID = 'codebase-map-auto-update';
const HOOK_NAME = 'Codebase Map Auto-Update';
const MAP_RELATIVE_PATH = '.quack/codebase-map.md';
const SCRIPT_NAME = 'generate-codebase-map.mjs';

/**
 * Get the global script path: ~/.quack/scripts/generate-codebase-map.mjs
 */
export async function getScriptPath(): Promise<string> {
  const home = await homeDir();
  const sep = home.endsWith('/') ? '' : '/';
  return `${home}${sep}.quack/scripts/${SCRIPT_NAME}`;
}

/**
 * Ensure the script is installed at ~/.quack/scripts/
 * Copies from project's scripts/ folder if not present
 */
export async function ensureScriptInstalled(sourceProjectPath: string): Promise<string> {
  const home = await homeDir();
  const sep = home.endsWith('/') ? '' : '/';
  const targetDir = `${home}${sep}.quack/scripts`;
  const targetPath = `${targetDir}/${SCRIPT_NAME}`;

  try {
    // Check if script already exists
    await invoke<string>('read_file_content', { path: targetPath });
    return targetPath;
  } catch {
    // Script doesn't exist — copy via separate commands (execute_command uses split_whitespace)
    try {
      await invoke('execute_command', {
        command: `mkdir -p ${targetDir}`,
        cwd: sourceProjectPath,
      });
      await invoke('execute_command', {
        command: `cp ${sourceProjectPath}/scripts/${SCRIPT_NAME} ${targetPath}`,
        cwd: sourceProjectPath,
      });
      return targetPath;
    } catch (err) {
      console.error('Failed to install codebase map script:', err);
      throw err;
    }
  }
}

/**
 * Parse YAML frontmatter from the codebase map file
 */
export function parseMapStats(content: string): CodebaseMapStats | null {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return null;

  const yaml = match[1];
  const stats: Partial<CodebaseMapStats> = {};

  for (const line of yaml.split('\n')) {
    const [key, ...valueParts] = line.split(':');
    const value = valueParts.join(':').trim();
    const trimmedKey = key.trim();

    if (trimmedKey === 'generated') stats.generated = value;
    if (trimmedKey === 'files') stats.files = parseInt(value, 10);
    if (trimmedKey === 'exports') stats.exports = parseInt(value, 10);
    if (trimmedKey === 'project') stats.project = value;
  }

  if (stats.generated && stats.files !== undefined && stats.exports !== undefined) {
    return stats as CodebaseMapStats;
  }
  return null;
}

/**
 * Read codebase map stats from the map file
 */
export async function readMapStats(projectPath: string): Promise<CodebaseMapStats | null> {
  try {
    const mapPath = `${projectPath}/${MAP_RELATIVE_PATH}`;
    const content = await invoke<string>('read_file_content', { path: mapPath });
    return parseMapStats(content);
  } catch {
    return null;
  }
}

/**
 * Generate the codebase map (full scan)
 */
export async function generateMap(projectPath: string): Promise<boolean> {
  const scriptPath = await getScriptPath();

  try {
    await invoke('execute_command', {
      command: `node ${scriptPath} . ${MAP_RELATIVE_PATH}`,
      cwd: projectPath,
    });
    return true;
  } catch (err) {
    console.error('Failed to generate codebase map:', err);
    return false;
  }
}

/**
 * Install the PostToolUse hook for auto-updating the map
 */
export async function installHook(projectPath: string): Promise<boolean> {
  const scriptPath = await getScriptPath();

  try {
    await invoke('save_hook', {
      workingDir: projectPath,
      hook: {
        id: HOOK_ID,
        name: HOOK_NAME,
        type: 'PostToolUse',
        matcher: 'Write',
        command: `node ${scriptPath} --update-file "$TOOL_INPUT_FILE_PATH" . ${MAP_RELATIVE_PATH}`,
        enabled: true,
        scope: 'project',
        description: 'Auto-updates codebase map when files are written by Claude',
      },
    });
    return true;
  } catch (err) {
    console.error('Failed to install codebase map hook:', err);
    return false;
  }
}

/**
 * Uninstall the auto-update hook
 */
export async function uninstallHook(projectPath: string): Promise<boolean> {
  try {
    await invoke('delete_hook', {
      workingDir: projectPath,
      hookId: HOOK_ID,
      scope: 'project',
    });
    return true;
  } catch (err) {
    console.error('Failed to uninstall codebase map hook:', err);
    return false;
  }
}

/**
 * Get the full path to the map file
 */
export function getMapPath(projectPath: string): string {
  return `${projectPath}/${MAP_RELATIVE_PATH}`;
}
