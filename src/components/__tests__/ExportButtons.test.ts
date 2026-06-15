import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ExportButtons from '../ExportButtons.vue'
import type { DisplaySettings } from '../../types'

function makeDisplay(overrides?: Partial<DisplaySettings>): DisplaySettings {
  return {
    showGrid: true,
    gridLineColor: '#cccccc',
    gridLineWidth: 1,
    boldGridInterval: 10,
    boldGridColor: '#000000',
    boldGridWidth: 2,
    renderMode: 'color',
    ...overrides,
  }
}

describe('ExportButtons', () => {
  it('renders export trigger button', () => {
    const wrapper = mount(ExportButtons, {
      props: { hasGrid: true, defaultDisplay: makeDisplay(), gridCols: 10, gridRows: 10 },
    })
    expect(wrapper.text()).toContain('导出图纸')
    expect(wrapper.text()).toContain('从图纸恢复')
  })

  it('opens modal on export button click', async () => {
    const wrapper = mount(ExportButtons, {
      props: { hasGrid: true, defaultDisplay: makeDisplay(), gridCols: 10, gridRows: 10 },
    })
    const buttons = wrapper.findAll('button')
    const exportBtn = buttons.find(b => b.text().includes('导出图纸'))
    await exportBtn!.trigger('click')
    // Modal should be visible now
    expect(document.body.textContent).toContain('PNG 图片')
  })

  it('disables export trigger when no grid', () => {
    const wrapper = mount(ExportButtons, {
      props: { hasGrid: false, defaultDisplay: makeDisplay(), gridCols: 10, gridRows: 10 },
    })
    const buttons = wrapper.findAll('button')
    const exportBtn = buttons.find(b => b.text().includes('导出图纸'))
    expect(exportBtn!.element.disabled).toBe(true)
  })

  it('emits import drawing', async () => {
    const wrapper = mount(ExportButtons, {
      props: { hasGrid: true, defaultDisplay: makeDisplay(), gridCols: 10, gridRows: 10 },
    })
    const buttons = wrapper.findAll('button')
    const importBtn = buttons.find(b => b.text().includes('从图纸恢复'))
    await importBtn!.trigger('click')
    expect(wrapper.emitted('import-drawing')).toBeTruthy()
  })
})
