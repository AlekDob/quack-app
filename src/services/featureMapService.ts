/**
 * Feature Map Service — Parse feature docs into FeatureGraph
 * Reuses YAML frontmatter regex pattern from brainFileService.ts
 */

import type {
  FeatureNode,
  FeatureFile,
  FeatureLink,
  FeatureGraph,
} from '../components/featureMap/featureMapTypes';

/** Parse YAML frontmatter from a markdown file */
function parseFrontmatter(raw: string): Record<string, string> {
  const normalized = raw.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const fields: Record<string, string> = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const m = line.match(/^(\w[\w-]*):\s*(.+)$/);
    if (m) fields[m[1]] = m[2].trim();
  }
  return fields;
}

/** Parse tags array from frontmatter string like "[tag1, tag2]" */
function parseTags(raw: string): string[] {
  if (!raw) return [];
  return raw
    .replace(/[\[\]]/g, '')
    .split(',')
    .map(t => t.trim())
    .filter(Boolean);
}

/** Parse the Files table from markdown content */
function parseFilesTable(content: string): FeatureFile[] {
  const files: FeatureFile[] = [];
  // Match markdown table rows: | Type | Path | Purpose |
  const tableRegex = /^\|\s*([^|]+)\s*\|\s*`([^`]+)`\s*\|\s*([^|]+)\s*\|$/gm;
  let m: RegExpExecArray | null;

  while ((m = tableRegex.exec(content)) !== null) {
    const type = m[1].trim();
    const path = m[2].trim();
    const purpose = m[3].trim();
    // Skip header row
    if (type === 'Type' || type.startsWith('---')) continue;
    files.push({ type, path, purpose });
  }

  return files;
}

/** Parse a single feature doc into a FeatureNode */
export function parseFeatureDoc(
  raw: string,
  filePath: string,
): FeatureNode | null {
  const normalized = raw.replace(/\r\n/g, '\n');
  const fm = parseFrontmatter(normalized);

  // Extract body (after frontmatter)
  const bodyMatch = normalized.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const body = bodyMatch ? bodyMatch[1] : normalized;

  // Title from first H2 heading
  const h2Match = body.match(/^##\s+(.+)$/m);
  // Fallback title from filename
  const filename = filePath.split('/').pop()?.replace('.md', '') ?? 'unknown';
  const title = h2Match ? h2Match[1].trim() : filename;

  // Purpose: line starting with **Purpose:**
  const purposeMatch = body.match(/\*\*Purpose:\*\*\s*(.+)$/m);
  const purpose = purposeMatch ? purposeMatch[1].trim() : '';

  const files = parseFilesTable(body);

  return {
    id: filename,
    title,
    purpose,
    tags: parseTags(fm.tags || ''),
    stack: fm.stack || '',
    files,
    docPath: filePath,
  };
}

/** Calculate links between features based on shared file paths */
export function calculateLinks(nodes: FeatureNode[]): FeatureLink[] {
  const links: FeatureLink[] = [];

  for (let i = 0; i < nodes.length; i++) {
    const pathsA = new Set(nodes[i].files.map(f => f.path));
    for (let j = i + 1; j < nodes.length; j++) {
      const shared = nodes[j].files
        .map(f => f.path)
        .filter(p => pathsA.has(p));

      if (shared.length > 0) {
        links.push({
          source: nodes[i].id,
          target: nodes[j].id,
          sharedFiles: shared,
        });
      }
    }
  }

  return links;
}

/** Build a complete FeatureGraph from parsed feature docs */
export function buildFeatureGraph(
  docs: Array<{ raw: string; path: string }>,
): FeatureGraph {
  const nodes: FeatureNode[] = [];

  for (const doc of docs) {
    const node = parseFeatureDoc(doc.raw, doc.path);
    if (node) nodes.push(node);
  }

  const links = calculateLinks(nodes);
  return { nodes, links };
}
