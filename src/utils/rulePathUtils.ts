/**
 * Rule Path Utilities
 *
 * Handles normalization and resolution of rule paths for portable agent sharing.
 *
 * - Project rules: stored as relative paths `.claude/rules/name.md`
 * - Global rules: stored with tilde `~/.claude/rules/name.md`
 *
 * This allows agents to be shared across different machines and projects.
 */

/**
 * Pattern to detect global rules (in user's home .claude folder)
 * Matches: ~/.claude/rules/ or /Users/xxx/.claude/rules/ or /home/xxx/.claude/rules/
 */
const GLOBAL_RULE_PATTERNS = [
  /^~\/\.claude\/rules\//,
  /^\/Users\/[^/]+\/\.claude\/rules\//,
  /^\/home\/[^/]+\/\.claude\/rules\//,
];

/**
 * Pattern to detect project rules (in project's .claude folder)
 * Matches: /any/path/.claude/rules/
 */
const PROJECT_RULE_PATTERN = /\.claude\/rules\/[^/]+\.md$/;

/**
 * Check if a path is a global rule path
 */
export function isGlobalRulePath(rulePath: string): boolean {
  return GLOBAL_RULE_PATTERNS.some(pattern => pattern.test(rulePath));
}

/**
 * Check if a path is a project rule path
 */
export function isProjectRulePath(rulePath: string): boolean {
  return PROJECT_RULE_PATTERN.test(rulePath) && !isGlobalRulePath(rulePath);
}

/**
 * Get the home directory path
 * Falls back to empty string if not available
 */
function getHomeDir(): string {
  // In browser environment, we need to detect from existing paths
  // or use a known pattern
  if (typeof window !== 'undefined') {
    // Try to detect from common macOS/Linux patterns
    const match = window.location.pathname.match(/^\/Users\/([^/]+)/);
    if (match) {
      return `/Users/${match[1]}`;
    }
  }
  return '';
}

/**
 * Normalize a rule path for storage
 *
 * - Project rules: `/path/to/project/.claude/rules/name.md` -> `.claude/rules/name.md`
 * - Global rules: `/Users/xxx/.claude/rules/name.md` -> `~/.claude/rules/name.md`
 *
 * @param rulePath - The absolute path to normalize
 * @param projectPath - The current project's root path (optional, for context)
 * @returns Normalized path suitable for storage
 */
export function normalizeRulePath(rulePath: string, projectPath?: string): string {
  // Already normalized
  if (rulePath.startsWith('~/.claude/rules/') || rulePath.startsWith('.claude/rules/')) {
    return rulePath;
  }

  // Check if it's a global rule (in home .claude folder)
  const globalMatch = rulePath.match(/^(\/Users\/[^/]+|\/home\/[^/]+)\/\.claude\/rules\/(.+)$/);
  if (globalMatch) {
    const filename = globalMatch[2];
    return `~/.claude/rules/${filename}`;
  }

  // Check if it's a project rule
  const projectMatch = rulePath.match(/\.claude\/rules\/([^/]+\.md)$/);
  if (projectMatch) {
    const filename = projectMatch[1];
    return `.claude/rules/${filename}`;
  }

  // Fallback: return as-is if we can't normalize
  console.warn(`[rulePathUtils] Could not normalize path: ${rulePath}`);
  return rulePath;
}

/**
 * Normalize an array of rule paths
 *
 * @param rulePaths - Array of rule paths to normalize
 * @param projectPath - The current project's root path (optional)
 * @returns Array of normalized paths
 */
export function normalizeRulePaths(rulePaths: string[], projectPath?: string): string[] {
  return rulePaths.map(path => normalizeRulePath(path, projectPath));
}

/**
 * Resolve a normalized path back to an absolute path for file system access
 *
 * - `.claude/rules/name.md` -> `{projectPath}/.claude/rules/name.md`
 * - `~/.claude/rules/name.md` -> `/Users/xxx/.claude/rules/name.md`
 *
 * @param normalizedPath - The normalized path
 * @param projectPath - The current project's root path
 * @param homeDir - The user's home directory (optional, will be detected if not provided)
 * @returns Absolute path for file system access
 */
export function resolveRulePath(
  normalizedPath: string,
  projectPath: string,
  homeDir?: string
): string {
  // Handle global rules (tilde notation)
  if (normalizedPath.startsWith('~/.claude/rules/')) {
    const actualHomeDir = homeDir || getHomeDir();
    if (!actualHomeDir) {
      console.warn('[rulePathUtils] Could not determine home directory');
      return normalizedPath;
    }
    return normalizedPath.replace('~', actualHomeDir);
  }

  // Handle project rules (relative notation)
  if (normalizedPath.startsWith('.claude/rules/')) {
    return `${projectPath}/${normalizedPath}`;
  }

  // Already absolute or unknown format
  return normalizedPath;
}

/**
 * Resolve an array of normalized paths to absolute paths
 *
 * @param normalizedPaths - Array of normalized paths
 * @param projectPath - The current project's root path
 * @param homeDir - The user's home directory (optional)
 * @returns Array of absolute paths
 */
export function resolveRulePaths(
  normalizedPaths: string[],
  projectPath: string,
  homeDir?: string
): string[] {
  return normalizedPaths.map(path => resolveRulePath(path, projectPath, homeDir));
}

/**
 * Migrate legacy absolute paths to normalized format
 * Used for backward compatibility with existing saved agents
 *
 * @param selectedRules - Array of rule paths (may be mixed absolute/normalized)
 * @returns Array of normalized paths
 */
export function migrateRulePaths(selectedRules: string[]): string[] {
  return selectedRules.map(path => {
    // Already normalized
    if (path.startsWith('~/.claude/rules/') || path.startsWith('.claude/rules/')) {
      return path;
    }
    // Needs normalization
    return normalizeRulePath(path);
  });
}

/**
 * Get display-friendly path for UI
 * Shows scope indicator and filename
 *
 * @param rulePath - The rule path (normalized or absolute)
 * @returns Display string like "[Project] name.md" or "[Global] name.md"
 */
export function getDisplayPath(rulePath: string): string {
  const normalized = normalizeRulePath(rulePath);

  if (normalized.startsWith('~/.claude/rules/')) {
    return normalized; // Already nice format
  }

  if (normalized.startsWith('.claude/rules/')) {
    return normalized; // Already nice format
  }

  // Fallback: extract just the filename
  const filename = rulePath.split('/').pop() || rulePath;
  return filename;
}

/**
 * Compare two rule paths for equality (handles both normalized and absolute)
 *
 * @param path1 - First path
 * @param path2 - Second path
 * @returns true if paths refer to the same rule
 */
export function areRulePathsEqual(path1: string, path2: string): boolean {
  const normalized1 = normalizeRulePath(path1);
  const normalized2 = normalizeRulePath(path2);
  return normalized1 === normalized2;
}

/**
 * Find a rule in a list by its path (handles both normalized and absolute)
 *
 * @param rulePaths - Array of paths to search
 * @param targetPath - The path to find
 * @returns The matching path from the array, or undefined
 */
export function findRuleByPath(rulePaths: string[], targetPath: string): string | undefined {
  const normalizedTarget = normalizeRulePath(targetPath);
  return rulePaths.find(path => normalizeRulePath(path) === normalizedTarget);
}
