import { memo, useCallback, useEffect, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { Brain, X, RefreshCw, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { mcpMemoryService, type MCPEntity, type MCPRelation } from "../../services/mcpMemoryService";
import "./MemoryGraphDrawer.css";

interface GraphNode {
  id: string;
  name: string;
  entityType: string;
  observations: string[];
  val: number; // Node size based on observations count
  color: string;
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

interface MemoryGraphDrawerProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Color palette for different entity types
 * Using Quack brand colors
 */
const ENTITY_COLORS: Record<string, string> = {
  UserPreferences: "#f28c52", // Orange - Quack primary
  feature: "#4dd4b3",         // Teal - success
  project_milestone: "#8fa6ff", // Blue-purple
  File: "#ffd166",            // Yellow
  person: "#f77aa6",          // Pink
  project: "#00d9ff",         // Cyan - info
  technology: "#22c55e",      // Green
  tool: "#a78bfa",            // Purple
  concept: "#f59e0b",         // Amber
  default: "#ffffff",         // White fallback
};

function getEntityColor(entityType: string): string {
  return ENTITY_COLORS[entityType] || ENTITY_COLORS.default;
}

/**
 * Convert MCP knowledge graph to force-graph format
 */
function convertToGraphData(
  entities: MCPEntity[],
  relations: MCPRelation[]
): GraphData {
  const nodes: GraphNode[] = entities.map((entity) => ({
    id: entity.name,
    name: entity.name.replace(/_/g, " "),
    entityType: entity.entityType,
    observations: entity.observations,
    val: Math.max(3, Math.min(15, entity.observations.length * 2 + 3)),
    color: getEntityColor(entity.entityType),
  }));

  const links: GraphLink[] = relations.map((relation) => ({
    source: relation.from,
    target: relation.to,
    relationType: relation.relationType,
  }));

  return { nodes, links };
}

function MemoryGraphDrawer({ open, onClose }: MemoryGraphDrawerProps) {
  const graphRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  /**
   * Load graph data from MCP Memory service
   */
  const loadGraphData = useCallback(async () => {
    setIsLoading(true);
    try {
      await mcpMemoryService.refreshFromFile();
      const graph = mcpMemoryService.getKnowledgeGraph();

      if (graph) {
        const data = convertToGraphData(graph.entities, graph.relations);
        setGraphData(data);
      }
    } catch (error) {
      console.error("[MemoryGraphDrawer] Failed to load graph:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Update dimensions on resize
   */
  useEffect(() => {
    if (!open || !containerRef.current) return;

    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: rect.height - 60, // Account for header
        });
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, [open]);

  /**
   * Load data when drawer opens
   */
  useEffect(() => {
    if (open) {
      loadGraphData();
    }
  }, [open, loadGraphData]);

  /**
   * Center graph on load
   */
  useEffect(() => {
    if (graphData.nodes.length > 0 && graphRef.current) {
      const timeoutId = setTimeout(() => {
        graphRef.current?.zoomToFit(400, 50);
      }, 500);

      return () => clearTimeout(timeoutId);
    }
  }, [graphData]);

  /**
   * Handle node click
   */
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node);
    graphRef.current?.centerAt(node.x, node.y, 300);
  }, []);

  /**
   * Handle zoom controls
   */
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

  /**
   * Custom node rendering
   */
  const nodeCanvasObject = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const label = node.name;
      const fontSize = Math.max(10, 12 / globalScale);
      ctx.font = `${fontSize}px General Sans, Inter, sans-serif`;

      const nodeSize = node.val;

      // Draw node circle
      ctx.beginPath();
      ctx.arc(node.x!, node.y!, nodeSize, 0, 2 * Math.PI);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Glow effect for selected node
      if (selectedNode?.id === node.id) {
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.shadowColor = node.color;
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.arc(node.x!, node.y!, nodeSize + 2, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Draw label
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillText(label, node.x!, node.y! + nodeSize + fontSize);
    },
    [selectedNode]
  );

  /**
   * Custom link rendering
   */
  const linkCanvasObject = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D) => {
      const source = link.source as unknown as GraphNode;
      const target = link.target as unknown as GraphNode;

      if (!source.x || !source.y || !target.x || !target.y) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      ctx.stroke();
    },
    []
  );

  return (
    <div className={`memory-graph-drawer ${open ? "open" : ""}`}>
      <div className="memory-graph-backdrop" onClick={onClose} />

      <div className="memory-graph-panel">
        {/* Header */}
        <header className="memory-graph-header">
          <div className="memory-graph-header-content">
            <Brain size={20} className="memory-graph-icon" />
            <h2>Knowledge Graph</h2>
            <span className="memory-graph-count">
              {graphData.nodes.length} entities
            </span>
          </div>

          <div className="memory-graph-controls">
            <button
              type="button"
              onClick={loadGraphData}
              disabled={isLoading}
              className="memory-graph-control-btn"
              title="Refresh"
            >
              <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              className="memory-graph-control-btn"
              title="Zoom In"
            >
              <ZoomIn size={16} />
            </button>
            <button
              type="button"
              onClick={handleZoomOut}
              className="memory-graph-control-btn"
              title="Zoom Out"
            >
              <ZoomOut size={16} />
            </button>
            <button
              type="button"
              onClick={handleFitView}
              className="memory-graph-control-btn"
              title="Fit View"
            >
              <Maximize2 size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="memory-graph-close"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          </div>
        </header>

        {/* Graph Container */}
        <div className="memory-graph-container" ref={containerRef}>
          {isLoading ? (
            <div className="memory-graph-loading">
              <RefreshCw size={32} className="animate-spin" />
              <span>Loading knowledge graph...</span>
            </div>
          ) : graphData.nodes.length === 0 ? (
            <div className="memory-graph-empty">
              <Brain size={48} />
              <h3>No memories yet</h3>
              <p>Start chatting and I will remember important things</p>
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
              <span className="memory-graph-details-type">
                {selectedNode.entityType}
              </span>
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

        {/* Legend */}
        <div className="memory-graph-legend">
          {Object.entries(ENTITY_COLORS)
            .filter(([key]) => key !== "default")
            .map(([type, color]) => (
              <div key={type} className="memory-graph-legend-item">
                <div
                  className="memory-graph-legend-dot"
                  style={{ backgroundColor: color }}
                />
                <span>{type.replace(/_/g, " ")}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

export default memo(MemoryGraphDrawer);
