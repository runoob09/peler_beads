import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BeadPreview from '../BeadPreview.vue'
import type { BeadGrid, PaletteColor } from '../../types'

function makeTestGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'w', name: 'White', hex: '#FFFFFF', brand: 'test' },
    { id: 'b', name: 'Black', hex: '#000000', brand: 'test' },
  ]
  return {
    rows: 2, cols: 2, palette,
    cells: [
      [{ row: 0, col: 0, colorIndex: 0 }, { row: 0, col: 1, colorIndex: 1 }],
      [{ row: 1, col: 0, colorIndex: 1 }, { row: 1, col: 1, colorIndex: 0 }],
    ],
  }
}

const display = {
  showGrid: true, gridLineColor: '#ccc', gridLineWidth: 1,
  boldGridInterval: 10, boldGridColor: '#000', boldGridWidth: 2,
  renderMode: 'color' as const,
}

describe('BeadPreview', () => {
  it('renders canvas element when grid is provided', () => {
    const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display } })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('shows empty state when no grid', () => {
    const wrapper = mount(BeadPreview, { props: { beadGrid: null, display } })
    expect(wrapper.text()).toContain('上传图片开始')
  })

  it('shows grid dimension info', () => {
    const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display } })
    expect(wrapper.text()).toContain('2 × 2')
  })
})
