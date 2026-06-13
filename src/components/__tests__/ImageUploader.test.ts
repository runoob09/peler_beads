import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ImageUploader from '../ImageUploader.vue'

describe('ImageUploader', () => {
  it('renders upload area', () => {
    const wrapper = mount(ImageUploader)
    expect(wrapper.find('.upload-area').exists()).toBe(true)
  })

  it('renders placeholder text', () => {
    const wrapper = mount(ImageUploader)
    expect(wrapper.text()).toContain('上传图片')
  })

  it('emits upload event when file selected', async () => {
    const wrapper = mount(ImageUploader)
    const file = new File(['dummy'], 'test.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(wrapper.emitted('upload')).toBeTruthy()
    expect(wrapper.emitted('upload')![0][0]).toBe(file)
  })

  it('shows checkmark after upload instead of file name', async () => {
    const wrapper = mount(ImageUploader)
    const file = new File(['dummy'], 'test.png', { type: 'image/png' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { value: [file] })
    await input.trigger('change')
    expect(wrapper.text()).toContain('✓ 已上传')
    expect(wrapper.text()).not.toContain('test.png')
  })
})
