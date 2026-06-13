import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
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
    const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('shows empty state when no grid', () => {
    const wrapper = mount(BeadPreview, { props: { beadGrid: null, display, progress: 0 } })
    expect(wrapper.text()).toContain('上传图片开始')
  })

  it('shows grid dimension info', () => {
    const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
    expect(wrapper.text()).toContain('2 × 2')
  })

  it('shows tooltip on mousemove inside canvas', async () => {
    const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
    await nextTick()
    const canvas = wrapper.find('canvas')
    // Trigger mousemove at a position inside first cell
    await canvas.trigger('mousemove', { clientX: 30, clientY: 30 })
    const tooltip = wrapper.find('.tooltip')
    expect(tooltip.exists()).toBe(true)
  })

  it('hides tooltip on mouseleave', async () => {
    const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
    await nextTick()
    const canvas = wrapper.find('canvas')
    // First show tooltip
    await canvas.trigger('mousemove', { clientX: 30, clientY: 30 })
    expect(wrapper.find('.tooltip').exists()).toBe(true)
    // Then mouseleave should hide it
    await canvas.trigger('mouseleave')
    expect(wrapper.find('.tooltip').exists()).toBe(false)
  })

  it('shows progress overlay when processing', () => {
    const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 50 } })
    expect(wrapper.find('.progress-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('50%')
  })

  it('hides progress overlay when idle', () => {
    const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
    expect(wrapper.find('.progress-overlay').exists()).toBe(false)
  })

  it('emits cell-click on canvas click', async () => {
    const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
    await nextTick()
    const canvas = wrapper.find('canvas')
    await canvas.trigger('mousemove', { clientX: 30, clientY: 30 })
    await canvas.trigger('click')
    expect(wrapper.emitted('cell-click')).toBeTruthy()
    const cell = wrapper.emitted('cell-click')![0][0] as any
    expect(cell.row).toBe(0)
    expect(cell.col).toBe(0)
  })
})
