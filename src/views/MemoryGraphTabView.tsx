import { memo, useCallback, useEffect, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { Brain, RefreshCw, ZoomIn, ZoomOut, Maximize2, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { useUnifiedMemory } from "../hooks/useUnifiedMemory";
import type { UnifiedMemoryItem } from "../services/mcpMemoryService";
import type { MemoryCategory } from "../types/memory";
import type { Tab } from "../components/TabBar";
import "./MemoryGraphTabView.css";

interface GraphNode {
  id: string;
  name: string;
  entityType: string;
  observations: string[];
  val: number;
  color: string;
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string;
  target: string;
  relationType: string;
}

interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

interface MemoryGraphTabViewProps {
  tab: Tab;
  isActive: boolean;
}

/**
 * Color palette for memory entity types
 * Using the rose/magenta color for consistency with MCP Memory branding
 */
const ENTITY_TYPE_COLORS: Record<string, string> = {
  preference: "#3b82f6", // blue
  fact: "#10b981", // green
  decision: "#8b5cf6", // purple
  pattern: "#f97316", // orange
  mistake: "#ef4444", // red
  context: "#6b7280", // gray
  person: "#E84A7F", // rose (MCP Memory color)
  project: "#E84A7F", // rose
  technology: "#00d9ff", // cyan
  tool: "#00d9ff", // cyan
};

/**
 * Default color for unknown entity types
 */
const DEFAULT_COLOR = "#E84A7F"; // rose (MCP Memory color)

function getEntityColor(entityType: string): string {
  return ENTITY_TYPE_COLORS[entityType.toLowerCase()] || DEFAULT_COLOR;
}

/**
 * Convert unified memory items to graph data
 */
function convertToGraphData(items: UnifiedMemoryItem[]): GraphData {
  const nodes: GraphNode[] = items.map((item) => {
    // Use content (the actual observation) as display name, not entityName (which has timestamp suffix)
    const displayName = item.content || (item.entityName || item.id).replace(/_/g, " ").replace(/^mcp-/, "");

    const observations = item.relations
      ? [item.content, ...item.relations.map(r => `${r.relationType} -> ${r.to}`)]
      : [item.content];

    return {
      id: item.id,
      name: displayName.length > 40 ? displayName.slice(0, 40) + "..." : displayName,
      entityType: item.entityType || item.category,
      observations,
      val: Math.max(4, Math.min(12, observations.length * 2 + 4)),
      color: getEntityColor(item.entityType || item.category),
    };
  });

  // Build links from MCP relations
  const links: GraphLink[] = [];
  items.forEach(item => {
    if (item.relations) {
      item.relations.forEach(relation => {
        // Only add link if both nodes exist
        if (nodes.find(n => n.id === `mcp-${relation.from}`) &&
            nodes.find(n => n.id === `mcp-${relation.to}`)) {
          links.push({
            source: `mcp-${relation.from}`,
            target: `mcp-${relation.to}`,
            relationType: relation.relationType,
          });
        }
      });
    }
  });

  return { nodes, links };
}

const CATEGORY_OPTIONS: { value: MemoryCategory; label: string }[] = [
  { value: "preference", label: "Preference" },
  { value: "fact", label: "Fact" },
  { value: "decision", label: "Decision" },
  { value: "pattern", label: "Pattern" },
  { value: "mistake", label: "Mistake" },
  { value: "context", label: "Context" },
];

// Zoom threshold for showing labels (labels visible when zoomed IN enough)
const LABEL_ZOOM_THRESHOLD = 0.8;
// Zoom threshold for showing tooltip on click (tooltip visible when zoomed OUT - i.e., low zoom)
const TOOLTIP_ZOOM_THRESHOLD = 1.2;

function MemoryGraphTabView({ tab, isActive }: MemoryGraphTabViewProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const graphRef = useRef<ForceGraphMethods<any, any>>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>("fact");
  const [currentZoom, setCurrentZoom] = useState(1);

  const {
    unifiedItems,
    isLoading,
    stats,
    refresh,
    createMemory,
    deleteMemory,
  } = useUnifiedMemory();

  // Build graph data from unified items
  useEffect(() => {
    const data = convertToGraphData(unifiedItems);
    setGraphData(data);
  }, [unifiedItems]);

  // Update dimensions on resize
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height - 52,
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [isActive]);

  // Load data when tab becomes active
  useEffect(() => {
    if (isActive) {
      refresh();
    }
  }, [isActive, refresh]);

  // Center graph after data loads
  useEffect(() => {
    if (graphData.nodes.length > 0 && graphRef.current) {
      const timeoutId = setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [graphData]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    // Only show details panel when zoomed out (labels not visible)
    // When zoomed in, labels are already visible so no need for details
    if (currentZoom < TOOLTIP_ZOOM_THRESHOLD) {
      setSelectedNode(node);
    } else {
      // Toggle selection for visual feedback when zoomed in
      setSelectedNode(prev => prev?.id === node.id ? null : node);
    }
    if (node.x !== undefined && node.y !== undefined) {
      graphRef.current?.centerAt(node.x, node.y, 300);
    }
  }, [currentZoom]);

  const handleZoomIn = useCallback(() => {
    const currentZoom = graphRef.current?.zoom() || 1;
    graphRef.current?.zoom(currentZoom * 1.5, 300);
  }, []);

  const handleZoomOut = useCallback(() => {
    const currentZoom = graphRef.current?.zoom() || 1;
    graphRef.current?.zoom(currentZoom / 1.5, 300);
  }, []);

  const handleFitView = useCallback(() => {
    graphRef.current?.zoomToFit(400, 50);
  }, []);

  const handleAddMemory = useCallback(async () => {
    if (!newMemoryContent.trim()) {
      toast.error("Please enter memory content");
      return;
    }

    await createMemory(newMemoryContent.trim(), newMemoryCategory);
    setNewMemoryContent("");
    setShowAddForm(false);
  }, [newMemoryContent, newMemoryCategory, createMemory]);

  const handleDeleteSelectedNode = useCallback(async () => {
    if (!selectedNode) return;

    await deleteMemory(selectedNode.id);
    setSelectedNode(null);
  }, [selectedNode, deleteMemory]);

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const nodeSize = node.val;
      const isSelected = selectedNode?.id === node.id;

      if (node.x === undefined || node.y === undefined) return;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, nodeSize, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Selected state
      if (isSelected) {
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowColor = node.color;
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw labels only when zoomed IN enough (globalScale >= threshold)
      // When zoomed out, labels are hidden and tooltip takes over
      if (globalScale >= LABEL_ZOOM_THRESHOLD) {
        const fontSize = Math.max(10, 12 / globalScale);
        ctx.font = `${fontSize}px Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
        ctx.fillText(node.name, node.x, node.y + nodeSize + 4);
      }
    },
    [selectedNode]
  );

  const linkCanvasObject = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D) => {
      const source = link.source as unknown as GraphNode;
      const target = link.target as unknown as GraphNode;

      if (!source.x || !source.y || !target.x || !target.y) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.lineWidth = 1;
      ctx.stroke();
    },
    []
  );

  if (!isActive || tab.type !== 'memory-graph') {
    return null;
  }

  return (
    <div className="memory-graph-tab-view" ref={containerRef}>
      {/* Toolbar */}
      <div className="memory-graph-toolbar">
        <div className="memory-graph-toolbar-left">
          <Brain size={16} className="memory-graph-toolbar-icon" style={{ color: "#E84A7F" }} />
          <span className="memory-graph-toolbar-title">Knowledge Graph</span>

          {/* Stats badges */}
          <div className="memory-graph-stats">
            <span className="memory-graph-stat mcp" title="Entities">
              <Brain size={10} />
              {stats.entities}
            </span>
            <span className="memory-graph-stat relations" title="Relations">
              {stats.relations}
            </span>
          </div>
        </div>

        <div className="memory-graph-toolbar-right">
          <button
            type="button"
            onClick={() => setShowAddForm(!showAddForm)}
            className={`memory-graph-toolbar-btn add ${showAddForm ? "active" : ""}`}
            title="Add Memory"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isLoading}
            className="memory-graph-toolbar-btn"
            title="Refresh"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            className="memory-graph-toolbar-btn"
            title="Zoom In"
          >
            <ZoomIn size={14} />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="memory-graph-toolbar-btn"
            title="Zoom Out"
          >
            <ZoomOut size={14} />
          </button>
          <button
            type="button"
            onClick={handleFitView}
            className="memory-graph-toolbar-btn"
            title="Fit View"
          >
            <Maximize2 size={14} />
          </button>
        </div>
      </div>

      {/* Add Memory Form */}
      {showAddForm && (
        <div className="memory-graph-add-form">
          <div className="memory-graph-add-form-row">
            <input
              type="text"
              value={newMemoryContent}
              onChange={(e) => setNewMemoryContent(e.target.value)}
              placeholder="Enter a memory to save..."
              className="memory-graph-add-input"
              onKeyDown={(e) => e.key === "Enter" && handleAddMemory()}
              autoFocus
            />
            <select
              value={newMemoryCategory}
              onChange={(e) => setNewMemoryCategory(e.target.value as MemoryCategory)}
              className="memory-graph-add-select"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddMemory}
              className="memory-graph-add-btn"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="memory-graph-add-cancel"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Graph Container */}
      <div className="memory-graph-canvas">
        {isLoading ? (
          <div className="memory-graph-loading">
            <RefreshCw size={32} className="animate-spin" />
            <span>Loading knowledge graph...</span>
          </div>
        ) : graphData.nodes.length === 0 ? (
          <div className="memory-graph-empty">
            <Brain size={48} style={{ color: "#E84A7F" }} />
            <h3>No memories yet</h3>
            <p>Start chatting or click + to add a memory</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="transparent"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => "replace"}
            linkCanvasObject={linkCanvasObject}
            linkCanvasObjectMode={() => "replace"}
            nodeLabel={(node: GraphNode) => currentZoom < LABEL_ZOOM_THRESHOLD ? node.name : ""}
            linkLabel={(link: GraphLink) => currentZoom < LABEL_ZOOM_THRESHOLD ? link.relationType : ""}
            onNodeClick={handleNodeClick}
            onZoom={(transform) => setCurrentZoom(transform.k)}
            nodeRelSize={6}
            linkDirectionalArrowLength={0}
            cooldownTicks={100}
            warmupTicks={50}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        )}
      </div>

      {/* Selected Node Details - only show when zoomed out (labels not visible) */}
      {selectedNode && currentZoom < TOOLTIP_ZOOM_THRESHOLD && (
        <div className="memory-graph-details">
          <div className="memory-graph-details-header">
            <div
              className="memory-graph-details-dot"
              style={{ backgroundColor: selectedNode.color }}
            />
            <h4>{selectedNode.name}</h4>
            <span className="memory-graph-details-type">
              {selectedNode.entityType}
            </span>
            <button
              type="button"
              onClick={handleDeleteSelectedNode}
              className="memory-graph-details-delete"
              title="Delete memory"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="memory-graph-details-close"
            >
              <X size={14} />
            </button>
          </div>
          <div className="memory-graph-details-content">
            <div className="memory-graph-details-observations">
              {selectedNode.observations.map((obs, i) => (
                <div key={i} className="memory-graph-observation">
                  {obs}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(MemoryGraphTabView);
