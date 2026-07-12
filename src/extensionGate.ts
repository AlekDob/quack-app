import { installedIds, quackExtensions } from "./quackExtensions";

let cache: { root: string; at: number; installed: Set<string> } | null = null;
const TTL_MS = 30_000;

export async function isExtensionInstalled(
  root: string,
  id: string,
): Promise<boolean> {
  const now = Date.now();
  if (!cache || cache.root !== root || now - cache.at > TTL_MS) {
    const rows = await quackExtensions.status(root);
    cache = { root, at: now, installed: installedIds(rows) };
  }
  return cache.installed.has(id);
}

export function invalidateExtensionCache(): void {
  cache = null;
}
