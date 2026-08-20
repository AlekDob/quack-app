// FILE: mcpMerge.ts
// Purpose: Merge user-owned MCP servers with Quack's synara entry without
//          renaming or replacing `linear` / `linear-*`.
// Layer: Agent gateway MCP injection

const SYNARA_MCP_SERVER_NAME = "synara";

export function mergeNamedMcpServers<T>(
  userServers: Record<string, T> | undefined,
  synaraEntry: T,
): Record<string, T> {
  return {
    ...(userServers ?? {}),
    [SYNARA_MCP_SERVER_NAME]: synaraEntry,
  };
}

export function mergeAcpMcpServers<T extends { readonly name: string }>(
  userServers: ReadonlyArray<T>,
  synaraServers: ReadonlyArray<T>,
): T[] {
  const synaraNames = new Set(synaraServers.map((server) => server.name));
  return [...userServers.filter((server) => !synaraNames.has(server.name)), ...synaraServers];
}
