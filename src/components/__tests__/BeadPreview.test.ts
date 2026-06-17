import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import BeadPreview from '../BeadPreview.vue'
import { useBeadStore } from '../../stores/beadStore'
import { useBrushStore } from '../../stores/brushStore'
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
    imageCols: 2,
    imageRows: 2,
  }
}

function setup() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const beadStore = useBeadStore()
  const brushStore = useBrushStore()
  beadStore.beadGrid = makeTestGrid()
  return { pinia, beadStore, brushStore }
}

function mountWithGrid() {
  const { pinia } = setup()
  return mount(BeadPreview, { global: { plugins: [pinia] } })
}

describe('BeadPreview', () => {
  it('renders canvas element when grid is provided', () => {
    const wrapper = mountWithGrid()
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('renders nothing when no grid', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(BeadPreview, { global: { plugins: [pinia] } })
    expect(wrapper.find('canvas').exists()).toBe(false)
    expect(wrapper.find('.grid-info').exists()).toBe(false)
  })

  it('shows tooltip on mousemove inside canvas', async () => {
    const wrapper = mountWithGrid()
    await nextTick()
    const canvas = wrapper.find('canvas')
    // Trigger mousemove at a position inside first cell
    await canvas.trigger('mousemove', { clientX: 30, clientY: 30 })
    const tooltip = wrapper.find('.tooltip')
    expect(tooltip.exists()).toBe(true)
  })

  it('hides tooltip on mouseleave', async () => {
    const wrapper = mountWithGrid()
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
    const pinia = createPinia()
    setActivePinia(pinia)
    useBeadStore().beadGrid = makeTestGrid()
    useBeadStore().progress = 50
    const wrapper = mount(BeadPreview, { global: { plugins: [pinia] } })
    expect(wrapper.find('.progress-overlay').exists()).toBe(true)
    expect(wrapper.text()).toContain('50%')
  })

  it('hides progress overlay when idle', () => {
    const wrapper = mountWithGrid()
    expect(wrapper.find('.progress-overlay').exists()).toBe(false)
  })

  describe('zoom', () => {
    it('has default transform scale (no zoom)', () => {
      const wrapper = mountWithGrid()
      const wrap = wrapper.find('.preview-canvas-wrap')
      expect(wrap.attributes('style')).toContain('scale(1)')
    })

    it('increases zoom on ctrl+wheel up', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('wheel', { deltaY: -100, ctrlKey: true })
      const style = wrapper.find('.preview-canvas-wrap').attributes('style')
      expect(style).not.toContain('scale(1)')
    })

    it('decreases zoom on ctrl+wheel down', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('wheel', { deltaY: 100, ctrlKey: true })
      const style = wrapper.find('.preview-canvas-wrap').attributes('style')
      const scaleMatch = style?.match(/scale\(([\d.]+)\)/)
      expect(scaleMatch).not.toBeNull()
      expect(parseFloat(scaleMatch![1])).toBeLessThan(1)
    })

    it('clamps zoom to minimum 25%', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      for (let i = 0; i < 50; i++) {
        await canvas.trigger('wheel', { deltaY: 100, ctrlKey: true })
      }
      const style = wrapper.find('.preview-canvas-wrap').attributes('style')
      const scaleMatch = style?.match(/scale\(([\d.]+)\)/)
      expect(scaleMatch).not.toBeNull()
      expect(parseFloat(scaleMatch![1]) * 100).toBeGreaterThanOrEqual(25)
    })

    it('clamps zoom to maximum 400%', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      for (let i = 0; i < 50; i++) {
        await canvas.trigger('wheel', { deltaY: -100, ctrlKey: true })
      }
      const style = wrapper.find('.preview-canvas-wrap').attributes('style')
      const scaleMatch = style?.match(/scale\(([\d.]+)\)/)
      expect(scaleMatch).not.toBeNull()
      expect(parseFloat(scaleMatch![1]) * 100).toBeLessThanOrEqual(400)
    })

    it('does not zoom on wheel without ctrl', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('wheel', { deltaY: -100, ctrlKey: false })
      expect(wrapper.find('.preview-canvas-wrap').attributes('style')).toContain('scale(1)')
    })
  })

  describe('pan', () => {
    it('pans canvas on mousedown + mousemove', async () => {
      const wrapper = mountWithGrid()
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
      const wrapper = mountWithGrid()
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

  describe('brush mode', () => {
    it('shows crosshair cursor in brush mode', async () => {
      const { pinia, brushStore } = setup()
      brushStore.brushMode = true
      const wrapper = mount(BeadPreview, { global: { plugins: [pinia] } })
      await nextTick()
      const canvas = wrapper.find('canvas')
      expect(canvas.attributes('style')).toContain('crosshair')
    })

    it('shows default cursor when not in brush mode', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      expect(canvas.attributes('style')).toContain('default')
    })

    it('paints cells on mousedown+mousemove in brush mode', async () => {
      const { pinia, brushStore, beadStore } = setup()
      brushStore.brushMode = true
      brushStore.activeColorIndex = 1 // Black
      const wrapper = mount(BeadPreview, { global: { plugins: [pinia] } })
      await nextTick()

      const canvas = wrapper.find('canvas')
      // mousedown starts painting at cell (0,0)
      await canvas.trigger('mousedown', { clientX: 10, clientY: 10 })
      // mousemove continues painting
      await canvas.trigger('mousemove', { clientX: 100, clientY: 10 })

      // End stroke via document mouseup
      document.dispatchEvent(new MouseEvent('mouseup'))

      const grid = beadStore.beadGrid!
      // First cell should be painted to Black (index 1)
      expect(grid.cells[0][0].colorIndex).toBe(1)
    })

    it('does not pan in brush mode', async () => {
      const { pinia, brushStore } = setup()
      brushStore.brushMode = true
      brushStore.activeColorIndex = 1
      const wrapper = mount(BeadPreview, { global: { plugins: [pinia] } })
      await nextTick()

      const canvas = wrapper.find('canvas')
      await canvas.trigger('mousedown', { clientX: 10, clientY: 10 })
      // document mousemove (for pan) should not move canvas in brush mode
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 100, clientY: 100 }))

      const previewWrap = wrapper.find('.preview-canvas-wrap')
      const style = previewWrap.attributes('style')
      expect(style).toContain('translate(0px, 0px)')
    })

    it('pans normally in non-brush mode', async () => {
      const wrapper = mountWithGrid()
      await nextTick()
      const canvas = wrapper.find('canvas')
      await canvas.trigger('mousedown', { clientX: 100, clientY: 100 })
      // Dispatch mousemove on document so the document-level onPanMove listener fires
      document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true, clientX: 150, clientY: 130 }))
      await nextTick()

      const previewWrap = wrapper.find('.preview-canvas-wrap')
      const style = previewWrap.attributes('style')
      expect(style).not.toContain('translate(0px, 0px)')
    })
  })

  describe('undo/redo', () => {
    it('undoes paint operation with Ctrl+Z', async () => {
      const { pinia, brushStore, beadStore } = setup()
      brushStore.brushMode = true
      brushStore.activeColorIndex = 1 // Black
      const wrapper = mount(BeadPreview, { global: { plugins: [pinia] } })
      await nextTick()

      const canvas = wrapper.find('canvas')
      await canvas.trigger('mousedown', { clientX: 10, clientY: 10 })
      await canvas.trigger('mousemove', { clientX: 10, clientY: 10 })
      // End stroke
      document.dispatchEvent(new MouseEvent('mouseup'))

      const grid = beadStore.beadGrid!
      expect(grid.cells[0][0].colorIndex).toBe(1) // Painted

      // Ctrl+Z to undo
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
      await nextTick()

      expect(grid.cells[0][0].colorIndex).toBe(0) // Restored to White
    })

    it('redoes paint operation with Ctrl+Y', async () => {
      const { pinia, brushStore, beadStore } = setup()
      brushStore.brushMode = true
      brushStore.activeColorIndex = 1 // Black
      const wrapper = mount(BeadPreview, { global: { plugins: [pinia] } })
      await nextTick()

      const canvas = wrapper.find('canvas')
      await canvas.trigger('mousedown', { clientX: 10, clientY: 10 })
      await canvas.trigger('mousemove', { clientX: 10, clientY: 10 })
      document.dispatchEvent(new MouseEvent('mouseup'))

      const grid = beadStore.beadGrid!
      expect(grid.cells[0][0].colorIndex).toBe(1) // Painted

      // Ctrl+Z to undo
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
      await nextTick()
      expect(grid.cells[0][0].colorIndex).toBe(0) // Restored

      // Ctrl+Y to redo
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))
      await nextTick()
      expect(grid.cells[0][0].colorIndex).toBe(1) // Re-painted
    })

    it('redoes with Ctrl+Shift+Z', async () => {
      const { pinia, brushStore, beadStore } = setup()
      brushStore.brushMode = true
      brushStore.activeColorIndex = 1 // Black
      const wrapper = mount(BeadPreview, { global: { plugins: [pinia] } })
      await nextTick()

      const canvas = wrapper.find('canvas')
      await canvas.trigger('mousedown', { clientX: 10, clientY: 10 })
      await canvas.trigger('mousemove', { clientX: 10, clientY: 10 })
      document.dispatchEvent(new MouseEvent('mouseup'))

      const grid = beadStore.beadGrid!

      // Ctrl+Z to undo
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
      await nextTick()

      // Ctrl+Shift+Z to redo
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }))
      await nextTick()
      expect(grid.cells[0][0].colorIndex).toBe(1)
    })
  })
})
