/** 8 distinct lane colors for git graph visualization */
export const LANE_COLORS = [
  '#34d399', // emerald (lane 0, typically main)
  '#60a5fa', // blue
  '#f472b6', // pink
  '#fbbf24', // amber
  '#a78bfa', // purple
  '#22d3ee', // cyan
  '#fb923c', // orange
  '#f87171', // red
] as const

export type LaneColor = (typeof LANE_COLORS)[number]

export const MAX_LANES = LANE_COLORS.length

export function getLaneColor(laneIndex: number): string {
  return LANE_COLORS[laneIndex % LANE_COLORS.length]
}
