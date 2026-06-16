import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useFocusStore } from '../focusStore'
import { useBeadStore } from '../beadStore'
import type { BeadGrid, PaletteColor } from '../../types'

function makeGrid(cells: (number | null)[][]): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    { id: 'b', name: 'Blue', hex: '#0000FF', brand: 'test' },
  ]
  return {
    rows: cells.length,
    cols: cells[0].length,
    palette,
    cells: cells.map((row, r) =>
      row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
    ),
    imageCols: cells[0].length,
    imageRows: cells.length,
  }
}

function makeSimpleGrid(): BeadGrid {
  // 8x8: top half Red, bottom half Blue
  const cells: (number | null)[][] = []
  for (let r = 0; r < 8; r++) {
    cells.push(Array(8).fill(r < 4 ? 0 : 1))
  }
  return makeGrid(cells)
}

describe('focusStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem('perler-beads:focus-progress')
  })

  describe('initFromGrid', () => {
    it('initializes blocks from beadGrid', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()
      expect(focus.blocks.length).toBeGreaterThan(0)
    })

    it('sets currentBlockIndex to 0', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()
      expect(focus.currentBlockIndex).toBe(0)
    })

    it('activates the first block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()
      expect(focus.blocks[0].status).toBe('active')
    })
  })

  describe('markCell', () => {
    it('adds cell to markedCells', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.markCell(0, 0)
      expect(focus.currentBlock!.markedCells.has('0,0')).toBe(true)
    })

    it('toggles cell off when marked again', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.markCell(0, 0)
      focus.markCell(0, 0)
      expect(focus.currentBlock!.markedCells.has('0,0')).toBe(false)
    })

    it('ignores cells not in current block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      const currentColor = focus.currentBlock!.colorIndex
      const otherColor = currentColor === 0 ? 1 : 0
      const grid = bead.beadGrid!
      for (let r = 0; r < grid.rows; r++) {
        for (let c = 0; c < grid.cols; c++) {
          if (grid.cells[r][c].colorIndex === otherColor) {
            focus.markCell(r, c)
            expect(focus.currentBlock!.markedCells.has(`${r},${c}`)).toBe(false)
            return
          }
        }
      }
    })
  })

  describe('completeBlock', () => {
    it('marks current block as completed and advances', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.completeBlock()
      expect(focus.blocks[0].status).toBe('completed')
      expect(focus.blocks[0].completedAt).not.toBeNull()
      expect(focus.currentBlockIndex).toBe(1)
      expect(focus.blocks[1].status).toBe('active')
    })

    it('does nothing when all blocks completed', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      const total = focus.blocks.length
      for (let i = 0; i < total; i++) {
        focus.completeBlock()
      }
      expect(focus.currentBlockIndex).toBeLessThan(total)
      // No crash on extra completeBlock
      expect(() => focus.completeBlock()).not.toThrow()
    })
  })

  describe('prevBlock / nextBlock', () => {
    it('prevBlock goes to previous block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.completeBlock()
      focus.prevBlock() // back to block 0
      expect(focus.currentBlockIndex).toBe(0)
    })

    it('prevBlock does nothing on first block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()
      focus.prevBlock()
      expect(focus.currentBlockIndex).toBe(0)
    })

    it('nextBlock advances', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()
      focus.nextBlock()
      expect(focus.currentBlockIndex).toBe(1)
    })

    it('nextBlock does nothing on last block', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()
      const lastIdx = focus.blocks.length - 1
      focus.currentBlockIndex = lastIdx
      focus.nextBlock()
      expect(focus.currentBlockIndex).toBe(lastIdx)
    })
  })

  describe('progress', () => {
    it('calculates progress as completed / total * 100', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      expect(focus.progress).toBe(0)
      focus.completeBlock()
      const expectedPct = (1 / focus.blocks.length) * 100
      expect(focus.progress).toBeCloseTo(expectedPct, 1)
    })
  })

  describe('reset', () => {
    it('clears all state', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.markCell(0, 0)
      focus.completeBlock()
      focus.reset()
      expect(focus.blocks.length).toBe(0)
      expect(focus.currentBlockIndex).toBe(0)
      expect(focus.totalElapsed).toBe(0)
    })
  })

  describe('persistence', () => {
    it('saves progress to localStorage after markCell', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      focus.markCell(0, 0)
      focus._flushSave()
      const saved = localStorage.getItem('perler-beads:focus-progress')
      expect(saved).not.toBeNull()
      const parsed = JSON.parse(saved!)
      expect(parsed.blocks[0].markedCells).toContainEqual([0, 0])
    })

    it('restores progress from localStorage on initFromGrid', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus1 = useFocusStore()
      focus1.initFromGrid()
      focus1.markCell(2, 2)
      focus1._flushSave()

      const focus2 = useFocusStore()
      focus2.initFromGrid()
      expect(focus2.blocks[0].markedCells.has('2,2')).toBe(true)
    })

    it('discards saved progress when grid fingerprint does not match', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus1 = useFocusStore()
      focus1.initFromGrid()
      focus1.markCell(0, 0)
      focus1._flushSave()

      bead.beadGrid = makeGrid([
        [0, 1],
        [1, 0],
      ])
      const focus2 = useFocusStore()
      focus2.initFromGrid()
      expect(focus2.blocks.length).toBeGreaterThan(0)
      expect(focus2.blocks[0].markedCells.size).toBe(0)
    })

    it('clears localStorage when all blocks completed', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeSimpleGrid()
      const focus = useFocusStore()
      focus.initFromGrid()

      const total = focus.blocks.length
      for (let i = 0; i < total; i++) {
        focus.completeBlock()
      }
      focus._flushSave()
      expect(localStorage.getItem('perler-beads:focus-progress')).toBeNull()
    })
  })
})
