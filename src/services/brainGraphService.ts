/**
 * Brain Graph Service — builds a knowledge graph of all documentation/ entries
 * for the Whiteboard's BrainNode.
 *
 * Sources of links:
 *  1. Tag overlap   (frontmatter `tags: [...]`)  — same algorithm as BrainGraph.tsx:buildAiGraph
 *  2. WikiLinks     (`[[slug]]` in body)         — resolved against slugMap built from filenames
 *
 * Wikilink weight (2) > tag weight (1), so explicit references dominate co-tagging.
 */

import { listBrainEntries, readBrainEntry, type BrainEntry } from './brainFileService';
import { parseWikiLinks } from './wikiLinkService';

export interface BrainGraphNode {
  id: string;       // filePath (unique)
  label: string;    // title or filename
  type: string;     // bug_fix | pattern | gotcha | decision | diary | diagram | note | feature-doc | ...
  tags: string[];
  filePath: string;
  val: number;      // node size hint (1..5)
  created: string;  // YYYY-MM-DD (may be empty for some entries)
}

export interface BrainGraphLink {
  source: string;
  target: string;
  weight: number;
  via: 'tag' | 'wikilink' | 'mixed';
}

export interface BrainGraphData {
  nodes: BrainGraphNode[];
  links: BrainGraphLink[];
  /** Number of source documents that contributed to the graph. */
  docCount: number;
}

const MAX_TAG_FANOUT = 20;

function deriveSlug(filePath: string): string {
  const file = filePath.split(/[\\/]/).pop() ?? filePath;
  return file.replace(/\.(md|mmd)$/i, '').toLowerCase();
}

function entryToNode(entry: BrainEntry): BrainGraphNode {
  return {
    id: entry.filePath,
    label: entry.title || deriveSlug(entry.filePath),
    type: entry.type || 'note',
    tags: entry.tags,
    filePath: entry.filePath,
    val: Math.max(1, Math.min(entry.tags.length, 5)),
    created: entry.created || '',
  };
}

/** Load and parse every .md / .mmd under {projectPath}/documentation/ */
export async function loadProjectDocs(projectPath: string): Promise<BrainEntry[]> {
  if (!projectPath) return [];
  const filePaths = await listBrainEntries({ projectRoot: projectPath });
  const entries: BrainEntry[] = [];
  for (const fp of filePaths) {
    const entry = await readBrainEntry(fp);
    if (entry) entries.push(entry);
  }
  return entries;
}

/**
 * Build the knowledge graph from a flat list of BrainEntry.
 * Pure function (no I/O) — easy to unit-test with fixtures.
 */
export function buildBrainGraph(entries: BrainEntry[]): BrainGraphData {
  const nodes: BrainGraphNode[] = entries.map(entryToNode);
  const linkMap = new Map<string, BrainGraphLink>();

  // --- 1. Tag-overlap links ---
  const tagMap = new Map<string, string[]>();
  for (const entry of entries) {
    for (const tag of entry.tags) {
      const list = tagMap.get(tag) ?? [];
      list.push(entry.filePath);
      tagMap.set(tag, list);
    }
  }
  for (const [, ids] of tagMap) {
    if (ids.length > MAX_TAG_FANOUT) continue;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const key = [ids[i], ids[j]].sort().join('::');
        const existing = linkMap.get(key);
        if (existing) {
          existing.weight += 1;
        } else {
          linkMap.set(key, { source: ids[i], target: ids[j], weight: 1, via: 'tag' });
        }
      }
    }
  }

  // --- 2. Wikilink links (resolved by slug) ---
  const slugMap = new Map<string, string>();
  for (const entry of entries) {
    slugMap.set(deriveSlug(entry.filePath), entry.filePath);
  }
  for (const entry of entries) {
    if (!entry.content) continue;
    const targets = parseWikiLinks(entry.content);
    for (const { targetName } of targets) {
      const targetPath = slugMap.get(targetName.toLowerCase());
      if (!targetPath || targetPath === entry.filePath) continue;
      const key = [entry.filePath, targetPath].sort().join('::');
      const existing = linkMap.get(key);
      if (existing) {
        existing.weight = Math.max(existing.weight, 2) + 1;
        existing.via = existing.via === 'tag' ? 'mixed' : 'wikilink';
      } else {
        linkMap.set(key, {
          source: entry.filePath,
          target: targetPath,
          weight: 2,
          via: 'wikilink',
        });
      }
    }
  }

  return {
    nodes,
    links: Array.from(linkMap.values()),
    docCount: entries.length,
  };
}

// --- Session-level cache to avoid re-reading 300+ files on every BrainNode open ---
const TTL_MS = 60_000;
const cache = new Map<string, { ts: number; data: BrainGraphData }>();

export async function loadBrainGraph(
  projectPath: string,
  opts?: { force?: boolean },
): Promise<BrainGraphData> {
  if (!projectPath) return { nodes: [], links: [], docCount: 0 };
  const cached = cache.get(projectPath);
  if (!opts?.force && cached && Date.now() - cached.ts < TTL_MS) {
    return cached.data;
  }
  const entries = await loadProjectDocs(projectPath);
  const data = buildBrainGraph(entries);
  cache.set(projectPath, { ts: Date.now(), data });
  return data;
}

export function invalidateBrainGraphCache(projectPath?: string): void {
  if (projectPath) cache.delete(projectPath);
  else cache.clear();
}
