import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorLegend from '../ColorLegend.vue'
import type { BeadGrid, PaletteColor } from '../../types'

function makeGrid(colors: PaletteColor[], cells: { row: number; col: number; colorIndex: number }[][]): BeadGrid {
  return { rows: cells.length, cols: cells[0]?.length ?? 0, palette: colors, cells, imageCols: cells[0]?.length ?? 0, imageRows: cells.length }
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
    const grid = makeGrid(palette, [[{ row: 0, col: 0, colorIndex: 0 }]])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    expect(wrapper.find('aside').exists()).toBe(true)
    expect(wrapper.find('canvas').exists()).toBe(true)
  })

  it('shows drag handle with correct class', () => {
    const grid = makeGrid(palette, [[{ row: 0, col: 0, colorIndex: 0 }]])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    expect(wrapper.find('.drag-handle').exists()).toBe(true)
    expect(wrapper.find('.drag-grip').exists()).toBe(true)
  })

  it('has default panel width of 170px', () => {
    const grid = makeGrid(palette, [[{ row: 0, col: 0, colorIndex: 0 }]])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    const aside = wrapper.find('aside')
    expect(aside.attributes('style')).toContain('width: 170px')
  })

  it('adds dragging class during mousedown on handle', async () => {
    const grid = makeGrid(palette, [[{ row: 0, col: 0, colorIndex: 0 }]])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    const handle = wrapper.find('.drag-handle')
    await handle.trigger('mousedown', { clientX: 200 })
    expect(wrapper.find('.dragging').exists()).toBe(true)
    // Cleanup
    document.dispatchEvent(new MouseEvent('mouseup'))
  })

  it('notifies cell view with v-if logic', async () => {
    // Render with grid → visible
    const grid = makeGrid(palette, [[{ row: 0, col: 0, colorIndex: 0 }]])
    const wrapper = mount(ColorLegend, { props: { beadGrid: grid } })
    expect(wrapper.find('aside').exists()).toBe(true)

    // Update to null → hidden
    await wrapper.setProps({ beadGrid: null })
    expect(wrapper.find('aside').exists()).toBe(false)

    // Update back to grid → visible again
    await wrapper.setProps({ beadGrid: grid })
    expect(wrapper.find('aside').exists()).toBe(true)
  })
})
