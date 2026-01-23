/**
 * Brain File Service
 *
 * Lightweight file-based knowledge store.
 * Reads/writes markdown files in ~/.quack/brain/
 * No database, no MCP server, no corruption.
 *
 * @module services/brainFileService
 */

import { invoke } from '@tauri-apps/api/core';

const DEFAULT_BRAIN_DIR = '.quack/brain';
const BRAIN_PATH_KEY = 'quack-brain-path';
const BRAIN_PATH_MARKER = '.quack/brain-path';

export interface BrainEntry {
  type: string;
  project?: string;
  created: string;
  tags: string[];
  title: string;
  content: string;
  filePath: string;
}

interface DirectoryListing {
  path: string;
  entries: Array<{
    name: string;
    path: string;
    is_dir: boolean;
    is_symlink: boolean;
  }>;
}

/**
 * Get the brain root directory path.
 * Uses custom path from localStorage if set, otherwise defaults to ~/.quack/brain/
 */
async function getBrainPath(): Promise<string> {
  const customPath = localStorage.getItem(BRAIN_PATH_KEY);
  if (customPath) return customPath;

  const home = await invoke<string>('get_home_directory');
  return `${home}/${DEFAULT_BRAIN_DIR}`;
}

/**
 * Set a custom brain path (persisted in localStorage + marker file for AI access)
 */
export async function setBrainCustomPath(path: string | null): Promise<void> {
  if (path) {
    localStorage.setItem(BRAIN_PATH_KEY, path);
  } else {
    localStorage.removeItem(BRAIN_PATH_KEY);
  }
  // Write marker file so AI agents can discover the brain path
  await writeBrainPathMarker(path);
}

/**
 * Write a marker file at ~/.quack/brain-path with the current brain location.
 * AI agents read this file to discover where the brain is stored.
 */
async function writeBrainPathMarker(customPath: string | null): Promise<void> {
  try {
    const home = await invoke<string>('get_home_directory');
    const markerPath = `${home}/${BRAIN_PATH_MARKER}`;
    const brainPath = customPath || `${home}/${DEFAULT_BRAIN_DIR}`;
    await invoke('write_file_content', { path: markerPath, content: brainPath });
  } catch (err) {
    console.error('Failed to write brain-path marker:', err);
  }
}

/**
 * Check if a custom brain path is configured
 */
export function getCustomBrainPath(): string | null {
  return localStorage.getItem(BRAIN_PATH_KEY);
}

/**
 * Ensure brain directory structure exists and marker file is up to date
 */
export async function initBrainStructure(projectName?: string): Promise<void> {
  const brainPath = await getBrainPath();
  // Sync marker file so AI agents can discover the brain path
  await writeBrainPathMarker(localStorage.getItem(BRAIN_PATH_KEY));
  const dirs = [
    `${brainPath}/global/patterns`,
    `${brainPath}/global/preferences`,
    `${brainPath}/global/people`,
    `${brainPath}/global/tools`,
  ];

  if (projectName) {
    const projectDirs = ['patterns', 'bugs', 'decisions', 'gotchas', 'diary'];
    for (const dir of projectDirs) {
      dirs.push(`${brainPath}/projects/${projectName}/${dir}`);
    }
  }

  for (const dir of dirs) {
    try {
      await invoke('create_directory', { path: dir });
    } catch {
      // Directory might already exist
    }
  }
}

/**
 * Save a knowledge entry to the brain
 */
export async function saveBrainEntry(entry: {
  type: string;
  project?: string;
  tags: string[];
  title: string;
  content: string;
  slug: string;
}): Promise<string> {
  const brainPath = await getBrainPath();
  const date = new Date().toISOString().split('T')[0];

  // Determine folder based on type and project
  const typeFolder = getTypeFolder(entry.type);
  const basePath = entry.project
    ? `${brainPath}/projects/${entry.project}/${typeFolder}`
    : `${brainPath}/global/${typeFolder}`;

  // Ensure directory exists
  try {
    await invoke('create_directory', { path: basePath });
  } catch {
    // Already exists
  }

  const filePath = `${basePath}/${entry.slug}.md`;
  const fileContent = formatBrainFile(entry, date);

  await invoke('write_file_content', { path: filePath, content: fileContent });
  return filePath;
}

