import { invoke } from '@tauri-apps/api/core';
import { homeDir, join } from '@tauri-apps/api/path';

/**
 * Marketplace Registry Service
 * Tracks which marketplace resources are installed and their versions.
 * Stored at ~/.claude/plugins/quack-installed.json
 */

export interface InstalledEntry {
  version: string;
  installedAt: number;
  scope: 'global' | 'project';
  projectPath?: string;
}

export interface InstalledRegistry {
  version: number;
  resources: Record<string, InstalledEntry>;
}

const REGISTRY_FILENAME = 'quack-installed.json';

async function getRegistryPath(): Promise<string> {
  const home = await homeDir();
  return join(home, '.claude', 'plugins', REGISTRY_FILENAME);
}

export async function loadRegistry(): Promise<InstalledRegistry> {
  try {
    const path = await getRegistryPath();
    const content = await invoke<string>('read_file_content', { path });
    const parsed = JSON.parse(content);
    if (parsed.version === 1 && parsed.resources) {
      return parsed as InstalledRegistry;
    }
    return { version: 1, resources: {} };
  } catch {
    return { version: 1, resources: {} };
  }
}

async function saveRegistry(registry: InstalledRegistry): Promise<void> {
  const path = await getRegistryPath();
  const dirPath = path.replace(`/${REGISTRY_FILENAME}`, '');
  try {
    await invoke('create_directory', { path: dirPath });
  } catch {
    // Directory already exists
  }
  await invoke('write_file_content', {
    path,
    content: JSON.stringify(registry, null, 2) + '\n',
  });
}

export async function markInstalled(
  resourceId: string,
  version: string,
  scope: 'global' | 'project' = 'global',
  projectPath?: string
): Promise<void> {
  const registry = await loadRegistry();
  registry.resources[resourceId] = {
    version,
    installedAt: Date.now(),
    scope,
    ...(projectPath ? { projectPath } : {}),
  };
  await saveRegistry(registry);
}

export async function markUninstalled(resourceId: string): Promise<void> {
  const registry = await loadRegistry();
  delete registry.resources[resourceId];
  await saveRegistry(registry);
}

export async function getInstalledVersion(
  resourceId: string
): Promise<string | null> {
  const registry = await loadRegistry();
  return registry.resources[resourceId]?.version ?? null;
}

export async function getAllInstalled(): Promise<Record<string, InstalledEntry>> {
  const registry = await loadRegistry();
  return registry.resources;
}

/**
 * Compare two semver-like version strings.
 * Returns > 0 if a > b, < 0 if a < b, 0 if equal.
 */
export function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const diff = (partsA[i] || 0) - (partsB[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}
