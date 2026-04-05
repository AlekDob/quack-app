import type { GraphNode, GraphEdge } from '../utils/gitGraphLayout'
import './GitGraph.css'

const LANE_WIDTH = 16
const DOT_RADIUS = 4
const ROW_HEIGHT = 36

interface GraphColumnProps {
  node: GraphNode
  totalLanes: number
}

function laneX(lane: number): number {
  return lane * LANE_WIDTH + LANE_WIDTH / 2
}

function renderPassthroughLine(lane: number, color: string) {
  const x = laneX(lane)
  return (
    <line
      key={`pass-${lane}`}
      x1={x} y1={0} x2={x} y2={ROW_HEIGHT}
      stroke={color}
      strokeWidth={2}
      strokeOpacity={0.4}
    />
  )
}

function renderEdge(edge: GraphEdge, key: string) {
  const fromX = laneX(edge.fromLane)
  const toX = laneX(edge.toLane)

  if (fromX === toX) return null // same lane = passthrough handles it

  const midY = ROW_HEIGHT * 0.6
  return (
    <path
      key={key}
      d={`M ${fromX} ${ROW_HEIGHT / 2} C ${fromX} ${midY}, ${toX} ${midY}, ${toX} ${ROW_HEIGHT}`}
      stroke={edge.color}
      strokeWidth={2}
      strokeOpacity={0.5}
      fill="none"
    />
  )
}

function renderDot(lane: number, color: string) {
  const x = laneX(lane)
  return (
    <circle
      className="graph-dot"
      cx={x}
      cy={ROW_HEIGHT / 2}
      r={DOT_RADIUS}
      fill={color}
      stroke="rgba(15, 17, 26, 1)"
      strokeWidth={2}
    />
  )
}

export default function GraphColumn({ node, totalLanes }: GraphColumnProps) {
  const width = Math.max(totalLanes, 1) * LANE_WIDTH + 4
  const activeLanes = node.activeLanes ?? []

  return (
    <svg
      className="git-graph-column"
      width={width}
      height={ROW_HEIGHT}
      viewBox={`0 0 ${width} ${ROW_HEIGHT}`}
    >
      {/* Pass-through lines for all active lanes */}
      {activeLanes.map((color, lane) =>
        color ? renderPassthroughLine(lane, color) : null
      )}

      {/* Merge/branch-off edges */}
      {node.edges.map((edge, i) => renderEdge(edge, `edge-${i}`))}

      {/* Commit dot */}
      {renderDot(node.lane, node.color)}
    </svg>
  )
}
