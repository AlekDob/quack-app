// Brain: brain-read-indicator
// Detects when a tool call targets a Brain knowledge path

const BRAIN_TOOLS = new Set(['read', 'glob', 'grep']);

const BRAIN_PATH_PATTERNS = [
  /\/\.quack\/brain\//,
  /\/documentation\/(patterns|bugs|decisions|gotchas|diary|guide|inbox)\//,
  /\/documentation\/[^/]+\.md$/,
];

export const BRAIN_COLOR = '#E84A7F';

function isBrainPath(path: string): boolean {
  if (!path) return false;
  return BRAIN_PATH_PATTERNS.some(p => p.test(path));
}

export function isBrainRead(
  toolName: string,
  input?: Record<string, unknown>,
): boolean {
  if (!input || !BRAIN_TOOLS.has(toolName.toLowerCase())) return false;
  const path = (input.file_path || input.path || input.pattern) as string | undefined;
  return path ? isBrainPath(path) : false;
}
