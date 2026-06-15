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

})
