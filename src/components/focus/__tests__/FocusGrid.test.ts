import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FocusGrid from '../FocusGrid.vue'
import { useFocusStore } from '../../../stores/focusStore'
import { useBeadStore } from '../../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../../types'

function makeGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    { id: 'b', name: 'Blue', hex: '#0000FF', brand: 'test' },
  ]
  const cells: (number | null)[][] = [
    ...Array.from({ length: 4 }, () => Array.from({ length: 3 }, () => 0)),
    ...Array.from({ length: 4 }, () => Array.from({ length: 3 }, () => 1)),
  ]
  return {
    rows: 8, cols: 3, palette,
    cells: cells.map((row, r) => row.map((colorIndex, c) => ({ row: r, col: c, colorIndex }))),
    imageCols: 3, imageRows: 8,
  }
}

describe('FocusGrid', () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const bead = useBeadStore()
  bead.beadGrid = makeGrid()
  useFocusStore().initFromGrid()

  function mountGrid() {
    return mount(FocusGrid, { global: { plugins: [pinia] } })
  }

  it('renders a canvas element', () => {
    const wrapper = mountGrid()
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('renders focus-grid container', () => {
    const wrapper = mountGrid()
    expect(wrapper.find('.focus-grid').exists()).toBe(true)
  })
})
