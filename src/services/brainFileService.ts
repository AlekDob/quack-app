/**
 * Brain File Service
 *
 * Two-level knowledge store:
 * - Global brain: ~/.quack/brain/ (personal, cross-project)
 * - Project docs: {project}/documentation/ (universal, git-trackable)
 *
 * @module services/brainFileService
 */

import { invoke } from '@tauri-apps/api/core';
import { normalizeToForwardSlash } from '../utils/platform';

const GLOBAL_BRAIN_DIR = '.quack/brain';
const PROJECT_DOC_DIR = 'documentation';
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
 * Get the global brain path (~/.quack/brain/ or custom)
 */
async function getGlobalBrainPath(): Promise<string> {
  const customPath = localStorage.getItem(BRAIN_PATH_KEY);
  if (customPath) return customPath;
  const home = await invoke<string>('get_home_directory');
  return normalizeToForwardSlash(`${home}/${GLOBAL_BRAIN_DIR}`);
}

/**
 * Get the project documentation path
 */
export function getProjectDocPath(projectRoot: string): string {
  return normalizeToForwardSlash(`${projectRoot}/${PROJECT_DOC_DIR}`);
}

/**
 * Set a custom global brain path
 */
export async function setBrainCustomPath(path: string | null): Promise<void> {
  if (path) {
    localStorage.setItem(BRAIN_PATH_KEY, path);
  } else {
    localStorage.removeItem(BRAIN_PATH_KEY);
  }
  await writeBrainPathMarker(path);
}

async function writeBrainPathMarker(customPath: string | null): Promise<void> {
  try {
    const home = await invoke<string>('get_home_directory');
    const markerPath = normalizeToForwardSlash(`${home}/${BRAIN_PATH_MARKER}`);
    const brainPath = customPath || normalizeToForwardSlash(`${home}/${GLOBAL_BRAIN_DIR}`);
    await invoke('write_file_content', { path: markerPath, content: brainPath });
  } catch (err) {
    console.error('Failed to write brain-path marker:', err);
  }
}

export function getCustomBrainPath(): string | null {
  return localStorage.getItem(BRAIN_PATH_KEY);
}

/**
 * Ensure brain directory structure exists
 */
export async function initBrainStructure(projectRoot?: string): Promise<void> {
  const globalPath = await getGlobalBrainPath();
  await writeBrainPathMarker(localStorage.getItem(BRAIN_PATH_KEY));

  const dirs = [
    `${globalPath}/patterns`,
    `${globalPath}/preferences`,
    `${globalPath}/people`,
    `${globalPath}/tools`,
    `${globalPath}/diary`,
  ];

  if (projectRoot) {
    const docPath = getProjectDocPath(projectRoot);
    const projectDirs = ['patterns', 'bugs', 'decisions', 'gotchas', 'diary', 'inbox'];
    for (const dir of projectDirs) {
      dirs.push(`${docPath}/${dir}`);
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
  projectRoot?: string;
  tags: string[];
  title: string;
  content: string;
  slug: string;
}): Promise<string> {
  const date = new Date().toISOString().split('T')[0];
  const typeFolder = getTypeFolder(entry.type);

  let basePath: string;
  if (entry.projectRoot) {
    basePath = `${getProjectDocPath(entry.projectRoot)}/${typeFolder}`;
  } else {
    const globalPath = await getGlobalBrainPath();
    basePath = `${globalPath}/${typeFolder}`;
  }

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
  projectRoot: string,
  content: string
): Promise<string> {
  const date = new Date().toISOString().split('T')[0];
  const diaryPath = `${getProjectDocPath(projectRoot)}/diary`;

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
    const projectName = projectRoot.split(/[\\/]/).pop() || 'unknown';
    existing = `---\ntype: diary\nproject: ${projectName}\ndate: ${date}\n---\n`;
  }

  const updated = `${existing}\n- ${content}\n`;
  await invoke('write_file_content', { path: filePath, content: updated });
  return filePath;
}

/**
 * List brain entries (project docs or global)
 */