/**
 * Append a diary entry for today
 */
export async function appendDiaryEntry(
  project: string,
  content: string
): Promise<string> {
  const brainPath = await getBrainPath();
  const date = new Date().toISOString().split('T')[0];
  const diaryPath = `${brainPath}/projects/${project}/diary`;

  try {
    await invoke('create_directory', { path: diaryPath });
  } catch {
    // Already exists
  }

  const filePath = `${diaryPath}/${date}.md`;
  let existing = '';

  try {
    existing = await invoke<string>('read_file_content', { path: filePath });
  } catch {
    // File doesn't exist yet, create with frontmatter
    existing = `---\ntype: diary\nproject: ${project}\ndate: ${date}\n---\n`;
  }

  const updated = `${existing}\n> ${content}\n`;
  await invoke('write_file_content', { path: filePath, content: updated });
  return filePath;
}

/**
 * List brain entries for a project or globally
 */
export async function listBrainEntries(
  project?: string,
  type?: string
): Promise<string[]> {
  const brainPath = await getBrainPath();
  const searchPath = project
    ? `${brainPath}/projects/${project}${type ? `/${getTypeFolder(type)}` : ''}`
    : `${brainPath}/global${type ? `/${getTypeFolder(type)}` : ''}`;

  try {
    const listing = await invoke<DirectoryListing>('list_directory', {
      path: searchPath,
    });
    return listing.entries
      .filter(e => !e.is_dir && e.name.endsWith('.md'))
      .map(e => e.path);
  } catch {
    return [];
  }
}

/**
 * Read a brain entry file and parse its frontmatter
 */
export async function readBrainEntry(filePath: string): Promise<BrainEntry | null> {
  try {
    const content = await invoke<string>('read_file_content', { path: filePath });
    return parseBrainFile(content, filePath);
  } catch {
    return null;
  }
}

/**
 * Open brain folder in system file manager or Obsidian
 */
export async function openBrainFolder(inObsidian?: boolean): Promise<void> {
  const brainPath = await getBrainPath();

  if (inObsidian) {
    // Try to open via Obsidian URI scheme
    const uri = `obsidian://open?path=${encodeURIComponent(brainPath)}`;
    await invoke('open_external_url', { url: uri });
  } else {
    await invoke('reveal_in_finder', { path: brainPath });
  }
}

/**
 * Get the brain root path (for external use)
 */
export async function getBrainRootPath(): Promise<string> {
  return getBrainPath();
}

// --- Helpers ---

function getTypeFolder(type: string): string {
  const mapping: Record<string, string> = {
    bug_fix: 'bugs',
    bug: 'bugs',
    pattern: 'patterns',
    decision: 'decisions',
    gotcha: 'gotchas',
    preference: 'preferences',
    person: 'people',
    tool: 'tools',
    diary: 'diary',
  };
  return mapping[type] || 'notes';
}

function formatBrainFile(
  entry: { type: string; project?: string; tags: string[]; title: string; content: string },
  date: string
): string {
  const frontmatter = [
    '---',
    `type: ${entry.type}`,
    entry.project ? `project: ${entry.project}` : null,
    `created: ${date}`,
    entry.tags.length > 0 ? `tags: [${entry.tags.join(', ')}]` : null,
    '---',
  ]
    .filter(Boolean)
    .join('\n');

  return `${frontmatter}\n\n# ${entry.title}\n\n${entry.content}\n`;
}


function parseBrainFile(raw: string, filePath: string): BrainEntry | null {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!fmMatch) return null;

  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  const getField = (key: string): string => {
    const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
    return match ? match[1].trim() : '';
  };

  const tagsRaw = getField('tags');
  const tags = tagsRaw
    ? tagsRaw.replace(/[\[\]]/g, '').split(',').map(t => t.trim()).filter(Boolean)
    : [];

  const titleMatch = body.match(/^#\s+(.+)$/m);

  return {
    type: getField('type'),
    project: getField('project') || undefined,
    created: getField('created'),
    tags,
    title: titleMatch ? titleMatch[1] : filePath.split('/').pop()?.replace('.md', '') || '',
    content: body,
    filePath,
  };
}
