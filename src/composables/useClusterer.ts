import type { BeadGrid, FocusBlock } from '../types'

interface Point {
  row: number
  col: number
  clusterId: number // 0 = unvisited, -1 = noise
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
  let clusterId = 0
  for (const p of points) {
    if (p.clusterId !== 0) continue
    const neighbors = points.filter((q) => manhattan(p, q) <= eps && q !== p)
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
      const qNeighbors = points.filter(
        (r) => manhattan(q, r) <= eps && r !== q,
      )
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
