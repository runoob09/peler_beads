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

  it('shows color count when grid provided', () => {
    const grid = makeGrid(palette, [
      [{ row: 0, col: 0, colorIndex: 0 }, { row: 0, col: 1, colorIndex: 0 }],
      [{ row: 1, col: 0, colorIndex: 1 }, { row: 1, col: 1, colorIndex: 0 }],
    ])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    expect(wrapper.text()).toContain('A01')
    expect(wrapper.text()).toContain('B01')
  })

  it('shows total bead count', () => {
    const grid = makeGrid(palette, [
      [{ row: 0, col: 0, colorIndex: 0 }],
      [{ row: 1, col: 0, colorIndex: 0 }],
    ])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    expect(wrapper.text()).toContain('2')
  })

  it('sorts by count descending', () => {
    const grid = makeGrid(palette, [
      [{ row: 0, col: 0, colorIndex: 0 }, { row: 0, col: 1, colorIndex: 0 }, { row: 0, col: 2, colorIndex: 1 }],
    ])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    // A (index 0) has 2, B (index 1) has 1 → A should be first
    const items = wrapper.findAll('.legend-item')
    expect(items[0].text()).toContain('A01')
    expect(items[1].text()).toContain('B01')
    // C (index 2) has 0, should not appear
    expect(wrapper.text()).not.toContain('C01')
  })
})
