import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ExportButtons from '../ExportButtons.vue'

describe('ExportButtons', () => {
  it('renders export buttons', () => {
    const wrapper = mount(ExportButtons, { props: { hasGrid: true } })
    expect(wrapper.text()).toContain('PNG')
    expect(wrapper.text()).toContain('PDF')
  })

  it('emits png export', async () => {
    const wrapper = mount(ExportButtons, { props: { hasGrid: true } })
    const buttons = wrapper.findAll('button')
    const pngBtn = buttons.find(b => b.text().includes('PNG'))
    await pngBtn!.trigger('click')
    expect(wrapper.emitted('export-png')).toBeTruthy()
  })

  it('disables export when no grid', () => {
    const wrapper = mount(ExportButtons, { props: { hasGrid: false } })
    const buttons = wrapper.findAll('button')
    const pngBtn = buttons.find(b => b.text().includes('PNG'))
    expect(pngBtn!.element.disabled).toBe(true)
  })

  it('emits save project', async () => {
    const wrapper = mount(ExportButtons, { props: { hasGrid: true } })
    const buttons = wrapper.findAll('button')
    const saveBtn = buttons.find(b => b.text().includes('保存项目') && !b.text().includes('不含'))
    await saveBtn!.trigger('click')
    const emitted = wrapper.emitted('save-project')!
    expect(emitted[0][0]).toBe(true)
  })
})
