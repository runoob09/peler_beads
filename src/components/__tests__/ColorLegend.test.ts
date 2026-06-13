import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorLegend from '../ColorLegend.vue'
import type { BeadGrid, PaletteColor } from '../../types'

function makeGrid(colors: PaletteColor[], cells: { row: number; col: number; colorIndex: number }[][]): BeadGrid {
  return { rows: cells.length, cols: cells[0]?.length ?? 0, palette: colors, cells }
}

describe('ColorLegend', () => {
  const palette: PaletteColor[] = [
    { id: 'a', name: 'A01 White', hex: '#FFFFFF', brand: 'test' },
    { id: 'b', name: 'B01 Black', hex: '#000000', brand: 'test' },
    { id: 'c', name: 'C01 Red', hex: '#FF0000', brand: 'test' },
  ]

  it('shows empty state when no grid', () => {
    const wrapper = mount(ColorLegend, { props: { beadGrid: null } })
    expect(wrapper.text()).toContain('上传图片后将显示颜色统计')
  })

  it('renders canvas when grid provided', () => {
    const grid = makeGrid(palette, [
      [{ row: 0, col: 0, colorIndex: 0 }],
    ])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('hides canvas when grid is null', () => {
    const wrapper = mount(ColorLegend, { props: { beadGrid: null } })
    expect(wrapper.find('canvas').exists()).toBe(false)
  })
})
