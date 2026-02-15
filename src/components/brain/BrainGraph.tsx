import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { User, Bot } from 'lucide-react';
import { listBrainEntries, readBrainEntry } from '../../services/brainFileService';
import type { BrainEntry } from '../../services/brainFileService';
import type { GuideFeature } from './BrainSidebar';

interface BrainGraphProps {
  projectPath?: string;
  isGlobal?: boolean;
  onSelectEntry?: (filePath: string) => void;
  guideFeatures?: GuideFeature[];
}

interface GNode {
  id: string;
  label: string;
  type: string;
  tags: string[];
  val: number;
  color: string;
  x?: number;
  y?: number;
}

interface GLink {
  source: string;
  target: string;
  weight: number;
}

type GraphFilter = 'all' | 'ai' | 'human';

const typeColors: Record<string, string> = {
  decision: '#4ECDC4',
  bug_fix: '#FF6B6B',
  bug: '#FF6B6B',
  pattern: '#45B7D1',
  component: '#45B7D1',
  gotcha: '#F7B731',
  diary: '#A78BFA',
  preference: '#C084FC',
  person: '#FB923C',
  tool: '#6EE7B7',
  guide: '#22c55e',
  guide_hub: '#16a34a',
  diagram: '#06b6d4',
};

const isGuideType = (t: string) => t === 'guide' || t === 'guide_hub';
const isDiagramType = (t: string) => t === 'diagram';

function buildAiGraph(entries: BrainEntry[]): { nodes: GNode[]; links: GLink[] } {
  const nodes: GNode[] = [];
  const linkMap = new Map<string, GLink>();
  const tagMap = new Map<string, string[]>();

  for (const entry of entries) {
    const type = entry.type || 'unknown';
    nodes.push({
      id: entry.filePath,
      label: entry.title,
      type,
      tags: entry.tags,
      val: Math.max(1, Math.min(entry.tags.length, 5)),
      color: typeColors[type] || '#888',
    });
    for (const tag of entry.tags) {
      if (!tagMap.has(tag)) tagMap.set(tag, []);
      tagMap.get(tag)!.push(entry.filePath);
    }
  }

  for (const [, nodeIds] of tagMap) {
    if (nodeIds.length > 20) continue;
    for (let i = 0; i < nodeIds.length; i++) {
      for (let j = i + 1; j < nodeIds.length; j++) {
        const key = [nodeIds[i], nodeIds[j]].sort().join('::');
        const existing = linkMap.get(key);
        if (existing) {
          existing.weight += 1;
        } else {
          linkMap.set(key, { source: nodeIds[i], target: nodeIds[j], weight: 1 });
        }
      }
    }
  }

  return { nodes, links: Array.from(linkMap.values()) };
}

function buildGuideNodes(features: GuideFeature[]): { nodes: GNode[]; links: GLink[] } {
  const nodes: GNode[] = [];
  const links: GLink[] = [];

  for (const feat of features) {
    const hubId = `hub::${feat.id}`;
    nodes.push({
      id: hubId, label: feat.label, type: 'guide_hub',
      tags: [], val: 6, color: typeColors['guide_hub'],
    });
    for (const page of feat.pageList) {
      nodes.push({
        id: page.path, label: page.title, type: 'guide',
        tags: [feat.id], val: 2, color: typeColors['guide'],
      });
      links.push({ source: hubId, target: page.path, weight: 2 });
    }
  }

  return { nodes, links };
}

