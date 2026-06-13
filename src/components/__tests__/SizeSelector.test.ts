import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SizeSelector from '../SizeSelector.vue'

describe('SizeSelector', () => {
  it('renders preset buttons', () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    expect(wrapper.text()).toContain('29×29')
    expect(wrapper.text()).toContain('50×50')
  })

  it('emits update on preset click', async () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const btn = wrapper.findAll('button').find(b => b.text().includes('50×50'))
    await btn!.trigger('click')
    const emitted = wrapper.emitted('update:modelValue')!
    expect(emitted[0][0].cols).toBe(50)
    expect(emitted[0][0].rows).toBe(50)
  })

  it('renders aspect ratio lock toggle', () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(true)
  })
})
