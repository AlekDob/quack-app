// FILE: userMcpConfig.ts
// Purpose: Read a provider's native mcp.json files and map them to ACP MCP servers.
// Layer: Provider runtime helper
// WHY: Cursor/Grok/Droid session/new only receives what Quack passes. Passing
//      synara alone would drop the user's official Linear MCP. We never write
//      those files; missing files mean synara only.

import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type * as Acp from "@agentclientprotocol/sdk";

export type UserMcpProvider = "cursor" | "grok" | "droid";

type RawMcpServer = {
  readonly command?: unknown;
  readonly args?: unknown;
  readonly env?: unknown;
  readonly url?: unknown;
  readonly headers?: unknown;
  readonly disabled?: unknown;
  readonly type?: unknown;
};

function readJsonObject(filePath: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(filePath, "utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function asStringRecord(value: unknown): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return {};
  const record: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string") record[key] = entry;
  }
  return record;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toAcpServer(name: string, raw: RawMcpServer): Acp.McpServer | null {
  if (raw.disabled === true) return null;
  const url = typeof raw.url === "string" ? raw.url.trim() : "";
  if (url.length > 0) {
    const headers = Object.entries(asStringRecord(raw.headers)).map(([headerName, value]) => ({
      name: headerName,
      value,
    }));
    return {
      type: "http",
      name,
      url,
      headers,
    };
  }
  const command = typeof raw.command === "string" ? raw.command.trim() : "";
  if (command.length === 0) return null;
  const env = Object.entries(asStringRecord(raw.env)).map(([envName, value]) => ({
    name: envName,
    value,
  }));
  return {
    name,
    command,
    args: asStringArray(raw.args),
    env,
  };
}

export function parseMcpJsonServers(raw: Record<string, unknown>): Acp.McpServer[] {
  const mcpServers = raw.mcpServers;
  if (mcpServers === null || typeof mcpServers !== "object" || Array.isArray(mcpServers)) {
    return [];
  }
  const servers: Acp.McpServer[] = [];
  for (const [name, value] of Object.entries(mcpServers)) {
    if (!name.trim() || value === null || typeof value !== "object" || Array.isArray(value)) {
      continue;
    }
    const server = toAcpServer(name, value as RawMcpServer);
    if (server) servers.push(server);
  }
  return servers;
}

export function userMcpConfigPaths(provider: UserMcpProvider, cwd?: string | null): string[] {
  const home = os.homedir();
  const project = cwd?.trim() ? cwd.trim() : null;
  if (provider === "cursor") {
    return [
      path.join(home, ".cursor", "mcp.json"),
      ...(project ? [path.join(project, ".cursor", "mcp.json")] : []),
    ];
  }
  if (provider === "grok") {
    return [path.join(home, ".grok", "mcp.json")];
  }
  return [
    path.join(home, ".factory", "mcp.json"),
    ...(project ? [path.join(project, ".factory", "mcp.json")] : []),
  ];
}

export function loadUserAcpMcpServers(input: {
  readonly provider: UserMcpProvider;
  readonly cwd?: string | null;
}): Acp.McpServer[] {
  const byName = new Map<string, Acp.McpServer>();
  for (const filePath of userMcpConfigPaths(input.provider, input.cwd)) {
    const raw = readJsonObject(filePath);
    if (!raw) continue;
    for (const server of parseMcpJsonServers(raw)) {
      byName.set(server.name, server);
    }
  }
  return [...byName.values()];
}
