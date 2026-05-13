/**
 * WikiLinks Parsing Service
 *
 * Extract [[target]] and [[target|display]] references from markdown content.
 * Used by brainGraphService to build cross-document links between Brain entries.
 *
 * Logic mirrors the regex already covered by src/tests/wikilinks.test.ts.
 */

export interface WikiLink {
  targetName: string;
  displayText: string | null;
}

const WIKILINK_RE = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function parseWikiLinks(content: string): WikiLink[] {
  const links: WikiLink[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  WIKILINK_RE.lastIndex = 0;
  while ((match = WIKILINK_RE.exec(content)) !== null) {
    const targetName = match[1].trim();
    const displayText = match[2] ? match[2].trim() : null;
    if (!targetName) continue;
    const key = targetName.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    links.push({ targetName, displayText });
  }

  return links;
}