export async function listBrainEntries(
  options: {
    projectRoot?: string;
    type?: string;
    global?: boolean;
  } = {}
): Promise<string[]> {
  let basePath: string;

  if (options.global || !options.projectRoot) {
    basePath = await getGlobalBrainPath();
  } else {
    basePath = getProjectDocPath(options.projectRoot);
  }

  if (options.type) {
    const typeFolder = getTypeFolder(options.type);
    // Scan all .md files recursively and filter by folder name in path
    // Handles nested structures (e.g., global/bugs/) and singular/plural variants
    const singularFolder = typeFolder.replace(/s$/, '');
    const allFiles = await listMdFilesRecursive(basePath);
    return allFiles.filter(f =>
      f.includes(`/${typeFolder}/`) || f.includes(`/${singularFolder}/`)
    );
  }

  return listMdFilesRecursive(basePath);
}

async function listMdFilesRecursive(dirPath: string): Promise<string[]> {
  const allFiles: string[] = [];
  try {
    const listing = await invoke<DirectoryListing>('list_directory', {
      path: dirPath,
    });
    for (const entry of listing.entries) {
      // Brain: gotcha-windows-path-separators — normalize Tauri-returned paths to forward slashes
      const entryPath = normalizeToForwardSlash(entry.path);
      if (!entry.is_dir && (entry.name.endsWith('.md') || entry.name.endsWith('.mmd'))) {
        allFiles.push(entryPath);
      }
      if (entry.is_dir) {
        const subFiles = await listMdFilesRecursive(entryPath);
        allFiles.push(...subFiles);
      }
    }
  } catch {
    // Directory doesn't exist
  }
  return allFiles;
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
  const brainPath = await getGlobalBrainPath();

  try {
    await invoke('create_directory', { path: brainPath });
  } catch {
    // Already exists
  }

  if (inObsidian) {
    const uri = `obsidian://open?path=${encodeURIComponent(brainPath)}`;
    await invoke('open_external_url', { url: uri });
  } else {
    await invoke('reveal_in_finder', { path: brainPath });
  }
}

/**
 * Get the global brain root path
 */
export async function getBrainRootPath(): Promise<string> {
  return getGlobalBrainPath();
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
  return mapping[type] || 'patterns';
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

function inferTypeFromPath(filePath: string): string {
  const segments = filePath.split(/[\\/]/);
  const folderMapping: Record<string, string> = {
    bugs: 'bug_fix',
    decisions: 'decision',
    patterns: 'pattern',
    pattern: 'pattern',
    gotchas: 'gotcha',
    diary: 'diary',
    preferences: 'preference',
    people: 'person',
    tools: 'tool',
  };
  for (const seg of segments) {
    const mapped = folderMapping[seg];
    if (mapped) return mapped;
  }
  return '';
}

function parseBrainFile(raw: string, filePath: string): BrainEntry | null {
  // Normalize CRLF (Windows) to LF so regex patterns match consistently
  raw = raw.replace(/\r\n/g, '\n');

  // Handle .mmd files (Mermaid diagrams — no frontmatter)
  if (filePath.endsWith('.mmd')) {
    const fileName = filePath.split(/[\\/]/).pop()?.replace('.mmd', '') || 'Diagram';
    const title = fileName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    return {
      type: 'diagram',
      created: '',
      tags: ['mermaid', 'diagram'],
      title,
      content: raw,
      filePath,
    };
  }

  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  // Resilient fallback: infer metadata from path/content when frontmatter is missing
  // Brain: parseBrainFile-resilient-fallback
  if (!fmMatch) {
    const titleMatch = raw.match(/^#\s+(.+)$/m);
    const dateMatch = filePath.match(/(\d{4}-\d{2}-\d{2})/);
    const inferredType = inferTypeFromPath(filePath);
    if (!inferredType && !titleMatch) return null;
    return {
      type: inferredType || 'note',
      project: undefined,
      created: dateMatch ? dateMatch[1] : '',
      tags: [],
      title: titleMatch ? titleMatch[1] : filePath.split(/[\\/]/).pop()?.replace('.md', '') || '',
      content: raw.trim(),
      filePath,
    };
  }

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

  const explicitType = getField('type');
  const inferredType = explicitType || inferTypeFromPath(filePath);

  return {
    type: inferredType,
    project: getField('project') || undefined,
    created: getField('created'),
    tags,
    title: titleMatch ? titleMatch[1] : filePath.split(/[\\/]/).pop()?.replace('.md', '') || '',
    content: body,
    filePath,
  };
}
