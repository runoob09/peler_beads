import type { BeadGrid } from '../types'
import { hexToRgb, rgbToLab, deltaE } from './colorSpace'

/**
 * 全局频率合并：
 * 1. 统计每种颜色在 grid 中出现的次数
 * 2. 对所有颜色对，若 ΔE < threshold 则 union
 * 3. union 时出现次数多的成为根（少数服从多数）
 * 4. 批量替换 grid 中所有颜色为根索引
 */
export function postProcess(grid: BeadGrid, mergeThreshold: number): void {
  const { cells, palette } = grid
  const n = palette.length
  if (n <= 1 || mergeThreshold <= 0) return

  // 1. 统计每种颜色的出现次数
  const counts = new Array<number>(n).fill(0)
  for (const row of cells) {
    for (const cell of row) {
      if (cell.colorIndex !== null) {
        counts[cell.colorIndex]++
      }
    }
  }

  // 2. 并查集初始化
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
    if (ra === rb) return
    // 出现次数多的成为根
    if (counts[ra] >= counts[rb]) {
      parent[rb] = ra
    } else {
      parent[ra] = rb
    }
  }

  // 3. 预计算 LAB + 比较合并
  const labs = palette.map(c => {
    const [r, g, b] = hexToRgb(c.hex)
    return rgbToLab(r, g, b)
  })

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (deltaE(labs[i], labs[j]) < mergeThreshold) {
        union(i, j)
      }
    }
  }

  // 4. 批量替换
  for (const row of cells) {
    for (const cell of row) {
      if (cell.colorIndex !== null) {
        cell.colorIndex = find(cell.colorIndex)
      }
    }
  }
}
