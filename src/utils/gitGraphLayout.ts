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

/**
 * Assign a lane for `parentHash` and return the lane index.
 * If the parent is already tracked, reuse its lane; otherwise claim a new one.
 */
function resolveParentLane(
  activeLanes: (string | null)[],
  parentHash: string
): number {
  const existing = findLane(activeLanes, parentHash)
  if (existing !== -1) return existing
  return claimLane(activeLanes, parentHash)
}

// ---------------------------------------------------------------------------
// Per-commit processing
// ---------------------------------------------------------------------------

interface CommitProcessResult {
  lane: number
  edges: GraphEdge[]
}

function processCommit(
  commit: GraphCommitInput,
  activeLanes: (string | null)[],
  hashToIndex: Map<string, number>,
  selfIndex: number
): CommitProcessResult {
  // 1. Find or claim lane for this commit
  let lane = findLane(activeLanes, commit.hash)
  if (lane === -1) lane = claimLane(activeLanes, commit.hash)

  const edges: GraphEdge[] = []

  if (commit.parentHashes.length === 0) {
    // Root commit — terminate this lane
    activeLanes[lane] = null
    trimTrailingNulls(activeLanes)
    return { lane, edges }
  }

  // 2. First parent: the lane continues straight
  const firstParent = commit.parentHashes[0]
  activeLanes[lane] = firstParent
  const firstParentRow = hashToIndex.get(firstParent) ?? selfIndex + 1
  edges.push(buildEdge(lane, lane, firstParentRow))

  // 3. Extra parents (merge sources)
  for (let i = 1; i < commit.parentHashes.length; i++) {
    const parentHash = commit.parentHashes[i]
    const parentLane = resolveParentLane(activeLanes, parentHash)
    if (findLane(activeLanes, parentHash) === -1) {
      activeLanes[parentLane] = parentHash
    }
    const parentRow = hashToIndex.get(parentHash) ?? selfIndex + 1
    edges.push(buildEdge(lane, parentLane, parentRow))
  }

  trimTrailingNulls(activeLanes)
  return { lane, edges }
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
    const { lane, edges } = processCommit(commit, activeLanes, hashToIndex, i)
    nodes.push({
      commit,
      lane,
      color: getLaneColor(lane),
      edges,
      activeLanes: activeLanes.map((h, idx) => h ? getLaneColor(idx) : null),
    })
  }

  return nodes
}
