/**
 * Project Utilities
 *
 * Helper functions for extracting project information from paths.
 * Used for scoping Brain MCP searches to the current project.
 *
 * @module utils/projectUtils
 */

/**
 * Extract project ID from a file path.
 *
 * The project ID is the last segment of the path, typically the
 * folder name containing the project.
 *
 * Examples:
 * - /Users/alekdob/Desktop/Dev/Personal/quack-app → quack-app
 * - /Users/alekdob/Desktop/Dev/flow-bi → flow-bi
 * - /home/user/projects/my-app → my-app
 *
 * @param path - Absolute path to the project directory
 * @returns Project ID (folder name) or empty string if invalid
 */
export function extractProjectId(path: string | undefined | null): string {
  if (!path || typeof path !== 'string') {
    return '';
  }

  // Remove trailing slashes and get the last segment
  const normalized = path.replace(/\/+$/, '');
  const segments = normalized.split('/');
  const lastSegment = segments[segments.length - 1];

  return lastSegment || '';
}

/**
 * Check if a path looks like a valid project path.
 *
 * A valid project path should:
 * - Be an absolute path (starts with /)
 * - Have at least 2 path segments
 * - End with a non-empty folder name
 *
 * @param path - Path to validate
 * @returns True if the path looks like a valid project path
 */
export function isValidProjectPath(path: string | undefined | null): boolean {
  if (!path || typeof path !== 'string') {
    return false;
  }

  // Must be absolute path
  if (!path.startsWith('/')) {
    return false;
  }

  // Must have meaningful content
  const projectId = extractProjectId(path);
  return projectId.length > 0;
}

/**
 * Format a project ID for display.
 *
 * Converts slugified project IDs to title case with spaces.
 *
 * Examples:
 * - quack-app → Quack App
 * - flow-bi → Flow Bi
 * - my_project → My Project
 *
 * @param projectId - Project ID (folder name)
 * @returns Formatted display name
 */
export function formatProjectName(projectId: string): string {
  if (!projectId) {
    return '';
  }

  return projectId
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
