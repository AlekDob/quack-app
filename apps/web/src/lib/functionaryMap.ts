// FILE: functionaryMap.ts
// Purpose: Parse Functionary's generated city map and derive its visible repository structures.
// Layer: Web UI utility

export const FUNCTIONARY_MAP_PATH = ".functionary/map.json";

export interface FunctionarySourceRef {
  path?: string | null;
  line?: number | null;
  url?: string | null;
  note?: string | null;
}

export interface FunctionaryNode {
  id: string;
  label: string;
  kind: "scope" | "deployable" | "module" | "infra" | "external";
  archetype:
    | "district"
    | "building"
    | "room"
    | "gateway"
    | "worker"
    | "database"
    | "queue"
    | "storage"
    | "cloud";
  parentId?: string | null;
  description?: string | null;
  sourceRefs?: FunctionarySourceRef[];
  metrics?: Record<string, number>;
  tags?: string[];
  display?: {
    position?: [number, number] | null;
    size?: [number, number, number] | null;
    color?: string | null;
    flowLayer?: number | null;
    flowOrder?: number | null;
  } | null;
}

export interface FunctionaryEdge {
  id: string;
  from: string;
  to: string;
  kind: "depends_on" | "calls" | "data_flow" | "deploys";
  evidence: "declared" | "observed" | "inferred";
  confidence?: number | null;
  label?: string | null;
  weight?: number | null;
  sourceRefs?: FunctionarySourceRef[];
}

export interface FunctionaryMap {
  schemaVersion: 1;
  id: string;
  name: string;
  repository?: string | null;
  summary?: string | null;
  nodes: FunctionaryNode[];
  edges: FunctionaryEdge[];
  warnings?: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseFunctionaryMap(contents: string): FunctionaryMap {
  const value: unknown = JSON.parse(contents);
  if (
    !isRecord(value) ||
    value.schemaVersion !== 1 ||
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    !Array.isArray(value.nodes) ||
    !Array.isArray(value.edges)
  ) {
    throw new Error("This is not a Functionary schema v1 map.");
  }
  return value as unknown as FunctionaryMap;
}

export function topLevelFunctionaryNodes(map: FunctionaryMap): FunctionaryNode[] {
  const nodeById = new Map(map.nodes.map((node) => [node.id, node]));
  return map.nodes.filter((node) => {
    if (node.kind === "scope" || node.archetype === "district" || node.archetype === "room") {
      return false;
    }
    const parent = node.parentId ? nodeById.get(node.parentId) : undefined;
    return !parent || parent.kind === "scope" || parent.archetype === "district";
  });
}

export function withFunctionarySourceNodes(map: FunctionaryMap): FunctionaryMap {
  const parentIds = new Set(map.nodes.flatMap((node) => (node.parentId ? [node.parentId] : [])));
  const sourceNodes = map.nodes.flatMap((node) => {
    if (parentIds.has(node.id)) return [];
    const seenPaths = new Set<string>();
    return (node.sourceRefs ?? []).flatMap((source, index) => {
      if (!source.path || seenPaths.has(source.path)) return [];
      seenPaths.add(source.path);
      return [
        {
          id: `${node.id}:source:${index}`,
          label: source.path.split("/").at(-1) ?? source.path,
          kind: "module" as const,
          archetype: "room" as const,
          parentId: node.id,
          description: source.note ?? source.path,
          sourceRefs: [source],
          display: {
            color: "#d2a36c",
            flowLayer: Math.floor(index / 3),
            flowOrder: index % 3,
          },
        },
      ];
    });
  });

  return sourceNodes.length ? { ...map, nodes: [...map.nodes, ...sourceNodes] } : map;
}

const FUNCTIONARY_PLAIN_ROLE: Record<FunctionaryNode["archetype"], string> = {
  district: "A neighborhood of related parts",
  building: "A major piece of the product",
  room: "A part inside that piece",
  gateway: "A door between systems",
  worker: "A background worker that gets a job done",
  database: "Where lasting data is stored",
  queue: "A waiting line for work to be done",
  storage: "A place files and assets live",
  cloud: "A service that runs elsewhere",
};

const FUNCTIONARY_KIND_ROLE: Partial<Record<FunctionaryNode["kind"], string>> = {
  external: "Something outside Quack that it talks to",
  infra: "Shared plumbing the product sits on",
};

const FUNCTIONARY_SOFTEN: ReadonlyArray<readonly [RegExp, string]> = [
  [/\bElectron(?: application)?\b/gi, "desktop app"],
  [/\bVite\/React\b/gi, "the screens you use"],
  [/\bWebSocket\b/gi, "live connection"],
  [/\bnative IPC\b/gi, "native bridge"],
  [/\bIPC\b/g, "bridge"],
  [/\bCLI\b/g, "command-line"],
  [/\bSQLite-backed\b/gi, "local database"],
  [/\bschema-only\b/gi, "shared message shapes"],
  [/\bNode\/Bun\b/gi, "local"],
  [/\bAstro static\b/gi, "static"],
];

function softenFunctionaryDescription(description: string): string {
  let text = description.trim();
  for (const [pattern, replacement] of FUNCTIONARY_SOFTEN) {
    text = text.replace(pattern, replacement);
  }
  // Sentence-case after replacements that lowercased the start.
  return text.replace(/^[a-z]/, (ch) => ch.toUpperCase());
}

export function explainFunctionaryNode(node: FunctionaryNode): {
  title: string;
  role: string;
  body: string;
} {
  const role =
    FUNCTIONARY_KIND_ROLE[node.kind] ??
    FUNCTIONARY_PLAIN_ROLE[node.archetype] ??
    "A piece of the system";
  const softened = node.description ? softenFunctionaryDescription(node.description) : null;
  return {
    title: node.label,
    role,
    body: softened && softened.length > 0 ? softened : role,
  };
}
