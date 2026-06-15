import type { BeadGrid, BeadCell, PaletteColor } from '../types'
import { hexToRgb, rgbToLab, deltaE } from './colorSpace'

// ---- 阶段 1：孤岛清除 ----

/**
 * 通过 flood-fill 找到所有同色连通区域，将面积小于 minIslandSize
 * 的孤岛替换为其边界接触最多的邻色。
 */
export function mergeIslands(grid: BeadGrid, minSize: number): void {
  const { rows, cols, cells } = grid
  const visited = Array.from({ length: rows }, () => new Array(cols).fill(false))

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (visited[r][c] || cells[r][c].colorIndex === null) continue
      const index = cells[r][c].colorIndex!

      // Flood-fill 找到当前同色区域
      const region = floodFill(cells, visited, r, c, index, rows, cols)

      if (region.length >= minSize) continue

      // 孤岛：找边界接触最多的邻色
      const borderColor = dominantBorderColor(cells, region, rows, cols, index)
      if (borderColor === null) continue

      // 替换整个区域
      for (const [rr, cc] of region) {
        cells[rr][cc].colorIndex = borderColor
      }
    }
  }
}

function floodFill(
  cells: BeadCell[][],
  visited: boolean[][],
  startR: number,
  startC: number,
  targetIndex: number,
  rows: number,
  cols: number,
): [number, number][] {
  const region: [number, number][] = []
  const stack: [number, number][] = [[startR, startC]]
  visited[startR][startC] = true

  while (stack.length > 0) {
    const [r, c] = stack.pop()!
    region.push([r, c])

    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      if (visited[nr][nc]) continue
      if (cells[nr][nc].colorIndex !== targetIndex) continue
      visited[nr][nc] = true
      stack.push([nr, nc])
    }
  }

  return region
}

function dominantBorderColor(
  cells: BeadCell[][],
  region: [number, number][],
  rows: number,
  cols: number,
  selfIndex: number,
): number | null {
  const regionSet = new Set(region.map(([r, c]) => `${r},${c}`))
  const counts = new Map<number, number>()

  for (const [r, c] of region) {
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr
      const nc = c + dc
      if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue
      if (regionSet.has(`${nr},${nc}`)) continue
      const neighborIdx = cells[nr][nc].colorIndex
      if (neighborIdx === null || neighborIdx === selfIndex) continue
      counts.set(neighborIdx, (counts.get(neighborIdx) ?? 0) + 1)
    }
  }

  let best: number | null = null
  let bestCount = 0
  for (const [idx, count] of counts) {
    if (count > bestCount) {
      bestCount = count
      best = idx
    }
  }
  return best
}

// ---- 阶段 2：边界合并 ----

interface ColorDistanceCache {
  get(i: number, j: number): number
}

function makeColorCache(palette: PaletteColor[]): ColorDistanceCache {
  const cache = new Map<string, number>()

  // Pre-compute LAB for all palette colors
  const labs = palette.map(c => {
    const [r, g, b] = hexToRgb(c.hex)
    return rgbToLab(r, g, b)
  })

  return {
    get(i: number, j: number): number {
      if (i === j) return 0
      const key = i < j ? `${i},${j}` : `${j},${i}`
      const cached = cache.get(key)
      if (cached !== undefined) return cached
      const d = deltaE(labs[i], labs[j])
      cache.set(key, d)
      return d
    },
  }
}

/**
 * 扫描 4-邻域，用并查集将所有"足够相近"的颜色归为一组，
 * 然后将每组统一为组内最小索引。
 */
export function mergeBoundaries(grid: BeadGrid, threshold: number): void {
  const { rows, cols, cells, palette } = grid
  const n = palette.length
  const parent = Array.from({ length: n }, (_, i) => i)

  function find(x: number): number {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }

  function union(a: number, b: number) {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) {
      // 让索引更小的成为根，保证最终颜色索引最小
      if (ra < rb) parent[rb] = ra
      else parent[ra] = rb
    }
  }

  const distCache = makeColorCache(palette)

  // 扫描每个格子的 4-邻域
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = cells[r][c].colorIndex
      if (idx === null) continue

      // 只检查右和下（避免重复检查）
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const nr = r + dr
        const nc = c + dc
        if (nr >= rows || nc >= cols) continue
        const nidx = cells[nr][nc].colorIndex
        if (nidx === null || nidx === idx) continue

        if (distCache.get(idx, nidx) < threshold) {
          union(idx, nidx)
        }
      }
    }
  }

  // 批量替换
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = cells[r][c].colorIndex
      if (idx === null) continue
      cells[r][c].colorIndex = find(idx)
    }
  }
}

/**
 * 后处理入口：先清除孤岛，再合并边界相近色。
 */
export function postProcess(grid: BeadGrid, minIslandSize: number, mergeThreshold: number): void {
  if (minIslandSize > 1) {
    mergeIslands(grid, minIslandSize)
  }
  if (mergeThreshold > 0) {
    mergeBoundaries(grid, mergeThreshold)
  }
}
