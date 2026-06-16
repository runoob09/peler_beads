import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import DesignPage from '../DesignPage.vue'

describe('DesignPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders the three-column layout', () => {
    const wrapper = mount(DesignPage, {
      global: { plugins: [createPinia()] },
    })
    expect(wrapper.find('.app-layout').exists()).toBe(true)
  })

  it('shows empty state when no grid', () => {
    const pinia = createPinia()
    setActivePinia(pinia)
    const wrapper = mount(DesignPage, { global: { plugins: [pinia] } })
    expect(wrapper.text()).toContain('上传图片开始')
  })
})
