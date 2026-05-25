import { getLaneColor, MAX_LANES } from './gitGraphColors'

// ---------------------------------------------------------------------------
// Input / Output types
// ---------------------------------------------------------------------------

export interface GraphCommitInput {
  hash: string
  parentHashes: string[] // from git log %P, space-separated and pre-split
  refs: string[]
  summary: string
  author: string
  relativeTime: string
  timestamp?: number
}

export interface GraphEdge {
  toRow: number   // index of parent commit in the input array
  fromLane: number
  toLane: number
  color: string   // uses fromLane color
}

export interface GraphNode {
  commit: GraphCommitInput
  lane: number
  color: string
  edges: GraphEdge[]
  /** Colors of active lanes at this row (null = inactive slot) */
  activeLanes: (string | null)[]
  /** Lane indices whose vertical line should start at this row's center (forked from this commit) */
  startLanes: number[]
  /** Lane indices whose vertical line should end at this row's center (converged into another lane) */
  endLanes: number[]
  /** True if this commit has 2+ parents (merge commit) */
  isMerge: boolean
  /** True if this commit carries at least one branch/tag ref */
  isBranchTip: boolean
}

// ---------------------------------------------------------------------------
// Internal lane state helpers
// ---------------------------------------------------------------------------

/** Find the index of `hash` in activeLanes, or -1 if not present. */
function findLane(activeLanes: (string | null)[], hash: string): number {
  return activeLanes.indexOf(hash)
}

/** Find the first null slot index, or -1 if none exists. */
function findFreeLane(activeLanes: (string | null)[]): number {
  return activeLanes.indexOf(null)
}

/**
 * Claim a lane for `hash`.
 * Re-uses the first null slot, appends a new slot (capped at MAX_LANES),
 * or falls back to lane 0 on overflow.
 */
function claimLane(activeLanes: (string | null)[], hash: string): number {
  const free = findFreeLane(activeLanes)
  if (free !== -1) {
    activeLanes[free] = hash
    return free
  }
  if (activeLanes.length < MAX_LANES) {
    activeLanes.push(hash)
    return activeLanes.length - 1
  }
  // Overflow: all 8 lanes busy — park on lane 0
  return 0
}

/** Remove trailing null slots to keep the activeLanes array compact. */
function trimTrailingNulls(activeLanes: (string | null)[]): void {
  while (activeLanes.length > 0 && activeLanes[activeLanes.length - 1] === null) {
    activeLanes.pop()
  }
}

// ---------------------------------------------------------------------------
// Edge building helpers
// ---------------------------------------------------------------------------

function buildEdge(
  fromLane: number,
  toLane: number,
  toRow: number
): GraphEdge {
  return {
    toRow,
    fromLane,
    toLane,
    color: getLaneColor(fromLane),
  }
}


// ---------------------------------------------------------------------------
// Per-commit processing
// ---------------------------------------------------------------------------

interface CommitProcessResult {
  lane: number
  edges: GraphEdge[]
  deferredClears: number[]
  startLanes: number[]
  endLanes: number[]
}

function processCommit(
  commit: GraphCommitInput,
  activeLanes: (string | null)[],
  hashToIndex: Map<string, number>,
  selfIndex: number
): CommitProcessResult {
  let lane = findLane(activeLanes, commit.hash)
  if (lane === -1) lane = claimLane(activeLanes, commit.hash)

  const edges: GraphEdge[] = []
  const deferredClears: number[] = []
  const startLanes: number[] = []
  const endLanes: number[] = []

  if (commit.parentHashes.length === 0) {
    deferredClears.push(lane)
    endLanes.push(lane)
    return { lane, edges, deferredClears, startLanes, endLanes }
  }

  const firstParent = commit.parentHashes[0]
  const firstParentRow = hashToIndex.get(firstParent) ?? selfIndex + 1
  const existingFirstParentLane = findLane(activeLanes, firstParent)
  if (existingFirstParentLane !== -1 && existingFirstParentLane !== lane) {
    edges.push(buildEdge(lane, existingFirstParentLane, firstParentRow))
    deferredClears.push(lane)
    endLanes.push(lane)
  } else {
    activeLanes[lane] = firstParent
    edges.push(buildEdge(lane, lane, firstParentRow))
  }

  for (let i = 1; i < commit.parentHashes.length; i++) {
    const parentHash = commit.parentHashes[i]
    const existingLane = findLane(activeLanes, parentHash)
    let parentLane: number
    if (existingLane !== -1) {
      parentLane = existingLane
    } else {
      parentLane = claimLane(activeLanes, parentHash)
      startLanes.push(parentLane)
    }
    const parentRow = hashToIndex.get(parentHash) ?? selfIndex + 1
    edges.push(buildEdge(lane, parentLane, parentRow))
  }

  return { lane, edges, deferredClears, startLanes, endLanes }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Compute lane assignments and edges for a list of commits (newest-first, as
 * returned by `git log`).
 *
 * The algorithm maintains `activeLanes` — a slot array where each slot holds
 * the hash of the commit expected next in that lane.  Commits are assigned to
 * existing slots or new slots and their parent connections become GraphEdges.
 *
 * @param commits - Ordered array of commits, index 0 = newest.
 * @returns GraphNode array with lane, color and edge data for each commit.
 */
export function computeGraphLanes(commits: GraphCommitInput[]): GraphNode[] {
  const hashToIndex = new Map<string, number>(
    commits.map((c, i) => [c.hash, i])
  )

  const activeLanes: (string | null)[] = []
  const nodes: GraphNode[] = []

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i]
    const { lane, edges, deferredClears, startLanes, endLanes } =
      processCommit(commit, activeLanes, hashToIndex, i)
    const isMerge = commit.parentHashes.length >= 2
    const isBranchTip = (commit.refs ?? []).some((r) => !r.startsWith('tag: '))
    nodes.push({
      commit,
      lane,
      color: getLaneColor(lane),
      edges,
      activeLanes: activeLanes.map((h, idx) => h ? getLaneColor(idx) : null),
      startLanes,
      endLanes,
      isMerge,
      isBranchTip,
    })
    for (const l of deferredClears) activeLanes[l] = null
    trimTrailingNulls(activeLanes)
  }

  return nodes
}
