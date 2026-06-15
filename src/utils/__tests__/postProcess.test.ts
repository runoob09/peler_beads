import { describe, it, expect } from 'vitest'
import { postProcess } from '../postProcess'
import type { BeadGrid, PaletteColor } from '../../types'

function makePalette(colors: string[]): PaletteColor[] {
  return colors.map((hex, i) => ({ id: String(i), name: hex, hex, brand: 'test' }))
}

function makeGrid(palette: PaletteColor[], matrix: (number | null)[][]): BeadGrid {
  const rows = matrix.length
  const cols = matrix[0].length
  const cells = matrix.map((row, r) =>
    row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
  )
  return { rows, cols, cells, palette, imageCols: cols, imageRows: rows }
}

describe('postProcess', () => {
  it('merges similar colors, minority replaced by majority', () => {
    // #FF0000 and #FE0100 are nearly identical
    // Red (#FF0000) appears 6 times, NearRed (#FE0100) appears 3 times
    const grid = makeGrid(makePalette(['#FF0000', '#FE0100', '#0000FF']), [
      [0, 0, 0],
      [1, 1, 0],
      [0, 0, 1],
    ])
    postProcess(grid, 5)
    // NearRed (index 1) should merge into Red (index 0) which is more frequent
    const all = grid.cells.flat().map(c => c.colorIndex)
    expect(all.filter(c => c === 1).length).toBe(0) // no more NearRed
    expect(all.filter(c => c === 0).length).toBe(9) // all became Red
  })

  it('does not merge dissimilar colors', () => {
    const grid = makeGrid(makePalette(['#000000', '#FFFFFF']), [
      [0, 1],
      [1, 0],
    ])
    postProcess(grid, 5)
    // Black and white are far apart, should not merge
    expect(grid.cells[0][0].colorIndex).toBe(0)
    expect(grid.cells[0][1].colorIndex).toBe(1)
  })

  it('minority merges into majority when frequencies differ', () => {
    // Two near-reds, one appears more
    const grid = makeGrid(makePalette(['#FF0000', '#FE0100']), [
      [0, 0, 1],
      [0, 0, 1],
    ])
    postProcess(grid, 5)
    // 0 appears 4 times, 1 appears 2 times → 1 merges into 0
    const all = grid.cells.flat().map(c => c.colorIndex)
    expect(new Set(all)).toEqual(new Set([0]))
  })

  it('handles null cells without crash', () => {
    const grid = makeGrid(makePalette(['#FF0000', '#FE0100']), [
      [0, null, 1],
      [1, 0, 0],
    ])
    expect(() => postProcess(grid, 5)).not.toThrow()
  })

  it('is no-op when threshold is 0', () => {
    const grid = makeGrid(makePalette(['#FF0000', '#FE0100']), [
      [0, 1],
      [1, 0],
    ])
    postProcess(grid, 0)
    expect(grid.cells[0][0].colorIndex).toBe(0)
    expect(grid.cells[0][1].colorIndex).toBe(1)
  })

  it('handles single-color palette', () => {
    const grid = makeGrid(makePalette(['#FF0000']), [[0, 0], [0, 0]])
    expect(() => postProcess(grid, 5)).not.toThrow()
  })
})
