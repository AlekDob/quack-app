import { memo, useCallback, useEffect, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { Brain, RefreshCw, ZoomIn, ZoomOut, Maximize2, X, Plus, Cloud, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { useUnifiedMemory } from "../hooks/useUnifiedMemory";
import type { UnifiedMemoryItem } from "../services/mcpMemoryService";
import type { MemoryCategory, MemorySource } from "../types/memory";
import type { Tab } from "../components/TabBar";
import "./MemoryGraphTabView.css";

interface GraphNode {
  id: string;
  name: string;
  entityType: string;
  observations: string[];
  val: number;
  color: string;
  source: MemorySource;
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
 * Color palette for Quack memory categories
 * Matches the colors used in UnifiedMemoryItem.tsx side panel
 */
const QUACK_CATEGORY_COLORS: Record<string, string> = {
  preference: "#3b82f6", // blue
  fact: "#10b981", // green
  decision: "#8b5cf6", // purple
  pattern: "#f97316", // orange
  mistake: "#ef4444", // red
  context: "#6b7280", // gray
};

/**
 * MCP entities always use cyan/azure color
 */
const MCP_COLOR = "#00d9ff";

function getEntityColor(entityType: string, source: MemorySource): string {
  // MCP memories always use cyan
  if (source === "mcp") {
    return MCP_COLOR;
  }
  // Quack memories use category-specific colors from side panel
  return QUACK_CATEGORY_COLORS[entityType] || "#f97316";
}

/**
 * Convert unified memory items to graph data
 */
function convertToGraphData(
  items: UnifiedMemoryItem[],
  sourceFilter: MemorySource | "all"
): GraphData {
  const filteredItems = sourceFilter === "all"
    ? items
    : items.filter(item => item.source === sourceFilter);

  const nodes: GraphNode[] = filteredItems.map((item) => {
    const name = item.source === "mcp"
      ? (item.entityName || item.id).replace(/_/g, " ")
      : item.content.slice(0, 40) + (item.content.length > 40 ? "..." : "");

    const observations = item.source === "mcp" && item.relations
      ? [item.content, ...item.relations.map(r => `${r.relationType} -> ${r.to}`)]
      : [item.content];

    return {
      id: item.id,
      name,
      entityType: item.source === "mcp" ? (item.entityType || item.category) : item.category,
      observations,
      val: Math.max(4, Math.min(12, observations.length * 2 + 4)),
      color: getEntityColor(item.category, item.source),
      source: item.source,
    };
  });

  // Build links from MCP relations
  const links: GraphLink[] = [];
  filteredItems.forEach(item => {
    if (item.source === "mcp" && item.relations) {
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

// Zoom threshold for showing labels (same as in nodeCanvasObject)
const LABEL_ZOOM_THRESHOLD = 0.8;

function MemoryGraphTabView({ tab, isActive }: MemoryGraphTabViewProps) {
  const graphRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [sourceFilter, setSourceFilter] = useState<MemorySource | "all">("all");
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMemoryContent, setNewMemoryContent] = useState("");
  const [newMemoryCategory, setNewMemoryCategory] = useState<MemoryCategory>("fact");
  const [currentZoom, setCurrentZoom] = useState(1);

  const {
    unifiedItems,
    isLoading,
    stats,
    refresh,
    createQuackMemory,
    deleteMemory,
  } = useUnifiedMemory();

  // Build graph data from unified items
  useEffect(() => {
    const data = convertToGraphData(unifiedItems, sourceFilter);
    setGraphData(data);
  }, [unifiedItems, sourceFilter]);

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
    setSelectedNode(node);
    graphRef.current?.centerAt(node.x, node.y, 300);
  }, []);

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

    await createQuackMemory(newMemoryContent.trim(), newMemoryCategory);
    setNewMemoryContent("");
    setShowAddForm(false);
    toast.success("Memory added!");
  }, [newMemoryContent, newMemoryCategory, createQuackMemory]);

  const handleDeleteSelectedNode = useCallback(async () => {
    if (!selectedNode) return;

    await deleteMemory(selectedNode.id, selectedNode.source);
    setSelectedNode(null);
  }, [selectedNode, deleteMemory]);

  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name;
      const fontSize = Math.max(9, 11 / globalScale);
      const nodeSize = node.val;
      const isSelected = selectedNode?.id === node.id;

      // Draw node - always circle for both MCP and Quack
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI);
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

      // Only show label when zoomed in enough (like Obsidian)
      // Hide labels below zoom threshold
      if (globalScale >= LABEL_ZOOM_THRESHOLD) {
        ctx.font = `${fontSize}px General Sans, Inter, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(255, 255, 255, 0.85)";
        ctx.fillText(label, node.x!, node.y! + nodeSize + fontSize + 2);
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
          <Brain size={16} className="memory-graph-toolbar-icon" />
          <span className="memory-graph-toolbar-title">Knowledge Graph</span>

          {/* Stats badges */}
          <div className="memory-graph-stats">
            <span className="memory-graph-stat mcp" title="MCP (AI) memories">
              <Cloud size={10} />
              {stats.mcp}
            </span>
            <span className="memory-graph-stat quack" title="Quack (Pattern) memories">
              <Sparkles size={10} />
              {stats.quack}
            </span>
          </div>
        </div>

        <div className="memory-graph-toolbar-center">
          {/* Source filter */}
          <div className="memory-graph-source-filter">
            {(["all", "mcp", "quack"] as const).map((source) => (
              <button
                key={source}
                type="button"
                onClick={() => setSourceFilter(source)}
                className={`memory-graph-filter-btn ${sourceFilter === source ? "active" : ""} ${source}`}
              >
                {source === "all" ? "All" : source === "mcp" ? "MCP" : "Quack"}
              </button>
            ))}
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
            <Brain size={48} />
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
            linkCanvasObject={linkCanvasObject}
            onNodeClick={handleNodeClick}
            nodeRelSize={6}
            linkDirectionalArrowLength={0}
            cooldownTicks={100}
            warmupTicks={50}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        )}
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div className="memory-graph-details">
          <div className="memory-graph-details-header">
            <div
              className="memory-graph-details-dot"
              style={{ backgroundColor: selectedNode.color }}
            />
            <h4>{selectedNode.name}</h4>
            <span className={`memory-graph-details-source ${selectedNode.source}`}>
              {selectedNode.source === "mcp" ? "MCP" : "Quack"}
            </span>
            <span className="memory-graph-details-type">
              {selectedNode.entityType}
            </span>
            {selectedNode.source === "quack" && (
              <button
                type="button"
                onClick={handleDeleteSelectedNode}
                className="memory-graph-details-delete"
                title="Delete memory"
              >
                Delete
              </button>
            )}
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className="memory-graph-details-close"
            >
              <X size={14} />
            </button>
          </div>
          <div className="memory-graph-details-observations">
            {selectedNode.observations.map((obs, i) => (
              <div key={i} className="memory-graph-observation">
                {obs}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

export default memo(MemoryGraphTabView);
