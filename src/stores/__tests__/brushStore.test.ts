import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBrushStore } from '../brushStore'
import { useBeadStore } from '../beadStore'
import type { BeadGrid, PaletteColor } from '../../types'

function makeTestBeadGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
    { id: 'b', name: 'Black', hex: '#000000', brand: 'test' },
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
  ]
  return {
    rows: 3, cols: 3, palette,
    cells: [
      [
        { row: 0, col: 0, colorIndex: 0 },
        { row: 0, col: 1, colorIndex: 0 },
        { row: 0, col: 2, colorIndex: 1 },
      ],
      [
        { row: 1, col: 0, colorIndex: 0 },
        { row: 1, col: 1, colorIndex: 0 },
        { row: 1, col: 2, colorIndex: 1 },
      ],
      [
        { row: 2, col: 0, colorIndex: 0 },
        { row: 2, col: 1, colorIndex: 0 },
        { row: 2, col: 2, colorIndex: 1 },
      ],
    ],
    imageCols: 3,
    imageRows: 3,
  }
}

describe('brushStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('initial state', () => {
    it('has brushMode false by default', () => {
      const brush = useBrushStore()
      expect(brush.brushMode).toBe(false)
    })

    it('has activeColorIndex null by default', () => {
      const brush = useBrushStore()
      expect(brush.activeColorIndex).toBeNull()
    })

    it('has empty undo and redo stacks', () => {
      const brush = useBrushStore()
      expect(brush.undoStack).toEqual([])
      expect(brush.redoStack).toEqual([])
    })
  })

  describe('toggleBrushMode', () => {
    it('does not allow toggling on when beadGrid is null', () => {
      const brush = useBrushStore()
      brush.toggleBrushMode()
      expect(brush.brushMode).toBe(false)
    })

    it('toggles brushMode when beadGrid is set', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.toggleBrushMode()
      expect(brush.brushMode).toBe(true)
    })

    it('toggles brushMode back to false', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.toggleBrushMode()
      brush.toggleBrushMode()
      expect(brush.brushMode).toBe(false)
    })
  })

  describe('setActiveColor', () => {
    it('sets activeColorIndex', () => {
      const brush = useBrushStore()
      brush.setActiveColor(2)
      expect(brush.activeColorIndex).toBe(2)
    })
  })

  describe('paintCell', () => {
    it('paints a single cell and changes its colorIndex', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2) // Red

      brush.paintCell(0, 0)
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(2)
    })

    it('does nothing when activeColorIndex is null', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()

      brush.paintCell(0, 0)
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(0) // unchanged
    })

    it('does nothing when beadGrid is null', () => {
      const brush = useBrushStore()
      brush.setActiveColor(1)
      expect(() => brush.paintCell(0, 0)).not.toThrow()
    })

    it('does nothing for out-of-bounds cell', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)
      brush.paintCell(999, 999)
      // no throw, no effect
    })
  })

  describe('stroke lifecycle (beginStroke/continueStroke/endStroke)', () => {
    it('records a full stroke as one undo entry', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)

      brush.beginStroke()
      brush.continueStroke(0, 0)
      brush.continueStroke(0, 1)
      brush.continueStroke(0, 2)
      brush.endStroke()

      expect(brush.undoStack.length).toBe(1)
      const entry = brush.undoStack[0]
      expect(entry.cells.length).toBe(3)
    })

    it('deduplicates cells within a stroke', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)

      brush.beginStroke()
      brush.continueStroke(0, 0)
      brush.continueStroke(0, 0)
      brush.continueStroke(0, 0)
      brush.endStroke()

      expect(brush.undoStack[0].cells.length).toBe(1)
    })

    it('does not push empty stroke to undo stack', () => {
      const brush = useBrushStore()
      brush.beginStroke()
      brush.endStroke()
      expect(brush.undoStack.length).toBe(0)
    })

    it('clears redoStack on new stroke', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)

      brush.beginStroke()
      brush.continueStroke(0, 0)
      brush.endStroke()

      brush.undo()
      expect(brush.redoStack.length).toBe(1)

      brush.beginStroke()
      brush.continueStroke(1, 1)
      brush.endStroke()

      expect(brush.redoStack.length).toBe(0)
    })

    it('records oldColorIndex in undo entry', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)

      brush.beginStroke()
      brush.continueStroke(2, 2) // oldColorIndex was 1 (Black)
      brush.endStroke()

      const entry = brush.undoStack[0]
      expect(entry.cells[0].oldColorIndex).toBe(1)
    })
  })

  describe('undo/redo', () => {
    function setup() {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)

      brush.beginStroke()
      brush.continueStroke(0, 0)
      brush.endStroke()

      return { bead, brush }
    }

    it('undo restores old colorIndex', () => {
      const { bead, brush } = setup()
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(2)

      brush.undo()
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(0)
    })

    it('undo moves entry to redoStack', () => {
      const { brush } = setup()
      expect(brush.undoStack.length).toBe(1)
      expect(brush.redoStack.length).toBe(0)

      brush.undo()
      expect(brush.undoStack.length).toBe(0)
      expect(brush.redoStack.length).toBe(1)
    })

    it('redo restores the painted color', () => {
      const { bead, brush } = setup()
      brush.undo()
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(0)

      brush.redo()
      expect(bead.beadGrid!.cells[0][0].colorIndex).toBe(2)
    })

    it('undo does nothing when stack is empty', () => {
      const brush = useBrushStore()
      expect(() => brush.undo()).not.toThrow()
      expect(brush.undoStack.length).toBe(0)
    })

    it('redo does nothing when stack is empty', () => {
      const brush = useBrushStore()
      expect(() => brush.redo()).not.toThrow()
      expect(brush.redoStack.length).toBe(0)
    })
  })

  describe('resetHistory', () => {
    it('clears both undo and redo stacks and exits brush mode', () => {
      const bead = useBeadStore()
      bead.beadGrid = makeTestBeadGrid()
      const brush = useBrushStore()
      brush.setActiveColor(2)

      brush.beginStroke()
      brush.continueStroke(0, 0)
      brush.endStroke()
      brush.undo()

      expect(brush.redoStack.length).toBe(1)

      brush.resetHistory()
      expect(brush.undoStack.length).toBe(0)
      expect(brush.redoStack.length).toBe(0)
      expect(brush.brushMode).toBe(false)
    })

    it('resets activeColorIndex to null', () => {
      const brush = useBrushStore()
      brush.setActiveColor(1)
      brush.resetHistory()
      expect(brush.activeColorIndex).toBeNull()
    })
  })
})
