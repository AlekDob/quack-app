import type { GraphNode, GraphEdge } from '../utils/gitGraphLayout'
import './GitGraph.css'

export const LANE_WIDTH = 12
export const ROW_HEIGHT = 44
const DOT_RADIUS = 4
const LINE_WIDTH = 1.6

interface GraphColumnProps {
  node: GraphNode
  totalLanes: number
}

function laneX(lane: number): number {
  return lane * LANE_WIDTH + LANE_WIDTH / 2
}

export function getGraphWidth(totalLanes: number): number {
  return Math.max(totalLanes, 1) * LANE_WIDTH + 4
}

export default function GraphColumn({ node, totalLanes }: GraphColumnProps) {
  const width = getGraphWidth(totalLanes)
  const activeLanes = node.activeLanes ?? []
  const startSet = new Set(node.startLanes ?? [])
  const endSet = new Set(node.endLanes ?? [])
  const dotX = laneX(node.lane)
  const forkEdges = node.edges.filter((e) => e.fromLane !== e.toLane)

  return (
    <div
      className="git-graph-column"
      style={{
        width,
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        pointerEvents: 'none',
      }}
    >
      {activeLanes.map((color, lane) => {
        if (!color) return null
        const isStart = startSet.has(lane)
        const isEnd = endSet.has(lane)
        // Lane that starts in this row: vertical line only from center down
        // Lane that ends in this row: vertical line only from top to center
        const style: React.CSSProperties = {
          position: 'absolute',
          left: laneX(lane) - LINE_WIDTH / 2,
          width: LINE_WIDTH,
          background: color,
          opacity: 0.9,
        }
        if (isStart) {
          style.top = '50%'
          style.bottom = 0
        } else if (isEnd) {
          style.top = 0
          style.height = '50%'
        } else {
          style.top = 0
          style.bottom = 0
        }
        return <div key={lane} className="graph-lane-line" style={style} />
      })}

      {forkEdges.length > 0 && (
        <svg
          className="graph-edge-svg"
          width={width}
          height={ROW_HEIGHT}
          viewBox={`0 0 ${width} ${ROW_HEIGHT}`}
          preserveAspectRatio="xMinYMin meet"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            overflow: 'visible',
            pointerEvents: 'none',
          }}
        >
          {forkEdges.map((edge, i) => {
            const fromX = laneX(edge.fromLane)
            const toX = laneX(edge.toLane)
            if (fromX === toX) return null
            const midY = ROW_HEIGHT / 2
            // Smooth quarter-circle bend from (fromX, midY) → (toX, ROW_HEIGHT) or top
            // fromX = dot lane in this row; toX = lane that starts/ends in this row
            // If fromX > toX (converging into earlier lane), curve goes up-left
            // If fromX < toX (forking into later lane), curve goes down-right
            // Both rendered as: from dot down (or up) then quad-bend to target lane at row edge
            const d = `M ${fromX} ${midY} L ${fromX} ${ROW_HEIGHT * 0.7} Q ${fromX} ${ROW_HEIGHT}, ${toX} ${ROW_HEIGHT}`
            return (
              <path
                key={i}
                d={d}
                stroke={edge.color}
                strokeWidth={2}
                strokeOpacity={1}
                strokeLinecap="round"
                fill="none"
              />
            )
          })}
        </svg>
      )}

      <div
        className="graph-dot"
        style={{
          position: 'absolute',
          left: dotX - DOT_RADIUS,
          top: `calc(50% - ${DOT_RADIUS}px)`,
          width: DOT_RADIUS * 2,
          height: DOT_RADIUS * 2,
          borderRadius: '50%',
          background: node.isMerge ? 'rgba(15, 17, 26, 1)' : node.color,
          border: `1.4px solid ${node.color}`,
          boxSizing: 'border-box',
          zIndex: 1,
        }}
      >
        {node.isMerge && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: 2.5,
              height: 2.5,
              borderRadius: '50%',
              background: node.color,
            }}
          />
        )}
      </div>
    </div>
  )
}
