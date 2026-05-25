/**
 * BrainNode Explorer — full knowledge graph view rendered when the user
 * enters a `BrainNode` (double-click on the compact card).
 *
 * Reuses `react-force-graph-2d` (already in deps via BrainGraph.tsx) and the
 * same type-color palette. Adds Heptabase-style side panel preview + "Drop on
 * canvas" action that materializes a node as an `mdCard` with `filePath`.
 */

import { useEffect, useRef, useState, useCallback, useMemo, Suspense, lazy } from 'react';
import ForceGraph2D, { type ForceGraphMethods } from 'react-force-graph-2d';
import { invoke } from '@tauri-apps/api/core';
import { loadBrainGraph, invalidateBrainGraphCache, type BrainGraphData, type BrainGraphNode, type BrainGraphLink } from '../../services/brainGraphService';
import MarkdownText from '../MarkdownText';
import { normalizeToForwardSlash } from '../../utils/platform';

const MermaidDiagram = lazy(() => import('../MermaidDiagram'));

const TYPE_COLORS: Record<string, string> = {
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
  feature: '#FFD700',
  'feature-doc': '#FFD700',
  note: '#94a3b8',
};

type Filter = 'all' | 'features' | 'bugs' | 'patterns' | 'gotchas' | 'decisions' | 'diary' | 'diagrams';

const FILTERS: Array<{ id: Filter; label: string; matchTypes: string[] }> = [
  { id: 'all',        label: 'All',        matchTypes: [] },
  { id: 'features',   label: 'Features',   matchTypes: ['feature', 'feature-doc'] },
  { id: 'bugs',       label: 'Bugs',       matchTypes: ['bug', 'bug_fix'] },
  { id: 'patterns',   label: 'Patterns',   matchTypes: ['pattern', 'component'] },
  { id: 'gotchas',    label: 'Gotchas',    matchTypes: ['gotcha'] },
  { id: 'decisions',  label: 'Decisions',  matchTypes: ['decision'] },
  { id: 'diary',      label: 'Diary',      matchTypes: ['diary'] },
  { id: 'diagrams',   label: 'Diagrams',   matchTypes: ['diagram'] },
];

interface Props {
  projectPath: string;
  /** Called when user clicks "Drop on canvas" — materializes a doc as mdCard at default coords. */
  onSpawnMdCard: (filePath: string) => void;
  /** Open the .md/.mmd file in the IDE-style Code Editor tab. */
  onOpenInEditor?: (filePath: string) => void;
  /** Exit back to whiteboard root. */
  onExit: () => void;
}

