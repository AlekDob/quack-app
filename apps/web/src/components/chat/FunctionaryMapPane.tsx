// FILE: FunctionaryMapPane.tsx
// Purpose: Show product pieces from documentation/features in the chat right dock.
// Layer: Chat right-dock UI

import { useQueries, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { type ChatFileReference } from "~/lib/chatReferences";
import {
  DISCLOSURE_CONTENT_CLOSED_CLASS,
  DISCLOSURE_CONTENT_MOTION_CLASS,
  DISCLOSURE_CONTENT_OPEN_CLASS,
} from "~/lib/disclosureMotion";
import {
  FEATURE_DOCS_DIR,
  buildFeatureProductMap,
  isFeatureDocFilename,
} from "~/lib/featureProductMap";
import { explainFunctionaryNode, topLevelFunctionaryNodes } from "~/lib/functionaryMap";
import { SearchIcon } from "~/lib/icons";
import {
  projectListDirectoriesQueryOptions,
  projectReadFileQueryOptions,
} from "~/lib/projectReactQuery";
import { cn } from "~/lib/utils";
import { FunctionaryCityScene } from "./FunctionaryCityScene";
import { PanelStateMessage } from "./PanelStateMessage";

function visibleAncestor(
  nodeId: string,
  nodes: readonly { id: string; parentId?: string | null }[],
  visibleIds: ReadonlySet<string>,
): string | null {
  const byId = new Map(nodes.map((candidate) => [candidate.id, candidate]));
  let current = byId.get(nodeId);
  while (current) {
    if (visibleIds.has(current.id)) return current.id;
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return null;
}

export function FunctionaryMapPane(props: {
  workspaceRoot: string | null;
  onReferenceInChat?: ((reference: ChatFileReference) => void) | undefined;
}) {
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const hoverExitTimer = useRef<number | null>(null);
  const lastHoverExplain = useRef<ReturnType<typeof explainFunctionaryNode> | null>(null);
  const listQuery = useQuery(
    projectListDirectoriesQueryOptions({
      cwd: props.workspaceRoot,
      relativePath: FEATURE_DOCS_DIR,
      includeFiles: true,
      enabled: props.workspaceRoot !== null,
      staleTime: 0,
    }),
  );
  const featureEntries = useMemo(
    () =>
      (listQuery.data?.entries ?? []).filter(
        (entry) => entry.kind === "file" && isFeatureDocFilename(entry.name),
      ),
    [listQuery.data],
  );
  const fileQueries = useQueries({
    queries: featureEntries.map((entry) =>
      projectReadFileQueryOptions({
        cwd: props.workspaceRoot,
        relativePath: entry.path,
        enabled: props.workspaceRoot !== null,
        staleTime: 0,
      }),
    ),
  });
  const fileContentsKey = fileQueries.map((fileQuery) => fileQuery.data?.contents ?? "").join("\0");

  useEffect(
    () => () => {
      if (hoverExitTimer.current !== null) window.clearTimeout(hoverExitTimer.current);
    },
    [],
  );

  const docs = useMemo(() => {
    return featureEntries.flatMap((entry, index) => {
      const contents = fileQueries[index]?.data?.contents;
      if (!contents) return [];
      return [{ filename: entry.name, contents }];
    });
    // fileQueries is a new array each render; fileContentsKey is the result identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fileContentsKey
  }, [featureEntries, fileContentsKey]);
  const graph = useMemo(
    () => (docs.length === 0 ? null : buildFeatureProductMap(docs)),
    [docs],
  );

  const nodes = useMemo(() => (graph ? topLevelFunctionaryNodes(graph) : []), [graph]);
  const filesReady =
    featureEntries.length === 0 || fileQueries.every((fileQuery) => !fileQuery.isPending);

  if (!props.workspaceRoot) {
    return <PanelStateMessage>Open a workspace to view its map.</PanelStateMessage>;
  }
  if (listQuery.isPending || !filesReady) {
    return <PanelStateMessage>Loading product map...</PanelStateMessage>;
  }
  if (listQuery.isError || !graph || nodes.length === 0) {
    return (
      <PanelStateMessage>Nessun pezzo di prodotto in documentation/features.</PanelStateMessage>
    );
  }

  const selectedNode =
    graph.nodes.find((node) => node.id === selectedNodeId) ?? nodes[0] ?? null;
  const expandedChildIds = new Set(
    expandedNodeId
      ? graph.nodes.filter((node) => node.parentId === expandedNodeId).map((node) => node.id)
      : [],
  );
  const visibleIds = new Set([...nodes.map((node) => node.id), ...expandedChildIds]);
  const sceneSelectedId = selectedNode
    ? visibleAncestor(selectedNode.id, graph.nodes, visibleIds)
    : null;
  const featureCount = nodes.length;
  const fileCount = graph.nodes.filter((node) => node.archetype === "room").length;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = normalizedQuery
    ? graph.nodes.filter(
        (node) =>
          node.kind !== "scope" &&
          `${node.label} ${node.description ?? ""}`.toLocaleLowerCase().includes(normalizedQuery),
      )
    : [];

  function selectNode(nodeId: string) {
    const isLevelNode = nodes.some((node) => node.id === nodeId);
    const hasChildren = graph.nodes.some((node) => node.parentId === nodeId);
    setSelectedNodeId(nodeId);
    setQuery("");
    if (isLevelNode && hasChildren) {
      setExpandedNodeId((current) => (current === nodeId ? null : nodeId));
    } else if (isLevelNode) {
      setExpandedNodeId(null);
    }
  }

  function revealSearchResult(nodeId: string) {
    const node = graph.nodes.find((candidate) => candidate.id === nodeId);
    const parent = node?.parentId
      ? graph.nodes.find((candidate) => candidate.id === node.parentId)
      : null;
    if (parent && parent.kind !== "scope") {
      setExpandedNodeId(parent.id);
      setSelectedNodeId(nodeId);
      setQuery("");
      return;
    }
    selectNode(nodeId);
  }

  function handleHoverChange(nodeId: string | null) {
    if (hoverExitTimer.current !== null) {
      window.clearTimeout(hoverExitTimer.current);
      hoverExitTimer.current = null;
    }
    if (nodeId) {
      setHoveredNodeId(nodeId);
      return;
    }
    hoverExitTimer.current = window.setTimeout(() => {
      setHoveredNodeId(null);
      hoverExitTimer.current = null;
    }, 150);
  }

  const hoveredNode = hoveredNodeId
    ? (graph.nodes.find((node) => node.id === hoveredNodeId) ?? null)
    : null;
  const hoverExplain = hoveredNode ? explainFunctionaryNode(hoveredNode) : null;
  if (hoverExplain) lastHoverExplain.current = hoverExplain;
  const explainCard = hoverExplain ?? lastHoverExplain.current;

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[#dbe5e7] text-[#14202b]">
      <div className="grid h-11 shrink-0 grid-cols-[minmax(0,1fr)_auto_auto] border-b border-[#8fa2a6]/55 bg-[#edf3f2] font-mono">
        <div className="min-w-0 border-r border-[#8fa2a6]/45 px-3 py-1.5">
          <span className="block text-[8px] uppercase tracking-[0.16em] text-[#65777b]">
            Product
          </span>
          <strong className="block truncate text-[11px] font-semibold">{graph.name}</strong>
        </div>
        <div className="min-w-20 border-r border-[#8fa2a6]/45 px-3 py-1.5">
          <span className="block text-[8px] uppercase tracking-[0.16em] text-[#65777b]">
            Features
          </span>
          <strong className="block text-[11px] font-semibold">{featureCount}</strong>
        </div>
        <div className="min-w-20 px-3 py-1.5">
          <span className="block text-[8px] uppercase tracking-[0.16em] text-[#65777b]">Files</span>
          <strong className="block text-[11px] font-semibold">{fileCount}</strong>
        </div>
      </div>

      <section className="relative min-h-0 min-w-0 flex-1" aria-label="Interactive product map">
        <div className="absolute left-3 right-3 top-3 z-10 max-w-md">
          <label className="flex h-9 items-center gap-2 border border-[#8fa2a6]/70 bg-[#edf3f2]/95 px-3 shadow-sm backdrop-blur-sm focus-within:border-[#14202b]">
            <SearchIcon aria-hidden="true" className="size-3.5 shrink-0" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && matches[0]) revealSearchResult(matches[0].id);
                if (event.key === "Escape") setQuery("");
              }}
              placeholder="Find a piece"
              className="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-[#65777b]"
            />
          </label>
          {normalizedQuery ? (
            <div className="mt-1 max-h-52 overflow-y-auto border border-[#8fa2a6]/70 bg-[#edf3f2] p-1 shadow-lg">
              {matches.length ? (
                matches.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    className="block w-full px-2 py-2 text-left text-xs hover:bg-[#dbe5e7] focus-visible:bg-[#dbe5e7] focus-visible:outline-none"
                    onClick={() => revealSearchResult(node.id)}
                  >
                    <strong className="block font-medium">{node.label}</strong>
                    <span className="mt-0.5 block truncate text-[10px] text-[#65777b]">
                      {node.description ?? node.archetype}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-2 py-3 text-xs text-[#65777b]">No matching pieces.</p>
              )}
            </div>
          ) : null}
        </div>

        <FunctionaryCityScene
          allNodes={graph.nodes}
          edges={graph.edges}
          expandedId={expandedNodeId}
          nodes={nodes}
          selectedId={sceneSelectedId}
          onEnter={selectNode}
          onHoverChange={handleHoverChange}
          onSelect={selectNode}
        />
        <aside
          aria-hidden={hoverExplain === null}
          className={cn(
            "pointer-events-none absolute bottom-3 right-3 z-10 w-[min(22rem,calc(100%-1.5rem))] border border-[#8fa2a6]/70 bg-[#edf3f2]/95 p-3 shadow-sm backdrop-blur-sm",
            DISCLOSURE_CONTENT_MOTION_CLASS,
            hoverExplain ? DISCLOSURE_CONTENT_OPEN_CLASS : DISCLOSURE_CONTENT_CLOSED_CLASS,
          )}
        >
          {explainCard ? (
            <>
              <strong className="block font-mono text-[12px] font-semibold leading-snug">
                {explainCard.title}
              </strong>
              <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.12em] text-[#65777b]">
                {explainCard.role}
              </span>
              <p className="mt-2 text-[12px] leading-relaxed text-[#14202b]">{explainCard.body}</p>
            </>
          ) : null}
        </aside>
        <p className="pointer-events-none absolute bottom-3 left-3 bg-[#edf3f2]/90 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.08em] text-[#65777b]">
          Click su un pezzo per vedere i file
        </p>
      </section>
    </div>
  );
}
