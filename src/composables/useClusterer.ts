import type { BeadGrid, FocusBlock } from '../types'

interface Point {
  row: number
  col: number
  clusterId: number // 0 = unvisited, -1 = noise
}

interface SpatialIndex {
  grid: Map<string, Point[]>
  eps: number
}

function buildSpatialIndex(points: Point[], eps: number): SpatialIndex {
  const grid = new Map<string, Point[]>()
  for (const p of points) {
    const key = `${Math.floor(p.row / eps)},${Math.floor(p.col / eps)}`
    if (!grid.has(key)) grid.set(key, [])
    grid.get(key)!.push(p)
  }
  return { grid, eps }
}

function getNeighborsFromIndex(p: Point, index: SpatialIndex, eps: number): Point[] {
  const result: Point[] = []
  const gr = Math.floor(p.row / eps)
  const gc = Math.floor(p.col / eps)
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const bucket = index.grid.get(`${gr + dr},${gc + dc}`)
      if (bucket) {
        for (const q of bucket) {
          if (q !== p && manhattan(p, q) <= eps) {
            result.push(q)
          }
        }
      }
    }
  }
  return result
}

const EPS = 2
const MIN_PTS = 10

function manhattan(
  a: { row: number; col: number },
  b: { row: number; col: number },
): number {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col)
}

function dbscan(points: Point[], eps: number, minPts: number): void {
  const index = buildSpatialIndex(points, eps)
  let clusterId = 0
  for (const p of points) {
    if (p.clusterId !== 0) continue
    const neighbors = getNeighborsFromIndex(p, index, eps)
    if (neighbors.length < minPts) {
      p.clusterId = -1
      continue
    }
    clusterId++
    p.clusterId = clusterId
    const queue = [...neighbors]
    for (let i = 0; i < queue.length; i++) {
      const q = queue[i]
      if (q.clusterId === -1) {
        q.clusterId = clusterId
      }
      if (q.clusterId !== 0) continue
      q.clusterId = clusterId
      const qNeighbors = getNeighborsFromIndex(q, index, eps)
      if (qNeighbors.length >= minPts) {
        queue.push(...qNeighbors)
      }
    }
  }
}

let blockSeq = 0
function nextBlockId(): string {
  return `block_${++blockSeq}`
}

export function clusterGrid(grid: BeadGrid): FocusBlock[] {
  if (!grid || grid.rows === 0 || grid.cols === 0) return []

  const colorGroups = new Map<number, Point[]>()
  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const idx = grid.cells[row][col].colorIndex
      if (idx === null) continue
      if (!colorGroups.has(idx)) colorGroups.set(idx, [])
      colorGroups.get(idx)!.push({ row, col, clusterId: 0 })
    }
  }

  if (colorGroups.size === 0) return []

  const sortedColors = [...colorGroups.entries()].sort(
    (a, b) => a[1].length - b[1].length,
  )

  blockSeq = 0
  const allBlocks: FocusBlock[] = []

  for (const [colorIndex, points] of sortedColors) {
    const color = grid.palette[colorIndex]
    if (!color) continue

    dbscan(points, EPS, MIN_PTS)

    const clusters = new Map<number, Point[]>()
    const noise: Point[] = []
    for (const p of points) {
      if (p.clusterId <= 0) {
        noise.push(p)
      } else {
        if (!clusters.has(p.clusterId)) clusters.set(p.clusterId, [])
        clusters.get(p.clusterId)!.push(p)
      }
    }

    const clusterBlocks = [...clusters.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([_, pts]) => createBlock(colorIndex, color.name, color.hex, pts))

    allBlocks.push(...clusterBlocks)

    if (noise.length > 0) {
      allBlocks.push(createBlock(colorIndex, color.name, color.hex, noise))
    }
  }

  return allBlocks
}

function createBlock(
  colorIndex: number,
  colorName: string,
  colorHex: string,
  points: Point[],
): FocusBlock {
  const sorted = [...points].sort((a, b) => a.row - b.row || a.col - b.col)
  return {
    id: nextBlockId(),
    colorIndex,
    colorName,
    colorHex,
    cells: sorted.map((p) => ({ row: p.row, col: p.col })),
    status: 'pending',
    markedCells: new Set<string>(),
    startedAt: null,
    completedAt: null,
  }
}
