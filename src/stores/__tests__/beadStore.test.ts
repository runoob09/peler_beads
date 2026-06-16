import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBeadStore } from '../beadStore'
import type { PaletteColor } from '../../types'

describe('beadStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('initializes with null beadGrid', () => {
    const store = useBeadStore()
    expect(store.beadGrid).toBeNull()
  })

  it('returns settings with defaults', () => {
    const store = useBeadStore()
    expect(store.settings.gridCols).toBe(29)
    expect(store.settings.gridRows).toBe(29)
    expect(store.settings.colorCalcMethod).toBe('dominant')
    expect(store.settings.colorMatchMethod).toBe('ciede2000')
  })

  it('initializes progress to 0', () => {
    const store = useBeadStore()
    expect(store.progress).toBe(0)
  })

  it('initializes error to null', () => {
    const store = useBeadStore()
    expect(store.error).toBeNull()
  })

  it('does not process without image file', async () => {
    const store = useBeadStore()
    const palette: PaletteColor[] = []
    await store.process(null as any, palette)
    expect(store.beadGrid).toBeNull()
  })

  describe('initEmptyGrid', () => {
    it('creates a beadGrid with all null cells', () => {
      const store = useBeadStore()
      const palette: PaletteColor[] = [
        { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
        { id: 'b', name: 'Black', hex: '#000000', brand: 'test' },
      ]
      store.initEmptyGrid(5, 3, palette)
      const grid = store.beadGrid
      expect(grid).not.toBeNull()
      expect(grid!.rows).toBe(5)
      expect(grid!.cols).toBe(3)
      expect(grid!.cells.length).toBe(5)
      expect(grid!.cells[0].length).toBe(3)
      expect(grid!.imageCols).toBe(3)
      expect(grid!.imageRows).toBe(5)
      for (const row of grid!.cells) {
        for (const cell of row) {
          expect(cell.colorIndex).toBeNull()
        }
      }
    })

    it('sets palette on the grid', () => {
      const store = useBeadStore()
      const palette: PaletteColor[] = [
        { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
      ]
      store.initEmptyGrid(2, 2, palette)
      expect(store.beadGrid!.palette).toEqual(palette)
    })

    it('resets progress and error', () => {
      const store = useBeadStore()
      store.progress = 50
      store.error = 'some error'
      store.initEmptyGrid(2, 2, [])
      expect(store.progress).toBe(0)
      expect(store.error).toBeNull()
    })
  })
})