export default function BrainGraph({ projectPath, isGlobal, onSelectEntry, guideFeatures }: BrainGraphProps) {
  const [allNodes, setAllNodes] = useState<GNode[]>([]);
  const [allLinks, setAllLinks] = useState<GLink[]>([]);
  const [filter, setFilter] = useState<GraphFilter>('all');
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  useEffect(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setDimensions({ width: rect.width, height: rect.height });
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setDimensions({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = fg.d3Force('charge') as any;
    if (charge) { charge.strength(-120); charge.distanceMax(400); }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = fg.d3Force('link') as any;
    if (link) link.distance((l: GLink) => l.weight > 1 ? 60 : 100);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const center = fg.d3Force('center') as any;
    if (center) center.strength(0.05);
  }, [allNodes, allLinks]);

  const loadGraph = useCallback(async () => {
    if (!isGlobal && !projectPath) return;
    const filePaths = await listBrainEntries(
      isGlobal ? { global: true } : { projectRoot: projectPath }
    );
    const entries: BrainEntry[] = [];
    for (const fp of filePaths) {
      const entry = await readBrainEntry(fp);
      if (entry) entries.push(entry);
    }
    const ai = buildAiGraph(entries);
    const guide = buildGuideNodes(guideFeatures || []);
    setAllNodes([...ai.nodes, ...guide.nodes]);
    setAllLinks([...ai.links, ...guide.links]);
  }, [projectPath, isGlobal, guideFeatures]);

  useEffect(() => { loadGraph(); }, [loadGraph]);

  const filteredData = useMemo(() => {
    let nodes: GNode[];
    if (filter === 'all') nodes = allNodes;
    else if (filter === 'ai') nodes = allNodes.filter(n => !isGuideType(n.type) || isDiagramType(n.type));
    else nodes = allNodes.filter(n => isGuideType(n.type) || isDiagramType(n.type));

    const ids = new Set(nodes.map(n => n.id));
    const links = allLinks.filter(l => {
      const sId = typeof l.source === 'string' ? l.source : (l.source as unknown as GNode).id;
      const tId = typeof l.target === 'string' ? l.target : (l.target as unknown as GNode).id;
      return ids.has(sId) && ids.has(tId);
    });
    return { nodes, links };
  }, [allNodes, allLinks, filter]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any) => {
    if (onSelectEntry && node.id && !String(node.id).startsWith('hub::')) {
      onSelectEntry(node.id as string);
    }
  }, [onSelectEntry]);

  return (
    <div className="brain-graph-wrapper">
      <div className="brain-graph-header">
        <h2>Knowledge Graph</h2>
        <div className="brain-graph-filters">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>
            All
          </button>
          <button className={filter === 'ai' ? 'active' : ''} onClick={() => setFilter('ai')}>
            <Bot size={12} /> AI
          </button>
          <button className={filter === 'human' ? 'active' : ''} onClick={() => setFilter('human')}>
            <User size={12} /> Human
          </button>
        </div>
      </div>
      <div className="brain-graph" ref={containerRef}>
        {filteredData.nodes.length === 0 ? (
          <div className="brain-empty-state"><p>No nodes to display</p></div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={filteredData}
            nodeLabel="label"
            nodeColor="color"
            nodeVal="val"
            nodeRelSize={4}
            linkColor={(link: GLink) => {
              const alpha = Math.min(0.3, 0.06 * (link.weight || 1));
              return `rgba(255,255,255,${alpha})`;
            }}
            linkWidth={(link: GLink) => Math.min(2, 0.5 + (link.weight || 1) * 0.3)}
            backgroundColor="#1a1a1e"
            onNodeClick={handleNodeClick}
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.25}
            cooldownTicks={300}
            warmupTicks={100}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D) => {
              const isHub = node.type === 'guide_hub';
              const r = isHub ? Math.sqrt(node.val || 1) * 5 : Math.sqrt(node.val || 1) * 3.5;

              ctx.beginPath();
              ctx.arc(node.x, node.y, r + (isHub ? 3 : 1.5), 0, 2 * Math.PI);
              ctx.fillStyle = `${node.color}${isHub ? '55' : '33'}`;
              ctx.fill();

              ctx.beginPath();
              ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
              ctx.fillStyle = node.color || '#888';
              ctx.fill();

              const label = (node.label || '').slice(0, 30);
              ctx.font = isHub ? 'bold 5px Inter, sans-serif' : '3.5px Inter, sans-serif';
              ctx.fillStyle = isHub ? 'rgba(255,255,255,0.95)' : 'rgba(220,220,220,0.9)';
              ctx.textAlign = 'center';
              ctx.fillText(label, node.x, node.y + r + (isHub ? 7 : 5.5));
            }}
          />
        )}
      </div>
    </div>
  );
}
