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

  describe('zoom', () => {
    it('shows zoom indicator at 100% by default', () => {
      const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
      expect(wrapper.find('.zoom-indicator').exists()).toBe(true)
      expect(wrapper.find('.zoom-indicator').text()).toContain('100%')
    })

    it('increases zoom on ctrl+wheel up', async () => {
      const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('wheel', { deltaY: -100, ctrlKey: true })
      expect(wrapper.find('.zoom-indicator').text()).not.toBe('100%')
    })

    it('decreases zoom on ctrl+wheel down', async () => {
      const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('wheel', { deltaY: 100, ctrlKey: true })
      const text = wrapper.find('.zoom-indicator').text()
      // zoom should be less than 100
      const pct = parseInt(text)
      expect(pct).toBeLessThan(100)
    })

    it('clamps zoom to minimum 25%', async () => {
      const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
      await nextTick()
      const canvas = wrapper.find('canvas')
      for (let i = 0; i < 50; i++) {
        await canvas.trigger('wheel', { deltaY: 100, ctrlKey: true })
      }
      const pct = parseInt(wrapper.find('.zoom-indicator').text())
      expect(pct).toBeGreaterThanOrEqual(25)
    })

    it('clamps zoom to maximum 400%', async () => {
      const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
      await nextTick()
      const canvas = wrapper.find('canvas')
      for (let i = 0; i < 50; i++) {
        await canvas.trigger('wheel', { deltaY: -100, ctrlKey: true })
      }
      const pct = parseInt(wrapper.find('.zoom-indicator').text())
      expect(pct).toBeLessThanOrEqual(400)
    })

    it('does not zoom on wheel without ctrl', async () => {
      const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('wheel', { deltaY: -100, ctrlKey: false })
      expect(wrapper.find('.zoom-indicator').text()).toBe('100%')
    })
  })

  describe('pan', () => {
    it('pans canvas on mousedown + mousemove', async () => {
      const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('mousedown', { clientX: 100, clientY: 100 })
      await canvas.trigger('mousemove', { clientX: 150, clientY: 130 })
      // After drag, transform should not be at origin
      const previewWrap = wrapper.find('.preview-canvas-wrap')
      const style = previewWrap.attributes('style')
      expect(style).toBeDefined()
      expect(style).toContain('translate')
    })

    it('stops panning on mouseup', async () => {
      const wrapper = mount(BeadPreview, { props: { beadGrid: makeTestGrid(), display, progress: 0 } })
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('mousedown', { clientX: 100, clientY: 100 })
      await canvas.trigger('mousemove', { clientX: 150, clientY: 130 })
      await canvas.trigger('mouseup')
      const posBefore = wrapper.find('.preview-canvas-wrap').attributes('style')
      // further mousemove should not change position
      await canvas.trigger('mousemove', { clientX: 200, clientY: 200 })
      expect(wrapper.find('.preview-canvas-wrap').attributes('style')).toBe(posBefore)
    })
  })
})
