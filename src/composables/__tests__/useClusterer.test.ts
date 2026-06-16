import { describe, it, expect } from 'vitest'
import { clusterGrid } from '../useClusterer'
import type { BeadGrid, PaletteColor } from '../../types'

function makeGrid(
  rows: number,
  cols: number,
  cells: (number | null)[][],
): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    { id: 'b', name: 'Blue', hex: '#0000FF', brand: 'test' },
  ]
  return {
    rows,
    cols,
    palette,
    cells: cells.map((row, r) =>
      row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
    ),
    imageCols: cols,
    imageRows: rows,
  }
}

describe('clusterGrid', () => {
  it('returns empty array for empty/null grid', () => {
    const grid = makeGrid(0, 0, [])
    expect(clusterGrid(grid)).toEqual([])
  })

  it('returns empty array when all cells are null', () => {
    const grid = makeGrid(2, 2, [
      [null, null],
      [null, null],
    ])
    expect(clusterGrid(grid)).toEqual([])
  })

  it('clusters a single continuous color region into blocks', () => {
    const cells = Array.from({ length: 5 }, () => Array(20).fill(0))
    const grid = makeGrid(5, 20, cells)
    const blocks = clusterGrid(grid)
    expect(blocks.length).toBeGreaterThanOrEqual(1)
    expect(blocks.every((b) => b.colorIndex === 0)).toBe(true)
  })

  it('splits a single color across disconnected regions into separate blocks', () => {
    const cells: (number | null)[][] = Array.from({ length: 8 }, () =>
      Array(20).fill(null),
    )
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        cells[r][c] = 0
        cells[r][c + 16] = 0
      }
    }
    const grid = makeGrid(8, 20, cells)
    const redBlocks = clusterGrid(grid).filter((b) => b.colorIndex === 0)
    expect(redBlocks.length).toBe(2)
  })

  it('sorts colors by total cell count ascending (fewer first)', () => {
    const cells: (number | null)[][] = Array.from({ length: 8 }, () =>
      Array(5).fill(null),
    )
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        cells[r][c] = 1 // Blue
      }
    }
    for (let r = 2; r < 8; r++) {
      for (let c = 0; c < 5; c++) {
        cells[r][c] = 0 // Red
      }
    }
    const grid = makeGrid(8, 5, cells)
    const blocks = clusterGrid(grid)
    expect(blocks[0].colorIndex).toBe(1) // Blue (fewer) first
  })

  it('groups isolated cells (< minPts) into one 零星块 per color', () => {
    const cells: (number | null)[][] = Array.from({ length: 5 }, () =>
      Array(5).fill(null),
    )
    cells[0][0] = 0
    cells[4][4] = 0
    const grid = makeGrid(5, 5, cells)
    const blocks = clusterGrid(grid)
    expect(blocks.length).toBe(1)
    expect(blocks[0].cells.length).toBe(2)
  })

  it('handles 10-cell threshold exactly', () => {
    const cells: (number | null)[][] = Array.from({ length: 5 }, () =>
      Array(5).fill(null),
    )
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 5; c++) {
        cells[r][c] = 0 // 10 cells
      }
    }
    const grid = makeGrid(5, 5, cells)
    const blocks = clusterGrid(grid)
    expect(blocks.length).toBe(1)
  })

  it('handles 9-cell region as 零星块', () => {
    const cells: (number | null)[][] = Array.from({ length: 5 }, () =>
      Array(5).fill(null),
    )
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        cells[r][c] = 0 // 9 cells < 10
      }
    }
    const grid = makeGrid(5, 5, cells)
    const blocks = clusterGrid(grid)
    expect(blocks.length).toBe(1)
    expect(blocks[0].cells.length).toBe(9)
  })

  it('assigns unique IDs to each block', () => {
    const cells = Array.from({ length: 10 }, () => Array(10).fill(0))
    for (let r = 0; r < 10; r++) {
      cells[r][4] = null
      cells[r][5] = null
    }
    const grid = makeGrid(10, 10, cells)
    const blocks = clusterGrid(grid)
    expect(blocks.length).toBe(2)
    expect(blocks[0].id).not.toBe(blocks[1].id)
  })
})
