import { describe, it, expect } from 'vitest'
import { mergeIslands, mergeBoundaries, postProcess } from '../postProcess'
import type { BeadGrid, PaletteColor } from '../../types'

function makePalette(colors: string[]): PaletteColor[] {
  return colors.map((hex, i) => ({ id: String(i), name: hex, hex, brand: 'test' }))
}

function makeGrid(palette: PaletteColor[], matrix: (number | null)[][]): BeadGrid {
  const rows = matrix.length
  const cols = matrix[0].length
  const cells = matrix.map((row, r) =>
    row.map((colorIndex, c) => ({ row: r, col: c, colorIndex }))
  )
  return { rows, cols, cells, palette, imageCols: cols, imageRows: rows }
}

describe('mergeIslands', () => {
  it('removes isolated single-cell island', () => {
    const grid = makeGrid(makePalette(['#FF0000', '#0000FF']), [
      [1, 1, 1],
      [1, 0, 1],  // red cell surrounded by blue
      [1, 1, 1],
    ])
    mergeIslands(grid, 3)
    // The lone red cell (area 1) should be replaced by blue (dominant border color)
    expect(grid.cells[1][1].colorIndex).toBe(1)
  })

  it('keeps regions larger than or equal to minSize', () => {
    const grid = makeGrid(makePalette(['#FF0000', '#0000FF']), [
      [0, 0, 1],
      [0, 0, 1],
      [1, 1, 1],
    ])
    mergeIslands(grid, 3)
    // The 2x2 red region (area 4) should survive
    expect(grid.cells[0][0].colorIndex).toBe(0)
    expect(grid.cells[1][1].colorIndex).toBe(0)
  })

  it('handles null cells without crash', () => {
    const grid = makeGrid(makePalette(['#FF0000']), [
      [0, 0, 0],
      [0, null, 0],
      [0, 0, 0],
    ])
    expect(() => mergeIslands(grid, 3)).not.toThrow()
  })
})

describe('mergeBoundaries', () => {
  it('merges very similar colors', () => {
    // Two near-identical reds
    const grid = makeGrid(makePalette(['#FF0000', '#FE0100']), [
      [0, 0, 1],
      [0, 1, 1],
      [1, 1, 1],
    ])
    mergeBoundaries(grid, 5)
    // After merge, all should be unified to the smaller index (0)
    const all = grid.cells.flat().map(c => c.colorIndex)
    expect(new Set(all)).toEqual(new Set([0]))
  })

  it('keeps dissimilar colors separate', () => {
    const grid = makeGrid(makePalette(['#000000', '#FFFFFF']), [
      [0, 1],
      [1, 0],
    ])
    mergeBoundaries(grid, 5)
    // Black and white should NOT merge
    expect(grid.cells[0][0].colorIndex).toBe(0)
    expect(grid.cells[0][1].colorIndex).toBe(1)
  })

  it('handles null cells', () => {
    const grid = makeGrid(makePalette(['#FF0000', '#FE0100']), [
      [0, null, 1],
      [0, 0, 1],
    ])
    expect(() => mergeBoundaries(grid, 5)).not.toThrow()
  })
})

describe('postProcess', () => {
  it('applies both phases', () => {
    const grid = makeGrid(makePalette(['#FF0000', '#FE0100', '#0000FF']), [
      [2, 2, 2, 2],
      [2, 0, 0, 2],  // small red area surrounded by blue
      [2, 0, 1, 2],  // near-red cell adjacent to red
      [2, 2, 2, 2],
    ])
    postProcess(grid, 3, 5)
    // After processing: island cleared, similar colors merged
    // Everything should become blue (2) since reds are island and merged
    // Actually: red region(0,0) area 3 < 3? No, area >= minIslandSize=3, so not island
    // But red+similar-red (indices 0,1) get merged via union-find
    // Then red area (now merged 0+1) borders blue(2) - are they similar? #FF0000 vs #0000FF: deltaE ~50 > 5, no
    // So: island NOT cleared (area=4 >= 3), but 0 and 1 merge to 0
    // Result: blues stay blue, reds merge to one red index
    expect(grid.cells[1][1].colorIndex).toBe(0)
    expect(grid.cells[2][2].colorIndex).toBe(0) // was 1, merged to 0
    expect(grid.cells[0][0].colorIndex).toBe(2) // blue stays blue
  })

  it('is no-op when thresholds are disabled', () => {
    const grid = makeGrid(makePalette(['#FF0000', '#0000FF']), [
      [0, 1],
      [1, 0],
    ])
    const snapshot = grid.cells[0][0].colorIndex
    postProcess(grid, 1, 0) // minIslandSize=1 = no-op, mergeThreshold=0 = no-op
    expect(grid.cells[0][0].colorIndex).toBe(snapshot)
  })
})
