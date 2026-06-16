import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FocusBottomBar from '../FocusBottomBar.vue'
import { useFocusStore } from '../../../stores/focusStore'
import { useBeadStore } from '../../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../../types'

function makeGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
    { id: 'b', name: 'Blue', hex: '#0000FF', brand: 'test' },
  ]
  const cells: (number | null)[][] = [
    ...Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => 0)),
    ...Array.from({ length: 4 }, () => Array.from({ length: 5 }, () => 1)),
  ]
  return {
    rows: 8,
    cols: 5,
    palette,
    cells: cells.map((row, r) =>
      row.map((colorIndex, c) => ({ row: r, col: c, colorIndex })),
    ),
    imageCols: 5,
    imageRows: 8,
  }
}

describe('FocusBottomBar', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
    const bead = useBeadStore()
    bead.beadGrid = makeGrid()
    useFocusStore().initFromGrid()
  })

  function mountBar() {
    return mount(FocusBottomBar, { global: { plugins: [pinia] } })
  }

  it('renders prev, complete, and next buttons', () => {
    const wrapper = mountBar()
    expect(wrapper.text()).toContain('上一块')
    expect(wrapper.text()).toContain('标记完成')
    expect(wrapper.text()).toContain('下一块')
  })

  it('disables prev button on first block', () => {
    const wrapper = mountBar()
    const prevBtn = wrapper.find('[data-test="prev-block"]')
    expect(prevBtn.attributes('disabled')).toBeDefined()
  })

  it('completes current block and advances on complete click', async () => {
    const focus = useFocusStore()
    const wrapper = mountBar()
    await wrapper.find('[data-test="complete-block"]').trigger('click')
    expect(focus.blocks[0].status).toBe('completed')
    expect(focus.currentBlockIndex).toBe(1)
  })
})
