import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ColorAdjustments from '../ColorAdjustments.vue'
import DisplayOptions from '../DisplayOptions.vue'
import type { AdjustmentSettings, RenderMode } from '../../types'

describe('ColorAdjustments', () => {
  it('renders three sliders', () => {
    const settings: AdjustmentSettings = { brightness: 0, contrast: 0, saturation: 0 }
    const wrapper = mount(ColorAdjustments, { props: { modelValue: settings } })
    const ranges = wrapper.findAll('input[type="range"]')
    expect(ranges.length).toBe(3)
  })

  it('emits update on slider change', async () => {
    const settings: AdjustmentSettings = { brightness: 0, contrast: 0, saturation: 0 }
    const wrapper = mount(ColorAdjustments, { props: { modelValue: settings } })
    const r = wrapper.findAll('input[type="range"]')[0]
    await r.setValue(50)
    const emitted = wrapper.emitted('update:modelValue')! as any
    expect(emitted[0][0].brightness).toBe(50)
  })
})

describe('DisplayOptions', () => {
  it('renders render mode selector', () => {
    const wrapper = mount(DisplayOptions, {
      props: { modelValue: {
        showGrid: true, gridLineColor: '#ccc', gridLineWidth: 1,
        boldGridInterval: 10, boldGridColor: '#000', boldGridWidth: 2,
        renderMode: 'color' as RenderMode,
      }},
    })
    expect(wrapper.find('select').exists()).toBe(true)
  })

  it('shows grid interval input', () => {
    const wrapper = mount(DisplayOptions, {
      props: { modelValue: {
        showGrid: true, gridLineColor: '#ccc', gridLineWidth: 1,
        boldGridInterval: 10, boldGridColor: '#000', boldGridWidth: 2,
        renderMode: 'color' as RenderMode,
      }},
    })
    expect(wrapper.text()).toContain('粗线间隔')
  })
})
