import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ColorLegend from '../ColorLegend.vue'
import { useBeadStore } from '../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../types'

function makeTestGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'w', name: 'A01 White', hex: '#FFFFFF', brand: 'test' },
    { id: 'b', name: 'A02 Black', hex: '#000000', brand: 'test' },
  ]
  return {
    rows: 2, cols: 2, palette,
    cells: [
      [{ row: 0, col: 0, colorIndex: 0 }, { row: 0, col: 1, colorIndex: 1 }],
      [{ row: 1, col: 0, colorIndex: 1 }, { row: 1, col: 1, colorIndex: 0 }],
    ],
    imageCols: 2,
    imageRows: 2,
  }
}

describe('ColorLegend', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('is hidden when beadGrid is null', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(ColorLegend, { global: { plugins: [pinia] } })
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('renders when beadGrid is provided', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useBeadStore().beadGrid = makeTestGrid()
    const wrapper = mount(ColorLegend, { global: { plugins: [pinia] } })
    expect(wrapper.find('aside').exists()).toBe(true)
  })

  it('renders canvas', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    useBeadStore().beadGrid = makeTestGrid()
    const wrapper = mount(ColorLegend, { global: { plugins: [pinia] } })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })
})
