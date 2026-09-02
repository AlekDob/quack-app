// FILE: featureProductMap.ts
// Purpose: Turn documentation/features markdown into the 3D map graph.
// Layer: Web UI utility

import {
  type FunctionaryMap,
  type FunctionaryNode,
} from "./functionaryMap";

export const FEATURE_DOCS_DIR = "documentation/features";
export const FEATURE_DOC_FILENAME = /^\d{3}-.+\.md$/i;

const DEFAULT_NEIGHBORHOOD = "Product";
const DEFAULT_FILE_COLOR = "#c8dfe2";

const FILE_TYPE_COLORS: Record<string, string> = {
  component: "#81afa6",
  web: "#81afa6",
  server: "#b17f9f",
  contracts: "#7a9bb8",
  model: "#7a9bb8",
  test: "#d2a36c",
  native: "#c48b8b",
  logic: "#9b87b4",
  store: "#9b87b4",
  util: "#9b87b4",
};

export function isFeatureDocFilename(name: string): boolean {
  return FEATURE_DOC_FILENAME.test(name);
}

export function featureDocSlug(filename: string): string {
  return filename.replace(/^\d{3}-/i, "").replace(/\.md$/i, "");
}

export function colorForFeatureFileType(type: string): string {
  const key = type.trim().split(/[\s/]+/)[0]?.toLowerCase() ?? "";
  return FILE_TYPE_COLORS[key] ?? DEFAULT_FILE_COLOR;
}

export function parseFeatureProductDoc(
  filename: string,
  contents: string,
): { feature: FunctionaryNode; files: FunctionaryNode[] } | null {
  const basename = filename.split("/").at(-1) ?? filename;
  if (!isFeatureDocFilename(basename)) return null;

  const slug = featureDocSlug(basename);
  const neighborhood = firstFrontmatterTag(contents) ?? DEFAULT_NEIGHBORHOOD;
  const heading = firstHeading(contents) ?? slug;
  const purpose = purposeLine(contents);
  const parentId = scopeId(neighborhood);
  const feature: FunctionaryNode = {
    id: slug,
    label: heading,
    kind: "module",
    archetype: "building",
    parentId,
    description: purpose,
    tags: [neighborhood],
  };
  const files = parseFilesTable(contents).map((file, index) => {
    const label = file.path.split("/").at(-1) ?? file.path;
    return {
      id: `${slug}:${file.path}`,
      label,
      kind: "module" as const,
      archetype: "room" as const,
      parentId: slug,
      description: file.path,
      sourceRefs: [{ path: file.path, note: file.type }],
      display: {
        color: colorForFeatureFileType(file.type),
        flowLayer: Math.floor(index / 3),
        flowOrder: index % 3,
      },
    } satisfies FunctionaryNode;
  });

  return { feature, files };
}

export function buildFeatureProductMap(
  docs: readonly { filename: string; contents: string }[],
): FunctionaryMap {
  const scopes = new Map<string, FunctionaryNode>();
  const nodes: FunctionaryNode[] = [];

  for (const doc of [...docs].sort((left, right) =>
    left.filename.localeCompare(right.filename),
  )) {
    const parsed = parseFeatureProductDoc(doc.filename, doc.contents);
    if (!parsed) continue;
    const neighborhood = parsed.feature.tags?.[0] ?? DEFAULT_NEIGHBORHOOD;
    const id = scopeId(neighborhood);
    if (!scopes.has(id)) {
      scopes.set(id, {
        id,
        label: neighborhood,
        kind: "scope",
        archetype: "district",
      });
    }
    nodes.push(parsed.feature, ...parsed.files);
  }

  return {
    schemaVersion: 1,
    id: "product-features",
    name: "Quack",
    nodes: [...scopes.values(), ...nodes],
    edges: [],
  };
}

function scopeId(neighborhood: string): string {
  return `scope:${neighborhood}`;
}

function firstFrontmatterTag(contents: string): string | null {
  const fence = contents.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const block = fence?.[1] ?? "";
  const tagsLine = block.match(/^tags:\s*\[([^\]]*)\]/m);
  if (!tagsLine) return null;
  const first = tagsLine[1]
    ?.split(",")
    .map((part) => part.trim().replace(/^["']|["']$/g, ""))
    .find((part) => part.length > 0);
  return first ?? null;
}

function firstHeading(contents: string): string | null {
  const match = contents.match(/^##\s+(.+)$/m);
  return match?.[1]?.trim() || null;
}

function purposeLine(contents: string): string | null {
  const match = contents.match(/\*\*Purpose:\*\*\s*(.+)/);
  const text = match?.[1]?.trim();
  return text && text.length > 0 ? text : null;
}

function parseFilesTable(contents: string): Array<{ type: string; path: string }> {
  const heading = contents.search(/^###\s+Files\s*$/m);
  if (heading < 0) return [];
  const rest = contents.slice(heading);
  const rows: Array<{ type: string; path: string }> = [];
  for (const line of rest.split(/\r?\n/).slice(1)) {
    if (/^#{1,6}\s/.test(line)) break;
    if (!line.includes("|")) {
      if (rows.length > 0 && line.trim() === "") break;
      continue;
    }
    const cells = splitTableRow(line);
    if (cells.length < 2) continue;
    const type = cells[0]!;
    const pathCell = cells[1]!;
    if (/^type$/i.test(type) || /^-+$/.test(type.replace(/:/g, ""))) continue;
    const path = firstTablePath(pathCell);
    if (!path) continue;
    rows.push({ type, path });
  }
  return rows;
}

function splitTableRow(line: string): string[] {
  const cells = line.split("|").map((cell) => cell.trim());
  if (cells[0] === "") cells.shift();
  if (cells.at(-1) === "") cells.pop();
  return cells.filter((cell) => cell.length > 0);
}

function firstTablePath(cell: string): string | null {
  const tick = cell.match(/`([^`]+)`/);
  const raw = (tick?.[1] ?? cell).split(",")[0]?.trim() ?? "";
  return raw.length > 0 ? raw : null;
}
