import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SizeSelector from '../SizeSelector.vue'
import { BOARD_PRESETS } from '../../data/boardPresets'

describe('SizeSelector', () => {
  it('renders preset buttons', () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    expect(wrapper.text()).toContain('29×29')
    expect(wrapper.text()).toContain('50×50')
  })

  it('emits update on preset select', async () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const select = wrapper.find('select.preset-select')
    // Select "超大方板 50×50" which is at index 4
    await select.setValue('4')
    const emitted = wrapper.emitted('update:modelValue')! as any
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

describe('SizeSelector board presets', () => {
  it('renders preset dropdown with board options', () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const select = wrapper.find('select.preset-select')
    expect(select.exists()).toBe(true)
    const options = select.findAll('option')
    expect(options.length).toBe(BOARD_PRESETS.length)
    expect(options[0].text()).toContain('迷你板')
  })

  it('emits preset values when dropdown changes', async () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const select = wrapper.find('select.preset-select')
    await select.setValue('1')
    const emitted = wrapper.emitted('update:modelValue')! as any
    expect(emitted[0][0].cols).toBe(14)
    expect(emitted[0][0].rows).toBe(14)
  })

  it('disables custom inputs when a preset (non-custom) is selected', async () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const select = wrapper.find('select.preset-select')
    await select.setValue('0')
    const inputs = wrapper.findAll('input[type="number"]')
    for (const input of inputs) {
      expect((input.element as HTMLInputElement).disabled).toBe(true)
    }
  })

  it('enables custom inputs when "自定义" is selected', async () => {
    const wrapper = mount(SizeSelector, {
      props: { modelValue: { cols: 29, rows: 29, keepAspectRatio: true } },
    })
    const select = wrapper.find('select.preset-select')
    const customIndex = BOARD_PRESETS.findIndex(p => p.label === '自定义')
    await select.setValue(String(customIndex))
    const inputs = wrapper.findAll('input[type="number"]')
    for (const input of inputs) {
      expect((input.element as HTMLInputElement).disabled).toBe(false)
    }
  })
})
