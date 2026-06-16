import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FocusColorBar from '../FocusColorBar.vue'
import { useFocusStore } from '../../../stores/focusStore'
import { useBeadStore } from '../../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../../types'

function makeGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    { id: 'b', name: 'Blue', hex: '#0000FF', brand: 'test' },
  ]
  const cells: (number | null)[][] = Array.from({ length: 6 }, (_, r) =>
    Array.from({ length: 6 }, (_1, _c) => (r < 4 ? 0 : 1)),
  )
  return {
    rows: 6, cols: 6, palette,
    cells: cells.map((row, r) =>
      row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
    ),
    imageCols: 6, imageRows: 6,
  }
}

describe('FocusColorBar', () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const bead = useBeadStore()
  bead.beadGrid = makeGrid()
  useFocusStore().initFromGrid()

  it('displays current color code', () => {
    const wrapper = mount(FocusColorBar, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('Red')
  })

  it('displays block progress like "1 / N"', () => {
    const wrapper = mount(FocusColorBar, { global: { plugins: [pinia] } })
    const text = wrapper.text()
    expect(text).toMatch(/\d+\s*\/\s*\d+/)
  })
})
