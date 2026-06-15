import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DisplayOptions from '../DisplayOptions.vue'
import type { RenderMode } from '../../types'

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
