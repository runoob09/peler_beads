import { describe, it, expect, beforeEach, beforeAll, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'

function makeFile(): File {
  return new File(['x'], 'test.png', { type: 'image/png' })
}

// Mock Image: happy-dom cannot decode real images, so we override Image
// to simulate a successful decode with known dimensions.
class MockImage {
  onload: (() => void) | null = null
  onerror: ((_ev?: string | Event) => void) | null = null
  naturalWidth = 100
  naturalHeight = 80
  width = 100
  height = 80

  set src(_url: string) {
    queueMicrotask(() => {
      this.onload?.()
    })
  }
}

// Mock canvas context for happy-dom
function mockCanvasContext() {
  const state = {
    actions: [] as string[],
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  }
  return {
    _state: state,
    save() { state.actions.push('save') },
    restore() { state.actions.push('restore') },
    translate(_x: number, _y: number) { state.actions.push(`translate(${_x},${_y})`) },
    rotate(_a: number) { state.actions.push(`rotate(${_a})`) },
    scale(_x: number, _y: number) { state.actions.push(`scale(${_x},${_y})`) },
    drawImage(..._args: any[]) { state.actions.push('drawImage') },
    clearRect(_x: number, _y: number, _w: number, _h: number) { state.actions.push('clearRect') },
    getImageData(_x: number, _y: number, _w: number, _h: number) {
      state.actions.push('getImageData')
      const data = new Uint8ClampedArray(_w * _h * 4)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = 100; data[i + 1] = 150; data[i + 2] = 200; data[i + 3] = 255
      }
      return { data, width: _w, height: _h } as ImageData
    },
    putImageData(_d: ImageData, _x: number, _y: number) { state.actions.push('putImageData') },
    get fillStyle() { return state.fillStyle },
    set fillStyle(v: string) { state.fillStyle = v },
    get strokeStyle() { return state.strokeStyle },
    set strokeStyle(v: string) { state.strokeStyle = v },
    get lineWidth() { return state.lineWidth },
    set lineWidth(v: number) { state.lineWidth = v },
  }
}

// Mount options shared across tests — stub Teleport so content renders inline
const mountOptions = {
  global: {
    stubs: {
      teleport: true,
    },
  },
}

let ImageEditorModal: any

beforeAll(async () => {
  // Stub global Image before loading the composable module
  vi.stubGlobal('Image', MockImage)
  const mod = await import('../ImageEditorModal.vue')
  ImageEditorModal = mod.default
})

describe('ImageEditorModal', () => {
  beforeEach(() => {
    HTMLCanvasElement.prototype.getContext = (() => mockCanvasContext()) as any
    HTMLCanvasElement.prototype.toBlob = ((cb: any) => cb?.(new Blob(['fake'], { type: 'image/png' }))) as any
  })

  describe('visibility', () => {
    it('renders modal when show is true and imageFile is provided', async () => {
      const wrapper = mount(ImageEditorModal, {
        ...mountOptions,
        props: { show: true, imageFile: makeFile() },
      })
      await nextTick()
      expect(wrapper.find('.editor-modal').exists()).toBe(true)
    })

    it('does not render when show is false', () => {
      const wrapper = mount(ImageEditorModal, {
        ...mountOptions,
        props: { show: false, imageFile: makeFile() },
      })
      expect(wrapper.find('.editor-modal').exists()).toBe(false)
    })
  })

  describe('toolbar buttons', () => {
    it('has crop button', async () => {
      const wrapper = mount(ImageEditorModal, {
        ...mountOptions,
        props: { show: true, imageFile: makeFile() },
      })
      await nextTick()
      expect(wrapper.find('[data-test="btn-crop"]').exists()).toBe(true)
    })

    it('has rotate cw and ccw buttons', async () => {
      const wrapper = mount(ImageEditorModal, {
        ...mountOptions,
        props: { show: true, imageFile: makeFile() },
      })
      await nextTick()
      expect(wrapper.find('[data-test="btn-rotate-cw"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="btn-rotate-ccw"]').exists()).toBe(true)
    })

    it('has flip buttons', async () => {
      const wrapper = mount(ImageEditorModal, {
        ...mountOptions,
        props: { show: true, imageFile: makeFile() },
      })
      await nextTick()
      expect(wrapper.find('[data-test="btn-flip-h"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="btn-flip-v"]').exists()).toBe(true)
    })

    it('has reset button', async () => {
      const wrapper = mount(ImageEditorModal, {
        ...mountOptions,
        props: { show: true, imageFile: makeFile() },
      })
      await nextTick()
      expect(wrapper.find('[data-test="btn-reset"]').exists()).toBe(true)
    })
  })

  describe('filter sliders', () => {
    it('renders brightness, contrast, saturation sliders', async () => {
      const wrapper = mount(ImageEditorModal, {
        ...mountOptions,
        props: { show: true, imageFile: makeFile() },
      })
      await nextTick()
      expect(wrapper.find('[data-test="slider-brightness"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="slider-contrast"]').exists()).toBe(true)
      expect(wrapper.find('[data-test="slider-saturation"]').exists()).toBe(true)
    })
  })

  describe('confirm / cancel', () => {
    it('emits cancel when cancel button is clicked', async () => {
      const wrapper = mount(ImageEditorModal, {
        ...mountOptions,
        props: { show: true, imageFile: makeFile() },
      })
      await nextTick()
      await wrapper.find('[data-test="btn-cancel"]').trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })

    it('has confirm button that is rendered', async () => {
      const wrapper = mount(ImageEditorModal, {
        ...mountOptions,
        props: { show: true, imageFile: makeFile() },
      })
      await nextTick()
      expect(wrapper.find('[data-test="btn-confirm"]').exists()).toBe(true)
    })
  })

  describe('close button', () => {
    it('emits cancel when X button is clicked', async () => {
      const wrapper = mount(ImageEditorModal, {
        ...mountOptions,
        props: { show: true, imageFile: makeFile() },
      })
      await nextTick()
      await wrapper.find('.btn-close').trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    })
  })
})
