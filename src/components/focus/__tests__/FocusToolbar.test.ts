import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import FocusToolbar from '../FocusToolbar.vue'
import { useFocusStore } from '../../../stores/focusStore'
import { useBeadStore } from '../../../stores/beadStore'
import type { BeadGrid, PaletteColor } from '../../../types'

function makeGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
  ]
  return {
    rows: 5, cols: 5, palette,
    cells: Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => ({
        row: r, col: c, colorIndex: 0,
      })),
    ),
    imageCols: 5, imageRows: 5,
  }
}

describe('FocusToolbar', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    const bead = useBeadStore()
    bead.beadGrid = makeGrid()
    useFocusStore().initFromGrid()
  })

  function mountToolbar(props = {}) {
    return mount(FocusToolbar, {
      props: {
        timerFormatted: '00:00',
        timerRunning: false,
        ...props,
      },
      global: { plugins: [pinia] },
    })
  }

  it('renders exit button', () => {
    const wrapper = mountToolbar()
    expect(wrapper.find('.focus-toolbar').exists()).toBe(true)
    expect(wrapper.text()).toContain('退出')
  })

  it('displays progress percentage', () => {
    const wrapper = mountToolbar()
    expect(wrapper.text()).toContain('0%')
  })

  it('displays current color name', () => {
    const wrapper = mountToolbar()
    expect(wrapper.text()).toContain('Red')
  })

  it('displays timer', () => {
    const wrapper = mountToolbar({ timerFormatted: '12:34', timerRunning: true })
    expect(wrapper.text()).toContain('12:34')
  })

  it('emits exit when exit button clicked', async () => {
    const wrapper = mountToolbar()
    await wrapper.find('[data-test="exit-btn"]').trigger('click')
    expect(wrapper.emitted('exit')).toBeTruthy()
  })
})
