import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorLegend from '../ColorLegend.vue'
import type { BeadGrid, PaletteColor } from '../../types'

function makeGrid(colors: PaletteColor[], cells: { row: number; col: number; colorIndex: number }[][]): BeadGrid {
  return { rows: cells.length, cols: cells[0]?.length ?? 0, palette: colors, cells }
}

const palette: PaletteColor[] = [
  { id: 'a', name: 'A01 White', hex: '#FFFFFF', brand: 'test' },
  { id: 'b', name: 'B01 Black', hex: '#000000', brand: 'test' },
]

describe('ColorLegend', () => {
  it('does not render when beadGrid is null', () => {
    const wrapper = mount(ColorLegend, { props: { beadGrid: null } })
    expect(wrapper.find('aside').exists()).toBe(false)
  })

  it('renders when beadGrid is provided', () => {
    const grid = makeGrid(palette, [
      [{ row: 0, col: 0, colorIndex: 0 }],
    ])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    expect(wrapper.find('aside').exists()).toBe(true)
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('shows drag handle', () => {
    const grid = makeGrid(palette, [
      [{ row: 0, col: 0, colorIndex: 0 }],
    ])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    expect(wrapper.find('.drag-handle').exists()).toBe(true)
  })
})
