import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PalettePanel from '../PalettePanel.vue'

describe('PalettePanel', () => {
  it('renders brand selector and palette info', () => {
    const wrapper = mount(PalettePanel, {
      props: { brandNames: ['Brand-A', 'Brand-B'], selectedBrand: 'Brand-A', palette: [] },
    })
    expect(wrapper.text()).toContain('Brand-A')
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('emits brand change', async () => {
    const wrapper = mount(PalettePanel, {
      props: { brandNames: ['Brand-A', 'Brand-B'], selectedBrand: 'Brand-A', palette: [] },
    })
    const select = wrapper.find('select')
    await select.setValue('Brand-B')
    expect(wrapper.emitted('select-brand')![0]).toEqual(['Brand-B'])
  })

  it('shows palette color count', () => {
    const palette = [
      { id: '1', name: 'Red', hex: '#FF0000', brand: 'test' },
      { id: '2', name: 'Blue', hex: '#0000FF', brand: 'test' },
    ]
    const wrapper = mount(PalettePanel, {
      props: { brandNames: ['test'], selectedBrand: 'test', palette },
    })
    expect(wrapper.text()).toContain('2')
  })
})
