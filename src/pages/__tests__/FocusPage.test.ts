import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createRouter, createWebHashHistory } from 'vue-router'
import { nextTick } from 'vue'
import FocusPage from '../FocusPage.vue'
import { useBeadStore } from '../../stores/beadStore'
import { useFocusStore } from '../../stores/focusStore'
import type { BeadGrid, PaletteColor } from '../../types'

function makeGrid(): BeadGrid {
  const palette: PaletteColor[] = [
    { id: 'r', name: 'Red', hex: '#FF0000', brand: 'test' },
  ]
  return {
    rows: 5,
    cols: 5,
    palette,
    cells: Array.from({ length: 5 }, (_, r) =>
      Array.from({ length: 5 }, (_, c) => ({
        row: r,
        col: c,
        colorIndex: 0,
      })),
    ),
    imageCols: 5,
    imageRows: 5,
  }
}

describe('FocusPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.removeItem('perler-beads:focus-progress')
  })

  function mountWithRouter(beadGrid?: BeadGrid) {
    const pinia = createPinia()
    setActivePinia(pinia)
    const bead = useBeadStore()
    if (beadGrid) {
      bead.beadGrid = beadGrid
    }
    const router = createRouter({
      history: createWebHashHistory(),
      routes: [{ path: '/focus', component: FocusPage }],
    })
    return mount(FocusPage, {
      global: { plugins: [pinia, router] },
    })
  }

  it('renders focus page when beadGrid exists', () => {
    const wrapper = mountWithRouter(makeGrid())
    expect(wrapper.find('.focus-page').exists()).toBe(true)
  })

  it('initializes focusStore on mount', () => {
    const wrapper = mountWithRouter(makeGrid())
    expect(wrapper.find('.focus-page').exists()).toBe(true)
    const focus = useFocusStore()
    expect(focus.blocks.length).toBeGreaterThan(0)
  })

  it('redirects to / when beadGrid does not exist', async () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    // Do not set beadGrid — component should redirect
    const router = createRouter({
      history: createWebHashHistory(),
      routes: [{ path: '/focus', component: FocusPage }],
    })
    const replaceSpy = vi.spyOn(router, 'replace')

    mount(FocusPage, {
      global: { plugins: [pinia, router] },
    })

    await nextTick()
    expect(replaceSpy).toHaveBeenCalledWith('/')
  })
})