export default function BrainNodeExplorer({ projectPath, onSpawnMdCard, onOpenInEditor, onExit }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [graph, setGraph] = useState<BrainGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [showTagLinks, setShowTagLinks] = useState(false);
  const [viewMode, setViewMode] = useState<'graph' | 'timeline'>('timeline');
  const [selected, setSelected] = useState<BrainGraphNode | null>(null);
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Load graph data
  const reload = useCallback(async (force?: boolean) => {
    setLoading(true);
    try {
      const data = await loadBrainGraph(projectPath, { force });
      setGraph(data);
    } finally {
      setLoading(false);
    }
  }, [projectPath]);

  useEffect(() => { void reload(); }, [reload]);

  // Resize observer (mirrors BrainGraph.tsx pattern)
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

  // Force tuning — same magic numbers as BrainGraph.tsx; zeroed in timeline mode.
  useEffect(() => {
    if (!fgRef.current) return;
    const fg = fgRef.current;
    const isTimeline = viewMode === 'timeline';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const charge = fg.d3Force('charge') as any;
    if (charge) {
      charge.strength(isTimeline ? 0 : -150);
      charge.distanceMax(420);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const link = fg.d3Force('link') as any;
    if (link) link.distance((l: BrainGraphLink) => l.weight > 1 ? 60 : 110);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const center = fg.d3Force('center') as any;
    if (center) center.strength(isTimeline ? 0 : 0.05);
  }, [graph, viewMode]);

  const filteredData = useMemo(() => {
    if (!graph) return { nodes: [], links: [] };
    const matchTypes = filter === 'all'
      ? null
      : new Set(FILTERS.find(f => f.id === filter)?.matchTypes ?? []);
    const nodes = matchTypes ? graph.nodes.filter(n => matchTypes.has(n.type)) : graph.nodes;
    const ids = new Set(nodes.map(n => n.id));
    const linksRaw = viewMode === 'timeline'
      ? [] // timeline mode hides edges — focus is temporal density, not relations
      : graph.links;
    const links = linksRaw.filter(l => {
      if (!showTagLinks && l.via === 'tag') return false;
      const sId = typeof l.source === 'string' ? l.source : (l.source as { id: string }).id;
      const tId = typeof l.target === 'string' ? l.target : (l.target as { id: string }).id;
      return ids.has(sId) && ids.has(tId);
    });
    return { nodes, links };
  }, [graph, filter, showTagLinks, viewMode]);

  // --- Timeline layout: X = creation date, Y = swimlane per type ---
  const TIMELINE_LANES = useMemo(() => [
    'feature', 'feature-doc', 'decision', 'pattern', 'component',
    'bug_fix', 'bug', 'gotcha', 'guide', 'guide_hub', 'diagram', 'diary', 'note',
  ], []);

  const timelineLayout = useMemo(() => {
    if (viewMode !== 'timeline' || !filteredData.nodes.length) return null;

    let minTs = Infinity;
    let maxTs = -Infinity;
    const parsed: Array<{ id: string; type: string; ts: number | null }> = [];
    for (const n of filteredData.nodes) {
      const ts = n.created ? Date.parse(n.created) : NaN;
      if (Number.isFinite(ts)) {
        parsed.push({ id: n.id, type: n.type, ts });
        if (ts < minTs) minTs = ts;
        if (ts > maxTs) maxTs = ts;
      } else {
        parsed.push({ id: n.id, type: n.type, ts: null });
      }
    }
    if (!Number.isFinite(minTs) || !Number.isFinite(maxTs)) return null;

    // Month buckets
    const months: Array<{ ts: number; year: number; month: number; label: string }> = [];
    const startYear = new Date(minTs).getUTCFullYear();
    const startMonth = new Date(minTs).getUTCMonth();
    const endYear = new Date(maxTs).getUTCFullYear();
    const endMonth = new Date(maxTs).getUTCMonth();
    for (let y = startYear; y <= endYear; y++) {
      const mStart = y === startYear ? startMonth : 0;
      const mEnd = y === endYear ? endMonth : 11;
      for (let m = mStart; m <= mEnd; m++) {
        const ts = Date.UTC(y, m, 1);
        months.push({ ts, year: y, month: m, label: `${y}-${String(m + 1).padStart(2, '0')}` });
      }
    }
    const monthIndex = new Map<string, number>();
    months.forEach((mm, i) => monthIndex.set(`${mm.year}-${mm.month}`, i));

    // Group by MONTH; within each month, sub-group by DAY (sorted).
    // All nodes of a month share the same cx (month center). Days form vertical
    // sub-groups within that single column, separated by a small gap.
    type DayGroup = { day: number; ids: string[] };
    const monthClusters = new Map<number, DayGroup[]>();
    for (const p of parsed) {
      let monthIdxN: number;
      let day: number;
      if (p.ts === null) { monthIdxN = 0; day = 1; }
      else {
        const d = new Date(p.ts);
        monthIdxN = monthIndex.get(`${d.getUTCFullYear()}-${d.getUTCMonth()}`) ?? 0;
        day = d.getUTCDate();
      }
      let groups = monthClusters.get(monthIdxN);
      if (!groups) { groups = []; monthClusters.set(monthIdxN, groups); }
      let dg = groups.find(g => g.day === day);
      if (!dg) { dg = { day, ids: [] }; groups.push(dg); }
      dg.ids.push(p.id);
    }
    for (const groups of monthClusters.values()) {
      // Newest day first → top of the column
      groups.sort((a, b) => b.day - a.day);
    }

    const NODE_VSPACE = 34;
    const DAY_GAP = 48;                // vertical breathing room between day groups
    const DAY_HEADER_PAD = 30;         // gap between day header and first node
    const MONTH_W = 700;
    const padX = 240;
    const topPad = 180;

    // Find tallest month column to size H
    let maxColHeight = 0;
    for (const groups of monthClusters.values()) {
      let h = 0;
      for (const g of groups) h += g.ids.length * NODE_VSPACE;
      h += Math.max(0, groups.length - 1) * DAY_GAP;
      if (h > maxColHeight) maxColHeight = h;
    }
    const H = Math.max(720, topPad + maxColHeight + 260);
    const baselineY = topPad;
    const W = padX * 2 + months.length * MONTH_W;

    const positions = new Map<string, { x: number; y: number }>();
    // stems indexed per (monthIdx, day) so we can draw day markers
    const stems = new Map<number, { cx: number; cy: number; top: number; bottom: number; count: number; day: number; monthIdxN: number; ts: number }>();

    for (const [monthIdxN, groups] of monthClusters) {
      const cx = padX + monthIdxN * MONTH_W + MONTH_W / 2;
      const mm = months[monthIdxN];
      // Extra top margin so the first day group doesn't sit flush with the trunk
      let yOffset = 28;
      for (const dg of groups) {
        const dayMarkerY = baselineY + yOffset + 8;       // day header sits with 8px top margin
        const groupTopY = baselineY + yOffset + DAY_HEADER_PAD; // first node DAY_HEADER_PAD below header
        dg.ids.forEach((id, i) => {
          const y = groupTopY + i * NODE_VSPACE;
          positions.set(id, { x: cx, y });
        });
        const groupBottomY = groupTopY + (dg.ids.length - 1) * NODE_VSPACE;
        const ts = mm ? Date.UTC(mm.year, mm.month, dg.day) : 0;
        stems.set(monthIdxN * 100 + dg.day, {
          cx,
          cy: dayMarkerY,
          top: groupTopY,
          bottom: groupBottomY,
          count: dg.ids.length,
          day: dg.day,
          monthIdxN,
          ts,
        });
        yOffset += dg.ids.length * NODE_VSPACE + DAY_GAP;
      }
    }

    return { positions, W, H, padX, topPad, baselineY, months, monthW: MONTH_W, stems };
  }, [viewMode, filteredData.nodes, dimensions]);

  // Apply / clear fixed positions on the underlying d3 nodes.
  useEffect(() => {
    const fg = fgRef.current;
    if (!fg || !graph) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes = graph.nodes as any[];
    if (timelineLayout) {
      for (const node of nodes) {
        const p = timelineLayout.positions.get(node.id);
        if (p) { node.fx = p.x; node.fy = p.y; node.x = p.x; node.y = p.y; }
        else { delete node.fx; delete node.fy; }
      }
      fg.d3ReheatSimulation();
      // On entering timeline, center on the latest month with a soft zoom.
      const lastIdx = Math.max(0, timelineLayout.months.length - 1);
      const t = window.setTimeout(() => {
        const f = fgRef.current;
        if (!f) return;
        const x = timelineLayout.padX + lastIdx * timelineLayout.monthW + timelineLayout.monthW / 2;
        const y = timelineLayout.baselineY;
        f.centerAt(x, y, 600);
        const visibleMonths = 2;
        const k = Math.max(0.2, Math.min(2.5, dimensions.width / (visibleMonths * timelineLayout.monthW)));
        f.zoom(k, 600);
      }, 80);
      return () => window.clearTimeout(t);
    } else {
      for (const node of nodes) {
        delete node.fx;
        delete node.fy;
      }
      fg.d3ReheatSimulation();
    }
  }, [timelineLayout, graph, dimensions.width]);

// Load preview content when a node is selected
  useEffect(() => {
    if (!selected) {
      setPreviewContent('');
      setPreviewError(null);
      return;
    }
    let alive = true;
    setPreviewError(null);
    invoke<string>('read_file_content', { path: selected.filePath })
      .then(raw => { if (alive) setPreviewContent(raw); })
      .catch(() => {
        if (alive) {
          setPreviewError(`Could not read ${selected.filePath}`);
          setPreviewContent('');
        }
      });
    return () => { alive = false; };
  }, [selected]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((n: any) => {
    setSelected(n as BrainGraphNode);
  }, []);

  const handleRefresh = useCallback(() => {
    invalidateBrainGraphCache(projectPath);
    void reload(true);
  }, [projectPath, reload]);

  const handleDrop = useCallback(() => {
    if (!selected) return;
    // Relative path from projectPath
    const norm = normalizeToForwardSlash(projectPath);
    const abs = normalizeToForwardSlash(selected.filePath);
    const rel = abs.startsWith(norm + '/') ? abs.slice(norm.length + 1) : abs;
    onSpawnMdCard(rel);
  }, [selected, projectPath, onSpawnMdCard]);

  const handleOpen = useCallback(() => {
    if (selected && onOpenInEditor) onOpenInEditor(selected.filePath);
  }, [selected, onOpenInEditor]);

  const previewDisplay = useMemo(() => {
    if (!selected) return '';
    if (selected.filePath.endsWith('.mmd')) {
      return '```mermaid\n' + previewContent + '\n```';
    }
    return previewContent;
  }, [previewContent, selected]);

  return (
    <div className="fm-brain-explorer">
      <div className="fm-brain-explorer-topbar">
        <button className="fm-brain-explorer-exit" onClick={onExit} title="Back to whiteboard">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Back</span>
        </button>

        <div className="fm-brain-explorer-filters">
          {FILTERS.map(f => {
            const dotColor = f.matchTypes.length > 0
              ? (TYPE_COLORS[f.matchTypes[0]] ?? null)
              : null;
            return (
              <button
                key={f.id}
                className={`fm-brain-explorer-filter ${filter === f.id ? 'active' : ''}`}
                onClick={() => setFilter(f.id)}
              >
                {dotColor && (
                  <span
                    className="fm-brain-explorer-filter-dot"
                    style={{ background: dotColor }}
                  />
                )}
                {f.label}
              </button>
            );
          })}
        </div>

        <div className="fm-brain-explorer-viewmode">
          <button
            className={`fm-brain-explorer-filter ${viewMode === 'graph' ? 'active' : ''}`}
            onClick={() => setViewMode('graph')}
            title="Force-directed knowledge graph"
          >
            Graph
          </button>
          <button
            className={`fm-brain-explorer-filter ${viewMode === 'timeline' ? 'active' : ''}`}
            onClick={() => setViewMode('timeline')}
            title="Timeline by creation date, swimlanes by type"
          >
            Timeline
          </button>
        </div>

        {viewMode === 'graph' && (
          <button
            className={`fm-brain-explorer-filter ${showTagLinks ? 'active' : ''}`}
            onClick={() => setShowTagLinks(v => !v)}
            title={showTagLinks
              ? 'Tag-overlap links are visible (noisy)'
              : 'Show tag-overlap links in addition to explicit wikilinks'}
          >
            {showTagLinks ? 'Hide tag-links' : 'Show tag-links'}
          </button>
        )}

        <button className="fm-brain-explorer-refresh" onClick={handleRefresh} title="Re-index documentation/">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 11-3.21-6.88" /><path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      <div className="fm-brain-explorer-body">
        <div className="fm-brain-explorer-canvas-wrap">
        <div className="fm-brain-explorer-canvas" ref={containerRef}>
          {loading ? (
            <div className="fm-brain-explorer-loading">Indexing documentation…</div>
          ) : filteredData.nodes.length === 0 ? (
            <div className="fm-brain-explorer-empty">
              <p>No documents match this filter.</p>
            </div>
          ) : (
            <ForceGraph2D
              ref={fgRef}
              width={dimensions.width}
              height={dimensions.height}
              graphData={filteredData}
              nodeLabel="label"
              nodeVal="val"
              nodeRelSize={4}
              linkColor={(link: BrainGraphLink) => {
                const a = Math.min(0.5, 0.1 + 0.08 * (link.weight || 1));
                return link.via === 'wikilink' || link.via === 'mixed'
                  ? `rgba(255,107,53,${a})`
                  : `rgba(255,255,255,${a})`;
              }}
              linkWidth={(link: BrainGraphLink) => Math.min(2.5, 0.5 + (link.weight || 1) * 0.4)}
              backgroundColor="rgba(0,0,0,0)"
              onNodeClick={handleNodeClick}
              d3AlphaDecay={viewMode === 'timeline' ? 0.5 : 0.015}
              d3VelocityDecay={0.25}
              cooldownTicks={viewMode === 'timeline' ? 50 : 400}
              warmupTicks={viewMode === 'timeline' ? 0 : 100}
              enableNodeDrag={viewMode !== 'timeline'}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodePointerAreaPaint={(node: any, paintColor: string, ctx: CanvasRenderingContext2D, globalScale: number) => {
                // Hit area = circle + label region so clicking the text also selects the node.
                const r = Math.sqrt(node.val || 1) * 3.5;
                ctx.fillStyle = paintColor;
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
                ctx.fill();

                if (viewMode === 'timeline') {
                  // Label is on the right; estimate a generous rect.
                  const targetPx = 12;
                  const fontSize = Math.min(targetPx, targetPx / globalScale);
                  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
                  const label = (node.label || '').slice(0, 50);
                  const w = ctx.measureText(label).width;
                  ctx.fillRect(node.x + r, node.y - fontSize, w + 12, fontSize * 2);
                } else {
                  // Label below in graph mode
                  const targetPx = 12;
                  const fontSize = Math.min(targetPx, targetPx / globalScale);
                  ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;
                  const label = (node.label || '').slice(0, 40);
                  const w = ctx.measureText(label).width;
                  ctx.fillRect(node.x - w / 2 - 4, node.y + r, w + 8, fontSize + 4);
                }
              }}
              onRenderFramePre={(ctx: CanvasRenderingContext2D, globalScale: number) => {
                if (viewMode !== 'timeline' || !timelineLayout) return;
                const { W, padX, baselineY } = timelineLayout;

                // Single trunk — horizontal baseline
                ctx.strokeStyle = 'rgba(120,120,140,0.18)';
                ctx.lineWidth = 1.5 / globalScale;
                ctx.beginPath();
                ctx.moveTo(padX, baselineY);
                ctx.lineTo(W - padX, baselineY);
                ctx.stroke();
              }}
              onRenderFramePost={(ctx: CanvasRenderingContext2D, globalScale: number) => {
                if (viewMode !== 'timeline' || !timelineLayout) return;
                const { padX, baselineY, months, monthW, stems } = timelineLayout;

                // LOD thresholds — keep labels from colliding when zoomed out.
                const monthPxOnScreen = monthW * globalScale;
                const showFullMonth = monthPxOnScreen > 130;   // full name "September"
                const showAbbrMonth = monthPxOnScreen > 50;    // abbr "Sep"
                const monthStride = monthPxOnScreen > 100 ? 1
                  : monthPxOnScreen > 60 ? 2
                  : monthPxOnScreen > 30 ? 3
                  : 6;
                const showYearLabels = monthPxOnScreen * 12 > 90;
                const yearStride = monthPxOnScreen * 12 > 200 ? 1 : monthPxOnScreen * 12 > 100 ? 2 : 4;
                const showDayLabels = monthPxOnScreen > 320; // ~10 px per day on screen

                // Month/year column headers — ABOVE the trunk, centered on each month
                const yearY = baselineY - 60 / globalScale;
                const monthY = baselineY - 28 / globalScale;
                const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
                const MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';

                let lastYearDrawn = -1;
                months.forEach((mm, i) => {
                  const x = padX + i * monthW + monthW / 2;

                  if (mm.year !== lastYearDrawn && showYearLabels) {
                    const showThisYear = yearStride === 1 || (mm.year % yearStride) === 0;
                    if (showThisYear) {
                      ctx.font = `bold ${18 / globalScale}px Inter, system-ui, sans-serif`;
                      ctx.fillStyle = 'rgba(255,255,255,0.55)';
                      ctx.fillText(String(mm.year), x, yearY);
                    }
                    lastYearDrawn = mm.year;
                  }
                  // Skip months by stride so labels don't collide when zoomed out
                  if ((showAbbrMonth || showFullMonth) && (i % monthStride === 0)) {
                    const useFull = showFullMonth;
                    const text = useFull ? MONTH_NAMES[mm.month] : MONTH_ABBR[mm.month];
                    const fontPx = useFull ? 22 : 16;
                    ctx.font = `bold ${fontPx / globalScale}px Inter, system-ui, sans-serif`;
                    ctx.fillStyle = 'rgba(255,255,255,0.92)';
                    ctx.fillText(text, x, monthY);
                  }
                });

                // Day-group headers — full weekday name + day number, WHITE
                if (showDayLabels) {
                  const WEEKDAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
                  ctx.font = `600 ${12 / globalScale}px Inter, system-ui, sans-serif`;
                  ctx.textAlign = 'right';
                  ctx.textBaseline = 'middle';
                  for (const [, stem] of stems) {
                    const d = new Date(stem.ts);
                    const weekday = WEEKDAYS[d.getUTCDay()];
                    const text = `${weekday} ${stem.day}`;
                    const m = ctx.measureText(text);
                    const xRight = stem.cx - 18;
                    const padPx = 5 / globalScale;
                    const pillLeft = xRight - m.width - padPx;
                    const pillRight = xRight + padPx;
                    const lineGap = 12 / globalScale;

                    // Divider — starts to the RIGHT of the day-name pill, with a gap
                    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
                    ctx.lineWidth = 0.6 / globalScale;
                    ctx.beginPath();
                    ctx.moveTo(pillRight + lineGap, stem.cy);
                    ctx.lineTo(stem.cx + 320, stem.cy);
                    ctx.stroke();

                    ctx.fillStyle = 'rgba(15,17,21,0.88)';
                    ctx.fillRect(
                      pillLeft,
                      stem.cy - 8 / globalScale,
                      m.width + padPx * 2,
                      16 / globalScale,
                    );
                    ctx.fillStyle = 'rgba(255,255,255,0.95)';
                    ctx.fillText(text, xRight, stem.cy);
                  }
                }
              }}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                const color = TYPE_COLORS[node.type] ?? '#94a3b8';
                const isSelected = selected?.id === node.id;
                const r = Math.sqrt(node.val || 1) * 3.5;
                const isTimeline = viewMode === 'timeline';

                // Selection halo
                ctx.beginPath();
                ctx.arc(node.x, node.y, r + (isSelected ? 4 : 2), 0, 2 * Math.PI);
                ctx.fillStyle = isSelected ? color : `${color}33`;
                ctx.fill();
                ctx.beginPath();
                ctx.arc(node.x, node.y, r, 0, 2 * Math.PI);
                ctx.fillStyle = color;
                ctx.fill();

                // Label — screen-constant size; positioned by mode
                const targetPx = 12;
                const fontSize = Math.min(targetPx, targetPx / globalScale);
                const label = (node.label || '').slice(0, 50);
                ctx.font = `${fontSize}px Inter, system-ui, sans-serif`;

                const lpadX = fontSize * 0.4;
                const lpadY = fontSize * 0.2;
                const metrics = ctx.measureText(label);

                let labelX: number;
                let labelY: number;
                if (isTimeline) {
                  ctx.textAlign = 'left';
                  ctx.textBaseline = 'middle';
                  labelX = node.x + r + 6;
                  labelY = node.y;
                  ctx.fillStyle = 'rgba(15,17,21,0.78)';
                  ctx.fillRect(
                    labelX - lpadX,
                    labelY - fontSize / 2 - lpadY,
                    metrics.width + lpadX * 2,
                    fontSize + lpadY * 2,
                  );
                  ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(230,230,235,0.92)';
                  ctx.fillText(label, labelX, labelY);
                } else {
                  ctx.textAlign = 'center';
                  ctx.textBaseline = 'top';
                  labelX = node.x;
                  labelY = node.y + r + Math.max(2, fontSize * 0.25);
                  ctx.fillStyle = 'rgba(15,17,21,0.78)';
                  ctx.fillRect(
                    labelX - metrics.width / 2 - lpadX,
                    labelY - lpadY,
                    metrics.width + lpadX * 2,
                    fontSize + lpadY * 2,
                  );
                  ctx.fillStyle = isSelected ? '#ffffff' : 'rgba(230,230,235,0.92)';
                  ctx.fillText(label, labelX, labelY);
                }
              }}
            />
          )}
        </div>

        </div>

        {selected && (
          <aside className="fm-brain-explorer-side has-selection">
            <button
              className="fm-brain-explorer-side-close"
              onClick={() => setSelected(null)}
              title="Close preview"
              aria-label="Close preview"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="fm-brain-explorer-side-header">
              <span
                className="fm-brain-explorer-side-type"
                style={{ background: TYPE_COLORS[selected.type] ?? '#94a3b8' }}
              >
                {selected.type}
              </span>
              <span className="fm-brain-explorer-side-title">{selected.label}</span>
            </div>

            <div className="fm-brain-explorer-side-actions">
              <button onClick={handleDrop} title="Create an mdCard on the whiteboard">
                Drop on canvas
              </button>
              <button onClick={handleOpen} disabled={!onOpenInEditor} title="Open in editor">
                Open in editor
              </button>
            </div>

            <div className="fm-brain-explorer-side-preview">
              {previewError ? (
                <div className="fm-brain-explorer-side-error">{previewError}</div>
              ) : selected.filePath.endsWith('.mmd') ? (
                <Suspense fallback={<div>Loading diagram…</div>}>
                  <MermaidDiagram>{previewContent}</MermaidDiagram>
                </Suspense>
              ) : (
                <MarkdownText>{previewDisplay || ''}</MarkdownText>
              )}
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
